"""Simulation engine — bottom-up load aggregation with RMU switching support.

Every 5 seconds:
  1. Compute consumer demands (diurnal patterns)
  2. Aggregate bottom-up: consumer → LV feeder → transformer → RMU → MV feeder → substation
  3. Global balancing: gas_output = total_demand - solar_output
  4. Top-down: compute generator + HV line metrics
  5. Store metrics in rolling buffers (720 points = 1 hour)
"""

from __future__ import annotations

import asyncio
import math
import random
from collections import deque
from datetime import datetime, timezone
from typing import Any

from . import data_loader

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

UPDATE_INTERVAL_S = 5
HISTORY_MAXLEN = 720  # 1 hour at 5-second intervals

# ---------------------------------------------------------------------------
# In-memory metrics store
# ---------------------------------------------------------------------------

# asset_id -> deque of MetricsPoint dicts
_metrics_store: dict[str, deque[dict[str, Any]]] = {}

# Latest snapshot per asset (for quick access)
_latest: dict[str, dict[str, Any]] = {}

# Background task handle
_task: asyncio.Task | None = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_latest(asset_id: str) -> dict[str, Any] | None:
    """Return the most recent metrics point for an asset."""
    return _latest.get(asset_id)


def get_history(asset_id: str) -> list[dict[str, Any]]:
    """Return the full rolling history for an asset."""
    buf = _metrics_store.get(asset_id)
    return list(buf) if buf else []


def start(loop: asyncio.AbstractEventLoop | None = None) -> None:
    """Start the simulation background task."""
    global _task
    _initialise_buffers()
    _task = asyncio.ensure_future(_run())


def stop() -> None:
    """Cancel the simulation background task."""
    global _task
    if _task is not None:
        _task.cancel()
        _task = None


# ---------------------------------------------------------------------------
# Internals — helpers
# ---------------------------------------------------------------------------

def _initialise_buffers() -> None:
    """Create empty deques for every asset."""
    for aid in data_loader.get_all_asset_ids():
        _metrics_store[aid] = deque(maxlen=HISTORY_MAXLEN)


def _solar_factor(hour: float) -> float:
    """0-1 factor for solar output. Peaks at 12:00, zero 20:00-05:00."""
    if hour < 5.0 or hour > 20.0:
        return 0.0
    t = (hour - 5.0) / 15.0 * math.pi
    return max(0.0, math.sin(t))


def _residential_factor(hour: float) -> float:
    """0-1 factor for residential demand. Evening peak, night trough."""
    base = 0.3
    day_bump = 0.3 * max(0.0, math.sin((hour - 6.0) / 18.0 * math.pi))
    evening = 0.4 * math.exp(-0.5 * ((hour - 19.0) / 2.0) ** 2)
    return min(1.0, base + day_bump + evening)


def _jitter(value: float, pct: float = 0.03) -> float:
    """Add small random noise."""
    return value * (1.0 + random.uniform(-pct, pct))


async def _run() -> None:
    """Main simulation loop."""
    try:
        while True:
            _tick()
            await asyncio.sleep(UPDATE_INTERVAL_S)
    except asyncio.CancelledError:
        pass


# ---------------------------------------------------------------------------
# Main tick — bottom-up load aggregation
# ---------------------------------------------------------------------------

def _tick() -> None:
    """Compute one full simulation step for all assets."""
    now = datetime.now(timezone.utc)
    timestamp = now.isoformat()
    hour = (now.hour + 1 + now.minute / 60.0) % 24.0  # Munich ≈ UTC+1

    # Temporary per-asset load values (MW) computed bottom-up
    loads: dict[str, float] = {}

    # ==================================================================
    # 1. CONSUMERS — compute demand
    # ==================================================================
    for aid in data_loader.get_all_asset_ids():
        asset = data_loader.get_asset_raw(aid)
        if asset is None or asset["type"] != "consumer":
            continue

        peak = asset["metadata"]["peak_load_mw"]
        subtype = asset["subtype"]

        if subtype == "hospital":
            demand = _jitter(peak * 0.8, 0.05)
        elif subtype == "data_center":
            demand = _jitter(peak * 0.85, 0.03)
        elif subtype == "residential":
            demand = _jitter(peak * _residential_factor(hour), 0.05)
        else:
            demand = _jitter(peak * 0.5, 0.05)

        loads[aid] = round(demand, 3)

    # ==================================================================
    # 2. LV FEEDERS — sum of connected consumers
    # ==================================================================
    for aid in data_loader.get_all_asset_ids():
        asset = data_loader.get_asset_raw(aid)
        if asset is None or asset["type"] != "feeder_lv":
            continue
        downstream = data_loader.get_downstream_consumers(aid, respect_rmu=True)
        loads[aid] = round(sum(loads.get(c, 0) for c in downstream), 3)

    # ==================================================================
    # 3. TRANSFORMERS — sum of downstream LV feeders
    # ==================================================================
    for aid in data_loader.get_all_asset_ids():
        asset = data_loader.get_asset_raw(aid)
        if asset is None or asset["type"] != "transformer_mv_lv":
            continue
        downstream_lv = data_loader.get_downstream_of_type(aid, "feeder_lv", respect_rmu=True)
        loads[aid] = round(sum(loads.get(f, 0) for f in downstream_lv), 3)

    # ==================================================================
    # 4. RMUs — load = sum of downstream transformers (0 if open)
    # ==================================================================
    for aid in data_loader.get_all_asset_ids():
        asset = data_loader.get_asset_raw(aid)
        if asset is None or asset["type"] != "rmu":
            continue
        if data_loader.is_rmu_open(aid):
            loads[aid] = 0.0
        else:
            downstream_trafo = data_loader.get_downstream_of_type(aid, "transformer_mv_lv", respect_rmu=True)
            loads[aid] = round(sum(loads.get(t, 0) for t in downstream_trafo), 3)

    # ==================================================================
    # 5. MV FEEDERS — sum of downstream RMUs
    # ==================================================================
    for aid in data_loader.get_all_asset_ids():
        asset = data_loader.get_asset_raw(aid)
        if asset is None or asset["type"] != "feeder_mv":
            continue
        downstream_rmu = data_loader.get_downstream_of_type(aid, "rmu", respect_rmu=False)
        # For each RMU, use its load (already accounts for open/closed)
        loads[aid] = round(sum(loads.get(r, 0) for r in downstream_rmu), 3)

    # ==================================================================
    # 6. SUBSTATIONS — sum of downstream MV feeders
    # ==================================================================
    for aid in data_loader.get_all_asset_ids():
        asset = data_loader.get_asset_raw(aid)
        if asset is None or asset["type"] != "substation_hv_mv":
            continue
        downstream_mv = data_loader.get_downstream_of_type(aid, "feeder_mv", respect_rmu=False)
        loads[aid] = round(sum(loads.get(f, 0) for f in downstream_mv), 3)

    # ==================================================================
    # 7. GENERATION — global balancing
    # ==================================================================
    total_demand = sum(
        loads.get(aid, 0)
        for aid in data_loader.get_all_asset_ids()
        if data_loader.get_asset_raw(aid) and data_loader.get_asset_raw(aid)["type"] == "consumer"
    )

    solar_capacity = 50.0
    gas_capacity = 150.0
    solar_output = round(_jitter(solar_capacity * _solar_factor(hour), 0.04), 3)
    gas_output = round(max(0.0, min(gas_capacity, total_demand - solar_output)), 3)

    # ==================================================================
    # 8. BUILD METRICS for every asset
    # ==================================================================
    for aid in data_loader.get_all_asset_ids():
        asset = data_loader.get_asset_raw(aid)
        if asset is None:
            continue

        values: dict[str, Any] = {}
        a_type = asset["type"]

        # --- Generators ---
        if a_type == "generator":
            if asset["subtype"] == "solar":
                p = solar_output
                v = _jitter(110.0, 0.01)
                i = round(p * 1000.0 / (v * math.sqrt(3)), 2) if v > 0 else 0.0
                q = round(p * random.uniform(0.05, 0.15), 3)
                values = {
                    "active_power_mw": p,
                    "reactive_power_mvar": q,
                    "voltage_kv": round(v, 2),
                    "current_a": i,
                    "capacity_factor": round(p / solar_capacity, 3),
                    "status": 1.0,
                }
            else:  # CCGT
                p = gas_output
                v = _jitter(110.0, 0.005)
                i = round(p * 1000.0 / (v * math.sqrt(3)), 2) if v > 0 else 0.0
                q = round(p * random.uniform(0.08, 0.12), 3)
                values = {
                    "active_power_mw": p,
                    "reactive_power_mvar": q,
                    "voltage_kv": round(v, 2),
                    "current_a": i,
                    "capacity_factor": round(p / gas_capacity, 3),
                    "efficiency": round(_jitter(0.58, 0.02), 3),
                    "status": 1.0,
                }

        # --- HV Transmission Lines ---
        elif a_type == "transmission_line_hv":
            line_cap = asset["metadata"]["capacity_mw"]
            from_id = asset["metadata"].get("from_asset", "")
            if from_id == "gen_solar_1":
                p = solar_output
            elif from_id == "gen_gas_1":
                p = gas_output
            elif from_id.startswith("sub_hv_mv"):
                p = loads.get("sub_hv_mv_2", 0)
            else:
                p = (solar_output + gas_output) * 0.3
            v = _jitter(110.0, 0.01)
            i = round(p * 1000.0 / (v * math.sqrt(3)), 2) if v > 0 else 0.0
            loading = round((p / line_cap) * 100.0, 1) if line_cap > 0 else 0.0
            values = {
                "active_power_mw": round(p, 3),
                "current_a": i,
                "voltage_kv": round(v, 2),
                "loading_pct": min(100.0, loading),
            }

        # --- HV/MV Substations ---
        elif a_type == "substation_hv_mv":
            load = loads.get(aid, 0)
            cap = asset["metadata"]["capacity_mva"]
            values = {
                "input_voltage_kv": round(_jitter(110.0, 0.01), 2),
                "output_voltage_kv": round(_jitter(11.0, 0.01), 2),
                "load_mw": load,
                "loading_pct": round((load / cap) * 100.0, 1) if cap > 0 else 0.0,
                "status": 1.0,
            }

        # --- MV Feeders ---
        elif a_type == "feeder_mv":
            load = loads.get(aid, 0)
            cap = asset["metadata"]["capacity_mw"]
            v = _jitter(11.0, 0.01)
            i = round(load * 1000.0 / (v * math.sqrt(3)), 2) if v > 0 else 0.0
            values = {
                "load_mw": load,
                "loading_percent": round((load / cap) * 100.0, 1) if cap > 0 else 0.0,
                "current_a": i,
                "voltage_kv": round(v, 2),
            }

        # --- RMUs ---
        elif a_type == "rmu":
            state = data_loader.get_rmu_state(aid)
            load = loads.get(aid, 0)
            values = {
                "state": state,
                "load_mw": load,
                "voltage_kv": round(_jitter(11.0, 0.01), 2) if state == "closed" else 0.0,
            }

        # --- Transformers (MV → LV) ---
        elif a_type == "transformer_mv_lv":
            load = loads.get(aid, 0)
            cap_kva = asset["metadata"]["capacity_kva"]
            load_kw = load * 1000.0  # MW → kW
            utilization = round((load_kw / cap_kva) * 100.0, 1) if cap_kva > 0 else 0.0
            values = {
                "capacity_kva": cap_kva,
                "current_load_kw": round(load_kw, 1),
                "utilization_percent": min(100.0, utilization),
                "input_voltage_kv": round(_jitter(11.0, 0.01), 2),
                "output_voltage_kv": round(_jitter(0.4, 0.02), 3),
            }

        # --- LV Feeders ---
        elif a_type == "feeder_lv":
            load = loads.get(aid, 0)
            cap_kw = asset["metadata"].get("capacity_kw", 400)
            load_kw = load * 1000.0
            v = _jitter(0.4, 0.02)
            i = round(load_kw / (v * math.sqrt(3)), 2) if v > 0 else 0.0
            values = {
                "load_mw": load,
                "loading_percent": round((load_kw / cap_kw) * 100.0, 1) if cap_kw > 0 else 0.0,
                "current_a": i,
                "voltage_kv": round(v, 3),
            }

        # --- Consumers ---
        elif a_type == "consumer":
            demand = loads.get(aid, 0)
            v = _jitter(0.4, 0.02)
            values = {
                "active_power_mw": demand,
                "voltage_kv": round(v, 3),
            }

        # Store the point
        point = {"timestamp": timestamp, "values": values}
        _metrics_store[aid].append(point)
        _latest[aid] = point

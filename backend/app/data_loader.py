"""Load and serve the static network data from JSON, with RMU switching support."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import AssetDetail, AssetSummary, Coordinates, NetworkEdge

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_NETWORK_FILE = _DATA_DIR / "network_data.json"

# ---------------------------------------------------------------------------
# In-memory stores (populated on load)
# ---------------------------------------------------------------------------

_assets: dict[str, dict[str, Any]] = {}
_edges: list[dict[str, str]] = []

# RMU switching state — key: rmu_id, value: "open" | "closed"
_rmu_states: dict[str, str] = {}


def load_network_data() -> None:
    """Read network_data.json and populate in-memory stores."""
    global _assets, _edges, _rmu_states

    raw = json.loads(_NETWORK_FILE.read_text(encoding="utf-8"))

    _assets = {asset["id"]: asset for asset in raw["assets"]}
    _edges = raw["network"]["edges"]

    # Initialise RMU states from metadata
    _rmu_states.clear()
    for aid, asset in _assets.items():
        if asset["type"] == "rmu":
            _rmu_states[aid] = asset["metadata"].get("state", "closed")


# ---------------------------------------------------------------------------
# Public accessors
# ---------------------------------------------------------------------------

def get_all_asset_summaries() -> list[AssetSummary]:
    """Return lightweight summary of every asset."""
    return [
        AssetSummary(
            id=a["id"],
            type=a["type"],
            subtype=a["subtype"],
            voltage_level=a.get("voltage_level", "LV"),
            name=a["name"],
            coordinates=Coordinates(**a["coordinates"]),
        )
        for a in _assets.values()
    ]


def get_asset_detail(asset_id: str) -> AssetDetail | None:
    """Return full detail for a single asset, or None if not found."""
    a = _assets.get(asset_id)
    if a is None:
        return None

    path = None
    if "path" in a:
        path = [Coordinates(**p) for p in a["path"]]

    # For RMUs, inject current switching state into metadata
    metadata = dict(a["metadata"])
    if a["type"] == "rmu":
        metadata["state"] = _rmu_states.get(asset_id, "closed")

    return AssetDetail(
        id=a["id"],
        type=a["type"],
        subtype=a["subtype"],
        voltage_level=a.get("voltage_level", "LV"),
        name=a["name"],
        coordinates=Coordinates(**a["coordinates"]),
        metadata=metadata,
        path=path,
    )


def get_all_asset_ids() -> list[str]:
    """Return every asset ID in the network."""
    return list(_assets.keys())


def get_asset_raw(asset_id: str) -> dict[str, Any] | None:
    """Return the raw dict for an asset (used by simulation engine)."""
    return _assets.get(asset_id)


def get_network_edges() -> list[NetworkEdge]:
    """Return the edge list for the network graph."""
    return [NetworkEdge(**e) for e in _edges]


# ---------------------------------------------------------------------------
# RMU switching
# ---------------------------------------------------------------------------

def get_rmu_state(rmu_id: str) -> str | None:
    """Return the current state of an RMU, or None if not an RMU."""
    return _rmu_states.get(rmu_id)


def set_rmu_state(rmu_id: str, state: str) -> str | None:
    """Set the state of an RMU. Returns new state, or None if invalid."""
    if rmu_id not in _rmu_states:
        return None
    _rmu_states[rmu_id] = state
    return state


def toggle_rmu(rmu_id: str) -> str | None:
    """Toggle an RMU between open and closed. Returns new state."""
    current = _rmu_states.get(rmu_id)
    if current is None:
        return None
    new_state = "open" if current == "closed" else "closed"
    _rmu_states[rmu_id] = new_state
    return new_state


def is_rmu_open(rmu_id: str) -> bool:
    """Check if an RMU is currently open (blocking power flow)."""
    return _rmu_states.get(rmu_id) == "open"


# ---------------------------------------------------------------------------
# Graph traversal (RMU-aware)
# ---------------------------------------------------------------------------

def get_downstream_assets(asset_id: str, respect_rmu: bool = True) -> list[str]:
    """BFS downstream from asset_id, returning all reachable asset IDs.

    If respect_rmu is True, open RMUs block traversal.
    """
    visited: set[str] = set()
    queue = [asset_id]
    result: list[str] = []

    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)

        # If this is an open RMU and we're respecting switching, stop here
        if respect_rmu and current != asset_id:
            asset = _assets.get(current)
            if asset and asset["type"] == "rmu" and is_rmu_open(current):
                continue

        result.append(current)

        # Follow outgoing edges
        for edge in _edges:
            if edge["source"] == current and edge["target"] not in visited:
                queue.append(edge["target"])

    return result


def get_downstream_consumers(asset_id: str, respect_rmu: bool = True) -> list[str]:
    """BFS downstream, returning only consumer IDs reachable."""
    all_downstream = get_downstream_assets(asset_id, respect_rmu=respect_rmu)
    return [
        aid for aid in all_downstream
        if _assets.get(aid, {}).get("type") == "consumer"
    ]


def get_downstream_of_type(asset_id: str, asset_type: str, respect_rmu: bool = True) -> list[str]:
    """BFS downstream, returning only assets of a specific type."""
    all_downstream = get_downstream_assets(asset_id, respect_rmu=respect_rmu)
    return [
        aid for aid in all_downstream
        if _assets.get(aid, {}).get("type") == asset_type
    ]

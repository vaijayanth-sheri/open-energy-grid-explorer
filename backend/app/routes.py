"""API route definitions for the Open Energy Grid Explorer."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from . import data_loader, simulation
from .models import (
    AssetDetail,
    AssetSummary,
    MetricsPoint,
    MetricsResponse,
    NetworkResponse,
    RmuToggleResponse,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /assets — list all assets (lightweight)
# ---------------------------------------------------------------------------

@router.get("/assets", response_model=list[AssetSummary])
def list_assets():
    """Return a lightweight summary of every asset in the network."""
    return data_loader.get_all_asset_summaries()


# ---------------------------------------------------------------------------
# GET /assets/{asset_id} — detailed metadata for one asset
# ---------------------------------------------------------------------------

@router.get("/assets/{asset_id}", response_model=AssetDetail)
def get_asset(asset_id: str):
    """Return the full detail for a single asset."""
    detail = data_loader.get_asset_detail(asset_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found")
    return detail


# ---------------------------------------------------------------------------
# GET /assets/{asset_id}/metrics — latest + 1h history
# ---------------------------------------------------------------------------

@router.get("/assets/{asset_id}/metrics", response_model=MetricsResponse)
def get_asset_metrics(asset_id: str):
    """Return the latest metrics snapshot and rolling 1-hour history."""
    if data_loader.get_asset_raw(asset_id) is None:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found")

    latest_raw = simulation.get_latest(asset_id)
    history_raw = simulation.get_history(asset_id)

    latest = MetricsPoint(**latest_raw) if latest_raw else None
    history = [MetricsPoint(**h) for h in history_raw]

    return MetricsResponse(
        asset_id=asset_id,
        latest=latest,
        history=history,
    )


# ---------------------------------------------------------------------------
# GET /network — full adjacency list
# ---------------------------------------------------------------------------

@router.get("/network", response_model=NetworkResponse)
def get_network():
    """Return the complete network graph (nodes + edges)."""
    return NetworkResponse(
        nodes=data_loader.get_all_asset_summaries(),
        edges=data_loader.get_network_edges(),
    )


# ---------------------------------------------------------------------------
# POST /rmu/{rmu_id}/toggle — switch RMU open/closed
# ---------------------------------------------------------------------------

@router.post("/rmu/{rmu_id}/toggle", response_model=RmuToggleResponse)
def toggle_rmu(rmu_id: str):
    """Toggle an RMU between open and closed state."""
    # Verify it's a valid RMU
    asset = data_loader.get_asset_raw(rmu_id)
    if asset is None:
        raise HTTPException(status_code=404, detail=f"Asset '{rmu_id}' not found")
    if asset["type"] != "rmu":
        raise HTTPException(status_code=400, detail=f"Asset '{rmu_id}' is not an RMU")

    new_state = data_loader.toggle_rmu(rmu_id)
    if new_state is None:
        raise HTTPException(status_code=500, detail="Failed to toggle RMU state")

    return RmuToggleResponse(rmu_id=rmu_id, new_state=new_state)

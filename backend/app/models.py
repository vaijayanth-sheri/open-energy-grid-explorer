"""Pydantic models for the Open Energy Grid Explorer API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Coordinates
# ---------------------------------------------------------------------------

class Coordinates(BaseModel):
    lat: float
    lng: float


# ---------------------------------------------------------------------------
# Asset models
# ---------------------------------------------------------------------------

class AssetSummary(BaseModel):
    """Lightweight representation returned by GET /assets."""
    id: str
    type: str
    subtype: str
    voltage_level: str
    name: str
    coordinates: Coordinates


class AssetDetail(AssetSummary):
    """Full representation returned by GET /assets/{id}."""
    metadata: dict[str, Any]
    path: list[Coordinates] | None = None


# ---------------------------------------------------------------------------
# Metrics models
# ---------------------------------------------------------------------------

class MetricsPoint(BaseModel):
    """A single metrics snapshot at a point in time."""
    timestamp: str  # ISO-8601
    values: dict[str, float | str]


class MetricsResponse(BaseModel):
    """Response for GET /assets/{id}/metrics."""
    asset_id: str
    latest: MetricsPoint | None = None
    history: list[MetricsPoint] = []


# ---------------------------------------------------------------------------
# Network models
# ---------------------------------------------------------------------------

class NetworkEdge(BaseModel):
    source: str
    target: str


class NetworkResponse(BaseModel):
    """Response for GET /network."""
    nodes: list[AssetSummary]
    edges: list[NetworkEdge]


# ---------------------------------------------------------------------------
# RMU switching
# ---------------------------------------------------------------------------

class RmuToggleResponse(BaseModel):
    """Response for POST /rmu/{id}/toggle."""
    rmu_id: str
    new_state: str  # "open" or "closed"

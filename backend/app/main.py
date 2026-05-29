"""FastAPI application entry point for the Open Energy Grid Explorer."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import data_loader, simulation
from .routes import router


# ---------------------------------------------------------------------------
# Lifespan — start/stop the simulation engine
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: load data & start simulation.  Shutdown: stop simulation."""
    # Startup
    data_loader.load_network_data()
    simulation.start()
    yield
    # Shutdown
    simulation.stop()


# ---------------------------------------------------------------------------
# App creation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Open Energy Grid Explorer",
    description="City-scale electrical network digital twin API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow only the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(router)

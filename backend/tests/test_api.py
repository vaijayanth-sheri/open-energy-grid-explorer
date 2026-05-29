"""Integration tests for the FastAPI endpoints — updated for MV/LV network."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import simulation
from app.data_loader import load_network_data, set_rmu_state


@pytest.fixture()
def client():
    with TestClient(app) as c:
        simulation._tick()
        yield c


class TestListAssets:
    def test_status_ok(self, client):
        assert client.get("/assets").status_code == 200

    def test_returns_37_assets(self, client):
        data = client.get("/assets").json()
        assert len(data) == 37

    def test_asset_has_voltage_level(self, client):
        data = client.get("/assets").json()
        for a in data:
            assert "voltage_level" in a
            assert a["voltage_level"] in ("HV", "MV", "LV")


class TestGetAsset:
    def test_existing_asset(self, client):
        data = client.get("/assets/gen_solar_1").json()
        assert data["id"] == "gen_solar_1"
        assert data["voltage_level"] == "HV"

    def test_rmu_has_state(self, client):
        data = client.get("/assets/rmu_1").json()
        assert data["metadata"]["state"] in ("open", "closed")

    def test_nonexistent_asset(self, client):
        assert client.get("/assets/fake_id").status_code == 404


class TestGetMetrics:
    def test_status_ok(self, client):
        assert client.get("/assets/gen_solar_1/metrics").status_code == 200

    def test_has_latest(self, client):
        data = client.get("/assets/gen_solar_1/metrics").json()
        assert data["latest"] is not None

    def test_404_for_nonexistent(self, client):
        assert client.get("/assets/fake_id/metrics").status_code == 404


class TestGetNetwork:
    def test_has_nodes_and_edges(self, client):
        data = client.get("/network").json()
        assert len(data["nodes"]) == 37
        assert len(data["edges"]) == 37


class TestRmuToggle:
    def test_toggle_rmu(self, client):
        # rmu_1 starts closed
        resp = client.post("/rmu/rmu_1/toggle")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rmu_id"] == "rmu_1"
        assert data["new_state"] == "open"

        # Toggle back
        resp = client.post("/rmu/rmu_1/toggle")
        assert resp.json()["new_state"] == "closed"

    def test_toggle_nonexistent(self, client):
        assert client.post("/rmu/fake_id/toggle").status_code == 404

    def test_toggle_non_rmu(self, client):
        resp = client.post("/rmu/gen_solar_1/toggle")
        assert resp.status_code == 400

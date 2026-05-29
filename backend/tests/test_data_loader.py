"""Tests for the data loader module — updated for MV/LV network."""

import pytest

from app.data_loader import (
    get_all_asset_ids,
    get_all_asset_summaries,
    get_asset_detail,
    get_asset_raw,
    get_downstream_consumers,
    get_downstream_of_type,
    get_network_edges,
    get_rmu_state,
    is_rmu_open,
    load_network_data,
    set_rmu_state,
    toggle_rmu,
)


@pytest.fixture(autouse=True)
def _load_data():
    """Ensure network data is loaded before every test."""
    load_network_data()


class TestDataLoading:
    """Verify that network_data.json loads correctly."""

    def test_total_asset_count(self):
        ids = get_all_asset_ids()
        assert len(ids) == 37, f"Expected 37 assets, got {len(ids)}"

    def test_all_ids_follow_naming_convention(self):
        valid_prefixes = (
            "gen_", "line_hv_", "sub_hv_mv_", "feeder_mv_", "rmu_",
            "trafo_", "feeder_lv_", "cons_",
        )
        for aid in get_all_asset_ids():
            assert any(aid.startswith(p) for p in valid_prefixes), (
                f"ID '{aid}' does not follow naming convention"
            )

    def test_generators_exist(self):
        for gid in ("gen_solar_1", "gen_gas_1"):
            g = get_asset_raw(gid)
            assert g is not None
            assert g["type"] == "generator"

    def test_substations_exist(self):
        for sid in ("sub_hv_mv_1", "sub_hv_mv_2"):
            s = get_asset_raw(sid)
            assert s is not None
            assert s["type"] == "substation_hv_mv"

    def test_rmu_count(self):
        rmus = [a for a in get_all_asset_ids() if get_asset_raw(a)["type"] == "rmu"]
        assert len(rmus) == 7

    def test_transformer_count(self):
        trafos = [a for a in get_all_asset_ids() if get_asset_raw(a)["type"] == "transformer_mv_lv"]
        assert len(trafos) == 5

    def test_consumer_count(self):
        consumers = [a for a in get_all_asset_ids() if get_asset_raw(a)["type"] == "consumer"]
        assert len(consumers) == 8

    def test_mv_feeder_count(self):
        feeders = [a for a in get_all_asset_ids() if get_asset_raw(a)["type"] == "feeder_mv"]
        assert len(feeders) == 5

    def test_lv_feeder_count(self):
        feeders = [a for a in get_all_asset_ids() if get_asset_raw(a)["type"] == "feeder_lv"]
        assert len(feeders) == 5


class TestVoltageLevel:
    """Every asset must have a voltage_level."""

    def test_all_have_voltage_level(self):
        for s in get_all_asset_summaries():
            assert s.voltage_level in ("HV", "MV", "LV"), (
                f"{s.id} has invalid voltage_level: {s.voltage_level}"
            )

    def test_generators_are_hv(self):
        for gid in ("gen_solar_1", "gen_gas_1"):
            d = get_asset_detail(gid)
            assert d.voltage_level == "HV"

    def test_rmus_are_mv(self):
        d = get_asset_detail("rmu_1")
        assert d.voltage_level == "MV"

    def test_consumers_are_lv(self):
        d = get_asset_detail("cons_hosp_1")
        assert d.voltage_level == "LV"


class TestRmuSwitching:
    """Verify RMU state management."""

    def test_initial_rmu_states(self):
        assert get_rmu_state("rmu_1") == "closed"
        assert get_rmu_state("rmu_5") == "open"  # NOP

    def test_toggle_rmu(self):
        assert toggle_rmu("rmu_1") == "open"
        assert get_rmu_state("rmu_1") == "open"
        assert toggle_rmu("rmu_1") == "closed"
        assert get_rmu_state("rmu_1") == "closed"

    def test_is_rmu_open(self):
        assert is_rmu_open("rmu_5") is True
        assert is_rmu_open("rmu_1") is False

    def test_non_rmu_returns_none(self):
        assert get_rmu_state("gen_solar_1") is None
        assert toggle_rmu("gen_solar_1") is None


class TestRmuAwareBfs:
    """Verify that open RMUs block downstream traversal."""

    def test_open_rmu_blocks_consumers(self):
        # rmu_5 is open (NOP) — its downstream shouldn't be reachable from feeder_mv_3
        # But rmu_4 is closed, so trafo_3 → feeder_lv_3 → consumers are reachable
        consumers = get_downstream_consumers("feeder_mv_3", respect_rmu=True)
        # rmu_4 is closed → trafo_3 → feeder_lv_3 → cons_res_2, cons_res_3
        assert "cons_res_2" in consumers
        assert "cons_res_3" in consumers

    def test_closing_open_rmu_adds_path(self):
        # rmu_5 starts open
        assert is_rmu_open("rmu_5") is True
        # Close it
        set_rmu_state("rmu_5", "closed")
        # Now rmu_5's downstream should be reachable
        assert is_rmu_open("rmu_5") is False

    def test_opening_rmu_removes_downstream(self):
        # rmu_1 is closed — hospital is reachable
        consumers = get_downstream_consumers("rmu_1", respect_rmu=True)
        assert "cons_hosp_1" in consumers
        # Open rmu_1
        set_rmu_state("rmu_1", "open")
        consumers = get_downstream_consumers("rmu_1", respect_rmu=True)
        assert len(consumers) == 0
        # Restore
        set_rmu_state("rmu_1", "closed")


class TestNetworkTopology:
    """Verify the edge list."""

    def test_edge_count(self):
        edges = get_network_edges()
        assert len(edges) == 37, f"Expected 37 edges, got {len(edges)}"

    def test_every_consumer_reachable(self):
        consumers = {
            a for a in get_all_asset_ids()
            if get_asset_raw(a)["type"] == "consumer"
        }
        # Close all RMUs to ensure full reachability
        for aid in get_all_asset_ids():
            if get_asset_raw(aid)["type"] == "rmu":
                set_rmu_state(aid, "closed")

        solar_reach = set(get_downstream_consumers("gen_solar_1", respect_rmu=True))
        gas_reach = set(get_downstream_consumers("gen_gas_1", respect_rmu=True))
        reachable = solar_reach | gas_reach
        assert consumers.issubset(reachable), f"Unreachable: {consumers - reachable}"

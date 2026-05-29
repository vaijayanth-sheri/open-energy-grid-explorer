"""Tests for the simulation engine — updated for MV/LV network."""

import pytest

from app.data_loader import load_network_data, get_all_asset_ids, get_asset_raw, set_rmu_state
from app import simulation


@pytest.fixture(autouse=True)
def _setup():
    """Load data and reset simulation state before each test."""
    load_network_data()
    simulation._metrics_store.clear()
    simulation._latest.clear()
    simulation._initialise_buffers()


class TestSolarFactor:
    def test_midnight_zero(self):
        assert simulation._solar_factor(0.0) == 0.0

    def test_noon_peak(self):
        assert simulation._solar_factor(12.0) > 0.8

    def test_22h_zero(self):
        assert simulation._solar_factor(22.0) == 0.0


class TestResidentialFactor:
    def test_trough_at_3am(self):
        assert simulation._residential_factor(3.0) < 0.45

    def test_peak_at_evening(self):
        assert simulation._residential_factor(19.0) > 0.7


class TestSimulationTick:
    def test_tick_populates_all_assets(self):
        simulation._tick()
        for aid in get_all_asset_ids():
            latest = simulation.get_latest(aid)
            assert latest is not None, f"No metrics for {aid}"
            assert "timestamp" in latest
            assert "values" in latest

    def test_generator_keys(self):
        simulation._tick()
        solar = simulation.get_latest("gen_solar_1")
        assert "active_power_mw" in solar["values"]
        assert "voltage_kv" in solar["values"]

    def test_rmu_has_state(self):
        simulation._tick()
        rmu = simulation.get_latest("rmu_1")
        assert rmu["values"]["state"] == "closed"

    def test_rmu_open_shows_zero_load(self):
        set_rmu_state("rmu_1", "open")
        simulation._tick()
        rmu = simulation.get_latest("rmu_1")
        assert rmu["values"]["load_mw"] == 0.0
        assert rmu["values"]["state"] == "open"
        set_rmu_state("rmu_1", "closed")  # restore

    def test_transformer_metrics(self):
        simulation._tick()
        trafo = simulation.get_latest("trafo_1")
        v = trafo["values"]
        assert "capacity_kva" in v
        assert "current_load_kw" in v
        assert "utilization_percent" in v
        assert v["utilization_percent"] >= 0.0

    def test_mv_feeder_metrics(self):
        simulation._tick()
        mv = simulation.get_latest("feeder_mv_1")
        v = mv["values"]
        assert "load_mw" in v
        assert "loading_percent" in v

    def test_lv_feeder_metrics(self):
        simulation._tick()
        lv = simulation.get_latest("feeder_lv_1")
        v = lv["values"]
        assert "load_mw" in v
        assert "loading_percent" in v

    def test_substation_dual_voltage(self):
        simulation._tick()
        sub = simulation.get_latest("sub_hv_mv_1")
        v = sub["values"]
        assert v["input_voltage_kv"] > 100.0
        assert v["output_voltage_kv"] < 15.0

    def test_consumer_demand(self):
        simulation._tick()
        hosp = simulation.get_latest("cons_hosp_1")
        assert hosp["values"]["active_power_mw"] > 0.0


class TestBottomUpAggregation:
    def test_lv_feeder_equals_sum_consumers(self):
        simulation._tick()
        # feeder_lv_1 serves cons_hosp_1
        lv_load = simulation.get_latest("feeder_lv_1")["values"]["load_mw"]
        hosp_demand = simulation.get_latest("cons_hosp_1")["values"]["active_power_mw"]
        assert abs(lv_load - hosp_demand) < 0.01

    def test_transformer_equals_sum_lv_feeders(self):
        simulation._tick()
        # trafo_1 → feeder_lv_1
        trafo_kw = simulation.get_latest("trafo_1")["values"]["current_load_kw"]
        lv_mw = simulation.get_latest("feeder_lv_1")["values"]["load_mw"]
        assert abs(trafo_kw - lv_mw * 1000.0) < 10.0

    def test_global_balancing(self):
        simulation._tick()
        solar_p = simulation.get_latest("gen_solar_1")["values"]["active_power_mw"]
        gas_p = simulation.get_latest("gen_gas_1")["values"]["active_power_mw"]
        total_demand = sum(
            simulation.get_latest(aid)["values"]["active_power_mw"]
            for aid in get_all_asset_ids()
            if get_asset_raw(aid) and get_asset_raw(aid)["type"] == "consumer"
        )
        expected_gas = max(0.0, total_demand - solar_p)
        assert abs(gas_p - expected_gas) < 1.0


class TestRollingBuffer:
    def test_history_grows(self):
        simulation._tick()
        simulation._tick()
        assert len(simulation.get_history("gen_solar_1")) == 2

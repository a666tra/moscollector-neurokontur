"""
tests/test_scenarios.py

Tests for scenario synthetic dataset generator.
Specification: docs/SCENARIOS_SPEC.md.
"""

import os
import hashlib
import time
from collections import Counter
import numpy as np
import pytest

from typing import Optional, Dict, List
from backend.app.core.config import settings
from backend.app.services.scenario_engine import (
    select_channels,
    generate_dataset,
    load_states_reference,
    TARGET_CHANNEL_SPECS,
    SCENARIO_COUNTS,
    Channel,
    DiscreteEvent,
    GroundTruthEvent,
    Dataset,
    Alert,
    detect,
    detect_naive,
    detect_static_dedup,
    evaluate,
    run_scenario,
    clear_scenario_cache,
)
from fastapi.testclient import TestClient
from backend.app.main import app

def _calc_sha256(filepath: str) -> Optional[str]:
    if not os.path.exists(filepath):
        return None
    with open(filepath, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def test_scenarios_determinism():
    """Same seed => identical datasets, different seed => different datasets."""
    ds1 = generate_dataset("day", seed=42)
    ds2 = generate_dataset("day", seed=42)

    # Ground truth events equality
    assert len(ds1.ground_truth) == len(ds2.ground_truth)
    for g1, g2 in zip(ds1.ground_truth, ds2.ground_truth):
        assert g1.event_id == g2.event_id
        assert g1.scenario_id == g2.scenario_id
        assert g1.cls == g2.cls
        assert g1.channel_id == g2.channel_id
        assert g1.object_id == g2.object_id
        assert g1.start_ts == g2.start_ts
        assert g1.end_ts == g2.end_ts
        assert g1.hazard_ts == g2.hazard_ts

    # Discrete events equality
    assert len(ds1.discrete_events) == len(ds2.discrete_events)
    for e1, e2 in zip(ds1.discrete_events, ds2.discrete_events):
        assert e1.ts == e2.ts
        assert e1.channel_id == e2.channel_id
        assert e1.state_name == e2.state_name
        assert e1.is_alarm == e2.is_alarm

    # Analog series equality
    for cid in ds1.analog_series:
        assert np.array_equal(
            ds1.analog_series[cid],
            ds2.analog_series[cid],
            equal_nan=True,
        )

    # Different seed -> different output
    ds3 = generate_dataset("day", seed=43)
    start_times_1 = [g.start_ts for g in ds1.ground_truth]
    start_times_3 = [g.start_ts for g in ds3.ground_truth]
    assert start_times_1 != start_times_3


def test_scenarios_channel_composition():
    """Channel set = 185 with exact per-type counts and stride spread."""
    channels = select_channels()
    assert len(channels) == 185
    assert len(set(channels.keys())) == 185

    type_counts = Counter(c.sensor_type for c in channels.values())
    for stype, expected_count in TARGET_CHANNEL_SPECS:
        assert type_counts[stype] == expected_count, (
            f"Expected {expected_count} of {stype}, got {type_counts[stype]}"
        )


def test_scenarios_event_counts_day_and_month():
    """Event counts per scenario match docs/SCENARIOS_SPEC.md for day and month."""
    for mode in ("day", "month"):
        ds = generate_dataset(mode, seed=42)
        counts = Counter(g.scenario_id for g in ds.ground_truth)
        expected = SCENARIO_COUNTS[mode]
        for sc_id, exp_cnt in expected.items():
            assert counts[sc_id] == exp_cnt, (
                f"Mode {mode}, scenario {sc_id}: expected {exp_cnt}, got {counts[sc_id]}"
            )
        assert len(ds.ground_truth) == sum(expected.values())


def test_scenarios_no_overlapping_events_and_separation():
    """No overlapping events on one channel, minimum 6 h (21600 s) separation."""
    for mode in ("day", "month"):
        ds = generate_dataset(mode, seed=42)
        by_channel = {}
        for g in ds.ground_truth:
            by_channel.setdefault(g.channel_id, []).append(g)

        for cid, events in by_channel.items():
            if len(events) <= 1:
                continue
            sorted_evs = sorted(events, key=lambda x: x.start_ts)
            for i in range(len(sorted_evs) - 1):
                cur_ev = sorted_evs[i]
                next_ev = sorted_evs[i + 1]
                separation = next_ev.start_ts - cur_ev.end_ts
                assert separation >= 6 * 3600.0, (
                    f"Mode {mode}, channel {cid}: events {cur_ev.event_id} and {next_ev.event_id} "
                    f"have separation {separation}s < 21600s"
                )


def test_scenarios_ground_truth_validity():
    """Ground truth has start < end, lies within horizon, hazard_ts valid."""
    for mode in ("day", "month"):
        ds = generate_dataset(mode, seed=42)
        for g in ds.ground_truth:
            assert 0.0 <= g.start_ts < g.end_ts <= ds.total_seconds, (
                f"Mode {mode}, event {g.event_id}: bounds [{g.start_ts}, {g.end_ts}] invalid for total {ds.total_seconds}"
            )
            assert g.channel_id in ds.channels
            assert g.object_id == ds.channels[g.channel_id].object_id

            if g.scenario_id in ("S1", "S3"):
                assert g.hazard_ts is not None, f"Scenario {g.scenario_id} must have hazard_ts"
                assert g.start_ts <= g.hazard_ts <= g.end_ts, (
                    f"hazard_ts {g.hazard_ts} not in [{g.start_ts}, {g.end_ts}]"
                )
            else:
                assert g.hazard_ts is None, f"Scenario {g.scenario_id} must have hazard_ts=None"


def test_scenarios_no_disk_modifications():
    """Generation does not modify tickets_db.json / confirmed_alarms.json / system_settings.json."""
    files_to_check = [
        os.path.join(settings.DATA_DIR, "tickets_db.json"),
        os.path.join(settings.DATA_DIR, "confirmed_alarms.json"),
        os.path.join(settings.DATA_DIR, "system_settings.json"),
    ]
    before_hashes = {f: _calc_sha256(f) for f in files_to_check}

    # Run both day and month generations
    generate_dataset("day", seed=42)
    generate_dataset("month", seed=42)

    after_hashes = {f: _calc_sha256(f) for f in files_to_check}
    for f in files_to_check:
        assert before_hashes[f] == after_hashes[f], f"File {f} was modified during dataset generation!"


def test_scenarios_generation_time_budget():
    """Must be fast: day < 3 s, month < 15 s."""
    t0 = time.time()
    ds_day = generate_dataset("day", seed=42)
    t_day = time.time() - t0
    assert t_day < 3.0, f"Day generation took {t_day:.2f}s >= 3.0s"

    t0 = time.time()
    ds_month = generate_dataset("month", seed=42)
    t_month = time.time() - t0
    assert t_month < 15.0, f"Month generation took {t_month:.2f}s >= 15.0s"


def test_scenarios_negative_control_exclusion():
    """An event channel is not used as a negative control the same day."""
    for mode in ("day", "month"):
        ds = generate_dataset(mode, seed=42)
        channel_event_days = {}
        for g in ds.ground_truth:
            d_start = int(g.start_ts // 86400)
            d_end = int(g.end_ts // 86400)
            for d in range(d_start, d_end + 1):
                channel_event_days.setdefault(g.channel_id, set()).add(d)

        for ev in ds.discrete_events:
            if ev.ts == 0.0:
                continue
            day = int(ev.ts // 86400)
            inside_gt = False
            for g in ds.ground_truth:
                if g.channel_id == ev.channel_id and (g.start_ts - 1.0 <= ev.ts <= g.end_ts + 1.0):
                    inside_gt = True
                    break
            if not inside_gt:
                assert day not in channel_event_days.get(ev.channel_id, set()), (
                    f"Channel {ev.channel_id} has negative control event at ts={ev.ts} on day {day}, "
                    f"which is also an active event day for this channel!"
                )


def _make_mini_dataset(
    channels: Dict[str, Channel],
    analog_series: Dict[str, np.ndarray],
    discrete_events: List[DiscreteEvent],
    dt: float = 60.0,
    total_seconds: float = 3600.0,
) -> Dataset:
    n_steps = int(total_seconds // dt)
    timestamps = np.arange(n_steps, dtype=np.float64) * dt
    return Dataset(
        mode="day",
        seed=42,
        analog_series=analog_series,
        discrete_events=sorted(discrete_events, key=lambda e: e.ts),
        ground_truth=[],
        channels=channels,
        analog_timestamps=timestamps,
        total_seconds=total_seconds,
        dt=dt,
    )


def test_scenarios_s4_related_channel():
    """Every S4 event has exactly one related channel of type 'Датчик температуры' on same object."""
    for mode in ("day", "month"):
        ds = generate_dataset(mode, seed=42)
        s4_events = [g for g in ds.ground_truth if g.scenario_id == "S4"]
        assert len(s4_events) > 0
        for g in s4_events:
            assert len(g.related_channel_ids) == 1, f"Event {g.event_id} must have exactly 1 related channel"
            rel_cid = g.related_channel_ids[0]
            assert rel_cid in ds.channels, f"Related channel {rel_cid} must be in dataset channels"
            rel_c = ds.channels[rel_cid]
            assert rel_c.sensor_type == "Датчик температуры", f"Related channel {rel_cid} must be 'Датчик температуры', got {rel_c.sensor_type}"
            assert rel_c.object_id == g.object_id, f"Related channel {rel_cid} must be on same object {g.object_id}"

        for g in ds.ground_truth:
            if g.scenario_id != "S4":
                assert len(g.related_channel_ids) == 0, f"Scenario {g.scenario_id} must have empty related_channel_ids"


def test_scenarios_seed42_sha256():
    """Verify that seed 42 datasets remain identical to before (sha256 comparison)."""
    ds_day = generate_dataset("day", seed=42)
    h_day = hashlib.sha256()
    for cid in sorted(ds_day.analog_series.keys()):
        h_day.update(cid.encode("utf-8") + ds_day.analog_series[cid].tobytes())
    for e in ds_day.discrete_events:
        h_day.update(f"{e.ts}:{e.channel_id}:{e.state_name}:{e.is_alarm}".encode("utf-8"))
    assert h_day.hexdigest() == "d2c0ba2ae99b4dabba98c9fdd4a4c2f49595ac401702ca6b61699b5ca134cc00"

    ds_month = generate_dataset("month", seed=42)
    h_month = hashlib.sha256()
    for cid in sorted(ds_month.analog_series.keys()):
        h_month.update(cid.encode("utf-8") + ds_month.analog_series[cid].tobytes())
    for e in ds_month.discrete_events:
        h_month.update(f"{e.ts}:{e.channel_id}:{e.state_name}:{e.is_alarm}".encode("utf-8"))
    assert h_month.hexdigest() == "ee01b6ba91e12f59e293c0a8aa4c95c2eae4196e4c260b7bff8b02203309fbbd"


def test_scenarios_s8_count_per_mode():
    """S8 scenario event count is 3 for day and 8 for month per spec v1.3."""
    ds_day = generate_dataset("day", seed=42)
    s8_day = [g for g in ds_day.ground_truth if g.scenario_id == "S8"]
    assert len(s8_day) == 3
    for g in s8_day:
        assert g.cls == "SETPOINT"
        assert g.hazard_ts is None
        assert g.channel_id in ds_day.channels
        assert ds_day.channels[g.channel_id].sensor_type == "Газовый датчик"

    ds_month = generate_dataset("month", seed=42)
    s8_month = [g for g in ds_month.ground_truth if g.scenario_id == "S8"]
    assert len(s8_month) == 8
    for g in s8_month:
        assert g.cls == "SETPOINT"
        assert g.hazard_ts is None
        assert g.channel_id in ds_month.channels
        assert ds_month.channels[g.channel_id].sensor_type == "Газовый датчик"


def test_scenarios_s1_s7_ground_truth_identical_sha256():
    """S1-S7 ground truth is 100% byte-identical to before S8 addition (sha256 comparison)."""
    EXPECTED_DAY_S1_S7_SHA256 = "eeb4d19b2313bd5286a4146ddd2eaf16810af5e2c4a9ed4018e83ca38e99afa6"
    EXPECTED_MONTH_S1_S7_SHA256 = "9a85ecaa233f1b37d75e41ae5b37433e35ea4b74aa4c6bd4b6d77c70a6f66632"

    ds_day = generate_dataset("day", seed=42)
    s1_s7_day = [g for g in ds_day.ground_truth if g.scenario_id in ("S1", "S2", "S3", "S4", "S5", "S6", "S7")]
    h_day = hashlib.sha256()
    for g in s1_s7_day:
        h_day.update(f"{g.event_id}:{g.scenario_id}:{g.cls}:{g.channel_id}:{g.object_id}:{g.start_ts}:{g.end_ts}:{g.hazard_ts}".encode("utf-8"))
    assert h_day.hexdigest() == EXPECTED_DAY_S1_S7_SHA256

    ds_month = generate_dataset("month", seed=42)
    s1_s7_month = [g for g in ds_month.ground_truth if g.scenario_id in ("S1", "S2", "S3", "S4", "S5", "S6", "S7")]
    h_month = hashlib.sha256()
    for g in s1_s7_month:
        h_month.update(f"{g.event_id}:{g.scenario_id}:{g.cls}:{g.channel_id}:{g.object_id}:{g.start_ts}:{g.end_ts}:{g.hazard_ts}".encode("utf-8"))
    assert h_month.hexdigest() == EXPECTED_MONTH_S1_S7_SHA256


def test_scenarios_analog_arrays_equal_outside_s8_windows():
    """Analog arrays outside S8 windows are strictly equal to pre-S8 generated arrays."""
    ds = generate_dataset("day", seed=42)
    s8_events = [g for g in ds.ground_truth if g.scenario_id == "S8"]
    s8_by_cid: Dict[str, List[Tuple[float, float]]] = {}
    for g in s8_events:
        s8_by_cid.setdefault(g.channel_id, []).append((g.start_ts, g.end_ts))

    # Mask S8 windows in the generated dataset and compute sha256
    h_masked = hashlib.sha256()
    for cid in sorted(ds.analog_series.keys()):
        arr = ds.analog_series[cid].copy()
        if cid in s8_by_cid:
            for st, et in s8_by_cid[cid]:
                m = (ds.analog_timestamps >= st) & (ds.analog_timestamps <= et)
                arr[m] = -999.0
        h_masked.update(cid.encode("utf-8") + arr.tobytes())

    # Pre-computed sha256 hash of all analog series outside S8 windows (masked with -999.0)
    EXPECTED_MASKED_HASH = "9ae27040c536c55ddc18cbb6f1ec064decac49da83fc7d0d7e9ec3c4f268dd5c"
    assert h_masked.hexdigest() == EXPECTED_MASKED_HASH


def test_scenarios_setpoint_chatter_crossings_3_no_4_yes():
    """3 crossings in 15 min -> no SETPOINT_CHATTER; 4 crossings in 15 min -> SETPOINT_CHATTER."""
    cid = "gas_test"
    ch = {cid: Channel(channel_id=cid, sensor_type="Газовый датчик", object_id="obj_1")}
    total_sec = 1800.0  # 30 min
    dt = 60.0
    n_steps = int(total_sec // dt)

    # Case 1: 3 crossings of 1.0% in 15 min
    # start at 0.5 (< 1.0)
    # t=60: 0.96 (< 1.0)
    # t=120: 1.04 (crossing 1: <1.0 to >=1.0)
    # t=180: 1.04
    # t=240: 0.96 (crossing 2: >=1.0 to <1.0)
    # t=300: 0.96
    # t=360: 1.04 (crossing 3: <1.0 to >=1.0)
    # t >= 360: stays at 1.04 (>=1.0) so NO 4th crossing!
    vals_3 = np.full(n_steps, 0.5)
    vals_3[1] = 0.96
    vals_3[2] = 1.04  # crossing 1
    vals_3[3] = 1.04
    vals_3[4] = 0.96  # crossing 2
    vals_3[5] = 0.96
    vals_3[6:] = 1.04  # crossing 3, then stays at 1.04
    ds_3 = _make_mini_dataset(ch, {cid: vals_3}, [], dt=dt, total_seconds=total_sec)
    alerts_3 = detect(ds_3)
    assert len([a for a in alerts_3 if a.cls == "SETPOINT_CHATTER"]) == 0

    # Case 2: 4 crossings of 1.0% in 15 min
    # Add crossing 4 at step 8: >=1.0 to <1.0
    vals_4 = vals_3.copy()
    vals_4[8:] = 0.96  # crossing 4
    ds_4 = _make_mini_dataset(ch, {cid: vals_4}, [], dt=dt, total_seconds=total_sec)
    alerts_4 = detect(ds_4)
    sc_alerts_4 = [a for a in alerts_4 if a.cls == "SETPOINT_CHATTER"]
    assert len(sc_alerts_4) == 1
    assert sc_alerts_4[0].ts == 8 * 60.0
    assert sc_alerts_4[0].severity == "WARNING"
    assert "4 пересечений" in sc_alerts_4[0].reason_ru


def test_scenarios_setpoint_chatter_one_incident_per_series():
    """One incident per setpoint chatter series in our reactive contour."""
    cid = "gas_test"
    ch = {cid: Channel(channel_id=cid, sensor_type="Газовый датчик", object_id="obj_1")}
    total_sec = 1800.0  # 30 min
    dt = 60.0
    n_steps = int(total_sec // dt)
    # Alternating 0.96 <-> 1.04 every 2 steps
    vals = np.full(n_steps, 0.96)
    for i in range(n_steps):
        if (i // 2) % 2 == 1:
            vals[i] = 1.04
    ds = _make_mini_dataset(ch, {cid: vals}, [], dt=dt, total_seconds=total_sec)
    alerts = detect(ds)
    chatter_incidents = [a for a in alerts if a.cls == "SETPOINT_CHATTER" and not a.is_reminder]
    assert len(chatter_incidents) == 1


def test_scenarios_naive_baseline_many_alerts_on_same_series():
    """Naive baseline produces many alerts (>10) on the same chattering series."""
    cid = "gas_test"
    ch = {cid: Channel(channel_id=cid, sensor_type="Газовый датчик", object_id="obj_1")}
    total_sec = 1800.0  # 30 min
    dt = 60.0
    n_steps = int(total_sec // dt)
    # Alternating 0.96 <-> 1.04 every 2 steps -> 15 samples with 1.04 >= 1.0%
    vals = np.full(n_steps, 0.96)
    for i in range(n_steps):
        if (i // 2) % 2 == 1:
            vals[i] = 1.04
    ds = _make_mini_dataset(ch, {cid: vals}, [], dt=dt, total_seconds=total_sec)
    naive_alerts = detect_naive(ds)
    gas_alerts = [a for a in naive_alerts if a.cls.startswith("GAS")]
    assert len(gas_alerts) > 10, f"Expected >10 alerts from naive baseline, got {len(gas_alerts)}"


def test_scenarios_gas_rate_strictly_before_warning():
    """Gas 0.05 -> 1.5 over 20 min gives GAS_RATE strictly before GAS_WARNING (60 s step dataset)."""
    cid = "gas_1"
    ch = {cid: Channel(channel_id=cid, sensor_type="Газовый датчик", object_id="obj_1")}
    total_sec = 1800.0
    dt = 60.0
    n_steps = int(total_sec // dt)
    vals = np.full(n_steps, 0.05)
    vals[:21] = np.linspace(0.05, 1.5, 21)
    ds = _make_mini_dataset(ch, {cid: vals}, [], dt=dt, total_seconds=total_sec)

    alerts = detect(ds)
    gas_rate_alerts = [a for a in alerts if a.cls == "GAS_RATE"]
    gas_warn_alerts = [a for a in alerts if a.cls == "GAS_WARNING"]

    assert len(gas_rate_alerts) > 0, "Expected GAS_RATE alert for 60s step"
    assert len(gas_warn_alerts) > 0, "Expected GAS_WARNING alert for 60s step"
    assert gas_rate_alerts[0].ts < gas_warn_alerts[0].ts, (
        f"GAS_RATE ts ({gas_rate_alerts[0].ts}) must be strictly earlier than GAS_WARNING ts ({gas_warn_alerts[0].ts})"
    )


def test_scenarios_gas_rate_strictly_before_warning_300s():
    """Slow gas ramp gives GAS_RATE strictly before GAS_WARNING (300 s step dataset, month mode)."""
    cid = "gas_1"
    ch = {cid: Channel(channel_id=cid, sensor_type="Газовый датчик", object_id="obj_1")}
    total_sec = 7200.0
    dt = 300.0
    n_steps = int(total_sec // dt)
    vals = np.full(n_steps, 0.05)
    # Slow ramp: t=0: 0.30, t=300: 0.60, t=600: 0.90 (<1.0), t=900: 1.20 (>=1.0)
    vals[:5] = np.linspace(0.30, 1.50, 5)
    ds = _make_mini_dataset(ch, {cid: vals}, [], dt=dt, total_seconds=total_sec)

    alerts = detect(ds)
    gas_rate_alerts = [a for a in alerts if a.cls == "GAS_RATE"]
    gas_warn_alerts = [a for a in alerts if a.cls == "GAS_WARNING"]

    assert len(gas_rate_alerts) > 0, "Expected GAS_RATE alert for 300s step"
    assert len(gas_warn_alerts) > 0, "Expected GAS_WARNING alert for 300s step"
    assert gas_rate_alerts[0].ts < gas_warn_alerts[0].ts, (
        f"GAS_RATE ts ({gas_rate_alerts[0].ts}) must be strictly earlier than GAS_WARNING ts ({gas_warn_alerts[0].ts})"
    )


def test_scenarios_spike_no_alert():
    """A 1-2 sample spike to 0.6% gives NO alert."""
    cid = "gas_1"
    ch = {cid: Channel(channel_id=cid, sensor_type="Газовый датчик", object_id="obj_1")}
    total_sec = 3600.0
    dt = 60.0
    n_steps = int(total_sec // dt)
    vals = np.full(n_steps, 0.05)
    vals[10:12] = 0.6  # 2 samples spike to 0.6%
    ds = _make_mini_dataset(ch, {cid: vals}, [], dt=dt, total_seconds=total_sec)

    alerts = detect(ds)
    assert len(alerts) == 0, f"Expected 0 alerts for 1-2 sample spike to 0.6%, got {len(alerts)}: {alerts}"


def test_scenarios_chatter_threshold_flips():
    """6 flips in 60 s gives CHATTER, 4 flips gives none."""
    cid = "kd_1"
    ch = {cid: Channel(channel_id=cid, sensor_type="КД Люк", object_id="obj_1")}

    # Case 1: 4 flips in 60 s -> no alert
    ev_4 = [
        DiscreteEvent(ts=float(t), channel_id=cid, object_id="obj_1", sensor_type="КД Люк", state_name="Не замкнут" if i % 2 == 1 else "Норма", is_alarm=(i % 2 == 1))
        for i, t in enumerate([10, 20, 30, 40])
    ]
    ds_4 = _make_mini_dataset(ch, {}, ev_4, total_seconds=300.0)
    alerts_4 = detect(ds_4)
    assert len([a for a in alerts_4 if a.cls == "CHATTER"]) == 0, "4 flips in 60s must give NO chatter alert"

    # Case 2: 6 flips in 60 s -> gives CHATTER
    ev_6 = [
        DiscreteEvent(ts=float(t), channel_id=cid, object_id="obj_1", sensor_type="КД Люк", state_name="Не замкнут" if i % 2 == 1 else "Норма", is_alarm=(i % 2 == 1))
        for i, t in enumerate([10, 20, 30, 40, 50, 60])
    ]
    ds_6 = _make_mini_dataset(ch, {}, ev_6, total_seconds=300.0)
    alerts_6 = detect(ds_6)
    chatter_alerts = [a for a in alerts_6 if a.cls == "CHATTER"]
    assert len(chatter_alerts) == 1, f"6 flips in 60s must give exactly 1 chatter alert, got {len(chatter_alerts)}"


def test_scenarios_chatter_hysteresis_clear_and_retrigger():
    """Chatter clears after 15 min (900 s) quiet period and re-triggers on a new burst."""
    cid = "kd_1"
    ch = {cid: Channel(channel_id=cid, sensor_type="КД Люк", object_id="obj_1")}

    # Burst 1: 6 flips at 10..60 s
    ev1 = [
        DiscreteEvent(ts=float(t), channel_id=cid, object_id="obj_1", sensor_type="КД Люк", state_name="Не замкнут" if i % 2 == 1 else "Норма", is_alarm=(i % 2 == 1))
        for i, t in enumerate([10, 20, 30, 40, 50, 60])
    ]
    # Quiet period of 400 s (< 15 min = 900 s) -> still open incident, no new alert
    ev2 = [
        DiscreteEvent(ts=float(t), channel_id=cid, object_id="obj_1", sensor_type="КД Люк", state_name="Не замкнут" if i % 2 == 1 else "Норма", is_alarm=(i % 2 == 1))
        for i, t in enumerate([460, 470, 480, 490, 500, 510])
    ]
    # Quiet period of 1000 s (> 900 s = 15 min) -> incident clears!
    # Burst 3: 6 flips at 1600..1650 s -> new incident alert!
    ev3 = [
        DiscreteEvent(ts=float(t), channel_id=cid, object_id="obj_1", sensor_type="КД Люк", state_name="Не замкнут" if i % 2 == 1 else "Норма", is_alarm=(i % 2 == 1))
        for i, t in enumerate([1600, 1610, 1620, 1630, 1640, 1650])
    ]
    ds = _make_mini_dataset(ch, {}, ev1 + ev2 + ev3, total_seconds=2000.0)
    alerts = detect(ds)
    chatter_alerts = [a for a in alerts if a.cls == "CHATTER"]
    assert len(chatter_alerts) == 2, f"Expected 2 CHATTER alerts after 15 min clear and retrigger, got {len(chatter_alerts)}"
    assert chatter_alerts[0].ts == 50.0
    assert chatter_alerts[1].ts == 1640.0


def test_scenarios_static_dedup_deduplicates_and_reminds():
    """detect_static_dedup deduplicates static threshold alerts and sends 30-min reminders."""
    cid_gas = "gas_1"
    cid_kd = "kd_1"
    ch = {
        cid_gas: Channel(channel_id=cid_gas, sensor_type="Газовый датчик", object_id="obj_1"),
        cid_kd: Channel(channel_id=cid_kd, sensor_type="КД Люк", object_id="obj_1"),
    }
    total_sec = 5400.0  # 90 min
    dt = 60.0
    n_steps = int(total_sec // dt)
    # Gas stays at 2.0% (above warning threshold 1.0%)
    vals = np.full(n_steps, 2.0)
    # Contact sensor flips to alarm at t=100s, another alarm event at t=2000s (>= 30 min later), normal at t=4000s
    evs = [
        DiscreteEvent(ts=100.0, channel_id=cid_kd, object_id="obj_1", sensor_type="КД Люк", state_name="Не замкнут", is_alarm=True),
        DiscreteEvent(ts=2000.0, channel_id=cid_kd, object_id="obj_1", sensor_type="КД Люк", state_name="Не замкнут", is_alarm=True),
        DiscreteEvent(ts=4000.0, channel_id=cid_kd, object_id="obj_1", sensor_type="КД Люк", state_name="Норма", is_alarm=False),
    ]
    ds = _make_mini_dataset(ch, {cid_gas: vals}, evs, dt=dt, total_seconds=total_sec)

    alerts = detect_static_dedup(ds)
    gas_alerts = [a for a in alerts if a.cls == "GAS_WARNING"]
    kd_alerts = [a for a in alerts if a.cls == "CHATTER"]

    # Gas: initial alert at 0s, reminder at 1800s, reminder at 3600s
    assert len(gas_alerts) == 3
    assert gas_alerts[0].is_reminder is False
    assert gas_alerts[1].is_reminder is True
    assert gas_alerts[2].is_reminder is True

    # Contact: single flip triggers CHATTER-less single alert without needing 5 flips
    assert len(kd_alerts) == 2  # initial at 100s, reminder at 1900s
    assert kd_alerts[0].ts == 100.0
    assert kd_alerts[0].is_reminder is False
    assert kd_alerts[1].ts == 2000.0
    assert kd_alerts[1].is_reminder is True


def test_scenarios_static_dedup_no_rate_no_correlation():
    """detect_static_dedup has no rate-of-rise rules and triggers FIRE without temp correlation."""
    cid_gas = "gas_1"
    cid_heat = "heat_1"
    ch = {
        cid_gas: Channel(channel_id=cid_gas, sensor_type="Газовый датчик", object_id="obj_1"),
        cid_heat: Channel(channel_id=cid_heat, sensor_type="Тепловой датчик", object_id="obj_1"),
    }
    total_sec = 1800.0
    dt = 60.0
    n_steps = int(total_sec // dt)
    # Gas slowly rises 0.05 -> 0.8% (below warning threshold 1.0%, but rate would trigger GAS_RATE in detect())
    vals = np.linspace(0.05, 0.8, n_steps)
    # Heat sensor triggers alarm without any temp sensor on obj_1
    evs = [
        DiscreteEvent(ts=300.0, channel_id=cid_heat, object_id="obj_1", sensor_type="Тепловой датчик", state_name="Сработка", is_alarm=True),
        DiscreteEvent(ts=600.0, channel_id=cid_heat, object_id="obj_1", sensor_type="Тепловой датчик", state_name="Норма", is_alarm=False),
    ]
    ds = _make_mini_dataset(ch, {cid_gas: vals}, evs, dt=dt, total_seconds=total_sec)

    alerts_static = detect_static_dedup(ds)
    # No GAS_RATE alert should be emitted
    assert len([a for a in alerts_static if a.cls == "GAS_RATE"]) == 0
    # Heat sensor directly triggers FIRE without requiring temp correlation
    fire_alerts = [a for a in alerts_static if a.cls == "FIRE"]
    assert len(fire_alerts) == 1
    assert fire_alerts[0].ts == 300.0


def test_scenarios_comm_loss_analog_gap():
    """Comm loss after >15 min gap."""
    cid = "temp_1"
    ch = {cid: Channel(channel_id=cid, sensor_type="Датчик температуры", object_id="obj_1")}
    total_sec = 3600.0
    dt = 60.0
    n_steps = int(total_sec // dt)
    vals = np.full(n_steps, 20.0)

    # 20 min NaN gap (indices 10..29, 20 samples = 1200 s > 900 s)
    vals[10:30] = np.nan
    ds = _make_mini_dataset(ch, {cid: vals}, [], dt=dt, total_seconds=total_sec)
    alerts = detect(ds)
    comm_alerts = [a for a in alerts if a.cls == "COMM_LOSS"]
    assert len(comm_alerts) >= 1, "Expected COMM_LOSS alert for >15 min gap"

    # Gap < 15 min (e.g. 10 min = 600 s) gives NO alert
    vals_short = np.full(n_steps, 20.0)
    vals_short[10:20] = np.nan
    ds_short = _make_mini_dataset(ch, {cid: vals_short}, [], dt=dt, total_seconds=total_sec)
    alerts_short = detect(ds_short)
    assert len([a for a in alerts_short if a.cls == "COMM_LOSS"]) == 0, "10 min gap must NOT trigger COMM_LOSS"


def test_scenarios_flood_alarm():
    """Flood alarm gives FLOOD."""
    cid = "flood_1"
    ch = {cid: Channel(channel_id=cid, sensor_type="Датчик затопления", object_id="obj_1")}
    evs = [
        DiscreteEvent(ts=120.0, channel_id=cid, object_id="obj_1", sensor_type="Датчик затопления", state_name="Затопление", is_alarm=True),
        DiscreteEvent(ts=1800.0, channel_id=cid, object_id="obj_1", sensor_type="Датчик затопления", state_name="Норма", is_alarm=False),
    ]
    ds = _make_mini_dataset(ch, {}, evs, total_seconds=3600.0)
    alerts = detect(ds)
    flood_alerts = [a for a in alerts if a.cls == "FLOOD"]
    assert len(flood_alerts) == 1
    assert flood_alerts[0].ts == 120.0
    assert flood_alerts[0].severity == "ALARM"


def test_scenarios_fire_correlation():
    """Immediate FIRE at alarm time; escalation only when temp >= 40 C on same object within 10 min; nothing on diff object."""
    h_cid = "heat_1"
    t_cid = "temp_1"
    total_sec = 1800.0
    dt = 60.0
    n_steps = int(total_sec // dt)
    temp_vals = np.full(n_steps, 20.0)
    temp_vals[3:10] = 42.0  # reaches 42 C at t=180 s

    # Case 1: Same object "obj_1"
    ch_same = {
        h_cid: Channel(channel_id=h_cid, sensor_type="Тепловой датчик", object_id="obj_1"),
        t_cid: Channel(channel_id=t_cid, sensor_type="Датчик температуры", object_id="obj_1"),
    }
    ev_heat = [
        DiscreteEvent(ts=100.0, channel_id=h_cid, object_id="obj_1", sensor_type="Тепловой датчик", state_name="Сработка", is_alarm=True),
        DiscreteEvent(ts=800.0, channel_id=h_cid, object_id="obj_1", sensor_type="Тепловой датчик", state_name="Норма", is_alarm=False),
    ]
    ds_same = _make_mini_dataset(ch_same, {t_cid: temp_vals}, ev_heat, dt=dt, total_seconds=total_sec)
    alerts_same = detect(ds_same)
    fire_same = [a for a in alerts_same if a.cls == "FIRE"]
    assert len(fire_same) == 2, f"Expected immediate FIRE + 1 escalation on same object, got {len(fire_same)}"
    # Immediate alert at alarm time
    assert fire_same[0].ts == 100.0
    assert fire_same[0].severity == "HIGH"
    assert fire_same[0].is_escalation is False
    # Escalation alert when temp >= 40 C
    assert fire_same[1].ts == 180.0
    assert fire_same[1].severity == "CRITICAL"
    assert fire_same[1].is_escalation is True

    # Case 2: Different objects
    ch_diff = {
        h_cid: Channel(channel_id=h_cid, sensor_type="Тепловой датчик", object_id="obj_1"),
        t_cid: Channel(channel_id=t_cid, sensor_type="Датчик температуры", object_id="obj_2"),
    }
    ds_diff = _make_mini_dataset(ch_diff, {t_cid: temp_vals}, ev_heat, dt=dt, total_seconds=total_sec)
    alerts_diff = detect(ds_diff)
    fire_diff = [a for a in alerts_diff if a.cls == "FIRE"]
    # Immediate alert on obj_1 is present
    assert len(fire_diff) == 1, f"Expected 1 immediate FIRE on obj_1, got {len(fire_diff)}"
    assert fire_diff[0].ts == 100.0
    assert fire_diff[0].object_id == "obj_1"
    assert fire_diff[0].is_escalation is False
    # But NO escalation on different object
    assert len([a for a in fire_diff if a.is_escalation]) == 0


def test_scenarios_dedup_and_reminder_30min():
    """No duplicate alerts for one continuing incident, reminder after 30 min."""
    cid = "gas_1"
    ch = {cid: Channel(channel_id=cid, sensor_type="Газовый датчик", object_id="obj_1")}
    total_sec = 5400.0  # 90 minutes
    dt = 60.0
    n_steps = int(total_sec // dt)
    vals = np.full(n_steps, 2.0)
    ds = _make_mini_dataset(ch, {cid: vals}, [], dt=dt, total_seconds=total_sec)
    alerts = detect(ds)
    warn_alerts = [a for a in alerts if a.cls == "GAS_WARNING"]
    assert len(warn_alerts) in (3, 4), f"Expected 3 or 4 alerts with 30-min reminders over 90 min, got {len(warn_alerts)}"
    assert warn_alerts[0].ts == 0.0
    assert warn_alerts[1].ts == 1800.0
    assert warn_alerts[2].ts == 3600.0


def test_scenarios_detector_determinism():
    """Detector output is deterministic."""
    ds = generate_dataset("day", seed=42)
    a1 = detect(ds)
    a2 = detect(ds)
    assert len(a1) == len(a2)
    for x, y in zip(a1, a2):
        assert x.ts == y.ts
        assert x.channel_id == y.channel_id
        assert x.object_id == y.object_id
        assert x.cls == y.cls
        assert x.severity == y.severity
        assert x.value == y.value
        assert x.reason_ru == y.reason_ru
        assert x.is_reminder == y.is_reminder


def test_scenarios_negative_control_zero_alerts():
    """detect() on a dataset with no injected events (negative controls only) returns 0 alerts."""
    rng = np.random.default_rng(42)
    channels = select_channels()
    total_seconds = 86400.0
    dt = 60.0
    n_steps = int(total_seconds // dt)
    timestamps = np.arange(n_steps, dtype=np.float64) * dt
    analog_series = {}
    gas_channels = [c for c in channels.values() if c.sensor_type == "Газовый датчик"]
    temp_channels = [c for c in channels.values() if c.sensor_type == "Датчик температуры"]
    contact_channels = [c for c in channels.values() if c.sensor_type in ("КД Люк", "КД Дверь", "КД АВ")]
    heat_channels = [c for c in channels.values() if c.sensor_type == "Тепловой датчик"]
    flood_channels = [c for c in channels.values() if c.sensor_type == "Датчик затопления"]
    states_map = load_states_reference()

    for c in gas_channels:
        analog_series[c.channel_id] = np.maximum(0.0, rng.normal(0.05, 0.02, size=n_steps))
    diurnal_base = 17.0 - 5.0 * np.cos(2.0 * np.pi * timestamps / 86400.0)
    for c in temp_channels:
        analog_series[c.channel_id] = diurnal_base + rng.normal(0.0, 0.3, size=n_steps)

    discrete_events = []
    for c in heat_channels + flood_channels + contact_channels:
        norm_st, _ = states_map.get(c.sensor_type, ("Норма", "Сработка"))
        discrete_events.append(DiscreteEvent(ts=0.0, channel_id=c.channel_id, object_id=c.object_id, sensor_type=c.sensor_type, state_name=norm_st, is_alarm=False))

    # Add negative controls noise: spikes to 0.6%, warm periods to 33 C, staff entrances
    neg_gas = rng.choice(gas_channels, size=12, replace=False)
    for _ in range(20):
        target_c = rng.choice(neg_gas)
        spike_idx = int(rng.uniform(0, n_steps - 2))
        spike_len = int(rng.integers(1, 3))
        spike_val = float(rng.uniform(0.2, 0.6))
        for offset in range(spike_len):
            analog_series[target_c.channel_id][spike_idx + offset] = spike_val

    neg_temp = rng.choice(temp_channels, size=12, replace=False)
    for target_c in rng.choice(neg_temp, size=3, replace=False):
        warm_dur = float(rng.uniform(6.0 * 3600.0, 8.0 * 3600.0))
        warm_st = rng.uniform(0, total_seconds - warm_dur)
        mask = (timestamps >= warm_st) & (timestamps <= warm_st + warm_dur)
        ts_sub = timestamps[mask]
        bump = 6.0 * np.sin(np.pi * (ts_sub - warm_st) / warm_dur)
        analog_series[target_c.channel_id][mask] += np.maximum(0.0, bump)
        analog_series[target_c.channel_id][mask] = np.minimum(analog_series[target_c.channel_id][mask], 33.0)

    neg_contact = rng.choice(contact_channels, size=15, replace=False)
    for target_c in rng.choice(neg_contact, size=4, replace=False):
        visit_st = rng.uniform(0, total_seconds - 120.0)
        norm_st, alr_st = states_map.get(target_c.sensor_type, ("Норма", "Сработка"))
        discrete_events.append(DiscreteEvent(ts=round(visit_st, 2), channel_id=target_c.channel_id, object_id=target_c.object_id, sensor_type=target_c.sensor_type, state_name=alr_st, is_alarm=True))
        discrete_events.append(DiscreteEvent(ts=round(visit_st + 30.0, 2), channel_id=target_c.channel_id, object_id=target_c.object_id, sensor_type=target_c.sensor_type, state_name=norm_st, is_alarm=False))

    clean_ds = Dataset(
        mode="day",
        seed=42,
        analog_series=analog_series,
        discrete_events=sorted(discrete_events, key=lambda e: e.ts),
        ground_truth=[],
        channels=channels,
        analog_timestamps=timestamps,
        total_seconds=total_seconds,
        dt=dt,
    )
    alerts = detect(clean_ds)
    assert len(alerts) == 0, f"detect() on negative controls only must return 0 alerts, got {len(alerts)}: {alerts}"


def test_scenarios_performance_month_detect():
    """Performance: detect() on month < 20 s."""
    ds_month = generate_dataset("month", seed=42)
    t0 = time.time()
    alerts = detect(ds_month)
    elapsed = time.time() - t0
    assert elapsed < 20.0, f"detect() on month took {elapsed:.2f} s >= 20.0 s"
    assert len(alerts) > 0


def test_scenarios_naive_baseline():
    """detect_naive produces static threshold alerts without dedup."""
    ds = generate_dataset("day", seed=42)
    naive_alerts = detect_naive(ds)
    fast_alerts = detect(ds)
    assert len(naive_alerts) > len(fast_alerts)


def test_scenarios_evaluate_tiny_handmade_dataset():
    """Evaluation on a tiny hand-made dataset with known answer."""
    cid_gas = "c_gas"
    cid_temp = "c_temp"
    channels = {
        cid_gas: Channel(channel_id=cid_gas, sensor_type="Газовый датчик", object_id="obj_1"),
        cid_temp: Channel(channel_id=cid_temp, sensor_type="Датчик температуры", object_id="obj_1"),
    }
    # Ground truth:
    # Event 1 (S1): start 100s, hazard 700s, end 2000s, cls GAS (will be detected with lead time)
    # Event 2 (S2): start 2500s, hazard None, end 3000s, cls GAS (will be missed)
    gt = [
        GroundTruthEvent(
            event_id="gt_0001",
            scenario_id="S1",
            cls="GAS",
            channel_id=cid_gas,
            object_id="obj_1",
            start_ts=100.0,
            end_ts=2000.0,
            hazard_ts=700.0,
        ),
        GroundTruthEvent(
            event_id="gt_0002",
            scenario_id="S2",
            cls="GAS",
            channel_id=cid_gas,
            object_id="obj_1",
            start_ts=2500.0,
            end_ts=3000.0,
            hazard_ts=None,
        ),
    ]

    # Hand-made alerts:
    # a1: ts=300s on c_gas, GAS_RATE -> matches S1! lead time = (700 - 300) / 60 = 6.67 min
    # a2: ts=800s on c_gas, GAS_WARNING (reminder) -> inside S1 window, attributable, not false alarm
    # a3: ts=5000s on c_temp, TEMP_WARNING -> outside all event windows! False alarm!
    alerts = [
        Alert(ts=300.0, channel_id=cid_gas, object_id="obj_1", cls="GAS_RATE", severity="WARNING", value=0.5, reason_ru="Рост", is_reminder=False),
        Alert(ts=800.0, channel_id=cid_gas, object_id="obj_1", cls="GAS_WARNING", severity="WARNING", value=1.2, reason_ru="Превышение", is_reminder=True),
        Alert(ts=5000.0, channel_id=cid_temp, object_id="obj_1", cls="TEMP_WARNING", severity="WARNING", value=42.0, reason_ru="Перегрев", is_reminder=False),
    ]

    total_sec = 7200.0
    dt = 60.0
    n_steps = int(total_sec // dt)
    timestamps = np.arange(n_steps, dtype=np.float64) * dt
    ds = Dataset(
        mode="day",
        seed=42,
        analog_series={cid_gas: np.zeros(n_steps), cid_temp: np.zeros(n_steps)},
        discrete_events=[],
        ground_truth=gt,
        channels=channels,
        analog_timestamps=timestamps,
        total_seconds=total_sec,
        dt=dt,
    )

    metrics = evaluate(ds, alerts)

    # Total ground truth: 2, detected: 1, missed: 1 => rate = 0.5
    assert metrics["overall"]["total_events"] == 2
    assert metrics["overall"]["detected_events"] == 1
    assert metrics["overall"]["detection_rate"] == 0.5

    # Scenario S1: detected with lead time = (700 - 300) / 60 = 6.67 min
    assert metrics["scenarios"]["S1"]["total"] == 1
    assert metrics["scenarios"]["S1"]["detected"] == 1
    assert metrics["scenarios"]["S1"]["detection_rate"] == 1.0
    assert metrics["scenarios"]["S1"]["lead_time_median_min"] == 6.67
    assert metrics["scenarios"]["S1"]["lead_time_p10_min"] == 6.67

    # Scenario S2: missed
    assert metrics["scenarios"]["S2"]["total"] == 1
    assert metrics["scenarios"]["S2"]["detected"] == 0
    assert metrics["scenarios"]["S2"]["detection_rate"] == 0.0

    # False alarms: a3 is outside all windows => count = 1
    assert metrics["false_alarms"]["count"] == 1

    # Incidents: a1 and a3 (non-reminders = 2), reminders: a2 (1), total: 3
    assert metrics["alerts_count"]["total"] == 3
    assert metrics["alerts_count"]["incidents"] == 2
    assert metrics["alerts_count"]["reminders"] == 1
    assert metrics["alerts_total"] == 3
    assert metrics["incidents"] == 2
    assert "stream_compression" not in metrics


def test_scenarios_api_catalog():
    """GET /api/scenarios/catalog contract test."""
    client = TestClient(app)
    resp = client.get("/api/scenarios/catalog")
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_origin"] == "SYNTHETIC"
    assert len(data["scenarios"]) == 8
    assert len(data["thresholds"]) >= 10
    assert data["channel_composition"]["total_channels"] == 185
    assert len(data["channel_composition"]["channels"]) == 185


def test_scenarios_api_run_success_and_validation():
    """POST /api/scenarios/run success and 422 validation tests."""
    client = TestClient(app)

    # Valid day run
    resp = client.post("/api/scenarios/run", json={"mode": "day", "seed": 42})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_origin"] == "SYNTHETIC"
    assert data["seed"] == 42
    assert data["mode"] == "day"
    assert "thresholds_used" in data
    assert data["thresholds_used"]["gas_warning_threshold_vol_pct"] == 1.0
    assert "comparison" in data
    assert "fast" in data["comparison"]
    assert "static_dedup" in data["comparison"]
    assert "naive" in data["comparison"]
    assert "alerts_total" in data["comparison"]["fast"]
    assert "incidents" in data["comparison"]["fast"]
    assert "naive_alerts_to_fast_incidents" in data
    assert "static_dedup_incidents_to_fast_incidents" in data
    assert "stream_compression" not in data["summary"]
    assert "incident_list" in data
    assert len(data["incident_list"]) <= 200
    assert "elapsed_seconds" in data

    # 422 on invalid mode
    resp_inv_mode = client.post("/api/scenarios/run", json={"mode": "year", "seed": 42})
    assert resp_inv_mode.status_code == 422

    # 422 on seed < 0
    resp_neg_seed = client.post("/api/scenarios/run", json={"mode": "day", "seed": -1})
    assert resp_neg_seed.status_code == 422

    # 422 on seed > 10000
    resp_big_seed = client.post("/api/scenarios/run", json={"mode": "day", "seed": 10001})
    assert resp_big_seed.status_code == 422


def test_scenarios_api_series_success_and_404_422():
    """POST /api/scenarios/series success, 404 on unknown channel, 422 on invalid input."""
    client = TestClient(app)

    # Get one valid channel from select_channels
    channels = select_channels()
    valid_cid = list(channels.keys())[0]

    # Success
    resp = client.post("/api/scenarios/series", json={"mode": "day", "seed": 42, "channel_id": valid_cid})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_origin"] == "SYNTHETIC"
    assert data["channel_id"] == valid_cid
    assert len(data["series"]) <= 600
    assert "thresholds" in data
    assert "true_events" in data
    assert "alerts" in data

    # 404 on non-existent channel
    resp_404 = client.post("/api/scenarios/series", json={"mode": "day", "seed": 42, "channel_id": "non_existent_channel_99999"})
    assert resp_404.status_code == 404

    # 422 on invalid mode
    resp_422 = client.post("/api/scenarios/series", json={"mode": "invalid", "seed": 42, "channel_id": valid_cid})
    assert resp_422.status_code == 422


def test_scenarios_run_determinism():
    """run_scenario produces identical results for the same seed."""
    clear_scenario_cache()
    r1 = run_scenario("day", seed=42)
    clear_scenario_cache()
    r2 = run_scenario("day", seed=42)

    assert r1["summary"] == r2["summary"]
    assert r1["comparison"] == r2["comparison"]
    assert len(r1["incident_list"]) == len(r2["incident_list"])
    for i1, i2 in zip(r1["incident_list"], r2["incident_list"]):
        assert i1 == i2


def test_scenarios_run_no_disk_modifications():
    """run_scenario does NOT modify tickets_db.json / confirmed_alarms.json / system_settings.json."""
    files_to_check = [
        os.path.join(settings.DATA_DIR, "tickets_db.json"),
        os.path.join(settings.DATA_DIR, "confirmed_alarms.json"),
        os.path.join(settings.DATA_DIR, "system_settings.json"),
    ]
    before_hashes = {f: _calc_sha256(f) for f in files_to_check}

    clear_scenario_cache()
    run_scenario("day", seed=42)

    after_hashes = {f: _calc_sha256(f) for f in files_to_check}
    for f in files_to_check:
        assert before_hashes[f] == after_hashes[f], f"File {f} was modified during run_scenario!"


def test_scenarios_month_run_time_budget():
    """Month run executes within 30 seconds per docs/SCENARIOS_SPEC.md Section 7."""
    clear_scenario_cache()
    t0 = time.time()
    res = run_scenario("month", seed=42)
    elapsed = time.time() - t0
    assert elapsed <= 30.0, f"run_scenario('month') took {elapsed:.2f} s > 30.0 s"
    assert res["data_origin"] == "SYNTHETIC"
    assert res["summary"]["overall"]["total_events"] == sum(SCENARIO_COUNTS["month"].values())


def test_scenarios_live_settings_mutation_does_not_affect_polygon():
    """Mutating live settings singleton does NOT change polygon results (pinned snapshot)."""
    from backend.app.api.settings import current_system_settings

    orig_gas = current_system_settings.gas_warning_threshold_vol_pct
    orig_window = current_system_settings.chatter_window_seconds
    orig_flips = current_system_settings.chatter_min_flips
    try:
        clear_scenario_cache()
        baseline = run_scenario("day", seed=42)
        assert baseline["thresholds_used"]["gas_warning_threshold_vol_pct"] == 1.0

        # Mutate live settings singleton
        current_system_settings.gas_warning_threshold_vol_pct = 3.5
        current_system_settings.chatter_window_seconds = 300
        current_system_settings.chatter_min_flips = 10

        clear_scenario_cache()
        mutated_run = run_scenario("day", seed=42)

        # Thresholds used must stay pinned
        assert mutated_run["thresholds_used"]["gas_warning_threshold_vol_pct"] == 1.0
        assert mutated_run["thresholds_used"]["chatter_window_seconds"] == 90
        assert mutated_run["thresholds_used"]["chatter_min_flips"] == 5

        # Results must be identical
        assert mutated_run["summary"]["overall"] == baseline["summary"]["overall"]
        assert mutated_run["comparison"]["fast"]["alerts_total"] == baseline["comparison"]["fast"]["alerts_total"]
        assert mutated_run["comparison"]["fast"]["incidents"] == baseline["comparison"]["fast"]["incidents"]
        assert mutated_run["naive_alerts_to_fast_incidents"] == baseline["naive_alerts_to_fast_incidents"]
        assert mutated_run["static_dedup_incidents_to_fast_incidents"] == baseline["static_dedup_incidents_to_fast_incidents"]
    finally:
        current_system_settings.gas_warning_threshold_vol_pct = orig_gas
        current_system_settings.chatter_window_seconds = orig_window
        current_system_settings.chatter_min_flips = orig_flips
        clear_scenario_cache()




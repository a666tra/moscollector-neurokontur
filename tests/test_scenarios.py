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

from backend.app.core.config import settings
from backend.app.services.scenario_engine import (
    select_channels,
    generate_dataset,
    TARGET_CHANNEL_SPECS,
    SCENARIO_COUNTS,
)


from typing import Optional

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


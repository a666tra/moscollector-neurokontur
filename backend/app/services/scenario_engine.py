"""
backend/app/services/scenario_engine.py

Scenario testing dataset generator for the fast reactive contour.
Specification: docs/SCENARIOS_SPEC.md (v1, 16.10.2026).

Contains ONLY the generator part per task requirements:
- Dataclasses: Channel, DiscreteEvent, AnalogSample, GroundTruthEvent, Dataset
- select_channels(): deterministic selection of 185 channels from data_service.sensors
- generate_dataset(mode, seed): fast seed-deterministic synthetic dataset generator
"""

from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional, Tuple, Any, Set
import os
import json
import numpy as np

from backend.app.core.config import settings
from backend.app.api.settings import get_current_settings
from backend.app.services.data_service import data_service

# Target channel composition per docs/SCENARIOS_SPEC.md Section 4:
# газовые 40 («Газовый датчик»), температурные 40 («Датчик температуры»),
# тепловые пожарные 30 («Тепловой датчик»), затопление 25 (все «Датчик затопления»),
# контакты 50 («КД Люк» 20, «КД Дверь» 20, «КД АВ» 10). Итого 185.
TARGET_CHANNEL_SPECS: List[Tuple[str, int]] = [
    ("Газовый датчик", 40),
    ("Датчик температуры", 40),
    ("Тепловой датчик", 30),
    ("Датчик затопления", 25),
    ("КД Люк", 20),
    ("КД Дверь", 20),
    ("КД АВ", 10),
]

# Exact event counts per scenario ID per docs/SCENARIOS_SPEC.md Section 4
SCENARIO_COUNTS: Dict[str, Dict[str, int]] = {
    "day": {
        "S1": 4,
        "S2": 3,
        "S3": 4,
        "S4": 3,
        "S5": 3,
        "S6": 10,
        "S7": 4,
    },
    "month": {
        "S1": 12,
        "S2": 8,
        "S3": 10,
        "S4": 6,
        "S5": 6,
        "S6": 60,
        "S7": 12,
    },
}

# Scenario classes per spec Section 4 table
SCENARIO_CLASSES: Dict[str, str] = {
    "S1": "GAS",
    "S2": "GAS",
    "S3": "TEMP",
    "S4": "FIRE",
    "S5": "FLOOD",
    "S6": "CHATTER",
    "S7": "COMM_LOSS",
}

# Literal fallbacks per docs/SCENARIOS_SPEC.md Section 3:
# "если для типа их нет — литералы: затопление «Затопление», тепловой «Сработка», норма «Норма»."
FALLBACK_STATES: Dict[str, Tuple[str, str]] = {
    "Датчик затопления": ("Норма", "Затопление"),
    "Тепловой датчик": ("Норма", "Сработка"),
    "Газовый датчик": ("Норма", "Тревога"),
    "Датчик температуры": ("Норма", "Перегрев"),
    "КД Люк": ("Норма", "Не замкнут"),
    "КД Дверь": ("Норма", "Отключено устройство"),
    "КД АВ": ("Норма", "Обнаружен дым"),
}


@dataclass
class Channel:
    channel_id: str
    sensor_type: str
    object_id: str
    sensor_name: str = ""
    system_type: str = ""
    tag: str = ""


@dataclass
class DiscreteEvent:
    ts: float  # timestamp in seconds from start of horizon
    channel_id: str
    object_id: str
    sensor_type: str
    state_name: str
    is_alarm: bool


@dataclass
class AnalogSample:
    ts: float
    channel_id: str
    value: float


@dataclass
class GroundTruthEvent:
    event_id: str
    scenario_id: str
    cls: str
    channel_id: str
    object_id: str
    start_ts: float
    end_ts: float
    hazard_ts: Optional[float] = None
    related_channel_ids: List[str] = field(default_factory=list)


@dataclass
class Dataset:
    mode: Literal["day", "month"]
    seed: int
    analog_series: Dict[str, np.ndarray]
    discrete_events: List[DiscreteEvent]
    ground_truth: List[GroundTruthEvent]
    channels: Dict[str, Channel] = field(default_factory=dict)
    analog_timestamps: np.ndarray = field(default_factory=lambda: np.array([]))
    total_seconds: float = 0.0
    dt: float = 0.0


def load_states_reference() -> Dict[str, Tuple[str, str]]:
    """
    Loads discrete sensor states from states_ref.json.
    Returns mapping sensor_type -> (normal_state_name, alarm_state_name).
    Uses literal fallbacks from SCENARIOS_SPEC.md when missing.
    """
    mapping: Dict[str, Tuple[str, str]] = {}
    states_path = os.path.join(settings.DATA_DIR, "states_ref.json")
    if os.path.exists(states_path):
        try:
            with open(states_path, "r", encoding="utf-8") as f:
                entries = json.load(f)
            by_type: Dict[str, List[Dict[str, Any]]] = {}
            for item in entries:
                stype = item.get("sensor_type", "")
                by_type.setdefault(stype, []).append(item)
            for stype, items in by_type.items():
                alarms = [x["state_name"] for x in items if x.get("is_alarm")]
                normals = [x["state_name"] for x in items if not x.get("is_alarm")]
                norm = "Норма" if "Норма" in normals else (normals[0] if normals else "Норма")
                alr = alarms[0] if alarms else None
                if alr:
                    mapping[stype] = (norm, alr)
        except Exception:
            pass

    # Apply fallbacks for missing sensor types or missing alarm states
    for stype, (fb_norm, fb_alr) in FALLBACK_STATES.items():
        if stype not in mapping:
            mapping[stype] = (fb_norm, fb_alr)
        else:
            cur_norm, cur_alr = mapping[stype]
            if not cur_alr:
                mapping[stype] = (cur_norm, fb_alr)
    return mapping


def select_channels() -> Dict[str, Channel]:
    """
    Deterministic selection of 185 channels from data_service.sensors per spec section 4:
    - 40 Газовый датчик
    - 40 Датчик температуры
    - 30 Тепловой датчик
    - 25 Датчик затопления (all available)
    - 20 КД Люк
    - 20 КД Дверь
    - 10 КД АВ
    Total = 185 channels.
    Evenly spread by sorted channel id with a stride, not the first N.
    """
    selected: Dict[str, Channel] = {}
    for sensor_type, count in TARGET_CHANNEL_SPECS:
        matching = [
            s for s in data_service.sensors.values()
            if s.get("sensor_type") == sensor_type
        ]
        matching.sort(
            key=lambda x: int(x["channel_id"]) if str(x["channel_id"]).isdigit() else str(x["channel_id"])
        )
        total = len(matching)
        if total < count:
            raise ValueError(f"Not enough sensors of type '{sensor_type}': found {total}, required {count}")
        stride = total // count
        for i in range(count):
            s = matching[i * stride]
            cid = str(s["channel_id"])
            selected[cid] = Channel(
                channel_id=cid,
                sensor_type=s.get("sensor_type", sensor_type),
                object_id=str(s.get("object_id", "")),
                sensor_name=s.get("sensor_name", ""),
                system_type=s.get("system_type", ""),
                tag=s.get("tag", ""),
            )
    return selected


def generate_dataset(mode: Literal["day", "month"], seed: int = 42) -> Dataset:
    """
    Generates a deterministic synthetic dataset for scenario testing.
    Uses numpy vectorization for high performance (<3 s for day, <15 s for month).

    - Channels: exactly 185 channels per spec section 4.
    - Background: normal baseline (gas ~0.05%, temp 12-22 C diurnal cycle, discrete normal).
    - Injected scenarios S1-S7 with exact counts per spec section 4.
    - Ground truth events with start < end within horizon and minimum 6 h separation per channel.
    - Nuisance noise (negative controls on 30% of channels) strictly excluding channels with events on the same day.
    """
    if mode not in ("day", "month"):
        raise ValueError(f"Invalid mode: {mode}. Must be 'day' or 'month'.")

    rng = np.random.default_rng(seed)
    channels = select_channels()
    states_map = load_states_reference()

    total_seconds = 86400.0 if mode == "day" else 30 * 86400.0
    dt = 60.0 if mode == "day" else 300.0
    n_steps = int(total_seconds // dt)
    n_days = int(total_seconds // 86400)
    timestamps = np.arange(n_steps, dtype=np.float64) * dt

    # Group channels by category
    gas_channels = [c for c in channels.values() if c.sensor_type == "Газовый датчик"]
    temp_channels = [c for c in channels.values() if c.sensor_type == "Датчик температуры"]
    heat_channels = [c for c in channels.values() if c.sensor_type == "Тепловой датчик"]
    flood_channels = [c for c in channels.values() if c.sensor_type == "Датчик затопления"]
    contact_channels = [c for c in channels.values() if c.sensor_type in ("КД Люк", "КД Дверь", "КД АВ")]

    # 1. Background normal behavior (vectorized)
    # Gas: N(0.05, 0.02) %, clipped below at 0.0
    analog_series: Dict[str, np.ndarray] = {}
    for c in gas_channels:
        series = rng.normal(0.05, 0.02, size=n_steps)
        analog_series[c.channel_id] = np.maximum(0.0, series)

    # Temp: Diurnal cycle 12-22 C (mean 17, amplitude 5) + N(0, 0.3)
    diurnal_base = 17.0 - 5.0 * np.cos(2.0 * np.pi * timestamps / 86400.0)
    for c in temp_channels:
        analog_series[c.channel_id] = diurnal_base + rng.normal(0.0, 0.3, size=n_steps)

    # Discrete events list
    discrete_events: List[DiscreteEvent] = []
    # Initial state at t=0 for all discrete channels
    for c in heat_channels + flood_channels + contact_channels:
        norm_st, _ = states_map.get(c.sensor_type, ("Норма", "Сработка"))
        discrete_events.append(
            DiscreteEvent(
                ts=0.0,
                channel_id=c.channel_id,
                object_id=c.object_id,
                sensor_type=c.sensor_type,
                state_name=norm_st,
                is_alarm=False,
            )
        )

    # Tracking for minimum 6 hours separation per channel
    # channel_id -> list of (start_ts, end_ts)
    channel_busy: Dict[str, List[Tuple[float, float]]] = {}
    channel_event_days: Dict[str, Set[int]] = {}

    def is_available(cid: str, start: float, end: float, separation: float = 6 * 3600.0) -> bool:
        for b_s, b_e in channel_busy.get(cid, []):
            if not (start >= b_e + separation or end + separation <= b_s):
                return False
        return True

    def mark_busy(cid: str, start: float, end: float):
        channel_busy.setdefault(cid, []).append((start, end))
        d_start = int(start // 86400)
        d_end = int(end // 86400)
        for d in range(d_start, min(n_days, d_end + 1)):
            channel_event_days.setdefault(cid, set()).add(d)

    ground_truth: List[GroundTruthEvent] = []
    gt_event_idx = 1

    # 2. Inject Scenarios S1 - S7 with exact counts
    counts = SCENARIO_COUNTS[mode]

    # --- Scenario S1: медленная утечка газа ---
    # линейный рост 0,05 -> 3 % за 40 мин, 20 мин плато, затем проветривание
    # Warning threshold = 1.0 % об.
    s1_count = counts["S1"]
    t_rise_s1 = 40.0 * 60.0    # 2400 s
    t_plat_s1 = 20.0 * 60.0    # 1200 s
    t_vent_s1 = 15.0 * 60.0    # 900 s
    dur_s1 = t_rise_s1 + t_plat_s1 + t_vent_s1  # 4500 s
    hazard_offset_s1 = 2400.0 * (1.0 - 0.05) / (3.0 - 0.05)  # 772.88 s

    for _ in range(s1_count):
        placed = False
        max_start = total_seconds - dur_s1 - 60.0
        for _ in range(1000):
            st = rng.uniform(0.0, max_start)
            et = st + dur_s1
            perm_cids = rng.permutation([c.channel_id for c in gas_channels])
            for cid in perm_cids:
                if is_available(cid, st, et):
                    mark_busy(cid, st, et)
                    haz_ts = round(st + hazard_offset_s1, 2)
                    c_obj = channels[cid]
                    ground_truth.append(
                        GroundTruthEvent(
                            event_id=f"gt_{gt_event_idx:04d}",
                            scenario_id="S1",
                            cls="GAS",
                            channel_id=cid,
                            object_id=c_obj.object_id,
                            start_ts=round(st, 2),
                            end_ts=round(et, 2),
                            hazard_ts=haz_ts,
                        )
                    )
                    gt_event_idx += 1

                    # Apply analog profile
                    idx_mask = (timestamps >= st) & (timestamps <= et)
                    ts_sub = timestamps[idx_mask]
                    vals = np.zeros_like(ts_sub)
                    m_rise = ts_sub <= (st + t_rise_s1)
                    m_plat = (ts_sub > (st + t_rise_s1)) & (ts_sub <= (st + t_rise_s1 + t_plat_s1))
                    m_vent = ts_sub > (st + t_rise_s1 + t_plat_s1)

                    vals[m_rise] = 0.05 + 2.95 * ((ts_sub[m_rise] - st) / t_rise_s1)
                    vals[m_plat] = 3.0
                    vals[m_vent] = 3.0 - 2.95 * ((ts_sub[m_vent] - (st + t_rise_s1 + t_plat_s1)) / t_vent_s1)

                    analog_series[cid][idx_mask] = np.maximum(
                        analog_series[cid][idx_mask],
                        vals + rng.normal(0.0, 0.02, size=len(vals))
                    )
                    placed = True
                    break
            if placed:
                break
        if not placed:
            raise RuntimeError(f"Could not place S1 event {gt_event_idx}")

    # --- Scenario S2: быстрая утечка газа ---
    # скачок до 5,5 % за 3 мин
    s2_count = counts["S2"]
    t_rise_s2 = 3.0 * 60.0     # 180 s
    t_plat_s2 = 20.0 * 60.0    # 1200 s
    t_vent_s2 = 15.0 * 60.0    # 900 s
    dur_s2 = t_rise_s2 + t_plat_s2 + t_vent_s2  # 2280 s

    for _ in range(s2_count):
        placed = False
        max_start = total_seconds - dur_s2 - 60.0
        for _ in range(1000):
            st = rng.uniform(0.0, max_start)
            et = st + dur_s2
            perm_cids = rng.permutation([c.channel_id for c in gas_channels])
            for cid in perm_cids:
                if is_available(cid, st, et):
                    mark_busy(cid, st, et)
                    c_obj = channels[cid]
                    ground_truth.append(
                        GroundTruthEvent(
                            event_id=f"gt_{gt_event_idx:04d}",
                            scenario_id="S2",
                            cls="GAS",
                            channel_id=cid,
                            object_id=c_obj.object_id,
                            start_ts=round(st, 2),
                            end_ts=round(et, 2),
                            hazard_ts=None,
                        )
                    )
                    gt_event_idx += 1

                    # Apply analog profile
                    idx_mask = (timestamps >= st) & (timestamps <= et)
                    ts_sub = timestamps[idx_mask]
                    vals = np.zeros_like(ts_sub)
                    m_rise = ts_sub <= (st + t_rise_s2)
                    m_plat = (ts_sub > (st + t_rise_s2)) & (ts_sub <= (st + t_rise_s2 + t_plat_s2))
                    m_vent = ts_sub > (st + t_rise_s2 + t_plat_s2)

                    vals[m_rise] = 0.05 + 5.45 * ((ts_sub[m_rise] - st) / t_rise_s2)
                    vals[m_plat] = 5.5
                    vals[m_vent] = 5.5 - 5.45 * ((ts_sub[m_vent] - (st + t_rise_s2 + t_plat_s2)) / t_vent_s2)

                    analog_series[cid][idx_mask] = np.maximum(
                        analog_series[cid][idx_mask],
                        vals + rng.normal(0.0, 0.02, size=len(vals))
                    )
                    placed = True
                    break
            if placed:
                break
        if not placed:
            raise RuntimeError(f"Could not place S2 event {gt_event_idx}")

    # --- Scenario S3: перегрев трубопровода ---
    # +0,3 °C/мин до 55 °C. Warning threshold = 40 °C.
    s3_count = counts["S3"]
    rate_s3_per_s = 0.3 / 60.0  # 0.005 C/s
    t_plat_s3 = 30.0 * 60.0     # 1800 s
    t_cool_s3 = 60.0 * 60.0     # 3600 s

    for _ in range(s3_count):
        placed = False
        t_rise_est = (55.0 - 17.0) / rate_s3_per_s  # 7600 s
        dur_est = t_rise_est + t_plat_s3 + t_cool_s3  # 13000 s
        max_start = total_seconds - dur_est - 60.0
        for _ in range(1000):
            st = rng.uniform(0.0, max_start)
            # Find base temp at start
            t_base_at_st = 17.0 - 5.0 * np.cos(2.0 * np.pi * st / 86400.0)
            t_rise_actual = (55.0 - t_base_at_st) / rate_s3_per_s
            dur_actual = t_rise_actual + t_plat_s3 + t_cool_s3
            et = st + dur_actual
            if et > total_seconds:
                continue

            hazard_offset_s3 = (40.0 - t_base_at_st) / rate_s3_per_s
            haz_ts = round(st + hazard_offset_s3, 2)

            perm_cids = rng.permutation([c.channel_id for c in temp_channels])
            for cid in perm_cids:
                if is_available(cid, st, et):
                    mark_busy(cid, st, et)
                    c_obj = channels[cid]
                    ground_truth.append(
                        GroundTruthEvent(
                            event_id=f"gt_{gt_event_idx:04d}",
                            scenario_id="S3",
                            cls="TEMP",
                            channel_id=cid,
                            object_id=c_obj.object_id,
                            start_ts=round(st, 2),
                            end_ts=round(et, 2),
                            hazard_ts=haz_ts,
                        )
                    )
                    gt_event_idx += 1

                    # Apply analog profile
                    idx_mask = (timestamps >= st) & (timestamps <= et)
                    ts_sub = timestamps[idx_mask]
                    vals = np.zeros_like(ts_sub)
                    m_rise = ts_sub <= (st + t_rise_actual)
                    m_plat = (ts_sub > (st + t_rise_actual)) & (ts_sub <= (st + t_rise_actual + t_plat_s3))
                    m_cool = ts_sub > (st + t_rise_actual + t_plat_s3)

                    vals[m_rise] = t_base_at_st + rate_s3_per_s * (ts_sub[m_rise] - st)
                    vals[m_plat] = 55.0
                    base_cool = 17.0 - 5.0 * np.cos(2.0 * np.pi * ts_sub[m_cool] / 86400.0)
                    frac_cool = (ts_sub[m_cool] - (st + t_rise_actual + t_plat_s3)) / t_cool_s3
                    vals[m_cool] = 55.0 - (55.0 - base_cool) * frac_cool

                    analog_series[cid][idx_mask] = np.maximum(
                        analog_series[cid][idx_mask],
                        vals + rng.normal(0.0, 0.3, size=len(vals))
                    )
                    placed = True
                    break
            if placed:
                break
        if not placed:
            raise RuntimeError(f"Could not place S3 event {gt_event_idx}")

    # --- Scenario S4: пожар ---
    # тепловой датчик «Сработка» + температура на том же объекте +3 °C/мин до 80
    # Common objects with both heat and temp sensors in selected set: '20' and '3356'
    s4_count = counts["S4"]
    rate_s4_per_s = 3.0 / 60.0  # 0.05 C/s
    t_plat_s4 = 15.0 * 60.0     # 900 s
    t_cool_s4 = 30.0 * 60.0     # 1800 s
    dur_s4_est = (80.0 - 17.0) / rate_s4_per_s + t_plat_s4 + t_cool_s4  # ~3960 s

    common_obj_ids = sorted(list({
        c.object_id for c in heat_channels
    } & {
        c.object_id for c in temp_channels
    }))

    for _ in range(s4_count):
        placed = False
        max_start = total_seconds - dur_s4_est - 60.0
        for _ in range(1000):
            st = rng.uniform(0.0, max_start)
            t_base_at_st = 17.0 - 5.0 * np.cos(2.0 * np.pi * st / 86400.0)
            t_rise_actual = (80.0 - t_base_at_st) / rate_s4_per_s
            dur_actual = t_rise_actual + t_plat_s4 + t_cool_s4
            et = st + dur_actual
            if et > total_seconds:
                continue

            perm_objs = rng.permutation(common_obj_ids)
            for oid in perm_objs:
                avail_heats = [c.channel_id for c in heat_channels if c.object_id == oid and is_available(c.channel_id, st, et)]
                avail_temps = [c.channel_id for c in temp_channels if c.object_id == oid and is_available(c.channel_id, st, et)]
                if avail_heats and avail_temps:
                    h_cid = avail_heats[0]
                    t_cid = avail_temps[0]
                    mark_busy(h_cid, st, et)
                    mark_busy(t_cid, st, et)

                    ground_truth.append(
                        GroundTruthEvent(
                            event_id=f"gt_{gt_event_idx:04d}",
                            scenario_id="S4",
                            cls="FIRE",
                            channel_id=h_cid,
                            object_id=oid,
                            start_ts=round(st, 2),
                            end_ts=round(et, 2),
                            hazard_ts=None,
                            related_channel_ids=[t_cid],
                        )
                    )
                    gt_event_idx += 1

                    # Discrete event on heat sensor: alarm at start, normal at end
                    _, alr_st = states_map.get("Тепловой датчик", ("Норма", "Сработка"))
                    discrete_events.append(
                        DiscreteEvent(
                            ts=round(st, 2),
                            channel_id=h_cid,
                            object_id=oid,
                            sensor_type="Тепловой датчик",
                            state_name=alr_st,
                            is_alarm=True,
                        )
                    )
                    discrete_events.append(
                        DiscreteEvent(
                            ts=round(et, 2),
                            channel_id=h_cid,
                            object_id=oid,
                            sensor_type="Тепловой датчик",
                            state_name="Норма",
                            is_alarm=False,
                        )
                    )

                    # Temperature rise on temp sensor
                    idx_mask = (timestamps >= st) & (timestamps <= et)
                    ts_sub = timestamps[idx_mask]
                    vals = np.zeros_like(ts_sub)
                    m_rise = ts_sub <= (st + t_rise_actual)
                    m_plat = (ts_sub > (st + t_rise_actual)) & (ts_sub <= (st + t_rise_actual + t_plat_s4))
                    m_cool = ts_sub > (st + t_rise_actual + t_plat_s4)

                    vals[m_rise] = t_base_at_st + rate_s4_per_s * (ts_sub[m_rise] - st)
                    vals[m_plat] = 80.0
                    base_cool = 17.0 - 5.0 * np.cos(2.0 * np.pi * ts_sub[m_cool] / 86400.0)
                    frac_cool = (ts_sub[m_cool] - (st + t_rise_actual + t_plat_s4)) / t_cool_s4
                    vals[m_cool] = 80.0 - (80.0 - base_cool) * frac_cool

                    analog_series[t_cid][idx_mask] = np.maximum(
                        analog_series[t_cid][idx_mask],
                        vals + rng.normal(0.0, 0.3, size=len(vals))
                    )
                    placed = True
                    break
            if placed:
                break
        if not placed:
            raise RuntimeError(f"Could not place S4 event {gt_event_idx}")

    # --- Scenario S5: затопление ---
    # датчик затопления в тревоге 30 мин
    s5_count = counts["S5"]
    dur_s5 = 30.0 * 60.0  # 1800 s

    for _ in range(s5_count):
        placed = False
        max_start = total_seconds - dur_s5 - 60.0
        for _ in range(1000):
            st = rng.uniform(0.0, max_start)
            et = st + dur_s5
            perm_cids = rng.permutation([c.channel_id for c in flood_channels])
            for cid in perm_cids:
                if is_available(cid, st, et):
                    mark_busy(cid, st, et)
                    c_obj = channels[cid]
                    ground_truth.append(
                        GroundTruthEvent(
                            event_id=f"gt_{gt_event_idx:04d}",
                            scenario_id="S5",
                            cls="FLOOD",
                            channel_id=cid,
                            object_id=c_obj.object_id,
                            start_ts=round(st, 2),
                            end_ts=round(et, 2),
                            hazard_ts=None,
                        )
                    )
                    gt_event_idx += 1

                    # Discrete events on flood sensor: alarm at start, normal at end
                    _, alr_st = states_map.get("Датчик затопления", ("Норма", "Затопление"))
                    discrete_events.append(
                        DiscreteEvent(
                            ts=round(st, 2),
                            channel_id=cid,
                            object_id=c_obj.object_id,
                            sensor_type=c_obj.sensor_type,
                            state_name=alr_st,
                            is_alarm=True,
                        )
                    )
                    discrete_events.append(
                        DiscreteEvent(
                            ts=round(et, 2),
                            channel_id=cid,
                            object_id=c_obj.object_id,
                            sensor_type=c_obj.sensor_type,
                            state_name="Норма",
                            is_alarm=False,
                        )
                    )
                    placed = True
                    break
            if placed:
                break
        if not placed:
            raise RuntimeError(f"Could not place S5 event {gt_event_idx}")

    # --- Scenario S6: дребезг контакта ---
    # пачка 6–14 переключений за <= 60 с, 8–10 пачек подряд с паузой 5–10 мин
    s6_count = counts["S6"]
    for _ in range(s6_count):
        placed = False
        # Estimate duration: 10 bursts * (60s + 600s) ~ 6600 s
        dur_s6_est = 7200.0
        max_start = total_seconds - dur_s6_est - 60.0
        for _ in range(1000):
            st = rng.uniform(0.0, max_start)
            perm_cids = rng.permutation([c.channel_id for c in contact_channels])
            for cid in perm_cids:
                # Pre-generate bursts to get exact end_ts
                n_bursts = int(rng.integers(8, 11))
                cur_t = st
                burst_data: List[Tuple[float, float, int]] = []
                for b_idx in range(n_bursts):
                    n_flips = int(rng.integers(6, 15))
                    burst_len = float(rng.uniform(25.0, 55.0))
                    burst_data.append((cur_t, burst_len, n_flips))
                    pause = float(rng.uniform(300.0, 600.0))
                    cur_t += burst_len + pause
                et = cur_t - pause + burst_len  # exact end of last burst

                if et <= total_seconds and is_available(cid, st, et):
                    mark_busy(cid, st, et)
                    c_obj = channels[cid]
                    ground_truth.append(
                        GroundTruthEvent(
                            event_id=f"gt_{gt_event_idx:04d}",
                            scenario_id="S6",
                            cls="CHATTER",
                            channel_id=cid,
                            object_id=c_obj.object_id,
                            start_ts=round(st, 2),
                            end_ts=round(et, 2),
                            hazard_ts=None,
                        )
                    )
                    gt_event_idx += 1

                    norm_st, alr_st = states_map.get(c_obj.sensor_type, ("Норма", "Сработка"))
                    for b_start, b_len, n_flips in burst_data:
                        flip_offsets = np.sort(rng.uniform(0.5, b_len - 0.5, size=n_flips))
                        state_is_alarm = False
                        for off in flip_offsets:
                            state_is_alarm = not state_is_alarm
                            cur_st = alr_st if state_is_alarm else norm_st
                            discrete_events.append(
                                DiscreteEvent(
                                    ts=round(b_start + off, 2),
                                    channel_id=cid,
                                    object_id=c_obj.object_id,
                                    sensor_type=c_obj.sensor_type,
                                    state_name=cur_st,
                                    is_alarm=state_is_alarm,
                                )
                            )
                        if state_is_alarm:
                            discrete_events.append(
                                DiscreteEvent(
                                    ts=round(b_start + b_len, 2),
                                    channel_id=cid,
                                    object_id=c_obj.object_id,
                                    sensor_type=c_obj.sensor_type,
                                    state_name=norm_st,
                                    is_alarm=False,
                                )
                            )
                    placed = True
                    break
            if placed:
                break
        if not placed:
            raise RuntimeError(f"Could not place S6 event {gt_event_idx}")

    # --- Scenario S7: потеря связи ---
    # замеры отсутствуют 60–180 мин
    s7_count = counts["S7"]
    analog_channels = gas_channels + temp_channels

    for _ in range(s7_count):
        placed = False
        for _ in range(1000):
            dur_s7 = float(rng.uniform(60.0 * 60.0, 180.0 * 60.0))
            max_start = total_seconds - dur_s7 - 60.0
            st = rng.uniform(0.0, max_start)
            et = st + dur_s7

            perm_cids = rng.permutation([c.channel_id for c in analog_channels])
            for cid in perm_cids:
                if is_available(cid, st, et):
                    mark_busy(cid, st, et)
                    c_obj = channels[cid]
                    ground_truth.append(
                        GroundTruthEvent(
                            event_id=f"gt_{gt_event_idx:04d}",
                            scenario_id="S7",
                            cls="COMM_LOSS",
                            channel_id=cid,
                            object_id=c_obj.object_id,
                            start_ts=round(st, 2),
                            end_ts=round(et, 2),
                            hazard_ts=None,
                        )
                    )
                    gt_event_idx += 1

                    # Outage: missing measurements (NaN)
                    idx_mask = (timestamps >= st) & (timestamps <= et)
                    analog_series[cid][idx_mask] = np.nan
                    placed = True
                    break
            if placed:
                break
        if not placed:
            raise RuntimeError(f"Could not place S7 event {gt_event_idx}")

    # 3. Nuisance noise (negative controls, 30% of channels of each type)
    # Strictly excluding any channel with an active event on that same day
    # - Gas: 40 * 0.3 = 12 channels. Single spikes up to 0.6 % (approx 20 per day across the park)
    # - Temp: 40 * 0.3 = 12 channels. Warm periods up to 33 C (slow, <= 0.02 C/min)
    # - Contacts: 50 * 0.3 = 15 channels. Short staff entrances 1-3 flips in 90s
    for day_idx in range(n_days):
        day_st = day_idx * 86400.0
        day_et = (day_idx + 1) * 86400.0

        # Available channels that have NO events on day_idx
        avail_gas = [c for c in gas_channels if day_idx not in channel_event_days.get(c.channel_id, set())]
        avail_temp = [c for c in temp_channels if day_idx not in channel_event_days.get(c.channel_id, set())]
        avail_contact = [c for c in contact_channels if day_idx not in channel_event_days.get(c.channel_id, set())]

        # Select 30% of channels
        n_neg_gas = min(12, len(avail_gas))
        n_neg_temp = min(12, len(avail_temp))
        n_neg_contact = min(15, len(avail_contact))

        neg_gas = rng.choice(avail_gas, size=n_neg_gas, replace=False)
        neg_temp = rng.choice(avail_temp, size=n_neg_temp, replace=False)
        neg_contact = rng.choice(avail_contact, size=n_neg_contact, replace=False)

        # Gas negative control: ~20 spikes per day across the park
        for _ in range(20):
            target_c = rng.choice(neg_gas)
            spike_t = rng.uniform(day_st, day_et - 2 * dt)
            spike_idx = int(spike_t // dt)
            spike_len = 1 if mode == "month" else int(rng.integers(1, 3))
            spike_val = float(rng.uniform(0.2, 0.6))  # strictly < 1.0% warning threshold
            for offset in range(spike_len):
                if spike_idx + offset < n_steps:
                    if not np.isnan(analog_series[target_c.channel_id][spike_idx + offset]):
                        analog_series[target_c.channel_id][spike_idx + offset] = max(
                            analog_series[target_c.channel_id][spike_idx + offset],
                            spike_val
                        )

        # Temp negative control: warm periods up to 33 C (slow, <= 0.02 C/min)
        # Apply slow gentle warm period on 3 channels per day
        temp_warm_targets = rng.choice(neg_temp, size=min(3, len(neg_temp)), replace=False)
        for target_c in temp_warm_targets:
            warm_st = rng.uniform(day_st, max(day_st, day_et - 8 * 3600.0))
            warm_dur = float(rng.uniform(6.0 * 3600.0, 8.0 * 3600.0))
            warm_et = min(day_et, warm_st + warm_dur)
            idx_mask = (timestamps >= warm_st) & (timestamps <= warm_et)
            ts_sub = timestamps[idx_mask]
            # Smooth sine bump: peak increase 6.0 C (so max temp is <= 22 + 6 = 28-30 C <= 33 C)
            # Max rate of increase: 6.0 * pi / warm_dur <= 6.0 * 3.14 / 21600 = 0.00087 C/s <= 0.015 C/min
            bump = 6.0 * np.sin(np.pi * (ts_sub - warm_st) / warm_dur)
            analog_series[target_c.channel_id][idx_mask] += np.maximum(0.0, bump)
            # Ensure capped at 33 C
            analog_series[target_c.channel_id][idx_mask] = np.minimum(
                analog_series[target_c.channel_id][idx_mask],
                33.0
            )

        # Contact negative control: short staff entrances 1-3 flips in 90 s
        # Apply on 4 channels per day
        contact_targets = rng.choice(neg_contact, size=min(4, len(neg_contact)), replace=False)
        for target_c in contact_targets:
            visit_st = rng.uniform(day_st, day_et - 120.0)
            norm_st, alr_st = states_map.get(target_c.sensor_type, ("Норма", "Сработка"))
            # 2 flips within 30 s: open, then close
            discrete_events.append(
                DiscreteEvent(
                    ts=round(visit_st, 2),
                    channel_id=target_c.channel_id,
                    object_id=target_c.object_id,
                    sensor_type=target_c.sensor_type,
                    state_name=alr_st,
                    is_alarm=True,
                )
            )
            discrete_events.append(
                DiscreteEvent(
                    ts=round(visit_st + 30.0, 2),
                    channel_id=target_c.channel_id,
                    object_id=target_c.object_id,
                    sensor_type=target_c.sensor_type,
                    state_name=norm_st,
                    is_alarm=False,
                )
            )

    # Sort discrete events and ground truth by timestamp
    discrete_events.sort(key=lambda e: e.ts)
    ground_truth.sort(key=lambda g: g.start_ts)

    return Dataset(
        mode=mode,
        seed=seed,
        analog_series=analog_series,
        discrete_events=discrete_events,
        ground_truth=ground_truth,
        channels=channels,
        analog_timestamps=timestamps,
        total_seconds=total_seconds,
        dt=dt,
    )


@dataclass
class Alert:
    ts: float
    channel_id: str
    object_id: str
    cls: str
    severity: str
    value: Optional[float]
    reason_ru: str


# --- Threshold constants matching existing ml_service.classify_alarm / features.py ---
GAS_ALARM_THRESHOLD_VOL_PCT: float = 5.0  # [К] ml_service.classify_alarm, docs/SCENARIOS_SPEC.md section 3
TEMP_WARNING_THRESHOLD_C: float = 40.0  # [К] ml_service.classify_alarm, docs/SCENARIOS_SPEC.md section 3
TEMP_ALARM_THRESHOLD_C: float = 45.0  # [К] backend/ml/features.py, docs/SCENARIOS_SPEC.md section 3

# --- Module-level named constants that exist only in docs/SCENARIOS_SPEC.md ---

# Section 3, line 34: CH4 early sign (GAS_RATE)
# значение ≥ 0,3 % в 3 подряд замерах И наклон МНК по окну 5 мин ≥ 0,05 %/мин
GAS_RATE_VALUE_THRESHOLD: float = 0.3  # % vol
GAS_RATE_SLOPE_THRESHOLD: float = 0.05  # % vol / min
GAS_RATE_PERSISTENCE_SAMPLES: int = 3  # consecutive samples
GAS_RATE_WINDOW_SECONDS: float = 300.0  # 5 minutes

# Section 3, line 37: Temp early sign (TEMP_RATE)
# значение ≥ 28 °C И наклон МНК по окну max(10 мин; 3 замера) ≥ 0,2 °C/мин
TEMP_RATE_VALUE_THRESHOLD: float = 28.0  # °C
TEMP_RATE_SLOPE_THRESHOLD: float = 0.2  # °C / min
TEMP_RATE_PERSISTENCE_SAMPLES: int = 3  # consecutive samples
TEMP_RATE_WINDOW_SECONDS: float = 600.0  # 10 minutes

# Section 3, line 38: Chatter hysteresis clear multiplier
# снятие после 2×окно без переключений
CHATTER_CLEAR_WINDOW_MULTIPLIER: float = 2.0  # 2x chatter_window_seconds without flips

# Section 3, line 39: Analog comm loss
# нет замеров > max(15 мин; 3 шага)
COMM_LOSS_MIN_GAP_SECONDS: float = 900.0  # 15 minutes
COMM_LOSS_MIN_GAP_STEPS: int = 3  # steps

# Section 3, line 41: Fire correlation window
# тревога теплового датчика + температура ≥ 40 °C на том же объекте в окне 10 мин
FIRE_CORRELATION_WINDOW_SECONDS: float = 600.0  # 10 minutes

# Section 3, line 42: Incident deduplication and 30-min reminder
# один открытый инцидент на (канал, класс); напоминание не чаще 1 раза в 30 мин
INCIDENT_REMINDER_SECONDS: float = 1800.0  # 30 minutes

# Section 3, line 42: Incident closing conditions
# газ < 0,8×порога 5 мин
GAS_HYSTERESIS_FACTOR: float = 0.8
GAS_CLOSE_CLEAR_SECONDS: float = 300.0  # 5 minutes

# температура < порога − 2 °C 5 мин
TEMP_HYSTERESIS_DELTA: float = 2.0  # °C
TEMP_CLOSE_CLEAR_SECONDS: float = 300.0  # 5 minutes


def _calc_least_squares_slope(
    timestamps: np.ndarray,
    values: np.ndarray,
    current_idx: int,
    window_sec: float,
) -> float:
    """
    Computes least-squares slope in units / minute over a trailing window of up to window_sec.
    Only non-NaN points within [t_curr - window_sec, t_curr] are included.
    Returns 0.0 if fewer than 3 valid points.
    """
    t_curr = timestamps[current_idx]
    t_min = t_curr - window_sec
    dt = timestamps[1] - timestamps[0] if len(timestamps) > 1 else 60.0
    approx_steps = int(np.ceil(window_sec / dt))
    start_idx = max(0, current_idx - approx_steps)
    while start_idx < current_idx and timestamps[start_idx] < t_min:
        start_idx += 1
    t_sub = timestamps[start_idx:current_idx + 1]
    v_sub = values[start_idx:current_idx + 1]
    valid_mask = ~np.isnan(v_sub)
    if np.count_nonzero(valid_mask) < 3:
        return 0.0
    t_valid = t_sub[valid_mask]
    v_valid = v_sub[valid_mask]
    t_mean = np.mean(t_valid)
    v_mean = np.mean(v_valid)
    t_diff = t_valid - t_mean
    denom = np.sum(t_diff * t_diff)
    if denom <= 1e-9:
        return 0.0
    return float(np.sum(t_diff * (v_valid - v_mean)) / denom * 60.0)


def detect(dataset: Dataset) -> List[Alert]:
    """
    Fast reactive contour detector per docs/SCENARIOS_SPEC.md Section 3:
    - Static thresholds: gas warning, gas alarm, temp warning, temp alarm
    - Rate of rise with persistence (3 consecutive samples) and least-squares slope
    - Contact chatter with hysteresis (clear after 2x window without flips)
    - Loss of communication for analog channels (missing samples > max(15 min, 3 steps))
    - Flood alarm
    - Fire correlation on the same object within 10 min
    - One open incident per (channel, class), 30-min reminders, hysteresis closing conditions
    - Streaming/stateful per channel, deterministic output
    """
    settings = get_current_settings()
    gas_warn_thresh = float(settings.gas_warning_threshold_vol_pct)
    chatter_min_flips = int(settings.chatter_min_flips)
    chatter_window_sec = float(settings.chatter_window_seconds)
    chatter_clear_sec = chatter_window_sec * CHATTER_CLEAR_WINDOW_MULTIPLIER

    alerts: List[Alert] = []
    timestamps = dataset.analog_timestamps
    dt = dataset.dt
    gap_thresh = max(COMM_LOSS_MIN_GAP_SECONDS, COMM_LOSS_MIN_GAP_STEPS * dt)

    # Store high temp moments per object for fire correlation: object_id -> list of (t, val)
    object_temp_ge_40: Dict[str, List[Tuple[float, float]]] = {}

    # 1. Process analog channels
    for cid, c_info in dataset.channels.items():
        if cid not in dataset.analog_series:
            continue
        stype = c_info.sensor_type
        oid = c_info.object_id
        values = dataset.analog_series[cid]
        n_pts = len(values)

        comm_loss_open = False
        comm_loss_last_alert_ts = -1e9
        last_valid_t = -1e9

        alarm_open = False
        alarm_last_alert_ts = -1e9
        alarm_clear_sec = 0.0

        warn_open = False
        warn_last_alert_ts = -1e9
        warn_clear_sec = 0.0

        rate_open = False
        rate_last_alert_ts = -1e9
        rate_clear_sec = 0.0

        for i in range(n_pts):
            t = timestamps[i]
            v = values[i]

            if np.isnan(v):
                if last_valid_t >= 0.0 and (t - last_valid_t) > gap_thresh:
                    if not comm_loss_open:
                        comm_loss_open = True
                        comm_loss_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="COMM_LOSS", severity="WARNING",
                            value=round((t - last_valid_t) / 60.0, 1),
                            reason_ru=f"Потеря связи: нет данных {round((t - last_valid_t) / 60.0)} мин"
                        ))
                    elif (t - comm_loss_last_alert_ts) >= INCIDENT_REMINDER_SECONDS:
                        comm_loss_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="COMM_LOSS", severity="WARNING",
                            value=round((t - last_valid_t) / 60.0, 1),
                            reason_ru=f"Напоминание: потеря связи продолжается {round((t - last_valid_t) / 60.0)} мин"
                        ))
                continue

            last_valid_t = t
            if comm_loss_open:
                comm_loss_open = False

            if stype == "Газовый датчик":
                # GAS_ALARM (5.0%)
                if v >= GAS_ALARM_THRESHOLD_VOL_PCT:
                    alarm_clear_sec = 0.0
                    if not alarm_open:
                        alarm_open = True
                        alarm_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="GAS_ALARM", severity="ALARM",
                            value=round(float(v), 2),
                            reason_ru=f"Аварийная концентрация метана: {v:.2f} % (порог {GAS_ALARM_THRESHOLD_VOL_PCT:.1f} %)"
                        ))
                    elif (t - alarm_last_alert_ts) >= INCIDENT_REMINDER_SECONDS:
                        alarm_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="GAS_ALARM", severity="ALARM",
                            value=round(float(v), 2),
                            reason_ru=f"Напоминание: аварийная концентрация метана ({v:.2f} %)"
                        ))
                elif alarm_open:
                    if v < GAS_HYSTERESIS_FACTOR * GAS_ALARM_THRESHOLD_VOL_PCT:
                        alarm_clear_sec += dt
                        if alarm_clear_sec >= GAS_CLOSE_CLEAR_SECONDS:
                            alarm_open = False
                    else:
                        alarm_clear_sec = 0.0

                # GAS_WARNING (1.0%)
                if v >= gas_warn_thresh:
                    warn_clear_sec = 0.0
                    if not warn_open:
                        warn_open = True
                        warn_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="GAS_WARNING", severity="WARNING",
                            value=round(float(v), 2),
                            reason_ru=f"Превышение предупредительного порога метана: {v:.2f} % (порог {gas_warn_thresh:.1f} %)"
                        ))
                    elif (t - warn_last_alert_ts) >= INCIDENT_REMINDER_SECONDS:
                        warn_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="GAS_WARNING", severity="WARNING",
                            value=round(float(v), 2),
                            reason_ru=f"Напоминание: концентрация метана выше нормы ({v:.2f} %)"
                        ))
                elif warn_open:
                    if v < GAS_HYSTERESIS_FACTOR * gas_warn_thresh:
                        warn_clear_sec += dt
                        if warn_clear_sec >= GAS_CLOSE_CLEAR_SECONDS:
                            warn_open = False
                    else:
                        warn_clear_sec = 0.0

                # GAS_RATE
                persists = (
                    i >= (GAS_RATE_PERSISTENCE_SAMPLES - 1)
                    and v >= GAS_RATE_VALUE_THRESHOLD
                    and values[i - 1] >= GAS_RATE_VALUE_THRESHOLD
                    and values[i - 2] >= GAS_RATE_VALUE_THRESHOLD
                )
                slope = _calc_least_squares_slope(timestamps, values, i, window_sec=max(GAS_RATE_WINDOW_SECONDS, 2 * dt)) if persists else 0.0
                if persists and slope >= GAS_RATE_SLOPE_THRESHOLD:
                    rate_clear_sec = 0.0
                    if not rate_open:
                        rate_open = True
                        rate_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="GAS_RATE", severity="WARNING",
                            value=round(float(v), 2),
                            reason_ru=f"Рост метана {slope:.2f} %/мин, значение {v:.2f} %"
                        ))
                    elif (t - rate_last_alert_ts) >= INCIDENT_REMINDER_SECONDS:
                        rate_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="GAS_RATE", severity="WARNING",
                            value=round(float(v), 2),
                            reason_ru=f"Напоминание: продолжается рост метана ({slope:.2f} %/мин, {v:.2f} %)"
                        ))
                elif rate_open:
                    rate_clear_sec += dt
                    if rate_clear_sec >= GAS_CLOSE_CLEAR_SECONDS:
                        rate_open = False

            elif stype == "Датчик температуры":
                if v >= TEMP_WARNING_THRESHOLD_C:
                    object_temp_ge_40.setdefault(oid, []).append((t, float(v)))

                # TEMP_ALARM (45.0 °C)
                if v >= TEMP_ALARM_THRESHOLD_C:
                    alarm_clear_sec = 0.0
                    if not alarm_open:
                        alarm_open = True
                        alarm_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="TEMP_ALARM", severity="ALARM",
                            value=round(float(v), 1),
                            reason_ru=f"Аварийный перегрев: {v:.1f} °C (порог {TEMP_ALARM_THRESHOLD_C:.1f} °C)"
                        ))
                    elif (t - alarm_last_alert_ts) >= INCIDENT_REMINDER_SECONDS:
                        alarm_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="TEMP_ALARM", severity="ALARM",
                            value=round(float(v), 1),
                            reason_ru=f"Напоминание: аварийный перегрев ({v:.1f} °C)"
                        ))
                elif alarm_open:
                    if v < (TEMP_ALARM_THRESHOLD_C - TEMP_HYSTERESIS_DELTA):
                        alarm_clear_sec += dt
                        if alarm_clear_sec >= TEMP_CLOSE_CLEAR_SECONDS:
                            alarm_open = False
                    else:
                        alarm_clear_sec = 0.0

                # TEMP_WARNING (40.0 °C)
                if v >= TEMP_WARNING_THRESHOLD_C:
                    warn_clear_sec = 0.0
                    if not warn_open:
                        warn_open = True
                        warn_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="TEMP_WARNING", severity="WARNING",
                            value=round(float(v), 1),
                            reason_ru=f"Превышение температуры: {v:.1f} °C (порог {TEMP_WARNING_THRESHOLD_C:.1f} °C)"
                        ))
                    elif (t - warn_last_alert_ts) >= INCIDENT_REMINDER_SECONDS:
                        warn_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="TEMP_WARNING", severity="WARNING",
                            value=round(float(v), 1),
                            reason_ru=f"Напоминание: повышенная температура ({v:.1f} °C)"
                        ))
                elif warn_open:
                    if v < (TEMP_WARNING_THRESHOLD_C - TEMP_HYSTERESIS_DELTA):
                        warn_clear_sec += dt
                        if warn_clear_sec >= TEMP_CLOSE_CLEAR_SECONDS:
                            warn_open = False
                    else:
                        warn_clear_sec = 0.0

                # TEMP_RATE (28.0 °C, 0.2 °C/min)
                persists = (
                    i >= (TEMP_RATE_PERSISTENCE_SAMPLES - 1)
                    and v >= TEMP_RATE_VALUE_THRESHOLD
                    and values[i - 1] >= TEMP_RATE_VALUE_THRESHOLD
                    and values[i - 2] >= TEMP_RATE_VALUE_THRESHOLD
                )
                slope = _calc_least_squares_slope(timestamps, values, i, window_sec=max(TEMP_RATE_WINDOW_SECONDS, 2 * dt)) if persists else 0.0
                if persists and slope >= TEMP_RATE_SLOPE_THRESHOLD:
                    rate_clear_sec = 0.0
                    if not rate_open:
                        rate_open = True
                        rate_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="TEMP_RATE", severity="WARNING",
                            value=round(float(v), 1),
                            reason_ru=f"Быстрый рост температуры {slope:.2f} °C/мин, значение {v:.1f} °C"
                        ))
                    elif (t - rate_last_alert_ts) >= INCIDENT_REMINDER_SECONDS:
                        rate_last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="TEMP_RATE", severity="WARNING",
                            value=round(float(v), 1),
                            reason_ru=f"Напоминание: быстрый рост температуры ({slope:.2f} °C/мин, {v:.1f} °C)"
                        ))
                elif rate_open:
                    rate_clear_sec += dt
                    if rate_clear_sec >= TEMP_CLOSE_CLEAR_SECONDS:
                        rate_open = False

    # 2. Process discrete channels (CHATTER, FLOOD)
    events_by_channel: Dict[str, List[DiscreteEvent]] = {}
    for e in dataset.discrete_events:
        events_by_channel.setdefault(e.channel_id, []).append(e)

    for cid, ev_list in events_by_channel.items():
        c_info = dataset.channels.get(cid)
        if not c_info:
            continue
        stype = c_info.sensor_type
        oid = c_info.object_id

        if stype in ("КД Люк", "КД Дверь", "КД АВ"):
            flips_window: List[float] = []
            incident_open = False
            last_alert_ts = -1e9
            last_flip_ts = -1e9

            for ev in ev_list:
                t = ev.ts
                # Hysteresis: clear after 2x window without flips
                if incident_open and (t - last_flip_ts) >= chatter_clear_sec:
                    incident_open = False

                last_flip_ts = t
                flips_window.append(t)
                while flips_window and flips_window[0] < (t - chatter_window_sec):
                    flips_window.pop(0)

                if len(flips_window) >= chatter_min_flips:
                    if not incident_open:
                        incident_open = True
                        last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="CHATTER", severity="WARNING",
                            value=float(len(flips_window)),
                            reason_ru=f"Дребезг контактов: {len(flips_window)} переключений за {chatter_window_sec:.0f} с"
                        ))
                    elif (t - last_alert_ts) >= INCIDENT_REMINDER_SECONDS:
                        last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="CHATTER", severity="WARNING",
                            value=float(len(flips_window)),
                            reason_ru=f"Напоминание: продолжается дребезг контактов ({len(flips_window)} переключений за {chatter_window_sec:.0f} с)"
                        ))

        elif stype == "Датчик затопления":
            incident_open = False
            last_alert_ts = -1e9
            for ev in ev_list:
                t = ev.ts
                if ev.is_alarm:
                    if not incident_open:
                        incident_open = True
                        last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="FLOOD", severity="ALARM",
                            value=1.0,
                            reason_ru=f"Сработка датчика затопления: '{ev.state_name}'"
                        ))
                    elif (t - last_alert_ts) >= INCIDENT_REMINDER_SECONDS:
                        last_alert_ts = t
                        alerts.append(Alert(
                            ts=t, channel_id=cid, object_id=oid, cls="FLOOD", severity="ALARM",
                            value=1.0,
                            reason_ru=f"Напоминание: продолжается затопление ('{ev.state_name}')"
                        ))
                else:
                    incident_open = False

    # 3. Fire correlation on the same object within 10 min
    for cid, ev_list in events_by_channel.items():
        c_info = dataset.channels.get(cid)
        if not c_info or c_info.sensor_type != "Тепловой датчик":
            continue
        oid = c_info.object_id
        temps_on_obj = object_temp_ge_40.get(oid, [])
        if not temps_on_obj:
            continue

        cur_alarm_start: Optional[float] = None
        alarm_episodes: List[Tuple[float, float]] = []
        for ev in ev_list:
            if ev.is_alarm and cur_alarm_start is None:
                cur_alarm_start = ev.ts
            elif not ev.is_alarm and cur_alarm_start is not None:
                alarm_episodes.append((cur_alarm_start, ev.ts))
                cur_alarm_start = None
        if cur_alarm_start is not None:
            alarm_episodes.append((cur_alarm_start, dataset.total_seconds))

        for h_start, h_end in alarm_episodes:
            matching_temps = [
                (t_temp, val) for t_temp, val in temps_on_obj
                if (h_start - FIRE_CORRELATION_WINDOW_SECONDS) <= t_temp <= (h_end + FIRE_CORRELATION_WINDOW_SECONDS)
            ]
            if not matching_temps:
                continue

            t_first_temp, v_first = matching_temps[0]
            trigger_t = max(h_start, t_first_temp)
            alerts.append(Alert(
                ts=round(trigger_t, 2),
                channel_id=cid,
                object_id=oid,
                cls="FIRE",
                severity="ALARM",
                value=round(v_first, 1),
                reason_ru=f"Пожарная тревога: сработка теплового датчика и температура {v_first:.1f} °C на объекте {oid}"
            ))

            # 30-min reminders if fire condition persists
            last_fire_alert_t = trigger_t
            for next_t_temp, next_val in matching_temps:
                if next_t_temp >= last_fire_alert_t + INCIDENT_REMINDER_SECONDS and next_t_temp <= h_end:
                    last_fire_alert_t = next_t_temp
                    alerts.append(Alert(
                        ts=round(next_t_temp, 2),
                        channel_id=cid,
                        object_id=oid,
                        cls="FIRE",
                        severity="ALARM",
                        value=round(next_val, 1),
                        reason_ru=f"Напоминание: продолжается пожарная тревога (температура {next_val:.1f} °C на объекте {oid})"
                    ))

    alerts.sort(key=lambda a: (a.ts, a.channel_id, a.cls))
    return alerts


def detect_naive(dataset: Dataset) -> List[Alert]:
    """
    Baseline naive detector per docs/SCENARIOS_SPEC.md Section 5:
    - Static thresholds only:
      * Gas >= gas_warning_threshold_vol_pct -> GAS_WARNING (or GAS_ALARM if >= 5.0%)
      * Temperature >= 40.0 °C -> TEMP_WARNING (or TEMP_ALARM if >= 45.0 °C)
      * Every alarm-state discrete event is a separate alert:
        - "Датчик затопления" -> FLOOD
        - "Тепловой датчик" -> FIRE
        - Contact sensors -> CHATTER
    - No rate rules, no hysteresis, no dedup, no correlation, no comm loss detection.
    """
    settings = get_current_settings()
    gas_warn_thresh = float(settings.gas_warning_threshold_vol_pct)
    alerts: List[Alert] = []
    timestamps = dataset.analog_timestamps

    for cid, series in dataset.analog_series.items():
        c_info = dataset.channels[cid]
        stype = c_info.sensor_type
        oid = c_info.object_id
        for i in range(len(series)):
            v = series[i]
            if np.isnan(v):
                continue
            t = timestamps[i]
            if stype == "Газовый датчик":
                if v >= gas_warn_thresh:
                    cls = "GAS_ALARM" if v >= GAS_ALARM_THRESHOLD_VOL_PCT else "GAS_WARNING"
                    severity = "ALARM" if v >= GAS_ALARM_THRESHOLD_VOL_PCT else "WARNING"
                    alerts.append(Alert(
                        ts=t, channel_id=cid, object_id=oid, cls=cls, severity=severity,
                        value=round(float(v), 2),
                        reason_ru=f"Порог метана превышен: {v:.2f} %"
                    ))
            elif stype == "Датчик температуры":
                if v >= TEMP_WARNING_THRESHOLD_C:
                    cls = "TEMP_ALARM" if v >= TEMP_ALARM_THRESHOLD_C else "TEMP_WARNING"
                    severity = "ALARM" if v >= TEMP_ALARM_THRESHOLD_C else "WARNING"
                    alerts.append(Alert(
                        ts=t, channel_id=cid, object_id=oid, cls=cls, severity=severity,
                        value=round(float(v), 1),
                        reason_ru=f"Порог температуры превышен: {v:.1f} °C"
                    ))

    for ev in dataset.discrete_events:
        if ev.is_alarm:
            c_info = dataset.channels.get(ev.channel_id)
            if not c_info:
                continue
            stype = c_info.sensor_type
            if stype == "Датчик затопления":
                cls = "FLOOD"
                severity = "ALARM"
            elif stype == "Тепловой датчик":
                cls = "FIRE"
                severity = "ALARM"
            else:
                cls = "CHATTER"
                severity = "WARNING"
            alerts.append(Alert(
                ts=ev.ts, channel_id=ev.channel_id, object_id=ev.object_id, cls=cls, severity=severity,
                value=1.0,
                reason_ru=f"Сработка дискретного датчика ({ev.state_name})"
            ))

    alerts.sort(key=lambda a: (a.ts, a.channel_id, a.cls))
    return alerts

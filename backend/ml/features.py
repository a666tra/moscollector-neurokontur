"""Shared feature and label definitions for the telemetry model.

Used by the training pipeline (``train_validated_model.py``), the rolling
backtest (``scripts/rolling_backtest.py``) and the reconciliation builder, so
that every evaluation computes features and proxy labels in exactly one way.
"""
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np

FEATURE_NAMES: List[str] = [
    "cnt_24h", "cnt_7d", "alarms_24h", "alarms_7d", "alarm_ratio",
    "acc_events", "acc_alarms", "chatter_cnt", "chatter_ratio",
    "battery_glitches", "date_corruptions", "unique_states",
    "silence_hours", "num_mean", "num_std", "num_max",
    "sensor_type_code", "system_type_code", "gas_spikes", "temp_spikes", "obj_level",
]

FAILURE_VALUES = {
    'неисправен', 'отключено устройство', 'много неисправных устройств',
    '01.01.1970 03:00:00', '01.01.1970 03:00:01', 'обрыв датчика',
    'короткое замыкание', 'ошибка связи', 'нет ответа', 'сбой питания',
    'обрыв цепи', 'ошибка оборудования', 'нет данных'
}

# One telemetry row: (timestamp, alarm flag from СМВУ, raw value as text)
Event = Tuple[datetime, bool, str]


def is_failure_value(val_str: str, is_alarm: bool, sensor_type: str = "", tag: str = "") -> bool:
    """Rule-based label: does this telemetry row show a fault / hazardous reading?

    Rules: hardware and communication fault states, RTC resets (1970 timestamps),
    out-of-range electrical values and sensor-specific physical thresholds
    (CH4 >= 5 %, temperature >= 45 °C or <= -10 °C, supply voltage outside 9–30 V).
    The journal contains no CMMS/1C repair confirmations, so this is a proxy for
    an incident, not a confirmed equipment failure.
    """
    v = str(val_str).strip().lower()
    st = str(sensor_type).lower()
    tg = str(tag).lower()

    # 1. Hardware failure and communication disconnect markers
    if v in FAILURE_VALUES:
        return True
    if any(k in v for k in ('неисправ', 'отключ', 'обрыв', 'сбой', 'авар', 'кз', 'нет связи', 'ошибка датчика')):
        return True
    if '1970' in v:
        return True

    try:
        num = float(v)
    except ValueError:
        return False

    # 2. Out-of-bounds electrical limits
    if num < -50.0 or num > 500.0:
        return True

    # 3. Sensor-specific physical thresholds
    is_gas = 'газ' in st or 'метан' in st or 'ch4' in tg or 'газ' in tg
    is_temp = 'темп' in st or 'термо' in st or 't°' in st or 't' in tg or 'темп' in tg
    is_volt = 'напряж' in st or 'акб' in st or 'питан' in st or 'ввод' in st
    if is_gas:
        return num >= 5.0                       # explosive hazard / sensor saturation
    if is_temp:
        return num >= 45.0 or num <= -10.0      # danger to 10 kV power cables
    if is_volt:
        return (num < 9.0 or num > 30.0) and is_alarm
    return False                                # discrete sensors: numeric = normal state flip


def build_category_maps(sensors_ref: Dict[str, dict]) -> Tuple[Dict[str, int], Dict[str, int]]:
    """Stable integer codes for sensor and system types (sorted, as in training)."""
    sensor_types = sorted({s.get('sensor_type', 'unknown') for s in sensors_ref.values()})
    system_types = sorted({s.get('system_type', 'unknown') for s in sensors_ref.values()})
    return ({t: i for i, t in enumerate(sensor_types)},
            {t: i for i, t in enumerate(system_types)})


def channel_features(evs: List[Event], cutoff_dt: datetime, s_info: dict, o_info: dict,
                     stype_map: Dict[str, int], sys_map: Dict[str, int],
                     last_event_dt: Optional[datetime] = None) -> List[float]:
    """21 features for one channel from events strictly before ``cutoff_dt``.

    ``evs`` may hold the full history or only the last 7 days; only the last
    24 h / 7 d are used. ``last_event_dt`` overrides the time of the last event
    when ``evs`` was truncated (needed for ``silence_hours``).
    """
    evs.sort(key=lambda x: x[0])
    dt_24h = cutoff_dt - timedelta(hours=24)
    dt_7d = cutoff_dt - timedelta(days=7)
    evs_24h = [e for e in evs if e[0] >= dt_24h]
    evs_7d = [e for e in evs if e[0] >= dt_7d]

    cnt_24h, cnt_7d = len(evs_24h), len(evs_7d)
    alarms_24h = sum(1 for e in evs_24h if e[1])
    alarms_7d = sum(1 for e in evs_7d if e[1])
    alarm_ratio = alarms_7d / max(1, cnt_7d)
    acc_events = cnt_24h / (cnt_7d / 7.0 + 0.1)      # last day vs weekly daily mean
    acc_alarms = alarms_24h / (alarms_7d / 7.0 + 0.1)

    chatter_cnt = date_corruptions = battery_glitches = gas_spikes = temp_spikes = 0
    prev_dt, prev_val = None, None
    unique_states = set()
    numeric_vals = []
    stype = s_info.get('sensor_type', '').lower()
    for dt, _is_al, v in evs_7d:
        v_str = str(v).strip()
        unique_states.add(v_str)
        # "chatter": value flips less than 60 s apart (contact bounce, unstable link)
        if prev_dt is not None and (dt - prev_dt).total_seconds() < 60 and v_str != prev_val:
            chatter_cnt += 1
        prev_dt, prev_val = dt, v_str
        if '1970' in v_str:
            date_corruptions += 1
        low = v_str.lower()
        if 'батаре' in low or 'обесточ' in low:
            battery_glitches += 1
        try:
            num = float(v_str)
        except ValueError:
            continue
        numeric_vals.append(num)
        if 'газ' in stype and num >= 1.0:
            gas_spikes += 1
        if 'темп' in stype and num >= 35.0:
            temp_spikes += 1

    last_dt = last_event_dt if last_event_dt is not None else (evs[-1][0] if evs else None)
    silence_hours = max(0.0, (cutoff_dt - last_dt).total_seconds() / 3600.0) if last_dt else 168.0

    return [
        cnt_24h, cnt_7d, alarms_24h, alarms_7d, alarm_ratio,
        acc_events, acc_alarms, chatter_cnt, chatter_cnt / max(1, cnt_7d),
        battery_glitches, date_corruptions, len(unique_states),
        silence_hours,
        float(np.mean(numeric_vals)) if numeric_vals else 0.0,
        float(np.std(numeric_vals)) if len(numeric_vals) > 1 else 0.0,
        float(np.max(numeric_vals)) if numeric_vals else 0.0,
        stype_map.get(s_info.get('sensor_type', ''), 0),
        sys_map.get(s_info.get('system_type', ''), 0),
        gas_spikes, temp_spikes,
        int(o_info.get('hierarchy_level', 3)) if o_info else 3,
    ]

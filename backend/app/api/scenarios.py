"""
backend/app/api/scenarios.py

FastAPI router for scenario simulation and evaluation per docs/SCENARIOS_SPEC.md (v1.1).
Endpoints:
- GET /api/scenarios/catalog
- POST /api/scenarios/run
- POST /api/scenarios/series
"""

from typing import Dict, Any, List, Literal, Optional
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.services.scenario_engine import (
    select_channels,
    generate_dataset,
    detect,
    run_scenario,
    TARGET_CHANNEL_SPECS,
    SCENARIO_COUNTS,
)

router = APIRouter()


class ScenarioDetectorMetrics(BaseModel):
    overall: Dict[str, Any]
    scenarios: Dict[str, Any]
    lead_time: Dict[str, Any]
    delay: Dict[str, Any]
    false_alarms: Dict[str, Any]
    alerts_total: int
    incidents: int
    alerts_count: Optional[Dict[str, int]] = None
    s8_metrics: Optional[Dict[str, Any]] = None


class ScenarioComparison(BaseModel):
    fast: ScenarioDetectorMetrics
    static_dedup: ScenarioDetectorMetrics
    naive: ScenarioDetectorMetrics


class ScenarioRunResponse(BaseModel):
    data_origin: str = "SYNTHETIC"
    seed: int
    mode: str
    elapsed_seconds: float
    thresholds_used: Dict[str, Any]
    summary: ScenarioDetectorMetrics
    comparison: ScenarioComparison
    naive_alerts_to_fast_incidents: float
    static_dedup_incidents_to_fast_incidents: float
    ratios: Dict[str, float]
    incident_list: List[Dict[str, Any]]


class ScenarioRunRequest(BaseModel):
    mode: Literal["day", "month"]
    seed: int = Field(default=42, ge=0, le=10000)


class ScenarioSeriesRequest(BaseModel):
    mode: Literal["day", "month"]
    seed: int = Field(default=42, ge=0, le=10000)
    channel_id: str


@router.get("/catalog")
def get_scenarios_catalog() -> Dict[str, Any]:
    """
    Returns scenario descriptions, threshold rules, and channel composition
    per docs/SCENARIOS_SPEC.md.
    """
    scenarios_meta = [
        {
            "id": "S1",
            "name": "Медленная утечка газа",
            "shape": "линейный рост 0,05 → 3 % за 40 мин, 20 мин плато, затем проветривание",
            "cls": "GAS",
            "day_count": SCENARIO_COUNTS["day"]["S1"],
            "month_count": SCENARIO_COUNTS["month"]["S1"],
            "target_metric": "lead_time",
        },
        {
            "id": "S2",
            "name": "Быстрая утечка газа",
            "shape": "скачок до 5,5 % за 3 мин",
            "cls": "GAS",
            "day_count": SCENARIO_COUNTS["day"]["S2"],
            "month_count": SCENARIO_COUNTS["month"]["S2"],
            "target_metric": "delay",
        },
        {
            "id": "S3",
            "name": "Перегрев трубопровода",
            "shape": "+0,3 °C/мин до 55 °C",
            "cls": "TEMP",
            "day_count": SCENARIO_COUNTS["day"]["S3"],
            "month_count": SCENARIO_COUNTS["month"]["S3"],
            "target_metric": "lead_time",
        },
        {
            "id": "S4",
            "name": "Пожар",
            "shape": "тепловой датчик «Сработка» + температура на том же объекте +3 °C/мин до 80",
            "cls": "FIRE",
            "day_count": SCENARIO_COUNTS["day"]["S4"],
            "month_count": SCENARIO_COUNTS["month"]["S4"],
            "target_metric": "delay",
        },
        {
            "id": "S5",
            "name": "Затопление",
            "shape": "датчик затопления в тревоге 30 мин",
            "cls": "FLOOD",
            "day_count": SCENARIO_COUNTS["day"]["S5"],
            "month_count": SCENARIO_COUNTS["month"]["S5"],
            "target_metric": "delay",
        },
        {
            "id": "S6",
            "name": "Дребезг контакта",
            "shape": "пачка 6–14 переключений за ≤ 60 с, 8–10 пачек подряд с паузой 5–10 мин",
            "cls": "CHATTER",
            "day_count": SCENARIO_COUNTS["day"]["S6"],
            "month_count": SCENARIO_COUNTS["month"]["S6"],
            "target_metric": "delay",
        },
        {
            "id": "S7",
            "name": "Потеря связи",
            "shape": "замеры отсутствуют 60–180 мин",
            "cls": "COMM_LOSS",
            "day_count": SCENARIO_COUNTS["day"]["S7"],
            "month_count": SCENARIO_COUNTS["month"]["S7"],
            "target_metric": "delay",
        },
        {
            "id": "S8",
            "name": "Колебание газа у уставки",
            "shape": "значение чередуется 0,96 ↔ 1,04 % (смена каждые 1–3 замера) + шум N(0; 0,01) в течение 30 мин",
            "cls": "SETPOINT",
            "day_count": SCENARIO_COUNTS["day"]["S8"],
            "month_count": SCENARIO_COUNTS["month"]["S8"],
            "target_metric": "delay",
        },
    ]

    thresholds_meta = [
        {"parameter": "CH4, предупреждение", "value": "≥ 1,0 % об.", "source": "[З] заказчик/эксперты"},
        {"parameter": "CH4, авария", "value": "≥ 5,0 % об.", "source": "[К] classify_alarm"},
        {"parameter": "CH4, ранний признак (GAS_RATE)", "value": "значение ≥ 0,3 % в 3 подряд замерах И наклон МНК по окну max(5 мин; 3 шага) ≥ 0,05 %/мин", "source": "[Д] допущение"},
        {"parameter": "Температура, предупреждение", "value": "≥ 40 °C", "source": "[К] classify_alarm"},
        {"parameter": "Температура, авария", "value": "≥ 45 °C", "source": "[К] features.py"},
        {"parameter": "Температура, ранний признак (TEMP_RATE)", "value": "значение ≥ 28 °C И наклон МНК по окну max(10 мин; 3 замера) ≥ 0,2 °C/мин", "source": "[Д] допущение"},
        {"parameter": "Дребезг (CHATTER)", "value": "≥ 5 переключений за 90 с; снятие после 15 мин без переключений", "source": "[К]+[Д] spec v1.1"},
        {"parameter": "Дребезг у уставки (SETPOINT_CHATTER), газ", "value": "≥ 4 пересечений порога предупреждения (вверх или вниз) за 15 мин; снятие после 30 мин без пересечений; один инцидент на серию (серьёзность «предупреждение»)", "source": "[Д] (по примеру эксперта)"},
        {"parameter": "Потеря связи (COMM_LOSS)", "value": "нет замеров > max(15 мин; 3 шага)", "source": "[Д] допущение"},
        {"parameter": "Затопление (FLOOD)", "value": "состояние «тревога» датчика затопления любой длительности", "source": "[Д] допущение"},
        {"parameter": "Пожар (FIRE), эскалация", "value": "немедленно по тепловому датчику («высокая»), эскалация до «критической» при температуре ≥ 40 °C на том же объекте в окне 10 мин", "source": "[Д] допущение"},
        {"parameter": "Повтор оповещения", "value": "один открытый инцидент на (канал, класс); напоминание не чаще 1 раза в 30 мин; закрытие по гистерезису", "source": "[Д] допущение"},
    ]

    channels_dict = select_channels()
    channel_specs = [{"sensor_type": st, "count": cnt} for st, cnt in TARGET_CHANNEL_SPECS]

    return {
        "data_origin": "SYNTHETIC",
        "scenarios": scenarios_meta,
        "thresholds": thresholds_meta,
        "channel_composition": {
            "total_channels": len(channels_dict),
            "specs": channel_specs,
            "channels": [
                {
                    "channel_id": c.channel_id,
                    "sensor_type": c.sensor_type,
                    "object_id": c.object_id,
                    "sensor_name": c.sensor_name,
                    "system_type": c.system_type,
                }
                for c in channels_dict.values()
            ],
        },
    }


@router.post("/run", response_model=ScenarioRunResponse)
def post_run_scenario(req: ScenarioRunRequest) -> Dict[str, Any]:
    """
    Runs synthetic scenario simulation, detects alerts across fast, static_dedup,
    and naive baselines, evaluates metrics, and returns cached comparison block.
    """
    return run_scenario(mode=req.mode, seed=req.seed)


@router.post("/series")
def post_channel_series(req: ScenarioSeriesRequest) -> Dict[str, Any]:
    """
    Returns downsampled telemetry series (<= 600 points), threshold bounds,
    ground-truth event windows, and alerts for a given channel.
    """
    dataset = generate_dataset(mode=req.mode, seed=req.seed)
    if req.channel_id not in dataset.channels:
        raise HTTPException(
            status_code=404,
            detail=f"Channel '{req.channel_id}' not found in scenario dataset",
        )

    channel_info = dataset.channels[req.channel_id]
    stype = channel_info.sensor_type
    oid = channel_info.object_id

    # Downsampled series (max 600 points)
    series_points: List[Dict[str, Any]] = []
    if req.channel_id in dataset.analog_series:
        vals = dataset.analog_series[req.channel_id]
        ts_arr = dataset.analog_timestamps
        n_pts = len(ts_arr)
        if n_pts <= 600:
            indices = list(range(n_pts))
        else:
            stride = int(np.ceil(n_pts / 600))
            indices = list(range(0, n_pts, stride))
            if indices[-1] != n_pts - 1:
                indices.append(n_pts - 1)

        for idx in indices:
            v = vals[idx]
            series_points.append({
                "ts": float(ts_arr[idx]),
                "value": None if np.isnan(v) else round(float(v), 2),
            })
    else:
        # Discrete channel
        evs = [e for e in dataset.discrete_events if e.channel_id == req.channel_id]
        if len(evs) <= 600:
            sel_evs = evs
        else:
            stride = int(np.ceil(len(evs) / 600))
            sel_evs = evs[::stride]
        for e in sel_evs:
            series_points.append({
                "ts": float(e.ts),
                "state_name": str(e.state_name),
                "is_alarm": bool(e.is_alarm),
            })

    # Threshold bounds applicable to channel
    thresholds: Dict[str, Optional[float]] = {}
    if stype == "Газовый датчик":
        thresholds = {"warning": 1.0, "alarm": 5.0}
    elif stype == "Датчик температуры":
        thresholds = {"warning": 40.0, "alarm": 45.0}

    # True event windows for this channel (or where it is related)
    true_events = [
        {
            "event_id": g.event_id,
            "scenario_id": g.scenario_id,
            "cls": g.cls,
            "start_ts": float(g.start_ts),
            "end_ts": float(g.end_ts),
            "hazard_ts": float(g.hazard_ts) if g.hazard_ts is not None else None,
        }
        for g in dataset.ground_truth
        if g.channel_id == req.channel_id or req.channel_id in g.related_channel_ids
    ]

    # Detector alerts for this channel
    alerts = detect(dataset)
    channel_alerts = [
        {
            "ts": float(a.ts),
            "cls": str(a.cls),
            "severity": str(a.severity),
            "value": float(a.value) if a.value is not None else None,
            "reason_ru": str(a.reason_ru),
            "is_reminder": bool(a.is_reminder),
            "is_escalation": bool(a.is_escalation),
        }
        for a in alerts
        if a.channel_id == req.channel_id or (a.cls == "FIRE" and a.object_id == oid)
    ]

    return {
        "data_origin": "SYNTHETIC",
        "seed": int(req.seed),
        "mode": req.mode,
        "channel_id": req.channel_id,
        "sensor_type": stype,
        "object_id": oid,
        "thresholds": thresholds,
        "series": series_points,
        "true_events": true_events,
        "alerts": channel_alerts,
    }

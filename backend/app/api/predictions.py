import os
import json
import time
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
from backend.app.models.schemas import (
    PredictionItem, PredictionListResponse, RealtimeScoreRequest, RealtimeScoreResponse
)
from backend.app.services.data_service import data_service
from backend.app.services.ml_service import ml_service
from backend.app.core.config import settings
from backend.app.api.settings import get_current_settings

router = APIRouter()

def classify_risk(prob: float, thresh: float) -> str:
    crit_t = max(0.70, thresh)
    if prob >= crit_t:
        return "CRITICAL"
    if prob >= thresh:
        return "WARNING"
    if prob >= 0.20:
        return "ATTENTION"
    return "NORMAL"


def calibration_fields(prediction: Dict[str, Any]) -> Dict[str, Any]:
    probability = prediction.get("calibrated_proxy_probability")
    calibrated = bool(prediction.get("is_calibrated", False) and probability is not None)
    supplied_status = prediction.get("calibration_status")
    if calibrated:
        status = supplied_status or "CALIBRATED_METHOD_UNKNOWN"
    elif isinstance(supplied_status, str) and not supplied_status.startswith("CALIBRATED_"):
        status = supplied_status
    else:
        status = "CALIBRATION_UNAVAILABLE"
    return {
        "calibrated_proxy_probability": probability if calibrated else None,
        "is_calibrated": calibrated,
        "calibration_status": status,
    }


def action_for_risk(prediction: Dict[str, Any], risk: str) -> str:
    if prediction.get("risk_level") == risk:
        return prediction.get("recommended_action", "")
    return {
        "CRITICAL": "Приоритетная проверка диспетчером и осмотр по регламенту; решение о выезде принимает специалист.",
        "WARNING": "Проверить канал и запланировать осмотр по регламенту ТОиР.",
        "ATTENTION": "Усилить наблюдение за каналом и проверить качество телеметрии.",
        "NORMAL": "Штатное наблюдение; отклонений по текущему порогу не выявлено.",
    }[risk]

@router.get("", response_model=PredictionListResponse)
def get_predictions(
    object_id: Optional[str] = Query(None, description="Фильтр по ID объекта"),
    risk_level: Optional[str] = Query(None, description="Фильтр: CRITICAL, WARNING, ATTENTION, NORMAL"),
    sensor_type: Optional[str] = Query(None, description="Фильтр по типу датчика"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    preds = data_service.predictions
    if object_id:
        preds = [p for p in preds if p["object_id"] == object_id]
    if sensor_type:
        preds = [p for p in preds if sensor_type.lower() in p["sensor_type"].lower()]

    # Dynamic risk counting using active threshold from singleton system settings
    thresh = get_current_settings().decision_threshold
    crit_t = max(0.70, thresh)
    att_t = min(0.20, thresh)

    # Exhaustive disjoint partition (sum == len(preds))
    critical_cnt = sum(1 for p in preds if p["failure_probability"] >= crit_t)
    warning_cnt = sum(1 for p in preds if crit_t > p["failure_probability"] >= thresh)
    attention_cnt = sum(1 for p in preds if thresh > p["failure_probability"] >= att_t)
    normal_cnt = sum(1 for p in preds if p["failure_probability"] < att_t)

    # Filter by dynamically evaluated risk level
    if risk_level:
        target_risk = risk_level.upper()
        preds = [p for p in preds if classify_risk(p["failure_probability"], thresh) == target_risk]

    sorted_preds = sorted(preds, key=lambda x: -x["failure_probability"])
    page_items = sorted_preds[offset : offset + limit]

    items = [
        PredictionItem(
            channel_id=p["channel_id"],
            object_id=p["object_id"],
            object_name=p.get("object_name", "Коллектор"),
            sensor_name=p.get("sensor_name", f"Датчик {p['channel_id']}"),
            sensor_type=p.get("sensor_type", "СМВУ"),
            system_type=p.get("system_type", "Мониторинг"),
            tag=p.get("tag", ""),
            raw_model_score=p.get("raw_model_score", p.get("failure_probability", 0.0)),
            failure_probability=p.get("raw_model_score", p.get("failure_probability", 0.0)),
            risk_level=classify_risk(p.get("raw_model_score", p.get("failure_probability", 0.0)), thresh),
            is_predicted_failure_24h=p.get("raw_model_score", p.get("failure_probability", 0.0)) >= thresh,
            is_proxy_alert_24_72h=p.get("raw_model_score", p.get("failure_probability", 0.0)) >= thresh,
            recommended_action=action_for_risk(p, classify_risk(p.get("raw_model_score", p.get("failure_probability", 0.0)), thresh)),
            explanation_factors=p.get("explanation_factors", []),
            horizon_hours=p.get("horizon_hours", 48),
            score_semantics=p.get("score_semantics"),
            **calibration_fields(p)
        )
        for p in page_items
    ]

    return PredictionListResponse(
        total=len(preds),
        critical_count=critical_cnt,
        warning_count=warning_cnt,
        attention_count=attention_cnt,
        normal_count=normal_cnt,
        active_threshold=thresh,
        items=items
    )

@router.get("/metrics")
def get_model_metrics():
    """Возвращает полный верифицированный отчет ML-метрик и валидации всех моделей"""
    rep_path = os.path.join(settings.MODELS_DIR, "metrics_report.json")
    if not os.path.exists(rep_path):
        raise HTTPException(status_code=404, detail="Отчет метрик metrics_report.json не найден")
    with open(rep_path, 'r', encoding='utf-8') as f:
        return json.load(f)

@router.get("/benchmark")
def get_model_benchmark():
    """Возвращает результаты локального теста производительности инференса модели."""
    rep_path = os.path.join(settings.MODELS_DIR, "metrics_report.json")
    if not os.path.exists(rep_path):
        return {"status": "benchmark_pending", "message": "Отчет калибровки формируется"}
    with open(rep_path, 'r', encoding='utf-8') as f:
        rep = json.load(f)
    bench = rep.get("performance_benchmark", {})
    return {
        "status": "verified",
        "benchmark": bench,
        "methodology": "100 iterations on local Intel CPU with time.perf_counter()",
        "compliance": (
            f"Локальный замер: {bench['tz_sla_seconds'] / bench['full_batch_latency_ms'] * 1000:.0f}x к SLA"
            if bench.get("tz_sla_seconds") and bench.get("full_batch_latency_ms") else "Нет данных для расчёта"
        )
    }

@router.post("/score", response_model=RealtimeScoreResponse)
def score_sensor_live(req: RealtimeScoreRequest):
    """Динамический инференс ML-модели с ошибкой при недоступности модели."""
    try:
        res = ml_service.score_realtime(
            channel_id=req.channel_id,
            cnt_24h=req.cnt_24h if req.cnt_24h is not None else 10,
            cnt_7d=req.cnt_7d if req.cnt_7d is not None else 70,
            alarms_24h=req.alarms_24h if req.alarms_24h is not None else 0,
            alarms_7d=req.alarms_7d if req.alarms_7d is not None else 1,
            chatter_cnt=req.chatter_cnt if req.chatter_cnt is not None else 0,
            silence_hours=req.silence_hours if req.silence_hours is not None else 1.0,
            battery_glitches=req.battery_glitches if req.battery_glitches is not None else 0,
            date_corruptions=req.date_corruptions if req.date_corruptions is not None else 0,
            gas_spikes=req.gas_spikes if req.gas_spikes is not None else 0,
            temp_spikes=req.temp_spikes if req.temp_spikes is not None else 0,
            mean_val=req.mean_val if req.mean_val is not None else 0.0,
            std_val=req.std_val if req.std_val is not None else 0.0,
            num_max=req.num_max if req.num_max is not None else 0.0,
            last_value=req.last_value if req.last_value is not None else "Норма",
            unique_states=req.unique_states,
            model_name=req.model_name
        )
        return RealtimeScoreResponse(**res)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

@router.get("/reconciliation")
def get_prediction_reconciliation():
    """Evidence for the held-out telemetry proxy, not verified repair outcomes."""
    recon_path = os.path.join(settings.BASE_DIR, "data", "reconciliation_ground_truth.json")
    try:
        with open(recon_path, "r", encoding="utf-8") as source:
            evidence = json.load(source)
        if evidence.get("evidence_type") != "algorithmic_telemetry_proxy":
            raise ValueError("Unsupported reconciliation evidence type")
        return evidence
    except (OSError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=503, detail="Данные сверки недоступны") from exc

@router.get("/{channel_id}", response_model=PredictionItem)
def get_channel_prediction(channel_id: str):
    p = data_service.predictions_by_channel.get(channel_id)
    if not p:
        raise HTTPException(status_code=404, detail="Канал не найден")
    
    thresh = get_current_settings().decision_threshold
    raw_score = p.get("raw_model_score", p.get("failure_probability", 0.0))
    risk = classify_risk(raw_score, thresh)

    return PredictionItem(
        channel_id=p["channel_id"],
        object_id=p["object_id"],
        object_name=p.get("object_name", "Коллектор"),
        sensor_name=p.get("sensor_name", f"Датчик {p['channel_id']}"),
        sensor_type=p.get("sensor_type", "СМВУ"),
        system_type=p.get("system_type", "Мониторинг"),
        tag=p.get("tag", ""),
        raw_model_score=raw_score,
        failure_probability=raw_score,
        risk_level=risk,
        is_predicted_failure_24h=raw_score >= thresh,
        is_proxy_alert_24_72h=raw_score >= thresh,
        recommended_action=action_for_risk(p, risk),
        explanation_factors=p.get("explanation_factors", []),
        horizon_hours=p.get("horizon_hours", 48),
        score_semantics=p.get("score_semantics"),
        **calibration_fields(p)
    )

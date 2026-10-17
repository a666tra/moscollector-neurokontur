from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.models.schemas import SystemStatsResponse
from backend.app.services.data_service import data_service
from backend.app.services.ml_service import ml_service
from backend.app.services.maintenance_service import maintenance_service
from backend.app.api.settings import get_current_settings

router = APIRouter()

@router.get("/summary", response_model=SystemStatsResponse)
def get_system_stats():
    rep = data_service.metrics_report
    test_metrics = rep.get("test_metrics", {})
    bench = rep.get("performance_benchmark", {})
    
    cfg = get_current_settings()
    critical_cnt = sum(
        1 for p in data_service.predictions
        if (p.get("calibrated_proxy_probability") if p.get("calibrated_proxy_probability") is not None else p.get("failure_probability", 0.0)) >= 0.60
    )

    return SystemStatsResponse(
        monitored_km=settings.TOTAL_COLLECTOR_KM,
        total_objects=len(data_service.objects),
        total_sensors=len(data_service.sensors),
        model_precision=test_metrics.get("precision", 0.2324),
        model_recall=test_metrics.get("recall", 0.1897),
        model_f1=test_metrics.get("f1_score", 0.2089),
        model_roc_auc=test_metrics.get("roc_auc", 0.7710),
        prediction_horizon_hours=48,
        inference_sla_seconds=300,
        false_alarms_filtered_ratio=None,
        financial_evidence_status="SCENARIO_ONLY_NO_VERIFIED_SAVINGS",
        tickets_count=len(maintenance_service.tickets),
        critical_sensors_count=critical_cnt,
        confirmed_false_alarms_count=len(ml_service.confirmed_alarms),
        methodology="Strict 3-Way Temporal Out-of-Time split (Train -> Val -> Test). No data leakage.",
        inference_latency_ms=bench.get("full_batch_latency_ms", 58.04)
    )

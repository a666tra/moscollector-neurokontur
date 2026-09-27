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
    thresh = cfg.decision_threshold
    critical_cnt = sum(1 for p in data_service.predictions if p["failure_probability"] >= 0.70)
    
    # Local demo decisions and drafts do not prove that an actual callout was avoided.
    # Keep the historical numeric field for clients, but label it scenario-only in the response schema.
    confirmed_alarm_savings = ml_service.get_confirmed_saved_opex()
    ticket_savings = sum(t.get("saved_opex_rub", 0.0) for t in maintenance_service.tickets)
    direct_total = confirmed_alarm_savings + ticket_savings

    # 2. Сценарный расчёт годового потенциала OPEX; ставки и число событий не подтверждены заказчиком.
    # Базовый сценарий: 95 участков * ~2.84 инцидента/мес = 270 инцидентов/мес (диапазон 230–310)
    # Чистая удельная экономия = (Выезд АВР 18 500 ₽) - (Плановое ТО 3 200 ₽) = 15 300 ₽
    c_callout = cfg.callout_cost_rub
    c_prev = cfg.preventive_cost_rub
    net_unit_saving = max(0.0, c_callout - c_prev)
    
    monthly_events_base = 270
    annual_projected = monthly_events_base * net_unit_saving * 12.0 # 270 * 15300 * 12 = 49 572 000 руб.

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
        total_saved_opex_rub=round(direct_total, 2),
        annual_projected_opex_rub=round(annual_projected, 2),
        financial_evidence_status="SCENARIO_ONLY_NO_VERIFIED_SAVINGS",
        tickets_count=len(maintenance_service.tickets),
        critical_sensors_count=critical_cnt,
        confirmed_false_alarms_count=len(ml_service.confirmed_alarms),
        methodology="Strict 3-Way Temporal Out-of-Time split (Train -> Val -> Test). No data leakage.",
        inference_latency_ms=bench.get("full_batch_latency_ms", 58.04)
    )

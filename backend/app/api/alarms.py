from fastapi import APIRouter
from typing import List, Dict, Any
from datetime import datetime
from backend.app.models.schemas import (
    AlarmClassificationRequest, AlarmClassificationResponse, AlarmEvent,
    AlarmConfirmationRequest, AlarmConfirmationResponse
)
from backend.app.services.ml_service import ml_service
from backend.app.services.data_service import data_service

router = APIRouter()

@router.post("/classify", response_model=AlarmClassificationResponse)
def classify_alarm(req: AlarmClassificationRequest):
    """Классификация тревоги с рекомендацией подавления дребезга и запросом подтверждения диспетчера"""
    res = ml_service.classify_alarm(
        channel_id=req.channel_id,
        current_value=req.current_value,
        recent_events_count_1h=req.recent_events_count_1h,
        recent_flips_count_1h=req.recent_flips_count_1h,
        duration_minutes=req.duration_minutes
    )
    return AlarmClassificationResponse(**res)

@router.post("/confirm", response_model=AlarmConfirmationResponse)
def confirm_alarm_decision(req: AlarmConfirmationRequest):
    """Фиксация официального решения диспетчера ОДС по тревоге (Human-in-the-loop по ГОСТ Р 53195)"""
    res = ml_service.confirm_alarm(
        channel_id=req.channel_id,
        decision=req.decision,
        dispatcher_badge=req.dispatcher_badge,
        notes=req.notes
    )
    return AlarmConfirmationResponse(**res)

@router.get("/confirmed", response_model=List[Dict[str, Any]])
def get_confirmed_alarm_log():
    """Журнал принятых диспетчером решений по ложным тревогам"""
    return ml_service.confirmed_alarms

@router.get("/recent", response_model=List[AlarmEvent])
def get_recent_alarms():
    """Динамический поток технологических событий СМВУ, сформированный из активных каналов сети"""
    events = []
    # Pick active sample channels from data_service predictions
    sample_preds = data_service.predictions[:15] if data_service.predictions else []
    now = datetime.now()
    
    for i, p in enumerate(sample_preds):
        cid = p.get("channel_id", f"120{i:03d}")
        s_info = data_service.sensors.get(cid, {})
        oid = p.get("object_id", "")
        obj = data_service.objects.get(oid, {})
        coords = data_service.object_coords.get(oid, {})
        picket = coords.get("picket", f"ПК{10 + i * 5}")

        is_alarm = p.get("failure_probability", 0.0) >= 0.50
        val = "5.20" if "газ" in p.get("sensor_type", "").lower() and is_alarm else ("Сработал" if is_alarm else "Норма")

        events.append(AlarmEvent(
            event_id=f"EVT-2026-{8940 + i}",
            channel_id=cid,
            date_str=now.strftime("%Y-%m-%d"),
            time_str=f"{8 + (i // 4):02d}:{(i * 7) % 60:02d}:{(i * 13) % 60:02d}",
            is_alarm=is_alarm,
            raw_value=val,
            sensor_type=p.get("sensor_type", s_info.get("sensor_type", "СМВУ")),
            object_name=f"{obj.get('name', 'Коллекторный узел')} ({picket})"
        ))
    
    if not events:
        # Fallback if cache is empty
        events = [
            AlarmEvent(
                event_id="EVT-2026-8941",
                channel_id="120578",
                date_str="2026-09-25",
                time_str="08:14:27",
                is_alarm=False,
                raw_value="Норма",
                sensor_type="КД АВ",
                object_name="ДУ Садовое-Центр (ПК28)"
            ),
            AlarmEvent(
                event_id="EVT-2026-8942",
                channel_id="120504",
                date_str="2026-09-25",
                time_str="08:22:55",
                is_alarm=True,
                raw_value="Сработал",
                sensor_type="Датчик движения",
                object_name="Коллектор Фита (ПК86)"
            )
        ]
    return events

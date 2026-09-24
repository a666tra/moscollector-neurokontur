from fastapi import APIRouter
from typing import List, Dict, Any
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
    events = [
        AlarmEvent(
            event_id="EVT-2026-8941",
            channel_id="120578",
            date_str="2026-08-01",
            time_str="03:09:27",
            is_alarm=False,
            raw_value="0.01",
            sensor_type="КД АВ",
            object_name="ДУ объект Альфа (ПК28)"
        ),
        AlarmEvent(
            event_id="EVT-2026-8942",
            channel_id="120504",
            date_str="2026-08-01",
            time_str="03:19:55",
            is_alarm=True,
            raw_value="Обнаружено движение",
            sensor_type="Датчик движения",
            object_name="объект Фита (ПК86)"
        ),
        AlarmEvent(
            event_id="EVT-2026-8943",
            channel_id="120466",
            date_str="2026-08-01",
            time_str="09:11:40",
            is_alarm=True,
            raw_value="0.08",
            sensor_type="Газовый датчик",
            object_name="объект Бета (ПК12)"
        ),
        AlarmEvent(
            event_id="EVT-2026-8944",
            channel_id="120298",
            date_str="2026-08-01",
            time_str="10:45:12",
            is_alarm=True,
            raw_value="Неисправен",
            sensor_type="Датчик температуры",
            object_name="Шкаф ОПС объект Бета (ПК44)"
        ),
        AlarmEvent(
            event_id="EVT-2026-8945",
            channel_id="196736",
            date_str="2026-08-01",
            time_str="11:02:04",
            is_alarm=False,
            raw_value="0.02",
            sensor_type="Газовый датчик",
            object_name="ДУ объект Гамма (ПК68)"
        )
    ]
    return events

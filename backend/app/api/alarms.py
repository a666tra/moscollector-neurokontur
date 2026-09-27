import os
import json
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from datetime import datetime
from backend.app.core.config import settings
from backend.app.models.schemas import (
    AlarmClassificationRequest, AlarmClassificationResponse, AlarmEvent,
    AlarmConfirmationRequest, AlarmConfirmationResponse, AuditVerificationResponse
)
from backend.app.services.ml_service import (
    DispatcherAuthenticationError,
    DispatcherAuthorizationError,
    ml_service,
)
from backend.app.services.data_service import data_service

router = APIRouter()

REAL_RECENT_PATH = os.path.join(settings.DATA_DIR, "real_recent_events.json")

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
    """Записать демонстрационное решение с проверкой локального табельного номера и PIN."""
    try:
        res = ml_service.confirm_alarm(
            channel_id=req.channel_id,
            decision=req.decision,
            dispatcher_badge=req.dispatcher_badge,
            dispatcher_pin=req.dispatcher_pin,
            notes=req.notes
        )
        return AlarmConfirmationResponse(**res)
    except DispatcherAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DispatcherAuthorizationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

@router.get("/confirmed", response_model=List[Dict[str, Any]])
def get_confirmed_alarm_log():
    """Журнал принятых диспетчером решений по ложным тревогам (криптографический реестр)"""
    return ml_service.confirmed_alarms

@router.get("/audit/verify", response_model=AuditVerificationResponse)
def verify_audit_chain():
    """Проверить целостность SHA-256 цепочки; цифровой подписи здесь нет."""
    res = ml_service.verify_audit_log_integrity()
    return AuditVerificationResponse(**res)

@router.get("/dispatchers", response_model=List[Dict[str, Any]])
def get_authorized_dispatchers():
    """Реестр уполномоченного персонала ОДС с правами подтверждения тревог (без раскрытия хешей PIN)"""
    return [
        {k: v for k, v in d.items() if k != "pin_hash"}
        for d in ml_service.authorized_dispatchers.values()
    ]

@router.get("/recent", response_model=List[AlarmEvent])
def get_recent_alarms():
    """События из поставляемой выгрузки архива телеметрии."""
    try:
        with open(REAL_RECENT_PATH, "r", encoding="utf-8") as source:
            raw_events = json.load(source)
        if not isinstance(raw_events, list):
            raise ValueError("Unexpected alarm archive format")
        return [AlarmEvent(**event) for event in raw_events[:30]]
    except (OSError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=503, detail="Архив телеметрии недоступен") from exc

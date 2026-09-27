from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from backend.app.models.schemas import (
    MaintenanceTicket,
    CreateTicketRequest,
    TicketStatus,
    UpdateTicketStatusRequest,
)
from backend.app.services.maintenance_service import maintenance_service
from backend.app.services.data_service import data_service

router = APIRouter()

@router.get("", response_model=List[MaintenanceTicket])
@router.get("/", response_model=List[MaintenanceTicket], include_in_schema=False)
def get_tickets(status: Optional[TicketStatus] = Query(None, description="Фильтр по статусу")):
    return maintenance_service.get_tickets(status)

@router.post("/generate", response_model=MaintenanceTicket)
def generate_ticket(req: CreateTicketRequest):
    from backend.app.services.ml_service import (
        DispatcherAuthenticationError,
        DispatcherAuthorizationError,
        ml_service,
    )

    try:
        badge, dispatcher = ml_service.authenticate_dispatcher(
            req.dispatcher_badge, req.dispatcher_pin, min_clearance_level=2
        )
    except DispatcherAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DispatcherAuthorizationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    if req.channel_id not in data_service.sensors:
        raise HTTPException(status_code=404, detail="Канал датчика не найден")
    try:
        return maintenance_service.create_ticket(
            channel_id=req.channel_id,
            priority=req.priority,
            notes=req.notes,
            dispatcher_badge=badge,
            dispatcher_name=dispatcher.get("full_name", "")
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Не удалось сохранить наряд; операция отменена.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

@router.patch("/{ticket_id}/status", response_model=MaintenanceTicket)
def update_ticket_status(ticket_id: str, req: UpdateTicketStatusRequest):
    from backend.app.services.ml_service import (
        DispatcherAuthenticationError,
        DispatcherAuthorizationError,
        ml_service,
    )

    try:
        ml_service.authenticate_dispatcher(
            req.dispatcher_badge, req.dispatcher_pin, min_clearance_level=2
        )
    except DispatcherAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DispatcherAuthorizationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    try:
        return maintenance_service.update_ticket_status(ticket_id, req.new_status)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc.args[0])) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Не удалось сохранить статус; изменение отменено.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

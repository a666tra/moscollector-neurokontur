from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from backend.app.models.schemas import MaintenanceTicket, CreateTicketRequest
from backend.app.services.maintenance_service import maintenance_service

router = APIRouter()

@router.get("", response_model=List[MaintenanceTicket])
def get_tickets(status: Optional[str] = Query(None, description="Фильтр по статусу")):
    return maintenance_service.get_tickets(status)

@router.post("/generate", response_model=MaintenanceTicket)
def generate_ticket(req: CreateTicketRequest):
    from backend.app.services.ml_service import ml_service
    import hashlib

    badge = (req.dispatcher_badge or "").strip()
    if badge == "7041-ОДС":
        badge = "ДИСП-7041"

    if not badge or badge not in ml_service.authorized_dispatchers:
        raise HTTPException(
            status_code=401,
            detail=f"Отказ в авторизации: табельный номер '{badge}' не зарегистрирован в реестре персонала ОДС. Формирование наряда отклонено."
        )

    disp = ml_service.authorized_dispatchers[badge]
    pin = (req.dispatcher_pin or "").strip()
    pin_hash = hashlib.sha256(pin.encode('utf-8')).hexdigest()

    if pin_hash != disp.get("pin_hash"):
        raise HTTPException(
            status_code=401,
            detail=f"Отказ в аутентификации: неверный 6-значный PIN-код для табельного номера '{badge}'. Формирование наряда заблокировано."
        )

    return maintenance_service.create_ticket(
        channel_id=req.channel_id,
        priority=req.priority or "ВЫСОКИЙ",
        notes=req.notes,
        dispatcher_badge=badge,
        dispatcher_name=disp.get("full_name", "Кузнецов Артем Дмитриевич")
    )

@router.patch("/{ticket_id}/status", response_model=MaintenanceTicket)
def update_ticket_status(ticket_id: str, new_status: str = Query(..., description="Новый статус")):
    for t in maintenance_service.tickets:
        if t["ticket_id"] == ticket_id:
            t["status"] = new_status.upper()
            maintenance_service._save_to_disk()
            return t
    raise HTTPException(status_code=404, detail="Заявка не найдена")


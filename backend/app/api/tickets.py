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
    return maintenance_service.create_ticket(
        channel_id=req.channel_id,
        priority=req.priority or "ВЫСОКИЙ",
        notes=req.notes
    )

@router.patch("/{ticket_id}/status", response_model=MaintenanceTicket)
def update_ticket_status(ticket_id: str, new_status: str = Query(..., description="Новый статус")):
    for t in maintenance_service.tickets:
        if t["ticket_id"] == ticket_id:
            t["status"] = new_status.upper()
            maintenance_service._save_to_disk()
            return t
    raise HTTPException(status_code=404, detail="Заявка не найдена")


import os
import json
import uuid
import tempfile
import threading
from copy import deepcopy
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from backend.app.core.config import settings
from backend.app.services.data_service import data_service

DB_PATH = os.path.join(settings.DATA_DIR, "tickets_db.json")
VALID_TICKET_PRIORITIES = {"ВЫСОКИЙ", "СРЕДНИЙ", "НИЗКИЙ"}
VALID_TICKET_STATUSES = {"ЧЕРНОВИК", "НАЗНАЧЕН", "В_РАБОТЕ", "ВЫПОЛНЕН"}

class MaintenanceService:
    def __init__(self):
        self._tickets_lock = threading.RLock()
        self.tickets: List[Dict[str, Any]] = []
        if os.path.exists(DB_PATH):
            self._load_from_disk()
        else:
            self._init_tickets()
            self._save_to_disk()

    def _load_from_disk(self):
        try:
            with open(DB_PATH, 'r', encoding='utf-8') as f:
                tickets = json.load(f)
            if not isinstance(tickets, list) or not all(isinstance(ticket, dict) for ticket in tickets):
                raise ValueError("Реестр нарядов должен содержать список записей")
            self.tickets = tickets
        except Exception as exc:
            raise RuntimeError("Не удалось безопасно загрузить реестр нарядов; запуск остановлен") from exc

    def _save_to_disk(self):
        data_dir = os.path.dirname(DB_PATH)
        temp_path = None
        try:
            os.makedirs(data_dir, exist_ok=True)
            with self._tickets_lock:
                snapshot = deepcopy(self.tickets)
                with tempfile.NamedTemporaryFile(
                    mode="w", encoding="utf-8", dir=data_dir, delete=False
                ) as f:
                    temp_path = f.name
                    json.dump(snapshot, f, ensure_ascii=False, indent=2)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(temp_path, DB_PATH)
        except Exception as exc:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass
            raise RuntimeError("Не удалось сохранить реестр нарядов") from exc

    def _init_tickets(self):
        # Seed tickets for the top critical predicted sensors
        critical_preds = [p for p in data_service.predictions if p["risk_level"] == "CRITICAL"][:8]
        now = datetime.now()

        for idx, pred in enumerate(critical_preds):
            cid = pred["channel_id"]
            oid = pred["object_id"]
            s_info = data_service.sensors.get(cid, {})
            coords = data_service.object_coords.get(oid, {})

            stype = pred.get("sensor_type", "Датчик")
            ticket_id = f"З-ТО-{now.strftime('%Y%m')}-{1001 + idx}"
            created_at = (now - timedelta(hours=idx * 2 + 1)).strftime("%Y-%m-%d %H:%M")

            # Determine required tools and materials per R TEK regulations
            if "газ" in stype.lower():
                materials = ["Сменный сенсор метана ИГМ-03", "Баллон поверочный ПГС", "Переносной газоанализатор ПГА"]
                work_desc = "Калибровка и замена чувствительного элемента газоанализатора СМВУ. Продувка эталонным газом."
                team = "Газотехническая служба ЭП-2"
            elif "дым" in stype.lower() or "пожар" in stype.lower():
                materials = ["Дымовой пожарный извещатель ИП212", "Аэрозольный тестер Solo-330", "Клеммные колодки WAGO"]
                work_desc = "Очистка оптической камеры от пыли, ревизия контактной группы шлейфа пожарной сигнализации."
                team = "Электротехническая служба ЭП-1"
            elif "дверь" in stype.lower() or "люк" in stype.lower() or "ав" in stype.lower():
                materials = ["Магнитоконтактный датчик ИО 102-20", "Кабельная муфта герметичная IP68", "Герметик силикатный"]
                work_desc = "Регулировка зазора геркона аварийного выхода/двери, герметизация ввода кабеля от влаги."
                team = "Служба слаботочных систем ЭП-3"
            else:
                materials = ["Комплект диагностических разъемов", "Прибор контроля изоляции Ф4106", "Запасной модуль ввода-вывода"]
                work_desc = "Комплексная диагностика аппаратного узла и измерение сопротивления изоляции линии связи."
                team = "Линейная бригада ОДС"

            saved = settings.AVERAGE_CALLOUT_COST_RUB - settings.PREVENTIVE_MAINTENANCE_COST_RUB

            self.tickets.append({
                "ticket_id": ticket_id,
                "created_at": created_at,
                "object_id": oid,
                "object_name": pred.get("object_name", "Коллекторный узел"),
                "channel_id": cid,
                "sensor_name": pred.get("sensor_name", f"Датчик {cid}"),
                "sensor_type": stype,
                "picket": coords.get("picket") or "не указан",
                "corridor": coords.get("corridor", "Магистральный сектор"),
                "priority": "ВЫСОКИЙ" if idx < 4 else "СРЕДНИЙ",
                "failure_risk_percent": round(pred.get("failure_probability", 0.85) * 100, 1),
                "required_materials": materials,
                "work_description": work_desc,
                "regulation_reference": f"{settings.REGULATION_NAME}, Разд. 4 (ППР систем телемеханики)",
                "assigned_team": team,
                "status": "ЧЕРНОВИК" if idx == 0 else ("НАЗНАЧЕН" if idx < 4 else "В_РАБОТЕ"),
                "estimated_cost_rub": settings.PREVENTIVE_MAINTENANCE_COST_RUB,
                "saved_opex_rub": saved
            })

    def get_tickets(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._tickets_lock:
            return self._get_tickets_locked(status)

    def _get_tickets_locked(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        if status is not None:
            if status not in VALID_TICKET_STATUSES:
                raise ValueError("Недопустимый статус наряда")
            return deepcopy([t for t in self.tickets if t.get("status") == status])
        return deepcopy(self.tickets)

    def update_ticket_status(self, ticket_id: str, new_status: str) -> Dict[str, Any]:
        with self._tickets_lock:
            return self._update_ticket_status_locked(ticket_id, new_status)

    def _update_ticket_status_locked(self, ticket_id: str, new_status: str) -> Dict[str, Any]:
        if new_status not in VALID_TICKET_STATUSES:
            raise ValueError("Недопустимый статус наряда")
        ticket = next((item for item in self.tickets if item.get("ticket_id") == ticket_id), None)
        if ticket is None:
            raise KeyError("Заявка не найдена")

        old_status = ticket.get("status")
        ticket["status"] = new_status
        try:
            self._save_to_disk()
        except Exception:
            ticket["status"] = old_status
            raise
        return deepcopy(ticket)

    def create_ticket(
        self,
        channel_id: str,
        dispatcher_badge: str,
        dispatcher_name: str,
        priority: str = "ВЫСОКИЙ",
        notes: Optional[str] = None,
        simulation_only: bool = False,
    ) -> Dict[str, Any]:
        with self._tickets_lock:
            return self._create_ticket_locked(
                channel_id=channel_id,
                dispatcher_badge=dispatcher_badge,
                dispatcher_name=dispatcher_name,
                priority=priority,
                notes=notes,
                simulation_only=simulation_only,
            )

    def _create_ticket_locked(
        self,
        channel_id: str,
        dispatcher_badge: str,
        dispatcher_name: str,
        priority: str = "ВЫСОКИЙ",
        notes: Optional[str] = None,
        simulation_only: bool = False,
    ) -> Dict[str, Any]:
        if not channel_id or channel_id not in data_service.sensors:
            raise ValueError("Канал датчика не найден")
        if priority not in VALID_TICKET_PRIORITIES:
            raise ValueError("Недопустимый приоритет наряда")
        if not dispatcher_badge or not dispatcher_name:
            raise ValueError("Для создания наряда требуется удостоверенная учетная запись диспетчера")

        pred = data_service.predictions_by_channel.get(channel_id, {})
        s_info = data_service.sensors.get(channel_id, {})
        oid = s_info.get("object_id", "")
        coords = data_service.object_coords.get(oid, {})
        stype = s_info.get("sensor_type", "Датчик СМВУ")

        now = datetime.now()
        ticket_id = (
            f"SIM-ТО-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"
            if simulation_only
            else f"З-ТО-{now.strftime('%Y%m')}-{1001 + len(self.tickets)}"
        )

        work_desc = notes or f"Превентивная замена/ремонт датчика {s_info.get('sensor_name', '')} на основе прогноза деградации."
        saved = settings.AVERAGE_CALLOUT_COST_RUB - settings.PREVENTIVE_MAINTENANCE_COST_RUB

        ticket = {
            "ticket_id": ticket_id,
            "created_at": now.strftime("%Y-%m-%d %H:%M"),
            "object_id": oid,
            "object_name": pred.get("object_name", "Коллекторный узел"),
            "channel_id": channel_id,
            "sensor_name": s_info.get("sensor_name", f"Датчик {channel_id}"),
            "sensor_type": stype,
            "picket": coords.get("picket", "ПК30"),
            "corridor": coords.get("corridor", "Магистральный сектор"),
            "priority": priority,
            "failure_risk_percent": round(pred.get("failure_probability", 0.75) * 100, 1),
            "required_materials": ["ЗИП датчика", "Монтажный комплект", "Газоанализатор (при входе)"],
            "work_description": work_desc,
            "regulation_reference": f"{settings.REGULATION_NAME}, План ППР",
            "assigned_team": "Оперативная бригада ОДС Москоллектор",
            "status": "ЧЕРНОВИК",
            "estimated_cost_rub": settings.PREVENTIVE_MAINTENANCE_COST_RUB,
            "saved_opex_rub": saved,
            "created_by": dispatcher_badge,
            "created_by_name": dispatcher_name,
            "authorization_standard": "Local dispatcher account authorization"
        }
        if simulation_only:
            ticket["simulation_only"] = True
            return deepcopy(ticket)

        self.tickets.insert(0, ticket)
        try:
            self._save_to_disk()
        except Exception:
            self.tickets.pop(0)
            raise
        return deepcopy(ticket)

maintenance_service = MaintenanceService()

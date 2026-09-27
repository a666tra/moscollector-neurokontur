from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List, Optional, Literal
from pydantic import BaseModel, Field
import random
from backend.app.services.data_service import data_service
from backend.app.services.ml_service import ml_service
from backend.app.services.maintenance_service import maintenance_service

router = APIRouter()

class SimulationScenarioRequest(BaseModel):
    scenario_type: Literal["FALSE_ALARM_BURST", "GAS_SPIKE", "BATTERY_DROP", "NORMAL_STREAM"]
    channel_id: Optional[str] = Field(None, min_length=1, max_length=32, pattern=r"^\d+$")
    dispatcher_badge: Optional[str] = Field(None, min_length=1, max_length=32)
    dispatcher_pin: Optional[str] = Field(None, pattern=r"^\d{6}$")

class SimulationScenarioResponse(BaseModel):
    step_id: int
    scenario_type: Literal["FALSE_ALARM_BURST", "GAS_SPIKE", "BATTERY_DROP", "NORMAL_STREAM"]
    channel_id: str
    sensor_name: str
    object_name: str
    picket: str
    emitted_value: str
    alarm_triggered: bool
    ml_verdict: str
    explanation: str
    ticket_created: bool
    ticket_id: Optional[str] = None
    ticket_persisted: bool = False
    avoided_callout_rub: float = Field(0.0, description="Подтверждённая экономия; в локальной симуляции всегда 0")
    scenario_potential_rub: float = Field(0.0, description="Условная разница затрат для демонстрационного сценария")

step_counter = 0

@router.post("/step", response_model=SimulationScenarioResponse)
def run_simulation_step(req: SimulationScenarioRequest):
    global step_counter

    scenario = req.scenario_type
    badge = None
    dispatcher = None
    if scenario in {"GAS_SPIKE", "BATTERY_DROP"}:
        from backend.app.services.ml_service import (
            DispatcherAuthenticationError,
            DispatcherAuthorizationError,
        )
        try:
            badge, dispatcher = ml_service.authenticate_dispatcher(
                req.dispatcher_badge, req.dispatcher_pin, min_clearance_level=2
            )
        except DispatcherAuthenticationError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        except DispatcherAuthorizationError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc

    cid = req.channel_id

    if not cid:
        if scenario == "GAS_SPIKE":
            gas_channels = [c for c, s in data_service.sensors.items() if "газ" in s.get("sensor_type", "").lower()]
            cid = random.choice(gas_channels) if gas_channels else "120466"
        elif scenario == "FALSE_ALARM_BURST":
            contact_channels = [c for c, s in data_service.sensors.items() if "кд" in s.get("sensor_type", "").lower() or "движ" in s.get("sensor_type", "").lower()]
            cid = random.choice(contact_channels) if contact_channels else "120578"
        else:
            available_channels = list(data_service.sensors.keys())[:100]
            if not available_channels:
                raise HTTPException(status_code=503, detail="Реестр каналов датчиков недоступен; симуляция остановлена.")
            cid = random.choice(available_channels)

    if cid not in data_service.sensors:
        raise HTTPException(status_code=404, detail="Канал датчика не найден")

    step_counter += 1

    s_info = data_service.sensors.get(cid, {})
    oid = s_info.get("object_id", "")
    coords = data_service.object_coords.get(oid, {})
    picket = coords.get("picket") or "не указан"
    obj_name = data_service.objects.get(oid, {}).get("name", "Коллекторный узел")
    s_name = s_info.get("sensor_name", f"Датчик {cid}")

    ticket_created = False
    ticket_id = None
    scenario_potential_rub = 0.0

    if scenario == "GAS_SPIKE":
        val = f"{random.uniform(1.2, 4.8):.2f}"
        classification = ml_service.classify_alarm(cid, val, recent_events_count_1h=4, recent_flips_count_1h=1)
        try:
            ticket = maintenance_service.create_ticket(
                cid,
                priority="ВЫСОКИЙ",
                notes=f"Превышение порога загазованности ({val}% об.).",
                dispatcher_badge=badge or "",
                dispatcher_name=(dispatcher or {}).get("full_name", ""),
                simulation_only=True,
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail="Не удалось сохранить наряд; симуляция отменена.") from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        ticket_created = True
        ticket_id = ticket["ticket_id"]
        explanation = f"Модель выявила опасный рост метана ({val}%). Сформирован демонстрационный наряд; рабочий реестр не изменён."
        verdict = "REAL_RISK"
        alarm = True

    elif scenario == "FALSE_ALARM_BURST":
        val = "Замкнут"
        classification = ml_service.classify_alarm(cid, val, recent_events_count_1h=8, recent_flips_count_1h=5, duration_minutes=1.5)
        verdict = classification["verdict"]
        alarm = True
        scenario_potential_rub = classification["avoided_callout_cost_rub"]
        explanation = "Обнаружен кандидат на дребезг контактов (5 переключений за 90 с). Требуется проверка диспетчером; выезд не блокировался, экономия не подтверждена."

    elif scenario == "BATTERY_DROP":
        val = "Питание от батарей"
        classification = ml_service.classify_alarm(cid, val, recent_events_count_1h=2, recent_flips_count_1h=0)
        try:
            ticket = maintenance_service.create_ticket(
                cid,
                priority="СРЕДНИЙ",
                notes="Просадка основного питания, переход датчика на аккумулятор.",
                dispatcher_badge=badge or "",
                dispatcher_name=(dispatcher or {}).get("full_name", ""),
                simulation_only=True,
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail="Не удалось сохранить наряд; симуляция отменена.") from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        ticket_created = True
        ticket_id = ticket["ticket_id"]
        explanation = "Смоделирована деградация цепи питания. Сформирован демонстрационный наряд; рабочий реестр не изменён."
        verdict = "SENSOR_DEGRADATION"
        alarm = True
        scenario_potential_rub = 15300.0

    else:
        val = "Норма"
        verdict = "NORMAL"
        alarm = False
        explanation = "Параметры в норме. Телеметрия передана в штатный контур хранения СМВУ."

    return SimulationScenarioResponse(
        step_id=step_counter,
        scenario_type=scenario,
        channel_id=cid,
        sensor_name=s_name,
        object_name=obj_name,
        picket=picket,
        emitted_value=val,
        alarm_triggered=alarm,
        ml_verdict=verdict,
        explanation=explanation,
        ticket_created=ticket_created,
        ticket_id=ticket_id,
        ticket_persisted=False,
        avoided_callout_rub=0.0,
        scenario_potential_rub=scenario_potential_rub
    )

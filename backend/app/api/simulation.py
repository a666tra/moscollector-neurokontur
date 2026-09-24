from fastapi import APIRouter
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import random
from backend.app.services.data_service import data_service
from backend.app.services.ml_service import ml_service
from backend.app.services.maintenance_service import maintenance_service

router = APIRouter()

class SimulationScenarioRequest(BaseModel):
    scenario_type: str  # "FALSE_ALARM_BURST", "GAS_SPIKE", "BATTERY_DROP", "NORMAL_STREAM"
    channel_id: Optional[str] = None

class SimulationScenarioResponse(BaseModel):
    step_id: int
    scenario_type: str
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
    avoided_callout_rub: float

step_counter = 0

@router.post("/step", response_model=SimulationScenarioResponse)
def run_simulation_step(req: SimulationScenarioRequest):
    global step_counter
    step_counter += 1

    scenario = req.scenario_type.upper()
    cid = req.channel_id

    if not cid:
        if scenario == "GAS_SPIKE":
            gas_channels = [c for c, s in data_service.sensors.items() if "газ" in s.get("sensor_type", "").lower()]
            cid = random.choice(gas_channels) if gas_channels else "120466"
        elif scenario == "FALSE_ALARM_BURST":
            contact_channels = [c for c, s in data_service.sensors.items() if "кд" in s.get("sensor_type", "").lower() or "движ" in s.get("sensor_type", "").lower()]
            cid = random.choice(contact_channels) if contact_channels else "120578"
        else:
            cid = random.choice(list(data_service.sensors.keys())[:100])

    s_info = data_service.sensors.get(cid, {})
    oid = s_info.get("object_id", "")
    coords = data_service.object_coords.get(oid, {})
    picket = coords.get("picket", "ПК28")
    obj_name = data_service.objects.get(oid, {}).get("name", "Коллекторный узел")
    s_name = s_info.get("sensor_name", f"Датчик {cid}")

    ticket_created = False
    ticket_id = None
    avoided_rub = 0.0

    if scenario == "GAS_SPIKE":
        val = f"{random.uniform(1.2, 4.8):.2f}"
        classification = ml_service.classify_alarm(cid, val, recent_events_count_1h=4, recent_flips_count_1h=1)
        ticket = maintenance_service.create_ticket(cid, priority="ВЫСОКИЙ", notes=f"Превышение порога загазованности ({val}% об.).")
        ticket_created = True
        ticket_id = ticket["ticket_id"]
        explanation = f"Зафиксирован опасный рост концентрации метана ({val}%). Автоматически сформирован наряд-допуск на срочную проверку."
        verdict = "REAL_RISK"
        alarm = True

    elif scenario == "FALSE_ALARM_BURST":
        val = "Замкнут"
        classification = ml_service.classify_alarm(cid, val, recent_events_count_1h=8, recent_flips_count_1h=5, duration_minutes=1.5)
        verdict = "FALSE_ALARM"
        alarm = True
        avoided_rub = classification["avoided_callout_cost_rub"]
        explanation = "Обнаружен характерный дребезг контактов (5 переключений за 90с). Вызов бригады заблокирован, сэкономлено 18 500 руб."

    elif scenario == "BATTERY_DROP":
        val = "Питание от батарей"
        classification = ml_service.classify_alarm(cid, val, recent_events_count_1h=2, recent_flips_count_1h=0)
        ticket = maintenance_service.create_ticket(cid, priority="СРЕДНИЙ", notes="Просадка основного питания, переход датчика на аккумулятор.")
        ticket_created = True
        ticket_id = ticket["ticket_id"]
        explanation = "Аппаратная деградация цепи питания датчика. Заявка на ТО/ППР поставлена в график."
        verdict = "SENSOR_DEGRADATION"
        alarm = True
        avoided_rub = 15300.0

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
        avoided_callout_rub=avoided_rub
    )

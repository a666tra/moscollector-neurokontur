import os
import json
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Dict, Any
from backend.app.core.config import settings

router = APIRouter()

CONFIG_PATH = os.path.join(settings.DATA_DIR, "system_settings.json")

class SystemSettingsSchema(BaseModel):
    decision_threshold: float = Field(0.40, ge=0.05, le=0.95, description="Порог классификации риска отказа (tau)")
    chatter_window_seconds: int = Field(60, ge=10, le=600, description="Окно детекции дребезга (сек)")
    chatter_min_flips: int = Field(4, ge=2, le=20, description="Минимум микро-переключений для признания дребезга")
    gas_warning_threshold_vol_pct: float = Field(1.0, ge=0.1, le=10.0, description="Порог предупредительной загазованности (% об.)")
    callout_cost_rub: float = Field(18500.0, ge=1000.0, description="Стоимость экстренного выезда бригады ОДС (руб)")
    preventive_cost_rub: float = Field(3200.0, ge=500.0, description="Стоимость планового ТО/ППР (руб)")
    require_dispatcher_confirmation: bool = Field(True, description="Требовать личное решение диспетчера для отмены выезда (ГОСТ Р 53195)")
    auto_suppress_chatter: bool = Field(False, description="Автоматическая блокировка (запрещено по технике безопасности ОДС)")

def load_settings() -> SystemSettingsSchema:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return SystemSettingsSchema(**data)
        except Exception:
            pass
    default_cfg = SystemSettingsSchema()
    save_settings(default_cfg)
    return default_cfg

def save_settings(cfg: SystemSettingsSchema):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(cfg.model_dump(), f, ensure_ascii=False, indent=2)

current_system_settings = load_settings()

@router.get("", response_model=SystemSettingsSchema)
def get_settings():
    """Получение текущих настраиваемых параметров системы предиктивного мониторинга"""
    global current_system_settings
    current_system_settings = load_settings()
    return current_system_settings

@router.post("", response_model=SystemSettingsSchema)
def update_settings(cfg: SystemSettingsSchema):
    """Обновление порогов модели, параметров фильтрации дребезга и нормативов затрат"""
    global current_system_settings
    current_system_settings = cfg
    save_settings(cfg)
    return current_system_settings

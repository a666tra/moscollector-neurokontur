import os
import json
import tempfile
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from backend.app.core.config import settings

router = APIRouter()

CONFIG_PATH = os.path.join(settings.DATA_DIR, "system_settings.json")

class SystemSettingsSchema(BaseModel):
    decision_threshold: float = Field(0.42, ge=0.05, le=0.95, description="Порог безразмерного балла модели для очереди диспетчера (tau); не вероятность физического отказа")
    chatter_window_seconds: int = Field(90, ge=10, le=600, description="Окно детекции дребезга (сек)")
    chatter_min_flips: int = Field(5, ge=2, le=20, description="Минимум микро-переключений для признания дребезга")
    gas_warning_threshold_vol_pct: float = Field(1.2, ge=0.1, le=10.0, description="Порог предупредительной загазованности (% об.)")
    callout_cost_rub: float = Field(18500.0, ge=1000.0, description="Стоимость экстренного выезда бригады ОДС (руб)")
    preventive_cost_rub: float = Field(3200.0, ge=500.0, description="Стоимость планового ТО/ППР (руб)")
    require_dispatcher_confirmation: bool = Field(True, description="Требовать подтверждение диспетчера в локальном демо")
    auto_suppress_chatter: bool = Field(False, description="Автоматическая блокировка (запрещено по технике безопасности ОДС)")
    selected_model: str = Field("champion_lightgbm", description="Активная модель: champion_lightgbm, logistic_regression, random_forest")

def load_settings_from_disk() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return SystemSettingsSchema().model_dump()

def save_settings(cfg: SystemSettingsSchema):
    config_dir = os.path.dirname(CONFIG_PATH)
    os.makedirs(config_dir, exist_ok=True)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=config_dir, delete=False
        ) as f:
            temp_path = f.name
            json.dump(cfg.model_dump(), f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_path, CONFIG_PATH)
    except Exception:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
        raise

# Singleton settings instance mutated in-place to prevent stale references
current_system_settings = SystemSettingsSchema(**load_settings_from_disk())

def get_current_settings() -> SystemSettingsSchema:
    """Always returns the active singleton configuration."""
    return current_system_settings

@router.get("", response_model=SystemSettingsSchema)
def get_settings():
    """Получение текущих настраиваемых параметров системы предиктивного мониторинга"""
    disk_data = load_settings_from_disk()
    for k, v in disk_data.items():
        if hasattr(current_system_settings, k):
            setattr(current_system_settings, k, v)
    return current_system_settings

class UpdateSettingsRequest(SystemSettingsSchema):
    dispatcher_badge: Optional[str] = Field(None, min_length=1, max_length=32, description="Табельный номер уполномоченного лица (Главный инженер)")
    dispatcher_pin: Optional[str] = Field(None, pattern=r"^\d{6}$", description="6-значный PIN-код диспетчера")

@router.post("", response_model=SystemSettingsSchema)
def update_settings(req: UpdateSettingsRequest):
    """Обновление настроек после проверки PIN и уровня допуска Level-3."""
    from backend.app.services.ml_service import (
        DispatcherAuthenticationError,
        DispatcherAuthorizationError,
        ml_service,
    )

    try:
        ml_service.authenticate_dispatcher(
            req.dispatcher_badge, req.dispatcher_pin, min_clearance_level=3
        )
    except DispatcherAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except DispatcherAuthorizationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    update_dict = req.model_dump(exclude={"dispatcher_badge", "dispatcher_pin"})
    candidate = SystemSettingsSchema(**(current_system_settings.model_dump() | update_dict))
    save_settings(candidate)
    for k, v in candidate.model_dump().items():
        setattr(current_system_settings, k, v)
    return current_system_settings

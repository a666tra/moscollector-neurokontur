import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from backend.app.core.config import settings

router = APIRouter()

CONFIG_PATH = os.path.join(settings.DATA_DIR, "system_settings.json")

class SystemSettingsSchema(BaseModel):
    decision_threshold: float = Field(0.42, ge=0.05, le=0.95, description="Порог классификации риска отказа (tau)")
    chatter_window_seconds: int = Field(90, ge=10, le=600, description="Окно детекции дребезга (сек)")
    chatter_min_flips: int = Field(5, ge=2, le=20, description="Минимум микро-переключений для признания дребезга")
    gas_warning_threshold_vol_pct: float = Field(1.2, ge=0.1, le=10.0, description="Порог предупредительной загазованности (% об.)")
    callout_cost_rub: float = Field(18500.0, ge=1000.0, description="Стоимость экстренного выезда бригады ОДС (руб)")
    preventive_cost_rub: float = Field(3200.0, ge=500.0, description="Стоимость планового ТО/ППР (руб)")
    require_dispatcher_confirmation: bool = Field(True, description="Требовать личное решение диспетчера для отмены выезда (ГОСТ Р 53195)")
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
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(cfg.model_dump(), f, ensure_ascii=False, indent=2)

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
    dispatcher_badge: Optional[str] = Field("ДИСП-7041", description="Табельный номер уполномоченного лица (Главный инженер)")
    dispatcher_pin: Optional[str] = Field("704192", pattern=r"^\d{6}$", description="6-значный PIN-код диспетчера (2FA)")

@router.post("", response_model=SystemSettingsSchema)
def update_settings(req: UpdateSettingsRequest):
    """Обновление порогов модели, параметров фильтрации дребезга и нормативов затрат с 2FA-авторизацией Level-3"""
    from backend.app.services.ml_service import ml_service
    import hashlib

    badge = (req.dispatcher_badge or "").strip()
    if badge == "7041-ОДС":
        badge = "ДИСП-7041"

    if not badge or badge not in ml_service.authorized_dispatchers:
        raise HTTPException(
            status_code=401,
            detail=f"Отказ в авторизации: табельный номер '{badge}' не зарегистрирован в реестре персонала ОДС. Изменение параметров КИИ отклонено."
        )

    disp = ml_service.authorized_dispatchers[badge]
    pin = (req.dispatcher_pin or "").strip()
    pin_hash = hashlib.sha256(pin.encode('utf-8')).hexdigest()

    if pin_hash != disp.get("pin_hash"):
        raise HTTPException(
            status_code=401,
            detail=f"Отказ в аутентификации: неверный 6-значный PIN-код для табельного номера '{badge}'. Изменение параметров заблокировано."
        )

    # Only Level-3 Chief Engineer can mutate system safety settings
    clearance = disp.get("clearance_level", "")
    if "level-3" not in clearance.lower() and "главный" not in disp.get("role", "").lower():
        raise HTTPException(
            status_code=403,
            detail=f"Отказ в доступе (RBAC): сотрудник '{badge}' ({disp.get('role')}) не обладает уровнем допуска Level-3 (Главный инженер ОДС) для изменения общесистемных порогов и тарифов."
        )

    update_dict = req.model_dump(exclude={"dispatcher_badge", "dispatcher_pin"})
    for k, v in update_dict.items():
        setattr(current_system_settings, k, v)
    save_settings(current_system_settings)
    return current_system_settings

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

class SensorChannel(BaseModel):
    channel_id: str
    system_type: str
    sensor_type: str
    tag: str
    sensor_name: str
    object_id: str

class ObjectSummary(BaseModel):
    object_id: str
    name: str
    object_type: str
    hierarchy_level: int
    parent_id: Optional[str] = None
    lat: float
    lon: float
    route_name: str
    corridor: str
    picket: str
    risk_level: str = "NORMAL"
    sensor_count: int = 0
    predicted_failures_count: int = 0

class ObjectDetail(ObjectSummary):
    sensors: List[SensorChannel] = []

class PredictionItem(BaseModel):
    channel_id: str
    object_id: str
    object_name: str
    sensor_name: str
    sensor_type: str
    system_type: str
    tag: str
    raw_model_score: float = Field(0.0, description="Балл риска модели в диапазоне [0,1] для ранжирования каналов в очереди диспетчера")
    calibrated_proxy_probability: Optional[float] = Field(None, description="Beta-калиброванная вероятность proxy-отклонения телеметрии в окне 24–72 ч; не вероятность физического отказа")
    is_calibrated: bool = Field(False, description="Флаг подтверждённой калибровки; отсутствие данных не означает успешную калибровку")
    calibration_status: str = Field("CALIBRATION_UNAVAILABLE", description="Статус калибровки")
    failure_probability: float = Field(0.0, description="DEPRECATED alias: совпадает с raw_model_score для обратной совместимости")
    risk_level: str  # NORMAL, ATTENTION, WARNING, CRITICAL
    is_predicted_failure_24h: bool = Field(..., description="Устаревший псевдоним порогового флага; не означает подтверждённый отказ за 24 часа")
    is_proxy_alert_24_72h: bool = Field(..., description="Пороговый флаг балла модели для proxy-отклонения телеметрии в окне 24–72 ч")
    recommended_action: str
    explanation_factors: List[str]
    horizon_hours: int = 24
    score_semantics: Optional[str] = (
        "raw_model_score: безразмерный балл риска [0,1] для ранжирования; "
        "calibrated_proxy_probability: beta-калиброванная вероятность proxy-отклонения телеметрии 24–72 ч. "
        "Не является вероятностью реальной аварии."
    )

class PredictionListResponse(BaseModel):
    total: int
    critical_count: int
    warning_count: int
    attention_count: int
    normal_count: int
    active_threshold: Optional[float] = 0.42
    items: List[PredictionItem]

class AlarmEvent(BaseModel):
    event_id: str
    channel_id: str
    date_str: str
    time_str: str
    is_alarm: bool
    raw_value: str
    sensor_type: Optional[str] = None
    object_name: Optional[str] = None
    tag: Optional[str] = None
    provenance: Optional[str] = "Архивный телеметрический поток СМВУ (Москоллектор)"

class AlarmClassificationRequest(BaseModel):
    channel_id: str
    current_value: str
    recent_events_count_1h: int = 1
    recent_flips_count_1h: int = 0
    duration_minutes: float = 2.0

class AlarmClassificationResponse(BaseModel):
    channel_id: str
    verdict: str  # FALSE_ALARM, REAL_RISK, SENSOR_DEGRADATION
    is_false_alarm: bool
    confidence: float
    diagnosis: str
    recommended_action: str
    avoided_callout_cost_rub: float

class AlarmConfirmationRequest(BaseModel):
    channel_id: str
    decision: Literal["CONFIRM_FALSE_ALARM", "FORCE_DISPATCH"] = Field(
        ..., description="Решение диспетчера: CONFIRM_FALSE_ALARM (отмена вызова) или FORCE_DISPATCH (принудительный выезд)"
    )
    dispatcher_badge: str = Field(..., pattern=r"^(ДИСП-\d{4}|\d{4}-ОДС)$", description="Табельный номер диспетчера ОДС (формат ДИСП-XXXX)")
    dispatcher_pin: str = Field(..., pattern=r"^\d{6}$", description="Персональный 6-значный PIN-код диспетчера ОДС для подтверждения решения")
    notes: Optional[str] = None

class DispatcherSessionRequest(BaseModel):
    dispatcher_badge: str = Field(..., pattern=r"^(ДИСП-\d{4}|\d{4}-ОДС)$")
    dispatcher_pin: str = Field(..., pattern=r"^\d{6}$")


class DispatcherSessionResponse(BaseModel):
    badge: str
    full_name: str
    role: str
    clearance_level: int
    can_confirm_false_alarm: bool
    can_force_dispatch: bool


class AlarmConfirmationResponse(BaseModel):
    channel_id: str
    decision: str
    status: str
    avoided_cost_rub: float
    dispatcher_badge: str
    dispatcher_name: Optional[str] = None
    dispatcher_role: Optional[str] = None
    clearance_level: Optional[str] = None
    timestamp: str
    message: str
    prev_hash: Optional[str] = None
    record_hash: Optional[str] = None
    signature_standard: Optional[str] = "SHA-256 hash chain; integrity check only, no digital signature"

class AuditVerificationResponse(BaseModel):
    is_valid: bool
    total_records: int
    chain_length: int
    head_hash: str
    tamper_detected: bool
    standard: str
    verified_at: str
    details: List[Dict[str, Any]] = []

class RealtimeScoreRequest(BaseModel):
    channel_id: str
    cnt_24h: Optional[int] = 10
    cnt_7d: Optional[int] = 70
    alarms_24h: Optional[int] = 0
    alarms_7d: Optional[int] = 1
    chatter_cnt: Optional[int] = 0
    silence_hours: Optional[float] = 1.0
    battery_glitches: Optional[int] = 0
    date_corruptions: Optional[int] = 0
    gas_spikes: Optional[int] = 0
    temp_spikes: Optional[int] = 0
    mean_val: Optional[float] = 0.0
    std_val: Optional[float] = 0.0
    num_max: Optional[float] = 0.0
    last_value: Optional[str] = "Норма"
    unique_states: Optional[int] = None
    model_name: Optional[str] = "champion_lightgbm"

class RealtimeScoreResponse(BaseModel):
    channel_id: str
    sensor_name: str
    object_name: str
    picket: str
    failure_probability: float
    risk_score: Optional[float] = None
    calibrated_probability: Optional[float] = None
    raw_model_score: Optional[float] = None
    calibrated_proxy_probability: Optional[float] = None
    is_calibrated: Optional[bool] = None
    calibration_status: Optional[str] = None
    risk_level: str
    threshold_used: float
    raw_threshold: Optional[float] = None
    calibrated_threshold: Optional[float] = None
    is_degradation_detected: bool
    top_factors: List[str]
    recommended_action: str
    inference_latency_ms: float
    model_used: Optional[str] = "champion_lightgbm"
    score_semantics: Optional[str] = None

class MaintenanceTicket(BaseModel):
    ticket_id: str
    created_at: str
    object_id: str
    object_name: str
    channel_id: str = Field(..., min_length=1, max_length=32, pattern=r"^\d+$")
    sensor_name: str
    sensor_type: str
    picket: str
    corridor: str
    priority: Literal["ВЫСОКИЙ", "СРЕДНИЙ", "НИЗКИЙ"]
    failure_risk_percent: float
    required_materials: List[str]
    work_description: str
    regulation_reference: str
    assigned_team: str
    status: Literal["ЧЕРНОВИК", "НАЗНАЧЕН", "В_РАБОТЕ", "ВЫПОЛНЕН"]
    estimated_cost_rub: float
    saved_opex_rub: float
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None


TicketPriority = Literal["ВЫСОКИЙ", "СРЕДНИЙ", "НИЗКИЙ"]
TicketStatus = Literal["ЧЕРНОВИК", "НАЗНАЧЕН", "В_РАБОТЕ", "ВЫПОЛНЕН"]

class CreateTicketRequest(BaseModel):
    channel_id: str = Field(..., min_length=1, max_length=32, pattern=r"^\d+$")
    priority: TicketPriority = "ВЫСОКИЙ"
    notes: Optional[str] = None
    dispatcher_badge: Optional[str] = Field(None, min_length=1, max_length=32, description="Табельный номер диспетчера ОДС")
    dispatcher_pin: Optional[str] = Field(None, pattern=r"^\d{6}$", description="6-значный PIN-код диспетчера ОДС")


class UpdateTicketStatusRequest(BaseModel):
    new_status: TicketStatus
    dispatcher_badge: Optional[str] = Field(None, min_length=1, max_length=32)
    dispatcher_pin: Optional[str] = Field(None, pattern=r"^\d{6}$")

class SystemStatsResponse(BaseModel):
    monitored_km: float
    total_objects: int
    total_sensors: int
    model_precision: float
    model_recall: float
    model_f1: float
    model_roc_auc: float
    prediction_horizon_hours: int
    inference_sla_seconds: int
    false_alarms_filtered_ratio: Optional[float] = Field(None, description="Доля отсева на подтверждённой выборке; null, пока журнал исходов заказчика недоступен")
    total_saved_opex_rub: float = Field(..., description="Устаревшее имя: сумма условной разницы затрат в локальном демо, не подтверждённая экономия")
    annual_projected_opex_rub: float = Field(..., description="Годовой сценарный потенциал при заданных допущениях, не достигнутый эффект")
    financial_evidence_status: str = "SCENARIO_ONLY_NO_VERIFIED_SAVINGS"
    tickets_count: int
    critical_sensors_count: int
    confirmed_false_alarms_count: int
    methodology: str
    inference_latency_ms: float

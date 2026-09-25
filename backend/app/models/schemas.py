from typing import List, Optional, Dict, Any
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
    failure_probability: float
    risk_level: str  # NORMAL, ATTENTION, WARNING, CRITICAL
    is_predicted_failure_24h: bool
    recommended_action: str
    explanation_factors: List[str]
    horizon_hours: int = 24

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
    decision: str  # CONFIRM_FALSE_ALARM or FORCE_DISPATCH
    dispatcher_badge: str = "7041-ОДС"
    notes: Optional[str] = None

class AlarmConfirmationResponse(BaseModel):
    channel_id: str
    decision: str
    status: str
    avoided_cost_rub: float
    dispatcher_badge: str
    timestamp: str
    message: str

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

class RealtimeScoreResponse(BaseModel):
    channel_id: str
    sensor_name: str
    object_name: str
    picket: str
    failure_probability: float
    risk_level: str
    threshold_used: float
    is_degradation_detected: bool
    top_factors: List[str]
    recommended_action: str
    inference_latency_ms: float

class MaintenanceTicket(BaseModel):
    ticket_id: str
    created_at: str
    object_id: str
    object_name: str
    channel_id: str
    sensor_name: str
    sensor_type: str
    picket: str
    corridor: str
    priority: str  # ВЫСОКИЙ, СРЕДНИЙ, НИЗКИЙ
    failure_risk_percent: float
    required_materials: List[str]
    work_description: str
    regulation_reference: str
    assigned_team: str
    status: str  # ЧЕРНОВИК, НАЗНАЧЕН, В_РАБОТЕ, ВЫПОЛНЕН
    estimated_cost_rub: float
    saved_opex_rub: float

class CreateTicketRequest(BaseModel):
    channel_id: str
    priority: Optional[str] = "ВЫСОКИЙ"
    notes: Optional[str] = None

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
    false_alarms_filtered_ratio: float
    total_saved_opex_rub: float
    annual_projected_opex_rub: float
    tickets_count: int
    critical_sensors_count: int
    confirmed_false_alarms_count: int
    methodology: str
    inference_latency_ms: float

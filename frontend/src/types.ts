export interface SystemSettings {
  decision_threshold: number;
  chatter_window_seconds: number;
  chatter_min_flips: number;
  gas_warning_threshold_vol_pct: number;
  callout_cost_rub: number;
  preventive_cost_rub: number;
  require_dispatcher_confirmation: boolean;
  auto_suppress_chatter: boolean;
  selected_model?: string;
}

export interface SystemStats {
  monitored_km: number;
  total_objects: number;
  total_sensors: number;
  model_precision: number;
  model_recall: number;
  model_f1: number;
  model_roc_auc: number;
  prediction_horizon_hours: number;
  inference_sla_seconds: number;
  false_alarms_filtered_ratio: number;
  total_saved_opex_rub: number;
  annual_projected_opex_rub: number;
  tickets_count: number;
  critical_sensors_count: number;
  confirmed_false_alarms_count: number;
  methodology: string;
  inference_latency_ms: number;
}

export interface ObjectItem {
  object_id: string;
  name: string;
  object_type: string;
  hierarchy_level: number;
  parent_id?: string;
  lat: number;
  lon: number;
  route_name: string;
  corridor: string;
  picket: string;
  risk_level: 'NORMAL' | 'ATTENTION' | 'WARNING' | 'CRITICAL';
  sensor_count: number;
  predicted_failures_count: number;
}

export interface PredictionItem {
  channel_id: string;
  object_id: string;
  object_name: string;
  sensor_name: string;
  sensor_type: string;
  system_type: string;
  tag: string;
  failure_probability: number;
  risk_level: 'NORMAL' | 'ATTENTION' | 'WARNING' | 'CRITICAL';
  is_predicted_failure_24h: boolean;
  recommended_action: string;
  explanation_factors: string[];
  horizon_hours: number;
}

export interface PredictionListResponse {
  total: number;
  critical_count: number;
  warning_count: number;
  attention_count: number;
  normal_count: number;
  items: PredictionItem[];
}

export interface RealtimeScoreResult {
  channel_id: string;
  sensor_name: string;
  object_name: string;
  picket: string;
  failure_probability: number;
  risk_level: 'NORMAL' | 'ATTENTION' | 'WARNING' | 'CRITICAL';
  threshold_used: number;
  is_degradation_detected: boolean;
  top_factors: string[];
  recommended_action: string;
  inference_latency_ms: number;
}

export interface AlarmClassificationResponse {
  channel_id: string;
  verdict: 'FALSE_ALARM' | 'REAL_RISK' | 'SENSOR_DEGRADATION' | 'NORMAL';
  is_false_alarm: boolean;
  confidence: number;
  diagnosis: string;
  recommended_action: string;
  avoided_callout_cost_rub: number;
}

export interface ConfirmedAlarmItem {
  channel_id: string;
  decision: string;
  status: string;
  avoided_cost_rub: number;
  dispatcher_badge: string;
  dispatcher_name?: string;
  dispatcher_role?: string;
  clearance_level?: string;
  timestamp: string;
  notes?: string;
  prev_hash?: string;
  record_hash?: string;
  signature_standard?: string;
}

export interface AuthorizedDispatcher {
  badge: string;
  full_name: string;
  role: string;
  clearance_level: string;
  cert_id?: string;
}

export interface AuditVerificationResult {
  is_valid: boolean;
  total_records: number;
  chain_length: number;
  head_hash: string;
  tamper_detected: boolean;
  standard: string;
  verified_at: string;
  details: Array<{
    index: number;
    channel_id: string;
    dispatcher_badge: string;
    link_valid: boolean;
    hash_valid: boolean;
    badge_authorized: boolean;
    block_hash: string;
  }>;
}

export interface MaintenanceTicket {
  ticket_id: string;
  created_at: string;
  object_id: string;
  object_name: string;
  channel_id: string;
  sensor_name: string;
  sensor_type: string;
  picket: string;
  corridor: string;
  priority: 'ВЫСОКИЙ' | 'СРЕДНИЙ' | 'НИЗКИЙ';
  failure_risk_percent: number;
  required_materials: string[];
  work_description: string;
  regulation_reference: string;
  assigned_team: string;
  status: 'ЧЕРНОВИК' | 'НАЗНАЧЕН' | 'В_РАБОТЕ' | 'ВЫПОЛНЕН';
  estimated_cost_rub: number;
  saved_opex_rub: number;
}

export interface SimulationResult {
  step_id: number;
  scenario_type: string;
  channel_id: string;
  sensor_name: string;
  object_name: string;
  picket: string;
  emitted_value: string;
  alarm_triggered: boolean;
  ml_verdict: string;
  explanation: string;
  ticket_created: boolean;
  ticket_id?: string;
  avoided_callout_rub: number;
}

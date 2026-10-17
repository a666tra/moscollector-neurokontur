export type UserRole = 'tech' | 'disp';

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
  false_alarms_filtered_ratio: number | null;
  financial_evidence_status?: string;
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
  raw_model_score?: number;
  calibrated_proxy_probability?: number | null;
  is_calibrated?: boolean;
  calibration_status?: string;
  failure_probability: number;
  risk_level: 'NORMAL' | 'ATTENTION' | 'WARNING' | 'CRITICAL';
  is_predicted_failure_24h: boolean;
  is_proxy_alert_24_72h?: boolean;
  recommended_action: string;
  explanation_factors: string[];
  horizon_hours: number;
  score_semantics?: string;
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
  raw_model_score?: number;
  calibrated_proxy_probability?: number | null;
  is_calibrated?: boolean;
  calibration_status?: string;
  risk_score?: number;
  calibrated_probability?: number | null;
  risk_level: 'NORMAL' | 'ATTENTION' | 'WARNING' | 'CRITICAL';
  threshold_used: number;
  is_degradation_detected: boolean;
  top_factors: string[];
  recommended_action: string;
  inference_latency_ms: number;
  score_semantics?: string;
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
  scenario_potential_rub?: number;
}

export interface ScenarioMeta {
  id: string;
  name: string;
  shape: string;
  cls: string;
  day_count: number;
  month_count: number;
  target_metric: 'lead_time' | 'delay';
}

export interface ScenarioThresholdMeta {
  parameter: string;
  value: string;
  source: string;
}

export interface ScenarioChannelMeta {
  channel_id: string;
  sensor_type: string;
  object_id: string;
  sensor_name: string;
  system_type: string;
}

export interface ScenarioCatalogResponse {
  data_origin: string;
  scenarios: ScenarioMeta[];
  thresholds: ScenarioThresholdMeta[];
  channel_composition: {
    total_channels: number;
    specs: Array<{ sensor_type: string; count: number }>;
    channels: ScenarioChannelMeta[];
  };
}

export interface ScenarioMetricItem {
  total: number;
  detected: number;
  detection_rate: number;
  lead_time_median_min?: number | null;
  lead_time_p10_min?: number | null;
  delay_median_sec?: number | null;
  delay_p90_sec?: number | null;
  alerts_per_event?: number | null;
  incidents_per_event?: number | null;
  share_labelled_setpoint_chatter?: number | null;
}

export interface ScenarioDetectorMetrics {
  overall: {
    total_events: number;
    detected_events: number;
    detection_rate: number;
  };
  scenarios: Record<string, ScenarioMetricItem>;
  s8_metrics?: {
    alerts_per_event: number;
    incidents_per_event: number;
    share_labelled_setpoint_chatter: number;
  };
  lead_time: {
    median_min: number | null;
    p10_min: number | null;
    count: number;
  };
  delay: {
    median_sec: number | null;
    p90_sec: number | null;
    count: number;
  };
  false_alarms: {
    count: number;
    per_100_channels_per_day: number;
  };
  alerts_total: number;
  incidents: number;
  alerts_count?: {
    total: number;
    incidents: number;
    reminders: number;
    escalations: number;
  };
}

export interface ScenarioComparison {
  fast: ScenarioDetectorMetrics;
  static_dedup: ScenarioDetectorMetrics;
  naive: ScenarioDetectorMetrics;
}

export interface ScenarioIncidentItem {
  ts: number;
  channel_id: string;
  object_id: string;
  cls: string;
  severity: string;
  value: number | null;
  reason_ru: string;
  is_reminder: boolean;
  is_escalation: boolean;
  matched_truth_event_id: string | null;
}

export interface ScenarioRunResponse {
  data_origin: string;
  seed: number;
  mode: 'day' | 'month';
  elapsed_seconds: number;
  thresholds_used: Record<string, any>;
  summary: ScenarioDetectorMetrics;
  comparison: ScenarioComparison;
  naive_alerts_to_fast_incidents: number;
  static_dedup_incidents_to_fast_incidents: number;
  ratios: {
    naive_alerts_to_fast_incidents: number;
    static_dedup_incidents_to_fast_incidents: number;
  };
  incident_list: ScenarioIncidentItem[];
}

export interface ScenarioSeriesPoint {
  ts: number;
  value?: number | null;
  state_name?: string;
  is_alarm?: boolean;
}

export interface ScenarioTrueEvent {
  event_id: string;
  scenario_id: string;
  cls: string;
  start_ts: number;
  end_ts: number;
  hazard_ts: number | null;
}

export interface ScenarioAlertItem {
  ts: number;
  cls: string;
  severity: string;
  value: number | null;
  reason_ru: string;
  is_reminder: boolean;
  is_escalation: boolean;
}

export interface ScenarioSeriesResponse {
  data_origin: string;
  seed: number;
  mode: 'day' | 'month';
  channel_id: string;
  sensor_type: string;
  object_id: string;
  thresholds: {
    warning?: number | null;
    alarm?: number | null;
  };
  series: ScenarioSeriesPoint[];
  true_events: ScenarioTrueEvent[];
  alerts: ScenarioAlertItem[];
}

export interface BacktestWeekMetrics {
  n: number;
  positives: number;
  prevalence: number;
  roc_auc: number;
  pr_auc: number;
  hits_at_50: number;
  precision_at_50: number;
  recall_at_50: number;
  hits_at_100: number;
  precision_at_100: number;
  recall_at_100: number;
  hits_at_200: number;
  precision_at_200: number;
  recall_at_200: number;
  threshold?: number;
  flagged?: number;
  tp?: number;
  fp?: number;
  precision?: number;
  recall?: number;
}

export interface BacktestWeek {
  cutoff: string;
  label_window: string;
  train_weeks: number;
  all: {
    deployed: BacktestWeekMetrics;
    lgbm_weekly?: BacktestWeekMetrics;
    logreg_weekly?: BacktestWeekMetrics;
    persistence: BacktestWeekMetrics;
  };
  new_incidents?: {
    deployed: BacktestWeekMetrics;
    lgbm_weekly?: BacktestWeekMetrics;
    logreg_weekly?: BacktestWeekMetrics;
    persistence: BacktestWeekMetrics;
  };
}

export interface BacktestMetricSummary {
  mean: number;
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  weeks: number;
}

export interface BacktestVariantSummary {
  roc_auc: BacktestMetricSummary;
  pr_auc: BacktestMetricSummary;
  precision_at_50: BacktestMetricSummary;
  precision_at_100: BacktestMetricSummary;
  precision_at_200: BacktestMetricSummary;
  recall_at_100: BacktestMetricSummary;
  precision?: BacktestMetricSummary | null;
  recall?: BacktestMetricSummary | null;
  total_hits_at_100?: number;
  total_positives?: number;
}

export interface BacktestPopulationSummary {
  deployed: BacktestVariantSummary;
  lgbm_weekly: BacktestVariantSummary;
  logreg_weekly?: BacktestVariantSummary;
  persistence: BacktestVariantSummary;
  prevalence?: BacktestMetricSummary;
}

export interface BacktestResponse {
  test_weeks: number;
  channels: number;
  weeks: BacktestWeek[];
  summary?: {
    all: BacktestPopulationSummary;
    new_incidents: BacktestPopulationSummary;
  };
}

export interface PerformanceBenchmark {
  full_batch_channels_count: number;
  full_batch_latency_ms: number;
  full_batch_p95_latency_ms: number;
  single_sensor_latency_ms: number;
  single_sensor_p95_latency_ms: number;
  throughput_sensors_per_sec: number;
  tz_sla_seconds: number;
  speedup_vs_sla: number;
}

export interface HttpLoadBenchmark {
  benchmark_timestamp: string;
  test_type: string;
  target_url: string;
  total_requests: number;
  concurrency_workers: number;
  success_rate_pct: number;
  total_time_seconds: number;
  throughput_rps: number;
  latency_mean_ms: number;
  latency_p50_ms: number;
  latency_p90_ms: number;
  latency_p95_ms: number;
  tz_sla_target_ms: number;
  compliance_sla: string;
}

export interface PredictionMetricsResponse {
  performance_benchmark: PerformanceBenchmark;
  http_load_benchmark: HttpLoadBenchmark;
  [key: string]: any;
}


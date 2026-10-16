// Single source of truth for Scenario Lab labels, alert classes, severities, and formatting

export const ALERT_CLASS_MAP: Record<string, string> = {
  CHATTER: 'Дребезг контакта',
  SETPOINT_CHATTER: 'Дребезг у уставки',
  GAS_RATE: 'Рост метана',
  GAS_WARNING: 'Метан выше порога',
  GAS_ALARM: 'Метан: авария',
  TEMP_RATE: 'Рост температуры',
  TEMP_WARNING: 'Температура выше порога',
  TEMP_ALARM: 'Температура: авария',
  FIRE: 'Пожар',
  FLOOD: 'Затопление',
  COMM_LOSS: 'Потеря связи',
};

export const SCENARIO_NAMES: Record<string, string> = {
  S1: 'Медленная утечка газа',
  S2: 'Быстрая утечка газа',
  S3: 'Перегрев трубопровода',
  S4: 'Пожар',
  S5: 'Затопление',
  S6: 'Дребезг контакта',
  S7: 'Потеря связи',
  S8: 'Колебание газа у уставки',
};

export const getScenarioName = (id: string): string => {
  return SCENARIO_NAMES[id] || id;
};

export const ALERT_CLASS_ENTRIES = Object.entries(ALERT_CLASS_MAP).map(([code, label]) => ({
  code,
  label,
}));

export const getAlertClassLabel = (code: string): string => {
  return ALERT_CLASS_MAP[code] || code;
};

export const SEVERITY_MAP: Record<string, string> = {
  WARNING: 'Предупреждение',
  CRITICAL: 'Критично',
  HIGH: 'Высокая',
  INFO: 'Инфо',
  LOW: 'Низкая',
};

export const getSeverityLabel = (severity: string): string => {
  const upper = severity?.toUpperCase();
  return SEVERITY_MAP[upper] || severity;
};

/**
 * Format signed lead time in minutes with 1 decimal place.
 * Never shows negative zero ("−0,0 мин").
 * If value rounds to 0.0, outputs "0,0 мин" without sign.
 */
export const formatSignedLeadTime = (val?: number | null): string => {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  const fixed = val.toFixed(1);
  if (fixed === '0.0' || fixed === '-0.0' || Math.abs(val) < 0.05) {
    return '0,0 мин';
  }
  const num = parseFloat(fixed);
  const sign = num > 0 ? '+' : '−';
  return `${sign}${Math.abs(num).toFixed(1).replace('.', ',')} мин`;
};

export const isNegativeLeadTime = (val?: number | null): boolean => {
  if (val === null || val === undefined || !Number.isFinite(val)) return false;
  if (Math.abs(val) < 0.05) return false;
  return val < 0;
};

/**
 * Format delay in seconds or minutes without negative zero.
 */
export const formatDelaySec = (sec?: number | null): string => {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '—';
  const fixed = sec.toFixed(1);
  const absVal = fixed === '0.0' || fixed === '-0.0' || Math.abs(sec) < 0.05 ? 0 : Math.abs(parseFloat(fixed));
  if (absVal < 60) {
    return `${absVal.toFixed(1).replace('.', ',')} с`;
  }
  return `${(absVal / 60).toFixed(1).replace('.', ',')} мин`;
};

/**
 * Groups repeated scenario events into "S6 × 2" format.
 */
export const formatScenarioCounts = (events: Array<{ scenario_id: string }>): string => {
  if (!events || events.length === 0) return 'нет';
  const counts = new Map<string, number>();
  for (const e of events) {
    counts.set(e.scenario_id, (counts.get(e.scenario_id) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([id, count]) => (count > 1 ? `${id} × ${count}` : id))
    .join(', ');
};

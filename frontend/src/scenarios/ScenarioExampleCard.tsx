import React from 'react';
import { Activity } from 'lucide-react';
import {
  ScenarioIncidentItem,
  ScenarioComparison,
  ScenarioDetectorMetrics,
} from '../types';
import { SCENARIO_ICONS } from './ScenarioChooser';
import { formatDelaySec } from './scenarioLabels';

interface ScenarioExampleCardProps {
  incident?: ScenarioIncidentItem | null;
  comparison?: ScenarioComparison | null;
  summary?: ScenarioDetectorMetrics | null;
  mode?: 'day' | 'month';
  selectedScenarioId: string;
}

export const ScenarioExampleCard: React.FC<ScenarioExampleCardProps> = ({
  incident,
  comparison,
  summary,
  mode = 'day',
  selectedScenarioId,
}) => {
  if (!incident) {
    return null;
  }

  const thatScenario =
    selectedScenarioId !== 'all' ? selectedScenarioId : incident.scenario_id;

  const Icon =
    (thatScenario && SCENARIO_ICONS[thatScenario]) ||
    SCENARIO_ICONS[selectedScenarioId] ||
    Activity;

  // Real scenario metrics from comparison.fast.scenarios[thatScenario] ONLY (no global fallback)
  const scMetricsFast = thatScenario
    ? comparison?.fast?.scenarios?.[thatScenario]
    : undefined;
  const leadMin = scMetricsFast?.lead_time_median_min;
  const delaySec = scMetricsFast?.delay_median_sec;

  let chip1Text: string | null = null;
  if (typeof leadMin === 'number' && Number.isFinite(leadMin)) {
    const nStr = Math.abs(leadMin).toFixed(1).replace('.', ',');
    if (leadMin > 0) {
      chip1Text = `НейроКонтур: первый звонок на ${nStr} мин раньше порога (медиана по сценарию)`;
    } else if (leadMin < 0) {
      chip1Text = `НейроКонтур: первый звонок на ${nStr} мин позже порога (медиана по сценарию)`;
    } else {
      chip1Text = `НейроКонтур: первый звонок на ${nStr} мин раньше порога (медиана по сценарию)`;
    }
  } else if (typeof delaySec === 'number' && Number.isFinite(delaySec)) {
    chip1Text = `НейроКонтур: звонок через ${formatDelaySec(delaySec)} после начала события (медиана по сценарию)`;
  }

  // Chip 2 and 3: whole shift averages
  const totalEvents =
    summary?.overall?.total_events ??
    comparison?.fast?.overall?.total_events ??
    0;
  const staticAlerts = comparison?.static_dedup?.alerts_total ?? 0;
  const naiveAlerts = comparison?.naive?.alerts_total ?? 0;

  const xVal = totalEvents > 0 ? staticAlerts / totalEvents : 0;
  const xStr = xVal.toFixed(1).replace('.', ',');

  const yVal = totalEvents > 0 ? naiveAlerts / totalEvents : 0;
  const yStr = yVal.toFixed(1).replace('.', ',');

  const hasChips = Boolean(thatScenario);

  return (
    <section className="flex flex-col gap-3">
      {/* Caption above story */}
      <div className="text-xs font-medium text-[var(--mu)]">
        {mode === 'month'
          ? 'Пример события из этого месяца'
          : 'Пример события из этой смены'}
      </div>

      {/* 44px round icon + serif story */}
      <div className="flex items-center gap-3">
        <span
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--sf2)', color: 'var(--ac)' }}
        >
          <Icon className="w-[22px] h-[22px]" />
        </span>
        <span
          className="text-[19px] sm:text-[24px] font-normal leading-[1.25]"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
        >
          {incident.reason_ru || 'Событие в телеметрии'}
        </span>
      </div>

      {/* Chips: rounded pills with dot + text */}
      {hasChips && (
        <div className="flex gap-2 flex-wrap">
          {chip1Text && (
            <span
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-semibold text-[13.5px]"
              style={{ background: 'var(--acs)', color: 'var(--ink)' }}
            >
              <i
                className="w-[11px] h-[11px] rounded-full shrink-0"
                style={{ background: 'var(--ac)' }}
              />
              <span>{chip1Text}</span>
            </span>
          )}

          <span
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-semibold text-[13.5px]"
            style={{ background: 'var(--ams)', color: 'var(--ink)' }}
          >
            <i
              className="w-[11px] h-[11px] rounded-full shrink-0"
              style={{ background: 'oklch(0.72 0.15 72)' }}
            />
            <span>Статический порог: в среднем {xStr} зв. на событие (вся смена)</span>
          </span>

          <span
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-semibold text-[13.5px]"
            style={{ background: 'var(--rds)', color: 'var(--ink)' }}
          >
            <i
              className="w-[11px] h-[11px] rounded-full shrink-0"
              style={{ background: 'var(--rd)' }}
            />
            <span>Простой порог: в среднем {yStr} зв. на событие (вся смена)</span>
          </span>
        </div>
      )}
    </section>
  );
};

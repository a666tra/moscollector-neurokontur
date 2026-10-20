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

  // Tile 1: honest lead/delay figure (median over the scenario), no new numbers.
  let tile1: { value: string; sub: string } | null = null;
  if (typeof leadMin === 'number' && Number.isFinite(leadMin)) {
    const nStr = Math.abs(leadMin).toFixed(1).replace('.', ',');
    tile1 = {
      value: `${nStr} мин`,
      sub:
        leadMin > 0
          ? 'раньше порога · медиана по сценарию'
          : leadMin < 0
            ? 'позже порога · медиана по сценарию'
            : 'одновременно с порогом · медиана по сценарию',
    };
  } else if (typeof delaySec === 'number' && Number.isFinite(delaySec)) {
    tile1 = {
      value: formatDelaySec(delaySec),
      sub: 'после начала события · медиана по сценарию',
    };
  }

  // Chip 2 and 3: whole shift averages
  const totalEvents =
    summary?.overall?.total_events ??
    comparison?.fast?.overall?.total_events ??
    0;
  const staticAlerts = comparison?.static_dedup?.alerts_total ?? 0;
  const naiveAlerts = comparison?.naive?.alerts_total ?? 0;

  const hasTotals =
    totalEvents > 0 &&
    typeof comparison?.static_dedup?.alerts_total === 'number' &&
    typeof comparison?.naive?.alerts_total === 'number';
  const xStr = hasTotals ? (staticAlerts / totalEvents).toFixed(1).replace('.', ',') : '—';
  const yStr = hasTotals ? (naiveAlerts / totalEvents).toFixed(1).replace('.', ',') : '—';

  const hasChips = Boolean(thatScenario);
  const period = mode === 'month' ? 'за месяц' : 'вся смена';

  const tiles: { who: string; dot: string; bg: string; fg: string; value: string; sub: string }[] = [];
  if (tile1) {
    tiles.push({
      who: 'НейроКонтур',
      dot: 'var(--ac)',
      bg: 'var(--acs)',
      fg: 'var(--ac)',
      value: tile1.value,
      sub: tile1.sub,
    });
  }
  tiles.push(
    {
      who: 'Статический порог',
      dot: 'oklch(0.72 0.15 72)',
      bg: 'var(--ams)',
      fg: 'var(--amt)',
      value: hasTotals ? `${xStr} зв.` : '—',
      sub: `на событие в среднем (${period})`,
    },
    {
      who: 'Простой порог',
      dot: 'var(--rd)',
      bg: 'var(--rds)',
      fg: 'var(--rdt)',
      value: hasTotals ? `${yStr} зв.` : '—',
      sub: `на событие в среднем (${period})`,
    }
  );

  return (
    <section
      className="flex flex-col gap-3.5 rounded-[24px] p-4 sm:p-[20px_22px]"
      style={{ background: 'var(--sf)', boxShadow: 'var(--sh)' }}
    >
      {/* Icon square + eyebrow + story */}
      <div className="flex items-start gap-3.5">
        <span
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--acs)', color: 'var(--ac)' }}
        >
          <Icon className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <div
            className="text-[11.5px] font-semibold uppercase tracking-[0.08em]"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--mu)' }}
          >
            {mode === 'month'
              ? 'Пример события из этого месяца'
              : 'Пример события из этой смены'}
          </div>
          <div
            className="text-[19px] sm:text-[22px] font-normal leading-[1.25] mt-1 text-pretty"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
          >
            {incident.reason_ru || 'Событие в телеметрии'}
          </div>
        </div>
      </div>

      {/* Three result tiles (honest data only) */}
      {hasChips && (
        <div
          className={`grid grid-cols-1 gap-2.5 ${tiles.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
        >
          {tiles.map((t) => (
            <div
              key={t.who}
              className="rounded-[18px] px-3.5 py-3 flex flex-col gap-1 min-w-0"
              style={{ background: t.bg }}
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.dot }} />
                {t.who}
              </span>
              <b
                className="text-[26px] leading-[1.1] font-normal tabular-nums"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: t.fg }}
              >
                {t.value}
              </b>
              <span className="text-[12.5px] leading-[1.3] font-medium" style={{ color: 'var(--mu)' }}>
                {t.sub}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

import React from 'react';
import { Activity } from 'lucide-react';
import { ScenarioIncidentItem, ScenarioComparison } from '../types';
import { SCENARIO_ICONS } from './ScenarioChooser';

interface ScenarioExampleCardProps {
  incident?: ScenarioIncidentItem | null;
  comparison?: ScenarioComparison | null;
  selectedScenarioId: string;
}

export const ScenarioExampleCard: React.FC<ScenarioExampleCardProps> = ({
  incident,
  comparison,
  selectedScenarioId,
}) => {
  if (!incident) {
    return null;
  }

  const formatTime = (ts: number) => {
    const totalMinutes = Math.floor(ts / 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const Icon = SCENARIO_ICONS[selectedScenarioId] || Activity;

  // Real scenario metrics from comparison
  const scMetricsFast = comparison?.fast?.scenarios?.[selectedScenarioId];
  const leadMin = scMetricsFast?.lead_time_median_min ?? comparison?.fast?.lead_time?.median_min ?? null;
  const delaySec = scMetricsFast?.delay_median_sec ?? comparison?.fast?.delay?.median_sec ?? null;

  const naiveAlertsTotal = comparison?.naive?.alerts_total ?? 0;
  const fastIncidentsTotal = comparison?.fast?.incidents ?? (comparison?.fast?.alerts_total != null ? 1 : 0);
  const staticIncidentsTotal = comparison?.static_dedup?.incidents ?? 0;

  const ratioNaive = fastIncidentsTotal > 0 ? Math.round(naiveAlertsTotal / fastIncidentsTotal) : 0;
  const ratioStatic = fastIncidentsTotal > 0 ? Math.round(staticIncidentsTotal / fastIncidentsTotal) : 0;

  const leadText = leadMin !== null && leadMin > 0
    ? `на ${Math.round(leadMin)} мин раньше порога`
    : delaySec !== null && delaySec > 0
    ? `задержка ${delaySec.toFixed(1)} с`
    : 'по факту порога';

  const thresholdTime = formatTime(incident.ts + (leadMin !== null && leadMin > 0 ? leadMin * 60 : 0));

  return (
    <section className="flex flex-col gap-3">
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
      <div className="flex gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-semibold text-[13.5px]"
          style={{ background: 'var(--acs)', color: 'var(--ink)' }}
        >
          <i className="w-[11px] h-[11px] rounded-full shrink-0" style={{ background: 'var(--ac)' }} />
          <span>НейроКонтур: {leadText} · 1 звонок</span>
        </span>

        <span
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-semibold text-[13.5px]"
          style={{ background: 'var(--ams)', color: 'var(--ink)' }}
        >
          <i className="w-[11px] h-[11px] rounded-full shrink-0" style={{ background: 'oklch(0.72 0.15 72)' }} />
          <span>Статический: в {thresholdTime} · {ratioStatic} зв.</span>
        </span>

        <span
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-semibold text-[13.5px]"
          style={{ background: 'var(--rds)', color: 'var(--ink)' }}
        >
          <i className="w-[11px] h-[11px] rounded-full shrink-0" style={{ background: 'var(--rd)' }} />
          <span>Простой: {ratioNaive} зв. подряд без дедупликации</span>
        </span>
      </div>
    </section>
  );
};

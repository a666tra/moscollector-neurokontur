import React from 'react';
import { Wind, Zap, Thermometer, Flame, Droplets, Activity, WifiOff, Radio, AlertCircle } from 'lucide-react';
import { ScenarioIncidentItem, ScenarioComparison } from '../types';
import { SCENARIO_ICONS, SCENARIO_SHORT_LABELS } from './ScenarioChooser';

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
  const leadMin = scMetricsFast?.lead_time_median_min ?? comparison?.fast?.lead_time?.median_min ?? 15;
  const delaySec = scMetricsFast?.delay_median_sec ?? comparison?.fast?.delay?.median_sec ?? 3.5;

  const naiveAlertsTotal = comparison?.naive?.alerts_total ?? 1436;
  const fastIncidentsTotal = comparison?.fast?.incidents ?? 34;
  const staticIncidentsTotal = comparison?.static_dedup?.incidents ?? 535;

  const ratioNaive = Math.max(2, Math.round(naiveAlertsTotal / Math.max(1, fastIncidentsTotal)));
  const ratioStatic = Math.max(1, Math.round(staticIncidentsTotal / Math.max(1, fastIncidentsTotal)));

  const leadText = leadMin > 0
    ? `на ${Math.round(leadMin)} мин раньше порога`
    : `задержка ${delaySec.toFixed(1)} с`;

  const thresholdTime = formatTime(incident.ts + (leadMin > 0 ? leadMin * 60 : 0));

  return (
    <section
      className="p-4 sm:p-5 rounded-2xl space-y-3.5 border border-[var(--ln2)] bg-[var(--sf)]"
    >
      <div className="flex items-start gap-3">
        <span
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--sf2)', color: 'var(--ac)' }}
        >
          <Icon className="w-5 h-5" />
        </span>
        <div className="space-y-0.5 min-w-0">
          <h3
            className="text-base sm:text-xl font-normal leading-snug"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
          >
            Разбор примера: {incident.reason_ru || 'Событие в телеметрии'}
          </h3>
          <p className="text-xs text-[var(--mu)]">
            Объект: {incident.object_id} · время фиксации: {formatTime(incident.ts)}
          </p>
        </div>
      </div>

      {/* Reaction of the 3 approaches */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-semibold text-xs sm:text-sm"
          style={{ background: 'var(--acs)', color: 'var(--ac)' }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--ac)' }} />
          <span>НейроКонтур: {leadText} · 1 звонок</span>
        </span>

        <span
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-semibold text-xs sm:text-sm"
          style={{ background: 'var(--ams)', color: 'var(--amt)' }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(0.72 0.15 72)' }} />
          <span>Статический: по факту в {thresholdTime} · {ratioStatic} зв.</span>
        </span>

        <span
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-semibold text-xs sm:text-sm"
          style={{ background: 'var(--rds)', color: 'var(--rdt)' }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--rd)' }} />
          <span>Простой: {ratioNaive} зв. подряд без дедупликации</span>
        </span>
      </div>
    </section>
  );
};

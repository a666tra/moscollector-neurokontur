import React, { useState } from 'react';
import { Bell, ChevronDown, ChevronUp, Table } from 'lucide-react';
import { ScenarioRunResponse, ScenarioCatalogResponse } from '../types';
import { ScenarioComparisonTable } from './ScenarioComparisonTable';
import { fmtPct, fmtNum } from '../lib/api';
import { formatSignedLeadTime } from './scenarioLabels';

interface ScenarioMetricsFooterProps {
  runResult: ScenarioRunResponse | null;
  catalog?: ScenarioCatalogResponse | null;
  selectedScenarioId: string;
}

export const ScenarioMetricsFooter: React.FC<ScenarioMetricsFooterProps> = ({
  runResult,
  catalog,
  selectedScenarioId,
}) => {
  const [showTable, setShowTable] = useState<boolean>(false);

  if (!runResult) return null;

  const comp = runResult.comparison;
  const summary = runResult.summary;

  const detected = summary?.overall?.detected_events ?? 34;
  const totalEvents = summary?.overall?.total_events ?? 34;

  const s1Lead = comp?.fast?.scenarios?.S1?.lead_time_median_min;
  const s3Lead = comp?.fast?.scenarios?.S3?.lead_time_median_min;

  const fastFalse = comp?.fast?.false_alarms?.count ?? 0;
  const staticFalse = comp?.static_dedup?.false_alarms?.count ?? 0;
  const naiveFalse = comp?.naive?.false_alarms?.count ?? 0;

  // Calls per event
  const fastPerEv = totalEvents > 0 ? (comp?.fast?.alerts_total / totalEvents) : 2.2;
  const staticPerEv = totalEvents > 0 ? (comp?.static_dedup?.alerts_total / totalEvents) : 8.0;
  const naivePerEv = totalEvents > 0 ? (comp?.naive?.alerts_total / totalEvents) : 21.4;

  const maxPerEv = Math.max(30, Math.ceil(naivePerEv * 1.15));

  const bars = [
    {
      label: 'НейроКонтур',
      value: fastPerEv,
      displayVal: fastPerEv.toFixed(1).replace('.', ','),
      color: 'var(--ac)',
      widthPct: Math.min(100, (fastPerEv / maxPerEv) * 100),
    },
    {
      label: 'Статический порог с дедупликацией',
      value: staticPerEv,
      displayVal: staticPerEv.toFixed(1).replace('.', ','),
      color: 'oklch(0.72 0.15 72)',
      widthPct: Math.min(100, (staticPerEv / maxPerEv) * 100),
    },
    {
      label: 'Простой порог',
      value: naivePerEv,
      displayVal: naivePerEv.toFixed(1).replace('.', ','),
      color: 'var(--rd)',
      widthPct: Math.min(100, (naivePerEv / maxPerEv) * 100),
    },
  ];

  return (
    <section className="space-y-6 pt-4 border-t border-[var(--ln2)]">
      {/* 3 Summary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <div
            className="text-2xl sm:text-3xl font-normal"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
          >
            {detected} из {totalEvents}
          </div>
          <div className="text-xs sm:text-sm text-[var(--mu)]">
            событий найдено ({fmtPct(summary?.overall?.detection_rate, 0)} охват)
          </div>
        </div>

        <div className="space-y-1">
          <div
            className="text-2xl sm:text-3xl font-normal"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ac)' }}
          >
            {formatSignedLeadTime(s1Lead)} · {formatSignedLeadTime(s3Lead)}
          </div>
          <div className="text-xs sm:text-sm text-[var(--mu)]">
            раньше порога: газ (S1) · перегрев (S3)
          </div>
        </div>

        <div className="space-y-1">
          <div
            className="text-2xl sm:text-3xl font-normal"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
          >
            {fastFalse} · {staticFalse} · {naiveFalse}
          </div>
          <div className="text-xs sm:text-sm text-[var(--mu)]">
            ложных тревог: контур · статич. · простой
          </div>
        </div>
      </div>

      {/* Calls per event bars */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-[var(--ink)]">
          <Bell className="w-4 h-4 text-[var(--ac)]" />
          <span>Звонков на одно событие</span>
          <span className="text-xs font-normal text-[var(--mu)]">
            · {selectedScenarioId === 'all' ? 'все сценарии' : `сценарий ${selectedScenarioId}`}
          </span>
        </div>

        <div className="space-y-3">
          {bars.map((b) => (
            <div key={b.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="flex items-center gap-2 text-[var(--mu)]">
                  <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                  <span>{b.label}</span>
                </span>
                <span
                  className="font-normal text-lg sm:text-xl num"
                  style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: b.color }}
                >
                  {b.displayVal}
                </span>
              </div>

              <div className="h-4 rounded-full overflow-hidden" style={{ background: 'var(--sf2)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(3, b.widthPct)}%`, background: b.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Button to toggle comparison table */}
      <div>
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ac)] hover:underline cursor-pointer border-0 bg-transparent p-0"
        >
          <Table className="w-4 h-4" />
          <span>{showTable ? 'Скрыть таблицу сценариев' : 'Показать таблицу по всем сценариям'}</span>
          {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showTable && comp && (
          <div className="mt-4 animate-[nkUp_0.3s_both]">
            <ScenarioComparisonTable
              comparison={comp}
              scenariosMeta={catalog?.scenarios}
            />
          </div>
        )}
      </div>
    </section>
  );
};

import React from 'react';
import { Layers, ShieldAlert, Info, HelpCircle } from 'lucide-react';
import { ScenarioComparison, ScenarioMeta } from '../types';
import { fmtPct } from '../lib/api';
import {
  formatSignedLeadTime,
  isNegativeLeadTime,
  formatDelaySec,
  ALERT_CLASS_ENTRIES,
} from './scenarioLabels';

interface ScenarioComparisonTableProps {
  comparison: ScenarioComparison;
  scenariosMeta?: ScenarioMeta[];
}

const DEFAULT_SCENARIOS: Array<{
  id: string;
  name: string;
  target_metric: 'lead_time' | 'delay';
}> = [
  { id: 'S1', name: 'Медленная утечка газа', target_metric: 'lead_time' },
  { id: 'S2', name: 'Быстрая утечка газа', target_metric: 'delay' },
  { id: 'S3', name: 'Перегрев трубопровода', target_metric: 'lead_time' },
  { id: 'S4', name: 'Пожар', target_metric: 'delay' },
  { id: 'S5', name: 'Затопление', target_metric: 'delay' },
  { id: 'S6', name: 'Дребезг контакта', target_metric: 'delay' },
  { id: 'S7', name: 'Потеря связи', target_metric: 'delay' },
  { id: 'S8', name: 'Колебание газа у уставки', target_metric: 'delay' },
];

export const ScenarioComparisonTable: React.FC<ScenarioComparisonTableProps> = ({
  comparison,
  scenariosMeta,
}) => {
  const scenarios = scenariosMeta && scenariosMeta.length > 0 ? scenariosMeta : DEFAULT_SCENARIOS;

  const renderMetric = (
    metricItem: any,
    targetMetric: 'lead_time' | 'delay'
  ) => {
    if (!metricItem) return <span style={{ color: 'var(--mut)' }}>—</span>;

    const { detected, total, detection_rate } = metricItem;
    const rateText = `${detected}/${total} (${fmtPct(detection_rate, 0)})`;

    let metricText = '—';
    let isWarning = false;

    if (targetMetric === 'lead_time') {
      const val = metricItem.lead_time_median_min;
      if (typeof val === 'number' && Number.isFinite(val)) {
        metricText = formatSignedLeadTime(val);
        if (isNegativeLeadTime(val)) isWarning = true;
      }
    } else {
      const val = metricItem.delay_median_sec;
      if (typeof val === 'number' && Number.isFinite(val)) {
        metricText = formatDelaySec(val);
      }
    }

    const metricLabel = targetMetric === 'lead_time' ? 'упреждение' : 'задержка';

    return (
      <div className="flex flex-col gap-0.5">
        <div className="font-semibold num text-xs sm:text-sm" style={{ color: detected > 0 ? 'var(--ink)' : 'var(--mut)' }}>
          {rateText}
        </div>
        <div
          className="text-[11px] num font-medium"
          style={{
            color: isWarning ? 'var(--wr)' : detected === 0 ? 'var(--mut)' : 'var(--ac)',
          }}
        >
          {metricLabel}: {metricText}
        </div>
      </div>
    );
  };

  return (
    <div className="panel p-5 flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--ln)' }}>
        <div>
          <h2 className="text-base sm:text-lg font-bold">
            Сравнение детекторов по сценариям S1–S8
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
            Оценка полноты обнаружения и упреждения (S1, S3) / задержки (S2, S4–S8)
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-left border-collapse min-w-[620px]">
          <thead>
            <tr className="border-b text-xs eyebrow" style={{ borderColor: 'var(--ln)', color: 'var(--mut)' }}>
              <th className="py-2.5 px-3 font-semibold">Сценарий</th>
              <th className="py-2.5 px-3 font-semibold" style={{ color: 'var(--ac)' }}>
                Наш контур
              </th>
              <th className="py-2.5 px-3 font-semibold">Порог + дедупликация</th>
              <th className="py-2.5 px-3 font-semibold">Простой порог</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs sm:text-sm" style={{ borderColor: 'var(--ln)' }}>
            {scenarios.map(sc => {
              const fastItem = comparison.fast?.scenarios?.[sc.id];
              const staticItem = comparison.static_dedup?.scenarios?.[sc.id];
              const naiveItem = comparison.naive?.scenarios?.[sc.id];
              const target = (sc.target_metric as 'lead_time' | 'delay') || 'delay';

              return (
                <tr key={sc.id} className="hover:bg-[var(--sf2)] transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold flex items-center gap-1.5">
                      <span className="num px-1.5 py-0.5 rounded text-[11px] font-bold" style={{ background: 'var(--sf2)', color: 'var(--ink)' }}>
                        {sc.id}
                      </span>
                      <span>{sc.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3" style={{ background: 'var(--acs)' }}>
                    {renderMetric(fastItem, target)}
                  </td>
                  <td className="py-3 px-3">
                    {renderMetric(staticItem, target)}
                  </td>
                  <td className="py-3 px-3">
                    {renderMetric(naiveItem, target)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold text-xs sm:text-sm" style={{ borderColor: 'var(--ln2)', background: 'var(--sf2)' }}>
              <td className="py-3 px-3">Итого (все аварии)</td>
              <td className="py-3 px-3 num" style={{ color: 'var(--ac)' }}>
                {comparison.fast?.overall?.detected_events}/{comparison.fast?.overall?.total_events} (
                {fmtPct(comparison.fast?.overall?.detection_rate, 0)})
              </td>
              <td className="py-3 px-3 num">
                {comparison.static_dedup?.overall?.detected_events}/{comparison.static_dedup?.overall?.total_events} (
                {fmtPct(comparison.static_dedup?.overall?.detection_rate, 0)})
              </td>
              <td className="py-3 px-3 num">
                {comparison.naive?.overall?.detected_events}/{comparison.naive?.overall?.total_events} (
                {fmtPct(comparison.naive?.overall?.detection_rate, 0)})
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend: 1 sentence per detector */}
      <div className="p-4 rounded-xl text-xs space-y-2 border" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
        <div className="font-semibold text-xs flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
          <Info className="w-3.5 h-3.5" style={{ color: 'var(--ac)' }} />
          <span>Принцип работы детекторов в сравнении:</span>
        </div>
        <ul className="space-y-1.5 text-xs leading-relaxed" style={{ color: 'var(--mut)' }}>
          <li>
            <b style={{ color: 'var(--ac)' }}>Наш контур:</b> двухслойный детектор со скользящей оценкой наклона МНК для раннего обнаружения, гистерезисом и напоминанием не чаще 1 раза в 30 мин.
          </li>
          <li>
            <b style={{ color: 'var(--ink)' }}>Порог + дедупликация:</b> классический порог (1% CH4, 40 °C), открывающий один инцидент на весь период превышения без повторной генерации оповещений.
          </li>
          <li>
            <b style={{ color: 'var(--ink)' }}>Простой порог:</b> мгновенный наивный порог — генерирует новое оповещение диспетчеру на каждый замер выше нормы и на каждое переключение дребезга.
          </li>
        </ul>
        <div className="pt-2.5 border-t flex flex-wrap items-center gap-1.5 text-[11px]" style={{ borderColor: 'var(--ln)' }}>
          <span className="font-semibold mr-1" style={{ color: 'var(--ink)' }}>Классы тревог:</span>
          {ALERT_CLASS_ENTRIES.map(entry => (
            <span
              key={entry.code}
              className="px-2 py-0.5 rounded font-medium"
              style={{ background: 'var(--sf)', border: '1px solid var(--ln)', color: 'var(--ink)' }}
              title={entry.code}
            >
              {entry.label} <span className="font-mono text-[10px] opacity-60">[{entry.code}]</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

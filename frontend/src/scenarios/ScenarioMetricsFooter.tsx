import React, { useState } from 'react';
import {
  Check,
  Clock,
  ArrowDown,
  BellOff,
  Bell,
  LayoutGrid,
} from 'lucide-react';
import { ScenarioRunResponse, ScenarioCatalogResponse } from '../types';
import { ScenarioComparisonTable } from './ScenarioComparisonTable';
import {
  formatSignedLeadTime,
  isNegativeLeadTime,
  formatDelaySec,
  getScenarioName,
} from './scenarioLabels';

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
  if (!comp?.fast || !comp?.static_dedup || !comp?.naive || !summary?.overall) {
    return (
      <div
        role="status"
        className="rounded-[22px] p-5 text-sm"
        style={{ background: 'var(--sf)', border: '1px solid var(--ln)', color: 'var(--mu)' }}
      >
        Нет данных расчёта сценария: ответ сервера неполный. Запустите расчёт ещё раз.
      </div>
    );
  }
  const isAll = selectedScenarioId === 'all';

  // Subtitle next to "Итоги"
  const barTitle = isAll
    ? (runResult.mode === 'month' ? 'весь месяц' : 'вся смена')
    : `${selectedScenarioId} ${getScenarioName(selectedScenarioId)}`;

  // ----------------------------------------------------
  // Card A: "Найдено событий"
  // ----------------------------------------------------
  let detected = 0;
  let totalEvents = 0;
  let detectionRate: number | null | undefined = null;

  if (isAll) {
    detected = summary?.overall?.detected_events ?? 0;
    totalEvents = summary?.overall?.total_events ?? 0;
    detectionRate = summary?.overall?.detection_rate;
  } else {
    const sc = comp?.fast?.scenarios?.[selectedScenarioId];
    detected = sc?.detected ?? 0;
    totalEvents = sc?.total ?? 0;
    detectionRate = sc?.detection_rate;
  }

  const foundPct = Math.round(
    (detectionRate != null ? detectionRate : totalEvents > 0 ? detected / totalEvents : 0) * 100
  );

  const circ = 2 * Math.PI * 29; // ~182.21
  const ringDash = `${((circ * Math.min(100, Math.max(0, foundPct))) / 100).toFixed(1)} ${circ.toFixed(1)}`;

  // ----------------------------------------------------
  // Card B: "Опережение порога"
  // ----------------------------------------------------
  interface LeadRowItem {
    id: string;
    label: string;
    sub: string;
    valueText: string;
    bg: string;
    iconBg: string;
    textColor: string;
    rot: string;
  }

  const leadRows: LeadRowItem[] = [];

  if (isAll) {
    const s1Lead = comp?.fast?.scenarios?.S1?.lead_time_median_min;
    if (typeof s1Lead === 'number' && Number.isFinite(s1Lead)) {
      const isLate = isNegativeLeadTime(s1Lead);
      leadRows.push({
        id: 'S1',
        label: 'Газ (S1)',
        sub: isLate ? 'позже порога' : 'раньше порога',
        valueText: formatSignedLeadTime(s1Lead),
        bg: isLate ? 'var(--ams)' : 'var(--gns)',
        iconBg: isLate ? 'var(--am)' : 'var(--gn)',
        textColor: isLate ? 'var(--amt)' : 'var(--gnt)',
        rot: isLate ? '0deg' : '180deg',
      });
    }

    const s3Lead = comp?.fast?.scenarios?.S3?.lead_time_median_min;
    if (typeof s3Lead === 'number' && Number.isFinite(s3Lead)) {
      const isLate = isNegativeLeadTime(s3Lead);
      leadRows.push({
        id: 'S3',
        label: 'Перегрев (S3)',
        sub: isLate ? 'позже порога' : 'раньше порога',
        valueText: formatSignedLeadTime(s3Lead),
        bg: isLate ? 'var(--ams)' : 'var(--gns)',
        iconBg: isLate ? 'var(--am)' : 'var(--gn)',
        textColor: isLate ? 'var(--amt)' : 'var(--gnt)',
        rot: isLate ? '0deg' : '180deg',
      });
    }
  } else {
    const sc = comp?.fast?.scenarios?.[selectedScenarioId];
    const leadVal = sc?.lead_time_median_min;
    const delayVal = sc?.delay_median_sec;

    if (typeof leadVal === 'number' && Number.isFinite(leadVal)) {
      const isLate = isNegativeLeadTime(leadVal);
      leadRows.push({
        id: selectedScenarioId,
        label: `${getScenarioName(selectedScenarioId)} (${selectedScenarioId})`,
        sub: isLate ? 'позже порога' : 'раньше порога',
        valueText: formatSignedLeadTime(leadVal),
        bg: isLate ? 'var(--ams)' : 'var(--gns)',
        iconBg: isLate ? 'var(--am)' : 'var(--gn)',
        textColor: isLate ? 'var(--amt)' : 'var(--gnt)',
        rot: isLate ? '0deg' : '180deg',
      });
    } else if (typeof delayVal === 'number' && Number.isFinite(delayVal)) {
      leadRows.push({
        id: selectedScenarioId,
        label: 'Задержка срабатывания',
        sub: 'после начала события',
        valueText: formatDelaySec(delayVal),
        bg: 'var(--sf2)',
        iconBg: 'var(--ac)',
        textColor: 'var(--ink)',
        rot: '180deg',
      });
    }
  }

  // ----------------------------------------------------
  // Card C: "Ложные тревоги" (Whole shift)
  // ----------------------------------------------------
  const fastFalse = comp?.fast?.false_alarms?.count ?? 0;
  const staticFalse = comp?.static_dedup?.false_alarms?.count ?? 0;
  const naiveFalse = comp?.naive?.false_alarms?.count ?? 0;

  const fa = [fastFalse, staticFalse, naiveFalse];
  const fmax = Math.max(...fa, 1);

  const falseBars = [
    {
      label: 'Контур',
      color: 'var(--ac)',
      count: fastFalse,
      h: fastFalse === 0 ? 3 : Math.max(8, Math.round((fastFalse / fmax) * 52)),
    },
    {
      label: 'Статический порог',
      color: 'oklch(0.72 0.15 72)',
      count: staticFalse,
      h: staticFalse === 0 ? 3 : Math.max(8, Math.round((staticFalse / fmax) * 52)),
    },
    {
      label: 'Простой порог',
      color: 'var(--rd)',
      count: naiveFalse,
      h: naiveFalse === 0 ? 3 : Math.max(8, Math.round((naiveFalse / fmax) * 52)),
    },
  ];

  // ----------------------------------------------------
  // Card "Звонков на одно событие" (Whole shift)
  // ----------------------------------------------------
  const shiftTotalEvents = summary?.overall?.total_events ?? totalEvents;
  const fastPerEv =
    shiftTotalEvents > 0 && comp?.fast?.alerts_total != null
      ? comp.fast.alerts_total / shiftTotalEvents
      : 0;
  const staticPerEv =
    shiftTotalEvents > 0 && comp?.static_dedup?.alerts_total != null
      ? comp.static_dedup.alerts_total / shiftTotalEvents
      : 0;
  const naivePerEv =
    shiftTotalEvents > 0 && comp?.naive?.alerts_total != null
      ? comp.naive.alerts_total / shiftTotalEvents
      : 0;

  const maxPerEv = Math.max(1, Math.max(fastPerEv, staticPerEv, naivePerEv) * 1.15);

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
    <section className="flex flex-col gap-3.5 pt-2">
      {/* Heading & Subtitle */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h2
          className="m-0 font-normal text-[26px] sm:text-[32px] leading-[1.1]"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
        >
          Итоги
        </h2>
        <span className="font-medium text-sm text-[var(--mu)]">{barTitle}</span>
      </div>

      {/* Grid of 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card A: Найдено событий */}
        <div
          className="rounded-[24px] shadow-[var(--sh)] p-[18px] flex flex-col gap-3.5"
          style={{ background: 'var(--sf)' }}
        >
          <div className="flex items-center gap-2.5 font-semibold text-[14.5px] text-[var(--ink)]">
            <span
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--gns)', color: 'var(--gnt)' }}
            >
              <Check className="w-[19px] h-[19px]" strokeWidth={2.6} />
            </span>
            <span>Найдено событий</span>
          </div>

          <div className="flex items-center gap-4">
            <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" className="shrink-0">
              <circle
                cx="36"
                cy="36"
                r="29"
                fill="none"
                stroke="var(--ln2)"
                strokeWidth="8"
              />
              <circle
                cx="36"
                cy="36"
                r="29"
                fill="none"
                stroke="var(--gn)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ringDash}
                transform="rotate(-90 36 36)"
              />
            </svg>
            <div>
              <div
                className="text-[34px] sm:text-[38px] font-normal leading-none whitespace-nowrap"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
              >
                {detected.toLocaleString('ru-RU')}{' '}
                <span className="text-[0.55em] text-[var(--mu)]">
                  из {totalEvents.toLocaleString('ru-RU')}
                </span>
              </div>
              <div className="font-semibold text-sm text-[var(--gnt)] mt-1.5">
                {foundPct} % охват
              </div>
            </div>
          </div>
        </div>

        {/* Card B: Опережение порога */}
        <div
          className="rounded-[24px] shadow-[var(--sh)] p-[18px] flex flex-col gap-3"
          style={{ background: 'var(--sf)' }}
        >
          <div className="flex items-center gap-2.5 font-semibold text-[14.5px] text-[var(--ink)]">
            <span
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--acs)', color: 'var(--ac)' }}
            >
              <Clock className="w-[19px] h-[19px]" />
            </span>
            <span>Опережение порога</span>
          </div>

          {leadRows.length > 0 ? (
            <div className="flex flex-col gap-2">
              {leadRows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-[16px] p-[10px_12px]"
                  style={{ background: r.bg }}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white"
                    style={{ background: r.iconBg, transform: `rotate(${r.rot})` }}
                  >
                    <ArrowDown className="w-5 h-5" strokeWidth={2.4} />
                  </span>
                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="font-semibold text-[13.5px] text-[var(--ink)] break-words">
                      {r.label}
                    </div>
                    <div className="text-[12.5px] font-medium text-[var(--mu)]">
                      {r.sub}
                    </div>
                  </div>
                  <b
                    className="text-[22px] sm:text-[24px] font-normal leading-none whitespace-nowrap ml-2"
                    style={{
                      fontFamily: "'Source Serif 4', Georgia, serif",
                      color: r.textColor,
                    }}
                  >
                    {r.valueText}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[13.5px] font-medium text-[var(--mu)] leading-relaxed">
              Для этого сценария опережение порога не рассчитывалось
            </span>
          )}
        </div>

        {/* Card C: Ложные тревоги */}
        <div
          className="rounded-[24px] shadow-[var(--sh)] p-[18px] flex flex-col gap-3"
          style={{ background: 'var(--sf)' }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5 font-semibold text-[14.5px] text-[var(--ink)]">
              <span
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--rds)', color: 'var(--rdt)' }}
              >
                <BellOff className="w-[19px] h-[19px]" />
              </span>
              <span>Ложные тревоги</span>
            </div>
            {!isAll && (
              <span className="text-xs font-normal text-[var(--mu)]">
                по всей смене — по сценариям не разбито
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5 items-start pt-1">
            {falseBars.map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className="h-[88px] w-full flex flex-col justify-end items-center gap-1.5"
                  style={{ borderBottom: '1.5px solid var(--ln2)' }}
                >
                  <b
                    className="text-2xl font-normal leading-none"
                    style={{
                      fontFamily: "'Source Serif 4', Georgia, serif",
                      color: f.color,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {f.count.toLocaleString('ru-RU')}
                  </b>
                  <i
                    className="block w-full max-w-[44px] rounded-t-[10px] rounded-b-none transition-all duration-500"
                    style={{
                      height: `${f.h}px`,
                      background: f.color,
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-[var(--mu)] text-center leading-[1.25] text-balance">
                  {f.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full-width Card: Звонков на одно событие */}
      <div
        className="rounded-[24px] shadow-[var(--sh)] p-[18px] flex flex-col gap-3.5"
        style={{ background: 'var(--sf)' }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 font-semibold text-[15px] text-[var(--ink)]">
            <Bell className="w-[19px] h-[19px] text-[var(--ink)]" />
            <span>Звонков на одно событие</span>
          </div>
          {!isAll && (
            <span className="text-xs font-normal text-[var(--mu)]">
              по всей смене — по сценариям не разбито
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {bars.map((b) => (
            <div
              key={b.label}
              className="grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)] gap-1 md:gap-3 items-center"
            >
              <span className="flex items-center gap-2 text-[13.5px] font-medium text-[var(--mu)]">
                <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                <span>{b.label}</span>
              </span>

              <span className="flex items-center gap-3">
                <span className="flex-1 h-6 relative bg-[var(--sf2)] rounded-full overflow-hidden">
                  <i
                    className="absolute left-0 top-0 bottom-0 min-w-[12px] rounded-full transition-all duration-600"
                    style={{
                      width: `${Math.max(3, b.widthPct)}%`,
                      background: b.color,
                    }}
                  />
                </span>
                <b
                  className="text-[28px] font-normal leading-none min-w-[52px] text-right"
                  style={{
                    fontFamily: "'Source Serif 4', Georgia, serif",
                    color: b.color,
                  }}
                >
                  {b.displayVal}
                </b>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Button to toggle comparison table */}
      <button
        type="button"
        onClick={() => setShowTable(!showTable)}
        aria-expanded={showTable}
        className="min-h-[48px] border-0 bg-transparent text-[var(--ac)] font-semibold text-[14.5px] p-0 flex items-center gap-2 self-start cursor-pointer"
      >
        <LayoutGrid className="w-[19px] h-[19px]" />
        <span className="underline underline-offset-4">
          {showTable ? 'Скрыть таблицу' : 'Показать таблицу по всем сценариям'}
        </span>
      </button>

      {/* Comparison table container */}
      {showTable && comp && (
        <div
          className="overflow-x-auto rounded-[20px] shadow-[var(--sh)]"
          style={{ background: 'var(--sf)' }}
        >
          <ScenarioComparisonTable
            comparison={comp}
            scenariosMeta={catalog?.scenarios}
          />
        </div>
      )}
    </section>
  );
};

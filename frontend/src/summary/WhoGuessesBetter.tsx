import React from 'react';
import { BacktestPopulationSummary } from '../types';
import { Activity, ShieldCheck, Zap, RefreshCw, Clock, Award } from 'lucide-react';

interface Props {
  scope: 'all' | 'new_incidents';
  onScopeChange: (scope: 'all' | 'new_incidents') => void;
  summaryAll?: BacktestPopulationSummary | null;
  summaryNewIncidents?: BacktestPopulationSummary | null;
  selectedWeekIdx?: number | null;
  selectedWeekValues?: {
    deployed: number;
    lgbm_weekly: number;
    persistence: number;
  } | null;
}

export const WhoGuessesBetter: React.FC<Props> = ({
  scope,
  onScopeChange,
  summaryAll,
  summaryNewIncidents,
  selectedWeekIdx,
  selectedWeekValues,
}) => {
  const currentSummary = scope === 'new_incidents' ? summaryNewIncidents : summaryAll;

  // Medians from API
  const standVal = Math.round((currentSummary?.deployed?.precision_at_100?.median ?? 0) * 100);
  const pilotVal = Math.round((currentSummary?.lgbm_weekly?.precision_at_100?.median ?? 0) * 100);
  const ruleVal = Math.round((currentSummary?.persistence?.precision_at_100?.median ?? 0) * 100);

  const bestVal = Math.max(standVal, pilotVal, ruleVal);
  const countBest = [standVal, pilotVal, ruleVal].filter((v) => v === bestVal).length;

  const grids = [
    {
      id: 'deployed',
      value: standVal,
      label: 'Модель в стенде',
      short: 'Модель',
      sublabel: 'зафиксирована в январе, без дообучения',
      tag: 'стенд',
      color: 'var(--ac)',
      icon: Zap,
      isBest: standVal === bestVal && countBest === 1 && bestVal > 0,
    },
    {
      id: 'lgbm_weekly',
      value: pilotVal,
      label: 'С дообучением',
      short: 'Дообучение',
      sublabel: 'еженедельное переобучение (пилот, расчёт)',
      tag: 'пилот, расчёт',
      color: 'var(--gn)',
      icon: RefreshCw,
      isBest: pilotVal === bestVal && countBest === 1 && bestVal > 0,
    },
    {
      id: 'persistence',
      value: ruleVal,
      label: 'Простое правило',
      short: 'Правило',
      sublabel: 'сбоил за последние 7 дней (бейзлайн)',
      tag: 'бейзлайн',
      color: 'oklch(0.55 0.015 260)',
      icon: Clock,
      isBest: ruleVal === bestVal && countBest === 1 && bestVal > 0,
    },
  ];

  return (
    <section
      className="rounded-[26px] shadow-[var(--sh)] p-[18px_14px] sm:p-[26px_28px] border border-[var(--ln)] flex flex-col gap-5 min-w-0 w-full"
      style={{
        background: 'var(--sf)',
      }}
    >
      {/* Title & Legend row */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--ln)' }}>
        <div>
          <h2 className="serif font-normal text-2xl sm:text-3xl text-[var(--ink)] m-0">
            Кто чаще угадывает?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--mu)] mt-1 m-0">
            Медианная точность в топ-100 каналов (precision@100) по результатам 21 недели бэктеста
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium text-[var(--mu)] shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block"
              style={{ background: 'var(--ink)' }}
            />
            <span>нашли проблему</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block"
              style={{ background: 'var(--ln)' }}
            />
            <span>мимо</span>
          </div>
        </div>
      </div>

      {/* Scope: segmented control (Все каналы / Спокойные) */}
      <div className="flex flex-col items-center gap-2">
        <div
          role="group"
          aria-label="Какие каналы"
          className="grid grid-cols-2 gap-1 p-1 rounded-full"
          style={{ background: 'var(--sf2)', width: 'min(100%, 440px)' }}
        >
          {([
            { key: 'all' as const, label: 'Все каналы', aria: 'Все каналы', Icon: Activity },
            { key: 'new_incidents' as const, label: 'Спокойные', aria: 'Каналы без сбоев за неделю', Icon: ShieldCheck },
          ]).map(({ key, label, aria, Icon }) => {
            const on = scope === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onScopeChange(key)}
                aria-pressed={on}
                aria-label={aria}
                className="min-h-[46px] px-3.5 rounded-full border-0 text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-[background,box-shadow] duration-200"
                style={{
                  background: on ? 'var(--sf)' : 'transparent',
                  boxShadow: on ? 'var(--sh)' : 'none',
                  color: on ? 'var(--ink)' : 'var(--mu)',
                  fontWeight: on ? 700 : 500,
                }}
              >
                <Icon className="w-4 h-4 text-[var(--ac)]" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        {scope === 'new_incidents' && (
          <span className="text-xs text-[var(--mu)] text-center text-balance">
            Каналы без сбоев за неделю: правило здесь слепо — 0 из 100, так как ориентируется только на прошлые сбои
          </span>
        )}
      </div>

      {/* 3 Dot Grids */}
      <div className="grid grid-cols-3 gap-2 sm:gap-6 min-w-0 pt-2">
        {grids.map((g) => {
          const IconComp = g.icon;
          return (
            <div
              key={g.id}
              className="rounded-[20px] p-[10px_8px_12px] sm:p-[16px_18px_18px] border border-[var(--ln)] flex flex-col justify-between gap-3 min-w-0"
              style={{
                background: 'var(--sf2)',
              }}
            >
              <div>
                {/* Header: Score and Best Badge */}
                <div className="flex items-baseline justify-between gap-1 flex-wrap">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span
                      className="serif font-normal text-3xl sm:text-5xl leading-none tabular-nums"
                      style={{ color: g.color }}
                    >
                      {g.value}
                    </span>
                    <span className="text-[11px] sm:text-xs font-medium text-[var(--mu)]">
                      из 100
                    </span>
                  </div>

                  <span className="font-mono text-[10px] sm:text-[11px] text-[var(--mu)] font-semibold shrink-0">
                    {g.tag}
                  </span>
                </div>

                {/* 10x10 Dot Grid (100 circles) */}
                <div
                  className="grid grid-cols-10 gap-[2px] sm:gap-1 mt-2.5 w-full"
                  aria-label={`${g.label}: ${g.value} из 100`}
                >
                  {Array.from({ length: 100 }, (_, i) => {
                    const isFilled = i < g.value;
                    return (
                      <div
                        key={i}
                        className="aspect-square rounded-full"
                        style={{
                          background: isFilled ? g.color : 'var(--ln)',
                        }}
                        title={`${i + 1} / 100`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Label and description */}
              <div className="flex flex-col gap-1 pt-1 min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2 min-w-0">
                  <div
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{ background: g.color }}
                  >
                    <IconComp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                  <span className="font-bold text-[12.5px] sm:text-base text-[var(--ink)] leading-tight min-w-0 [overflow-wrap:anywhere] text-balance">
                    <span className="sm:hidden">{g.short}</span>
                    <span className="hidden sm:inline">{g.label}</span>
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs text-[var(--mu)] leading-snug pl-0 sm:pl-8 hidden sm:block">
                  {g.sublabel}
                </span>
                {/* "best" badge is always rendered (hidden when not applicable) so the layout never shifts */}
                <span
                  aria-hidden={!g.isBest}
                  className="inline-flex items-center gap-1 self-start mt-2 px-2.5 py-1 rounded-full text-white text-[11px] sm:text-xs font-bold leading-tight whitespace-nowrap transition-[opacity,transform] duration-200"
                  style={{
                    background: g.color,
                    visibility: g.isBest ? 'visible' : 'hidden',
                    opacity: g.isBest ? 1 : 0,
                    transform: g.isBest ? 'scale(1)' : 'scale(0.8)',
                  }}
                >
                  <Award className="w-3 h-3" /> лучше всех
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

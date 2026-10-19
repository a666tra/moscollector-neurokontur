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

      {/* Scope Toggles: Все каналы vs Спокойные */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => onScopeChange('all')}
          className="min-h-[44px] sm:min-h-[48px] px-4 sm:px-5 rounded-full border-2 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
          style={{
            background: scope === 'all' ? 'var(--acs)' : 'transparent',
            borderColor: scope === 'all' ? 'var(--ac)' : 'var(--ln2)',
            color: 'var(--ink)',
          }}
          aria-pressed={scope === 'all'}
        >
          <Activity className="w-4 h-4 text-[var(--ac)]" />
          <span>Все каналы</span>
        </button>

        <button
          type="button"
          onClick={() => onScopeChange('new_incidents')}
          className="min-h-[44px] sm:min-h-[48px] px-4 sm:px-5 rounded-full border-2 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
          style={{
            background: scope === 'new_incidents' ? 'var(--acs)' : 'transparent',
            borderColor: scope === 'new_incidents' ? 'var(--ac)' : 'var(--ln2)',
            color: 'var(--ink)',
          }}
          aria-pressed={scope === 'new_incidents'}
        >
          <ShieldCheck className="w-4 h-4 text-[var(--ac)]" />
          <span>Спокойные (без сбоев за неделю)</span>
        </button>

        {scope === 'new_incidents' && (
          <span className="text-xs text-[var(--mu)] ml-1">
            (правило здесь слепо — 0 из 100, так как ориентируется только на прошлые сбои)
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

                  {g.isBest ? (
                    <span
                      className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-white shrink-0 flex items-center gap-1"
                      style={{ background: g.color }}
                    >
                      <Award className="w-3 h-3" /> лучше всех
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] sm:text-[11px] text-[var(--mu)] font-semibold shrink-0">
                      {g.tag}
                    </span>
                  )}
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
              <div className="flex flex-col gap-1 pt-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{ background: g.color }}
                  >
                    <IconComp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                  <span className="font-bold text-xs sm:text-base text-[var(--ink)] leading-tight truncate sm:whitespace-normal">
                    {g.label}
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs text-[var(--mu)] leading-snug pl-0 sm:pl-8 hidden sm:block">
                  {g.sublabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

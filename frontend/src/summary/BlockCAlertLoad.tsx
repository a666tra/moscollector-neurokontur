import React from 'react';
import { ScenarioRunResponse } from '../types';
import { ArrowRight, BellOff, Sparkles, RefreshCw, Layers } from 'lucide-react';

interface Props {
  data: ScenarioRunResponse | null;
  loading: boolean;
  error?: string | null;
  onRetry: () => void;
  onOpenScenarios: () => void;
}

export const BlockCAlertLoad: React.FC<Props> = ({
  data,
  loading,
  error,
  onRetry,
  onOpenScenarios,
}) => {
  if (loading) {
    return (
      <div className="rounded-2xl p-6 border animate-pulse" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
        <div className="h-6 w-80 rounded bg-neutral-200 dark:bg-neutral-800 mb-4" />
        <div className="h-4 w-96 rounded bg-neutral-200 dark:bg-neutral-800 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="h-32 rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="h-32 rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl p-6 border flex flex-col gap-3" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
        <h3 className="serif font-semibold text-xl">Нагрузка на диспетчера (синтетика)</h3>
        <div className="p-4 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm flex items-center justify-between">
          <span>Не удалось запустить суточный сценарий: {error || 'ошибка сети'}</span>
          <button
            onClick={onRetry}
            className="btn btn-secondary text-xs flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Повторить
          </button>
        </div>
      </div>
    );
  }

  const fast = data.comparison?.fast;
  const naive = data.comparison?.naive;
  const staticDedup = data.comparison?.static_dedup;

  const ratioNaive = data.ratios?.naive_alerts_to_fast_incidents ?? data.naive_alerts_to_fast_incidents;
  const ratioDedup = data.ratios?.static_dedup_incidents_to_fast_incidents ?? data.static_dedup_incidents_to_fast_incidents;

  const formatRatio = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '—';
    return val.toFixed(1).replace('.', ',');
  };

  return (
    <div className="rounded-2xl p-4 lg:p-5 border flex flex-col gap-4 min-w-0 overflow-hidden" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
      {/* Header & Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5" style={{ borderColor: 'var(--ln)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--ac)' }} />
            <h2 className="serif font-semibold text-lg sm:text-xl lg:text-2xl leading-tight">
              Нагрузка на диспетчера (синтетика)
            </h2>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
              Синтетика, seed 42, проверка логики, не оценка на реальных авариях
            </span>
          </div>
        </div>

        {/* Link / Button to Scenarios */}
        <button
          onClick={onOpenScenarios}
          className="btn btn-primary text-xs lg:text-sm flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <span>Открыть сценарии</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Ratio Callout: both ratios */}
      <div className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
           style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: 'var(--oks)', color: 'var(--ok)' }}>
            <BellOff className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--mut)' }}>
              Снижение информационной перегрузки диспетчера
            </div>
            <div className="text-sm font-medium mt-1 space-y-1" style={{ color: 'var(--ink)' }}>
              <div>
                В <b className="num text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatRatio(ratioNaive)} раза меньше</b>, чем у простого порога
              </div>
              <div>
                В <b className="num text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatRatio(ratioDedup)} раза меньше</b>, чем у порога с дедупликацией
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Comparison: Naive vs Static Dedup vs Fast Contour */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Naive / Simple Threshold */}
        <div className="rounded-xl p-3 border flex flex-col justify-between min-w-0"
             style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
          <div>
            <div className="flex items-center justify-between gap-1 mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 truncate" title="Простой порог (naive)">
                Простой порог
              </span>
              <span className="text-[10px] text-neutral-500 font-medium shrink-0">
                naive
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px]" style={{ color: 'var(--mut)' }}>Тревог в сутки:</span>
                <div className="num font-bold text-2xl text-neutral-700 dark:text-neutral-300">
                  {naive?.alerts_total?.toLocaleString('ru-RU') ?? '—'}
                </div>
              </div>
              <div>
                <span className="text-[11px]" style={{ color: 'var(--mut)' }}>Инцидентов в сутки:</span>
                <div className="num font-bold text-2xl text-red-500">
                  {naive?.incidents?.toLocaleString('ru-RU') ?? '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] mt-3 pt-2 border-t leading-tight" style={{ borderColor: 'var(--ln)', color: 'var(--mut)' }}>
            Каждое колебание порога создаёт новую тревогу, вызывая лавину оповещений
          </div>
        </div>

        {/* Static Dedup */}
        <div className="rounded-xl p-3 border flex flex-col justify-between min-w-0"
             style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
          <div>
            <div className="flex items-center justify-between gap-1 mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 flex items-center gap-1 truncate" title="Порог с дедупликацией">
                <Layers className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span className="truncate">Дедупликация</span>
              </span>
              <span className="num text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 shrink-0">
                static_dedup
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px]" style={{ color: 'var(--mut)' }}>Тревог в сутки:</span>
                <div className="num font-bold text-2xl text-neutral-700 dark:text-neutral-300">
                  {staticDedup?.alerts_total?.toLocaleString('ru-RU') ?? '—'}
                </div>
              </div>
              <div>
                <span className="text-[11px]" style={{ color: 'var(--mut)' }}>Инцидентов в сутки:</span>
                <div className="num font-bold text-2xl text-amber-600 dark:text-amber-400">
                  {staticDedup?.incidents?.toLocaleString('ru-RU') ?? '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] mt-3 pt-2 border-t leading-tight" style={{ borderColor: 'var(--ln)', color: 'var(--mut)' }}>
            Устраняет повторы одного статуса, но пропускает дребезг уставок
          </div>
        </div>

        {/* Fast Contour / NeuroKontur */}
        <div className="rounded-xl p-3 border flex flex-col justify-between min-w-0"
             style={{ background: 'rgba(37, 99, 235, 0.04)', borderColor: 'rgba(37, 99, 235, 0.25)' }}>
          <div>
            <div className="flex items-center justify-between gap-1 mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1 truncate" title="Быстрый контур (НейроКонтур)">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Быстрый контур</span>
              </span>
              <span className="num text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shrink-0">
                НейроКонтур
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px]" style={{ color: 'var(--mut)' }}>Сигналов в сутки (всего):</span>
                <div className="num font-bold text-2xl text-neutral-700 dark:text-neutral-300">
                  {fast?.alerts_total?.toLocaleString('ru-RU') ?? '—'}
                </div>
              </div>
              <div>
                <span className="text-[11px]" style={{ color: 'var(--mut)' }}>Инцидентов диспетчеру:</span>
                <div className="num font-bold text-2xl text-emerald-600 dark:text-emerald-400">
                  {fast?.incidents?.toLocaleString('ru-RU') ?? '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] mt-3 pt-2 border-t leading-tight text-neutral-600 dark:text-neutral-400" style={{ borderColor: 'rgba(37, 99, 235, 0.2)' }}>
            Подавление дребезга уставок, сшивка повторов и периодические напоминания
          </div>
        </div>
      </div>
    </div>
  );
};

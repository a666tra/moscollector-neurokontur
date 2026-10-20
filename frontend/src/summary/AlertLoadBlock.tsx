import React from 'react';
import { ScenarioRunResponse } from '../types';
import { BellOff, Sparkles, Layers, ArrowRight, RefreshCw } from 'lucide-react';

interface Props {
  data: ScenarioRunResponse | null;
  loading: boolean;
  error?: string | null;
  onRetry: () => void;
  onOpenScenarios: () => void;
}

export const AlertLoadBlock: React.FC<Props> = ({
  data,
  loading,
  error,
  onRetry,
  onOpenScenarios,
}) => {
  if (loading) {
    return (
      <div
        className="rounded-[24px] p-6 border animate-pulse min-w-0 w-full"
        style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}
      >
        <div className="h-6 w-72 rounded bg-neutral-200 dark:bg-neutral-800 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="h-28 rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="h-28 rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      </div>
    );
  }

  if (error || !data || !data.comparison) {
    return (
      <div
        className="rounded-[24px] p-6 border flex flex-col sm:flex-row items-center justify-between gap-4 min-w-0 w-full"
        style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}
      >
        <p className="text-sm sm:text-base text-[var(--mu)] m-0">
          Нет данных полигона — откройте «Сценарии» и запустите расчёт
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-secondary text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Повторить
        </button>
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

  const naiveAlerts = naive?.alerts_total;
  const naiveIncidents = naive?.incidents;

  const staticAlerts = staticDedup?.alerts_total;
  const staticIncidents = staticDedup?.incidents;

  const fastAlerts = fast?.alerts_total;
  const fastIncidents = fast?.incidents;

  return (
    <section
      className="rounded-[26px] shadow-[var(--sh)] p-[18px_14px] sm:p-[26px_28px] border border-[var(--ln)] flex flex-col gap-5 min-w-0 w-full"
      style={{
        background: 'var(--sf)',
      }}
    >
      {/* Header and Link to Scenarios */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--ln)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: 'var(--ac)' }}
            />
            <h3 className="serif font-normal text-2xl sm:text-3xl text-[var(--ink)] m-0">
              Нагрузка на диспетчера (синтетика)
            </h3>
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[var(--sf2)] text-[var(--mu)] border border-[var(--ln2)] font-semibold">
              Синтетика, seed 42, проверка логики, не оценка на реальных авариях
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenScenarios}
          className="min-h-[44px] px-4 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto border-0 text-[var(--onac)]"
          style={{
            background: 'var(--ac)',
          }}
        >
          <span>Открыть сценарии</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Ratio Callout: Reduction Banner */}
      <div
        className="p-4 sm:p-5 rounded-[20px] border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--gns)', color: 'var(--gn)' }}
          >
            <BellOff className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--mu)]">
              Снижение информационной перегрузки диспетчера
            </span>
            <div className="text-sm sm:text-base font-medium mt-1 space-y-0.5 text-[var(--ink)]">
              <div>
                В <b className="num text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatRatio(ratioNaive)} раза меньше</b> позиций для диспетчера: {typeof fastIncidents === 'number' ? fastIncidents.toLocaleString('ru-RU') : '—'} инцидентов против {typeof naiveAlerts === 'number' ? naiveAlerts.toLocaleString('ru-RU') : '—'} тревог простого порога
              </div>
              <div>
                В <b className="num text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatRatio(ratioDedup)} раза меньше</b> инцидентов, чем у порога с дедупликацией
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-[var(--mu)] sm:text-right max-w-[320px]">
          {typeof naiveAlerts === 'number' && typeof staticAlerts === 'number' && typeof fastAlerts === 'number'
            ? `синтетический прогон (seed ${data.seed}, ${data.mode === 'month' ? 'месяц' : 'одни сутки'}): ${naiveAlerts.toLocaleString('ru-RU')} → ${staticAlerts.toLocaleString('ru-RU')} → ${fastAlerts.toLocaleString('ru-RU')} оповещений${typeof fastIncidents === 'number' ? ` (${fastIncidents.toLocaleString('ru-RU')} инцидентов диспетчеру)` : ''}`
            : 'синтетический прогон: нет данных о числе оповещений'}
        </div>
      </div>

      {/* 3-Column Comparison: Naive vs Static Dedup vs Fast Contour */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 min-w-0">
        {/* Naive / Simple Threshold */}
        <div
          className="rounded-[20px] p-4 border flex flex-col justify-between min-w-0"
          style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--mu)]">
                Простой порог
              </span>
              <span className="font-mono text-[10px] text-[var(--mu)] px-1.5 py-0.5 rounded bg-[var(--sf)]">
                naive
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px] text-[var(--mu)] block">Тревог в сутки (seed 42):</span>
                <div className="num font-bold text-2xl text-[var(--ink)]">
                  {typeof naiveAlerts === 'number' ? naiveAlerts.toLocaleString('ru-RU') : '—'}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-[var(--mu)] block">Инцидентов в сутки:</span>
                <div className="num font-bold text-2xl text-red-500">
                  {typeof naiveIncidents === 'number' ? naiveIncidents.toLocaleString('ru-RU') : '—'}
                </div>
              </div>
            </div>
          </div>

          <div
            className="text-xs mt-3 pt-2.5 border-t text-[var(--mu)] leading-snug"
            style={{ borderColor: 'var(--ln)' }}
          >
            Каждое колебание порога создаёт новую тревогу, вызывая лавину оповещений
          </div>
        </div>

        {/* Static Dedup */}
        <div
          className="rounded-[20px] p-4 border flex flex-col justify-between min-w-0"
          style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--mu)] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Дедупликация</span>
              </span>
              <span className="font-mono text-[10px] text-[var(--mu)] px-1.5 py-0.5 rounded bg-[var(--sf)]">
                static_dedup
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px] text-[var(--mu)] block">Тревог в сутки (seed 42):</span>
                <div className="num font-bold text-2xl text-[var(--ink)]">
                  {typeof staticAlerts === 'number' ? staticAlerts.toLocaleString('ru-RU') : '—'}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-[var(--mu)] block">Инцидентов в сутки:</span>
                <div className="num font-bold text-2xl text-amber-600 dark:text-amber-400">
                  {typeof staticIncidents === 'number' ? staticIncidents.toLocaleString('ru-RU') : '—'}
                </div>
              </div>
            </div>
          </div>

          <div
            className="text-xs mt-3 pt-2.5 border-t text-[var(--mu)] leading-snug"
            style={{ borderColor: 'var(--ln)' }}
          >
            Устраняет повторы одного статуса, но пропускает дребезг уставок
          </div>
        </div>

        {/* Fast Contour / NeuroKontur */}
        <div
          className="rounded-[20px] p-4 border flex flex-col justify-between min-w-0 relative"
          style={{
            background: 'var(--acs)',
            borderColor: 'var(--ac)',
          }}
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--ac)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Быстрый контур</span>
              </span>
              <span className="font-mono text-[10px] text-[var(--onac)] px-2 py-0.5 rounded-full bg-[var(--ac)] font-semibold">
                НейроКонтур
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[11px] text-[var(--mu)] block">Сигналов в сутки (всего):</span>
                <div className="num font-bold text-2xl text-[var(--ink)]">
                  {typeof fastAlerts === 'number' ? fastAlerts.toLocaleString('ru-RU') : '—'}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-[var(--mu)] block">Инцидентов диспетчеру:</span>
                <div className="num font-bold text-2xl text-emerald-600 dark:text-emerald-400">
                  {typeof fastIncidents === 'number' ? fastIncidents.toLocaleString('ru-RU') : '—'}
                </div>
              </div>
            </div>
          </div>

          <div
            className="text-xs mt-3 pt-2.5 border-t leading-snug text-[var(--ink)]"
            style={{ borderColor: 'rgba(37, 99, 235, 0.25)' }}
          >
            Подавление дребезга уставок, сшивка повторов и периодические напоминания
          </div>
        </div>
      </div>
    </section>
  );
};

import React, { useMemo } from 'react';
import { BacktestWeek } from '../types';
import { AlertTriangle, Award, BarChart2 } from 'lucide-react';

interface Props {
  weeks: BacktestWeek[];
  scope: 'all' | 'new_incidents';
  selectedModel: 'deployed' | 'lgbm_weekly';
  onModelChange: (model: 'deployed' | 'lgbm_weekly') => void;
  selectedWeekIdx: number;
  onSelectWeek: (idx: number) => void;
}

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return iso;
};

export const ReferenceWeekCards: React.FC<Props> = ({
  weeks,
  scope,
  selectedModel,
  onModelChange,
  selectedWeekIdx,
  onSelectWeek,
}) => {
  const stats = useMemo(() => {
    if (weeks.length === 0) return null;

    let worstIdx = 0;
    let bestIdx = 0;
    const valuesWithIdx: Array<{ idx: number; val: number; hits: number; ruleVal: number; ruleHits: number }> = [];

    weeks.forEach((w, idx) => {
      const popData = (scope === 'new_incidents' ? w.new_incidents : w.all) || w.all;
      const val = popData?.[selectedModel]?.precision_at_100 ?? 0;
      const hits = popData?.[selectedModel]?.hits_at_100 ?? 0;
      const ruleVal = popData?.persistence?.precision_at_100 ?? 0;
      const ruleHits = popData?.persistence?.hits_at_100 ?? 0;

      valuesWithIdx.push({ idx, val, hits, ruleVal, ruleHits });

      const worstPop = (scope === 'new_incidents' ? weeks[worstIdx].new_incidents : weeks[worstIdx].all) || weeks[worstIdx].all;
      const bestPop = (scope === 'new_incidents' ? weeks[bestIdx].new_incidents : weeks[bestIdx].all) || weeks[bestIdx].all;

      if (val < (worstPop?.[selectedModel]?.precision_at_100 ?? 0)) {
        worstIdx = idx;
      }
      if (val > (bestPop?.[selectedModel]?.precision_at_100 ?? 0)) {
        bestIdx = idx;
      }
    });

    // Find median
    const sorted = [...valuesWithIdx].sort((a, b) => a.val - b.val);
    const mid = Math.floor(sorted.length / 2);
    const medianItem = sorted[mid];
    const medianVal = sorted.length % 2 !== 0 ? sorted[mid].val : (sorted[mid - 1].val + sorted[mid].val) / 2;

    return {
      medianVal,
      medianIdx: medianItem.idx,
      worst: valuesWithIdx[worstIdx],
      worstCutoff: weeks[worstIdx].cutoff,
      best: valuesWithIdx[bestIdx],
      bestCutoff: weeks[bestIdx].cutoff,
    };
  }, [weeks, scope, selectedModel]);

  if (!stats) return null;

  return (
    <div className="flex flex-col gap-3 min-w-0 w-full">
      {/* Switcher bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-semibold text-[var(--mu)]">
            Опорные недели для:
          </span>
          <div className="inline-flex rounded-full p-1 border" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
            <button
              type="button"
              onClick={() => onModelChange('deployed')}
              className="px-3 py-0.5 text-xs font-semibold rounded-full transition-all cursor-pointer"
              style={{
                background: selectedModel === 'deployed' ? 'var(--ac)' : 'transparent',
                color: selectedModel === 'deployed' ? '#ffffff' : 'var(--ink)',
              }}
            >
              Модель в стенде
            </button>
            <button
              type="button"
              onClick={() => onModelChange('lgbm_weekly')}
              className="px-3 py-0.5 text-xs font-semibold rounded-full transition-all cursor-pointer"
              style={{
                background: selectedModel === 'lgbm_weekly' ? 'var(--gn)' : 'transparent',
                color: selectedModel === 'lgbm_weekly' ? '#ffffff' : 'var(--ink)',
              }}
            >
              С дообучением (пилот)
            </button>
          </div>
        </div>
        <span className="text-xs text-[var(--mu)]">
          нажмите на любую карточку, чтобы подсветить эту неделю на графике
        </span>
      </div>

      {/* 3 KPI Cards: Median, Worst, Best */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 min-w-0">
        {/* Median Card */}
        <button
          type="button"
          onClick={() => onSelectWeek(stats.medianIdx)}
          className="text-left rounded-[20px] p-4 sm:p-5 border flex flex-col justify-between gap-2 transition-all cursor-pointer hover:border-[var(--ac)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] min-w-0"
          style={{
            background: selectedWeekIdx === stats.medianIdx ? 'var(--acs)' : 'var(--sf2)',
            borderColor: selectedWeekIdx === stats.medianIdx ? 'var(--ac)' : 'var(--ln)',
          }}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--mu)] flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-[var(--ac)]" />
              Медиана ({selectedModel === 'deployed' ? 'стенд' : 'пилот'})
            </span>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-[var(--sf)] border text-[var(--mu)] font-semibold">
              Неделя {stats.medianIdx + 1}
            </span>
          </div>

          <div className="my-1">
            <span className="serif text-3xl sm:text-4xl font-normal num text-[var(--ink)] leading-none">
              {Math.round(stats.medianVal * 100)}%
            </span>
          </div>

          <div className="text-xs text-[var(--mu)] leading-snug">
            Медианная точность по всем 21 неделям бэктеста
          </div>
        </button>

        {/* Worst Week Card */}
        <button
          type="button"
          onClick={() => onSelectWeek(stats.worst.idx)}
          className="text-left rounded-[20px] p-4 sm:p-5 border flex flex-col justify-between gap-2 transition-all cursor-pointer hover:border-red-400 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] min-w-0"
          style={{
            background: selectedWeekIdx === stats.worst.idx ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.05)',
            borderColor: selectedWeekIdx === stats.worst.idx ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
          }}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Худшая неделя
            </span>
            <span
              className="font-mono text-xs px-2 py-0.5 rounded-full font-bold border"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#dc2626',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              Неделя {stats.worst.idx + 1}
            </span>
          </div>

          <div className="my-1 flex items-baseline gap-2">
            <span className="serif text-3xl sm:text-4xl font-normal num text-red-600 dark:text-red-400 leading-none">
              {Math.round(stats.worst.val * 100)}%
            </span>
            <span className="text-xs font-medium text-red-600/80 dark:text-red-400/80">
              ({stats.worst.hits} из 100)
            </span>
          </div>

          <div className="text-xs leading-snug">
            <span className="text-[var(--mu)]">Дата: </span>
            <b className="font-mono text-[var(--ink)]">{formatDate(stats.worstCutoff)}</b>
            <span className="block text-[11px] text-[var(--mu)] mt-0.5">
              Правило в эту неделю: {Math.round(stats.worst.ruleVal * 100)}% ({stats.worst.ruleHits}/100)
            </span>
          </div>
        </button>

        {/* Best Week Card */}
        <button
          type="button"
          onClick={() => onSelectWeek(stats.best.idx)}
          className="text-left rounded-[20px] p-4 sm:p-5 border flex flex-col justify-between gap-2 transition-all cursor-pointer hover:border-emerald-400 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] min-w-0"
          style={{
            background: selectedWeekIdx === stats.best.idx ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.05)',
            borderColor: selectedWeekIdx === stats.best.idx ? '#22c55e' : 'rgba(34, 197, 94, 0.3)',
          }}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Award className="w-4 h-4 shrink-0" /> Лучшая неделя
            </span>
            <span
              className="font-mono text-xs px-2 py-0.5 rounded-full font-bold border"
              style={{
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#16a34a',
                borderColor: 'rgba(34, 197, 94, 0.3)',
              }}
            >
              Неделя {stats.best.idx + 1}
            </span>
          </div>

          <div className="my-1 flex items-baseline gap-2">
            <span className="serif text-3xl sm:text-4xl font-normal num text-emerald-600 dark:text-emerald-400 leading-none">
              {Math.round(stats.best.val * 100)}%
            </span>
            <span className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80">
              ({stats.best.hits} из 100)
            </span>
          </div>

          <div className="text-xs leading-snug">
            <span className="text-[var(--mu)]">Дата: </span>
            <b className="font-mono text-[var(--ink)]">{formatDate(stats.bestCutoff)}</b>
            <span className="block text-[11px] text-[var(--mu)] mt-0.5">
              Правило в эту неделю: {Math.round(stats.best.ruleVal * 100)}% ({stats.best.ruleHits}/100)
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};

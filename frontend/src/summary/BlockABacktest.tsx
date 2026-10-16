import React, { useMemo, useState } from 'react';
import { BacktestResponse, BacktestWeek } from '../types';
import { AlertTriangle, Award, Info } from 'lucide-react';

interface Props {
  data: BacktestResponse | null;
  loading: boolean;
  error?: string | null;
}

type PopulationKey = 'all' | 'new_incidents';
type ModelVariantKey = 'deployed' | 'lgbm_weekly';

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return iso;
};

const formatShortDate = (iso: string) => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}`;
  }
  return iso;
};

const formatWeeksRu = (n: number) => {
  const rem100 = n % 100;
  const rem10 = n % 10;
  if (rem100 >= 11 && rem100 <= 14) return `${n} недель`;
  if (rem10 === 1) return `${n} неделя`;
  if (rem10 >= 2 && rem10 <= 4) return `${n} недели`;
  return `${n} недель`;
};

export const BlockABacktest: React.FC<Props> = ({ data, loading, error }) => {
  const [population, setPopulation] = useState<PopulationKey>('all');
  const [activeModel, setActiveModel] = useState<ModelVariantKey>('deployed');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Compute stats for current population and active model
  const stats = useMemo(() => {
    if (!data?.weeks || data.weeks.length === 0) return null;
    const weeks = data.weeks;
    const total = weeks.length;

    const calcComparison = (variant: 'deployed' | 'lgbm_weekly') => {
      let higher = 0;
      let lower = 0;
      let equal = 0;
      weeks.forEach((w) => {
        const popData = (population === 'new_incidents' ? w.new_incidents : w.all) || w.all;
        const v = popData?.[variant]?.precision_at_100 ?? 0;
        const r = popData?.persistence?.precision_at_100 ?? 0;
        if (v > r) {
          higher += 1;
        } else if (v < r) {
          lower += 1;
        } else {
          equal += 1;
        }
      });
      return { higher, lower, equal };
    };

    const compDeployed = calcComparison('deployed');
    const compLgbm = calcComparison('lgbm_weekly');

    // Stats for activeModel (for KPI cards)
    let worst = weeks[0];
    let best = weeks[0];
    let worstIdx = 0;
    let bestIdx = 0;
    const valList: number[] = [];

    weeks.forEach((w, idx) => {
      const popData = (population === 'new_incidents' ? w.new_incidents : w.all) || w.all;
      const val = popData?.[activeModel]?.precision_at_100 ?? 0;
      valList.push(val);

      const worstPop = (population === 'new_incidents' ? worst.new_incidents : worst.all) || worst.all;
      const bestPop = (population === 'new_incidents' ? best.new_incidents : best.all) || best.all;

      if (val < (worstPop?.[activeModel]?.precision_at_100 ?? 0)) {
        worst = w;
        worstIdx = idx;
      }
      if (val > (bestPop?.[activeModel]?.precision_at_100 ?? 0)) {
        best = w;
        bestIdx = idx;
      }
    });

    const sorted = [...valList].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    return {
      total,
      compDeployed,
      compLgbm,
      activeStats: {
        median,
        worst,
        worstIdx,
        best,
        bestIdx,
      },
    };
  }, [data, population, activeModel]);

  if (loading) {
    return (
      <div className="rounded-2xl p-5 border animate-pulse min-w-0" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
        <div className="h-6 w-72 rounded bg-neutral-200 dark:bg-neutral-800 mb-3" />
        <div className="h-4 w-96 rounded bg-neutral-200 dark:bg-neutral-800 mb-4" />
        <div className="h-40 rounded bg-neutral-100 dark:bg-neutral-900" />
      </div>
    );
  }

  if (error || !data || !stats) {
    return (
      <div className="rounded-2xl p-5 border min-w-0" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
        <h3 className="text-lg font-semibold mb-2">План и факт на реальных данных (21 неделя)</h3>
        <p className="text-sm text-red-500">Не удалось загрузить данные бэктеста: {error || 'пустой ответ'}</p>
      </div>
    );
  }

  const weeks = data.weeks;
  const W = 820;
  const H = 180;
  const padLeft = 45;
  const padRight = 25;
  const padTop = 18;
  const padBottom = 28;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const maxVal = population === 'new_incidents' ? 0.4 : 0.7;
  const gridLevels = population === 'new_incidents' ? [0, 0.1, 0.2, 0.3, 0.4] : [0, 0.2, 0.4, 0.6];

  const getX = (idx: number) => padLeft + (idx / Math.max(1, weeks.length - 1)) * plotW;
  const getY = (val: number) => padTop + (1 - Math.min(maxVal, Math.max(0, val)) / maxVal) * plotH;

  const deployedPoints = weeks.map((w, i) => {
    const popData = (population === 'new_incidents' ? w.new_incidents : w.all) || w.all;
    const val = popData?.deployed?.precision_at_100 ?? 0;
    const hits = popData?.deployed?.hits_at_100 ?? 0;
    return {
      x: getX(i),
      y: getY(val),
      val,
      hits,
      cutoff: w.cutoff,
    };
  });

  const lgbmPoints = weeks.map((w, i) => {
    const popData = (population === 'new_incidents' ? w.new_incidents : w.all) || w.all;
    const val = popData?.lgbm_weekly?.precision_at_100 ?? 0;
    const hits = popData?.lgbm_weekly?.hits_at_100 ?? 0;
    return {
      x: getX(i),
      y: getY(val),
      val,
      hits,
      cutoff: w.cutoff,
    };
  });

  const rulePoints = weeks.map((w, i) => {
    const popData = (population === 'new_incidents' ? w.new_incidents : w.all) || w.all;
    const val = popData?.persistence?.precision_at_100 ?? 0;
    const hits = popData?.persistence?.hits_at_100 ?? 0;
    return {
      x: getX(i),
      y: getY(val),
      val,
      hits,
      cutoff: w.cutoff,
    };
  });

  const deployedPath = deployedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const lgbmPath = lgbmPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const rulePath = rulePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const activeIdx = hoveredIdx !== null ? hoveredIdx : null;
  const activeWeek: BacktestWeek | null = activeIdx !== null ? weeks[activeIdx] : null;
  const activeWeekPop = activeWeek ? ((population === 'new_incidents' ? activeWeek.new_incidents : activeWeek.all) || activeWeek.all) : null;

  // Read summary table values for selected population
  const popSummary = data.summary?.[population];
  const summaryRows = [
    {
      name: 'Модель в демо (без дообучения)',
      roc_auc: popSummary?.deployed?.roc_auc?.median,
      pr_auc: popSummary?.deployed?.pr_auc?.median,
      p100: popSummary?.deployed?.precision_at_100?.median,
    },
    {
      name: 'Модель с еженедельным дообучением',
      roc_auc: popSummary?.lgbm_weekly?.roc_auc?.median,
      pr_auc: popSummary?.lgbm_weekly?.pr_auc?.median,
      p100: popSummary?.lgbm_weekly?.precision_at_100?.median,
    },
    {
      name: 'Правило: сбоил за последние 7 дней',
      roc_auc: popSummary?.persistence?.roc_auc?.median,
      pr_auc: popSummary?.persistence?.pr_auc?.median,
      p100: popSummary?.persistence?.precision_at_100?.median,
    },
  ];

  const worstWeekPop = (population === 'new_incidents' ? stats.activeStats.worst.new_incidents : stats.activeStats.worst.all) || stats.activeStats.worst.all;
  const bestWeekPop = (population === 'new_incidents' ? stats.activeStats.best.new_incidents : stats.activeStats.best.all) || stats.activeStats.best.all;

  const worstActiveVal = worstWeekPop?.[activeModel]?.precision_at_100 ?? 0;
  const worstActiveHits = worstWeekPop?.[activeModel]?.hits_at_100 ?? 0;
  const worstRuleVal = worstWeekPop?.persistence?.precision_at_100 ?? 0;
  const worstRuleHits = worstWeekPop?.persistence?.hits_at_100 ?? 0;

  const bestActiveVal = bestWeekPop?.[activeModel]?.precision_at_100 ?? 0;
  const bestActiveHits = bestWeekPop?.[activeModel]?.hits_at_100 ?? 0;
  const bestRuleVal = bestWeekPop?.persistence?.precision_at_100 ?? 0;
  const bestRuleHits = bestWeekPop?.persistence?.hits_at_100 ?? 0;

  return (
    <div className="rounded-2xl p-4 lg:p-5 border flex flex-col gap-4 min-w-0 overflow-hidden" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
      {/* Header & title */}
      <div className="flex flex-col gap-2 border-b pb-3.5" style={{ borderColor: 'var(--ln)' }}>
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--ac)' }} />
            <h2 className="serif font-semibold text-lg sm:text-xl lg:text-2xl leading-tight">
              План и факт на реальных данных ({formatWeeksRu(stats.total)})
            </h2>
          </div>
          <p className="text-xs lg:text-sm" style={{ color: 'var(--mut)' }}>
            Еженедельная проверка на отложенных данных во времени: две модели и простое правило (сбой на прошлой неделе)
          </p>
        </div>

        {/* Legend in Russian */}
        <div className="flex items-center gap-3.5 text-xs font-medium flex-wrap pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1 rounded" style={{ background: '#2563eb' }} />
            <span className="w-2 h-2 rounded-full" style={{ background: '#2563eb' }} />
            <span style={{ color: 'var(--ink)' }}>Модель в демо (обучена в январе, без дообучения)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: '#059669' }} />
            <span className="w-2 h-2 rounded-sm" style={{ background: '#059669' }} />
            <span style={{ color: 'var(--ink)' }}>Модель с еженедельным дообучением (так предлагаем в пилоте)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dotted" style={{ borderColor: '#64748b' }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#64748b' }} />
            <span style={{ color: 'var(--mut)' }}>Правило: сбоил за последние 7 дней</span>
          </div>
        </div>
      </div>

      {/* Population switch buttons */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: 'var(--mut)' }}>Выборка каналов:</span>
          <div className="inline-flex rounded-lg p-0.5 border" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
            <button
              onClick={() => setPopulation('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                population === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Все каналы
            </button>
            <button
              onClick={() => setPopulation('new_incidents')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                population === 'new_incidents'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Каналы без сбоев за неделю
            </button>
          </div>
        </div>
        {population === 'new_incidents' && (
          <p className="text-xs font-normal mt-0.5" style={{ color: 'var(--mut)' }}>
            Правило здесь слепо: у этих каналов за неделю не было сбоев, ему нечего подсказать.
          </p>
        )}
      </div>

      {/* Comparison sentences in neutral wording (no celebratory headline) */}
      <div className="p-3 rounded-xl border flex flex-col gap-1 text-xs lg:text-sm min-w-0" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ac)' }} />
          <div className="space-y-1 min-w-0 leading-snug">
            <div>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                Модель с дообучением против правила:
              </span>{' '}
              <span style={{ color: 'var(--ink)' }}>
                выше в {stats.compLgbm.higher}, ниже в {stats.compLgbm.lower}, поровну в {stats.compLgbm.equal} из {stats.total} недель
              </span>
            </div>
            <div>
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                Демо-модель против правила:
              </span>{' '}
              <span style={{ color: 'var(--ink)' }}>
                выше в {stats.compDeployed.higher}, ниже в {stats.compDeployed.lower}, поровну в {stats.compDeployed.equal} из {stats.total} недель
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Model toggle for Cards «Медиана / Худшая неделя / Лучшая неделя» */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--mut)' }}>
            Показать в карточках:
          </span>
          <div className="inline-flex rounded-lg p-0.5 border text-xs" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
            <button
              onClick={() => setActiveModel('deployed')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                activeModel === 'deployed'
                  ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Демо-модель
            </button>
            <button
              onClick={() => setActiveModel('lgbm_weekly')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                activeModel === 'lgbm_weekly'
                  ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Модель с дообучением
            </button>
          </div>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--mut)' }}>
          {activeModel === 'deployed' ? 'По умолчанию: модель в демо (обучена в январе)' : 'Расчёт для пилота (еженедельное дообучение)'}
        </span>
      </div>

      {/* KPI Cards: Median, Worst week, Best week - equal prominence */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        {/* Median */}
        <div className="rounded-xl p-3.5 border flex flex-col justify-between min-w-0" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--mut)' }}>
            Медиана: {activeModel === 'deployed' ? 'демо-модель' : 'с дообучением'}
          </div>
          <div className="my-1">
            <span className="num font-bold text-3xl" style={{ color: 'var(--ink)' }}>
              {Math.round(stats.activeStats.median * 100)}%
            </span>
          </div>
          <div className="text-[11px]" style={{ color: 'var(--mut)' }}>
            Медианная точность@100 по всем {stats.total} неделям
          </div>
        </div>

        {/* Worst Week - Prominent, same size as best */}
        <div className="rounded-xl p-3.5 border flex flex-col justify-between relative min-w-0"
             style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.35)' }}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Худшая неделя
            </span>
            <span className="num text-[11px] px-2 py-0.5 rounded-full font-bold border"
                  style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              Неделя {stats.activeStats.worstIdx + 1}
            </span>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="num font-bold text-3xl text-red-600 dark:text-red-400">
              {Math.round(worstActiveVal * 100)}%
            </span>
            <span className="text-xs text-red-600/80 dark:text-red-400/80 font-medium">
              ({worstActiveHits} из 100)
            </span>
          </div>
          <div className="text-xs leading-normal">
            <span style={{ color: 'var(--mut)' }}>Дата: </span>
            <b className="num font-bold" style={{ color: 'var(--ink)' }}>{formatDate(stats.activeStats.worst.cutoff)}</b>
            <span className="block text-[11px] mt-0.5" style={{ color: 'var(--mut)' }}>
              Правило в эту неделю: {Math.round(worstRuleVal * 100)}% ({worstRuleHits} из 100)
            </span>
          </div>
        </div>

        {/* Best Week - Prominent, same size */}
        <div className="rounded-xl p-3.5 border flex flex-col justify-between relative min-w-0"
             style={{ background: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.35)' }}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Лучшая неделя
            </span>
            <span className="num text-[11px] px-2 py-0.5 rounded-full font-bold border"
                  style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
              Неделя {stats.activeStats.bestIdx + 1}
            </span>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="num font-bold text-3xl text-emerald-600 dark:text-emerald-400">
              {Math.round(bestActiveVal * 100)}%
            </span>
            <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-medium">
              ({bestActiveHits} из 100)
            </span>
          </div>
          <div className="text-xs leading-normal">
            <span style={{ color: 'var(--mut)' }}>Дата: </span>
            <b className="num font-bold" style={{ color: 'var(--ink)' }}>{formatDate(stats.activeStats.best.cutoff)}</b>
            <span className="block text-[11px] mt-0.5" style={{ color: 'var(--mut)' }}>
              Правило в эту неделю: {Math.round(bestRuleVal * 100)}% ({bestRuleHits} из 100)
            </span>
          </div>
        </div>
      </div>

      {/* SVG Weekly Chart with 3 lines */}
      <div className="relative w-full overflow-hidden min-w-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none overflow-visible block"
          style={{ minHeight: '155px' }}
        >
          {/* Y Axis Grid lines & Labels */}
          {gridLevels.map(level => {
            const y = getY(level);
            return (
              <g key={level}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={W - padRight}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.08"
                  strokeDasharray={level === 0 ? 'none' : '3,3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="num text-[11px] fill-neutral-400 dark:fill-neutral-500 font-medium"
                >
                  {Math.round(level * 100)}%
                </text>
              </g>
            );
          })}

          {/* Rule Path (dotted, gray) */}
          <path
            d={rulePath}
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            strokeDasharray="3,3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Deployed Model Path (solid, blue) */}
          <path
            d={deployedPath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* LGBM Weekly Model Path (dashed, emerald) */}
          <path
            d={lgbmPath}
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeDasharray="6,3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points for Rule (small gray circles) */}
          {rulePoints.map((p, i) => (
            <circle
              key={`rule-${i}`}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill="#64748b"
            />
          ))}

          {/* Points for Deployed (solid circles) */}
          {deployedPoints.map((p, i) => {
            const isWorst = activeModel === 'deployed' && i === stats.activeStats.worstIdx;
            const isBest = activeModel === 'deployed' && i === stats.activeStats.bestIdx;
            const isHovered = i === activeIdx;

            return (
              <g key={`dep-${i}`} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(i)} onClick={() => setHoveredIdx(i)}>
                {isWorst && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="8"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeDasharray="2,2"
                    className="animate-pulse"
                  />
                )}
                {isBest && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="8"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeDasharray="2,2"
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5.5 : isWorst || isBest ? 4.5 : 3.5}
                  fill={isWorst ? '#ef4444' : isBest ? '#22c55e' : '#2563eb'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}

          {/* Points for LGBM Weekly (squares) */}
          {lgbmPoints.map((p, i) => {
            const isWorst = activeModel === 'lgbm_weekly' && i === stats.activeStats.worstIdx;
            const isBest = activeModel === 'lgbm_weekly' && i === stats.activeStats.bestIdx;
            const isHovered = i === activeIdx;
            const size = isHovered ? 9 : isWorst || isBest ? 8 : 6.5;

            return (
              <g key={`lgbm-${i}`} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(i)} onClick={() => setHoveredIdx(i)}>
                {isWorst && (
                  <rect
                    x={p.x - 7}
                    y={p.y - 7}
                    width="14"
                    height="14"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeDasharray="2,2"
                    className="animate-pulse"
                  />
                )}
                {isBest && (
                  <rect
                    x={p.x - 7}
                    y={p.y - 7}
                    width="14"
                    height="14"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeDasharray="2,2"
                  />
                )}
                <rect
                  x={p.x - size / 2}
                  y={p.y - size / 2}
                  width={size}
                  height={size}
                  fill={isWorst ? '#ef4444' : isBest ? '#22c55e' : '#059669'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}

          {/* X Axis Date labels (sample every 3 weeks + last) */}
          {weeks.map((w, i) => {
            if (i % 3 !== 0 && i !== weeks.length - 1) return null;
            const x = getX(i);
            return (
              <text
                key={`label-${i}`}
                x={x}
                y={H - 8}
                textAnchor="middle"
                className="num text-[10px] fill-neutral-400 dark:fill-neutral-500 font-medium"
              >
                {formatShortDate(w.cutoff)}
              </text>
            );
          })}
        </svg>

        {/* Hover / Active Tooltip bar */}
        {activeWeek && activeIdx !== null && activeWeekPop && (
          <div className="mt-1.5 p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2.5 rise min-w-0"
               style={{ background: 'var(--sf2)', borderColor: 'var(--ln)', animationDuration: '.15s' }}>
            <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--ink)' }}>
              <span>Неделя №{activeIdx + 1} ({formatDate(activeWeek.cutoff)}):</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#2563eb' }} />
                <span style={{ color: 'var(--mut)' }}>Демо:</span>
                <span className="num font-bold" style={{ color: '#2563eb' }}>
                  {Math.round((activeWeekPop.deployed?.precision_at_100 ?? 0) * 100)}%
                </span>
                <span style={{ color: 'var(--mut)' }}>({activeWeekPop.deployed?.hits_at_100 ?? 0}/100)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: '#059669' }} />
                <span style={{ color: 'var(--mut)' }}>С дообучением:</span>
                <span className="num font-bold" style={{ color: '#059669' }}>
                  {Math.round((activeWeekPop.lgbm_weekly?.precision_at_100 ?? 0) * 100)}%
                </span>
                <span style={{ color: 'var(--mut)' }}>({activeWeekPop.lgbm_weekly?.hits_at_100 ?? 0}/100)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: '#64748b' }} />
                <span style={{ color: 'var(--mut)' }}>Правило:</span>
                <span className="num font-semibold" style={{ color: '#64748b' }}>
                  {Math.round((activeWeekPop.persistence?.precision_at_100 ?? 0) * 100)}%
                </span>
                <span style={{ color: 'var(--mut)' }}>({activeWeekPop.persistence?.hits_at_100 ?? 0}/100)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Small table under the chart for the selected population */}
      <div className="flex flex-col gap-1.5 min-w-0 w-full">
        <div className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
          Сводные показатели по {population === 'all' ? 'всем каналам' : 'каналам без сбоев за неделю'} (медианы за {stats.total} недель)
        </div>
        <div className="w-full max-w-full overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--ln)' }}>
          <table className="w-full min-w-[500px] text-left text-xs">
            <thead style={{ background: 'var(--sf2)', borderBottom: '1px solid var(--ln)' }}>
              <tr>
                <th className="py-2.5 px-3 font-semibold">Вариант</th>
                <th className="py-2.5 px-3 font-semibold text-right">Медиана ROC-AUC</th>
                <th className="py-2.5 px-3 font-semibold text-right">Медиана PR-AUC</th>
                <th className="py-2.5 px-3 font-semibold text-right">Медиана precision@100</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--ln)' }}>
              {summaryRows.map((r, i) => (
                <tr key={i} style={i % 2 === 1 ? { background: 'var(--sf2)' } : undefined}>
                  <td className="py-2 px-3">
                    <span className="font-medium" style={{ color: 'var(--ink)' }}>{r.name}</span>
                  </td>
                  <td className="py-2 px-3 num text-right font-medium" style={{ color: 'var(--ink)' }}>
                    {r.roc_auc !== undefined ? r.roc_auc.toFixed(3) : '—'}
                  </td>
                  <td className="py-2 px-3 num text-right font-medium" style={{ color: 'var(--ink)' }}>
                    {r.pr_auc !== undefined ? r.pr_auc.toFixed(3) : '—'}
                  </td>
                  <td className="py-2 px-3 num text-right font-medium" style={{ color: 'var(--ink)' }}>
                    {r.p100 !== undefined ? r.p100.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Required verbatim sentence under the chart in plain Russian */}
      <div className="p-3 rounded-xl border text-xs lg:text-sm leading-relaxed min-w-0"
           style={{ background: 'var(--sf2)', borderColor: 'var(--ln)', color: 'var(--ink)' }}>
        <p className="font-medium">
          Прогноз на 24–72 часа вперёд; каждая неделя проверяется на данных, которых модель не видела. В демо работает модель, обученная в январе; модель с еженедельным дообучением — расчёт для пилота, она проверена в этом же бэктесте.
        </p>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { BacktestResponse } from '../types';
import { AlertTriangle, Award, Info } from 'lucide-react';

interface Props {
  data: BacktestResponse | null;
  loading: boolean;
  error?: string | null;
}

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

export const BlockABacktest: React.FC<Props> = ({ data, loading, error }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const stats = useMemo(() => {
    if (!data?.weeks || data.weeks.length === 0) return null;
    const weeks = data.weeks;
    const total = weeks.length;

    let wins = 0;
    let losses = 0;
    let ties = 0;

    let worst = weeks[0];
    let best = weeks[0];
    let worstIdx = 0;
    let bestIdx = 0;

    const deployedP100List: number[] = [];

    weeks.forEach((w, idx) => {
      const dep = w.all?.deployed?.precision_at_100 ?? 0;
      const rul = w.all?.persistence?.precision_at_100 ?? 0;
      deployedP100List.push(dep);

      if (dep > rul) {
        wins += 1;
      } else if (dep < rul) {
        losses += 1;
      } else {
        ties += 1;
      }

      if (dep < (worst.all?.deployed?.precision_at_100 ?? 0)) {
        worst = w;
        worstIdx = idx;
      }
      if (dep > (best.all?.deployed?.precision_at_100 ?? 0)) {
        best = w;
        bestIdx = idx;
      }
    });

    const lossesOrTies = losses + ties;

    // Median of deployed precision@100
    const sorted = [...deployedP100List].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    return {
      total,
      wins,
      losses,
      ties,
      lossesOrTies,
      median,
      worst,
      worstIdx,
      best,
      bestIdx,
    };
  }, [data]);

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
  const H = 175;
  const padLeft = 45;
  const padRight = 25;
  const padTop = 18;
  const padBottom = 28;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const maxVal = 0.7; // 70% max for chart height

  const getX = (idx: number) => padLeft + (idx / Math.max(1, weeks.length - 1)) * plotW;
  const getY = (val: number) => padTop + (1 - Math.min(maxVal, Math.max(0, val)) / maxVal) * plotH;

  const deployedPoints = weeks.map((w, i) => ({
    x: getX(i),
    y: getY(w.all?.deployed?.precision_at_100 ?? 0),
    val: w.all?.deployed?.precision_at_100 ?? 0,
    hits: w.all?.deployed?.hits_at_100 ?? 0,
    cutoff: w.cutoff,
  }));

  const rulePoints = weeks.map((w, i) => ({
    x: getX(i),
    y: getY(w.all?.persistence?.precision_at_100 ?? 0),
    val: w.all?.persistence?.precision_at_100 ?? 0,
    hits: w.all?.persistence?.hits_at_100 ?? 0,
    cutoff: w.cutoff,
  }));

  const deployedPath = deployedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const rulePath = rulePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const activeIdx = hoveredIdx !== null ? hoveredIdx : null;
  const activeWeek = activeIdx !== null ? weeks[activeIdx] : null;

  return (
    <div className="rounded-2xl p-4 lg:p-5 border flex flex-col gap-4 min-w-0 overflow-hidden" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
      {/* Header & title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3.5" style={{ borderColor: 'var(--ln)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--ac)' }} />
            <h2 className="serif font-semibold text-lg sm:text-xl lg:text-2xl leading-tight">
              План и факт на реальных данных ({stats.total} неделя)
            </h2>
          </div>
          <p className="text-xs lg:text-sm mt-1" style={{ color: 'var(--mut)' }}>
            Еженедельная out-of-time проверка: развёрнутая модель против простого правила (сбой на прошлой неделе)
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded" style={{ background: 'var(--ac)' }} />
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>Модель (топ-100)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-neutral-400 dark:border-neutral-500" />
            <span style={{ color: 'var(--mut)' }}>Правило (persistence)</span>
          </div>
        </div>
      </div>

      {/* Summary line computed from runtime data */}
      <div className="p-3 rounded-xl border flex items-center gap-2.5 text-xs lg:text-sm min-w-0" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
        <Info className="w-4 h-4 shrink-0" style={{ color: 'var(--ac)' }} />
        <div className="leading-snug min-w-0">
          <span className="font-semibold" style={{ color: 'var(--ink)' }}>
            Модель точнее правила в {stats.wins} из {stats.total} недель
          </span>
          <span className="mx-1.5 opacity-40">·</span>
          <span style={{ color: 'var(--mut)' }}>
            уступает или равна в {stats.lossesOrTies} из {stats.total} недель
            {stats.ties > 0 ? ` (уступает в ${stats.losses}, ничья в ${stats.ties})` : ''}
          </span>
        </div>
      </div>

      {/* KPI Cards: Median, Worst week, Best week - equal prominence */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        {/* Median */}
        <div className="rounded-xl p-3.5 border flex flex-col justify-between min-w-0" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--mut)' }}>
            Медиана модели
          </div>
          <div className="my-1">
            <span className="num font-bold text-3xl" style={{ color: 'var(--ink)' }}>
              {Math.round(stats.median * 100)}%
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
              Неделя {stats.worstIdx + 1}
            </span>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="num font-bold text-3xl text-red-600 dark:text-red-400">
              {Math.round((stats.worst.all?.deployed?.precision_at_100 ?? 0) * 100)}%
            </span>
            <span className="text-xs text-red-600/80 dark:text-red-400/80 font-medium">
              ({stats.worst.all?.deployed?.hits_at_100 ?? 0} из 100)
            </span>
          </div>
          <div className="text-xs leading-normal">
            <span style={{ color: 'var(--mut)' }}>Дата: </span>
            <b className="num font-bold" style={{ color: 'var(--ink)' }}>{formatDate(stats.worst.cutoff)}</b>
            <span className="block text-[11px] mt-0.5" style={{ color: 'var(--mut)' }}>
              Правило в эту неделю: {Math.round((stats.worst.all?.persistence?.precision_at_100 ?? 0) * 100)}%
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
              Неделя {stats.bestIdx + 1}
            </span>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="num font-bold text-3xl text-emerald-600 dark:text-emerald-400">
              {Math.round((stats.best.all?.deployed?.precision_at_100 ?? 0) * 100)}%
            </span>
            <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-medium">
              ({stats.best.all?.deployed?.hits_at_100 ?? 0} из 100)
            </span>
          </div>
          <div className="text-xs leading-normal">
            <span style={{ color: 'var(--mut)' }}>Дата: </span>
            <b className="num font-bold" style={{ color: 'var(--ink)' }}>{formatDate(stats.best.cutoff)}</b>
            <span className="block text-[11px] mt-0.5" style={{ color: 'var(--mut)' }}>
              Правило в эту неделю: {Math.round((stats.best.all?.persistence?.precision_at_100 ?? 0) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* SVG Weekly Chart */}
      <div className="relative w-full overflow-hidden min-w-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none overflow-visible block"
          style={{ minHeight: '150px' }}
        >
          {/* Y Axis Grid lines & Labels */}
          {[0, 0.2, 0.4, 0.6].map(level => {
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

          {/* Rule Path (dashed) */}
          <path
            d={rulePath}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="4,4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Model Path (solid) */}
          <path
            d={deployedPath}
            fill="none"
            stroke="var(--ac)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points for Rule */}
          {rulePoints.map((p, i) => (
            <circle
              key={`rule-${i}`}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill="#94a3b8"
            />
          ))}

          {/* Points for Model */}
          {deployedPoints.map((p, i) => {
            const isWorst = i === stats.worstIdx;
            const isBest = i === stats.bestIdx;
            const isHovered = i === activeIdx;

            return (
              <g key={`dep-${i}`} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(i)} onClick={() => setHoveredIdx(i)}>
                {/* Worst callout ring */}
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
                {/* Best callout ring */}
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
                {/* Main point */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : isWorst || isBest ? 4.5 : 3.5}
                  fill={isWorst ? '#ef4444' : isBest ? '#22c55e' : 'var(--sf)'}
                  stroke={isWorst ? '#ef4444' : isBest ? '#22c55e' : 'var(--ac)'}
                  strokeWidth="2"
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
        {activeWeek && activeIdx !== null && (
          <div className="mt-1.5 p-2 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 rise min-w-0"
               style={{ background: 'var(--sf2)', borderColor: 'var(--ln)', animationDuration: '.15s' }}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold" style={{ color: 'var(--ink)' }}>Неделя №{activeIdx + 1} ({formatDate(activeWeek.cutoff)}):</span>
              <span className="num font-bold" style={{ color: 'var(--ac)' }}>
                Модель: {Math.round((activeWeek.all?.deployed?.precision_at_100 ?? 0) * 100)}%
              </span>
              <span style={{ color: 'var(--mut)' }}>({activeWeek.all?.deployed?.hits_at_100} из 100)</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span style={{ color: 'var(--mut)' }}>Правило:</span>
              <span className="num font-semibold" style={{ color: 'var(--ink)' }}>
                {Math.round((activeWeek.all?.persistence?.precision_at_100 ?? 0) * 100)}%
              </span>
              <span style={{ color: 'var(--mut)' }}>({activeWeek.all?.persistence?.hits_at_100} из 100)</span>
              <span className={`num font-bold ml-1 ${
                (activeWeek.all?.deployed?.precision_at_100 ?? 0) > (activeWeek.all?.persistence?.precision_at_100 ?? 0)
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : (activeWeek.all?.deployed?.precision_at_100 ?? 0) < (activeWeek.all?.persistence?.precision_at_100 ?? 0)
                  ? 'text-red-500'
                  : 'text-neutral-500'
              }`}>
                {((activeWeek.all?.deployed?.precision_at_100 ?? 0) - (activeWeek.all?.persistence?.precision_at_100 ?? 0) > 0 ? '+' : '')}
                {Math.round(((activeWeek.all?.deployed?.precision_at_100 ?? 0) - (activeWeek.all?.persistence?.precision_at_100 ?? 0)) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Required verbatim sentence under the chart in plain Russian */}
      <div className="p-2.5 rounded-xl border text-xs lg:text-sm leading-relaxed min-w-0"
           style={{ background: 'var(--sf2)', borderColor: 'var(--ln)', color: 'var(--ink)' }}>
        <p className="font-medium">
          Прогноз на 24–72 часа вперёд, проверка по неделям вперёд во времени, без подглядывания в будущее. Модель не идеальна: см. худшие недели.
        </p>
      </div>
    </div>
  );
};

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { BacktestWeek } from '../types';
import { LineChart as ChartIcon } from 'lucide-react';

interface Props {
  weeks: BacktestWeek[];
  scope: 'all' | 'new_incidents';
  selectedWeekIdx: number;
  onSelectWeek: (idx: number) => void;
}

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return iso;
};

const formatShortDate = (iso: string) => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}`;
  return iso;
};

export const InteractiveChart: React.FC<Props> = ({
  weeks,
  scope,
  selectedWeekIdx,
  onSelectWeek,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showDeployed, setShowDeployed] = useState(true);
  const [showLgbm, setShowLgbm] = useState(true);
  const [showRule, setShowRule] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartBoxRef = useRef<HTMLDivElement>(null);
  // Chart is drawn in real pixels (viewBox = container width), so labels stay readable on phones
  const [W, setW] = useState(860);
  useEffect(() => {
    const el = chartBoxRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setW(Math.max(280, w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeIdx = hoveredIdx !== null ? hoveredIdx : selectedWeekIdx;
  const activeWeek = weeks[activeIdx] || weeks[0];
  const activePop = activeWeek
    ? (scope === 'new_incidents' ? activeWeek.new_incidents : activeWeek.all) || activeWeek.all
    : null;

  // Chart coordinates
  const compact = W < 520;
  const H = compact ? 240 : 260;
  const padLeft = compact ? 34 : 45;
  const padRight = compact ? 12 : 20;
  const padTop = 20;
  const padBottom = 32;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const maxVal = scope === 'new_incidents' ? 0.4 : 0.75;
  const gridLevels = scope === 'new_incidents' ? [0, 0.1, 0.2, 0.3, 0.4] : [0, 0.2, 0.4, 0.6];

  const getX = (idx: number) => padLeft + (idx / Math.max(1, weeks.length - 1)) * plotW;
  const getY = (val: number) => padTop + (1 - Math.min(maxVal, Math.max(0, val)) / maxVal) * plotH;

  const deployedPoints = useMemo(() => {
    return weeks.map((w, i) => {
      const p = (scope === 'new_incidents' ? w.new_incidents : w.all) || w.all;
      const val = p?.deployed?.precision_at_100 ?? 0;
      return { x: getX(i), y: getY(val), val, hits: p?.deployed?.hits_at_100 ?? 0 };
    });
  }, [weeks, scope, W]);

  const lgbmPoints = useMemo(() => {
    return weeks.map((w, i) => {
      const p = (scope === 'new_incidents' ? w.new_incidents : w.all) || w.all;
      const val = p?.lgbm_weekly?.precision_at_100 ?? 0;
      return { x: getX(i), y: getY(val), val, hits: p?.lgbm_weekly?.hits_at_100 ?? 0 };
    });
  }, [weeks, scope, W]);

  const rulePoints = useMemo(() => {
    return weeks.map((w, i) => {
      const p = (scope === 'new_incidents' ? w.new_incidents : w.all) || w.all;
      const val = p?.persistence?.precision_at_100 ?? 0;
      return { x: getX(i), y: getY(val), val, hits: p?.persistence?.hits_at_100 ?? 0 };
    });
  }, [weeks, scope, W]);

  const deployedPath = deployedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const lgbmPath = lgbmPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const rulePath = rulePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  // Pointer event handlers to track and pin weeks
  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX;
    const relX = clientX - rect.left;
    const svgX = (relX / rect.width) * W;
    const clampedX = Math.max(padLeft, Math.min(W - padRight, svgX));
    const idx = Math.round(((clampedX - padLeft) / plotW) * (weeks.length - 1));
    const finalIdx = Math.max(0, Math.min(weeks.length - 1, idx));
    setHoveredIdx(finalIdx);
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX;
    const relX = clientX - rect.left;
    const svgX = (relX / rect.width) * W;
    const clampedX = Math.max(padLeft, Math.min(W - padRight, svgX));
    const idx = Math.round(((clampedX - padLeft) / plotW) * (weeks.length - 1));
    const finalIdx = Math.max(0, Math.min(weeks.length - 1, idx));
    onSelectWeek(finalIdx);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (selectedWeekIdx > 0) onSelectWeek(selectedWeekIdx - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (selectedWeekIdx < weeks.length - 1) onSelectWeek(selectedWeekIdx + 1);
    }
  };

  const activeX = getX(activeIdx);

  return (
    <section
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="rounded-[26px] shadow-[var(--sh)] p-[18px_14px] sm:p-[26px_28px] border border-[var(--ln)] flex flex-col gap-4 min-w-0 w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
      style={{
        background: 'var(--sf)',
      }}
      aria-label="Интерактивный график точности по неделям. Используйте стрелки влево и вправо для перемещения."
    >
      {/* Header and Legend Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--ln)' }}>
        <div className="flex items-center gap-2">
          <ChartIcon className="w-5 h-5 text-[var(--ac)]" />
          <h3 className="serif text-xl sm:text-2xl font-normal text-[var(--ink)] m-0">
            Точность по неделям (precision@100)
          </h3>
        </div>

        {/* Legend: 3-column segmented group (line toggles) */}
        <div
          role="group"
          aria-label="Линии на графике"
          className="grid grid-cols-3 gap-1 p-1 rounded-[20px] sm:min-w-[420px]"
          style={{ background: 'var(--sf2)' }}
        >
          {([
            { on: showDeployed, set: setShowDeployed, color: '#2563eb', dash: 'none', full: 'Демо-модель', short: 'Модель', title: 'Переключить показ демо-модели' },
            { on: showLgbm, set: setShowLgbm, color: '#059669', dash: '6 4', full: 'С дообучением (пилот)', short: 'Дообучение', title: 'Переключить показ модели с дообучением' },
            { on: showRule, set: setShowRule, color: '#64748b', dash: '2 4', full: 'Правило', short: 'Правило', title: 'Переключить показ простого правила' },
          ]).map((l) => (
            <button
              key={l.full}
              type="button"
              onClick={() => l.set((v: boolean) => !v)}
              aria-pressed={l.on}
              aria-label={l.full}
              title={l.title}
              className="border-0 rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 min-h-[52px] px-2 py-1.5 text-center text-[13.5px] leading-tight cursor-pointer transition-[background,box-shadow] duration-200"
              style={{
                background: l.on ? 'var(--sf)' : 'transparent',
                boxShadow: l.on ? 'var(--sh)' : 'none',
                color: l.on ? 'var(--ink)' : 'var(--mu)',
                fontWeight: l.on ? 600 : 500,
              }}
            >
              <svg width="30" height="8" aria-hidden="true" className="shrink-0">
                <line
                  x1="2"
                  y1="4"
                  x2="28"
                  y2="4"
                  stroke={l.color}
                  strokeWidth="3.5"
                  strokeDasharray={l.dash}
                  strokeLinecap="round"
                  opacity={l.on ? 1 : 0.3}
                />
              </svg>
              <span>
                <span className="sm:hidden">{l.short}</span>
                <span className="hidden sm:inline">{l.full}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div ref={chartBoxRef} className="relative w-full overflow-hidden select-none min-h-[220px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block cursor-crosshair"
          style={{ minHeight: '220px', touchAction: 'pan-y' }}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setHoveredIdx(null)}
          onClick={handleClick}
        >
          {/* Y Axis Grid lines & Labels */}
          {gridLevels.map((level) => {
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
                  className="font-mono text-[11px] fill-neutral-400 dark:fill-neutral-500 font-medium"
                >
                  {Math.round(level * 100)}%
                </text>
              </g>
            );
          })}

          {/* Vertical crosshair line on active week */}
          <line
            x1={activeX}
            y1={padTop}
            x2={activeX}
            y2={H - padBottom}
            stroke="var(--ink)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />

          {/* Rule line */}
          {showRule && (
            <path
              d={rulePath}
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeDasharray="3,3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Deployed line */}
          {showDeployed && (
            <path
              d={deployedPath}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* LGBM Weekly line */}
          {showLgbm && (
            <path
              d={lgbmPath}
              fill="none"
              stroke="#059669"
              strokeWidth="2.5"
              strokeDasharray="6,3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Active Dots on curves */}
          {showRule && (
            <circle
              cx={activeX}
              cy={rulePoints[activeIdx]?.y ?? 0}
              r={5}
              fill="#64748b"
              stroke="#ffffff"
              strokeWidth="2"
            />
          )}

          {showDeployed && (
            <circle
              cx={activeX}
              cy={deployedPoints[activeIdx]?.y ?? 0}
              r={6.5}
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth="2"
            />
          )}

          {showLgbm && (
            <circle
              cx={activeX}
              cy={lgbmPoints[activeIdx]?.y ?? 0}
              r={6.5}
              fill="#059669"
              stroke="#ffffff"
              strokeWidth="2"
            />
          )}

          {/* X Axis Date labels (every 4 weeks + last) */}
          {weeks.map((w, i) => {
            if (i % 4 !== 0 && i !== weeks.length - 1) return null;
            const x = getX(i);
            return (
              <text
                key={`label-${i}`}
                x={x}
                y={H - 10}
                textAnchor={i === weeks.length - 1 ? 'end' : 'middle'}
                className="font-mono text-[10px] fill-neutral-400 dark:fill-neutral-500 font-medium"
              >
                {formatShortDate(w.cutoff)}
              </text>
            );
          })}
        </svg>

        {/* Floating / Bottom Tooltip bar */}
        {activePop && (
          <div
            className="mt-2 p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 min-w-0"
            style={{
              background: 'var(--sf2)',
              borderColor: 'var(--ln)',
            }}
          >
            <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <span>Неделя №{activeIdx + 1}</span>
              <span className="font-mono text-[var(--mu)]">
                ({formatDate(activeWeek?.cutoff)})
              </span>
              {activeIdx === selectedWeekIdx && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--ac)] text-white">
                  закреплена
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2563eb' }} />
                <span className="text-[var(--mu)]">Демо:</span>
                <strong className="num font-bold text-[#2563eb]">
                  {Math.round((activePop.deployed?.precision_at_100 ?? 0) * 100)}%
                </strong>
                <span className="text-[var(--mu)] font-mono text-[11px]">
                  ({activePop.deployed?.hits_at_100 ?? 0}/100)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#059669' }} />
                <span className="text-[var(--mu)]">С дообучением:</span>
                <strong className="num font-bold text-[#059669]">
                  {Math.round((activePop.lgbm_weekly?.precision_at_100 ?? 0) * 100)}%
                </strong>
                <span className="text-[var(--mu)] font-mono text-[11px]">
                  ({activePop.lgbm_weekly?.hits_at_100 ?? 0}/100)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#64748b' }} />
                <span className="text-[var(--mu)]">Правило:</span>
                <strong className="num font-semibold text-[#64748b]">
                  {Math.round((activePop.persistence?.precision_at_100 ?? 0) * 100)}%
                </strong>
                <span className="text-[var(--mu)] font-mono text-[11px]">
                  ({activePop.persistence?.hits_at_100 ?? 0}/100)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

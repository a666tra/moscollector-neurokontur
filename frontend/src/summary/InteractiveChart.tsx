import React, { useState, useRef, useMemo } from 'react';
import { BacktestWeek } from '../types';
import { LineChart as ChartIcon, Eye, EyeOff } from 'lucide-react';

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

  const activeIdx = hoveredIdx !== null ? hoveredIdx : selectedWeekIdx;
  const activeWeek = weeks[activeIdx] || weeks[0];
  const activePop = activeWeek
    ? (scope === 'new_incidents' ? activeWeek.new_incidents : activeWeek.all) || activeWeek.all
    : null;

  // Chart coordinates
  const W = 860;
  const H = 260;
  const padLeft = 45;
  const padRight = 20;
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
  }, [weeks, scope]);

  const lgbmPoints = useMemo(() => {
    return weeks.map((w, i) => {
      const p = (scope === 'new_incidents' ? w.new_incidents : w.all) || w.all;
      const val = p?.lgbm_weekly?.precision_at_100 ?? 0;
      return { x: getX(i), y: getY(val), val, hits: p?.lgbm_weekly?.hits_at_100 ?? 0 };
    });
  }, [weeks, scope]);

  const rulePoints = useMemo(() => {
    return weeks.map((w, i) => {
      const p = (scope === 'new_incidents' ? w.new_incidents : w.all) || w.all;
      const val = p?.persistence?.precision_at_100 ?? 0;
      return { x: getX(i), y: getY(val), val, hits: p?.persistence?.hits_at_100 ?? 0 };
    });
  }, [weeks, scope]);

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
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="rounded-[24px] p-5 sm:p-6 border flex flex-col gap-4 min-w-0 w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
      style={{
        background: 'var(--sf)',
        borderColor: 'var(--ln)',
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

        {/* Legend buttons with line toggle state */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDeployed((v) => !v)}
            className="min-h-[36px] px-3 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer"
            style={{
              background: showDeployed ? 'var(--sf2)' : 'transparent',
              borderColor: showDeployed ? '#2563eb' : 'var(--ln2)',
              color: showDeployed ? 'var(--ink)' : 'var(--mu)',
              opacity: showDeployed ? 1 : 0.5,
            }}
            title="Переключить показ демо-модели"
          >
            <span className="w-3.5 h-1 rounded" style={{ background: '#2563eb' }} />
            <span>Демо-модель</span>
            {showDeployed ? <Eye className="w-3.5 h-3.5 text-[#2563eb]" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setShowLgbm((v) => !v)}
            className="min-h-[36px] px-3 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer"
            style={{
              background: showLgbm ? 'var(--sf2)' : 'transparent',
              borderColor: showLgbm ? '#059669' : 'var(--ln2)',
              color: showLgbm ? 'var(--ink)' : 'var(--mu)',
              opacity: showLgbm ? 1 : 0.5,
            }}
            title="Переключить показ модели с дообучением"
          >
            <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: '#059669' }} />
            <span>С дообучением (пилот)</span>
            {showLgbm ? <Eye className="w-3.5 h-3.5 text-[#059669]" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setShowRule((v) => !v)}
            className="min-h-[36px] px-3 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer"
            style={{
              background: showRule ? 'var(--sf2)' : 'transparent',
              borderColor: showRule ? '#64748b' : 'var(--ln2)',
              color: showRule ? 'var(--ink)' : 'var(--mu)',
              opacity: showRule ? 1 : 0.5,
            }}
            title="Переключить показ простого правила"
          >
            <span className="w-3.5 border-t-2 border-dotted" style={{ borderColor: '#64748b' }} />
            <span>Правило</span>
            {showRule ? <Eye className="w-3.5 h-3.5 text-[#64748b]" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="relative w-full overflow-hidden select-none min-h-[220px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block cursor-crosshair touch-none"
          style={{ minHeight: '220px' }}
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
                textAnchor="middle"
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
    </div>
  );
};

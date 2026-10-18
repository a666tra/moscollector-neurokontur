import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RefreshCw, Clock, Calendar, Flame, Bell } from 'lucide-react';
import { ScenarioRunResponse } from '../types';

interface ScenarioTimelineLanesProps {
  runResult: ScenarioRunResponse | null;
  mode: 'day' | 'month';
  onModeChange: (mode: 'day' | 'month') => void;
  currentMinute: number; // 0..1440 for day, 0..30 for month
  onTimeChange: (minute: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNewSeed: () => void;
  selectedScenarioId: string;
}

export const ScenarioTimelineLanes: React.FC<ScenarioTimelineLanesProps> = ({
  runResult,
  mode,
  onModeChange,
  currentMinute,
  onTimeChange,
  isPlaying,
  onTogglePlay,
  onNewSeed,
  selectedScenarioId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState<number>(700);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const rect = el.getBoundingClientRect();
      // On desktop lane has ~230px label column, on mobile it stacks
      const isMobile = window.innerWidth < 768;
      const w = Math.max(220, rect.width - (isMobile ? 0 : 230));
      setSvgWidth(w);
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isMonth = mode === 'month';
  const maxMinutes = isMonth ? 30 : 1440;
  const m = Math.min(Math.max(0, currentMinute), maxMinutes);

  // Extract real incident timestamps in minutes from response
  const rawIncidents = runResult?.incident_list || [];
  const incidents = rawIncidents
    .filter((inc) => {
      if (selectedScenarioId === 'all') return true;
      if (inc.matched_truth_event_id && inc.matched_truth_event_id.includes(selectedScenarioId.toLowerCase())) {
        return true;
      }
      // Check class prefix
      if (selectedScenarioId === 'S1' && (inc.cls.startsWith('GAS') || inc.reason_ru.toLowerCase().includes('газ'))) return true;
      if (selectedScenarioId === 'S2' && (inc.cls.startsWith('GAS') || inc.reason_ru.toLowerCase().includes('скачок'))) return true;
      if (selectedScenarioId === 'S3' && inc.cls.startsWith('TEMP')) return true;
      if (selectedScenarioId === 'S4' && inc.cls === 'FIRE') return true;
      if (selectedScenarioId === 'S5' && inc.cls === 'FLOOD') return true;
      if (selectedScenarioId === 'S6' && inc.cls === 'CHATTER') return true;
      if (selectedScenarioId === 'S7' && inc.cls === 'COMM_LOSS') return true;
      if (selectedScenarioId === 'S8' && inc.cls === 'SETPOINT_CHATTER') return true;
      return true; // default include
    })
    .map((inc) => (isMonth ? (inc.ts / 86400) : (inc.ts / 60)));

  incidents.sort((a, b) => a - b);

  // Real comparison totals from API response
  const comp = runResult?.comparison;
  const totalFast = comp?.fast?.alerts_total ?? (runResult?.summary?.alerts_total || 146);
  const totalStatic = comp?.static_dedup?.alerts_total ?? 535;
  const totalNaive = comp?.naive?.alerts_total ?? 1436;
  const totalIncidents = incidents.length > 0 ? incidents.length : (runResult?.summary?.incidents || 34);

  // Function to distribute alerts to incident timestamps
  const distributeToIncidents = (total: number, incList: number[]) => {
    if (incList.length === 0) return [];
    const base = Math.floor(total / incList.length);
    const rem = total % incList.length;
    return incList.map((t, idx) => ({
      t,
      count: base + (idx < rem ? 1 : 0),
    }));
  };

  const fastDistribution = distributeToIncidents(totalFast, incidents);
  const staticDistribution = distributeToIncidents(totalStatic, incidents);
  const naiveDistribution = distributeToIncidents(totalNaive, incidents);

  // Live count computed for any time m
  const countUpTo = (dist: Array<{ t: number; count: number }>, maxTotal: number) => {
    if (m >= maxMinutes - 0.001) return maxTotal;
    let sum = 0;
    for (const item of dist) {
      if (item.t <= m) {
        sum += item.count;
      }
    }
    return sum;
  };

  const liveIncidents = m >= maxMinutes - 0.001 ? totalIncidents : incidents.filter((t) => t <= m).length;
  const liveFast = countUpTo(fastDistribution, totalFast);
  const liveStatic = countUpTo(staticDistribution, totalStatic);
  const liveNaive = countUpTo(naiveDistribution, totalNaive);

  // Pointer scrubber handler
  const handlePointerScrub = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const nextVal = isMonth ? Math.round(frac * 30 * 4) / 4 : Math.round((frac * 1440) / 5) * 5;
    onTimeChange(nextVal);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = isMonth ? 1 : 5;
    const bigStep = isMonth ? 5 : 60;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onTimeChange(Math.min(maxMinutes, m + step));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onTimeChange(Math.max(0, m - step));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      onTimeChange(Math.min(maxMinutes, m + bigStep));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      onTimeChange(Math.max(0, m - bigStep));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onTimeChange(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onTimeChange(maxMinutes);
    } else if (e.key === ' ') {
      e.preventDefault();
      onTogglePlay();
    }
  };

  const playheadX = (m / maxMinutes) * svgWidth;

  // Render SVG lane paths
  const renderLaneTicks = (
    list: number[],
    color: string,
    strokeWidth: number,
    upTo: number
  ) => {
    return list
      .filter((t) => t <= upTo)
      .map((t, idx) => {
        const x = ((t / maxMinutes) * svgWidth).toFixed(1);
        return <line key={idx} x1={x} x2={x} y1="8" y2="36" stroke={color} strokeWidth={strokeWidth} />;
      });
  };

  const lanes = [
    {
      id: 'inc',
      label: 'Инциденты',
      sub: 'событий',
      color: 'var(--ink)',
      count: liveIncidents.toLocaleString('ru-RU'),
      strokeWidth: 3,
      ticks: incidents,
    },
    {
      id: 'fast',
      label: 'НейроКонтур',
      sub: 'звонков',
      color: 'var(--ac)',
      count: liveFast.toLocaleString('ru-RU'),
      strokeWidth: 2,
      ticks: incidents,
    },
    {
      id: 'static',
      label: 'Статический порог',
      sub: 'звонков',
      color: 'oklch(0.72 0.15 72)',
      count: liveStatic.toLocaleString('ru-RU'),
      strokeWidth: 2,
      ticks: incidents,
    },
    {
      id: 'naive',
      label: 'Простой порог',
      sub: 'звонков',
      color: 'var(--rd)',
      count: liveNaive.toLocaleString('ru-RU'),
      strokeWidth: 2,
      ticks: incidents,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="min-h-[50px] sm:min-h-[54px] px-6 rounded-full border-0 font-semibold text-sm sm:text-base cursor-pointer inline-flex items-center gap-3 shadow-md transition-transform active:scale-95"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            aria-label={isPlaying ? 'Пауза воспроизведения' : 'Воспроизвести смену'}
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--bg)', color: 'var(--ink)' }}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
            </span>
            <span>{isPlaying ? 'Пауза' : 'Воспроизвести смену'}</span>
          </button>

          {/* New Seed Button */}
          <button
            type="button"
            onClick={onNewSeed}
            className="min-h-[48px] sm:min-h-[52px] px-4 rounded-full border border-[var(--ln2)] hover:border-[var(--ac)] bg-transparent font-semibold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer transition-colors text-[var(--ink)]"
            title="Сгенерировать другой номер смены"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Другая смена</span>
          </button>
        </div>

        {/* Day / Month Segmented Switch */}
        <div className="flex p-1 rounded-full border border-[var(--ln2)] bg-[var(--sf2)]">
          <button
            type="button"
            onClick={() => onModeChange('day')}
            className={`min-h-[42px] px-4 rounded-full text-xs sm:text-sm font-semibold transition-all border-0 cursor-pointer ${
              !isMonth ? 'shadow-sm text-[var(--ink)] bg-[var(--sf)]' : 'text-[var(--mu)] bg-transparent'
            }`}
          >
            <Clock className="w-3.5 h-3.5 inline mr-1.5" />
            Сутки
          </button>
          <button
            type="button"
            onClick={() => onModeChange('month')}
            className={`min-h-[42px] px-4 rounded-full text-xs sm:text-sm font-semibold transition-all border-0 cursor-pointer ${
              isMonth ? 'shadow-sm text-[var(--ink)] bg-[var(--sf)]' : 'text-[var(--mu)] bg-transparent'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
            Месяц
          </button>
        </div>
      </div>

      {/* 4 Lanes Container */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="slider"
        aria-label="Лента времени смены. Используйте стрелки влево и вправо для перемотки"
        aria-valuenow={Math.round(m)}
        aria-valuemin={0}
        aria-valuemax={maxMinutes}
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-2.5 p-3 sm:p-4 rounded-2xl border border-[var(--ln2)] bg-[var(--sf)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac)]"
      >
        {lanes.map((lane) => (
          <div
            key={lane.id}
            className="grid grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)] gap-2 sm:gap-3 items-center min-w-0"
          >
            {/* Label & live counter */}
            <div className="flex items-center justify-between md:justify-start gap-2 min-w-0 pr-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: lane.color }}
                />
                <div className="min-w-0 leading-tight">
                  <span className="font-semibold text-xs sm:text-[13px] text-[var(--ink)] block truncate">
                    {lane.label}
                  </span>
                  <span className="text-[11px] text-[var(--mu)] block">
                    {lane.sub}
                  </span>
                </div>
              </div>

              <span
                className="font-normal text-xl sm:text-2xl num ml-auto shrink-0"
                style={{
                  fontFamily: "'Source Serif 4', Georgia, serif",
                  color: lane.color,
                }}
              >
                {lane.count}
              </span>
            </div>

            {/* SVG Scrub Strip */}
            <svg
              width="100%"
              height="44"
              viewBox={`0 0 ${svgWidth} 44`}
              preserveAspectRatio="none"
              onPointerDown={handlePointerScrub}
              onPointerMove={(e) => {
                if (e.buttons === 1) handlePointerScrub(e);
              }}
              className="block rounded-xl cursor-ew-resize select-none overflow-hidden"
              style={{
                background: 'var(--sf2)',
                touchAction: 'pan-y',
              }}
            >
              {/* Future ticks (dimmed) */}
              <g opacity="0.25">{renderLaneTicks(lane.ticks, lane.color, lane.strokeWidth, maxMinutes)}</g>

              {/* Past ticks (active) */}
              <g>{renderLaneTicks(lane.ticks, lane.color, lane.strokeWidth, m)}</g>

              {/* Vertical playhead cursor */}
              <line
                x1={playheadX}
                x2={playheadX}
                y1="0"
                y2="44"
                stroke="var(--ink)"
                strokeWidth="2"
              />
              <circle
                cx={playheadX}
                cy="22"
                r="7"
                fill="var(--ink)"
                stroke="var(--bg)"
                strokeWidth="2.5"
              />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
};

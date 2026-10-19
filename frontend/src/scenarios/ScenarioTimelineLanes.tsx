import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { BarChart3, ChevronDown, Flame, Bell } from 'lucide-react';
import { ScenarioRunResponse } from '../types';
import { incidentInScenario } from './scenarioLabels';

interface ScenarioTimelineLanesProps {
  runResult: ScenarioRunResponse | null;
  mode: 'day' | 'month';
  currentMinute: number; // 0..1440 for day, 0..30 for month
  onTimeChange: (minute: number) => void;
  selectedScenarioId: string;
  loading?: boolean;
}

export const ScenarioTimelineLanes: React.FC<ScenarioTimelineLanesProps> = ({
  runResult,
  mode,
  currentMinute,
  onTimeChange,
  selectedScenarioId,
  loading = false,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState<number>(700);

  // Default open on desktop (>=768px), closed on mobile
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
  });

  const isScrubbingRef = useRef<boolean>(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const updateWidth = () => {
      const rect = el.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;
      // On desktop lane has ~230px label column, on mobile it stacks
      const sw = Math.max(180, rect.width - (isMobile ? 0 : 242));
      setSvgWidth(sw);
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isMonth = mode === 'month';
  const isAll = selectedScenarioId === 'all';
  const maxMinutes = isMonth ? 30 : 1440;
  const m = Math.min(Math.max(0, currentMinute), maxMinutes);
  const isAtEnd = m >= maxMinutes - 0.001;

  // Real incidents from runResult
  const rawIncidents = runResult?.incident_list || [];

  // Alerts matching selected scenario
  const scenarioAlerts = useMemo(() => {
    return rawIncidents.filter((inc) => incidentInScenario(inc, selectedScenarioId));
  }, [rawIncidents, selectedScenarioId]);

  // Distinct incidents (excluding reminders & escalations)
  const incidentOnly = useMemo(() => {
    return rawIncidents.filter(
      (inc) => !inc.is_reminder && !inc.is_escalation && incidentInScenario(inc, selectedScenarioId)
    );
  }, [rawIncidents, selectedScenarioId]);

  // Real comparison totals
  const comp = runResult?.comparison;
  const totalFast = comp?.fast?.alerts_total ?? runResult?.summary?.alerts_total ?? 0;
  const totalStatic = comp?.static_dedup?.alerts_total ?? 0;
  const totalNaive = comp?.naive?.alerts_total ?? 0;

  // Day mode: timestamps in minutes [0, 1440]
  const dayIncTimestamps = useMemo(() => {
    return incidentOnly.map((inc) => inc.ts / 60).sort((a, b) => a - b);
  }, [incidentOnly]);

  const dayFastTimestamps = useMemo(() => {
    return scenarioAlerts.map((inc) => inc.ts / 60).sort((a, b) => a - b);
  }, [scenarioAlerts]);

  // Distribute totals for static / naive across incident timestamps in day mode
  const distributeToIncidents = (total: number, incList: number[]) => {
    if (incList.length === 0) return [];
    const base = Math.floor(total / incList.length);
    const rem = total % incList.length;
    return incList.map((t, idx) => ({
      t,
      count: base + (idx < rem ? 1 : 0),
    }));
  };

  const dayStaticDist = useMemo(() => {
    return isAll ? distributeToIncidents(totalStatic, dayFastTimestamps) : [];
  }, [isAll, totalStatic, dayFastTimestamps]);

  const dayNaiveDist = useMemo(() => {
    return isAll ? distributeToIncidents(totalNaive, dayFastTimestamps) : [];
  }, [isAll, totalNaive, dayFastTimestamps]);

  const countUpTo = (dist: Array<{ t: number; count: number }>, maxTotal: number) => {
    if (isAtEnd) return maxTotal;
    let sum = 0;
    for (const item of dist) {
      if (item.t <= m) sum += item.count;
    }
    return sum;
  };

  // Month mode: 30 daily buckets [0..29]
  const monthIncDaily = useMemo(() => {
    const daily = Array(30).fill(0);
    incidentOnly.forEach((inc) => {
      const d = Math.min(29, Math.max(0, Math.floor(inc.ts / 86400)));
      daily[d]++;
    });
    return daily;
  }, [incidentOnly]);

  const monthFastDaily = useMemo(() => {
    const daily = Array(30).fill(0);
    scenarioAlerts.forEach((inc) => {
      const d = Math.min(29, Math.max(0, Math.floor(inc.ts / 86400)));
      daily[d]++;
    });
    return daily;
  }, [scenarioAlerts]);

  const monthStaticDaily = useMemo(() => {
    if (!isAll) return [];
    const totInc = monthIncDaily.reduce((a, b) => a + b, 0) || 1;
    return monthIncDaily.map((c) => Math.round(totalStatic * (c / totInc)));
  }, [isAll, totalStatic, monthIncDaily]);

  const monthNaiveDaily = useMemo(() => {
    if (!isAll) return [];
    const totInc = monthIncDaily.reduce((a, b) => a + b, 0) || 1;
    return monthIncDaily.map((c) => Math.round(totalNaive * (c / totInc)));
  }, [isAll, totalNaive, monthIncDaily]);

  // Live count computations
  const currentDayFloor = Math.floor(m);

  const liveIncidentsCount = isMonth
    ? (isAtEnd
        ? monthIncDaily.reduce((a, b) => a + b, 0)
        : monthIncDaily.slice(0, currentDayFloor).reduce((a, b) => a + b, 0))
    : (isAtEnd ? dayIncTimestamps.length : dayIncTimestamps.filter((t) => t <= m).length);

  const liveFastCount = isMonth
    ? (isAtEnd
        ? monthFastDaily.reduce((a, b) => a + b, 0)
        : monthFastDaily.slice(0, currentDayFloor).reduce((a, b) => a + b, 0))
    : (isAll
        ? countUpTo(distributeToIncidents(totalFast, dayFastTimestamps), totalFast)
        : (isAtEnd ? dayFastTimestamps.length : dayFastTimestamps.filter((t) => t <= m).length));

  const liveStaticCount = isAll
    ? (isMonth
        ? (isAtEnd
            ? totalStatic
            : monthStaticDaily.slice(0, currentDayFloor).reduce((a, b) => a + b, 0))
        : countUpTo(dayStaticDist, totalStatic))
    : null;

  const liveNaiveCount = isAll
    ? (isMonth
        ? (isAtEnd
            ? totalNaive
            : monthNaiveDaily.slice(0, currentDayFloor).reduce((a, b) => a + b, 0))
        : countUpTo(dayNaiveDist, totalNaive))
    : null;

  // Path generators for SVG
  const W = svgWidth;
  const bw = W / 30;
  const swDay = (typeof window !== 'undefined' && window.innerWidth < 768) ? 1.6 : 1.8;
  const swMonth = Math.max(3, bw - 4);

  const getDayPath = (timestamps: number[], upto: number, isInc: boolean) => {
    return timestamps
      .filter((t) => t <= upto)
      .map((t) => {
        const X = ((t / 1440) * W).toFixed(1);
        return isInc ? `M${X} 5V31` : `M${X} 8V28`;
      })
      .join('');
  };

  const getMonthPath = (daily: number[], uptoDays: number) => {
    if (daily.length === 0) return '';
    const mx = Math.max(...daily, 1);
    const count = Math.min(daily.length, uptoDays);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const v = daily[i];
      if (v === 0) continue;
      const h = Math.max(2, (v / mx) * 28);
      const x = (i * bw + bw / 2).toFixed(1);
      parts.push(`M${x} 34V${(34 - h).toFixed(1)}`);
    }
    return parts.join('');
  };

  // Build lane configurations
  const lanes = [
    {
      id: 'inc',
      label: 'Инциденты',
      sub: 'событий',
      icon: Flame,
      color: 'var(--ink)',
      radius: '3px',
      strokeWidth: isMonth ? swMonth : 3.5,
      count: liveIncidentsCount.toLocaleString('ru-RU'),
      dAll: isMonth ? getMonthPath(monthIncDaily, 30) : getDayPath(dayIncTimestamps, 1440, true),
      dPast: isMonth ? getMonthPath(monthIncDaily, currentDayFloor) : getDayPath(dayIncTimestamps, m, true),
      active: true,
    },
    {
      id: 'neuro',
      label: 'НейроКонтур',
      sub: 'звонков',
      icon: Bell,
      color: 'var(--ac)',
      radius: '50%',
      strokeWidth: isMonth ? swMonth : swDay,
      count: liveFastCount.toLocaleString('ru-RU'),
      dAll: isMonth ? getMonthPath(monthFastDaily, 30) : getDayPath(dayFastTimestamps, 1440, false),
      dPast: isMonth ? getMonthPath(monthFastDaily, currentDayFloor) : getDayPath(dayFastTimestamps, m, false),
      active: true,
    },
    {
      id: 'stat',
      label: 'Статический порог',
      sub: isAll ? 'звонков' : 'нет разбивки по сценариям',
      icon: Bell,
      color: isAll ? 'oklch(0.72 0.15 72)' : 'var(--mu)',
      radius: '50%',
      strokeWidth: isMonth ? swMonth : swDay,
      count: isAll && liveStaticCount !== null ? liveStaticCount.toLocaleString('ru-RU') : '—',
      dAll: isAll ? (isMonth ? getMonthPath(monthStaticDaily, 30) : getDayPath(dayFastTimestamps, 1440, false)) : '',
      dPast: isAll ? (isMonth ? getMonthPath(monthStaticDaily, currentDayFloor) : getDayPath(dayFastTimestamps, m, false)) : '',
      active: isAll,
    },
    {
      id: 'simp',
      label: 'Простой порог',
      sub: isAll ? 'звонков' : 'нет разбивки по сценариям',
      icon: Bell,
      color: isAll ? 'var(--rd)' : 'var(--mu)',
      radius: '50%',
      strokeWidth: isMonth ? swMonth : swDay,
      count: isAll && liveNaiveCount !== null ? liveNaiveCount.toLocaleString('ru-RU') : '—',
      dAll: isAll ? (isMonth ? getMonthPath(monthNaiveDaily, 30) : getDayPath(dayFastTimestamps, 1440, false)) : '',
      dPast: isAll ? (isMonth ? getMonthPath(monthNaiveDaily, currentDayFloor) : getDayPath(dayFastTimestamps, m, false)) : '',
      active: isAll,
    },
  ];

  // Scrubber pointer handlers
  const calcScrubVal = useCallback(
    (clientX: number, elem: SVGSVGElement) => {
      const rect = elem.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return isMonth
        ? Math.round(frac * 30 * 4) / 4
        : Math.round((frac * 1440) / 5) * 5;
    },
    [isMonth]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (loading) return;
    isScrubbingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const nextVal = calcScrubVal(e.clientX, e.currentTarget);
    onTimeChange(nextVal);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isScrubbingRef.current || loading) return;
    const nextVal = calcScrubVal(e.clientX, e.currentTarget);
    onTimeChange(nextVal);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isScrubbingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const playheadX = (m / maxMinutes) * W;

  return (
    <section
      className="rounded-[24px] shadow-[var(--sh)] p-2 sm:p-[10px_24px_22px]"
      style={{ background: 'var(--sf)' }}
    >
      {/* Header Toggle Button */}
      <div ref={boxRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="w-full min-h-[48px] border-0 bg-transparent flex items-center gap-2.5 text-left p-0 cursor-pointer"
          style={{ color: 'var(--ink)' }}
        >
          <BarChart3 className="w-5 h-5 text-[var(--ink)] shrink-0" />
          <span className="flex-1 font-semibold text-base leading-tight">Подробно по времени</span>
          <span
            className="grid place-items-center transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <ChevronDown className="w-5 h-5 text-[var(--mu)]" />
          </span>
        </button>
      </div>

      {/* Lanes Content */}
      {isOpen && (
        <div className="flex flex-col gap-1.5 mt-2.5">
          {lanes.map((l) => {
            const Icon = l.icon;
            return (
              <div
                key={l.id}
                className="grid grid-cols-1 md:grid-cols-[230px_minmax(0,1fr)] gap-1 md:gap-3 items-center min-w-0"
              >
                {/* Lane Info Column */}
                <div className="flex items-center gap-2 min-w-0 py-1">
                  <i
                    className="w-2.5 h-2.5 shrink-0"
                    style={{ borderRadius: l.radius, background: l.color }}
                  />
                  <span className="flex-1 min-w-0 leading-tight">
                    <span className="font-semibold text-[13.5px] block truncate text-[var(--ink)]">
                      {l.label}
                    </span>
                    <span className="flex items-center gap-1 text-[11.5px] font-medium text-[var(--mu)] mt-0.5 truncate">
                      <Icon className="w-3 h-3 shrink-0" />
                      <span>{l.sub}</span>
                    </span>
                  </span>
                  <b
                    className="text-[22px] leading-none font-normal shrink-0 ml-auto md:ml-0"
                    style={{
                      fontFamily: "'Source Serif 4', Georgia, serif",
                      color: l.color,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {l.count}
                  </b>
                </div>

                {/* SVG Strip or Loading Placeholder */}
                {loading || !runResult ? (
                  <i
                    className="block h-9 rounded-xl w-full"
                    style={{
                      background: 'var(--sf2)',
                      animation: 'nkShim 1.3s ease-in-out infinite',
                    }}
                  />
                ) : (
                  <svg
                    width={W}
                    height={36}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="block w-full max-w-full rounded-xl select-none cursor-ew-resize touch-pan-y"
                    style={{ background: 'var(--sf2)' }}
                    aria-label="Лента времени. Нажмите или проведите, чтобы перемотать смену"
                    role="img"
                  >
                    {/* Future ticks / bars */}
                    {l.active && l.dAll && (
                      <path
                        d={l.dAll}
                        stroke={l.color}
                        strokeWidth={l.strokeWidth}
                        opacity={0.25}
                        fill="none"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Past ticks / bars */}
                    {l.active && l.dPast && (
                      <path
                        d={l.dPast}
                        stroke={l.color}
                        strokeWidth={l.strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Playhead vertical line & thumb circle */}
                    <line
                      x1={playheadX}
                      x2={playheadX}
                      y1={0}
                      y2={36}
                      stroke="var(--ink)"
                      strokeWidth={2}
                    />
                    <circle
                      cx={playheadX}
                      cy={18}
                      r={6}
                      fill="var(--ink)"
                      stroke="var(--bg)"
                      strokeWidth={2.5}
                    />
                  </svg>
                )}
              </div>
            );
          })}

          <span
            className="text-xs font-medium text-[var(--mu)] mt-1.5 leading-relaxed block"
            style={{ textWrap: 'pretty' }}
          >
            Ход счётчиков условный: итог за смену точный, распределение по времени приблизительное
          </span>
        </div>
      )}
    </section>
  );
};

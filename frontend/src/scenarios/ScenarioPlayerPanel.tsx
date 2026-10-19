import React, { useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RefreshCw, Bell } from 'lucide-react';

interface ScenarioPlayerPanelProps {
  mode: 'day' | 'month';
  currentMinute: number;
  onTimeChange: (minute: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNewSeed: () => void;
  loading: boolean;
  error: string | null;
  incidentTimestamps: number[]; // In minutes for ticks in day mode
  liveFast: number;
  liveStatic: number;
  liveNaive: number;
  nWarn: number;
  nHit: number;
  nDone: number;
  clockLabel: string;
  selectedScenarioId?: string;
  onPanelVisibleChange?: (visible: boolean) => void;
}

export const ScenarioPlayerPanel: React.FC<ScenarioPlayerPanelProps> = ({
  mode,
  currentMinute,
  onTimeChange,
  isPlaying,
  onTogglePlay,
  onNewSeed,
  loading,
  error,
  incidentTimestamps,
  liveFast,
  liveStatic,
  liveNaive,
  nWarn,
  nHit,
  nDone,
  clockLabel,
  selectedScenarioId = 'all',
  onPanelVisibleChange,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);

  const locked = loading || !!error;
  const isMonth = mode === 'month';
  const isAll = selectedScenarioId === 'all';
  const maxMinutes = isMonth ? 30 : 1440;
  const clampedMinute = Math.min(Math.max(0, currentMinute), maxMinutes);
  const pct = Math.min(100, Math.max(0, (clampedMinute / maxMinutes) * 100));

  const isAtEnd = !isPlaying && currentMinute >= maxMinutes - 0.001;

  // Mini-dock visibility: combine IntersectionObserver with a passive scroll listener
  // on nearest scrollable ancestor (or window) so fast jumps/flings reliably update dockVisible.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const checkVisibility = () => {
      if (!panelRef.current) return;
      const isPast = panelRef.current.getBoundingClientRect().bottom < 56;
      onPanelVisibleChange?.(isPast);
    };

    // 1. Compute once on mount and after loading finishes
    checkVisibility();

    // 2. Keep IntersectionObserver
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        () => {
          checkVisibility();
        },
        { threshold: [0, 0.01, 1] }
      );
      observer.observe(el);
    }

    // 3. Find nearest scrollable ancestor (walk up parentElement until overflowY is auto/scroll)
    let scrollParent: HTMLElement | Window = window;
    let curr = el.parentElement;
    while (curr) {
      const style = window.getComputedStyle(curr);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollParent = curr;
        break;
      }
      curr = curr.parentElement;
    }

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        checkVisibility();
      });
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    if (scrollParent !== window) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (observer) observer.disconnect();
      scrollParent.removeEventListener('scroll', handleScroll);
      if (scrollParent !== window) {
        window.removeEventListener('scroll', handleScroll);
      }
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [onPanelVisibleChange, loading]);

  // Pointer scrubbing logic
  const calcScrubVal = useCallback(
    (clientX: number, elem: HTMLElement) => {
      const rect = elem.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return isMonth
        ? Math.round(frac * 30 * 4) / 4
        : Math.round((frac * 1440) / 5) * 5;
    },
    [isMonth]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (locked) return;
    isScrubbingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const nextVal = calcScrubVal(e.clientX, e.currentTarget);
    onTimeChange(nextVal);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current || locked) return;
    const nextVal = calcScrubVal(e.clientX, e.currentTarget);
    onTimeChange(nextVal);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isScrubbingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Keyboard controls on the main scrubber
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (locked) return;
    const step = isMonth ? 1 : 5;
    const bigStep = isMonth ? 5 : 60;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onTimeChange(Math.min(maxMinutes, currentMinute + step));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onTimeChange(Math.max(0, currentMinute - step));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      onTimeChange(Math.min(maxMinutes, currentMinute + bigStep));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      onTimeChange(Math.max(0, currentMinute - bigStep));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onTimeChange(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onTimeChange(maxMinutes);
    } else if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onTogglePlay();
    }
  };

  const playAriaLabel = isPlaying
    ? 'Пауза'
    : isAtEnd
    ? 'Повторить смену'
    : 'Воспроизвести смену';

  return (
    <div
      ref={panelRef}
      className="flex flex-col gap-3.5 p-3.5 sm:p-[22px_26px_24px] md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-6 md:items-start"
    >
      {/* Left Column / Top (Play, Clock, Shuffle, Scrubber) */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap">
          {/* Play Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={locked}
            aria-label={playAriaLabel}
            className={`h-14 min-w-[56px] rounded-full border-0 font-semibold text-[15px] flex items-center justify-center gap-2.5 shrink-0 transition-opacity ${
              isAtEnd ? 'px-[22px] pl-[18px]' : 'w-14 p-0'
            } ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              boxShadow: '0 8px 20px -8px var(--ink)',
            }}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : isAtEnd ? (
              <>
                <RefreshCw className="w-5 h-5 shrink-0" />
                <span className="whitespace-nowrap">Повторить смену</span>
              </>
            ) : (
              <Play className="w-6 h-6 ml-0.5 fill-current" />
            )}
          </button>

          {/* Clock display */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <span
              className="font-semibold text-xl sm:text-[32px] leading-none whitespace-nowrap"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--ink)',
              }}
            >
              {clockLabel}
            </span>
            <span
              className="hidden sm:block text-[12.5px] font-medium leading-none"
              style={{ color: 'var(--mu)' }}
            >
              {isMonth ? 'модель · 30 суток' : 'смена · 24 часа'}
            </span>
          </div>

          {/* Shuffle / Another Seed Button */}
          <button
            type="button"
            onClick={onNewSeed}
            disabled={locked}
            aria-label="Другая смена"
            title="Другая смена"
            className={`w-12 h-12 rounded-full border-[1.5px] border-[var(--ln2)] bg-transparent flex items-center justify-center shrink-0 transition-opacity text-[var(--ink)] ${
              locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--ac)]'
            }`}
          >
            <RefreshCw className="w-[21px] h-[21px]" />
          </button>
        </div>

        {/* Scrubber slider */}
        <div
          tabIndex={locked ? -1 : 0}
          role="slider"
          aria-label="Перемотка смены"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={clockLabel}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative h-11 touch-none cursor-ew-resize mx-1 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac)] rounded-lg transition-opacity ${
            locked ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          {/* Background track */}
          <i
            aria-hidden="true"
            className="absolute left-0 right-0 top-[18px] h-2 rounded-[4px]"
            style={{ background: 'var(--ln2)' }}
          />
          {/* Filled track */}
          <i
            aria-hidden="true"
            className="absolute left-0 top-[18px] h-2 rounded-[4px]"
            style={{ background: 'var(--ac)', width: `${pct}%` }}
          />
          {/* Incident ticks in day mode */}
          {!isMonth &&
            incidentTimestamps.map((t, idx) => {
              const tickPct = (t / 1440) * 100;
              return (
                <i
                  key={idx}
                  aria-hidden="true"
                  className="absolute top-3 w-0.5 h-5 -ml-[1px] rounded-[1px]"
                  style={{
                    left: `${tickPct}%`,
                    background: 'var(--ink)',
                    opacity: 0.28,
                  }}
                />
              );
            })}
          {/* Thumb */}
          <i
            aria-hidden="true"
            className="absolute top-2.5 w-6 h-6 -ml-3 rounded-full border-4"
            style={{
              left: `${pct}%`,
              background: 'var(--ink)',
              borderColor: 'var(--sf)',
              boxShadow: '0 2px 8px #0003',
            }}
          />
        </div>

        {/* Ticks text under slider */}
        <div
          className="flex justify-between -mt-2 mx-1 text-[11.5px] font-medium"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--mu)',
          }}
        >
          <span>{isMonth ? 'день 1' : '00:00'}</span>
          <span>{isMonth ? 'день 15' : '12:00'}</span>
          <span>{isMonth ? 'день 30' : '24:00'}</span>
        </div>
      </div>

      {/* Right Column / Below (Call Counters, Legend, Notes) */}
      <div
        className="flex flex-col gap-2.5 sm:gap-3 pt-3 border-t border-[var(--ln)] sm:border-t-0 sm:pt-0 sm:bg-[var(--sf2)] sm:rounded-[22px] sm:p-[16px_18px]"
      >
        <div
          className="flex items-center gap-2 font-semibold text-[13px]"
          style={{ color: 'var(--mu)' }}
        >
          <Bell className="w-4 h-4" />
          <span>Звонков диспетчеру</span>
        </div>

        {/* 3 Approach Numbers */}
        <div className="grid grid-cols-3 gap-2">
          <div className="min-w-0">
            <div
              className="text-3xl sm:text-4xl font-normal leading-none"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                color: 'var(--ac)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {liveFast.toLocaleString('ru-RU')}
            </div>
            <div
              className="text-xs font-medium mt-1.5 leading-tight"
              style={{ color: 'var(--mu)' }}
            >
              НейроКонтур
            </div>
          </div>

          <div className="min-w-0">
            <div
              className="text-3xl sm:text-4xl font-normal leading-none"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                color: isAll ? 'oklch(0.72 0.15 72)' : 'var(--mu)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {isAll ? liveStatic.toLocaleString('ru-RU') : '—'}
            </div>
            <div
              className="text-xs font-medium mt-1.5 leading-tight"
              style={{ color: 'var(--mu)' }}
            >
              Статический порог
            </div>
          </div>

          <div className="min-w-0">
            <div
              className="text-3xl sm:text-4xl font-normal leading-none"
              style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                color: isAll ? 'var(--rd)' : 'var(--mu)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {isAll ? liveNaive.toLocaleString('ru-RU') : '—'}
            </div>
            <div
              className="text-xs font-medium mt-1.5 leading-tight"
              style={{ color: 'var(--mu)' }}
            >
              Простой порог
            </div>
          </div>
        </div>

        {/* Legend dots in day mode only */}
        {!isMonth && (
          <div className="flex gap-x-3.5 gap-y-2 flex-wrap font-semibold text-[13px]">
            <span className="flex items-center gap-1.5">
              <i className="w-[11px] h-[11px] rounded-full" style={{ background: 'var(--ac)' }} />
              <span>
                заранее <b className="font-semibold num">{nWarn}</b>
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <i className="w-[11px] h-[11px] rounded-full" style={{ background: 'var(--rd)' }} />
              <span>
                идёт <b className="font-semibold num">{nHit}</b>
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <i className="w-[11px] h-[11px] rounded-full" style={{ background: 'var(--gn)' }} />
              <span>
                решено <b className="font-semibold num">{nDone}</b>
              </span>
            </span>
          </div>
        )}

        {/* Notes */}
        <span className="text-xs font-medium leading-relaxed" style={{ color: 'var(--mu)' }}>
          {isMonth
            ? 'На карте — события выбранного дня.'
            : '«Заранее» — фиксированное окно: за 20 мин до события в режиме «Сутки». «Решено» — условность: событие считается закрытым через 150 мин.'}
        </span>
        <span className="text-xs font-medium leading-relaxed" style={{ color: 'var(--mu)' }}>
          Ход счётчиков условный: итог за смену точный, распределение по времени приблизительное
        </span>
      </div>
    </div>
  );
};

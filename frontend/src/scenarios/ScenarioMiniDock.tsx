import React, { useRef, useCallback } from 'react';
import { Play, Pause, RefreshCw } from 'lucide-react';

interface ScenarioMiniDockProps {
  visible: boolean;
  locked: boolean;
  isPlaying: boolean;
  isAtEnd: boolean;
  onTogglePlay: () => void;
  playAriaLabel: string;
  clockMini: string;
  clockLabel: string;
  currentMinute: number;
  mode: 'day' | 'month';
  onTimeChange: (minute: number) => void;
}

export const ScenarioMiniDock: React.FC<ScenarioMiniDockProps> = ({
  visible,
  locked,
  isPlaying,
  isAtEnd,
  onTogglePlay,
  playAriaLabel,
  clockMini,
  clockLabel,
  currentMinute,
  mode,
  onTimeChange,
}) => {
  const isScrubbingRef = useRef(false);
  const isMonth = mode === 'month';
  const maxMinutes = isMonth ? 30 : 1440;
  const clampedMinute = Math.min(Math.max(0, currentMinute), maxMinutes);
  const pct = Math.min(100, Math.max(0, (clampedMinute / maxMinutes) * 100));

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

  return (
    <div className="sm:hidden sticky bottom-0 h-0 z-20 pointer-events-none">
      <div
        className="absolute left-0 right-0 bottom-2.5 px-3 transition-all duration-300"
        style={{
          opacity: visible && !locked ? 1 : 0,
          transform: visible && !locked ? 'translateY(0)' : 'translateY(24px)',
          pointerEvents: visible && !locked ? 'auto' : 'none',
        }}
      >
        <div
          className="flex items-center gap-3 rounded-full p-[6px_16px_6px_6px]"
          style={{
            background: 'var(--sf)',
            boxShadow: '0 8px 28px -6px #0005, 0 0 0 1.5px var(--ln2)',
          }}
        >
          {/* Play/Pause Button */}
          <button
            type="button"
            disabled={locked}
            onClick={onTogglePlay}
            aria-label={playAriaLabel}
            className="w-12 h-12 rounded-full border-0 flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : isAtEnd ? (
              <RefreshCw className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5 fill-current" />
            )}
          </button>

          {/* Mini Clock */}
          <span
            className="font-semibold text-[17px] shrink-0 min-w-0"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--ink)',
            }}
          >
            {clockMini}
          </span>

          {/* Compact Scrubber */}
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
            className="relative flex-1 h-11 touch-none min-w-[40px] cursor-ew-resize select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac)] rounded-lg"
          >
            <i
              aria-hidden="true"
              className="absolute left-0 right-0 top-[19px] h-1.5 rounded-[3px]"
              style={{ background: 'var(--ln2)' }}
            />
            <i
              aria-hidden="true"
              className="absolute left-0 top-[19px] h-1.5 rounded-[3px]"
              style={{ background: 'var(--ac)', width: `${pct}%` }}
            />
            <i
              aria-hidden="true"
              className="absolute top-[11px] w-[22px] h-[22px] -ml-[11px] rounded-full border-[3.5px]"
              style={{
                left: `${pct}%`,
                background: 'var(--ink)',
                borderColor: 'var(--sf)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

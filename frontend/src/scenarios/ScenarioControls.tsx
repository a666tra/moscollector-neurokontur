import React from 'react';
import { Play, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface ScenarioControlsProps {
  mode: 'day' | 'month';
  onModeChange: (mode: 'day' | 'month') => void;
  seedInput: string;
  onSeedInputChange: (val: string) => void;
  isValidSeed: boolean;
  onRun: () => void;
  loading: boolean;
  progressText: string | null;
  elapsedSeconds?: number | null;
}

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({
  mode,
  onModeChange,
  seedInput,
  onSeedInputChange,
  isValidSeed,
  onRun,
  loading,
  progressText,
  elapsedSeconds,
}) => {
  return (
    <div className="panel p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Mode Segmented Switch & Seed Input */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Segmented Switch */}
          <div className="flex p-1 rounded-full border" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
            <button
              type="button"
              onClick={() => onModeChange('day')}
              disabled={loading}
              className={`h-9 px-4 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                mode === 'day' ? 'shadow-sm font-semibold' : ''
              }`}
              style={
                mode === 'day'
                  ? { background: 'var(--sf)', color: 'var(--ink)' }
                  : { color: 'var(--mut)' }
              }
              aria-pressed={mode === 'day'}
            >
              Сутки
            </button>
            <button
              type="button"
              onClick={() => onModeChange('month')}
              disabled={loading}
              className={`h-9 px-4 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                mode === 'month' ? 'shadow-sm font-semibold' : ''
              }`}
              style={
                mode === 'month'
                  ? { background: 'var(--sf)', color: 'var(--ink)' }
                  : { color: 'var(--mut)' }
              }
              aria-pressed={mode === 'month'}
            >
              30 суток
            </button>
          </div>

          {/* Seed Input */}
          <div className="flex items-center gap-2">
            <label htmlFor="scenario-seed-input" className="text-xs font-medium" style={{ color: 'var(--mut)' }}>
              Seed:
            </label>
            <input
              id="scenario-seed-input"
              type="number"
              min={0}
              max={10000}
              value={seedInput}
              onChange={e => onSeedInputChange(e.target.value)}
              disabled={loading}
              placeholder="42"
              className={`num h-9 w-24 sm:w-28 px-3 rounded-xl border text-xs sm:text-sm font-medium ${
                !isValidSeed ? 'border-red-500 text-red-600' : ''
              }`}
              style={{ background: 'var(--sf2)', borderColor: isValidSeed ? 'var(--ln)' : 'var(--cr)' }}
              aria-label="Случайное зерно (seed) от 0 до 10000"
              aria-invalid={!isValidSeed}
            />
            {!isValidSeed && (
              <span className="text-[11px] text-red-500">0..10 000</span>
            )}
          </div>
        </div>

        {/* Right: Run Button and Elapsed Info */}
        <div className="flex items-center gap-3">
          {typeof elapsedSeconds === 'number' && !loading && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs num" style={{ color: 'var(--mut)' }}>
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} />
              <span>Расчёт: {elapsedSeconds.toFixed(2)} с</span>
            </div>
          )}

          <button
            type="button"
            onClick={onRun}
            disabled={loading || !isValidSeed}
            className="btn btn-primary h-10 px-5 flex items-center gap-2"
            aria-label="Прогнать симуляцию сценариев"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Выполняется…</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Прогнать</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress indicator when running */}
      {loading && (
        <div className="pt-2 border-t flex flex-col gap-2" style={{ borderColor: 'var(--ln)' }}>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--mut)' }}>
            <span className="flex items-center gap-2 font-medium">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" style={{ color: 'var(--ac)' }} />
              {progressText || (mode === 'month' ? 'Генерация 30 суток телеметрии и прогон детекторов… ~3 с' : 'Генерация 24 ч телеметрии и прогон… ~0.5 с')}
            </span>
            <span className="num animate-pulse">расчёт</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--sf2)' }}>
            <div
              className="h-full rounded-full transition-all duration-300 animate-pulse"
              style={{
                width: '100%',
                background: 'linear-gradient(90deg, var(--ac), var(--at), var(--ac))',
                backgroundSize: '200% 100%',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

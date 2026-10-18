import React, { useMemo } from 'react';
import { BacktestWeek } from '../types';
import { ChevronLeft, ChevronRight, Play, Pause, Zap, Clock, Minus } from 'lucide-react';

interface Props {
  weeks: BacktestWeek[];
  scope: 'all' | 'new_incidents';
  selectedModel: 'deployed' | 'lgbm_weekly';
  onModelChange: (model: 'deployed' | 'lgbm_weekly') => void;
  selectedWeekIdx: number;
  onSelectWeek: (idx: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return iso;
};

export const WeeklyRibbon: React.FC<Props> = ({
  weeks,
  scope,
  selectedModel,
  onModelChange,
  selectedWeekIdx,
  onSelectWeek,
  isPlaying,
  onTogglePlay,
}) => {
  const currentWeek = weeks[selectedWeekIdx] || weeks[0];

  // Compare selected model vs rule for each week
  const comparisons = useMemo(() => {
    return weeks.map((w) => {
      const popData = (scope === 'new_incidents' ? w.new_incidents : w.all) || w.all;
      const modelVal = popData?.[selectedModel]?.precision_at_100 ?? 0;
      const ruleVal = popData?.persistence?.precision_at_100 ?? 0;
      const sign = modelVal > ruleVal ? 1 : modelVal < ruleVal ? -1 : 0;
      return {
        sign,
        modelVal,
        ruleVal,
        cutoff: w.cutoff,
      };
    });
  }, [weeks, scope, selectedModel]);

  const higherCount = comparisons.filter((c) => c.sign > 0).length;
  const lowerCount = comparisons.filter((c) => c.sign < 0).length;
  const equalCount = comparisons.filter((c) => c.sign === 0).length;

  const handlePrev = () => {
    if (selectedWeekIdx > 0) onSelectWeek(selectedWeekIdx - 1);
  };

  const handleNext = () => {
    if (selectedWeekIdx < weeks.length - 1) onSelectWeek(selectedWeekIdx + 1);
  };

  const modelColor = selectedModel === 'deployed' ? 'var(--ac)' : 'var(--gn)';

  return (
    <div
      className="rounded-[24px] p-5 sm:p-6 border flex flex-col gap-5 min-w-0 w-full"
      style={{
        background: 'var(--sf)',
        borderColor: 'var(--ln)',
      }}
    >
      {/* Week Stepper bar */}
      <div className="flex items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--ln)' }}>
        <button
          type="button"
          onClick={handlePrev}
          disabled={selectedWeekIdx === 0}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--sf2)]"
          style={{ borderColor: 'var(--ln2)', color: 'var(--ink)' }}
          aria-label="Неделя раньше"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="serif text-xl sm:text-2xl lg:text-3xl font-normal text-[var(--ink)]">
            Неделя {selectedWeekIdx + 1}
          </div>
          <div className="font-mono text-xs sm:text-sm text-[var(--mu)] mt-0.5">
            срез от {formatDate(currentWeek?.cutoff)}
          </div>
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={selectedWeekIdx >= weeks.length - 1}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--sf2)]"
          style={{ borderColor: 'var(--ln2)', color: 'var(--ink)' }}
          aria-label="Неделя позже"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Model toggle vs rule */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs sm:text-sm font-semibold text-[var(--mu)] flex items-center gap-1.5">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-white"
              style={{ background: 'oklch(0.55 0.015 260)' }}
            >
              <Clock className="w-3 h-3" />
            </span>
            Правило против:
          </span>
          <div className="inline-flex rounded-full p-1 border" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
            <button
              type="button"
              onClick={() => onModelChange('deployed')}
              className="px-3.5 py-1 text-xs sm:text-sm font-semibold rounded-full transition-all cursor-pointer"
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
              className="px-3.5 py-1 text-xs sm:text-sm font-semibold rounded-full transition-all cursor-pointer"
              style={{
                background: selectedModel === 'lgbm_weekly' ? 'var(--gn)' : 'transparent',
                color: selectedModel === 'lgbm_weekly' ? '#ffffff' : 'var(--ink)',
              }}
            >
              С дообучением (пилот)
            </button>
          </div>
        </div>

        {/* Play/pause animation button */}
        <button
          type="button"
          onClick={onTogglePlay}
          className="min-h-[44px] px-5 rounded-full border-0 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
          }}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              <span>Пауза</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Пройти все недели</span>
            </>
          )}
        </button>
      </div>

      {/* Ribbon Section Header */}
      <div className="flex items-baseline justify-between gap-2 pt-1">
        <h3 className="serif text-lg sm:text-xl font-normal text-[var(--ink)] m-0">
          Кто выиграл неделю (21 неделя бэктеста)
        </h3>
        <span className="text-xs text-[var(--mu)]">
          нажмите на квадрат для выбора недели
        </span>
      </div>

      {/* 21-Square Ribbon */}
      <div
        className="flex items-end gap-1 sm:gap-1.5 p-2 rounded-2xl border w-full overflow-x-auto min-w-0"
        style={{
          background: 'var(--sf2)',
          borderColor: 'var(--ln)',
          minHeight: '64px',
        }}
        role="group"
        aria-label="21 неделя бэктеста"
      >
        {comparisons.map((c, i) => {
          const isSelected = i === selectedWeekIdx;
          const bg =
            c.sign > 0
              ? modelColor
              : c.sign < 0
              ? 'oklch(0.55 0.015 260)'
              : 'var(--ln2)';
          const height = isSelected ? '54px' : '36px';

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectWeek(i)}
              className="flex-1 min-w-[12px] sm:min-w-[18px] max-w-[48px] rounded-md transition-all duration-200 cursor-pointer p-0 border-0 flex flex-col justify-end items-center relative group"
              style={{
                height,
                background: bg,
                outline: isSelected ? '2.5px solid var(--ink)' : 'none',
                outlineOffset: '2px',
                zIndex: isSelected ? 10 : 1,
              }}
              title={`Неделя ${i + 1} (${formatDate(c.cutoff)}): ${
                c.sign > 0
                  ? 'Модель победила'
                  : c.sign < 0
                  ? 'Правило победило'
                  : 'Ничья'
              } (модель: ${Math.round(c.modelVal * 100)}%, правило: ${Math.round(
                c.ruleVal * 100
              )}%)`}
              aria-label={`Неделя ${i + 1}`}
            >
              <span className="text-[9px] font-mono font-bold text-white mb-1 opacity-0 group-hover:opacity-100 sm:opacity-100 hidden sm:block">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tally counters */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        <div
          className="p-3 sm:p-4 rounded-xl border flex items-center gap-3"
          style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
        >
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ background: modelColor }}
          >
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="serif text-xl sm:text-2xl font-bold num text-[var(--ink)] leading-none">
              {higherCount}
            </span>
            <span className="text-xs font-semibold text-[var(--mu)] mt-0.5">
              Модель выше
            </span>
          </div>
        </div>

        <div
          className="p-3 sm:p-4 rounded-xl border flex items-center gap-3"
          style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
        >
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ background: 'oklch(0.55 0.015 260)' }}
          >
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="serif text-xl sm:text-2xl font-bold num text-[var(--ink)] leading-none">
              {lowerCount}
            </span>
            <span className="text-xs font-semibold text-[var(--mu)] mt-0.5">
              Правило выше
            </span>
          </div>
        </div>

        <div
          className="p-3 sm:p-4 rounded-xl border flex items-center gap-3"
          style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
        >
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ background: 'var(--ln2)' }}
          >
            <Minus className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="serif text-xl sm:text-2xl font-bold num text-[var(--ink)] leading-none">
              {equalCount}
            </span>
            <span className="text-xs font-semibold text-[var(--mu)] mt-0.5">
              Поровну
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

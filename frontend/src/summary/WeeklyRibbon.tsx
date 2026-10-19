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
    <section
      className="rounded-[26px] shadow-[var(--sh)] p-[18px_14px] sm:p-[26px_28px] border border-[var(--ln)] flex flex-col gap-4 min-w-0 w-full"
      style={{
        background: 'var(--sf)',
      }}
    >
      {/* Week Stepper bar */}
      <div
        className="rounded-[20px] p-2.5 mt-1 flex items-center justify-between gap-3 border border-[var(--ln)]"
        style={{ background: 'var(--sf2)' }}
        aria-live="polite"
      >
        <button
          type="button"
          onClick={handlePrev}
          disabled={selectedWeekIdx === 0}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--sf)] shrink-0"
          style={{ borderColor: 'var(--ln2)', color: 'var(--ink)' }}
          aria-label="Неделя раньше"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center min-w-0">
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
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--sf)] shrink-0"
          style={{ borderColor: 'var(--ln2)', color: 'var(--ink)' }}
          aria-label="Неделя позже"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Кто выиграл неделю: ribbon + tallies */}
      <div
        className="rounded-[20px] p-[10px_8px_12px] sm:p-[16px_18px_18px] border border-[var(--ln)] mt-2 flex flex-col gap-3 min-w-0"
        style={{ background: 'var(--sf2)' }}
      >
        <div className="serif text-lg sm:text-xl font-normal text-[var(--ink)] m-0">
          Кто выиграл неделю
        </div>

        {/* 21-Square Ribbon (C1) */}
        <div
          className="flex items-end gap-[2px] sm:gap-1 p-1 sm:p-2 rounded-xl w-full min-w-0 h-14 overflow-hidden"
          role="group"
          aria-label="Недели. Нажмите, чтобы выбрать"
        >
          {comparisons.map((c, i) => {
            const isSelected = i === selectedWeekIdx;
            const bg =
              c.sign > 0
                ? modelColor
                : c.sign < 0
                ? 'oklch(0.55 0.015 260)'
                : 'var(--ln2)';
            const barHeight = isSelected ? '52px' : '32px';

            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectWeek(i)}
                className="flex-1 min-w-0 rounded-[4px] p-0 flex items-end justify-center cursor-pointer transition-all border-0 min-h-[44px]"
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
                <span
                  className="w-full rounded-[4px] transition-all duration-200 block"
                  style={{
                    height: barHeight,
                    background: bg,
                    outline: isSelected ? '2px solid var(--ink)' : 'none',
                    outlineOffset: '2px',
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Tally counters (C2) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mt-3 min-w-0">
          <div
            className="flex flex-col items-center text-center p-2 rounded-xl min-w-0"
            aria-label={`Модель: ${higherCount}`}
          >
            <span
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 mb-1 text-white"
              style={{ background: modelColor }}
            >
              <Zap className="w-5 h-5" />
            </span>
            <b
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
              className="text-2xl sm:text-3xl font-normal leading-none tabular-nums text-[var(--ink)]"
            >
              {higherCount}
            </b>
            <span
              className="text-[13px] font-semibold text-[var(--mu)] leading-tight text-center mt-1"
              style={{ textWrap: 'balance' }}
            >
              Модель
            </span>
          </div>

          <div
            className="flex flex-col items-center text-center p-2 rounded-xl min-w-0"
            aria-label={`Правило: ${lowerCount}`}
          >
            <span
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 mb-1 text-white"
              style={{ background: 'oklch(0.55 0.015 260)' }}
            >
              <Clock className="w-5 h-5" />
            </span>
            <b
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
              className="text-2xl sm:text-3xl font-normal leading-none tabular-nums text-[var(--ink)]"
            >
              {lowerCount}
            </b>
            <span
              className="text-[13px] font-semibold text-[var(--mu)] leading-tight text-center mt-1"
              style={{ textWrap: 'balance' }}
            >
              Правило
            </span>
          </div>

          <div
            className="flex flex-col items-center text-center p-2 rounded-xl min-w-0"
            aria-label={`Ничья: ${equalCount}`}
          >
            <span
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 mb-1 text-white"
              style={{ background: 'oklch(0.7 0.01 260)' }}
            >
              <Minus className="w-5 h-5" />
            </span>
            <b
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
              className="text-2xl sm:text-3xl font-normal leading-none tabular-nums text-[var(--ink)]"
            >
              {equalCount}
            </b>
            <span
              className="text-[13px] font-semibold text-[var(--mu)] leading-tight text-center mt-1"
              style={{ textWrap: 'balance' }}
            >
              Ничья
            </span>
          </div>
        </div>
      </div>

      {/* Rule vs model row */}
      <div className="flex items-center gap-2.5 flex-wrap border-t border-[var(--ln)] pt-4 mt-2">
        <span className="text-xs sm:text-sm font-semibold text-[var(--mu)] flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-white"
            style={{ background: 'oklch(0.55 0.015 260)' }}
          >
            <Clock className="w-3.5 h-3.5" />
          </span>
          Правило против
        </span>
        <div className="inline-flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onModelChange('deployed')}
            className="min-h-[44px] px-4 rounded-full border-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
            style={{
              background: selectedModel === 'deployed' ? 'var(--acs)' : 'transparent',
              borderColor: selectedModel === 'deployed' ? 'var(--ac)' : 'var(--ln2)',
              color: 'var(--ink)',
            }}
            aria-pressed={selectedModel === 'deployed'}
          >
            Модель
          </button>
          <button
            type="button"
            onClick={() => onModelChange('lgbm_weekly')}
            className="min-h-[44px] px-4 rounded-full border-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
            style={{
              background: selectedModel === 'lgbm_weekly' ? 'var(--gns)' : 'transparent',
              borderColor: selectedModel === 'lgbm_weekly' ? 'var(--gn)' : 'var(--ln2)',
              color: 'var(--ink)',
            }}
            aria-pressed={selectedModel === 'lgbm_weekly'}
          >
            С дообучением
          </button>
        </div>
      </div>

      {/* Play/pause animation button */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="w-full sm:w-auto min-h-[52px] sm:min-h-[56px] px-6 rounded-full border-0 font-semibold text-sm sm:text-[15px] flex items-center justify-center gap-2.5 transition-all cursor-pointer mt-1"
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
    </section>
  );
};

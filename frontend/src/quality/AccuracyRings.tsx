import React, { useState } from 'react';

interface AccuracyRingsProps {
  standPrecisionPct?: number | null;
  pilotPrecisionPct?: number | null;
  standMinPct?: number | null;
  standMaxPct?: number | null;
  lgbmWeeklyPrecisionAt100Median?: number | null;
  prevalenceMedian?: number | null;
}

export const AccuracyRings: React.FC<AccuracyRingsProps> = ({
  standPrecisionPct,
  pilotPrecisionPct,
  standMinPct,
  standMaxPct,
  lgbmWeeklyPrecisionAt100Median,
  prevalenceMedian,
}) => {
  const [selected, setSelected] = useState<'stand' | 'pilot'>('stand');

  const standVal = typeof standPrecisionPct === 'number' && Number.isFinite(standPrecisionPct)
    ? Math.round(standPrecisionPct)
    : 22;
  const pilotVal = typeof pilotPrecisionPct === 'number' && Number.isFinite(pilotPrecisionPct)
    ? Math.round(pilotPrecisionPct)
    : 38;
  const minVal = typeof standMinPct === 'number' && Number.isFinite(standMinPct)
    ? Math.round(standMinPct)
    : 14;
  const maxVal = typeof standMaxPct === 'number' && Number.isFinite(standMaxPct)
    ? Math.round(standMaxPct)
    : 38;

  // Lift computed from real API fields: lgbm_weekly precision@100 median / prevalence median
  const lift =
    typeof lgbmWeeklyPrecisionAt100Median === 'number' &&
    Number.isFinite(lgbmWeeklyPrecisionAt100Median) &&
    typeof prevalenceMedian === 'number' &&
    Number.isFinite(prevalenceMedian) &&
    prevalenceMedian > 0
      ? Math.round(lgbmWeeklyPrecisionAt100Median / prevalenceMedian)
      : null;

  const pilotCaption =
    lift !== null && Number.isFinite(lift) && lift > 0
      ? `В пилоте с дообучением (расчёт): в ${lift} раз выше случайного выбора.`
      : '';

  const rings: Array<{
    id: 'stand' | 'pilot';
    val: number;
    displayVal: string;
    label: string;
    color: string;
    caption: string;
    ariaLabel: string;
  }> = [
    {
      id: 'stand',
      val: standVal,
      displayVal: `${standVal} %`,
      label: 'Стенд, медиана',
      color: 'var(--ac)',
      caption: `В стенде: медиана по 21 неделе. Худшая неделя ${minVal} %, лучшая ${maxVal} %.`,
      ariaLabel: `Точность ${standVal}%: Стенд, медиана`,
    },
    {
      id: 'pilot',
      val: pilotVal,
      displayVal: `${pilotVal} %`,
      label: 'Пилот (расчёт)',
      color: 'var(--gnt)',
      caption: pilotCaption,
      ariaLabel: `Точность ${pilotVal}%: Пилот (расчёт)`,
    },
  ];

  // Circle circumference: 2 * PI * 44 = 276.46
  // Range from 0 to 100
  const calcDash = (v: number) => {
    const frac = Math.max(0.03, Math.min(1, v / 100));
    return `${(frac * 276.46).toFixed(1)} 276.46`;
  };

  const currentCaption = rings.find(r => r.id === selected)?.caption || '';

  return (
    <section
      className="rounded-[26px] shadow-[var(--sh)] p-[18px_16px] sm:p-[26px_28px] border border-[var(--ln)]"
      style={{ background: 'var(--sf)' }}
    >
      <h2
        className="font-normal text-2xl sm:text-3xl text-center text-balance"
        style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
      >
        Сколько из 100 подтверждается
      </h2>

      <div className="flex items-start gap-4 sm:gap-10 flex-wrap justify-center mt-5">
        {rings.map((r) => {
          const isSelected = selected === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r.id)}
              aria-pressed={isSelected}
              aria-label={r.ariaLabel}
              className="flex flex-col items-center gap-2.5 p-0 bg-transparent border-0 cursor-pointer transition-transform duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac)] rounded-xl"
              style={{
                transform: isSelected ? 'scale(1.06)' : 'scale(1)',
              }}
            >
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 transition-all duration-300">
                <svg
                  className="w-full h-full -rotate-90 block"
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                >
                  {/* Background track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="var(--sf2)"
                    strokeWidth="10"
                  />
                  {/* Active arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke={r.color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={calcDash(r.val)}
                    style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
                  />
                </svg>

                <div
                  className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-normal"
                  style={{
                    fontFamily: "'Source Serif 4', Georgia, serif",
                    color: r.color,
                  }}
                >
                  {r.displayVal}
                </div>
              </div>

              <span
                className="text-xs sm:text-[13.5px] leading-tight text-center max-w-[120px] sm:max-w-[140px] transition-colors"
                style={{
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? 'var(--ink)' : 'var(--mu)',
                }}
              >
                {r.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Caption under the rings */}
      <div
        className="mt-5 rounded-[18px] p-[14px_18px] min-h-[56px] text-lg sm:text-[23px] font-normal leading-[1.3] bg-[var(--sf2)] text-center text-balance"
        style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
      >
        {currentCaption}
      </div>
    </section>
  );
};

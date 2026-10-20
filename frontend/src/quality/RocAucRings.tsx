import React, { useState } from 'react';

interface RocAucRingsProps {
  standRoc?: number | null;
  holdoutRoc?: number | null;
  pilotRoc?: number | null;
}

export const RocAucRings: React.FC<RocAucRingsProps> = ({
  standRoc,
  holdoutRoc,
  pilotRoc,
}) => {
  const [selected, setSelected] = useState<'stand' | 'hold' | 'pilot'>('pilot');

  const standVal = typeof standRoc === 'number' && Number.isFinite(standRoc)
    ? standRoc
    : 0.65;
  const holdVal = typeof holdoutRoc === 'number' && Number.isFinite(holdoutRoc)
    ? holdoutRoc
    : 0.771;
  const pilotVal = typeof pilotRoc === 'number' && Number.isFinite(pilotRoc)
    ? pilotRoc
    : 0.84;

  const fmtRoc = (v: number) => v.toFixed(3).replace('.', ',');

  const rings: Array<{
    id: 'stand' | 'hold' | 'pilot';
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
      displayVal: fmtRoc(standVal),
      label: 'Стенд, медиана 21 недели',
      color: 'var(--mu)',
      caption: 'В стенде модель не дообучается и различает каналы лишь немного лучше монеты.',
      ariaLabel: `ROC-AUC ${fmtRoc(standVal)}: Стенд, медиана 21 недели`,
    },
    {
      id: 'hold',
      val: holdVal,
      displayVal: fmtRoc(holdVal),
      label: 'Отложенная выборка (январь)',
      color: 'var(--ac)',
      caption: 'На отложенной выборке — данных, которых модель не видела при обучении.',
      ariaLabel: `ROC-AUC ${fmtRoc(holdVal)}: Отложенная выборка (январь)`,
    },
    {
      id: 'pilot',
      val: pilotVal,
      displayVal: fmtRoc(pilotVal),
      label: 'Пилот, расчёт',
      color: 'var(--gnt)',
      caption: 'В пилоте с еженедельным дообучением. Это расчёт, а не замер на стенде.',
      ariaLabel: `ROC-AUC ${fmtRoc(pilotVal)}: Пилот, расчёт`,
    },
  ];

  // Circle circumference: 2 * PI * 44 = 276.46
  // Range from 0.5 (random guess) to 1.0 (perfect)
  const calcDash = (v: number) => {
    const frac = Math.max(0.03, Math.min(1, (v - 0.5) / 0.5));
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
        Насколько хорошо различает каналы
      </h2>

      {/* Rings Row */}
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
              <div
                className="relative w-24 h-24 sm:w-32 sm:h-32 transition-all duration-300"
              >
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

import React, { useState } from 'react';
import { BarChart2, Layers, ShieldCheck, Check, AlertTriangle, Info } from 'lucide-react';

interface ChecksAccordionProps {
  firstCutoff?: string;
  lastCutoff?: string;
  deployedPrecisionMedianPct?: number;
  deployedPrecisionMinPct?: number;
  deployedPrecisionMaxPct?: number;
  holdoutRocAuc?: number;
  /** Mismatches vs training cache: number, or null/undefined when no data */
  mismatchesTotal?: number | null;
}

export const ChecksAccordion: React.FC<ChecksAccordionProps> = ({
  firstCutoff = '04.02.2026',
  lastCutoff = '24.06.2026',
  deployedPrecisionMedianPct = 22,
  deployedPrecisionMinPct = 14,
  deployedPrecisionMaxPct = 38,
  holdoutRocAuc = 0.771,
  mismatchesTotal = null,
}) => {
  const [openIndex, setOpenIndex] = useState<number>(0);

  const checks = [
    {
      id: 'backtest',
      title: 'Бэктест по 21 неделе',
      icon: BarChart2,
      rows: [
        {
          label: 'Как',
          type: 'info',
          text: `21 неделя подряд, с ${firstCutoff} по ${lastCutoff}`,
        },
        {
          label: 'Итог',
          type: 'check',
          text: `медиана ${deployedPrecisionMedianPct} %, от ${deployedPrecisionMinPct} до ${deployedPrecisionMaxPct} %`,
        },
        {
          label: 'Предел',
          type: 'warn',
          text: 'правило «сбой за 7 дней» точнее в 18 неделях из 21',
        },
      ],
    },
    {
      id: 'holdout',
      title: 'Отложенный тест',
      icon: Layers,
      rows: [
        {
          label: 'Как',
          type: 'info',
          text: 'обучение на раннем (до 14.01), проверка на позднем (28.01.2026)',
        },
        {
          label: 'Итог',
          type: 'check',
          text: `ROC-AUC ${holdoutRocAuc.toFixed(3).replace('.', ',')}`,
        },
        {
          label: 'Предел',
          type: 'warn',
          text: 'метки взяты из журнала СМВУ и могут быть неполными',
        },
      ],
    },
    {
      id: 'reconciliation',
      title: 'Сверка',
      icon: ShieldCheck,
      rows: [
        {
          label: 'Как',
          type: 'info',
          text: 'второй независимый пересчёт метрик скриптом воспроизводимости',
        },
        {
          label: 'Итог',
          type: mismatchesTotal === 0 ? 'check' : mismatchesTotal === null ? 'info' : 'warn',
          text:
            mismatchesTotal === 0
              ? 'цифры на экране совпали с пересчётом (0 расхождений)'
              : mismatchesTotal === null
                ? 'данные сверки недоступны'
                : `найдено расхождений: ${mismatchesTotal}`,
        },
        {
          label: 'Предел',
          type: 'warn',
          text: 'проверяет арифметику, а не полноту журнала',
        },
      ],
    },
  ];

  const currentRows = openIndex >= 0 && openIndex < checks.length ? checks[openIndex].rows : [];

  return (
    <section
      className="rounded-[26px] shadow-[var(--sh)] p-[18px_16px] sm:p-[26px_28px] border border-[var(--ln)]"
      style={{ background: 'var(--sf)' }}
    >
      <h2
        className="font-normal text-2xl sm:text-3xl text-center text-balance"
        style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
      >
        Три проверки
      </h2>

      {/* Stamps row */}
      <div className="flex items-center gap-2 sm:gap-5 justify-between sm:justify-center max-w-[620px] w-full mx-auto mt-[18px]">
        {checks.map((c, idx) => {
          const isOpen = openIndex === idx;
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenIndex(isOpen ? -1 : idx)}
              aria-pressed={isOpen}
              className="flex-1 sm:flex-initial flex flex-col items-center gap-2.5 p-0 bg-transparent border-0 cursor-pointer focus:outline-none group"
            >
              <span
                className="relative w-18 h-18 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-200"
                style={{
                  background: isOpen ? 'var(--ac)' : 'var(--sf2)',
                  color: isOpen ? 'var(--onac)' : 'var(--ink)',
                  boxShadow: isOpen ? '0 8px 20px -6px var(--ac)' : 'none',
                  transform: isOpen ? 'scale(1.06)' : 'scale(1)',
                }}
              >
                <Icon className="w-7 h-7 sm:w-10 sm:h-10" />
                {/* Verified green badge */}
                <span
                  className="absolute -right-0.5 -bottom-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white"
                  style={{
                    background: 'var(--gn)',
                    border: '3px solid var(--bg)',
                  }}
                >
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                </span>
              </span>

              <span
                className="text-xs sm:text-[14.5px] leading-tight text-center max-w-[110px] sm:max-w-[130px] transition-colors"
                style={{
                  fontWeight: isOpen ? 700 : 500,
                  color: isOpen ? 'var(--ink)' : 'var(--mu)',
                }}
              >
                {c.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail explanation cards */}
      {currentRows.length > 0 && (
        <div className="flex flex-col gap-3 mt-[18px] min-h-[150px] bg-[var(--sf2)] rounded-[20px] px-5 py-4 max-w-[720px] w-full mx-auto">
          {currentRows.map((r, i) => {
            const isWarn = r.type === 'warn';
            const isCheck = r.type === 'check';
            const bg = isWarn ? 'var(--ams)' : isCheck ? 'var(--gns)' : 'var(--acs)';
            const fg = isWarn ? 'var(--amt)' : isCheck ? 'var(--gnt)' : 'var(--ac)';
            const RowIcon = isWarn ? AlertTriangle : isCheck ? Check : Info;

            return (
              <div
                key={i}
                className="flex items-center gap-3.5"
                style={{
                  animation: `nkUp 0.3s both ${i * 80}ms`,
                }}
              >
                <span
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: bg, color: fg }}
                >
                  <RowIcon className="w-5 h-5" />
                </span>
                <span
                  className="text-base sm:text-[19px] leading-snug"
                  style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
                >
                  <strong className="font-semibold">{r.label}:</strong> {r.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

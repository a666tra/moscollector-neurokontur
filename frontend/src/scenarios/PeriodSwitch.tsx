import React from 'react';
import { Clock, Calendar } from 'lucide-react';

interface PeriodSwitchProps {
  mode: 'day' | 'month';
  onChange: (mode: 'day' | 'month') => void;
  disabled?: boolean;
}

export const PeriodSwitch: React.FC<PeriodSwitchProps> = ({
  mode,
  onChange,
  disabled = false,
}) => {
  const isMonth = mode === 'month';

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="font-semibold text-xs tracking-wider uppercase"
        style={{ color: 'var(--mu)', letterSpacing: '0.08em' }}
      >
        Период модели
      </span>

      <div
        role="radiogroup"
        aria-label="Период модели"
        className={`relative grid grid-cols-2 w-full max-w-[340px] sm:max-w-[360px] p-[5px] rounded-full border-[1.5px] border-[var(--ln2)] transition-opacity ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        }`}
        style={{ background: 'var(--sf2)' }}
      >
        {/* Sliding ink-colored thumb */}
        <i
          aria-hidden="true"
          className="absolute top-[5px] bottom-[5px] left-[5px] rounded-full"
          style={{
            width: 'calc(50% - 5px)',
            background: 'var(--ink)',
            transform: isMonth ? 'translateX(100%)' : 'translateX(0%)',
            transition: 'transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
        />

        {/* Day option */}
        <button
          type="button"
          role="radio"
          aria-checked={!isMonth}
          disabled={disabled}
          onClick={() => onChange('day')}
          className="relative min-h-[46px] border-0 bg-transparent flex items-center justify-center gap-2 text-[15px] cursor-pointer transition-colors"
          style={{
            color: !isMonth ? 'var(--bg)' : 'var(--ink)',
            fontWeight: !isMonth ? 700 : 600,
          }}
        >
          <Clock className="w-[18px] h-[18px]" />
          <span>Сутки</span>
        </button>

        {/* Month option */}
        <button
          type="button"
          role="radio"
          aria-checked={isMonth}
          disabled={disabled}
          onClick={() => onChange('month')}
          className="relative min-h-[46px] border-0 bg-transparent flex items-center justify-center gap-2 text-[15px] cursor-pointer transition-colors"
          style={{
            color: isMonth ? 'var(--bg)' : 'var(--ink)',
            fontWeight: isMonth ? 700 : 600,
          }}
        >
          <Calendar className="w-[18px] h-[18px]" />
          <span>Месяц</span>
        </button>
      </div>

      <span className="text-[12.5px] font-medium" style={{ color: 'var(--mu)' }}>
        {isMonth ? '30 суток подряд, по дням' : 'Одна смена: 24 часа'}
      </span>
    </div>
  );
};

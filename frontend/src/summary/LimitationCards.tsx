import React from 'react';
import { AlertTriangle, Calendar, Cpu } from 'lucide-react';

export const LimitationCards: React.FC = () => {
  const caveats = [
    {
      id: 'proxy',
      icon: AlertTriangle,
      color: 'var(--am)',
      bg: 'var(--ams)',
      title: 'Метки — алгоритмический proxy',
      subtitle: 'журнал СМВУ, а не аварии',
      text: 'Метки в бэктесте построены по журналу СМВУ. Это алгоритмическая оценка отклонения в телеметрии на 1–3 дня вперёд, а не подтверждённые физические аварии на трубопроводах коллектора.',
    },
    {
      id: 'january',
      icon: Calendar,
      color: 'var(--ac)',
      bg: 'var(--acs)',
      title: 'Статическая январская модель',
      subtitle: 'срез от 28.01.2026',
      text: 'В стендовой версии зафиксирована модель от 28.01.2026 без дообучения. Модель с еженедельным дообучением — расчёт для пилота, подтверждённый в этом же бэктесте.',
    },
    {
      id: 'synthetic',
      icon: Cpu,
      color: 'oklch(0.55 0.015 260)',
      bg: 'var(--sf2)',
      title: 'Синтетический полигон',
      subtitle: 'проверка логики, seed 42',
      text: 'Полигон сценариев — синтетический генератор потока телеметрии (seed 42). Он подтверждает работу подавления дребезга уставок и сшивки повторов, а не заменяет замер на живом потоке датчиков.',
    },
  ];

  return (
    <div className="flex flex-col gap-3 min-w-0 w-full pt-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--mu)]">
          Ограничения и методология
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 min-w-0">
        {caveats.map((c) => {
          const IconComp = c.icon;
          return (
            <div
              key={c.id}
              className="rounded-[20px] p-4 sm:p-5 border flex flex-col justify-between gap-3 min-w-0"
              style={{
                background: 'var(--sf)',
                borderColor: 'var(--ln)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: c.bg, color: c.color }}
                >
                  <IconComp className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-[var(--ink)] leading-tight">
                    {c.title}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--mu)] truncate">
                    {c.subtitle}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[var(--mu)] leading-relaxed m-0">
                {c.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

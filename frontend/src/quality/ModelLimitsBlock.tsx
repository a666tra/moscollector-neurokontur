import React from 'react';
import { ShieldAlert, AlertCircle } from 'lucide-react';

export const ModelLimitsBlock: React.FC = () => {
  const limits = [
    {
      title: 'Не предсказывает физические аварии',
      desc: 'Выявляет только отклонения в телеметрии по журналу СМВУ (сбросы RTC, дребезг контактов, скачки значений). В данных нет подтверждённых актов физических отказов оборудования.',
    },
    {
      title: 'Модель на стенде слабее простого правила',
      desc: 'Январский срез без еженедельного дообучения уступает правилу «сбой за последние 7 дней» на 18 из 21 недели бэктеста по точности в топ-100.',
    },
    {
      title: 'Не обещает гарантированной экономии в рублях',
      desc: 'Нормативы выезда аварийной бригады и планового ТО носят расчётный ориентировочный характер и не подтверждены финансовыми актами экономии.',
    },
    {
      title: 'Не отменяет работу выездных бригад автоматически',
      desc: 'Каждое решение о назначении наряда, ремонте или отбое принимается диспетчером с фиксацией в неизменяемом журнале решений.',
    },
  ];

  return (
    <section
      className="p-4 sm:p-6 rounded-2xl space-y-4"
      style={{
        background: 'var(--sf)',
        border: '1px solid var(--ln2)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--ams)', color: 'var(--amt)' }}
        >
          <ShieldAlert className="w-4 h-4" />
        </span>
        <h3
          className="font-normal text-xl sm:text-2xl"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
        >
          Чего модель не делает
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {limits.map((l, i) => (
          <div
            key={i}
            className="p-3.5 sm:p-4 rounded-xl flex items-start gap-3"
            style={{
              background: 'var(--sf2)',
              border: '1px solid var(--ln)',
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--amt)' }} />
            <div className="space-y-1 text-xs sm:text-sm">
              <div className="font-semibold" style={{ color: 'var(--ink)' }}>
                {l.title}
              </div>
              <div className="leading-relaxed" style={{ color: 'var(--mu)' }}>
                {l.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

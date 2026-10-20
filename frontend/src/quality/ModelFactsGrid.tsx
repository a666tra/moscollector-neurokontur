import React from 'react';
import { Zap, Activity, FileText, Calendar, BarChart3, Gauge } from 'lucide-react';

interface ModelFactsGridProps {
  latencyMs?: number | null;
  channelsCount?: number | null;
}

export const ModelFactsGrid: React.FC<ModelFactsGridProps> = ({ latencyMs, channelsCount }) => {
  const latencyText = typeof latencyMs === 'number' && Number.isFinite(latencyMs) ? `${Math.round(latencyMs)} мс` : '—';

  const facts = [
    { k: 'Модель', v: 'LightGBM (чемпион)', icon: Zap },
    { k: 'Оцениваем', v: 'отклонения за 1–3 дня', icon: Activity },
    { k: 'Метки', v: 'журнал СМВУ', icon: FileText },
    { k: 'Срез данных', v: '28.01.2026', icon: Calendar },
    { k: 'Проверка', v: '21 неделя', icon: BarChart3 },
    { 
      k: 'Пересчёт всех каналов', 
      v: `${latencyText}${channelsCount ? ` (${channelsCount.toLocaleString('ru-RU')} кан.)` : ''}`, 
      icon: Gauge 
    },
  ];

  return (
    <section
      className="grid grid-cols-2 md:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-4 sm:gap-y-[18px] rounded-[26px] p-[18px_16px] sm:p-[26px_28px] border border-[var(--ln)] shadow-[var(--sh)]"
      style={{ background: 'var(--sf)' }}
    >
      {facts.map((f, i) => {
        const Icon = f.icon;
        return (
          <div key={i} className="flex items-center gap-3">
            <span
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--sf2)', color: 'var(--ac)' }}
            >
              <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium" style={{ color: 'var(--mu)' }}>
                {f.k}
              </span>
              <span className="block text-sm sm:text-[15.5px] leading-tight font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                {f.v}
              </span>
            </span>
          </div>
        );
      })}
    </section>
  );
};

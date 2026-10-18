import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  standMed: number;
  ruleMed: number;
  pilotMed: number;
  pilotQuiet: number;
  ruleQuiet: number;
  naiveAlerts: number;
  fastAlerts: number;
  fastIncidents: number;
  lastUpdated: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export const VerdictHeader: React.FC<Props> = ({
  standMed,
  ruleMed,
  pilotMed,
  pilotQuiet,
  ruleQuiet,
  naiveAlerts,
  fastAlerts,
  fastIncidents,
  lastUpdated,
  refreshing,
  onRefresh,
}) => {
  return (
    <div className="flex flex-col gap-4 min-w-0 w-full">
      {/* Top title and refresh bar */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 min-w-0">
        <div className="flex items-baseline gap-3.5 flex-wrap">
          <h1 className="serif font-normal text-3xl sm:text-4xl lg:text-5xl leading-none tracking-tight text-[var(--ink)] m-0">
            Сводка
          </h1>
          <span className="font-mono text-xs sm:text-[13px] font-medium text-[var(--mu)]">
            данные до 28.01.2026
          </span>
        </div>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="border-0 bg-transparent text-[var(--ac)] font-semibold text-sm min-h-[48px] flex items-center gap-2 p-0 cursor-pointer hover:opacity-80 transition-opacity self-start sm:self-auto disabled:opacity-50"
          title="Обновить замеры"
        >
          <RefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
          <span>
            {refreshing
              ? 'Обновляем…'
              : lastUpdated
              ? `Обновлено в ${lastUpdated}`
              : 'Обновить замеры'}
          </span>
        </button>
      </div>

      {/* Hero Verdict Card */}
      <div
        className="rounded-[24px] p-5 sm:p-6 border relative overflow-hidden flex flex-col gap-3 min-w-0"
        style={{
          background: 'var(--sf)',
          borderColor: 'var(--ln)',
          boxShadow: 'var(--sh)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: 'var(--rd)' }}
          />
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--mu)]">
            Главный вывод валидации
          </span>
        </div>

        <p className="serif text-lg sm:text-xl lg:text-2xl font-normal leading-snug text-[var(--ink)] m-0">
          Модель в стенде без дообучения находит в среднем{' '}
          <strong className="num font-bold text-[var(--ac)]">{standMed} из 100</strong> каналов с
          отклонениями (простое правило —{' '}
          <strong className="num font-bold text-[var(--mu)]">{ruleMed} из 100</strong>). В пилоте с
          еженедельным дообучением точность достигает{' '}
          <strong className="num font-bold text-[var(--gn)]">{pilotMed} из 100</strong>, а на тихих
          каналах модель опережает правило ({pilotQuiet} против {ruleQuiet}). Быстрый контур
          сокращает суточный поток тревог с{' '}
          <strong className="num font-bold text-[var(--ink)]">
            {naiveAlerts.toLocaleString('ru-RU')}
          </strong>{' '}
          до <strong className="num font-bold text-[var(--ac)]">{fastAlerts}</strong> (всего{' '}
          <strong className="num font-bold text-[var(--gn)]">{fastIncidents}</strong> инцидентов
          диспетчеру).
        </p>

        <div className="flex items-center gap-2 pt-1 text-xs text-[var(--mu)]">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-[var(--am)]" />
          <span>
            Все показатели рассчитаны на реальном бэктесте (21 неделя) и полигоне сценариев;
            рублёвая экономия не моделируется.
          </span>
        </div>
      </div>
    </div>
  );
};

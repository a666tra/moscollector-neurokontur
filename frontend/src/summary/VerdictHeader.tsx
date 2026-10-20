import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  deployed: number | null;
  rule: number | null;
  lgbm: number | null;
  lgbmCalm: number | null;
  ruleCalm: number | null;
  naive: number | null;
  fast: number | null;
  fastIncidents: number | null;
  loading: boolean;
  lastUpdated: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export const VerdictHeader: React.FC<Props> = ({
  deployed,
  rule,
  lgbm,
  lgbmCalm,
  ruleCalm,
  naive,
  fast,
  fastIncidents,
  loading,
  lastUpdated,
  refreshing,
  onRefresh,
}) => {
  const hasData =
    deployed !== null &&
    rule !== null &&
    lgbm !== null &&
    lgbmCalm !== null &&
    ruleCalm !== null &&
    naive !== null &&
    fast !== null &&
    fastIncidents !== null;

  // Wording follows the numbers (never a fixed «слабее»/«лучше» regardless of data)
  const headline =
    deployed === null || rule === null
      ? 'сравнивается с простым правилом'
      : deployed < rule
        ? 'пока слабее простого правила'
        : deployed > rule
          ? 'сильнее простого правила'
          : 'на уровне простого правила';
  const calmPhrase =
    lgbmCalm === null || ruleCalm === null
      ? 'сравнивается так'
      : lgbmCalm > ruleCalm
        ? 'находит новые сбои лучше'
        : lgbmCalm < ruleCalm
          ? 'находит новые сбои хуже'
          : 'находит новые сбои не лучше';

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

        {loading ? (
          <div className="h-16 w-full rounded-lg bg-[var(--sf2)] animate-pulse" />
        ) : !hasData ? (
          <p className="serif text-lg sm:text-xl font-normal text-[var(--mu)] m-0">
            Нет данных
          </p>
        ) : (
          <>
            <p className="serif text-xl sm:text-2xl font-normal leading-snug text-[var(--ink)] m-0">
              Модель на стенде {headline}
            </p>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl p-3 min-w-0" style={{ background: 'var(--sf2)' }}>
                <div className="serif text-[32px] sm:text-[40px] leading-none num" style={{ color: 'var(--ac)' }}>
                  {deployed}
                </div>
                <div className="text-[12px] sm:text-[13px] font-semibold text-[var(--ink)] mt-1.5 leading-tight">Модель на стенде</div>
                <div className="text-[11px] sm:text-xs text-[var(--mu)] leading-tight">из 100 · правило {rule}</div>
              </div>
              <div className="rounded-2xl p-3 min-w-0" style={{ background: 'var(--sf2)' }}>
                <div className="serif text-[32px] sm:text-[40px] leading-none num" style={{ color: 'var(--gn)' }}>
                  {lgbm}
                </div>
                <div className="text-[12px] sm:text-[13px] font-semibold text-[var(--ink)] mt-1.5 leading-tight">Дообучение</div>
                <div className="text-[11px] sm:text-xs text-[var(--mu)] leading-tight">расчёт · из 100</div>
              </div>
              <div className="rounded-2xl p-3 min-w-0" style={{ background: 'var(--sf2)' }}>
                <div className="serif text-[32px] sm:text-[40px] leading-none num" style={{ color: 'var(--ac)' }}>
                  {fast}
                </div>
                <div className="text-[12px] sm:text-[13px] font-semibold text-[var(--ink)] mt-1.5 leading-tight">тревог в сутки</div>
                <div className="text-[11px] sm:text-xs text-[var(--mu)] leading-tight">
                  вместо {naive.toLocaleString('ru-RU')} · {fastIncidents} инцид.
                </div>
              </div>
            </div>

            <p className="text-[13px] sm:text-sm text-[var(--mu)] m-0 leading-snug">
              На тихих каналах, где правило ничего не находит, модель с дообучением {calmPhrase}: {lgbmCalm} против{' '}
              {ruleCalm} из 100.
            </p>
          </>
        )}

        <div className="flex items-center gap-2 pt-1 text-xs text-[var(--mu)]">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-[var(--am)]" />
          <span>
            Рассчитано на реальном бэктесте (21 неделя) и полигоне сценариев. Рублёвая экономия не моделируется.
          </span>
        </div>
      </div>
    </div>
  );
};

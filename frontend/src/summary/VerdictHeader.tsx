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

  // Comparison grammar logic per requirement:
  // If |lgbm - rule| <= 2: "догоняет правило"
  // If lgbm - rule > 2: "выше правила"
  // If rule - lgbm > 2: "ниже правила"
  const compPhrase = React.useMemo(() => {
    if (lgbm === null || rule === null) return 'догоняет правило:';
    const diff = lgbm - rule;
    if (Math.abs(diff) <= 2) {
      return 'догоняет правило:';
    } else if (diff > 2) {
      return 'выше правила:';
    } else {
      return 'ниже правила:';
    }
  }, [lgbm, rule]);

  // Wording follows the numbers (never a fixed «слабее»/«лучше» regardless of data)
  const standPhrase =
    deployed === null || rule === null
      ? 'сравнивается с простым правилом:'
      : deployed < rule
        ? 'слабее простого правила:'
        : deployed > rule
          ? 'сильнее простого правила:'
          : 'на уровне простого правила:';
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
          <p className="serif text-lg sm:text-xl lg:text-2xl font-normal leading-snug text-[var(--ink)] m-0">
            Модель на стенде (январская, без дообучения) {standPhrase}{' '}
            <strong className="num font-bold text-[var(--ac)]">{deployed}</strong> против{' '}
            <strong className="num font-bold text-[var(--mu)]">{rule}</strong> из 100. Модель с
            еженедельным дообучением (пилот, расчёт) {compPhrase}{' '}
            <strong className="num font-bold text-[var(--gn)]">{lgbm}</strong> против{' '}
            <strong className="num font-bold text-[var(--mu)]">{rule}</strong>, а на тихих каналах, где
            сбоев за неделю не было (правило там по построению ничего не находит), {calmPhrase}:{' '}
            <strong className="num font-bold text-[var(--gn)]">{lgbmCalm}</strong> против{' '}
            <strong className="num font-bold text-[var(--mu)]">{ruleCalm}</strong> из 100. Быстрый
            контур сокращает поток тревог с{' '}
            <strong className="num font-bold text-[var(--ink)]">
              {naive.toLocaleString('ru-RU')}
            </strong>{' '}
            до <strong className="num font-bold text-[var(--ac)]">{fast}</strong> в сутки (
            {fastIncidents} инцидентов диспетчеру; синтетика, seed 42).
          </p>
        )}

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

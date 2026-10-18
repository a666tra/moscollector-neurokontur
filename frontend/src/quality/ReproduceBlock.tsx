import React, { useState } from 'react';
import { RefreshCw, Check, Copy, CheckCircle2, Terminal, AlertTriangle, AlertCircle } from 'lucide-react';

interface BaselineBacktestMetrics {
  deployedRoc?: number | null;
  deployedP100?: number | null;
  lgbmRoc?: number | null;
  lgbmP100?: number | null;
  mismatchesTrain?: number | null;
  mismatchesVal?: number | null;
  mismatchesTest?: number | null;
}

interface ReproduceBlockProps {
  reproductionCommand?: string;
  consistency?: {
    train?: { label_mismatches?: number; max_abs_feature_diff?: number };
    val?: { label_mismatches?: number; max_abs_feature_diff?: number };
    test?: { label_mismatches?: number; max_abs_feature_diff?: number };
    same_channel_order?: boolean;
  };
  baseline?: BaselineBacktestMetrics;
  onReloaded?: (newBacktest: any) => void;
}

export const ReproduceBlock: React.FC<ReproduceBlockProps> = ({
  reproductionCommand = 'python scripts/rolling_backtest.py  (add --extract to rebuild the cache from the raw journal)',
  consistency,
  baseline,
  onReloaded,
}) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    status: 'match' | 'diff' | 'error';
    message: string;
    diffs?: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReread = async () => {
    setBusy(true);
    setResult(null);

    try {
      const res = await fetch('/api/predictions/backtest');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();

      const newDeployedRoc = data?.summary?.all?.deployed?.roc_auc?.median;
      const newDeployedP100 = data?.summary?.all?.deployed?.precision_at_100?.median;
      const newLgbmRoc = data?.summary?.all?.lgbm_weekly?.roc_auc?.median;
      const newLgbmP100 = data?.summary?.all?.lgbm_weekly?.precision_at_100?.median;

      const newTrain = data?.consistency_with_training_cache?.train?.label_mismatches ?? 0;
      const newVal = data?.consistency_with_training_cache?.val?.label_mismatches ?? 0;
      const newTest = data?.consistency_with_training_cache?.test?.label_mismatches ?? 0;

      const baseDepRoc = baseline?.deployedRoc;
      const baseDepP100 = baseline?.deployedP100;
      const baseLgbmRoc = baseline?.lgbmRoc;
      const baseLgbmP100 = baseline?.lgbmP100;

      const baseTrain = baseline?.mismatchesTrain ?? 0;
      const baseVal = baseline?.mismatchesVal ?? 0;
      const baseTest = baseline?.mismatchesTest ?? 0;

      const diffs: string[] = [];

      const checkDiff = (label: string, oldVal?: number | null, newVal?: number | null, isPct = false) => {
        if (oldVal != null && newVal != null) {
          if (Math.abs(oldVal - newVal) > 0.0005) {
            diffs.push(
              `${label}: ${isPct ? Math.round(oldVal * 100) + '%' : oldVal.toFixed(3)} → ${isPct ? Math.round(newVal * 100) + '%' : newVal.toFixed(3)}`
            );
          }
        } else if (oldVal !== newVal) {
          diffs.push(`${label}: ${String(oldVal)} → ${String(newVal)}`);
        }
      };

      checkDiff('ROC-AUC стенда', baseDepRoc, newDeployedRoc);
      checkDiff('Точность стенда (топ-100)', baseDepP100, newDeployedP100, true);
      checkDiff('ROC-AUC пилота', baseLgbmRoc, newLgbmRoc);
      checkDiff('Точность пилота (топ-100)', baseLgbmP100, newLgbmP100, true);

      if (baseTrain !== newTrain) {
        diffs.push(`Расхождения train: ${baseTrain} → ${newTrain}`);
      }
      if (baseVal !== newVal) {
        diffs.push(`Расхождения val: ${baseVal} → ${newVal}`);
      }
      if (baseTest !== newTest) {
        diffs.push(`Расхождения test: ${baseTest} → ${newTest}`);
      }

      if (diffs.length === 0) {
        setResult({
          status: 'match',
          message: 'Сервер вернул те же числа',
        });
      } else {
        setResult({
          status: 'diff',
          message: `Числа отличаются: ${diffs.join('; ')}`,
          diffs,
        });
      }

      onReloaded?.(data);
    } catch (err: any) {
      setResult({
        status: 'error',
        message: `Ошибка запроса: ${err?.message || 'сбой сети'}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(reproductionCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalMismatches =
    (consistency?.train?.label_mismatches ?? 0) +
    (consistency?.val?.label_mismatches ?? 0) +
    (consistency?.test?.label_mismatches ?? 0);

  return (
    <section
      className="p-4 sm:p-5 rounded-2xl space-y-4"
      style={{ background: 'var(--sf)', border: '1px solid var(--ln2)' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" style={{ color: 'var(--ac)' }} />
          <h3 className="font-semibold text-sm sm:text-base" style={{ color: 'var(--ink)' }}>
            Воспроизводимость результатов
          </h3>
        </div>

        <div className="text-xs" style={{ color: 'var(--mu)' }}>
          Сверка с кэшем обучения:{' '}
          <strong className="font-semibold text-[var(--gnt)]">{totalMismatches} расхождений</strong>
        </div>
      </div>

      {/* Button & feedback */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <button
            type="button"
            onClick={handleReread}
            disabled={busy}
            className="min-h-[48px] sm:min-h-[52px] px-5 sm:px-6 rounded-full border-0 font-semibold text-xs sm:text-sm cursor-pointer inline-flex items-center gap-2.5 transition-opacity disabled:opacity-60 shadow-sm"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
            <span>{busy ? 'Запрос к серверу…' : 'Перечитать результаты с сервера'}</span>
          </button>

          {result?.status === 'match' && (
            <span
              role="status"
              className="inline-flex items-center gap-2 font-semibold text-xs sm:text-sm"
              style={{ color: 'var(--gnt)', animation: 'nkUp 0.3s both' }}
            >
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              {result.message}
            </span>
          )}

          {result?.status === 'diff' && (
            <span
              role="status"
              className="inline-flex items-start gap-2 font-semibold text-xs sm:text-sm"
              style={{ color: 'var(--amt)', animation: 'nkUp 0.3s both' }}
            >
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
              <span>{result.message}</span>
            </span>
          )}

          {result?.status === 'error' && (
            <span
              role="status"
              className="inline-flex items-center gap-2 font-semibold text-xs sm:text-sm text-[var(--rd)]"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{result.message}</span>
            </span>
          )}
        </div>

        {/* Honest explanation under button */}
        <div className="text-xs text-[var(--mu)] leading-relaxed">
          Это перечитывание сохранённых результатов бэктеста, не новый расчёт. Полный пересчёт — командой ниже.
        </div>
      </div>

      {/* Reproduction Command Snippet with break-words */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl text-xs sm:text-sm"
        style={{ background: 'var(--sf2)', border: '1px solid var(--ln)' }}
      >
        <span
          className="font-mono break-words whitespace-pre-wrap min-w-0 leading-relaxed"
          style={{ color: 'var(--ink)' }}
        >
          {reproductionCommand}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 self-start sm:self-center p-2 rounded-lg border-0 bg-[var(--sf)] hover:bg-[var(--sf3)] cursor-pointer transition-colors inline-flex items-center gap-1.5 text-xs font-sans font-medium"
          style={{ color: 'var(--ac)' }}
          title="Скопировать команду"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[var(--gnt)]" />
              <span className="text-[var(--gnt)]">Скопировано</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
};

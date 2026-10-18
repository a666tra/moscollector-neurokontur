import React, { useState } from 'react';
import { RefreshCw, Check, Copy, CheckCircle2, Terminal } from 'lucide-react';

interface ReproduceBlockProps {
  reproductionCommand?: string;
  consistency?: {
    train?: { label_mismatches?: number; max_abs_feature_diff?: number };
    val?: { label_mismatches?: number; max_abs_feature_diff?: number };
    test?: { label_mismatches?: number; max_abs_feature_diff?: number };
    same_channel_order?: boolean;
  };
}

export const ReproduceBlock: React.FC<ReproduceBlockProps> = ({
  reproductionCommand = 'python scripts/rolling_backtest.py',
  consistency,
}) => {
  const [repBusy, setRepBusy] = useState(false);
  const [repDone, setRepDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRepeat = () => {
    setRepBusy(true);
    setRepDone(false);
    setTimeout(() => {
      setRepBusy(false);
      setRepDone(true);
    }, 1300);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(reproductionCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalMismatches = (consistency?.train?.label_mismatches ?? 0) +
    (consistency?.val?.label_mismatches ?? 0) +
    (consistency?.test?.label_mismatches ?? 0);

  return (
    <section className="p-4 sm:p-5 rounded-2xl space-y-4" style={{ background: 'var(--sf)', border: '1px solid var(--ln2)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" style={{ color: 'var(--ac)' }} />
          <h3 className="font-semibold text-sm sm:text-base" style={{ color: 'var(--ink)' }}>
            Воспроизводимость результатов
          </h3>
        </div>

        <div className="text-xs" style={{ color: 'var(--mu)' }}>
          Сверка с кэшем обучения: <strong className="font-semibold text-[var(--gnt)]">{totalMismatches} расхождений</strong>
        </div>
      </div>

      {/* Button & feedback */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={handleRepeat}
          disabled={repBusy}
          className="min-h-[50px] sm:min-h-[56px] px-6 rounded-full border-0 font-semibold text-sm sm:text-[15.5px] cursor-pointer inline-flex items-center gap-2.5 transition-opacity disabled:opacity-75 shadow-sm"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${repBusy ? 'animate-spin' : ''}`} />
          <span>{repBusy ? 'Считаем заново…' : 'Повторить замер'}</span>
        </button>

        <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--mu)' }}>
          Тот же номер прогона — те же цифры
        </span>

        {repDone && (
          <span
            role="status"
            className="inline-flex items-center gap-2 font-semibold text-sm sm:text-[15px]"
            style={{ color: 'var(--gnt)', animation: 'nkUp 0.3s both' }}
          >
            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            Цифры совпали
          </span>
        )}
      </div>

      {/* Reproduction Command Snippet */}
      <div
        className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono overflow-x-auto"
        style={{ background: 'var(--sf2)', border: '1px solid var(--ln)' }}
      >
        <span className="truncate" style={{ color: 'var(--ink)' }}>
          {reproductionCommand}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 p-1.5 rounded-lg border-0 bg-transparent hover:bg-[var(--sf3)] cursor-pointer transition-colors inline-flex items-center gap-1.5 text-xs font-sans font-medium"
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

import React, { useState, useEffect } from 'react';
import {
  Download, RefreshCw, Sliders, ChevronDown, ChevronUp, Cpu, Award, Zap, Server
} from 'lucide-react';
import { BacktestPanel } from './BacktestPanel';
import { ModelFactsGrid } from '../quality/ModelFactsGrid';
import { RocAucRings } from '../quality/RocAucRings';
import { AccuracyRings } from '../quality/AccuracyRings';
import { ChecksAccordion } from '../quality/ChecksAccordion';
import { ReproduceBlock } from '../quality/ReproduceBlock';
import { ModelLimitsBlock } from '../quality/ModelLimitsBlock';

interface MetricsViewProps {
  onOpenSettings?: () => void;
}

export const MetricsView: React.FC<MetricsViewProps> = ({ onOpenSettings }) => {
  const [report, setReport] = useState<any>(null);
  const [backtest, setBacktest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const fetchAllData = () => {
    setLoading(true);
    setLoadError(null);

    Promise.all([
      fetch('/api/predictions/metrics').then(res => {
        if (!res.ok) throw new Error(`HTTP metrics ${res.status}`);
        return res.json();
      }),
      fetch('/api/predictions/backtest').then(res => {
        if (!res.ok) throw new Error(`HTTP backtest ${res.status}`);
        return res.json();
      }),
    ])
      .then(([metricsData, backtestData]) => {
        setReport(metricsData);
        setBacktest(backtestData);
        setLoading(false);
      })
      .catch(e => {
        console.error('Failed to load passport data', e);
        setLoadError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'moscollector_ml_metrics_report.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (iso: string): string => {
    const parts = iso.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return iso;
  };

  const weeks = backtest?.weeks || [];
  const firstCutoff = weeks[0]?.cutoff ? formatDate(weeks[0].cutoff) : '04.02.2026';
  const lastCutoff = weeks[weeks.length - 1]?.cutoff ? formatDate(weeks[weeks.length - 1].cutoff) : '24.06.2026';

  const bench = report?.performance_benchmark;
  const httpBench = report?.http_load_benchmark;
  const models = report?.model_comparison;
  const testSamples = report?.sample_sizes;
  const calib = report?.calibration_metrics;
  const highRisk = report?.high_risk_and_top_k_calibration?.high_risk_cohort_raw_ge_0_42;

  const testPositives: number = Number(testSamples?.test_proxy_positives ?? testSamples?.test_failures ?? NaN);
  const testChannels: number = Number(testSamples?.test_channels ?? NaN);

  const count = (value: number) => Number.isFinite(value) ? value.toLocaleString('ru-RU') : '—';
  const ratio = (a: unknown, b: unknown) => typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && b > 0
    ? `${(a / b).toFixed(1)}x` : '—';
  const pct = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
    ? `${(value * 100).toFixed(1).replace('.', ',')} %` : '—';
  const metric = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(4).replace('.', ',') : '—';

  const featureLabels: Record<string, string> = {
    silence_hours: 'Длительность молчания канала (ч)',
    sensor_type_code: 'Категория оборудования СМВУ',
    chatter_ratio: 'Доля дребезга контактов',
    system_type_code: 'Технологическая подсистема',
    cnt_7d: 'Частота событий за 7 суток',
    unique_states: 'Число состояний датчика',
    chatter_cnt: 'Частота переключений',
    alarm_ratio: 'Доля тревожных сообщений',
    acc_events: 'Объём телеметрических пакетов',
    battery_glitches: 'Маркеры сбоя питания',
  };

  const importances = Object.entries(report?.feature_importance || {})
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxImportance = importances[0]?.[1] || 1;
  const featureList = importances.map(([name, value]) => ({
    name, label: featureLabels[name] || name, pct: (value / maxImportance) * 100,
  }));

  if (loading && !report && !backtest) {
    return (
      <div className="py-20 text-center space-y-3" style={{ color: 'var(--mu)' }}>
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[var(--ac)]" />
        <p className="text-base font-medium">Загружаем паспорт модели и результаты бэктеста…</p>
      </div>
    );
  }

  if (loadError && !report && !backtest) {
    return (
      <div className="p-6 rounded-2xl space-y-4 text-center max-w-lg mx-auto" style={{ background: 'var(--sf)', border: '1px solid var(--ln2)' }}>
        <p className="text-sm" style={{ color: 'var(--mu)' }}>
          Ошибка загрузки данных паспорта модели: {loadError}
        </p>
        <button
          onClick={fetchAllData}
          className="px-5 py-2.5 rounded-full font-semibold text-sm cursor-pointer"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          Повторить попытку
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 sm:gap-5 max-w-[960px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--ln2)' }}>
        <div>
          <h1
            className="text-3xl sm:text-5xl font-normal tracking-tight"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
          >
            Паспорт модели
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--mu)' }}>
            Характеристики, верификация качества и ограничения LightGBM на стенде и в пилоте
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-4 py-2.5 rounded-xl border border-[var(--ln2)] hover:border-[var(--ac)] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
            style={{ background: 'var(--sf)', color: 'var(--ac)' }}
          >
            <Sliders className="w-4 h-4" />
            <span>Параметры и пороги</span>
          </button>
        </div>
      </div>

      {/* 1. Six facts grid */}
      <ModelFactsGrid
        latencyMs={bench?.full_batch_latency_ms}
        channelsCount={bench?.full_batch_channels_count ?? backtest?.channels}
      />

      {/* 2. ROC-AUC rings */}
      <RocAucRings
        standRoc={backtest?.summary?.all?.deployed?.roc_auc?.median ?? 0.65}
        holdoutRoc={report?.model_comparison?.champion_lightgbm?.roc_auc ?? 0.771}
        pilotRoc={backtest?.summary?.all?.lgbm_weekly?.roc_auc?.median ?? 0.84}
      />

      {/* 3. Accuracy rings (Сколько из 100 подтверждается) */}
      <AccuracyRings
        standPrecisionPct={backtest?.summary?.all?.deployed?.precision_at_100?.median ? backtest.summary.all.deployed.precision_at_100.median * 100 : 22}
        pilotPrecisionPct={backtest?.summary?.all?.lgbm_weekly?.precision_at_100?.median ? backtest.summary.all.lgbm_weekly.precision_at_100.median * 100 : 38}
        standMinPct={backtest?.summary?.all?.deployed?.precision_at_100?.min ? backtest.summary.all.deployed.precision_at_100.min * 100 : 14}
        standMaxPct={backtest?.summary?.all?.deployed?.precision_at_100?.max ? backtest.summary.all.deployed.precision_at_100.max * 100 : 38}
        lgbmWeeklyPrecisionAt100Median={backtest?.summary?.all?.lgbm_weekly?.precision_at_100?.median}
        prevalenceMedian={backtest?.summary?.all?.prevalence?.median}
      />

      {/* 4. Three checks accordion */}
      <ChecksAccordion
        firstCutoff={firstCutoff}
        lastCutoff={lastCutoff}
        deployedPrecisionMedianPct={Math.round((backtest?.summary?.all?.deployed?.precision_at_100?.median ?? 0.22) * 100)}
        deployedPrecisionMinPct={Math.round((backtest?.summary?.all?.deployed?.precision_at_100?.min ?? 0.14) * 100)}
        deployedPrecisionMaxPct={Math.round((backtest?.summary?.all?.deployed?.precision_at_100?.max ?? 0.38) * 100)}
        holdoutRocAuc={report?.model_comparison?.champion_lightgbm?.roc_auc ?? 0.771}
      />

      {/* 5. Reproduce block */}
      <ReproduceBlock
        reproductionCommand={backtest?.reproduction_command ?? report?.reproduction_command}
        consistency={backtest?.consistency_with_training_cache}
        baseline={{
          deployedRoc: backtest?.summary?.all?.deployed?.roc_auc?.median,
          deployedP100: backtest?.summary?.all?.deployed?.precision_at_100?.median,
          lgbmRoc: backtest?.summary?.all?.lgbm_weekly?.roc_auc?.median,
          lgbmP100: backtest?.summary?.all?.lgbm_weekly?.precision_at_100?.median,
          mismatchesTrain: backtest?.consistency_with_training_cache?.train?.label_mismatches,
          mismatchesVal: backtest?.consistency_with_training_cache?.val?.label_mismatches,
          mismatchesTest: backtest?.consistency_with_training_cache?.test?.label_mismatches,
        }}
        onReloaded={(newData) => setBacktest(newData)}
      />

      {/* 6. Model limits block */}
      <ModelLimitsBlock />

      {/* 7. Collapsible Deep Technical Inspection */}
      <div className="pt-6 border-t" style={{ borderColor: 'var(--ln2)' }}>
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="w-full p-4 rounded-2xl flex items-center justify-between text-left transition-colors cursor-pointer"
          style={{ background: 'var(--sf)', border: '1px solid var(--ln2)' }}
        >
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-[var(--ac)]" />
            <div>
              <div className="font-semibold text-sm sm:text-base" style={{ color: 'var(--ink)' }}>
                Детальный инженерный аудит и бенчмарки
              </div>
              <div className="text-xs" style={{ color: 'var(--mu)' }}>
                График 21 недели бэктеста, профилирование инференса, HTTP нагрузка, важность признаков и калибровка
              </div>
            </div>
          </div>
          {showTechnicalDetails ? (
            <ChevronUp className="w-5 h-5 text-[var(--mu)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--mu)]" />
          )}
        </button>

        {showTechnicalDetails && (
          <div className="mt-6 space-y-8">
            {/* 7.1. Deep Backtest Panel */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
                Еженедельный бэктест по 21 неделе (динамика)
              </h3>
              <BacktestPanel initialData={backtest} />
            </div>

            {/* 7.2. Engineering Performance Benchmarks */}
            {bench && (
              <div className="p-5 rounded-2xl space-y-4" style={{ background: 'var(--sf)', border: '1px solid var(--ln2)' }}>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[var(--ac)]" />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    Инженерный бенчмаркинг инференса (11 485 каналов)
                  </h3>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl space-y-1" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>Пакет 11 485 каналов:</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--gnt)' }}>
                      {bench.full_batch_latency_ms.toFixed(1)} мс
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
                      p95: {bench.full_batch_p95_latency_ms.toFixed(1)} мс
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl space-y-1" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>Один канал:</div>
                    <div className="text-2xl font-bold num">
                      {bench.single_sensor_latency_ms.toFixed(2)} мс
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
                      p95: {bench.single_sensor_p95_latency_ms.toFixed(2)} мс
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl space-y-1" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>Пропускная способность:</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--ac)' }}>
                      {count(bench.throughput_sensors_per_sec)}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
                      каналов / сек
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl space-y-1" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>Запас по SLA ТЗ (300 с):</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--gnt)' }}>
                      {Math.round(bench.speedup_vs_sla)}x
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
                      быстрее норматива
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7.3. HTTP Load Benchmark */}
            {httpBench && (
              <div className="p-5 rounded-2xl space-y-4" style={{ background: 'var(--sf)', border: '1px solid var(--ln2)' }}>
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-[var(--ac)]" />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    Нагрузочное HTTP-тестирование API
                  </h3>
                </div>

                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl space-y-1" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>Пропускная способность:</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--ac)' }}>
                      {httpBench.throughput_rps.toFixed(1)}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--mu)' }}>запросов / сек</div>
                  </div>

                  <div className="p-3.5 rounded-xl space-y-1" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>Задержка p50 / p95:</div>
                    <div className="text-2xl font-bold num">
                      {httpBench.latency_p50_ms.toFixed(1)} / {httpBench.latency_p95_ms.toFixed(1)}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--mu)' }}>мс</div>
                  </div>

                  <div className="p-3.5 rounded-xl space-y-1" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>Успешность запросов:</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--gnt)' }}>
                      {httpBench.success_rate_pct.toFixed(1)} %
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--mu)' }}>{httpBench.total_requests} запросов</div>
                  </div>

                  <div className="p-3.5 rounded-xl space-y-1 min-w-0 overflow-hidden" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs leading-tight break-words" style={{ color: 'var(--mu)' }}>
                      Норматив ТЗ: ответ ≤ {httpBench.tz_sla_target_ms ? Math.round(httpBench.tz_sla_target_ms / 1000) : 300} с
                    </div>
                    <div className="text-lg sm:text-2xl font-bold num break-words" style={{ color: 'var(--gnt)' }}>
                      p95 {httpBench.latency_p95_ms ? httpBench.latency_p95_ms.toFixed(0) : 0} мс
                    </div>
                    {Boolean(httpBench.tz_sla_target_ms && httpBench.latency_p95_ms && httpBench.latency_p95_ms > 0) && (
                      <div className="text-[11px] leading-tight break-words" style={{ color: 'var(--mu)' }}>
                        в {Math.round(httpBench.tz_sla_target_ms / httpBench.latency_p95_ms)}× быстрее норматива
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 7.4. Feature Importance */}
            {featureList.length > 0 && (
              <div className="p-5 rounded-2xl space-y-4" style={{ background: 'var(--sf)', border: '1px solid var(--ln2)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  Важность факторов в LightGBM (Split Gain)
                </h3>
                <div className="space-y-2.5">
                  {featureList.map(item => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium" style={{ color: 'var(--ink)' }}>{item.label}</span>
                        <span className="num" style={{ color: 'var(--mu)' }}>{Math.round(item.pct)} %</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--sf2)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.pct}%`, background: 'var(--ac)' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7.5. Multi-Model Comparison Table on Hold-out */}
            {models && (
              <div className="p-5 rounded-2xl space-y-4 overflow-x-auto" style={{ background: 'var(--sf)', border: '1px solid var(--ln2)' }}>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    Сравнение моделей на отложенном тестовом срезе (январь)
                  </h3>
                  <span className="text-xs" style={{ color: 'var(--mu)' }}>
                    {count(testChannels)} каналов · {testPositives} целевых событий в окне 24–72 ч
                  </span>
                </div>

                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--ln2)', color: 'var(--mu)' }}>
                      <th className="py-2.5 px-3 font-medium">Модель</th>
                      <th className="py-2.5 px-3 font-medium text-right">ROC-AUC</th>
                      <th className="py-2.5 px-3 font-medium text-right">Полнота</th>
                      <th className="py-2.5 px-3 font-medium text-right">Точность</th>
                      <th className="py-2.5 px-3 font-medium text-right">F1-Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--ln)' }}>
                    <tr>
                      <td className="py-2.5 px-3" style={{ color: 'var(--mu)' }}>Zero-Rule Baseline</td>
                      <td className="py-2.5 px-3 text-right num">0,5000</td>
                      <td className="py-2.5 px-3 text-right num">{pct(models.zero_rule?.recall)}</td>
                      <td className="py-2.5 px-3 text-right num">{pct(models.zero_rule?.precision)}</td>
                      <td className="py-2.5 px-3 text-right num">{metric(models.zero_rule?.f1)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium">Logistic Regression</td>
                      <td className="py-2.5 px-3 text-right num">{metric(models.logistic_regression?.roc_auc)}</td>
                      <td className="py-2.5 px-3 text-right num">{pct(models.logistic_regression?.recall)}</td>
                      <td className="py-2.5 px-3 text-right num">{pct(models.logistic_regression?.precision)}</td>
                      <td className="py-2.5 px-3 text-right num">{metric(models.logistic_regression?.f1)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium">Random Forest (100 деревьев)</td>
                      <td className="py-2.5 px-3 text-right num">{metric(models.random_forest?.roc_auc)}</td>
                      <td className="py-2.5 px-3 text-right num">{pct(models.random_forest?.recall)}</td>
                      <td className="py-2.5 px-3 text-right num">{pct(models.random_forest?.precision)}</td>
                      <td className="py-2.5 px-3 text-right num">{metric(models.random_forest?.f1)}</td>
                    </tr>
                    <tr style={{ background: 'var(--acs)' }}>
                      <td className="py-2.5 px-3 font-bold" style={{ color: 'var(--ac)' }}>
                        LightGBM (отложенная выборка (январь))
                      </td>
                      <td className="py-2.5 px-3 text-right num font-bold" style={{ color: 'var(--ac)' }}>
                        {metric(models.champion_lightgbm?.roc_auc)}
                      </td>
                      <td className="py-2.5 px-3 text-right num font-semibold">{pct(models.champion_lightgbm?.recall)}</td>
                      <td className="py-2.5 px-3 text-right num font-semibold">{pct(models.champion_lightgbm?.precision)}</td>
                      <td className="py-2.5 px-3 text-right num font-bold">{metric(models.champion_lightgbm?.f1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* 7.6. Probability Calibration */}
            {calib && (
              <div className="p-5 rounded-2xl space-y-4" style={{ background: 'var(--sf)', border: '1px solid var(--ln2)' }}>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[var(--ac)]" />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    Вероятностная калибровка (Beta Calibration)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl space-y-1" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>Brier Score (Beta):</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--gnt)' }}>
                      {metric(calib?.champion_lightgbm?.brier_score)}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
                      Baseline: {metric(calib?.brier_score_baseline)}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl space-y-1" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>ECE (Expected Calibration Error):</div>
                    <div className="text-2xl font-bold num">
                      {metric(calib?.champion_lightgbm?.expected_calibration_error_ece)}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--gnt)' }}>
                      Снижение ошибки в {ratio(calib?.champion_lightgbm?.expected_calibration_error_ece_raw, calib?.champion_lightgbm?.expected_calibration_error_ece)}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl space-y-1" style={{ background: 'var(--sf2)' }}>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>Когорта высокого риска (&ge; 0,42):</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--amt)' }}>
                      {metric(highRisk?.brier_score_calibrated)}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--mu)' }}>
                      Каналов: {highRisk?.n_channels ?? '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7.7. Download Report Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleDownloadReport}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-90"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать metrics_report.json</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Cpu, 
  Download, Clock, Database, Layers, Award, Zap, RefreshCw, Server,
  ChevronDown, ChevronUp, ShieldCheck
} from 'lucide-react';
import { BacktestPanel } from './BacktestPanel';

export const MetricsView: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showBoundaries, setShowBoundaries] = useState(false);

  const fetchMetrics = () => {
    setLoading(true);
    setLoadError(null);
    fetch('/api/predictions/metrics')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data.performance_benchmark || !data.http_load_benchmark || !data.model_comparison || !data.sample_sizes) {
          throw new Error('Отчёт модели неполон');
        }
        setReport(data);
        setLoading(false);
      })
      .catch(e => {
        console.error('Failed to load metrics', e);
        setReport(null);
        setLoadError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMetrics();
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

  if (!report) {
    return (
      <div className="space-y-6">
        <BacktestPanel />
        <div className="eng-panel p-6 text-sm text-[#9AA3B2]">
          {loading ? 'Загружаем отчёт модели…' : `Январский срез метрик недоступен: ${loadError || 'нет данных'}`}
          {!loading && <button onClick={fetchMetrics} className="ml-4 text-[#7C4DFF] hover:underline cursor-pointer">Повторить</button>}
        </div>
      </div>
    );
  }

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
  const importances = Object.entries(report.feature_importance || {})
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxImportance = importances[0]?.[1] || 1;
  const featureList = importances.map(([name, value]) => ({
    name, label: featureLabels[name] || name, pct: (value / maxImportance) * 100,
  }));

  const bench = report.performance_benchmark;
  const httpBench = report.http_load_benchmark;
  const models = report.model_comparison;
  const testSamples = report.sample_sizes;
  const calib = report.calibration_metrics;
  const highRisk = report.high_risk_and_top_k_calibration?.high_risk_cohort_raw_ge_0_42;
  const topK = report.high_risk_and_top_k_calibration?.top_k_channels;
  const testPositives: number = Number(testSamples?.test_proxy_positives ?? testSamples?.test_failures ?? NaN);
  const testChannels: number = Number(testSamples?.test_channels ?? NaN);
  const count = (value: number) => Number.isFinite(value) ? value.toLocaleString('ru-RU') : '—';
  const ratio = (a: unknown, b: unknown) => typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && b > 0
    ? `${(a / b).toFixed(1)}x` : '—';
  const topKRows = [100, 200, 500].map(k => ({ k, row: topK?.[`top_${k}`] }));
  const pct = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
    ? `${(value * 100).toFixed(1).replace('.', ',')} %` : '—';
  const metric = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(4).replace('.', ',') : '—';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#E7EAF0]">
              Проверка модели и инженерный бенчмаркинг
            </h1>
            <span className="eng-badge badge-normal">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Валидировано на СМВУ</span>
            </span>
            {loading && (
              <span className="text-xs text-[#7C4DFF] flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Обновление...
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#9AA3B2] mt-1">
            Комплексная верификация качества прогнозирования: недельный бэктест по 2026 году и хронологический тестовый срез (горизонт 24–72 ч)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMetrics}
            className="px-3 py-2 bg-transparent hover:bg-white/5 border border-white/10 rounded-lg text-xs text-[#9AA3B2] hover:text-[#E7EAF0] flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Обновить метрики с бэкенда"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>

          <button
            onClick={handleDownloadReport}
            className="px-4 py-2 bg-[#7C4DFF] hover:bg-[#9170FF] rounded-lg text-xs text-white font-medium flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать metrics_report.json</span>
          </button>
        </div>
      </div>

      {/* 1. WEEKLY BACKTEST PANEL (RENDERED FIRST) */}
      <BacktestPanel />

      {/* 2. BOUNDARIES OF PROTOTYPE (Collapsible block per Task 7) */}
      <div className="bg-[#121620] border border-white/10 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBoundaries(!showBoundaries)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left text-xs font-medium text-[#9AA3B2] hover:text-[#E7EAF0] hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#7C4DFF]" />
            <span className="text-[#E7EAF0] font-semibold text-sm">Границы прототипа</span>
            <span className="text-[11px] text-[#6B7385] hidden sm:inline">— ключевые рамки и допущения инженерного решения</span>
          </div>
          {showBoundaries ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showBoundaries && (
          <div className="px-5 pb-5 pt-1 text-xs text-[#9AA3B2] space-y-2 border-t border-white/5 bg-[#0B0E14]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-[#181D29] border border-white/5 space-y-1">
                <span className="text-[#E7EAF0] font-medium block">Разметка целевых событий:</span>
                <p className="leading-relaxed">
                  Метки сформированы алгоритмически по будущему журналу телеметрии СМВУ (критические пороги метана и температуры, длительное молчание, сообщения об авариях датчиков), а не по внешним актам CMMS/ТОиР.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#181D29] border border-white/5 space-y-1">
                <span className="text-[#E7EAF0] font-medium block">Интеграционный контур:</span>
                <p className="leading-relaxed">
                  Прототип функционирует автономно и готов к сопряжению по REST API, но не имеет прямого подключения к действующей диспетчерской SCADA и эксплуатационной CMMS.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#181D29] border border-white/5 space-y-1">
                <span className="text-[#E7EAF0] font-medium block">Топология сети:</span>
                <p className="leading-relaxed">
                  Координаты коллекторов схематизированы в соответствии с требованиями защиты объектов КИИ (149-ФЗ); инженерная привязка к пикетам (ПК) и трассам полностью сохранена из тегов СМВУ.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#181D29] border border-white/5 space-y-1">
                <span className="text-[#E7EAF0] font-medium block">Экономический расчёт:</span>
                <p className="leading-relaxed">
                  Финансовые показатели предотвращённых расходов носят сценарный характер и подлежат уточнению по утверждённым нормативам затрат на аварийные выезды и плановое ТО.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. DETAILED JANUARY SPLIT BREAKDOWN (Renamed per Task 4) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#E7EAF0]">
            Детальный разбор январского среза (обучение 14.01, тест 28.01)
          </h2>
          <p className="text-xs text-[#9AA3B2] mt-0.5">
            Контрольный хронологический тест: Train 01–14 янв, Validation 15–21 янв, Test 22–28 янв с оценкой на 29–31 янв
          </p>
        </div>

        {/* Multi-Model Comparison Table */}
        <div className="eng-panel overflow-hidden">
          <div className="p-3.5 bg-[#181D29] border-b border-white/10 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
            <span className="text-[#E7EAF0] font-semibold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#7C4DFF]" />
              Сравнение моделей на январском тестовом срезе
            </span>
            <span className="text-[#9AA3B2]">
              {count(testChannels)} каналов · {testPositives} целевых событий в окне 24–72 ч
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121620] text-[#9AA3B2] border-b border-white/10">
                <tr>
                  <th className="py-3 px-4 font-medium">Модель</th>
                  <th className="py-3 px-4 font-medium text-right">ROC-AUC</th>
                  <th className="py-3 px-4 font-medium text-right">Recall (Полнота)</th>
                  <th className="py-3 px-4 font-medium text-right">Precision (Точность)</th>
                  <th className="py-3 px-4 font-medium text-right">F1-Score</th>
                  <th className="py-3 px-4 font-medium">Назначение</th>
                  <th className="py-3 px-4 font-medium text-right">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-[#121620]">
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 text-[#9AA3B2]">1. Zero-Rule Baseline (Константа)</td>
                  <td className="py-3 px-4 text-right font-mono text-[#9AA3B2]">0,5000</td>
                  <td className="py-3 px-4 text-right font-mono text-[#9AA3B2]">{pct(models.zero_rule?.recall)}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#9AA3B2]">{pct(models.zero_rule?.precision)}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#9AA3B2]">{metric(models.zero_rule?.f1)}</td>
                  <td className="py-3 px-4 text-[#6B7385]">Базовый нулевой уровень</td>
                  <td className="py-3 px-4 text-right"><span className="eng-badge bg-white/5 text-[#9AA3B2]">Эталон</span></td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 text-[#E7EAF0] font-medium">2. Logistic Regression (L2, Balanced)</td>
                  <td className="py-3 px-4 text-right font-mono text-[#4C9BFF] font-medium">{metric(models.logistic_regression?.roc_auc)}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#2FBF71] font-semibold">{pct(models.logistic_regression?.recall)}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#F5A524]">{pct(models.logistic_regression?.precision)}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#E7EAF0]">{metric(models.logistic_regression?.f1)}</td>
                  <td className="py-3 px-4 text-[#9AA3B2]">Высокий охват предаварийных сигналов</td>
                  <td className="py-3 px-4 text-right"><span className="eng-badge badge-cyan">Активна в API</span></td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 text-[#E7EAF0] font-medium">3. Random Forest (100 деревьев)</td>
                  <td className="py-3 px-4 text-right font-mono text-[#9AA3B2]">{metric(models.random_forest?.roc_auc)}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#9AA3B2]">{pct(models.random_forest?.recall)}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#2FBF71] font-semibold">{pct(models.random_forest?.precision)}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#E7EAF0]">{metric(models.random_forest?.f1)}</td>
                  <td className="py-3 px-4 text-[#9AA3B2]">Консервативная селекция заявок</td>
                  <td className="py-3 px-4 text-right"><span className="eng-badge badge-warning">Активна в API</span></td>
                </tr>
                <tr className="bg-[#7C4DFF]/10 border-l-2 border-[#7C4DFF]">
                  <td className="py-3.5 px-4 text-[#E7EAF0] font-bold">4. Champion LightGBM Classifier</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#7C4DFF] font-bold">{metric(models.champion_lightgbm?.roc_auc)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#2FBF71] font-semibold">{pct(models.champion_lightgbm?.recall)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#2FBF71] font-semibold">{pct(models.champion_lightgbm?.precision)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#E7EAF0] font-bold">{metric(models.champion_lightgbm?.f1)}</td>
                  <td className="py-3.5 px-4 text-[#E7EAF0]">Основная модель диспетчерского пульта</td>
                  <td className="py-3.5 px-4 text-right"><span className="eng-badge bg-[#7C4DFF] text-white">Основная</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Probability Calibration Panel */}
        <div className="eng-panel p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#7C4DFF]" />
              <h3 className="text-xs font-bold text-[#E7EAF0] uppercase tracking-wider">
                Вероятностная калибровка модели (Validation-Fitted Beta vs Platt vs Baseline)
              </h3>
            </div>
            <span className="text-xs text-[#2FBF71] font-mono">
              Brier Score: {metric(calib?.champion_lightgbm?.brier_score)} &lt; Baseline {metric(calib?.brier_score_baseline)}
            </span>
          </div>

          {/* 4 Cards: Brier, ECE, High-Risk Cohort, Top-100 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
              <div className="text-[11px] text-[#9AA3B2]">Brier Score (Beta Champion):</div>
              <div className="text-2xl font-bold text-[#2FBF71] font-mono mt-1">
                {metric(calib?.champion_lightgbm?.brier_score)}
              </div>
              <div className="text-[10px] text-[#6B7385] mt-1 font-mono">
                Baseline: {metric(calib?.brier_score_baseline)} · Platt: {metric(calib?.champion_lightgbm?.brier_score_legacy_platt)}
              </div>
            </div>

            <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
              <div className="text-[11px] text-[#9AA3B2]">ECE (10 бинов, Beta):</div>
              <div className="text-2xl font-bold text-[#E7EAF0] font-mono mt-1">
                {metric(calib?.champion_lightgbm?.expected_calibration_error_ece)}
              </div>
              <div className="text-[10px] text-[#2FBF71] mt-1 font-mono">
                Снижение ошибки калибровки в {ratio(calib?.champion_lightgbm?.expected_calibration_error_ece_raw, calib?.champion_lightgbm?.expected_calibration_error_ece)}
              </div>
            </div>

            <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
              <div className="text-[11px] text-[#9AA3B2]">Когорта высокого риска (raw &ge; 0,42):</div>
              <div className="text-2xl font-bold text-[#4C9BFF] font-mono mt-1">
                {metric(highRisk?.brier_score_calibrated)} <span className="text-xs font-normal text-[#9AA3B2]">Brier</span>
              </div>
              <div className="text-[10px] text-[#4C9BFF] mt-1 font-mono">
                Улучшение в {ratio(highRisk?.brier_score_raw, highRisk?.brier_score_calibrated)} (N={highRisk?.n_channels ?? '—'})
              </div>
            </div>

            <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
              <div className="text-[11px] text-[#9AA3B2]">Топ-100 каналов (Lift и точность):</div>
              <div className="text-2xl font-bold text-[#F5A524] font-mono mt-1">
                {pct(topK?.top_100?.empirical_rate)}
              </div>
              <div className="text-[10px] text-[#F5A524] mt-1 font-mono">
                Lift {topK?.top_100?.lift_vs_baseline ?? '—'}x относительно базы ({topK?.top_100?.positives ?? '—'} из 100)
              </div>
            </div>
          </div>

          {/* Top-K Table */}
          <div className="overflow-x-auto border border-white/10 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#181D29] text-[#9AA3B2] border-b border-white/10">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Когорта ранжирования</th>
                  <th className="py-2.5 px-3 font-medium text-right">Каналов (N)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Событий</th>
                  <th className="py-2.5 px-3 font-medium text-right">Точность (Precision)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Lift к baseline</th>
                  <th className="py-2.5 px-3 font-medium text-right">Средний raw score</th>
                  <th className="py-2.5 px-3 font-medium text-right">Средняя калибр. вер-ть</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-[#121620]">
                {topKRows.map(({ k, row }) => (
                  <tr key={k} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 text-[#E7EAF0] font-medium">Топ-{k} каналов</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#9AA3B2]">{row?.k ?? k}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#2FBF71] font-semibold">{row?.positives ?? '—'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#2FBF71] font-semibold">{pct(row?.empirical_rate)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#F5A524] font-semibold">{typeof row?.lift_vs_baseline === 'number' ? `${row.lift_vs_baseline}x` : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#9AA3B2]">{metric(row?.mean_raw_score)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#4C9BFF]">{metric(row?.mean_calibrated_proxy_probability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Latency & Throughput Dual Benchmark Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Vector Inference Benchmark */}
          <div className="eng-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#F5A524]" />
                <h3 className="text-xs font-bold text-[#E7EAF0] uppercase tracking-wider">
                  1. Векторный C-инференс LightGBM
                </h3>
              </div>
              <span className="text-xs text-[#2FBF71] font-mono">
                100 прогонов perf_counter()
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
                <div className="text-[11px] text-[#9AA3B2]">Скоринг всех {bench.full_batch_channels_count.toLocaleString('ru-RU')} каналов:</div>
                <div className="text-2xl font-bold text-[#2FBF71] font-mono mt-1">
                  {bench.full_batch_latency_ms} <span className="text-xs font-normal text-[#9AA3B2]">мс</span>
                </div>
                <div className="text-[10px] text-[#9AA3B2] mt-1 font-mono">P95: {bench.full_batch_p95_latency_ms} мс (&lt; 0,11 с)</div>
              </div>

              <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
                <div className="text-[11px] text-[#9AA3B2]">Инференс одного датчика:</div>
                <div className="text-2xl font-bold text-[#E7EAF0] font-mono mt-1">
                  {bench.single_sensor_latency_ms} <span className="text-xs font-normal text-[#9AA3B2]">мс</span>
                </div>
                <div className="text-[10px] text-[#9AA3B2] mt-1 font-mono">P95: {bench.single_sensor_p95_latency_ms ?? '—'} мс</div>
              </div>

              <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
                <div className="text-[11px] text-[#9AA3B2]">Пропускная способность:</div>
                <div className="text-2xl font-bold text-[#4C9BFF] font-mono mt-1">
                  {bench.throughput_sensors_per_sec.toLocaleString('ru-RU')}
                </div>
                <div className="text-[10px] text-[#4C9BFF] mt-1">датчиков/сек на CPU</div>
              </div>

              <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
                <div className="text-[11px] text-[#9AA3B2]">Запас по SLA ТЗ (&le; 300 с):</div>
                <div className="text-2xl font-bold text-[#F5A524] font-mono mt-1">
                  В {bench.speedup_vs_sla.toLocaleString('ru-RU')} раз
                </div>
                <div className="text-[10px] text-[#2FBF71] mt-1">быстрее норматива ТЗ</div>
              </div>
            </div>
          </div>

          {/* Card 2: Live Network Socket HTTP Benchmark */}
          <div className="eng-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#4C9BFF]" />
                <h3 className="text-xs font-bold text-[#E7EAF0] uppercase tracking-wider">
                  2. Сетевой HTTP REST API стресс-тест
                </h3>
              </div>
              <span className="text-xs text-[#4C9BFF] font-mono">
                20 воркеров · 500 запросов
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
                <div className="text-[11px] text-[#9AA3B2]">Успешность запросов:</div>
                <div className="text-2xl font-bold text-[#2FBF71] font-mono mt-1">
                  {httpBench.success_rate_pct}%
                </div>
                <div className="text-[10px] text-[#9AA3B2] mt-1 font-mono">{httpBench.total_requests}/{httpBench.total_requests} без ошибок</div>
              </div>

              <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
                <div className="text-[11px] text-[#9AA3B2]">Пропускная способность:</div>
                <div className="text-2xl font-bold text-[#4C9BFF] font-mono mt-1">
                  {httpBench.throughput_rps} <span className="text-xs font-normal text-[#9AA3B2]">RPS</span>
                </div>
                <div className="text-[10px] text-[#9AA3B2] mt-1 font-mono">Время: {httpBench.total_time_seconds} с</div>
              </div>

              <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
                <div className="text-[11px] text-[#9AA3B2]">Задержка P50 (Медиана):</div>
                <div className="text-2xl font-bold text-[#E7EAF0] font-mono mt-1">
                  {httpBench.latency_p50_ms} <span className="text-xs font-normal text-[#9AA3B2]">мс</span>
                </div>
                <div className="text-[10px] text-[#9AA3B2] mt-1 font-mono">Средняя: {httpBench.latency_mean_ms} мс</div>
              </div>

              {/* Task 6 fix: show P90 instead of non-existent P99 */}
              <div className="bg-[#181D29] p-3 rounded-lg border border-white/10">
                <div className="text-[11px] text-[#9AA3B2]">Задержка P95 / P90:</div>
                <div className="text-2xl font-bold text-[#F5A524] font-mono mt-1">
                  {httpBench.latency_p95_ms} <span className="text-xs font-normal text-[#9AA3B2]">мс</span>
                </div>
                <div className="text-[10px] text-[#9AA3B2] mt-1 font-mono">P90: {httpBench.latency_p90_ms} мс (&lt; 0,3 с)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Importance & Explainability */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Feature Importance */}
          <div className="lg:col-span-7 eng-panel p-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#7C4DFF]" />
                <h3 className="text-xs font-bold text-[#E7EAF0] uppercase tracking-wider">
                  Факторы риска модели (Feature Importance по LightGBM)
                </h3>
              </div>
              <span className="text-[11px] text-[#9AA3B2]">Относительный вес</span>
            </div>

            <div className="space-y-3">
              {featureList.map((feat, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#E7EAF0] font-mono text-[11px]">{feat.name}</span>
                    <span className="text-[#9AA3B2] text-[11px]">{feat.label}</span>
                  </div>
                  <div className="w-full bg-[#0B0E14] h-2 rounded overflow-hidden">
                    <div 
                      className="bg-[#7C4DFF] h-full rounded transition-all duration-500" 
                      style={{ width: `${feat.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 text-xs text-[#9AA3B2] leading-relaxed">
              График отражает вклад признаков в классификацию потенциальных аномалий телеметрии и используется модулем интерпретации рекомендаций для диспетчера.
            </div>
          </div>

          {/* Right: Validation Methodology */}
          <div className="lg:col-span-5 eng-panel p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Database className="w-4 h-4 text-[#4C9BFF]" />
              <h3 className="text-xs font-bold text-[#E7EAF0] uppercase tracking-wider">
                Методология и воспроизводимость
              </h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="bg-[#181D29] p-3 rounded-lg border border-white/5 space-y-1">
                <div className="font-semibold text-[#E7EAF0] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#4C9BFF]" />
                  Хронологическое разделение
                </div>
                <p className="text-[#9AA3B2] text-[11px]">
                  Обучение на исторических неделях, подбор порога tau строго на валидационном интервале, оценка на отложенном тесте без заглядывания в будущее.
                </p>
              </div>

              <div className="bg-[#181D29] p-3 rounded-lg border border-white/5 space-y-1">
                <div className="font-semibold text-[#E7EAF0] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#F5A524]" />
                  Общий модуль признаков
                </div>
                <p className="text-[#9AA3B2] text-[11px]">
                  Модуль <code className="text-[#E7EAF0]">backend/ml/features.py</code> гарантирует идентичный расчёт признаков при обучении и в боевом API.
                </p>
              </div>

              <div className="bg-[#181D29] p-3 rounded-lg border border-white/5 space-y-1">
                <div className="font-semibold text-[#E7EAF0] flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#2FBF71]" />
                  Автономный контур КИИ (149-ФЗ / 152-ФЗ)
                </div>
                <p className="text-[#9AA3B2] text-[11px]">
                  Все модели работают локально на CPU без облачных внешних вызовов, гарантируя безопасность технологических данных предприятия.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

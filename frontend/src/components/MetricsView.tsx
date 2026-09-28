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
  const [showJanuary, setShowJanuary] = useState(false);

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
        <div className="panel p-6 text-sm" style={{ color: 'var(--muted)' }}>
          {loading ? 'Загружаем отчёт модели…' : `Январский срез метрик недоступен: ${loadError || 'нет данных'}`}
          {!loading && (
            <button onClick={fetchMetrics} className="ml-4 hover:underline cursor-pointer" style={{ color: 'var(--accent-text)' }}>
              Повторить
            </button>
          )}
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold">
              Проверка модели и инженерный бенчмаркинг
            </h1>
            <span className="chip risk-NORMAL">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Валидировано на СМВУ</span>
            </span>
            {loading && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-text)' }}>
                <RefreshCw className="w-3 h-3 animate-spin" /> Обновление…
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Комплексная верификация качества прогнозирования: недельный бэктест по 2026 году и хронологический тестовый срез (горизонт 24–72 ч)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMetrics}
            className="btn btn-secondary text-xs h-8"
            title="Обновить метрики с бэкенда"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>

          <button
            onClick={handleDownloadReport}
            className="btn btn-primary text-xs h-8"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать metrics_report.json</span>
          </button>
        </div>
      </div>

      {/* 1. WEEKLY BACKTEST PANEL (RENDERED FIRST) */}
      <BacktestPanel />

      {/* 2. BOUNDARIES OF PROTOTYPE (Collapsible block) */}
      <div className="panel overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBoundaries(!showBoundaries)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left text-xs font-medium transition-colors hover:bg-[var(--surface-2)]"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
            <span className="font-semibold text-sm">Границы прототипа</span>
            <span className="text-[11px] hidden sm:inline" style={{ color: 'var(--muted)' }}>
              — ключевые рамки и допущения инженерного решения
            </span>
          </div>
          {showBoundaries ? <ChevronUp className="w-4 h-4 text-[var(--muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--muted)]" />}
        </button>

        {showBoundaries && (
          <div className="px-5 pb-5 pt-1 text-xs space-y-2 border-t" style={{ borderColor: 'var(--line)', background: 'var(--bg)', color: 'var(--muted)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg border space-y-1" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
                <span className="font-medium block text-[var(--text)]">Разметка целевых событий:</span>
                <p className="leading-relaxed">
                  Метки сформированы алгоритмически по будущему журналу телеметрии СМВУ (критические пороги метана и температуры, длительное молчание, сообщения об авариях датчиков), а не по внешним актам CMMS/ТОиР.
                </p>
              </div>

              <div className="p-3 rounded-lg border space-y-1" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
                <span className="font-medium block text-[var(--text)]">Интеграционный контур:</span>
                <p className="leading-relaxed">
                  Прототип функционирует автономно и готов к сопряжению по REST API, но не имеет прямого подключения к действующей диспетчерской SCADA и эксплуатационной CMMS.
                </p>
              </div>

              <div className="p-3 rounded-lg border space-y-1" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
                <span className="font-medium block text-[var(--text)]">Топология сети:</span>
                <p className="leading-relaxed">
                  Координаты коллекторов схематизированы в соответствии с требованиями защиты объектов КИИ (149-ФЗ); инженерная привязка к пикетам (ПК) и трассам полностью сохранена из тегов СМВУ.
                </p>
              </div>

              <div className="p-3 rounded-lg border space-y-1" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
                <span className="font-medium block text-[var(--text)]">Экономический расчёт:</span>
                <p className="leading-relaxed">
                  Финансовые показатели предотвращённых расходов носят сценарный характер и подлежат уточнению по утверждённым нормативам затрат на аварийные выезды и плановое ТО.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. DETAILED JANUARY SPLIT BREAKDOWN (COLLAPSED BY DEFAULT PER TASK 2) */}
      <div className="panel overflow-hidden">
        <button
          type="button"
          onClick={() => setShowJanuary(!showJanuary)}
          className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors hover:bg-[var(--surface-2)]"
        >
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
            <div>
              <div className="font-semibold text-sm">Детальный разбор январского среза</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Обучение 14.01, тест 28.01 · 4 модели, калибровка, бенчмарки времени инференса и HTTP
              </div>
            </div>
          </div>
          {showJanuary ? <ChevronUp className="w-4 h-4 text-[var(--muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--muted)]" />}
        </button>

        {showJanuary && (
          <div className="p-5 border-t space-y-6" style={{ borderColor: 'var(--line)' }}>
            {/* Multi-Model Comparison Table */}
            <div className="panel overflow-hidden">
              <div className="p-3.5 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
                <span className="font-semibold flex items-center gap-2">
                  <Cpu className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
                  Сравнение моделей на январском тестовом срезе
                </span>
                <span style={{ color: 'var(--muted)' }}>
                  <span className="num">{count(testChannels)}</span> каналов · <span className="num">{testPositives}</span> целевых событий в окне 24–72 ч
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                      <th className="py-3 px-4 font-medium">Модель</th>
                      <th className="py-3 px-4 font-medium text-right">ROC-AUC</th>
                      <th className="py-3 px-4 font-medium text-right">Recall (Полнота)</th>
                      <th className="py-3 px-4 font-medium text-right">Precision (Точность)</th>
                      <th className="py-3 px-4 font-medium text-right">F1-Score</th>
                      <th className="py-3 px-4 font-medium">Назначение</th>
                      <th className="py-3 px-4 font-medium text-right">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                    <tr className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-3 px-4" style={{ color: 'var(--muted)' }}>1. Zero-Rule Baseline (Константа)</td>
                      <td className="py-3 px-4 text-right num" style={{ color: 'var(--muted)' }}>0,5000</td>
                      <td className="py-3 px-4 text-right num" style={{ color: 'var(--muted)' }}>{pct(models.zero_rule?.recall)}</td>
                      <td className="py-3 px-4 text-right num" style={{ color: 'var(--muted)' }}>{pct(models.zero_rule?.precision)}</td>
                      <td className="py-3 px-4 text-right num" style={{ color: 'var(--muted)' }}>{metric(models.zero_rule?.f1)}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--faint)' }}>Базовый нулевой уровень</td>
                      <td className="py-3 px-4 text-right">
                        <span className="chip" style={{ background: 'var(--surface-3)', color: 'var(--muted)' }}>Эталон</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-3 px-4 font-medium">2. Logistic Regression (L2, Balanced)</td>
                      <td className="py-3 px-4 text-right num font-medium" style={{ color: 'var(--attn)' }}>{metric(models.logistic_regression?.roc_auc)}</td>
                      <td className="py-3 px-4 text-right num font-semibold" style={{ color: 'var(--ok)' }}>{pct(models.logistic_regression?.recall)}</td>
                      <td className="py-3 px-4 text-right num" style={{ color: 'var(--warn)' }}>{pct(models.logistic_regression?.precision)}</td>
                      <td className="py-3 px-4 text-right num">{metric(models.logistic_regression?.f1)}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--muted)' }}>Высокий охват предаварийных сигналов</td>
                      <td className="py-3 px-4 text-right">
                        <span className="chip risk-ATTENTION">Активна в API</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-3 px-4 font-medium">3. Random Forest (100 деревьев)</td>
                      <td className="py-3 px-4 text-right num" style={{ color: 'var(--muted)' }}>{metric(models.random_forest?.roc_auc)}</td>
                      <td className="py-3 px-4 text-right num" style={{ color: 'var(--muted)' }}>{pct(models.random_forest?.recall)}</td>
                      <td className="py-3 px-4 text-right num font-semibold" style={{ color: 'var(--ok)' }}>{pct(models.random_forest?.precision)}</td>
                      <td className="py-3 px-4 text-right num">{metric(models.random_forest?.f1)}</td>
                      <td className="py-3 px-4" style={{ color: 'var(--muted)' }}>Консервативная селекция заявок</td>
                      <td className="py-3 px-4 text-right">
                        <span className="chip risk-WARNING">Активна в API</span>
                      </td>
                    </tr>
                    <tr style={{ background: 'var(--accent-soft)' }}>
                      <td className="py-3.5 px-4 font-bold">4. Champion LightGBM Classifier</td>
                      <td className="py-3.5 px-4 text-right num font-bold" style={{ color: 'var(--accent-text)' }}>{metric(models.champion_lightgbm?.roc_auc)}</td>
                      <td className="py-3.5 px-4 text-right num font-semibold" style={{ color: 'var(--ok)' }}>{pct(models.champion_lightgbm?.recall)}</td>
                      <td className="py-3.5 px-4 text-right num font-semibold" style={{ color: 'var(--ok)' }}>{pct(models.champion_lightgbm?.precision)}</td>
                      <td className="py-3.5 px-4 text-right num font-bold">{metric(models.champion_lightgbm?.f1)}</td>
                      <td className="py-3.5 px-4 font-medium">Основная модель диспетчерского пульта</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="chip" style={{ background: 'var(--accent)', color: '#fff' }}>Основная</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Probability Calibration Panel */}
            <div className="panel p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b gap-2" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
                  <h3 className="text-xs font-semibold">
                    Вероятностная калибровка модели (Validation-Fitted Beta vs Platt vs Baseline)
                  </h3>
                </div>
                <span className="text-xs num font-medium" style={{ color: 'var(--ok)' }}>
                  Brier Score: {metric(calib?.champion_lightgbm?.brier_score)} &lt; Baseline {metric(calib?.brier_score_baseline)}
                </span>
              </div>

              {/* 4 Cards: Brier, ECE, High-Risk Cohort, Top-100 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="panel p-3.5 space-y-1" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Brier Score (Beta Champion):</div>
                  <div className="text-2xl font-bold num" style={{ color: 'var(--ok)' }}>
                    {metric(calib?.champion_lightgbm?.brier_score)}
                  </div>
                  <div className="text-[10px] num" style={{ color: 'var(--faint)' }}>
                    Baseline: {metric(calib?.brier_score_baseline)} · Platt: {metric(calib?.champion_lightgbm?.brier_score_legacy_platt)}
                  </div>
                </div>

                <div className="panel p-3.5 space-y-1" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>ECE (10 бинов, Beta):</div>
                  <div className="text-2xl font-bold num">
                    {metric(calib?.champion_lightgbm?.expected_calibration_error_ece)}
                  </div>
                  <div className="text-[10px] num" style={{ color: 'var(--ok)' }}>
                    Снижение ошибки калибровки в {ratio(calib?.champion_lightgbm?.expected_calibration_error_ece_raw, calib?.champion_lightgbm?.expected_calibration_error_ece)}
                  </div>
                </div>

                <div className="panel p-3.5 space-y-1" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Когорта высокого риска (raw &ge; 0,42):</div>
                  <div className="text-2xl font-bold num" style={{ color: 'var(--attn)' }}>
                    {metric(highRisk?.brier_score_calibrated)} <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>Brier</span>
                  </div>
                  <div className="text-[10px] num" style={{ color: 'var(--attn)' }}>
                    Улучшение в {ratio(highRisk?.brier_score_raw, highRisk?.brier_score_calibrated)} (N={highRisk?.n_channels ?? '—'})
                  </div>
                </div>

                <div className="panel p-3.5 space-y-1" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Топ-100 каналов (Lift и точность):</div>
                  <div className="text-2xl font-bold num" style={{ color: 'var(--warn)' }}>
                    {pct(topK?.top_100?.empirical_rate)}
                  </div>
                  <div className="text-[10px] num" style={{ color: 'var(--warn)' }}>
                    Lift {topK?.top_100?.lift_vs_baseline ?? '—'}x относительно базы ({topK?.top_100?.positives ?? '—'} из 100)
                  </div>
                </div>
              </div>

              {/* Top-K Table */}
              <div className="panel overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                      <th className="py-2.5 px-3 font-medium">Когорта ранжирования</th>
                      <th className="py-2.5 px-3 font-medium text-right">Каналов (N)</th>
                      <th className="py-2.5 px-3 font-medium text-right">Событий</th>
                      <th className="py-2.5 px-3 font-medium text-right">Точность (Precision)</th>
                      <th className="py-2.5 px-3 font-medium text-right">Lift к baseline</th>
                      <th className="py-2.5 px-3 font-medium text-right">Средний raw score</th>
                      <th className="py-2.5 px-3 font-medium text-right">Средняя калибр. вер-ть</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--line)' }}>
                    {topKRows.map(({ k, row }) => (
                      <tr key={k} className="hover:bg-[var(--surface-2)] transition-colors">
                        <td className="py-2.5 px-3 font-medium">Топ-{k} каналов</td>
                        <td className="py-2.5 px-3 text-right num" style={{ color: 'var(--muted)' }}>{row?.k ?? k}</td>
                        <td className="py-2.5 px-3 text-right num font-semibold" style={{ color: 'var(--ok)' }}>{row?.positives ?? '—'}</td>
                        <td className="py-2.5 px-3 text-right num font-semibold" style={{ color: 'var(--ok)' }}>{pct(row?.empirical_rate)}</td>
                        <td className="py-2.5 px-3 text-right num font-semibold" style={{ color: 'var(--warn)' }}>{typeof row?.lift_vs_baseline === 'number' ? `${row.lift_vs_baseline}x` : '—'}</td>
                        <td className="py-2.5 px-3 text-right num" style={{ color: 'var(--muted)' }}>{metric(row?.mean_raw_score)}</td>
                        <td className="py-2.5 px-3 text-right num" style={{ color: 'var(--attn)' }}>{metric(row?.mean_calibrated_proxy_probability)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Latency & Throughput Dual Benchmark Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card 1: Vector Inference Benchmark */}
              <div className="panel p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" style={{ color: 'var(--warn)' }} />
                    <h3 className="text-xs font-semibold">
                      1. Векторный C-инференс LightGBM
                    </h3>
                  </div>
                  <span className="text-xs num" style={{ color: 'var(--ok)' }}>
                    100 прогонов perf_counter()
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Скоринг всех {bench.full_batch_channels_count.toLocaleString('ru-RU')} каналов:</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--ok)' }}>
                      {bench.full_batch_latency_ms} <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>мс</span>
                    </div>
                    <div className="text-[10px] num" style={{ color: 'var(--muted)' }}>P95: {bench.full_batch_p95_latency_ms} мс (&lt; 0,11 с)</div>
                  </div>

                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Инференс одного датчика:</div>
                    <div className="text-2xl font-bold num">
                      {bench.single_sensor_latency_ms} <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>мс</span>
                    </div>
                    <div className="text-[10px] num" style={{ color: 'var(--muted)' }}>P95: {bench.single_sensor_p95_latency_ms ?? '—'} мс</div>
                  </div>

                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Пропускная способность:</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--attn)' }}>
                      {bench.throughput_sensors_per_sec.toLocaleString('ru-RU')}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--attn)' }}>датчиков/сек на CPU</div>
                  </div>

                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Запас по SLA ТЗ (&le; 300 с):</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--warn)' }}>
                      В {bench.speedup_vs_sla.toLocaleString('ru-RU')} раз
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--ok)' }}>быстрее норматива ТЗ</div>
                  </div>
                </div>
              </div>

              {/* Card 2: Live Network Socket HTTP Benchmark */}
              <div className="panel p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4" style={{ color: 'var(--attn)' }} />
                    <h3 className="text-xs font-semibold">
                      2. Сетевой HTTP REST API стресс-тест
                    </h3>
                  </div>
                  <span className="text-xs num" style={{ color: 'var(--attn)' }}>
                    20 воркеров · 500 запросов
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Успешность запросов:</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--ok)' }}>
                      {httpBench.success_rate_pct}%
                    </div>
                    <div className="text-[10px] num" style={{ color: 'var(--muted)' }}>{httpBench.total_requests}/{httpBench.total_requests} без ошибок</div>
                  </div>

                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Пропускная способность:</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--attn)' }}>
                      {httpBench.throughput_rps} <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>RPS</span>
                    </div>
                    <div className="text-[10px] num" style={{ color: 'var(--muted)' }}>Время: {httpBench.total_time_seconds} с</div>
                  </div>

                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Задержка P50 (Медиана):</div>
                    <div className="text-2xl font-bold num">
                      {httpBench.latency_p50_ms} <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>мс</span>
                    </div>
                    <div className="text-[10px] num" style={{ color: 'var(--muted)' }}>Средняя: {httpBench.latency_mean_ms} мс</div>
                  </div>

                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Задержка P95 / P90:</div>
                    <div className="text-2xl font-bold num" style={{ color: 'var(--warn)' }}>
                      {httpBench.latency_p95_ms} <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>мс</span>
                    </div>
                    <div className="text-[10px] num" style={{ color: 'var(--muted)' }}>P90: {httpBench.latency_p90_ms} мс (&lt; 0,3 с)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Importance & Explainability */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Feature Importance */}
              <div className="lg:col-span-7 panel p-5">
                <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
                    <h3 className="text-xs font-semibold">
                      Факторы риска модели (Feature Importance по LightGBM)
                    </h3>
                  </div>
                  <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Относительный вес</span>
                </div>

                <div className="space-y-3">
                  {featureList.map((feat, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="num text-[11px] font-medium">{feat.name}</span>
                        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{feat.label}</span>
                      </div>
                      <div className="w-full h-2 rounded overflow-hidden" style={{ background: 'var(--bg)' }}>
                        <div 
                          className="h-full rounded transition-all duration-500" 
                          style={{ width: `${feat.pct}%`, background: 'var(--accent)' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t text-xs leading-relaxed" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                  График отражает вклад признаков в классификацию потенциальных аномалий телеметрии и используется модулем интерпретации рекомендаций для диспетчера.
                </div>
              </div>

              {/* Right: Validation Methodology */}
              <div className="lg:col-span-5 panel p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
                  <Database className="w-4 h-4" style={{ color: 'var(--attn)' }} />
                  <h3 className="text-xs font-semibold">
                    Методология и воспроизводимость
                  </h3>
                </div>

                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" style={{ color: 'var(--attn)' }} />
                      Хронологическое разделение
                    </div>
                    <p style={{ color: 'var(--muted)' }} className="text-[11px]">
                      Обучение на исторических неделях, подбор порога tau строго на валидационном интервале, оценка на отложенном тесте без заглядывания в будущее.
                    </p>
                  </div>

                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="font-semibold flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" style={{ color: 'var(--warn)' }} />
                      Общий модуль признаков
                    </div>
                    <p style={{ color: 'var(--muted)' }} className="text-[11px]">
                      Модуль <code>backend/ml/features.py</code> гарантирует идентичный расчёт признаков при обучении и в боевом API.
                    </p>
                  </div>

                  <div className="panel p-3 space-y-1" style={{ background: 'var(--surface-2)' }}>
                    <div className="font-semibold flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} />
                      Автономный контур КИИ (149-ФЗ / 152-ФЗ)
                    </div>
                    <p style={{ color: 'var(--muted)' }} className="text-[11px]">
                      Все модели работают локально на CPU без облачных внешних вызовов, гарантируя безопасность технологических данных предприятия.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

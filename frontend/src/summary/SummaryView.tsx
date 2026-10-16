import React, { useCallback, useEffect, useState } from 'react';
import { BacktestResponse, PredictionMetricsResponse, ScenarioRunResponse } from '../types';
import { BlockABacktest } from './BlockABacktest';
import { BlockBPerformance } from './BlockBPerformance';
import { BlockCAlertLoad } from './BlockCAlertLoad';
import { RefreshCw, LayoutDashboard } from 'lucide-react';

interface Props {
  onOpenScenarios: () => void;
}

export const SummaryView: React.FC<Props> = ({ onOpenScenarios }) => {
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [loadingBacktest, setLoadingBacktest] = useState(true);
  const [errorBacktest, setErrorBacktest] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<PredictionMetricsResponse | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [errorMetrics, setErrorMetrics] = useState<string | null>(null);

  const [scenarioData, setScenarioData] = useState<ScenarioRunResponse | null>(null);
  const [loadingScenario, setLoadingScenario] = useState(true);
  const [errorScenario, setErrorScenario] = useState<string | null>(null);

  // Fetch backtest
  const fetchBacktest = useCallback(async () => {
    setLoadingBacktest(true);
    setErrorBacktest(null);
    try {
      const res = await fetch('/api/predictions/backtest');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBacktest(json);
    } catch (e: any) {
      setErrorBacktest(e.message || 'Ошибка загрузки бэктеста');
    } finally {
      setLoadingBacktest(false);
    }
  }, []);

  // Fetch metrics (performance & http load)
  const fetchMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    setErrorMetrics(null);
    try {
      const res = await fetch('/api/predictions/metrics');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setMetrics(json);
    } catch (e: any) {
      setErrorMetrics(e.message || 'Ошибка загрузки метрик');
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  // Run day scenario (seed 42)
  const runScenario = useCallback(async () => {
    setLoadingScenario(true);
    setErrorScenario(null);
    try {
      const res = await fetch('/api/scenarios/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'day', seed: 42 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setScenarioData(json);
    } catch (e: any) {
      setErrorScenario(e.message || 'Ошибка запуска сценария');
    } finally {
      setLoadingScenario(false);
    }
  }, []);

  useEffect(() => {
    fetchBacktest();
    fetchMetrics();
    runScenario();
  }, [fetchBacktest, fetchMetrics, runScenario]);

  const handleRefreshAll = () => {
    fetchBacktest();
    fetchMetrics();
    runScenario();
  };

  return (
    <div className="flex flex-col gap-5 max-w-[1320px] mx-auto pb-8 min-w-0 w-full">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className="w-6 h-6" style={{ color: 'var(--ac)' }} />
            <h1 className="serif font-semibold text-2xl lg:text-3xl leading-none">
              Сводка
            </h1>
          </div>
          <p className="text-sm mt-1.5" style={{ color: 'var(--mut)' }}>
            Валидация точности на реальных данных, скорость расчётов и нагрузка на диспетчера
          </p>
        </div>

        <button
          onClick={handleRefreshAll}
          className="btn btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          title="Обновить данные сводки"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Обновить замеры</span>
        </button>
      </div>

      {/* Block A: План и факт на реальных данных (21 неделя) */}
      <BlockABacktest
        data={backtest}
        loading={loadingBacktest}
        error={errorBacktest}
      />

      {/* Blocks B and C: side-by-side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start min-w-0 w-full">
        {/* Block B: Масштаб и скорость */}
        <BlockBPerformance
          performance={metrics?.performance_benchmark ?? null}
          httpBenchmark={metrics?.http_load_benchmark ?? null}
          loading={loadingMetrics}
          error={errorMetrics}
        />

        {/* Block C: Нагрузка на диспетчера (синтетика) */}
        <BlockCAlertLoad
          data={scenarioData}
          loading={loadingScenario}
          error={errorScenario}
          onRetry={runScenario}
          onOpenScenarios={onOpenScenarios}
        />
      </div>
    </div>
  );
};

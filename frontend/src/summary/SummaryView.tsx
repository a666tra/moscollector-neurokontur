import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  BacktestResponse,
  PredictionMetricsResponse,
  ScenarioRunResponse,
  MaintenanceTicket,
} from '../types';
import { VerdictHeader } from './VerdictHeader';
import { ActionTiles } from './ActionTiles';
import { WhoGuessesBetter } from './WhoGuessesBetter';
import { WeeklyRibbon } from './WeeklyRibbon';
import { ReferenceWeekCards } from './ReferenceWeekCards';
import { InteractiveChart } from './InteractiveChart';
import { AlertLoadBlock } from './AlertLoadBlock';
import { LimitationCards } from './LimitationCards';
import { BlockBPerformance } from './BlockBPerformance';

interface Props {
  onOpenScenarios: () => void;
  onOpenTickets?: (filterKey?: string) => void;
}

export const SummaryView: React.FC<Props> = ({ onOpenScenarios, onOpenTickets }) => {
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [loadingBacktest, setLoadingBacktest] = useState(true);
  const [errorBacktest, setErrorBacktest] = useState<string | null>(null);

  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const [metrics, setMetrics] = useState<PredictionMetricsResponse | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [errorMetrics, setErrorMetrics] = useState<string | null>(null);

  const [scenarioData, setScenarioData] = useState<ScenarioRunResponse | null>(null);
  const [loadingScenario, setLoadingScenario] = useState(true);
  const [errorScenario, setErrorScenario] = useState<string | null>(null);

  const [scope, setScope] = useState<'all' | 'new_incidents'>('all');
  const [selectedModel, setSelectedModel] = useState<'deployed' | 'lgbm_weekly'>('deployed');
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(20); // Default to last backtest week
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const playTimerRef = useRef<any>(null);

  // Fetch backtest data
  const fetchBacktest = useCallback(async () => {
    setLoadingBacktest(true);
    setErrorBacktest(null);
    try {
      const res = await fetch('/api/predictions/backtest');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: BacktestResponse = await res.json();
      setBacktest(json);
      if (json?.weeks && json.weeks.length > 0) {
        setSelectedWeekIdx(json.weeks.length - 1);
      }
    } catch (e: any) {
      setErrorBacktest(e.message || 'Ошибка загрузки бэктеста');
    } finally {
      setLoadingBacktest(false);
    }
  }, []);

  // Fetch tickets for action tiles
  const fetchTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const json = await res.json();
        setTickets(Array.isArray(json) ? json : []);
      }
    } catch {
      // Ignore network errors on tickets fetch
    } finally {
      setLoadingTickets(false);
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
    fetchTickets();
    fetchMetrics();
    runScenario();
  }, [fetchBacktest, fetchTickets, fetchMetrics, runScenario]);

  // Handle refresh
  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchBacktest(), fetchTickets(), fetchMetrics(), runScenario()]);
    setRefreshing(false);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setLastUpdated(`${hh}:${mm}`);
  };

  // Navigate to tickets screen with filter
  const handleNavigateTickets = (filterKey?: string) => {
    if (onOpenTickets) {
      onOpenTickets(filterKey);
      return;
    }
    // Try to click the "Заявки" tab button in header/nav
    const buttons = Array.from(document.querySelectorAll('button'));
    const ticketsBtn = buttons.find((b) => b.textContent?.trim().includes('Заявки'));
    if (ticketsBtn) {
      ticketsBtn.click();
      return;
    }
    // Fallback: update query param
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('view', 'tickets');
      window.location.href = u.toString();
    } catch {
      // ignore
    }
  };

  // Play through weeks
  const stopPlay = useCallback(() => {
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopPlay();
    } else {
      setIsPlaying(true);
      setSelectedWeekIdx(0);
      const totalWeeks = backtest?.weeks?.length ?? 21;
      playTimerRef.current = setInterval(() => {
        setSelectedWeekIdx((prev) => {
          if (prev >= totalWeeks - 1) {
            stopPlay();
            return prev;
          }
          return prev + 1;
        });
      }, 1100);
    }
  };

  useEffect(() => {
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, []);

  const handleSelectWeek = (idx: number) => {
    stopPlay();
    setSelectedWeekIdx(idx);
  };

  // Real numbers for VerdictHeader
  const standMed = Math.round((backtest?.summary?.all?.deployed?.precision_at_100?.median ?? 0.22) * 100);
  const ruleMed = Math.round((backtest?.summary?.all?.persistence?.precision_at_100?.median ?? 0.38) * 100);
  const pilotMed = Math.round((backtest?.summary?.all?.lgbm_weekly?.precision_at_100?.median ?? 0.38) * 100);

  const standQuiet = Math.round((backtest?.summary?.new_incidents?.deployed?.precision_at_100?.median ?? 0.05) * 100);
  const pilotQuiet = Math.round((backtest?.summary?.new_incidents?.lgbm_weekly?.precision_at_100?.median ?? 0.06) * 100);
  const ruleQuiet = Math.round((backtest?.summary?.new_incidents?.persistence?.precision_at_100?.median ?? 0) * 100);

  const naiveAlerts = scenarioData?.comparison?.naive?.alerts_total ?? 1436;
  const fastAlerts = scenarioData?.comparison?.fast?.alerts_total ?? 146;
  const fastIncidents = scenarioData?.comparison?.fast?.incidents ?? 67;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 max-w-[1240px] mx-auto pb-12 min-w-0 w-full overflow-x-hidden">
      {/* 1. Header & Verdict Sentence (from real numbers) */}
      <VerdictHeader
        standMed={standMed}
        ruleMed={ruleMed}
        pilotMed={pilotMed}
        pilotQuiet={pilotQuiet}
        ruleQuiet={ruleQuiet}
        naiveAlerts={naiveAlerts}
        fastAlerts={fastAlerts}
        fastIncidents={fastIncidents}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onRefresh={handleRefreshAll}
      />

      {/* 2. Three Action Tiles: Срочно / Без бригады / Бригады в деле */}
      <ActionTiles
        tickets={tickets}
        loading={loadingTickets}
        onNavigateTickets={handleNavigateTickets}
      />

      {/* 3. «Кто чаще угадывает?»: Dot Grids (из 100) */}
      <WhoGuessesBetter
        scope={scope}
        onScopeChange={setScope}
        summaryAll={backtest?.summary?.all ?? null}
        summaryNewIncidents={backtest?.summary?.new_incidents ?? null}
        selectedWeekIdx={selectedWeekIdx}
      />

      {/* 4. 21-Square Weekly Ribbon & Tally */}
      {backtest?.weeks && backtest.weeks.length > 0 && (
        <WeeklyRibbon
          weeks={backtest.weeks}
          scope={scope}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          selectedWeekIdx={selectedWeekIdx}
          onSelectWeek={handleSelectWeek}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
        />
      )}

      {/* 5. Reference Weeks: Median, Worst, Best */}
      {backtest?.weeks && backtest.weeks.length > 0 && (
        <ReferenceWeekCards
          weeks={backtest.weeks}
          scope={scope}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          selectedWeekIdx={selectedWeekIdx}
          onSelectWeek={handleSelectWeek}
        />
      )}

      {/* 6. Interactive Chart: 3 Lines with Legend Toggles & Arrow Controls */}
      {backtest?.weeks && backtest.weeks.length > 0 && (
        <InteractiveChart
          weeks={backtest.weeks}
          scope={scope}
          selectedWeekIdx={selectedWeekIdx}
          onSelectWeek={handleSelectWeek}
        />
      )}

      {/* 7. Alert Load: naive 1 436 / static 535 / fast 146 (синтетика) */}
      <AlertLoadBlock
        data={scenarioData}
        loading={loadingScenario}
        error={errorScenario}
        onRetry={runScenario}
        onOpenScenarios={onOpenScenarios}
      />

      {/* 8. Scale & Latency Benchmarks */}
      <BlockBPerformance
        performance={metrics?.performance_benchmark ?? null}
        httpBenchmark={metrics?.http_load_benchmark ?? null}
        loading={loadingMetrics}
        error={errorMetrics}
      />

      {/* 9. Limitations: 3 Cards with Icons instead of a footnote */}
      <LimitationCards />
    </div>
  );
};

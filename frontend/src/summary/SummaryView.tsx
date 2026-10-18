import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  BacktestResponse,
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

interface Props {
  onOpenScenarios: () => void;
  onOpenTickets: () => void;
}

export const SummaryView: React.FC<Props> = ({ onOpenScenarios, onOpenTickets }) => {
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [loadingBacktest, setLoadingBacktest] = useState(true);
  const [errorBacktest, setErrorBacktest] = useState<string | null>(null);

  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

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
    runScenario();
  }, [fetchBacktest, fetchTickets, runScenario]);

  // Handle refresh
  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchBacktest(), fetchTickets(), runScenario()]);
    setRefreshing(false);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setLastUpdated(`${hh}:${mm}`);
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

  // Strictly extract real numbers with ZERO hard-coded fallbacks
  const allDeployed = backtest?.summary?.all?.deployed?.precision_at_100?.median;
  const allRule = backtest?.summary?.all?.persistence?.precision_at_100?.median;
  const allPilot = backtest?.summary?.all?.lgbm_weekly?.precision_at_100?.median;

  const calmDeployed = backtest?.summary?.new_incidents?.deployed?.precision_at_100?.median;
  const calmPilot = backtest?.summary?.new_incidents?.lgbm_weekly?.precision_at_100?.median;
  const calmRule = backtest?.summary?.new_incidents?.persistence?.precision_at_100?.median;

  const naiveAlerts = scenarioData?.comparison?.naive?.alerts_total;
  const fastAlerts = scenarioData?.comparison?.fast?.alerts_total;
  const fastIncidents = scenarioData?.comparison?.fast?.incidents;

  const deployedVal = typeof allDeployed === 'number' ? Math.round(allDeployed * 100) : null;
  const ruleVal = typeof allRule === 'number' ? Math.round(allRule * 100) : null;
  const lgbmVal = typeof allPilot === 'number' ? Math.round(allPilot * 100) : null;

  const lgbmCalmVal = typeof calmPilot === 'number' ? Math.round(calmPilot * 100) : null;
  const ruleCalmVal = typeof calmRule === 'number' ? Math.round(calmRule * 100) : null;

  const naiveVal = typeof naiveAlerts === 'number' ? naiveAlerts : null;
  const fastVal = typeof fastAlerts === 'number' ? fastAlerts : null;
  const fastIncidentsVal = typeof fastIncidents === 'number' ? fastIncidents : null;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 max-w-[1240px] mx-auto pb-12 min-w-0 w-full overflow-x-hidden">
      {/* 1. Header & Verdict Sentence (from real numbers, no fallbacks) */}
      <VerdictHeader
        deployed={deployedVal}
        rule={ruleVal}
        lgbm={lgbmVal}
        lgbmCalm={lgbmCalmVal}
        ruleCalm={ruleCalmVal}
        naive={naiveVal}
        fast={fastVal}
        fastIncidents={fastIncidentsVal}
        loading={loadingBacktest || loadingScenario}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onRefresh={handleRefreshAll}
      />

      {/* 2. Three Action Tiles: Срочно / Без бригады / Бригады в деле */}
      <ActionTiles
        tickets={tickets}
        loading={loadingTickets}
        onOpenTickets={onOpenTickets}
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

      {/* 8. Limitations: 3 Cards with Icons instead of a footnote */}
      <LimitationCards />
    </div>
  );
};

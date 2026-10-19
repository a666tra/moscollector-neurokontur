import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FlaskConical,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  ScenarioCatalogResponse,
  ScenarioRunResponse,
  ObjectItem,
} from '../types';
import { api } from '../lib/api';
import { RiskMap, MapPin, MOSCOW } from '../situation/RiskMap';
import { ScenarioChooser } from './ScenarioChooser';
import { PeriodSwitch } from './PeriodSwitch';
import { ScenarioPlayerPanel } from './ScenarioPlayerPanel';
import { ScenarioMiniDock } from './ScenarioMiniDock';
import { ScenarioTimelineLanes } from './ScenarioTimelineLanes';
import { ScenarioExampleCard } from './ScenarioExampleCard';
import { ScenarioMetricsFooter } from './ScenarioMetricsFooter';
import { ScenarioSeriesDetail } from './ScenarioSeriesDetail';
import { incidentInScenario } from './scenarioLabels';

interface ScenarioLabProps {
  objects?: ObjectItem[];
}

export const ScenarioLab: React.FC<ScenarioLabProps> = ({ objects: initialObjects }) => {
  const [objects, setObjects] = useState<ObjectItem[]>(initialObjects || []);
  const [catalog, setCatalog] = useState<ScenarioCatalogResponse | null>(null);
  const [result, setResult] = useState<ScenarioRunResponse | null>(null);

  const [mode, setMode] = useState<'day' | 'month'>('day');
  const [seed, setSeed] = useState<number>(42);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('all');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Time playback state: minutes in [0, 1440] for day, [0, 30] for month
  const [currentMinute, setCurrentMinute] = useState<number>(720); // Default 12:00
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isInitialPreview, setIsInitialPreview] = useState<boolean>(true);
  const [dockVisible, setDockVisible] = useState<boolean>(false);

  // Ref to track latest request ID and avoid out-of-order responses
  const requestIdRef = useRef<number>(0);
  // Ref to track if we should auto-play once data arrives (e.g. from "Другая смена")
  const autoPlayOnLoadRef = useRef<boolean>(false);

  // Detail modal for channel telemetry series
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // 1. Fetch objects if not provided
  useEffect(() => {
    if (objects.length === 0) {
      api<{ items?: ObjectItem[] } | ObjectItem[]>('/api/objects')
        .then((res) => {
          const list = Array.isArray(res) ? res : res.items || [];
          setObjects(list);
        })
        .catch((err) => console.error('Failed to load objects for scenario map:', err));
    }
  }, [objects.length]);

  // 2. Fetch catalog on mount
  useEffect(() => {
    api<ScenarioCatalogResponse>('/api/scenarios/catalog')
      .then((res) => setCatalog(res))
      .catch((err) => console.error('Failed to load scenario catalog:', err));
  }, []);

  // 3. Run scenario simulation
  const runSimulation = useCallback(
    async (m: 'day' | 'month', s: number) => {
      const reqId = ++requestIdRef.current;
      setResult(null);
      setLoading(true);
      setError(null);

      try {
        const res = await api<ScenarioRunResponse>('/api/scenarios/run', {
          method: 'POST',
          json: { mode: m, seed: s },
        });
        if (reqId !== requestIdRef.current) return;
        setResult(res);
        if (autoPlayOnLoadRef.current) {
          autoPlayOnLoadRef.current = false;
          setIsInitialPreview(false);
          setCurrentMinute(0);
          setIsPlaying(true);
        }
      } catch (err: any) {
        if (reqId !== requestIdRef.current) return;
        console.error('Scenario run error:', err);
        const msg = err.message || 'Ошибка симуляции сценариев';
        setError(msg);
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Initial run on mount
  useEffect(() => {
    runSimulation(mode, seed);
  }, [mode, seed, runSimulation]);

  const handleRetry = useCallback(() => {
    runSimulation(mode, seed);
  }, [mode, seed, runSimulation]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;

    const maxMinutes = mode === 'month' ? 30 : 1440;
    const interval = setInterval(() => {
      setCurrentMinute((prev) => {
        const step = mode === 'month' ? 0.25 : 3.5;
        const next = prev + step;
        if (next >= maxMinutes) {
          setIsPlaying(false);
          return maxMinutes;
        }
        return next;
      });
    }, 60);

    return () => clearInterval(interval);
  }, [isPlaying, mode]);

  // Handle new seed
  const handleNewSeed = () => {
    if (loading) return;
    const nextSeed = (seed * 13 + 7) % 9973 + 1;
    autoPlayOnLoadRef.current = true;
    setIsPlaying(false);
    setIsInitialPreview(true);
    setCurrentMinute(0);
    setSeed(nextSeed);
  };

  // Handle mode toggle
  const handleModeChange = (newMode: 'day' | 'month') => {
    if (loading || newMode === mode) return;
    autoPlayOnLoadRef.current = false;
    setMode(newMode);
    setIsPlaying(false);
    setIsInitialPreview(true);
    setCurrentMinute(newMode === 'month' ? 15 : 720);
  };

  const handleTimeChange = (newMinute: number) => {
    if (loading) return;
    setIsInitialPreview(false);
    setCurrentMinute(newMinute);
  };

  const handleTogglePlay = useCallback(() => {
    if (loading) return;
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    const maxMinutes = mode === 'month' ? 30 : 1440;
    const isAtEnd = currentMinute >= maxMinutes;
    if (isAtEnd || isInitialPreview) {
      setIsInitialPreview(false);
      setCurrentMinute(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(true);
    }
  }, [loading, isPlaying, mode, currentMinute, isInitialPreview]);

  // Global space key handler for playback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (selectedChannelId) return;
      if (e.key === ' ') {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, selectedChannelId]);

  // Clock label formatting
  const clockLabel = useMemo(() => {
    if (mode === 'month') {
      const day = Math.max(1, Math.min(30, Math.ceil(currentMinute)));
      return `день ${day} из 30`;
    }
    const totalMinutes = Math.floor(currentMinute);
    if (totalMinutes >= 1440) {
      return '24:00';
    }
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }, [mode, currentMinute]);

  const clockMini = useMemo(() => {
    if (mode === 'month') {
      const day = Math.max(1, Math.min(30, Math.ceil(currentMinute)));
      return `день ${day}`;
    }
    const totalMinutes = Math.floor(currentMinute);
    if (totalMinutes >= 1440) {
      return '24:00';
    }
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }, [mode, currentMinute]);

  // Real incident timestamps in minutes for day scrubber ticks
  const incidentTimestamps = useMemo(() => {
    if (!result?.incident_list || mode === 'month') return [];
    return result.incident_list
      .filter((inc) => incidentInScenario(inc, selectedScenarioId))
      .map((inc) => inc.ts / 60);
  }, [result, mode, selectedScenarioId]);

  // Pins for RiskMap
  const pins: MapPin[] = useMemo(() => {
    if (!result?.incident_list || result.incident_list.length === 0) return [];
    if (loading || error) return [];

    if (mode === 'month') {
      // Month mode: show only alerts of the currently selected day, capped at 14 pins
      const selectedDay = Math.max(1, Math.min(30, Math.ceil(currentMinute)));
      const dayAlerts: typeof result.incident_list = [];

      for (const inc of result.incident_list) {
        if (!incidentInScenario(inc, selectedScenarioId)) continue;
        const alertDay = Math.floor(inc.ts / 86400) + 1;
        if (alertDay === selectedDay) {
          dayAlerts.push(inc);
        }
      }

      const capped = dayAlerts.slice(0, 14);

      return capped.map((inc) => ({
        objectId: inc.object_id,
        risk: 'CRITICAL',
        done: false,
        color: 'var(--rd)',
        tooltip: `Событие дня ${selectedDay}`,
      }));
    }

    // Day mode: warn/hit/done pins with lead and resolution conventions
    const m = currentMinute;
    const pinMap = new Map<string, { warn: boolean; hit: boolean; done: boolean }>();

    for (const inc of result.incident_list) {
      if (!incidentInScenario(inc, selectedScenarioId)) continue;

      const tMin = inc.ts / 60;
      const leadMin = 20; // 20 min early warning lead
      const resMin = 150; // 150 min resolution convention

      if (m < tMin - leadMin) continue;

      const isRes = m >= tMin + resMin;
      const isHit = !isRes && m >= tMin;
      const isWarn = !isRes && !isHit;

      const existing = pinMap.get(inc.object_id);
      if (!existing) {
        pinMap.set(inc.object_id, {
          warn: isWarn,
          hit: isHit,
          done: isRes,
        });
      } else {
        if (isHit) existing.hit = true;
        if (isWarn) existing.warn = true;
        if (isRes) existing.done = true;
      }
    }

    const outPins: MapPin[] = [];
    pinMap.forEach((val, objectId) => {
      const isHit = val.hit;
      const isWarn = !isHit && val.warn;
      const isDone = !isHit && !isWarn && val.done;

      const label = isHit ? 'идёт' : isWarn ? 'заранее' : 'решено';

      outPins.push({
        objectId,
        risk: isHit ? 'CRITICAL' : isWarn ? 'WARNING' : 'NORMAL',
        done: isDone,
        color: isDone ? 'var(--gn)' : isHit ? 'var(--rd)' : 'var(--ac)',
        label,
      });
    });

    return outPins;
  }, [result, mode, currentMinute, selectedScenarioId, loading, error]);

  // Counters for the map legend (day mode only)
  const { nWarn, nHit, nDone } = useMemo(() => {
    let warn = 0;
    let hit = 0;
    let done = 0;
    for (const p of pins) {
      if (p.label === 'решено' || p.done) done++;
      else if (p.label === 'идёт' || p.color === 'var(--rd)') hit++;
      else if (p.label === 'заранее' || p.color === 'var(--ac)') warn++;
    }
    return { nWarn: warn, nHit: hit, nDone: done };
  }, [pins]);

  // Live alert counters for the 3 approaches
  const totalFast = result?.comparison?.fast?.alerts_total ?? result?.summary?.alerts_total ?? 0;
  const totalStatic = result?.comparison?.static_dedup?.alerts_total ?? 0;
  const totalNaive = result?.comparison?.naive?.alerts_total ?? 0;

  const maxMinutes = mode === 'month' ? 30 : 1440;
  const isAtEnd = currentMinute >= maxMinutes - 0.001;

  const allIncidents = result?.incident_list || [];
  const incidentsPassed = allIncidents.filter((inc) => {
    const tMin = mode === 'month' ? inc.ts / 86400 : inc.ts / 60;
    return tMin <= currentMinute;
  }).length;
  const totalIncCount = Math.max(1, allIncidents.length);
  const incFraction = isAtEnd ? 1 : incidentsPassed / totalIncCount;

  const liveFast = isAtEnd ? totalFast : Math.min(totalFast, Math.round(totalFast * incFraction));
  const liveStatic = isAtEnd ? totalStatic : Math.min(totalStatic, Math.round(totalStatic * incFraction));
  const liveNaive = isAtEnd ? totalNaive : Math.min(totalNaive, Math.round(totalNaive * incFraction));

  // Example incident for breakdown card
  const exampleIncident = useMemo(() => {
    if (!result?.incident_list || result.incident_list.length === 0) return null;
    if (selectedScenarioId === 'all') {
      return result.incident_list[0];
    }
    const found = result.incident_list.find((inc) => incidentInScenario(inc, selectedScenarioId));
    return found || result.incident_list[0];
  }, [result, selectedScenarioId]);

  return (
    <div className="max-w-[1200px] mx-auto px-3.5 sm:px-8 py-5 sm:py-7 pb-24 sm:pb-16 flex flex-col gap-4 sm:gap-6">
      {/* 1. Header */}
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-x-3.5 gap-y-2.5 flex-wrap">
          <h1
            className="m-0 text-[30px] sm:text-[42px] leading-[1.05] tracking-[-0.02em] font-normal"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
          >
            Сценарный полигон
          </h1>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold"
            style={{ background: 'var(--ams)', color: 'var(--amt)' }}
          >
            <FlaskConical className="w-[15px] h-[15px] shrink-0" />
            <span>Синтетика</span>
          </span>
        </div>
        <p
          className="m-0 text-[13px] leading-[1.35] max-w-[620px]"
          style={{ color: 'var(--mu)', textWrap: 'pretty' }}
        >
          Проверка логики, часть преимущества — по построению теста
        </p>
      </header>

      {/* 2. Scenario Chooser */}
      <ScenarioChooser
        selectedId={selectedScenarioId}
        onSelect={(id) => {
          setSelectedScenarioId(id);
          setIsPlaying(false);
        }}
        activeSeed={seed}
        catalog={catalog}
      />

      {/* 3. Centered Period Switch */}
      <PeriodSwitch
        mode={mode}
        onChange={handleModeChange}
        disabled={loading}
      />

      {/* 4. Main Card: Map on top + Control Panel directly below */}
      <section
        className="rounded-[28px] overflow-hidden"
        style={{ background: 'var(--sf)', boxShadow: 'var(--sh)' }}
      >
        {/* Map Container */}
        <div
          className="relative h-[280px] sm:h-[430px]"
          style={{ background: 'var(--sf2)' }}
        >
          <RiskMap
            objects={objects}
            pins={pins}
            center={MOSCOW}
            zoom={11.4}
            interactive={!loading && !error}
            onPick={(objId) => {
              const inc = result?.incident_list?.find((i) => i.object_id === objId);
              if (inc?.channel_id) setSelectedChannelId(inc.channel_id);
            }}
          />

          {/* Loading / Error Cover */}
          {(loading || error) && (
            <div
              className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-3.5 p-5 text-center"
              style={{ background: 'var(--sf2)' }}
            >
              {error ? (
                <>
                  <span
                    className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--rds)', color: 'var(--rdt)' }}
                  >
                    <AlertTriangle className="w-7 h-7" />
                  </span>
                  <b
                    className="text-[22px] font-normal leading-tight"
                    style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
                  >
                    {mode === 'month' ? 'Не удалось посчитать месяц' : 'Не удалось посчитать'}
                  </b>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="min-h-[52px] rounded-full border-0 font-semibold text-[15px] px-[22px] pl-4 flex items-center gap-2 cursor-pointer transition-opacity active:opacity-90"
                    style={{ background: 'var(--ink)', color: 'var(--bg)' }}
                  >
                    <RefreshCw className="w-[19px] h-[19px]" />
                    <span>Повторить</span>
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="w-full max-w-[360px] flex flex-col gap-2.5"
                    style={{ animation: 'nkShim 1.3s ease-in-out infinite' }}
                  >
                    <i className="h-3.5 rounded-[7px] w-full block" style={{ background: 'var(--ln2)' }} />
                    <i className="h-3.5 rounded-[7px] w-[72%] block" style={{ background: 'var(--ln)' }} />
                    <i className="h-3.5 rounded-[7px] w-[88%] block" style={{ background: 'var(--ln)' }} />
                  </div>
                  <span
                    className="flex items-center gap-2.5 font-semibold text-[15px]"
                    style={{ color: 'var(--ink)' }}
                  >
                    <span className="grid animate-spin" style={{ color: 'var(--ac)' }}>
                      <RefreshCw className="w-5 h-5" />
                    </span>
                    <span>
                      {mode === 'month'
                        ? 'Считаю месяц — несколько секунд'
                        : 'Считаю смену…'}
                    </span>
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Player Panel directly under map */}
        <ScenarioPlayerPanel
          mode={mode}
          currentMinute={currentMinute}
          onTimeChange={handleTimeChange}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onNewSeed={handleNewSeed}
          loading={loading}
          error={error}
          incidentTimestamps={incidentTimestamps}
          liveFast={liveFast}
          liveStatic={liveStatic}
          liveNaive={liveNaive}
          nWarn={nWarn}
          nHit={nHit}
          nDone={nDone}
          clockLabel={clockLabel}
          onPanelVisibleChange={setDockVisible}
        />
      </section>

      {/* 5. Timeline Lanes */}
      <ScenarioTimelineLanes
        runResult={result}
        mode={mode}
        currentMinute={currentMinute}
        onTimeChange={handleTimeChange}
        selectedScenarioId={selectedScenarioId}
        loading={loading}
      />

      {/* 6. Example breakdown: "Что случилось" */}
      <ScenarioExampleCard
        incident={exampleIncident}
        comparison={result?.comparison}
        selectedScenarioId={selectedScenarioId}
      />

      {/* 7. Footer Metrics, Bars, and Comparison Table */}
      <ScenarioMetricsFooter
        runResult={result}
        catalog={catalog}
        selectedScenarioId={selectedScenarioId}
      />

      {/* 8. Detail modal for channel telemetry */}
      {selectedChannelId && (
        <ScenarioSeriesDetail
          channelId={selectedChannelId}
          mode={mode}
          seed={seed}
          onClose={() => setSelectedChannelId(null)}
        />
      )}

      {/* 9. Mobile Sticky Mini-Dock (OUTSIDE the card, last child of outermost page wrapper) */}
      <ScenarioMiniDock
        visible={dockVisible}
        locked={loading || !!error}
        isPlaying={isPlaying}
        isAtEnd={!isPlaying && currentMinute >= maxMinutes - 0.001}
        onTogglePlay={handleTogglePlay}
        playAriaLabel={isPlaying ? 'Пауза' : (!isPlaying && currentMinute >= maxMinutes - 0.001) ? 'Повторить смену' : 'Воспроизвести смену'}
        clockMini={clockMini}
        clockLabel={clockLabel}
        currentMinute={currentMinute}
        mode={mode}
        onTimeChange={handleTimeChange}
      />
    </div>
  );
};

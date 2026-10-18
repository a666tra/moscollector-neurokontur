import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FlaskConical,
  Bell,
  RefreshCw,
  Clock,
  Calendar,
  AlertCircle,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import {
  ScenarioCatalogResponse,
  ScenarioRunResponse,
  ObjectItem,
} from '../types';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { RiskMap, MapPin, MOSCOW } from '../situation/RiskMap';
import { ScenarioChooser } from './ScenarioChooser';
import { ScenarioTimelineLanes } from './ScenarioTimelineLanes';
import { ScenarioExampleCard } from './ScenarioExampleCard';
import { ScenarioMetricsFooter } from './ScenarioMetricsFooter';
import { ScenarioSeriesDetail } from './ScenarioSeriesDetail';

interface ScenarioLabProps {
  objects?: ObjectItem[];
}

export const ScenarioLab: React.FC<ScenarioLabProps> = ({ objects: initialObjects }) => {
  const toast = useToast();

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
      setLoading(true);
      setError(null);

      try {
        const res = await api<ScenarioRunResponse>('/api/scenarios/run', {
          method: 'POST',
          json: { mode: m, seed: s },
        });
        setResult(res);
      } catch (err: any) {
        console.error('Scenario run error:', err);
        const msg = err.message || 'Ошибка симуляции сценариев';
        setError(msg);
        toast(msg, 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Initial run on mount
  useEffect(() => {
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
    const nextSeed = (seed * 13 + 7) % 9973 + 1;
    setSeed(nextSeed);
    setIsPlaying(false);
    setCurrentMinute(0);
    toast(`Запущен прогон с новым номером смены #${nextSeed}`, 'info');
  };

  // Handle mode toggle
  const handleModeChange = (newMode: 'day' | 'month') => {
    setMode(newMode);
    setIsPlaying(false);
    setCurrentMinute(newMode === 'month' ? 15 : 720);
  };

  // Clock label formatting
  const clockLabel = useMemo(() => {
    if (mode === 'month') {
      const day = Math.max(1, Math.ceil(currentMinute));
      return `день ${day} из 30`;
    }
    const totalMinutes = Math.floor(currentMinute);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }, [mode, currentMinute]);

  // Pins for RiskMap
  const pins: MapPin[] = useMemo(() => {
    if (!result?.incident_list || result.incident_list.length === 0) return [];

    const isMonth = mode === 'month';
    const m = currentMinute;
    const pinMap = new Map<string, { warn: boolean; hit: boolean; done: boolean; pct: number }>();

    for (const inc of result.incident_list) {
      if (selectedScenarioId !== 'all') {
        const matches =
          (inc.matched_truth_event_id && inc.matched_truth_event_id.includes(selectedScenarioId.toLowerCase())) ||
          (selectedScenarioId === 'S1' && (inc.cls.startsWith('GAS') || inc.reason_ru.toLowerCase().includes('газ'))) ||
          (selectedScenarioId === 'S2' && (inc.cls.startsWith('GAS') || inc.reason_ru.toLowerCase().includes('скачок'))) ||
          (selectedScenarioId === 'S3' && inc.cls.startsWith('TEMP')) ||
          (selectedScenarioId === 'S4' && inc.cls === 'FIRE') ||
          (selectedScenarioId === 'S5' && inc.cls === 'FLOOD') ||
          (selectedScenarioId === 'S6' && inc.cls === 'CHATTER') ||
          (selectedScenarioId === 'S7' && inc.cls === 'COMM_LOSS') ||
          (selectedScenarioId === 'S8' && inc.cls === 'SETPOINT_CHATTER');
        if (!matches) continue;
      }

      const tMin = isMonth ? inc.ts / 86400 : inc.ts / 60;
      const leadMin = isMonth ? 0.2 : 20; // 20 min early warning lead
      const resMin = isMonth ? 2 : 150; // 150 min resolution convention from prototype

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
          pct: isHit ? 95 : isWarn ? 65 : 20,
        });
      } else {
        if (isHit) existing.hit = true;
        if (isWarn) existing.warn = true;
        if (isRes) existing.done = true;
        existing.pct = existing.hit ? 95 : existing.warn ? 65 : 20;
      }
    }

    const outPins: MapPin[] = [];
    pinMap.forEach((val, objectId) => {
      const isHit = val.hit;
      const isWarn = !isHit && val.warn;
      const isDone = !isHit && !isWarn && val.done;

      outPins.push({
        objectId,
        risk: isHit ? 'CRITICAL' : isWarn ? 'WARNING' : 'NORMAL',
        done: isDone,
        color: isDone ? 'var(--gn)' : isHit ? 'var(--rd)' : 'var(--ac)',
        pct: val.pct,
      });
    });

    return outPins;
  }, [result, mode, currentMinute, selectedScenarioId]);

  // Counters for the map legend
  const { nWarn, nHit, nDone } = useMemo(() => {
    let warn = 0;
    let hit = 0;
    let done = 0;
    for (const p of pins) {
      if (p.done) done++;
      else if (p.color === 'var(--rd)') hit++;
      else if (p.color === 'var(--ac)') warn++;
    }
    return { nWarn: warn, nHit: hit, nDone: done };
  }, [pins]);

  // Live alert counters for the 3 approaches
  const totalFast = result?.comparison?.fast?.alerts_total ?? (result?.summary?.alerts_total || 146);
  const totalStatic = result?.comparison?.static_dedup?.alerts_total ?? 535;
  const totalNaive = result?.comparison?.naive?.alerts_total ?? 1436;

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
    const found = result.incident_list.find((inc) => {
      if (inc.matched_truth_event_id && inc.matched_truth_event_id.includes(selectedScenarioId.toLowerCase())) {
        return true;
      }
      if (selectedScenarioId === 'S1' && (inc.cls.startsWith('GAS') || inc.reason_ru.toLowerCase().includes('газ'))) return true;
      if (selectedScenarioId === 'S2' && (inc.cls.startsWith('GAS') || inc.reason_ru.toLowerCase().includes('скачок'))) return true;
      if (selectedScenarioId === 'S3' && inc.cls.startsWith('TEMP')) return true;
      if (selectedScenarioId === 'S4' && inc.cls === 'FIRE') return true;
      if (selectedScenarioId === 'S5' && inc.cls === 'FLOOD') return true;
      if (selectedScenarioId === 'S6' && inc.cls === 'CHATTER') return true;
      if (selectedScenarioId === 'S7' && inc.cls === 'COMM_LOSS') return true;
      if (selectedScenarioId === 'S8' && inc.cls === 'SETPOINT_CHATTER') return true;
      return false;
    });
    return found || result.incident_list[0];
  }, [result, selectedScenarioId]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--ln2)]">
        <div>
          <h1
            className="text-3xl sm:text-5xl font-normal tracking-tight"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ink)' }}
          >
            Сценарный полигон
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--mu)' }}>
            Быстрый контур правил против простого порога на смоделированных авариях (S1–S8)
          </p>
        </div>

        {/* Visible Orange Disclaimer Badge */}
        <span
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs sm:text-[13px] self-start sm:self-center"
          style={{
            background: 'var(--ams)',
            color: 'var(--amt)',
            border: '1px solid var(--am)',
          }}
        >
          <FlaskConical className="w-4 h-4 shrink-0" />
          <span>Синтетика: проверка логики, часть преимущества — по построению теста</span>
        </span>
      </div>

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

      {/* 3. Map Section */}
      <section className="space-y-3">
        <div className="relative h-[340px] sm:h-[460px] rounded-2xl sm:rounded-3xl overflow-hidden border border-[var(--ln2)] shadow-md">
          <RiskMap
            objects={objects}
            pins={pins}
            center={MOSCOW}
            zoom={11.4}
            interactive={true}
            onPick={(objId) => {
              // Find incident on this object to view details
              const inc = result?.incident_list?.find((i) => i.object_id === objId);
              if (inc?.channel_id) setSelectedChannelId(inc.channel_id);
            }}
          />

          {/* Desktop Floating Overlay: Clock & Approach counters (Top Left) */}
          <div
            className="hidden md:flex absolute left-3 top-3 flex-col gap-2 p-3 sm:p-4 rounded-2xl shadow-lg z-[1000] border border-[var(--ln2)]"
            style={{ background: 'var(--sf)' }}
          >
            <span
              className="text-2xl sm:text-3xl font-semibold num"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink)' }}
            >
              {clockLabel}
            </span>

            <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--mu)]">
              <Bell className="w-3.5 h-3.5" />
              <span>звонков диспетчеру:</span>
            </span>

            <div className="space-y-1 text-xs sm:text-[13px]">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-[var(--ink)]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--ac)' }} />
                  <span>НейроКонтур:</span>
                </span>
                <b
                  className="font-normal text-lg sm:text-xl num"
                  style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ac)' }}
                >
                  {liveFast}
                </b>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-[var(--ink)]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'oklch(0.72 0.15 72)' }} />
                  <span>Статический:</span>
                </span>
                <b
                  className="font-normal text-lg sm:text-xl num"
                  style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'oklch(0.72 0.15 72)' }}
                >
                  {liveStatic}
                </b>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-[var(--ink)]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--rd)' }} />
                  <span>Простой:</span>
                </span>
                <b
                  className="font-normal text-lg sm:text-xl num"
                  style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--rd)' }}
                >
                  {liveNaive}
                </b>
              </div>
            </div>
          </div>

          {/* Desktop Floating Overlay: Legend (Top Right) */}
          <div
            className="hidden md:flex absolute right-3 top-3 flex-col gap-1.5 p-3 rounded-xl shadow-lg z-[1000] border border-[var(--ln2)] text-xs font-medium"
            style={{ background: 'var(--sf)' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--ac)' }} />
              <span>контур предупредил: <b>{nWarn}</b></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--rd)' }} />
              <span>событие идёт: <b>{nHit}</b></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--gn)' }} />
              <span>решено: <b>{nDone}</b></span>
            </div>
            <div className="text-[10.5px] text-[var(--mu)] pt-1 border-t border-[var(--ln)]">
              условно: событие считается закрытым через 150 мин
            </div>
          </div>
        </div>

        {/* Mobile Dedicated Board (Shown only on mobile below map) */}
        <div
          className="flex md:hidden flex-col gap-3 p-4 rounded-2xl border border-[var(--ln2)] bg-[var(--sf)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-2xl font-semibold num"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink)' }}
            >
              {clockLabel}
            </span>

            <div className="flex items-center gap-2.5 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ac)' }} />
                <span>{nWarn}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--rd)' }} />
                <span>{nHit}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--gn)' }} />
                <span>{nDone}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--ln)] text-center">
            <div>
              <div
                className="text-2xl font-normal num"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--ac)' }}
              >
                {liveFast}
              </div>
              <div className="text-[11px] text-[var(--mu)] font-medium">НейроКонтур</div>
            </div>

            <div>
              <div
                className="text-2xl font-normal num"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'oklch(0.72 0.15 72)' }}
              >
                {liveStatic}
              </div>
              <div className="text-[11px] text-[var(--mu)] font-medium">Статический</div>
            </div>

            <div>
              <div
                className="text-2xl font-normal num"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--rd)' }}
              >
                {liveNaive}
              </div>
              <div className="text-[11px] text-[var(--mu)] font-medium">Простой</div>
            </div>
          </div>

          <div className="text-[10px] text-[var(--mu)] text-center">
            условно: событие считается закрытым через 150 мин
          </div>
        </div>
      </section>

      {/* 4. Timeline Lanes & Playback Controls */}
      <ScenarioTimelineLanes
        runResult={result}
        mode={mode}
        onModeChange={handleModeChange}
        currentMinute={currentMinute}
        onTimeChange={setCurrentMinute}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onNewSeed={handleNewSeed}
        selectedScenarioId={selectedScenarioId}
      />

      {/* 5. Example breakdown: "Что случилось" */}
      <ScenarioExampleCard
        incident={exampleIncident}
        comparison={result?.comparison}
        selectedScenarioId={selectedScenarioId}
      />

      {/* 6. Footer Metrics, Bars, and Comparison Table */}
      <ScenarioMetricsFooter
        runResult={result}
        catalog={catalog}
        selectedScenarioId={selectedScenarioId}
      />

      {/* 7. Detail modal for channel telemetry (from /api/scenarios/series) */}
      {selectedChannelId && (
        <ScenarioSeriesDetail
          channelId={selectedChannelId}
          mode={mode}
          seed={seed}
          onClose={() => setSelectedChannelId(null)}
        />
      )}
    </div>
  );
};

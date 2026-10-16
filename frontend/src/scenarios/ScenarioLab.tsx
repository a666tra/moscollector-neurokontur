import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Database,
  Sliders,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ScenarioCatalogResponse,
  ScenarioRunResponse,
} from '../types';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { ScenarioControls } from './ScenarioControls';
import { ScenarioSummaryCards } from './ScenarioSummaryCards';
import { ScenarioComparisonTable } from './ScenarioComparisonTable';
import { ScenarioIncidentTimeline } from './ScenarioIncidentTimeline';
import { ScenarioSeriesDetail } from './ScenarioSeriesDetail';

export const ScenarioLab: React.FC = () => {
  const toast = useToast();

  const [mode, setMode] = useState<'day' | 'month'>('day');
  const [seedInput, setSeedInput] = useState<string>('42');
  const [activeSeed, setActiveSeed] = useState<number>(42);

  const [catalog, setCatalog] = useState<ScenarioCatalogResponse | null>(null);
  const [result, setResult] = useState<ScenarioRunResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Validate seed
  const parsedSeed = parseInt(seedInput, 10);
  const isValidSeed = !isNaN(parsedSeed) && parsedSeed >= 0 && parsedSeed <= 10000;

  // Load catalog on mount
  useEffect(() => {
    api<ScenarioCatalogResponse>('/api/scenarios/catalog')
      .then(res => setCatalog(res))
      .catch(err => {
        console.error('Failed to load scenario catalog:', err);
      });
  }, []);

  const handleRun = useCallback(async () => {
    if (!isValidSeed) {
      toast('Укажите корректный seed (число от 0 до 10 000)', 'error');
      return;
    }

    setLoading(true);
    setError(null);
    setActiveSeed(parsedSeed);
    setProgressText(
      mode === 'month'
        ? 'Генерация 30 суток телеметрии и прогон детекторов… ~3 с'
        : 'Моделирование 24 часов и оценка… ~0.5 с'
    );

    try {
      const res = await api<ScenarioRunResponse>('/api/scenarios/run', {
        method: 'POST',
        json: { mode, seed: parsedSeed },
      });
      setResult(res);
      toast(
        `Сценарии успешно рассчитаны за ${res.elapsed_seconds.toFixed(2)} с (${res.incident_list.length} инцидентов)`,
        'success'
      );
    } catch (err: any) {
      console.error('Scenario run error:', err);
      const msg = err.message || 'Ошибка симуляции сценариев';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
      setProgressText(null);
    }
  }, [mode, isValidSeed, parsedSeed, toast]);

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--ln)' }}>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
              <FlaskConical className="w-6 h-6" style={{ color: 'var(--ac)' }} />
              <span>Сценарный полигон</span>
            </h1>

            {/* Permanent Badge */}
            <span
              className="chip text-[11px] sm:text-xs font-semibold py-1 px-3 h-auto"
              style={{
                background: 'var(--acs)',
                color: 'var(--ac)',
                border: '1px solid var(--ac)',
              }}
            >
              Синтетические данные · seed {activeSeed} · проверка логики, не оценка на реальных авариях
            </span>
          </div>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--mut)' }}>
            Сравнение двухслойного детектора с классическим порогом на калиброванных аварийных ситуациях (S1–S7)
          </p>
        </div>
      </div>

      {/* 2. Controls */}
      <ScenarioControls
        mode={mode}
        onModeChange={setMode}
        seedInput={seedInput}
        onSeedInputChange={setSeedInput}
        isValidSeed={isValidSeed}
        onRun={handleRun}
        loading={loading}
        progressText={progressText}
        elapsedSeconds={result?.elapsed_seconds}
      />

      {/* Error Banner */}
      {error && !loading && (
        <div
          className="panel p-4 sm:p-5 flex items-center justify-between gap-3"
          style={{ background: 'var(--crs)', color: 'var(--cr)', borderColor: 'var(--cr)' }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRun}
            className="btn btn-secondary h-8 px-3 text-xs font-semibold"
          >
            Повторить
          </button>
        </div>
      )}

      {/* State 1: Nothing run yet */}
      {!result && !loading && !error && (
        <div className="panel p-8 sm:p-12 flex flex-col items-center text-center max-w-2xl mx-auto gap-4 rise">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--acs)', color: 'var(--ac)' }}
          >
            <FlaskConical className="w-7 h-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg sm:text-xl font-bold">Симуляция ещё не запускалась</h2>
            <p className="text-xs sm:text-sm leading-relaxed max-w-md" style={{ color: 'var(--mut)' }}>
              Выберите горизонт моделирования («Сутки» или «30 суток»), при необходимости измените зерно генератора (seed) и нажмите кнопку «Прогнать».
            </p>
          </div>
          <button
            type="button"
            onClick={handleRun}
            className="btn btn-primary h-11 px-6 text-sm font-semibold flex items-center gap-2 mt-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Прогнать симуляцию</span>
          </button>
        </div>
      )}

      {/* Results View when run completed */}
      {result && (
        <>
          {/* 3. Result KPI Cards */}
          <ScenarioSummaryCards data={result} />

          {/* 4. Comparison Table S1..S7 */}
          <ScenarioComparisonTable
            comparison={result.comparison}
            scenariosMeta={catalog?.scenarios}
          />

          {/* 5. Incident Timeline */}
          <ScenarioIncidentTimeline
            incidents={result.incident_list}
            mode={result.mode}
            onSelectChannel={chanId => setSelectedChannelId(chanId)}
            selectedChannelId={selectedChannelId}
          />
        </>
      )}

      {/* 6. Channel Series Detail Modal / Drawer */}
      {selectedChannelId && (
        <ScenarioSeriesDetail
          channelId={selectedChannelId}
          mode={result ? result.mode : mode}
          seed={activeSeed}
          onClose={() => setSelectedChannelId(null)}
        />
      )}
    </div>
  );
};

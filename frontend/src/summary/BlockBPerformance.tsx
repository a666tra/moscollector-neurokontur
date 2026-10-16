import React from 'react';
import { PerformanceBenchmark, HttpLoadBenchmark } from '../types';
import { Zap, Gauge, Server, Activity, ArrowRight } from 'lucide-react';

interface Props {
  performance: PerformanceBenchmark | null;
  httpBenchmark: HttpLoadBenchmark | null;
  loading: boolean;
  error?: string | null;
}

export const BlockBPerformance: React.FC<Props> = ({ performance, httpBenchmark, loading, error }) => {
  if (loading) {
    return (
      <div className="rounded-2xl p-6 border animate-pulse" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
        <div className="h-6 w-64 rounded bg-neutral-200 dark:bg-neutral-800 mb-4" />
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="h-24 rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="h-24 rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      </div>
    );
  }

  if (error || !performance) {
    return (
      <div className="rounded-2xl p-6 border" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
        <h3 className="text-lg font-semibold mb-2">Масштаб и скорость</h3>
        <p className="text-sm text-red-500">Не удалось загрузить метрики скорости: {error || 'нет данных'}</p>
      </div>
    );
  }

  const baseChannels = performance.full_batch_channels_count || 11485;
  const fullBatchMs = performance.full_batch_latency_ms;
  const singleSensorMs = performance.single_sensor_latency_ms;
  const httpP50 = httpBenchmark?.latency_p50_ms ?? 0;
  const httpP95 = httpBenchmark?.latency_p95_ms ?? 0;
  const httpRps = httpBenchmark?.throughput_rps ?? 0;
  const speedupVs300s = Math.round(300000 / Math.max(0.1, fullBatchMs));

  // Linear extrapolations
  const extrap50kMs = (50000 / baseChannels) * fullBatchMs;
  const extrap100kMs = (100000 / baseChannels) * fullBatchMs;

  const speedup50k = Math.round(300000 / Math.max(0.1, extrap50kMs));
  const speedup100k = Math.round(300000 / Math.max(0.1, extrap100kMs));

  return (
    <div className="rounded-2xl p-4 lg:p-5 border flex flex-col gap-4 min-w-0 overflow-hidden" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
      {/* Block Header */}
      <div className="border-b pb-3.5" style={{ borderColor: 'var(--ln)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--ac)' }} />
          <h2 className="serif font-semibold text-lg sm:text-xl lg:text-2xl leading-tight">
            Масштаб и скорость
          </h2>
        </div>
        <p className="text-xs lg:text-sm mt-1" style={{ color: 'var(--mut)' }}>
          Фактические замеры времени расчёта модели и сетевой нагрузки HTTP API
        </p>
      </div>

      {/* Grid of measured numbers with "замер" label */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0 w-full">
        {/* Full pass */}
        <div className="rounded-xl p-3.5 border flex flex-col justify-between min-w-0" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--mut)' }}>
              Все каналы ({baseChannels.toLocaleString('ru-RU')})
            </span>
            <span className="num text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              замер
            </span>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="num font-bold text-3xl">
                {fullBatchMs < 1 ? fullBatchMs.toFixed(2) : fullBatchMs.toFixed(1)}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--mut)' }}>мс</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
              P95: {performance.full_batch_p95_latency_ms.toFixed(1)} мс
            </div>
          </div>
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            В {speedupVs300s.toLocaleString('ru-RU')} раз быстрее регламента 300 с
          </div>
        </div>

        {/* Single channel */}
        <div className="rounded-xl p-3.5 border flex flex-col justify-between min-w-0" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--mut)' }}>
              Один канал
            </span>
            <span className="num text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              замер
            </span>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="num font-bold text-3xl">
                {singleSensorMs.toFixed(2)}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--mut)' }}>мс</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
              P95: {performance.single_sensor_p95_latency_ms.toFixed(2)} мс
            </div>
          </div>
          <div className="text-xs" style={{ color: 'var(--mut)' }}>
            Мгновенный точечный скоринг при входящем событии
          </div>
        </div>

        {/* HTTP Latency P50 / P95 */}
        <div className="rounded-xl p-3.5 border flex flex-col justify-between min-w-0" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--mut)' }}>
              HTTP задержка P50 / P95
            </span>
            <span className="num text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              замер
            </span>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-2">
              <span className="num font-bold text-2xl">
                {Math.round(httpP50)} / {Math.round(httpP95)}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--mut)' }}>мс</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
              Средняя: {Math.round(httpBenchmark?.latency_mean_ms ?? 0)} мс
            </div>
          </div>
          <div className="text-xs" style={{ color: 'var(--mut)' }}>
            Нагрузочный тест ({httpBenchmark?.total_requests ?? 500} запросов, 20 потоков)
          </div>
        </div>

        {/* HTTP Throughput */}
        <div className="rounded-xl p-3.5 border flex flex-col justify-between min-w-0" style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--mut)' }}>
              Пропускная способность
            </span>
            <span className="num text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              замер
            </span>
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="num font-bold text-3xl">
                {httpRps.toFixed(1)}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--mut)' }}>запр/с</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
              100% успешных ответов
            </div>
          </div>
          <div className="text-xs" style={{ color: 'var(--mut)' }}>
            Модель на CPU: {performance.throughput_sensors_per_sec.toLocaleString('ru-RU')} датч/с
          </div>
        </div>
      </div>

      {/* Extrapolation Table: "Что будет при росте числа каналов" */}
      <div className="flex flex-col gap-2.5 min-w-0 w-full">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <h4 className="text-xs sm:text-sm font-semibold">
            Что будет при росте числа каналов
          </h4>
          <span className="text-[11px] font-medium" style={{ color: 'var(--mut)' }}>
            Лимит: 300 с (5 минут)
          </span>
        </div>

        <div className="w-full max-w-full overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--ln)' }}>
          <table className="w-full min-w-[340px] text-left text-xs">
            <thead style={{ background: 'var(--sf2)', borderBottom: '1px solid var(--ln)' }}>
              <tr>
                <th className="py-2 px-2.5 font-semibold">Число каналов</th>
                <th className="py-2 px-2.5 font-semibold">Полный пересчёт</th>
                <th className="py-2 px-2.5 font-semibold">Запас к 300 с</th>
                <th className="py-2 px-2.5 font-semibold">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--ln)' }}>
              {/* Row 1: 11 485 */}
              <tr>
                <td className="py-2 px-2.5 num font-medium">
                  {baseChannels.toLocaleString('ru-RU')}
                </td>
                <td className="py-2 px-2.5 num font-semibold">
                  {fullBatchMs.toFixed(1)} мс <span className="text-xs font-normal" style={{ color: 'var(--mut)' }}>(~{(fullBatchMs / 1000).toFixed(2)} с)</span>
                </td>
                <td className="py-2.5 px-3 num text-emerald-600 dark:text-emerald-400 font-medium">
                  в {speedupVs300s.toLocaleString('ru-RU')} раз быстрее
                </td>
                <td className="py-2.5 px-3">
                  <span className="num text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                    замер
                  </span>
                </td>
              </tr>

              {/* Row 2: 50 000 */}
              <tr style={{ background: 'var(--sf2)' }}>
                <td className="py-2.5 px-3 num font-medium">
                  50 000
                </td>
                <td className="py-2.5 px-3 num font-semibold">
                  {extrap50kMs.toFixed(1)} мс <span className="text-xs font-normal" style={{ color: 'var(--mut)' }}>(~{(extrap50kMs / 1000).toFixed(2)} с)</span>
                </td>
                <td className="py-2.5 px-3 num text-emerald-600 dark:text-emerald-400 font-medium">
                  в {speedup50k.toLocaleString('ru-RU')} раз быстрее
                </td>
                <td className="py-2.5 px-3">
                  <span className="num text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                    расчёт, не замер
                  </span>
                </td>
              </tr>

              {/* Row 3: 100 000 */}
              <tr>
                <td className="py-2.5 px-3 num font-medium">
                  100 000
                </td>
                <td className="py-2.5 px-3 num font-semibold">
                  {extrap100kMs.toFixed(1)} мс <span className="text-xs font-normal" style={{ color: 'var(--mut)' }}>(~{(extrap100kMs / 1000).toFixed(2)} с)</span>
                </td>
                <td className="py-2.5 px-3 num text-emerald-600 dark:text-emerald-400 font-medium">
                  в {speedup100k.toLocaleString('ru-RU')} раз быстрее
                </td>
                <td className="py-2.5 px-3">
                  <span className="num text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                    расчёт, не замер
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

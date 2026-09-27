import React, { useState, useEffect } from 'react';
import { ArrowRight, BarChart2, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { SystemStats } from '../types';

interface HeroCoverProps {
  stats?: SystemStats | null;
  onEnter: () => void;
  onOpenMetrics?: () => void;
}

export const HeroCover: React.FC<HeroCoverProps> = ({ onEnter, onOpenMetrics }) => {
  const [backtest, setBacktest] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [showBoundaries, setShowBoundaries] = useState<boolean>(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/predictions/backtest').then(r => r.ok ? r.json() : null),
      fetch('/api/predictions/metrics').then(r => r.ok ? r.json() : null)
    ]).then(([backtestData, metricsData]) => {
      if (backtestData) setBacktest(backtestData);
      if (metricsData) setMetrics(metricsData);
    }).catch(e => {
      console.error('Failed to load hero metrics', e);
    });
  }, []);

  const channelsCount = backtest?.channels ? Number(backtest.channels).toLocaleString('ru-RU') : '11 485';
  const testWeeks = backtest?.test_weeks ?? 21;

  // lgbm_weekly.roc_auc, 2 decimals, comma
  const rocRaw = backtest?.summary?.all?.lgbm_weekly?.roc_auc?.median;
  const rocFormatted = typeof rocRaw === 'number' ? rocRaw.toFixed(2).replace('.', ',') : '0,84';

  // precision at 100 & prevalence ratio
  const p100Raw = backtest?.summary?.all?.lgbm_weekly?.precision_at_100?.median;
  const p100Pct = typeof p100Raw === 'number' ? Math.round(p100Raw * 100) : 38;
  const prevRaw = backtest?.summary?.all?.prevalence?.median;
  const ratioX = (typeof p100Raw === 'number' && typeof prevRaw === 'number' && prevRaw > 0)
    ? Math.round(p100Raw / prevRaw)
    : 29;

  // latency ms & SLA
  const msRaw = metrics?.performance_benchmark?.full_batch_latency_ms;
  const msFormatted = typeof msRaw === 'number' ? msRaw.toFixed(2).replace('.', ',') : '62,86';
  const slaSec = metrics?.performance_benchmark?.tz_sla_seconds
    ? Math.round(metrics.performance_benchmark.tz_sla_seconds)
    : 300;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#E7EAF0] flex flex-col justify-between px-4 py-5 sm:p-8 md:p-12 max-w-6xl mx-auto w-full box-border overflow-x-hidden">
      {/* Top Header */}
      <header className="flex justify-between items-center border-b border-white/10 pb-4 w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#7C4DFF]/15 border border-[#7C4DFF]/30 flex items-center justify-center shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7C4DFF]"></span>
          </div>
          <div>
            <div className="text-sm font-semibold text-[#E7EAF0] leading-tight">
              Москоллектор · НейроКонтур
            </div>
            <div className="text-xs text-[#9AA3B2] leading-tight">
              Прогноз инцидентов коллекторов
            </div>
          </div>
        </div>

        <div className="hidden sm:block text-xs text-[#9AA3B2] border border-white/10 rounded-lg px-3 py-1.5 bg-[#121620] shrink-0">
          ЛЦТ 2026 · Задача 8
        </div>
      </header>

      {/* Main Content */}
      <main className="my-auto py-6 sm:py-10 space-y-6 sm:space-y-8 w-full">
        <div className="max-w-3xl space-y-3.5 sm:space-y-5">
          {/* Eyebrow */}
          <div className="text-xs font-medium text-[#7C4DFF]">
            ЛЦТ 2026 · Задача 8 · АО «Москоллектор»
          </div>

          {/* H1 */}
          <h1 className="text-lg sm:text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight text-[#E7EAF0] leading-snug">
            Прогноз инцидентов в коллекторах за 24–72 часа
          </h1>

          {/* Lead */}
          <p className="text-xs sm:text-base md:text-lg text-[#9AA3B2] leading-relaxed">
            НейроКонтур каждый день ранжирует {channelsCount} каналов СМВУ по риску инцидента, объясняет причину и готовит черновик заявки на ТО. Решение всегда остаётся за диспетчером.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onEnter}
              className="px-5 py-2.5 bg-[#7C4DFF] hover:bg-[#9170FF] text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Открыть пульт диспетчера</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenMetrics || onEnter}
              className="px-5 py-2.5 bg-transparent hover:bg-white/5 text-[#E7EAF0] border border-white/10 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <BarChart2 className="w-4 h-4 text-[#7C4DFF]" />
              <span>Как мы проверяли модель</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
          {/* Card 1 */}
          <div className="eng-panel p-4 sm:p-5 flex flex-col justify-between">
            <div className="text-xs text-[#9AA3B2]">Проверка на реальном журнале</div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#E7EAF0] my-1.5">
              {testWeeks} недель
            </div>
            <div className="text-xs text-[#6B7385]">
              проверки на реальном журнале 2026 г.
            </div>
          </div>

          {/* Card 2 */}
          <div className="eng-panel p-4 sm:p-5 flex flex-col justify-between">
            <div className="text-xs text-[#9AA3B2]">Ранжирование каналов</div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#7C4DFF] my-1.5">
              {rocFormatted}
            </div>
            <div className="text-xs text-[#6B7385]">
              ROC-AUC, медиана по неделям
            </div>
          </div>

          {/* Card 3 */}
          <div className="eng-panel p-4 sm:p-5 flex flex-col justify-between">
            <div className="text-xs text-[#9AA3B2]">Сфокусированный список</div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#2FBF71] my-1.5">
              {p100Pct} %
            </div>
            <div className="text-xs text-[#6B7385]">
              точность списка топ-100 (≈{ratioX}× к случайному)
            </div>
          </div>

          {/* Card 4 */}
          <div className="eng-panel p-4 sm:p-5 flex flex-col justify-between">
            <div className="text-xs text-[#9AA3B2]">Быстродействие C-ядра</div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#E7EAF0] my-1.5">
              {msFormatted} мс
            </div>
            <div className="text-xs text-[#6B7385]">
              пересчёт всех каналов (норматив ТЗ — {slaSec} с)
            </div>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-xs text-[#9AA3B2] max-w-4xl leading-relaxed">
          Метрики посчитаны по событиям журнала СМВУ (неисправности, сбои связи, опасные показания газа и температуры), а не по актам ремонтов — их в данных нет. Методика — во вкладке «Проверка модели».
        </p>

        {/* Collapsible "Границы прототипа" block */}
        <div className="bg-[#121620] border border-white/10 rounded-xl overflow-hidden max-w-4xl">
          <button
            type="button"
            onClick={() => setShowBoundaries(!showBoundaries)}
            className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left text-xs font-medium text-[#9AA3B2] hover:text-[#E7EAF0] hover:bg-white/5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#7C4DFF] shrink-0" />
              <span className="text-[#E7EAF0] font-semibold text-sm">Границы прототипа</span>
              <span className="text-[11px] text-[#6B7385] hidden md:inline">— ключевые рамки и допущения инженерного решения</span>
            </div>
            {showBoundaries ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
          </button>

          {showBoundaries && (
            <div className="px-4 sm:px-5 pb-5 pt-1 text-xs text-[#9AA3B2] space-y-2 border-t border-white/5 bg-[#0B0E14]">
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
      </main>

      {/* Footer */}
      <footer className="flex flex-col sm:flex-row justify-between items-center text-xs text-[#6B7385] border-t border-white/10 pt-4 gap-2 text-center sm:text-left">
        <div>
          Модель LightGBM · 21 недельный срез проверки · 11 485 каналов СМВУ
        </div>
        <div>
          АО «Москоллектор» · Комплекс городского хозяйства Москвы
        </div>
      </footer>
    </div>
  );
};

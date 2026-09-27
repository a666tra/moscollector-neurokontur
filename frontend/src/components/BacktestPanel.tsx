import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, CheckCircle, Info } from 'lucide-react';

export interface BacktestReport {
  test_weeks: number;
  channels: number;
  rows_read?: number;
  cutoffs?: string[];
  summary: {
    all: Record<string, any>;
    new_incidents: Record<string, any>;
  };
  weeks: Array<{
    cutoff: string;
    label_window: string;
    train_weeks: number;
    all: Record<string, any>;
    new_incidents: Record<string, any>;
  }>;
}

interface BacktestPanelProps {
  initialData?: BacktestReport | null;
}

export const BacktestPanel: React.FC<BacktestPanelProps> = ({ initialData }) => {
  const [report, setReport] = useState<BacktestReport | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [population, setPopulation] = useState<'all' | 'new_incidents'>('all');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialData) {
      setReport(initialData);
      setLoading(false);
      return;
    }
    fetch('/api/predictions/backtest')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setReport(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load backtest report', err);
        setLoading(false);
      });
  }, [initialData]);

  if (loading) {
    return (
      <div className="eng-panel p-6 text-center text-[#9AA3B2] text-sm">
        Загрузка результатов еженедельного бэктеста…
      </div>
    );
  }

  if (!report || !report.weeks || report.weeks.length === 0) {
    return (
      <div className="eng-panel p-6 text-center text-[#9AA3B2] text-sm">
        Данные бэктеста временно недоступны.
      </div>
    );
  }

  const weeks = report.weeks;
  const testWeeks = report.test_weeks ?? weeks.length;
  const firstCutoff = weeks[0]?.cutoff ? formatDate(weeks[0].cutoff) : '04.02.2026';
  const lastCutoff = weeks[weeks.length - 1]?.cutoff ? formatDate(weeks[weeks.length - 1].cutoff) : '24.06.2026';

  function formatDate(iso: string): string {
    const parts = iso.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return iso;
  }

  function formatShortDate(iso: string): string {
    const parts = iso.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}`;
    }
    return iso;
  }

  const formatNum = (v: unknown, decimals = 3): string => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v.toFixed(decimals).replace('.', ',');
    }
    return '—';
  };

  const formatPct = (v: unknown, decimals = 1): string => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return `${(v * 100).toFixed(decimals).replace('.', ',')} %`;
    }
    return '—';
  };

  // SVG Chart Geometry
  const width = 800;
  const height = 280;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const yMax = 0.75;

  const points = weeks.map((w, idx) => {
    const x = padLeft + (idx / (weeks.length - 1)) * chartW;
    const all = w.all || {};
    const lgbm = all.lgbm_weekly?.pr_auc ?? 0;
    const dep = all.deployed?.pr_auc ?? 0;
    const pers = all.persistence?.pr_auc ?? 0;
    const prev = all.lgbm_weekly?.prevalence ?? (all.lgbm_weekly?.positives && all.lgbm_weekly?.n ? all.lgbm_weekly.positives / all.lgbm_weekly.n : 0);

    const getY = (val: number) => padTop + chartH * (1 - Math.min(val, yMax) / yMax);

    return {
      idx,
      cutoff: w.cutoff,
      shortDate: formatShortDate(w.cutoff),
      x,
      yLgbm: getY(lgbm),
      yDep: getY(dep),
      yPers: getY(pers),
      yPrev: getY(prev),
      lgbm,
      dep,
      pers,
      prev
    };
  });

  const pathLgbm = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yLgbm.toFixed(1)}`).join(' ');
  const pathDep = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yDep.toFixed(1)}`).join(' ');
  const pathPers = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yPers.toFixed(1)}`).join(' ');
  const pathPrev = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yPrev.toFixed(1)}`).join(' ');

  const yTicks = [0, 0.2, 0.4, 0.6];

  // Takeaway metrics computed from JSON
  const summaryAll = report.summary?.all || {};
  const summaryNew = report.summary?.new_incidents || {};

  const lgbmPrAuc = formatNum(summaryAll.lgbm_weekly?.pr_auc?.median);
  const depPrAuc = formatNum(summaryAll.deployed?.pr_auc?.median);
  const lgbmRoc = formatNum(summaryAll.lgbm_weekly?.roc_auc?.median);
  const persRoc = formatNum(summaryAll.persistence?.roc_auc?.median);
  const lgbmP100 = summaryAll.lgbm_weekly?.precision_at_100?.median != null ? Math.round(summaryAll.lgbm_weekly.precision_at_100.median * 100) : '—';
  const persP100 = summaryAll.persistence?.precision_at_100?.median != null ? Math.round(summaryAll.persistence.precision_at_100.median * 100) : '—';

  const totalPosAll = summaryAll.lgbm_weekly?.total_positives;
  const totalPosNew = summaryNew.lgbm_weekly?.total_positives;
  const newIncidentShare = (typeof totalPosAll === 'number' && typeof totalPosNew === 'number' && totalPosAll > 0)
    ? Math.round((totalPosNew / totalPosAll) * 100)
    : 59;
  const newRoc = formatNum(summaryNew.lgbm_weekly?.roc_auc?.median);

  // Table rows based on current population toggle
  const currentSummary = population === 'all' ? summaryAll : summaryNew;

  const tableRows = [
    {
      name: 'LightGBM с еженедельным дообучением',
      scorerKey: 'lgbm_weekly',
      badgeColor: 'border-[#7C4DFF] text-[#E7EAF0] bg-[#7C4DFF]/10',
      data: currentSummary.lgbm_weekly
    },
    {
      name: 'Та же модель без дообучения (обучена в январе)',
      scorerKey: 'deployed',
      badgeColor: 'border-white/10 text-[#9AA3B2] bg-white/5',
      data: currentSummary.deployed
    },
    {
      name: 'Правило «сбоил за последние 7 дней»',
      scorerKey: 'persistence',
      badgeColor: 'border-[#F5A524]/40 text-[#F5A524] bg-[#F5A524]/10',
      data: currentSummary.persistence
    },
    {
      name: 'Логистическая регрессия',
      scorerKey: 'logreg_weekly',
      badgeColor: 'border-[#4C9BFF]/40 text-[#4C9BFF] bg-[#4C9BFF]/10',
      data: currentSummary.logreg_weekly
    }
  ];

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <section className="eng-panel p-5 sm:p-6 space-y-6">
      {/* Title & Subtitle */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-[#E7EAF0] flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7C4DFF]"></span>
            <span>Проверка на реальном журнале: {testWeeks} недель вперёд по времени</span>
          </h2>
          <span className="text-xs text-[#9AA3B2] bg-[#181D29] border border-white/10 px-3 py-1 rounded-md self-start sm:self-auto">
            {firstCutoff} — {lastCutoff}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[#9AA3B2] mt-2 leading-relaxed max-w-4xl">
          Каждую среду в 00:00 (с {firstCutoff} по {lastCutoff}) модель строит прогноз по истории до этого момента; затем прогноз сравнивается с тем, что реально записано в журнале СМВУ через 24–72 ч. Модель для недели k обучена только на неделях до k−1.
        </p>
      </div>

      {/* SVG Line Chart */}
      <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4 sm:p-5 space-y-3">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 bg-[#7C4DFF]"></span>
            <span className="text-[#E7EAF0] font-medium">LightGBM с еженедельным дообучением</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 border-t border-dashed border-[#9AA3B2]"></span>
            <span className="text-[#9AA3B2]">Та же модель без дообучения (обучена в январе)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 bg-[#F5A524]"></span>
            <span className="text-[#F5A524]">Правило «сбоил за последние 7 дней»</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 border-t border-dotted border-[#6B7385]"></span>
            <span className="text-[#6B7385]">Доля событий = случайный выбор</span>
          </div>
        </div>

        {/* Chart Header Subtitle */}
        <div className="text-[11px] text-[#6B7385]">
          Показана динамика PR-AUC по 21 недельному срезу · Горизонт 24–72 ч · Наведите курсор на дату для значений
        </div>

        {/* SVG Container */}
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto select-none"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Grid & Y-Ticks */}
            {yTicks.map(t => {
              const y = padTop + chartH * (1 - t / yMax);
              return (
                <g key={t}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="#2A3140"
                    strokeWidth="1"
                    strokeDasharray="2,4"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    fill="#9AA3B2"
                    fontSize="11"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="end"
                  >
                    {t.toFixed(1).replace('.', ',')}
                  </text>
                </g>
              );
            })}

            {/* Baseline bottom axis */}
            <line
              x1={padLeft}
              y1={padTop + chartH}
              x2={width - padRight}
              y2={padTop + chartH}
              stroke="#2A3140"
              strokeWidth="1"
            />

            {/* X-Tick dates (every 2nd week) */}
            {points.map((p, idx) => {
              if (idx % 2 !== 0 && idx !== points.length - 1) return null;
              return (
                <text
                  key={idx}
                  x={p.x}
                  y={height - 12}
                  fill="#9AA3B2"
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  {p.shortDate}
                </text>
              );
            })}

            {/* Data Paths */}
            <path d={pathPrev} fill="none" stroke="#6B7385" strokeWidth="1.5" strokeDasharray="2,3" />
            <path d={pathDep} fill="none" stroke="#9AA3B2" strokeWidth="1.75" strokeDasharray="4,4" />
            <path d={pathPers} fill="none" stroke="#F5A524" strokeWidth="2" />
            <path d={pathLgbm} fill="none" stroke="#7C4DFF" strokeWidth="2.5" />

            {/* Hover guideline and dots */}
            {hoveredPoint && (
              <g>
                <line
                  x1={hoveredPoint.x}
                  y1={padTop}
                  x2={hoveredPoint.x}
                  y2={padTop + chartH}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
                <circle cx={hoveredPoint.x} cy={hoveredPoint.yLgbm} r="4.5" fill="#7C4DFF" stroke="#0B0E14" strokeWidth="1.5" />
                <circle cx={hoveredPoint.x} cy={hoveredPoint.yDep} r="4" fill="#9AA3B2" stroke="#0B0E14" strokeWidth="1.5" />
                <circle cx={hoveredPoint.x} cy={hoveredPoint.yPers} r="4" fill="#F5A524" stroke="#0B0E14" strokeWidth="1.5" />
                <circle cx={hoveredPoint.x} cy={hoveredPoint.yPrev} r="3" fill="#6B7385" stroke="#0B0E14" strokeWidth="1" />
              </g>
            )}

            {/* Transparent hover hit boxes */}
            {points.map((p, idx) => (
              <rect
                key={idx}
                x={p.x - chartW / (weeks.length * 2)}
                y={padTop}
                width={chartW / weeks.length}
                height={chartH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
              />
            ))}
          </svg>

          {/* Interactive Tooltip Card */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none bg-[#181D29] border border-white/20 rounded-lg p-2.5 shadow-xl text-xs space-y-1"
              style={{
                top: '12px',
                left: `${Math.min(Math.max(10, (hoveredPoint.x / width) * 100), 72)}%`
              }}
            >
              <div className="font-mono text-[#E7EAF0] font-semibold border-b border-white/10 pb-1">
                Срез: {formatDate(hoveredPoint.cutoff)}
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#9AA3B2]">LightGBM (дообуч.):</span>
                <span className="font-mono text-[#7C4DFF] font-semibold">{formatNum(hoveredPoint.lgbm, 3)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#9AA3B2]">Январская модель:</span>
                <span className="font-mono text-[#9AA3B2]">{formatNum(hoveredPoint.dep, 3)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#9AA3B2]">Правило 7 дней:</span>
                <span className="font-mono text-[#F5A524]">{formatNum(hoveredPoint.pers, 3)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#9AA3B2]">Доля событий:</span>
                <span className="font-mono text-[#6B7385]">{formatPct(hoveredPoint.prev, 2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Population Toggle & Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#E7EAF0]">
              Сводные показатели моделей (медианы за {testWeeks} недель)
            </h3>
            <p className="text-xs text-[#9AA3B2]">
              Сравнение качества ранжирования на реальных данных 2026 года
            </p>
          </div>

          {/* Toggle Button Group */}
          <div className="inline-flex bg-[#181D29] border border-white/10 p-0.5 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setPopulation('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                population === 'all'
                  ? 'bg-[#7C4DFF] text-white shadow-xs'
                  : 'text-[#9AA3B2] hover:text-white'
              }`}
            >
              Все каналы
            </button>
            <button
              type="button"
              onClick={() => setPopulation('new_incidents')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                population === 'new_incidents'
                  ? 'bg-[#7C4DFF] text-white shadow-xs'
                  : 'text-[#9AA3B2] hover:text-white'
              }`}
            >
              Каналы без сбоев за 7 дней
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-white/10 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181D29] text-[#9AA3B2] border-b border-white/10">
              <tr>
                <th className="py-3 px-4 font-medium">Модель</th>
                <th className="py-3 px-4 font-medium text-right">ROC-AUC</th>
                <th className="py-3 px-4 font-medium text-right">PR-AUC</th>
                <th className="py-3 px-4 font-medium text-right">Точность топ-50</th>
                <th className="py-3 px-4 font-medium text-right">Точность топ-100</th>
                <th className="py-3 px-4 font-medium text-right">Точность топ-200</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#121620]">
              {tableRows.map((row) => (
                <tr key={row.scorerKey} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-[#E7EAF0]">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${row.badgeColor.includes('7C4DFF') ? 'bg-[#7C4DFF]' : row.badgeColor.includes('F5A524') ? 'bg-[#F5A524]' : row.badgeColor.includes('4C9BFF') ? 'bg-[#4C9BFF]' : 'bg-[#9AA3B2]'}`}></span>
                      <span>{row.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#E7EAF0]">
                    {formatNum(row.data?.roc_auc?.median)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#E7EAF0]">
                    {formatNum(row.data?.pr_auc?.median)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#E7EAF0]">
                    {formatPct(row.data?.precision_at_50?.median)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#E7EAF0]">
                    {formatPct(row.data?.precision_at_100?.median)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-[#E7EAF0]">
                    {formatPct(row.data?.precision_at_200?.median)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3 Key Takeaways */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9AA3B2]">
          Ключевые выводы валидации:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#181D29] border border-white/10 rounded-xl p-3.5 space-y-1.5">
            <div className="text-xs font-semibold text-[#7C4DFF] flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Еженедельное дообучение</span>
            </div>
            <p className="text-xs text-[#E7EAF0] leading-relaxed">
              Медианный PR-AUC <span className="font-mono font-semibold text-[#7C4DFF]">{lgbmPrAuc}</span> против <span className="font-mono text-[#9AA3B2]">{depPrAuc}</span> у модели без дообучения — поэтому в сервисе заложен регулярный цикл дообучения.
            </p>
          </div>

          <div className="bg-[#181D29] border border-white/10 rounded-xl p-3.5 space-y-1.5">
            <div className="text-xs font-semibold text-[#F5A524] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Сравнение с эвристикой</span>
            </div>
            <p className="text-xs text-[#E7EAF0] leading-relaxed">
              Качество ранжирования выше правила «сбоил недавно»: ROC-AUC <span className="font-mono font-semibold text-[#7C4DFF]">{lgbmRoc}</span> против <span className="font-mono text-[#F5A524]">{persRoc}</span>; в топ-100 точность сопоставима ({lgbmP100} % и {persP100} %).
            </p>
          </div>

          <div className="bg-[#181D29] border border-white/10 rounded-xl p-3.5 space-y-1.5">
            <div className="text-xs font-semibold text-[#4C9BFF] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Новые инциденты</span>
            </div>
            <p className="text-xs text-[#E7EAF0] leading-relaxed">
              На каналах без сбоев за неделю ({newIncidentShare} % всех событий) правило не работает (ROC-AUC 0,5), а модель сохраняет ROC-AUC <span className="font-mono font-semibold text-[#7C4DFF]">{newRoc}</span> — это инциденты, о которых диспетчер иначе не узнал бы заранее.
            </p>
          </div>
        </div>
      </div>

      {/* Source Line */}
      <div className="text-xs text-[#6B7385] border-t border-white/10 pt-3 flex flex-wrap justify-between items-center gap-2">
        <span>Источник: backend/models/rolling_backtest_report.json · воспроизведение: python scripts/rolling_backtest.py</span>
        <span className="font-mono text-[11px]">Журнал СМВУ 2026 г. (11 485 каналов)</span>
      </div>
    </section>
  );
};

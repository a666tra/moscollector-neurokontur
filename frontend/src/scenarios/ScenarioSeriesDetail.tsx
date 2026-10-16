import React, { useEffect, useState, useMemo } from 'react';
import { X, Loader2, AlertTriangle, ShieldCheck, Activity, Info, Clock, CheckCircle2 } from 'lucide-react';
import { ScenarioSeriesResponse, ScenarioSeriesPoint, ScenarioAlertItem, ScenarioTrueEvent } from '../types';
import { api } from '../lib/api';
import { getAlertClassLabel, getSeverityLabel, formatScenarioCounts } from './scenarioLabels';

interface ScenarioSeriesDetailProps {
  channelId: string;
  mode: 'day' | 'month';
  seed: number;
  onClose: () => void;
}

export const ScenarioSeriesDetail: React.FC<ScenarioSeriesDetailProps> = ({
  channelId,
  mode,
  seed,
  onClose,
}) => {
  const [data, setData] = useState<ScenarioSeriesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredAlert, setHoveredAlert] = useState<ScenarioAlertItem | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api<ScenarioSeriesResponse>('/api/scenarios/series', {
      method: 'POST',
      json: { mode, seed, channel_id: channelId },
    })
      .then(res => {
        if (!active) return;
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        console.error('Failed to load scenario channel series:', err);
        setError(err.message || 'Ошибка загрузки телеметрии канала');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [channelId, mode, seed]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatTs = (ts: number, m: 'day' | 'month') => {
    if (m === 'day') {
      const h = Math.floor(ts / 3600);
      const min = Math.floor((ts % 3600) / 60);
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    } else {
      const d = Math.floor(ts / 86400) + 1;
      const h = Math.floor((ts % 86400) / 3600);
      const min = Math.floor((ts % 3600) / 60);
      return `Д.${d} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  };

  // SVG Chart Geometry
  const svgWidth = 760;
  const svgHeight = 280;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const chartModel = useMemo(() => {
    if (!data || !data.series || data.series.length === 0) return null;

    const isDiscrete = data.series[0].state_name !== undefined;
    const allTs = data.series.map(p => p.ts);
    for (const te of data.true_events) {
      allTs.push(te.start_ts, te.end_ts);
    }
    for (const a of data.alerts) {
      allTs.push(a.ts);
    }

    const minTs = Math.min(...allTs);
    let maxTs = Math.max(...allTs);
    if (maxTs <= minTs) maxTs = minTs + 3600;

    const getX = (ts: number) => {
      const ratio = Math.max(0, Math.min(1, (ts - minTs) / (maxTs - minTs)));
      return padLeft + ratio * chartW;
    };

    if (isDiscrete) {
      // Step chart
      const yNorm = padTop + chartH * 0.8;
      const yAlarm = padTop + chartH * 0.25;

      const pathParts: string[] = [];
      const pts = data.series;
      for (let i = 0; i < pts.length; i++) {
        const x = getX(pts[i].ts);
        const y = pts[i].is_alarm ? yAlarm : yNorm;
        if (i === 0) {
          pathParts.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
        } else {
          const prevY = pts[i - 1].is_alarm ? yAlarm : yNorm;
          pathParts.push(`L ${x.toFixed(1)} ${prevY.toFixed(1)}`);
          pathParts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
        }
      }

      return {
        isDiscrete: true,
        pathD: pathParts.join(' '),
        minTs,
        maxTs,
        getX,
        yNorm,
        yAlarm,
      };
    } else {
      // Analog chart
      const validVals: number[] = [];
      for (const p of data.series) {
        if (typeof p.value === 'number' && Number.isFinite(p.value)) {
          validVals.push(p.value);
        }
      }
      if (typeof data.thresholds.warning === 'number') validVals.push(data.thresholds.warning);
      if (typeof data.thresholds.alarm === 'number') validVals.push(data.thresholds.alarm);

      let minVal = validVals.length > 0 ? Math.min(...validVals) : 0;
      let maxVal = validVals.length > 0 ? Math.max(...validVals) : 10;
      if (maxVal <= minVal) maxVal = minVal + 1;

      // Add 10% margins
      const span = maxVal - minVal;
      minVal = Math.max(0, minVal - span * 0.1);
      maxVal = maxVal + span * 0.1;

      const getY = (val: number) => {
        const ratio = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
        return padTop + chartH - ratio * chartH;
      };

      const pathParts: string[] = [];
      let inSegment = false;
      for (let i = 0; i < data.series.length; i++) {
        const p = data.series[i];
        if (typeof p.value === 'number' && Number.isFinite(p.value)) {
          const x = getX(p.ts);
          const y = getY(p.value);
          if (!inSegment) {
            pathParts.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
            inSegment = true;
          } else {
            pathParts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
          }
        } else {
          inSegment = false;
        }
      }

      return {
        isDiscrete: false,
        pathD: pathParts.join(' '),
        minTs,
        maxTs,
        minVal,
        maxVal,
        getX,
        getY,
      };
    }
  }, [data]);

  return (
    <div
      className="fixed inset-0 z-[1400] flex justify-end"
      style={{ background: 'rgba(10,10,12,.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Детали канала и эталон аварии"
    >
      <div
        className="w-full max-w-[920px] h-full flex flex-col overflow-y-auto"
        style={{ background: 'var(--bg)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 h-16 border-b shrink-0 sticky top-0 z-20"
          style={{ borderColor: 'var(--ln)', background: 'var(--sf)' }}
        >
          <div className="flex items-center gap-3">
            <span className="serif font-semibold text-xl sm:text-2xl leading-none">
              Канал {channelId}
            </span>
            {data && (
              <span className="num text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--sf2)', color: 'var(--ink)' }}>
                {data.sensor_type} · объект {data.object_id}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="icon-btn"
            aria-label="Закрыть панель деталей"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 flex flex-col gap-6">
          {loading && (
            <div className="panel p-12 flex flex-col items-center justify-center gap-3 text-xs" style={{ color: 'var(--mut)' }}>
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--ac)' }} />
              <span>Загрузка телеметрии и эталона канала…</span>
            </div>
          )}

          {error && (
            <div className="panel p-6 flex items-center gap-3 text-xs" style={{ background: 'var(--crs)', color: 'var(--cr)' }}>
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && chartModel && (
            <>
              {/* Channel Stats Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="panel p-3.5">
                  <div className="label">Эталонные аварии</div>
                  <div className="serif text-2xl font-semibold mt-1 num" style={{ color: data.true_events.length > 0 ? 'var(--cr)' : 'var(--ok)' }}>
                    {data.true_events.length}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--mut)' }}>
                    {formatScenarioCounts(data.true_events)}
                  </div>
                </div>

                <div className="panel p-3.5">
                  <div className="label">Оповещения детектора</div>
                  <div className="serif text-2xl font-semibold mt-1 num" style={{ color: 'var(--ac)' }}>
                    {data.alerts.length}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--mut)' }}>
                    {data.alerts.filter(a => !a.is_reminder).length} первичных
                  </div>
                </div>

                <div className="panel p-3.5">
                  <div className="label">Тип датчика</div>
                  <div className="text-sm font-semibold mt-2 truncate" title={data.sensor_type}>
                    {data.sensor_type}
                  </div>
                  <div className="text-[11px] mt-0.5 num" style={{ color: 'var(--mut)' }}>
                    объект {data.object_id}
                  </div>
                </div>

                <div className="panel p-3.5">
                  <div className="label">Пороги канала</div>
                  <div className="text-xs font-medium mt-2 num">
                    {data.thresholds.warning ? `Пред: ${data.thresholds.warning}` : '—'}
                    {data.thresholds.alarm ? ` · Авария: ${data.thresholds.alarm}` : ''}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--mut)' }}>
                    {data.thresholds.warning ? 'активные уставки' : 'дискретный канал'}
                  </div>
                </div>
              </div>

              {/* Chart Panel */}
              <div className="panel p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" style={{ color: 'var(--ac)' }} />
                    <span>Временной ряд телеметрии канала и сработки</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: 'var(--mut)' }}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5" style={{ background: 'var(--ac)' }} /> сигнал
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-2 rounded-sm" style={{ background: 'rgba(229, 65, 45, 0.25)', border: '1px dashed var(--cr)' }} /> эталон аварии
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: 'var(--cr)' }} /> оповещение
                    </span>
                  </div>
                </div>

                {/* Horizontally scrollable chart container */}
                <div className="relative w-full overflow-x-auto scroll-thin border rounded-xl p-2.5 bg-[var(--sf)]" style={{ borderColor: 'var(--ln)' }}>
                  <div style={{ minWidth: '660px' }}>
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="w-full h-auto select-none block"
                      style={{ minWidth: '660px', maxHeight: '340px' }}
                    >
                      {/* Background Grid */}
                      <rect x={padLeft} y={padTop} width={chartW} height={chartH} fill="var(--sf2)" rx="6" />

                      {/* Shaded True Event Windows */}
                      {data.true_events.map((ev, i) => {
                        const x1 = Math.max(padLeft, chartModel.getX(ev.start_ts));
                        const x2 = Math.min(padLeft + chartW, chartModel.getX(ev.end_ts));
                        const w = Math.max(4, x2 - x1);
                        return (
                          <g key={ev.event_id || i}>
                            <rect
                              x={x1}
                              y={padTop}
                              width={w}
                              height={chartH}
                              fill="rgba(229, 65, 45, 0.16)"
                              stroke="var(--cr)"
                              strokeWidth="1.2"
                              strokeDasharray="4,3"
                            />
                            <text
                              x={x1 + 6}
                              y={padTop + 16}
                              fill="var(--cr)"
                              fontSize="13"
                              fontWeight="600"
                              className="num"
                            >
                              Эталон {ev.scenario_id} ({getAlertClassLabel(ev.cls)})
                            </text>
                          </g>
                        );
                      })}

                      {/* Analog Threshold Horizontal Lines */}
                      {!chartModel.isDiscrete && (
                        <>
                          {typeof data.thresholds.warning === 'number' && chartModel.getY && (
                            <g>
                              <line
                                x1={padLeft}
                                y1={chartModel.getY(data.thresholds.warning)}
                                x2={padLeft + chartW}
                                y2={chartModel.getY(data.thresholds.warning)}
                                stroke="var(--wr)"
                                strokeWidth="1.2"
                                strokeDasharray="4,4"
                              />
                              <text
                                x={padLeft + chartW - 6}
                                y={chartModel.getY(data.thresholds.warning) - 4}
                                textAnchor="end"
                                fill="var(--wr)"
                                fontSize="12"
                                fontWeight="500"
                                className="num"
                              >
                                Порог пред.: {data.thresholds.warning}
                              </text>
                            </g>
                          )}
                          {typeof data.thresholds.alarm === 'number' && chartModel.getY && (
                            <g>
                              <line
                                x1={padLeft}
                                y1={chartModel.getY(data.thresholds.alarm)}
                                x2={padLeft + chartW}
                                y2={chartModel.getY(data.thresholds.alarm)}
                                stroke="var(--cr)"
                                strokeWidth="1.4"
                                strokeDasharray="4,4"
                              />
                              <text
                                x={padLeft + chartW - 6}
                                y={chartModel.getY(data.thresholds.alarm) - 4}
                                textAnchor="end"
                                fill="var(--cr)"
                                fontSize="12"
                                fontWeight="600"
                                className="num"
                              >
                                Порог аварии: {data.thresholds.alarm}
                              </text>
                            </g>
                          )}
                        </>
                      )}

                      {/* Telemetry Data Path */}
                      <path
                        d={chartModel.pathD}
                        fill="none"
                        stroke="var(--ac)"
                        strokeWidth={chartModel.isDiscrete ? 2 : 2.2}
                        strokeLinejoin="round"
                      />

                      {/* Vertical Alert Markers */}
                      {data.alerts.map((al, idx) => {
                        const ax = chartModel.getX(al.ts);
                        const isCrit = al.severity === 'CRITICAL' || al.cls.includes('ALARM');
                        const alertCol = isCrit ? 'var(--cr)' : 'var(--wr)';

                        return (
                          <g
                            key={idx}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredAlert(al)}
                            onMouseLeave={() => setHoveredAlert(null)}
                          >
                            <line
                              x1={ax}
                              y1={padTop}
                              x2={ax}
                              y2={padTop + chartH}
                              stroke={alertCol}
                              strokeWidth="1.5"
                              strokeDasharray="3,3"
                            />
                            <circle
                              cx={ax}
                              cy={padTop + 6}
                              r="4.5"
                              fill={alertCol}
                              stroke="var(--sf)"
                              strokeWidth="1.5"
                            />
                          </g>
                        );
                      })}

                      {/* Y-Axis Labels */}
                      {chartModel.isDiscrete ? (
                        <>
                          <text x={padLeft - 8} y={chartModel.yAlarm + 4} textAnchor="end" fontSize="13" fill="var(--cr)" fontWeight="500">
                            Тревога
                          </text>
                          <text x={padLeft - 8} y={chartModel.yNorm + 4} textAnchor="end" fontSize="13" fill="var(--ok)" fontWeight="500">
                            Норма
                          </text>
                        </>
                      ) : (
                        <>
                          <text x={padLeft - 6} y={padTop + 10} textAnchor="end" fontSize="12" fill="var(--mut)" className="num">
                            {chartModel.maxVal?.toFixed(1)}
                          </text>
                          <text x={padLeft - 6} y={padTop + chartH} textAnchor="end" fontSize="12" fill="var(--mut)" className="num">
                            {chartModel.minVal?.toFixed(1)}
                          </text>
                        </>
                      )}

                      {/* X-Axis Time Ticks */}
                      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                        const curTs = chartModel.minTs + frac * (chartModel.maxTs - chartModel.minTs);
                        const tx = padLeft + frac * chartW;
                        return (
                          <g key={frac}>
                            <line x1={tx} y1={padTop + chartH} x2={tx} y2={padTop + chartH + 4} stroke="var(--ln2)" />
                            <text
                              x={tx}
                              y={padTop + chartH + 18}
                              textAnchor={frac === 0 ? 'start' : frac === 1 ? 'end' : 'middle'}
                              fontSize="12"
                              fill="var(--mut)"
                              className="num"
                            >
                              {formatTs(curTs, mode)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* Tooltip on hovered alert */}
                    {hoveredAlert && (
                      <div
                        className="absolute top-4 right-4 panel p-2.5 shadow-lg text-xs space-y-1 max-w-[280px]"
                        style={{ background: 'var(--sf)' }}
                      >
                        <div className="font-semibold flex items-center justify-between border-b pb-1" style={{ borderColor: 'var(--ln)' }}>
                          <span title={hoveredAlert.cls}>{getAlertClassLabel(hoveredAlert.cls)}</span>
                          <span className="num">{formatTs(hoveredAlert.ts, mode)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span
                            className="px-1.5 py-0.5 rounded font-semibold"
                            style={{
                              background: hoveredAlert.severity === 'CRITICAL' ? 'var(--crs)' : 'var(--wrs)',
                              color: hoveredAlert.severity === 'CRITICAL' ? 'var(--cr)' : 'var(--wr)',
                            }}
                            title={hoveredAlert.severity}
                          >
                            {getSeverityLabel(hoveredAlert.severity)}
                          </span>
                          {hoveredAlert.is_escalation && (
                            <span
                              className="px-1.5 py-0.5 rounded font-medium"
                              style={{ background: 'var(--crs)', color: 'var(--cr)' }}
                              title="Эскалация (is_escalation)"
                            >
                              эскалация
                            </span>
                          )}
                          {hoveredAlert.is_reminder && (
                            <span className="text-[var(--mut)]">(напоминание)</span>
                          )}
                        </div>
                        <div className="text-[11px] leading-snug" style={{ color: 'var(--ink)' }}>
                          {hoveredAlert.reason_ru}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Required note under the chart */}
                <div className="flex items-center gap-1.5 text-xs italic" style={{ color: 'var(--mut)' }}>
                  <Info className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ac)' }} />
                  <span>Эталонное окно аварии заложено генератором; сигнал синтетический.</span>
                </div>
              </div>

              {/* Alerts fired on this channel */}
              <div className="panel p-4 flex flex-col gap-3">
                <div className="font-semibold text-xs eyebrow flex items-center justify-between">
                  <span>Журнал оповещений детектора по каналу ({data.alerts.length})</span>
                </div>
                {data.alerts.length === 0 ? (
                  <div className="text-xs p-4 text-center" style={{ color: 'var(--mut)' }}>
                    На этом канале тревог не обнаружено.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y text-xs" style={{ borderColor: 'var(--ln)' }}>
                    {data.alerts.map((a, i) => (
                      <div key={i} className="py-2.5 flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="num font-semibold text-[11px]" style={{ color: 'var(--ink)' }}>
                              {formatTs(a.ts, mode)}
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{
                                background: a.severity === 'CRITICAL' ? 'var(--crs)' : 'var(--wrs)',
                                color: a.severity === 'CRITICAL' ? 'var(--cr)' : 'var(--wr)',
                              }}
                              title={a.severity}
                            >
                              {getSeverityLabel(a.severity)}
                            </span>
                            <span className="font-medium" title={a.cls}>
                              {getAlertClassLabel(a.cls)}
                            </span>
                            {a.is_reminder && (
                              <span className="text-[10px] text-[var(--mut)]">(напоминание)</span>
                            )}
                            {a.is_escalation && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={{ background: 'var(--crs)', color: 'var(--cr)' }}
                                title="Эскалация (is_escalation)"
                              >
                                эскалация
                              </span>
                            )}
                          </div>
                          <div className="text-[11px]" style={{ color: 'var(--mut)' }}>
                            {a.reason_ru}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

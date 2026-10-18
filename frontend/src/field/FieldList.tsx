import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { ObjectItem, PredictionItem, MaintenanceTicket } from '../types';
import { probabilityOf, formatPk } from '../lib/plain';

interface Props {
  criticalObjects: ObjectItem[];
  watchObjects: ObjectItem[];
  normalObjects: ObjectItem[];
  predsByObject: Map<string, PredictionItem>;
  ticketsByObject: Map<string, MaintenanceTicket[]>;
  objectSteps: Record<string, number>;
  selectedObjectId?: string;
  onSelectObject: (objectId: string) => void;
  getDistance: (obj: ObjectItem) => number;
  formatDistance: (km: number) => string;
  filter: 'all' | 'near' | 'tickets';
  onFilterChange: (f: 'all' | 'near' | 'tickets') => void;
  snapshotDate: string;
  loading: boolean;
  onRefresh: () => void;
}

export const FieldList: React.FC<Props> = ({
  criticalObjects,
  watchObjects,
  normalObjects,
  predsByObject,
  ticketsByObject,
  objectSteps,
  selectedObjectId,
  onSelectObject,
  getDistance,
  formatDistance,
  filter,
  onFilterChange,
  snapshotDate,
  loading,
  onRefresh,
}) => {
  const [showWatch, setShowWatch] = useState(false);
  const [showNormal, setShowNormal] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('q') || '';
    } catch {
      return '';
    }
  });

  // Filter calculations for critical objects
  const nearCount = criticalObjects.filter(o => getDistance(o) <= 3.5).length;
  const ticketsCount = criticalObjects.filter(o => (ticketsByObject.get(o.object_id)?.length || 0) > 0).length;

  let visibleCritical = [...criticalObjects];
  if (filter === 'near') {
    visibleCritical = visibleCritical.filter(o => getDistance(o) <= 3.5);
    visibleCritical.sort((a, b) => getDistance(a) - getDistance(b));
  } else if (filter === 'tickets') {
    visibleCritical = visibleCritical.filter(o => (ticketsByObject.get(o.object_id)?.length || 0) > 0);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    visibleCritical = visibleCritical.filter(o => o.name.toLowerCase().includes(q) || (o.route_name || '').toLowerCase().includes(q));
  }

  // Top 10 as specified by designer
  const top10 = visibleCritical.slice(0, 10);

  const renderRow = (obj: ObjectItem) => {
    const pred = predsByObject.get(obj.object_id);
    const prob = pred ? probabilityOf(pred) : null;
    const pct = prob != null ? Math.round(prob * 100) : null;
    const dist = getDistance(obj);
    const distStr = formatDistance(dist);
    const isSelected = obj.object_id === selectedObjectId;

    const step = objectSteps[obj.object_id] ?? 0;
    const isDone = step === 3;
    const isCritical = obj.risk_level === 'CRITICAL';
    const isWarning = obj.risk_level === 'WARNING';

    const area = obj.route_name || obj.corridor || 'Москва';
    const picket = formatPk(obj.picket);
    const subtitle = [area, picket, distStr].filter(Boolean).join(' · ');

    const badgeBg = isDone ? 'var(--gns)' : isCritical ? 'var(--rds)' : isWarning ? 'var(--ams)' : 'var(--sf2)';
    const badgeFg = isDone ? 'var(--gnt)' : isCritical ? 'var(--rdt)' : isWarning ? 'var(--amt)' : 'var(--mu)';

    const statusText = isDone
      ? 'Выполнена'
      : step === 2
      ? 'На месте'
      : step === 1
      ? 'В пути'
      : isCritical
      ? 'Срочно'
      : isWarning
      ? 'Скоро'
      : 'В норме';

    const statusBg = isDone
      ? 'var(--gns)'
      : step === 2
      ? 'var(--ams)'
      : step === 1
      ? 'var(--acs)'
      : isCritical
      ? 'var(--rds)'
      : isWarning
      ? 'var(--ams)'
      : 'var(--sf2)';

    const statusFg = isDone
      ? 'var(--gnt)'
      : step === 2
      ? 'var(--amt)'
      : step === 1
      ? 'var(--ac)'
      : isCritical
      ? 'var(--rdt)'
      : isWarning
      ? 'var(--amt)'
      : 'var(--mu)';

    return (
      <button
        key={obj.object_id}
        role="listitem"
        type="button"
        onClick={() => onSelectObject(obj.object_id)}
        aria-label={`${obj.name}${pct != null ? `, риск ${pct} %` : ''}, статус ${statusText}, расстояние ${distStr}`}
        className="w-full max-w-full min-h-[76px] p-2.5 sm:p-3 rounded-[18px] border-2 flex items-center gap-2.5 sm:gap-3 text-left transition-all active:scale-[0.99] cursor-pointer overflow-hidden"
        style={{
          background: isSelected ? 'var(--sf2)' : 'var(--sf)',
          borderColor: isSelected ? 'var(--ac)' : 'var(--ln)',
          boxShadow: isSelected ? '0 0 0 1px var(--ac)' : 'none',
        }}
      >
        {/* Risk Percentage Badge */}
        <span
          className="w-11 h-11 rounded-[14px] flex items-center justify-center font-bold text-[14px] sm:text-[15px] font-mono shrink-0 tabular-nums"
          style={{ background: badgeBg, color: badgeFg }}
        >
          {isDone ? '✓' : pct != null ? `${pct}%` : '—'}
        </span>

        {/* Info Column */}
        <span className="flex-1 min-w-0 flex flex-col justify-center">
          <span className="font-semibold text-[15px] sm:text-[16px] text-[var(--ink)] leading-snug truncate block">
            {obj.name}
          </span>
          <span className="text-[12.5px] sm:text-[13px] text-[var(--mu)] mt-0.5 truncate block font-medium">
            {subtitle}
          </span>
        </span>

        {/* Status Chip */}
        <span
          className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 whitespace-nowrap"
          style={{ background: statusBg, color: statusFg }}
        >
          {statusText}
        </span>
      </button>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[var(--sf)]">
      {/* Panel Header */}
      <div className="shrink-0 p-4 pb-2 sm:p-5 sm:pb-3 border-b border-[var(--ln)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="serif font-normal text-[26px] sm:text-[30px] leading-tight text-[var(--ink)] m-0">
            Обход объектов
          </h2>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Обновить список"
            className="w-12 h-12 rounded-full border flex items-center justify-center transition-colors hover:bg-[var(--sf2)] cursor-pointer shrink-0"
            style={{ borderColor: 'var(--ln)', background: 'var(--sf)', color: 'var(--ink)' }}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-[var(--ac)]' : ''}`} />
          </button>
        </div>

        <div className="text-[13px] text-[var(--mu)] font-medium mt-1">
          В очереди: {criticalObjects.length} (показаны первые 10) · данные до {snapshotDate}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scroll-thin">
          {[
            { id: 'all' as const, label: 'Все', count: criticalObjects.length },
            { id: 'near' as const, label: 'Рядом', count: nearCount },
            { id: 'tickets' as const, label: 'С заявкой', count: ticketsCount },
          ].map(c => {
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onFilterChange(c.id)}
                aria-pressed={active}
                className="min-h-[48px] px-4 rounded-full flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer border"
                style={
                  active
                    ? {
                        background: 'var(--ink)',
                        color: 'var(--bg)',
                        borderColor: 'var(--ink)',
                      }
                    : {
                        background: 'var(--sf)',
                        color: 'var(--ink)',
                        borderColor: 'var(--ln)',
                      }
                }
              >
                <span>{c.label}</span>
                <span className="opacity-70 text-xs font-mono">{c.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 flex flex-col gap-2">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3, 4].map(k => (
              <div
                key={k}
                className="h-[76px] rounded-[18px] animate-pulse"
                style={{ background: 'var(--sf2)' }}
              />
            ))}
          </div>
        ) : top10.length === 0 ? (
          <div className="py-10 px-4 text-center flex flex-col items-center gap-3">
            <span
              className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--gns)', color: 'var(--gnt)' }}
            >
              <CheckCircle2 className="w-8 h-8" />
            </span>
            <div className="font-bold text-[18px] text-[var(--ink)]">
              {filter === 'all' && !searchQuery ? 'Срочных действий нет' : 'Здесь пусто'}
            </div>
            <div className="text-[14px] text-[var(--mu)] max-w-xs leading-relaxed">
              {filter === 'all' && !searchQuery
                ? 'Срочных действий нет. Посмотрите при ближайшем обходе.'
                : 'Нет объектов по этому фильтру. Выберите «Все».'}
            </div>
          </div>
        ) : (
          <div role="list" className="flex flex-col gap-2">
            {top10.map(renderRow)}
          </div>
        )}

        {/* Collapsible section: Наблюдать (watchObjects) */}
        {!loading && watchObjects.length > 0 && filter === 'all' && !searchQuery && (
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[var(--ln)]">
            <button
              type="button"
              onClick={() => setShowWatch(!showWatch)}
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-left font-semibold text-sm transition-colors hover:bg-[var(--sf2)] cursor-pointer"
              style={{ background: 'var(--sf)', borderColor: 'var(--ln)', color: 'var(--ink)' }}
              aria-expanded={showWatch}
            >
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--am)' }} />
                <span>Наблюдать ({watchObjects.length})</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-[var(--mu)] font-normal">
                <span>{showWatch ? 'Скрыть' : 'Показать'}</span>
                {showWatch ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            {showWatch && (
              <div className="flex flex-col gap-2 pl-1">
                {watchObjects.slice(0, 15).map(renderRow)}
              </div>
            )}
          </div>
        )}

        {/* Collapsible section: Остальные объекты в норме (normalObjects) */}
        {!loading && normalObjects.length > 0 && filter === 'all' && !searchQuery && (
          <div className="flex flex-col gap-2 mt-2">
            <button
              type="button"
              onClick={() => setShowNormal(!showNormal)}
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-left font-semibold text-sm transition-colors hover:bg-[var(--sf2)] cursor-pointer"
              style={{ background: 'var(--sf)', borderColor: 'var(--ln)', color: 'var(--ink)' }}
              aria-expanded={showNormal}
            >
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--gn)' }} />
                <span>Остальные объекты в норме ({normalObjects.length})</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-[var(--mu)] font-normal">
                <span>{showNormal ? 'Скрыть' : 'Показать'}</span>
                {showNormal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            {showNormal && (
              <div className="flex flex-col gap-2 pl-1">
                {normalObjects.slice(0, 15).map(renderRow)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

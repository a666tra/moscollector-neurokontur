import React, { useMemo, useState } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { ObjectItem, PredictionItem } from '../types';
import { RISK_COLOR } from './NetworkMap';

/** «[Охранная зона]ДП Ленинский» → «Охранная зона · ДП Ленинский» */
export const cleanName = (n: string) => (n || '').replace(/^\[([^\]]+)\]\s*/, '$1 · ').replace(/\s+/g, ' ').trim();

export const probabilityOf = (p: PredictionItem) =>
  typeof p.calibrated_proxy_probability === 'number' ? p.calibrated_proxy_probability : p.failure_probability;

const LEVELS: Array<[string, string]> = [['ALL', 'Все'], ['CRITICAL', 'Критично'], ['WARNING', 'Предупр.'], ['ATTENTION', 'Наблюдение']];

interface Props {
  items: PredictionItem[];
  objectsById: Record<string, ObjectItem>;
  selectedChannelId?: string;
  objectFilter?: string;
  onClearObject: () => void;
  onSelect: (p: PredictionItem) => void;
  decided: Record<string, string>;
}

/** Ranked list of channels by forecast risk for the next 24–72 h. */
export const RiskQueue: React.FC<Props> = ({ items, objectsById, selectedChannelId, objectFilter, onClearObject, onSelect, decided }) => {
  const [level, setLevel] = useState('ALL');
  const [system, setSystem] = useState('ALL');
  const [query, setQuery] = useState('');
  const systems = useMemo(() => Array.from(new Set(items.map(i => i.system_type))).filter(Boolean).sort(), [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(p => {
      if (p.risk_level === 'NORMAL') return false;
      if (objectFilter && p.object_id !== objectFilter) return false;
      if (level !== 'ALL' && p.risk_level !== level) return false;
      if (system !== 'ALL' && p.system_type !== system) return false;
      if (q && !`${p.channel_id} ${p.sensor_name} ${p.object_name} ${p.tag}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, objectFilter, level, system, query]);

  const obj = objectFilter ? objectsById[objectFilter] : undefined;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 pb-3 space-y-3 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Очередь риска</h2>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>горизонт 24–72 ч · <span className="num">{rows.length}</span></span>
        </div>
        {obj && (
          <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--accent-soft)' }}>
            <span className="truncate">Объект: <b>{obj.name}</b> · {obj.picket}</span>
            <button onClick={onClearObject} className="shrink-0" style={{ color: 'var(--accent-text)' }} aria-label="Сбросить объект"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg)' }} role="tablist">
          {LEVELS.map(([k, t]) => (
            <button key={k} role="tab" aria-selected={level === k} onClick={() => setLevel(k)}
                    className="flex-1 h-7 rounded-md text-xs font-medium transition-colors"
                    style={level === k ? { background: 'var(--surface-3)', color: 'var(--text)' } : { color: 'var(--muted)' }}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
            <input className="input pl-9 h-9 text-sm" placeholder="Канал, объект, тег" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <select className="input h-9 text-sm w-[42%]" value={system} onChange={e => setSystem(e.target.value)} aria-label="Подсистема">
            <option value="ALL">Все подсистемы</option>
            {systems.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto scroll-thin">
        {rows.slice(0, 200).map(p => {
          const o = objectsById[p.object_id];
          const active = p.channel_id === selectedChannelId;
          const done = decided[p.channel_id];
          return (
            <li key={p.channel_id}>
              <button onClick={() => onSelect(p)}
                      className="w-full text-left flex items-center gap-3 pl-3 pr-3 py-3 border-b transition-colors hover:bg-[var(--surface-2)]"
                      style={{ borderColor: 'var(--line)', background: active ? 'var(--surface-3)' : undefined,
                               boxShadow: `inset 3px 0 0 ${RISK_COLOR[p.risk_level]}` }}>
                <div className="w-14 shrink-0 text-right">
                  <div className="num text-lg font-semibold leading-none">{Math.round(probabilityOf(p) * 100)}<span className="text-xs" style={{ color: 'var(--muted)' }}>%</span></div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{cleanName(p.sensor_name)}</div>
                  <div className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
                    <span className="num">#{p.channel_id}</span> · {p.object_name}{o ? ` · ${o.picket}` : ''}
                  </div>
                  {done && <div className="text-xs mt-1" style={{ color: 'var(--accent-text)' }}>{done}</div>}
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--faint)' }} />
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="p-6 text-sm text-center" style={{ color: 'var(--muted)' }}>Нет каналов под этот фильтр</li>}
      </ul>
    </div>
  );
};

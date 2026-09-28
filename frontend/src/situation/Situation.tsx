import React, { useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { ChevronRight, X, Plus, Minus, Maximize2, ArrowRight, ListOrdered, Search } from 'lucide-react';
import { ObjectItem, PredictionItem, ConfirmedAlarmItem } from '../types';
import { RiskMap, MOSCOW, MapPin } from './RiskMap';
import { ChannelCard } from './ChannelCard';
import { LEVEL_SOFT, LEVEL_VAR, probabilityOf, shortName } from '../lib/plain';

interface Props {
  objects: ObjectItem[];
  predictions: PredictionItem[];
  confirmed: ConfirmedAlarmItem[];
  onChanged: () => void;
}

const TODAY_SIZE = 12;
type Scope = 'today' | 'all';
type Level = 'ALL' | 'CRITICAL' | 'WARNING';

/** «Обстановка»: risk map + today's queue + channel card (dispatcher scenario, ТЗ §12). */
export const Situation: React.FC<Props> = ({ objects, predictions, onChanged }) => {
  const [scope, setScope] = useState<Scope>('today');
  const [level, setLevel] = useState<Level>('ALL');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decided, setDecided] = useState<Record<string, string>>({});
  const [hint, setHint] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const objectsById = useMemo(() => Object.fromEntries(objects.map(o => [o.object_id, o])), [objects]);
  const ranked = useMemo(
    () => predictions.filter(p => p.risk_level === 'CRITICAL' || p.risk_level === 'WARNING' || p.risk_level === 'ATTENTION')
      .sort((a, b) => probabilityOf(b) - probabilityOf(a)),
    [predictions],
  );
  // «Сегодня»: the most likely channel per object — one decision per place on the map.
  const today = useMemo(() => {
    const seen = new Set<string>();
    return ranked.filter(p => (p.risk_level !== 'ATTENTION') && !seen.has(p.object_id) && seen.add(p.object_id)).slice(0, TODAY_SIZE);
  }, [ranked]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (scope === 'today' ? today : ranked).filter(p =>
      (level === 'ALL' || p.risk_level === level)
      && (!q || `${p.channel_id} ${p.sensor_name} ${p.object_name}`.toLowerCase().includes(q)));
  }, [scope, today, ranked, level, query]);

  const selected = list.find(p => p.channel_id === selectedId) ?? ranked.find(p => p.channel_id === selectedId) ?? list[0] ?? null;
  const index = selected ? Math.max(0, list.findIndex(p => p.channel_id === selected.channel_id)) : 0;
  const step = (d: number) => { if (list.length) setSelectedId(list[(index + d + list.length) % list.length].channel_id); };

  const pins: MapPin[] = useMemo(() => today.map(p => ({
    objectId: p.object_id, pct: Math.round(probabilityOf(p) * 100), risk: p.risk_level, done: !!decided[p.channel_id],
  })), [today, decided]);
  const doneToday = today.filter(p => decided[p.channel_id]).length;

  const pickObject = (objectId: string) => {
    const best = ranked.find(p => p.object_id === objectId);
    if (!best) return;
    if (!today.some(p => p.channel_id === best.channel_id)) setScope('all');
    setLevel('ALL'); setQuery('');
    setSelectedId(best.channel_id);
    setHint(false);
  };

  const onDecided = (cid: string, text: string) => {
    setDecided(d => ({ ...d, [cid]: text }));
    onChanged();
    const next = list.find((p, i) => i > index && !decided[p.channel_id] && p.channel_id !== cid);
    if (next) setTimeout(() => setSelectedId(next.channel_id), 900);
  };

  const renderCard = (compact: boolean) => selected && (
    <ChannelCard
      compact={compact}
      item={selected}
      object={objectsById[selected.object_id]}
      position={index + 1}
      total={list.length}
      done={decided[selected.channel_id]}
      onPrev={() => step(-1)}
      onNext={() => step(1)}
      onDecided={onDecided}
    />
  );

  const queuePanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-[18px] pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-full" style={{ background: 'var(--sf2)' }}>
            {(['today', 'all'] as Scope[]).map(s => (
              <button key={s} onClick={() => setScope(s)} className="h-8 px-3 rounded-full text-[13px] font-medium"
                      style={scope === s ? { background: 'var(--sf)', boxShadow: '0 1px 3px rgba(0,0,0,.12)' } : { color: 'var(--mut)' }}>
                {s === 'today' ? 'Сегодня' : `Все каналы · ${ranked.length}`}
              </button>
            ))}
          </div>
        </div>
        <div className="serif font-semibold text-[28px] leading-none">{scope === 'today' ? 'Очередь на сегодня' : 'Все каналы под риском'}</div>
        {scope === 'today' ? (
          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-1.5 rounded overflow-hidden" style={{ background: 'var(--sf3)' }}>
              <div className="h-full" style={{ width: `${today.length ? (100 * doneToday) / today.length : 0}%`, background: 'var(--ok)', transition: 'width .5s' }} />
            </div>
            <span className="text-xs" style={{ color: 'var(--mut)' }}>решено {doneToday} из {today.length}</span>
          </div>
        ) : (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--mut)' }} />
            <input className="input !h-10 pl-10 !rounded-full" placeholder="Канал или объект" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        )}
        <div className="flex gap-1.5">
          {([['ALL', 'Все'], ['CRITICAL', 'Срочно'], ['WARNING', 'Скоро']] as Array<[Level, string]>).map(([k, t]) => (
            <button key={k} onClick={() => setLevel(k)} className="h-8 px-3 rounded-full border text-[13px]"
                    style={level === k ? { background: 'var(--ink)', color: 'var(--bg)', borderColor: 'var(--ink)' } : { borderColor: 'var(--ln)' }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin px-2 pb-2">
        {list.slice(0, 150).map(p => {
          const active = selected?.channel_id === p.channel_id;
          const o = objectsById[p.object_id];
          const done = decided[p.channel_id];
          return (
            <button key={p.channel_id} onClick={() => { setSelectedId(p.channel_id); setListOpen(false); setHint(false); }}
                    className="w-full grid grid-cols-[62px_minmax(0,1fr)_18px] items-center gap-2 p-2.5 rounded-2xl text-left transition-colors hover:bg-[var(--sf2)]"
                    style={active ? { background: 'var(--sf2)' } : undefined}>
              <span className="h-[30px] rounded-full flex items-center justify-center text-sm font-semibold"
                    style={done ? { background: 'var(--oks)', color: 'var(--ok)' } : { background: LEVEL_SOFT[p.risk_level], color: LEVEL_VAR[p.risk_level] }}>
                {done ? '✓' : `${Math.round(probabilityOf(p) * 100)}%`}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate">{shortName(p.sensor_name)}</span>
                <span className="block text-xs truncate" style={{ color: 'var(--mut)' }}>{o ? `${o.corridor} · ${o.picket}` : p.object_name}</span>
              </span>
              <ChevronRight className="w-4 h-4" style={{ color: 'var(--mut)' }} />
            </button>
          );
        })}
        {list.length === 0 && <div className="p-6 text-sm text-center" style={{ color: 'var(--mut)' }}>Нет каналов под этот фильтр</div>}
      </div>
    </div>
  );

  const zoom = (
    <div className="glass rounded-full flex flex-col overflow-hidden">
      <button className="w-11 h-11 flex items-center justify-center hover:bg-[var(--sf2)]" aria-label="Приблизить" onClick={() => mapRef.current?.zoomIn()}><Plus className="w-[18px] h-[18px]" /></button>
      <button className="w-11 h-11 flex items-center justify-center border-t hover:bg-[var(--sf2)]" style={{ borderColor: 'var(--ln)' }} aria-label="Отдалить" onClick={() => mapRef.current?.zoomOut()}><Minus className="w-[18px] h-[18px]" /></button>
      <button className="w-11 h-11 flex items-center justify-center border-t hover:bg-[var(--sf2)]" style={{ borderColor: 'var(--ln)' }} aria-label="Вся Москва" onClick={() => mapRef.current?.flyTo(MOSCOW, 11.4, { duration: 0.6 })}><Maximize2 className="w-4 h-4" /></button>
    </div>
  );

  return (
    <div className="relative h-full min-h-0 flex flex-col lg:block">
      {/* map */}
      <div className="relative h-[44vh] shrink-0 lg:absolute lg:inset-0 lg:h-auto">
        <RiskMap objects={objects} pins={pins} selectedObjectId={selected?.object_id} onPick={pickObject} zoom={typeof window !== 'undefined' && window.innerWidth < 1024 ? 10.5 : 11.6} onReady={m => { mapRef.current = m; }} />
        <div className="absolute right-3 bottom-3 z-[500] lg:hidden">{zoom}</div>
      </div>

      {/* desktop overlays */}
      <aside className="hidden lg:flex absolute left-4 top-4 bottom-4 w-[320px] z-[600] glass rounded-[22px] overflow-hidden">{queuePanel}</aside>
      {hint && (
        <div className="hidden xl:flex absolute left-[352px] top-4 z-[600] glass rounded-full items-center gap-3.5 py-2 pl-4 pr-2 text-[13px] rise" style={{ animationDuration: '.5s' }}>
          {['Нажмите на точку', 'Посмотрите, почему', 'Выберите, что делать'].map((t, i) => (
            <React.Fragment key={t}>
              {i > 0 && <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--mut)' }} />}
              <span className="flex items-center gap-1.5">
                <b className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center" style={{ background: 'var(--ac)', color: 'var(--act)' }}>{i + 1}</b>{t}
              </span>
            </React.Fragment>
          ))}
          <button onClick={() => setHint(false)} aria-label="Скрыть подсказку" className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--sf2)', color: 'var(--mut)' }}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      <div className="hidden lg:flex absolute left-[352px] bottom-4 z-[600] glass rounded-full items-center gap-4 px-4 py-2.5 text-[13px]">
        <Legend color="var(--cr)" text="срочно проверить" />
        <Legend color="var(--wr)" text="проверить скоро" />
        <Legend color="var(--ok)" text="решено" />
        <span className="flex items-center gap-1.5" style={{ color: 'var(--mut)' }}><span className="w-3.5 h-[3px] rounded" style={{ background: 'var(--ac)' }} />коллектор</span>
      </div>
      <div className="hidden lg:block absolute right-[476px] bottom-4 z-[600]">{zoom}</div>
      {selected && (
        <div className="hidden lg:flex absolute right-4 top-4 bottom-4 w-[440px] z-[600] rounded-3xl overflow-hidden" style={{ background: 'var(--sf)', boxShadow: 'var(--shadow)' }}>{renderCard(false)}</div>
      )}

      {/* mobile: card under the map, queue in a sheet */}
      <div className="lg:hidden flex-1 min-h-0 -mt-5 relative z-[600] rounded-t-[28px] flex flex-col" style={{ background: 'var(--sf)', boxShadow: 'var(--shadow)' }}>
        <div className="flex items-center justify-between px-5 pt-3">
          <span className="w-10 h-1 rounded mx-auto absolute left-1/2 -translate-x-1/2 top-2" style={{ background: 'var(--ln2)' }} />
          <span className="text-xs mt-2" style={{ color: 'var(--mut)' }}>решено {doneToday} из {today.length}</span>
          <button className="btn btn-secondary !h-9 mt-2" onClick={() => setListOpen(true)}><ListOrdered className="w-4 h-4" />Очередь</button>
        </div>
        <div className="flex-1 min-h-0">{selected && <ChannelCardMobile>{renderCard(true)}</ChannelCardMobile>}</div>
      </div>
      {listOpen && (
        <div className="lg:hidden fixed inset-0 z-[1250] flex items-end" style={{ background: 'rgba(10,10,12,.45)' }} onClick={() => setListOpen(false)}>
          <div className="w-full h-[80vh] rounded-t-[28px] flex flex-col" style={{ background: 'var(--sf)' }} onClick={e => e.stopPropagation()}>{queuePanel}</div>
        </div>
      )}
    </div>
  );
};

const Legend: React.FC<{ color: string; text: string }> = ({ color, text }) => (
  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{text}</span>
);

const ChannelCardMobile: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="h-full flex">{children}</div>;

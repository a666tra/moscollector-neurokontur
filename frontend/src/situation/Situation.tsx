import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  ChevronRight,
  Plus,
  Minus,
  Maximize2,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { ObjectItem, PredictionItem, ConfirmedAlarmItem } from '../types';
import { RiskMap, MOSCOW, MapPin } from './RiskMap';
import { ChannelCard } from './ChannelCard';
import { cleanName, probabilityOf, formatPk } from '../lib/plain';
import { FieldBottomSheet, SnapHeight } from '../field/FieldBottomSheet';
import { useSession } from '../lib/session';

interface Props {
  objects: ObjectItem[];
  predictions: PredictionItem[];
  confirmed: ConfirmedAlarmItem[];
  totalPredictions?: number;
  onChanged: () => void;
  onOpenTickets?: (objectId?: string) => void;
}

const TODAY_SIZE = 12;
type FilterType = 'all' | 'urgent' | 'soon';

/**
 * «Обстановка» (dispatcher situation screen, ТЗ §12, Task R4):
 * - Queue on the left (desktop), shared living RiskMap in the middle, decision card on the right.
 * - Pins/halos with real-time selection and bidirectional hover highlighting.
 * - Resolved channels stop pulsing and display green checkmark.
 * - Mobile layout with FieldBottomSheet (peek/half/full), queue sheet, centered pin.
 * - Keyboard navigation (← →) and accessible button targets >= 44px.
 */
export const Situation: React.FC<Props> = ({
  objects,
  predictions,
  confirmed,
  totalPredictions,
  onChanged,
  onOpenTickets,
}) => {
  const { openShift } = useSession();

  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('ch') || null;
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);

  // Mobile sheet states from URL params or defaults
  const [mobileSnap, setMobileSnap] = useState<SnapHeight>(() => {
    const s = new URLSearchParams(window.location.search).get('snap') as SnapHeight;
    return s === 'peek' || s === 'half' || s === 'full' ? s : 'peek';
  });
  const [mobileTab, setMobileTab] = useState<'card' | 'queue'>(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return t === 'queue' ? 'queue' : 'card';
  });

  const mapRef = useRef<L.Map | null>(null);

  // Open shift / PIN dialog if requested in query param (e.g. ?pin=1)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('pin')) {
      openShift();
    }
  }, [openShift]);

  // Derive decided from confirmed alarms returned by API so it survives reload
  const initialDecided = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of confirmed || []) {
      if (c.channel_id) {
        map[c.channel_id] =
          c.decision === 'CONFIRM_FALSE_ALARM'
            ? `Отбой · ${c.notes || 'ложная тревога'}`
            : `Бригада направлена · ${c.notes || 'выезд'}`;
      }
    }
    return map;
  }, [confirmed]);

  const [localDecided, setLocalDecided] = useState<Record<string, string>>(() => {
    // If URL has ?resolved=1, prefill a demo resolved decision for screenshots/testing
    if (new URLSearchParams(window.location.search).get('resolved') === '1') {
      return { '120117': 'Ремонт запланирован · З-ППР-202610-1026' };
    }
    return {};
  });

  const decided = useMemo(
    () => ({ ...initialDecided, ...localDecided }),
    [initialDecided, localDecided]
  );

  const objectsById = useMemo(
    () => Object.fromEntries(objects.map(o => [o.object_id, o])),
    [objects]
  );

  // Ranked predictions by failure probability
  const ranked = useMemo(
    () =>
      predictions
        .filter(
          p =>
            p.risk_level === 'CRITICAL' ||
            p.risk_level === 'WARNING' ||
            p.risk_level === 'ATTENTION'
        )
        .sort((a, b) => probabilityOf(b) - probabilityOf(a)),
    [predictions]
  );

  // «Сегодня»: top channels per unique object
  const today = useMemo(() => {
    const seen = new Set<string>();
    return ranked
      .filter(
        p =>
          p.risk_level !== 'ATTENTION' &&
          !seen.has(p.object_id) &&
          seen.add(p.object_id)
      )
      .slice(0, TODAY_SIZE);
  }, [ranked]);

  // Filtered queue list based on filter chips
  const list = useMemo(() => {
    return today.filter(p => {
      if (filter === 'urgent') return p.risk_level === 'CRITICAL';
      if (filter === 'soon')
        return p.risk_level === 'WARNING' || p.risk_level === 'ATTENTION';
      return true;
    });
  }, [today, filter]);

  // Currently selected channel
  const selected =
    list.find(p => p.channel_id === selectedId) ??
    today.find(p => p.channel_id === selectedId) ??
    ranked.find(p => p.channel_id === selectedId) ??
    list[0] ??
    today[0] ??
    null;

  const index = selected
    ? Math.max(0, list.findIndex(p => p.channel_id === selected.channel_id))
    : 0;

  // Step next/prev channel
  const step = useCallback(
    (delta: number) => {
      if (!list.length) return;
      const curIdx = selected
        ? list.findIndex(p => p.channel_id === selected.channel_id)
        : 0;
      const nextIdx = (curIdx + delta + list.length) % list.length;
      setSelectedId(list[nextIdx].channel_id);
    },
    [list, selected]
  );

  // Keyboard navigation: Left/Right arrows switch channels when not inside inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toUpperCase() || '';
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step]);

  // Pins for RiskMap
  const pins: MapPin[] = useMemo(
    () =>
      today.map(p => ({
        objectId: p.object_id,
        pct: Math.round(probabilityOf(p) * 100),
        risk: p.risk_level,
        done: !!decided[p.channel_id],
      })),
    [today, decided]
  );

  const doneToday = today.filter(p => decided[p.channel_id]).length;
  const countAll = today.length;
  const countUrgent = today.filter(p => p.risk_level === 'CRITICAL').length;
  const countSoon = today.filter(
    p => p.risk_level === 'WARNING' || p.risk_level === 'ATTENTION'
  ).length;

  const handlePickChannel = (channelId: string) => {
    setSelectedId(channelId);
    setMobileTab('card');
  };

  const handlePickObject = (objectId: string) => {
    const best =
      today.find(p => p.object_id === objectId) ??
      ranked.find(p => p.object_id === objectId);
    if (!best) return;
    setSelectedId(best.channel_id);
    setMobileTab('card');
  };

  const handleMapHover = (objectId: string | null) => {
    setHoveredObjectId(objectId);
    if (objectId) {
      const ch = today.find(p => p.object_id === objectId);
      setHoveredId(ch ? ch.channel_id : null);
    } else {
      setHoveredId(null);
    }
  };

  const onDecided = (cid: string, text: string) => {
    setLocalDecided(d => ({ ...d, [cid]: text }));
    onChanged();
    const next = list.find(
      (p, i) => i > index && !decided[p.channel_id] && p.channel_id !== cid
    );
    if (next) setTimeout(() => setSelectedId(next.channel_id), 800);
  };

  // Queue rows for left panel and mobile sheet
  const renderQueueRows = () => (
    <div className="flex flex-col gap-1" role="list">
      {list.map(p => {
        const isSel = selected?.channel_id === p.channel_id;
        const isHov = hoveredId === p.channel_id || hoveredObjectId === p.object_id;
        const o = objectsById[p.object_id];
        const isDone = !!decided[p.channel_id];
        const pct = Math.round(probabilityOf(p) * 100);
        const isCrit = p.risk_level === 'CRITICAL';

        const badgeBg = isDone ? 'var(--gn)' : isCrit ? 'var(--rds)' : 'var(--ams)';
        const badgeFg = isDone ? '#ffffff' : isCrit ? 'var(--rdt)' : 'var(--amt)';
        const rowBg = isSel ? 'var(--acs)' : isHov ? 'var(--sf2)' : 'transparent';

        return (
          <button
            key={p.channel_id}
            role="listitem"
            onClick={() => handlePickChannel(p.channel_id)}
            onPointerEnter={() => {
              setHoveredId(p.channel_id);
              setHoveredObjectId(p.object_id);
            }}
            onPointerLeave={() => {
              setHoveredId(null);
              setHoveredObjectId(null);
            }}
            className="w-full min-h-[60px] p-2.5 px-3 rounded-[14px] flex items-center gap-3 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--ac)]"
            style={{ background: rowBg, color: 'var(--ink)' }}
          >
            <span
              className="w-[50px] h-[36px] rounded-[11px] flex items-center justify-center font-bold text-[14px] shrink-0 font-variant-numeric:tabular-nums"
              style={{ background: badgeBg, color: badgeFg }}
            >
              {isDone ? <Check className="w-5 h-5 stroke-[2.6]" /> : `${pct}%`}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[15px] truncate leading-tight">
                {cleanName(p.sensor_name)}
              </span>
              <span className="block text-[13px] text-[var(--mu)] truncate mt-0.5">
                {o ? `${o.corridor} · ${formatPk(o.picket)}` : p.object_name}
              </span>
            </span>
            <ChevronRight className="w-[18px] h-[18px] text-[var(--mu)] shrink-0" />
          </button>
        );
      })}
      {list.length === 0 && (
        <div className="py-8 text-center text-[13.5px] text-[var(--mu)]">
          Нет каналов под этот фильтр
        </div>
      )}
    </div>
  );

  const focusOffsetY =
    typeof window !== 'undefined' && window.innerWidth < 1024
      ? mobileSnap === 'peek'
        ? 0.015
        : mobileSnap === 'half'
        ? 0.032
        : 0.048
      : 0;

  return (
    <div className="relative h-full w-full min-h-0 overflow-hidden flex flex-col lg:block select-none">
      {/* 1. Map Canvas */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ isolation: 'isolate', zIndex: 1 }}
      >
        <RiskMap
          objects={objects}
          pins={pins}
          selectedObjectId={selected?.object_id}
          hoveredObjectId={hoveredObjectId}
          onPick={handlePickObject}
          onHover={handleMapHover}
          focusOffsetY={focusOffsetY}
          zoom={typeof window !== 'undefined' && window.innerWidth < 1024 ? 11 : 12}
          onReady={m => {
            mapRef.current = m;
          }}
        />
      </div>

      {/* 2. Desktop Floating Legend (bottom center) */}
      <div
        className="hidden lg:flex absolute left-1/2 -translate-x-1/2 bottom-[18px] z-[500] items-center gap-4 py-2 px-5 rounded-full border shadow-md text-[13.5px] whitespace-nowrap"
        style={{
          background: 'var(--sf)',
          borderColor: 'var(--ln)',
          boxShadow: 'var(--sh)',
          color: 'var(--ink)',
          zIndex: 500,
        }}
      >
        <span className="flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--rd)' }} />
          <span>срочно проверить</span>
        </span>
        <span className="flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--am)' }} />
          <span>проверить скоро</span>
        </span>
        <span className="flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--gn)' }} />
          <span>решено</span>
        </span>
        <span className="flex items-center gap-2">
          <i className="w-4.5 h-[3px] rounded shrink-0" style={{ background: 'var(--ac)' }} />
          <span>коллектор</span>
        </span>
        <span className="font-mono text-[11px] text-[var(--mu)] pl-1">
          карта схематична
        </span>
      </div>

      {/* 3. Desktop Map Zoom Controls */}
      <div
        className="hidden lg:flex flex-col rounded-full overflow-hidden absolute right-[404px] bottom-[68px] z-[500] shadow-md border"
        style={{
          background: 'var(--sf)',
          borderColor: 'var(--ln)',
          boxShadow: 'var(--sh)',
          color: 'var(--ink)',
          zIndex: 500,
        }}
      >
        <button
          className="w-11 h-11 flex items-center justify-center hover:bg-[var(--sf2)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ac)]"
          aria-label="Приблизить"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <Plus className="w-[18px] h-[18px]" />
        </button>
        <button
          className="w-11 h-11 flex items-center justify-center border-t hover:bg-[var(--sf2)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ac)]"
          style={{ borderColor: 'var(--ln)' }}
          aria-label="Отдалить"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <Minus className="w-[18px] h-[18px]" />
        </button>
        <button
          className="w-11 h-11 flex items-center justify-center border-t hover:bg-[var(--sf2)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ac)]"
          style={{ borderColor: 'var(--ln)' }}
          aria-label="Вся Москва"
          onClick={() => mapRef.current?.flyTo(MOSCOW, 11.4, { duration: 0.6 })}
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Desktop Left Panel: «Очередь на сегодня» */}
      <aside
        className="hidden lg:flex absolute left-4 top-4 bottom-4 w-[356px] z-[500] rounded-[24px] border shadow-md flex-col overflow-hidden"
        style={{
          background: 'var(--sf)',
          borderColor: 'var(--ln)',
          boxShadow: 'var(--sh)',
          zIndex: 500,
        }}
      >
        <div className="p-5 pb-3 shrink-0 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="serif text-[28px] font-normal leading-[1.1] text-[var(--ink)]">
              Очередь на сегодня
            </h2>
          </div>
          <div className="text-[13px] text-[var(--mu)] leading-snug">
            {today.length} каналов с самой высокой оценкой · всего в базе{' '}
            {(totalPredictions || predictions.length).toLocaleString('ru-RU')}
          </div>

          {/* Segmented progress bar */}
          <div className="flex items-center gap-2.5 pt-1">
            <div
              className="flex-1 grid gap-1"
              style={{ gridTemplateColumns: `repeat(${today.length || 1}, 1fr)` }}
            >
              {today.map(c => {
                const isDone = !!decided[c.channel_id];
                const isCrit = c.risk_level === 'CRITICAL';
                const bg = isDone ? 'var(--gn)' : isCrit ? 'var(--rds)' : 'var(--ams)';
                return (
                  <i
                    key={c.channel_id}
                    className="h-[7px] rounded-full transition-colors duration-300"
                    style={{ background: bg }}
                  />
                );
              })}
            </div>
            <span className="font-semibold text-[13px] text-[var(--ink)] whitespace-nowrap">
              решено {doneToday} из {today.length}
            </span>
          </div>

          {/* Chips: Все / Срочно / Скоро */}
          <div className="flex gap-2 pt-1">
            {[
              { id: 'all', label: 'Все', count: countAll },
              { id: 'urgent', label: 'Срочно', count: countUrgent },
              { id: 'soon', label: 'Скоро', count: countSoon },
            ].map(ch => {
              const active = filter === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setFilter(ch.id as any)}
                  className="min-h-[44px] px-4 rounded-full border text-[14px] font-semibold flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ac)]"
                  style={
                    active
                      ? { background: 'var(--ink)', color: 'var(--bg)', borderColor: 'var(--ink)' }
                      : { background: 'var(--sf)', color: 'var(--ink)', borderColor: 'var(--ln2)' }
                  }
                >
                  <span>{ch.label}</span>
                  <span style={{ opacity: 0.7 }}>{ch.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Rows */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
          {renderQueueRows()}
        </div>
      </aside>

      {/* 5. Desktop Right Card: Decision card */}
      {selected && (
        <aside
          className="hidden lg:flex absolute right-4 top-4 bottom-4 w-[376px] z-[500] rounded-[24px] border shadow-md flex-col overflow-hidden"
          style={{
            background: 'var(--sf)',
            borderColor: 'var(--ln)',
            boxShadow: 'var(--sh)',
            zIndex: 500,
          }}
        >
          <ChannelCard
            item={selected}
            object={objectsById[selected.object_id]}
            position={index + 1}
            total={list.length}
            done={decided[selected.channel_id]}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onDecided={onDecided}
            onOpenTickets={onOpenTickets}
          />
        </aside>
      )}

      {/* 6. Mobile Layout: Top floating chips + Zoom controls + BottomSheet */}
      <div
        className="lg:hidden absolute top-2.5 left-2.5 right-2.5 z-[500] flex items-center gap-2 overflow-x-auto scrollbar-none pointer-events-auto py-1"
        style={{ zIndex: 500 }}
      >
        {[
          { id: 'all', label: 'Все', count: countAll },
          { id: 'urgent', label: 'Срочно', count: countUrgent },
          { id: 'soon', label: 'Скоро', count: countSoon },
        ].map(ch => {
          const active = filter === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => setFilter(ch.id as any)}
              className="min-h-[44px] px-4 rounded-full border text-[13.5px] font-semibold flex items-center gap-1 shrink-0 shadow-sm transition-colors"
              style={
                active
                  ? { background: 'var(--ink)', color: 'var(--bg)', borderColor: 'var(--ink)' }
                  : { background: 'var(--sf)', color: 'var(--ink)', borderColor: 'var(--ln2)' }
              }
            >
              <span>{ch.label}</span>
              <span style={{ opacity: 0.75 }}>{ch.count}</span>
            </button>
          );
        })}

        {/* Solved badge & Queue sheet trigger */}
        <button
          onClick={() => {
            setMobileTab('queue');
            setMobileSnap('half');
          }}
          className="min-h-[44px] px-3.5 rounded-full border flex items-center gap-1.5 text-[13px] font-semibold shrink-0 shadow-sm transition-colors hover:bg-[var(--sf2)]"
          style={{ background: 'var(--sf)', borderColor: 'var(--ln)', color: 'var(--ink)' }}
        >
          <CheckCircle2 className="w-4 h-4 text-[var(--gn)] shrink-0" />
          <span className="whitespace-nowrap">
            решено {doneToday} из {today.length}
          </span>
        </button>
      </div>

      {/* Mobile Floating Zoom Controls */}
      <div
        className="lg:hidden flex flex-col rounded-full overflow-hidden absolute right-3 bottom-[224px] z-[500] shadow-md border"
        style={{
          background: 'var(--sf)',
          borderColor: 'var(--ln)',
          boxShadow: 'var(--sh)',
          color: 'var(--ink)',
          zIndex: 500,
        }}
      >
        <button
          className="w-11 h-11 flex items-center justify-center hover:bg-[var(--sf2)] transition-colors"
          aria-label="Приблизить"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          className="w-11 h-11 flex items-center justify-center border-t hover:bg-[var(--sf2)] transition-colors"
          style={{ borderColor: 'var(--ln)' }}
          aria-label="Отдалить"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile BottomSheet (FieldBottomSheet reused) */}
      <div className="lg:hidden" style={{ zIndex: 500 }}>
        <FieldBottomSheet snap={mobileSnap} onSnapChange={setMobileSnap} className="!z-[500]">
          {mobileSnap !== 'peek' && (
            <div className="flex gap-1 mx-4 mb-2 p-1 rounded-[14px] shrink-0" style={{ background: 'var(--sf2)' }}>
              <button
                onClick={() => setMobileTab('card')}
                className="flex-1 min-h-[44px] rounded-[11px] font-semibold text-[14px] transition-all"
                style={
                  mobileTab === 'card'
                    ? { background: 'var(--sf)', color: 'var(--ink)', boxShadow: 'var(--sh)' }
                    : { background: 'transparent', color: 'var(--mu)' }
                }
              >
                Канал
              </button>
              <button
                onClick={() => setMobileTab('queue')}
                className="flex-1 min-h-[44px] rounded-[11px] font-semibold text-[14px] transition-all"
                style={
                  mobileTab === 'queue'
                    ? { background: 'var(--sf)', color: 'var(--ink)', boxShadow: 'var(--sh)' }
                    : { background: 'transparent', color: 'var(--mu)' }
                }
              >
                Очередь ({today.length})
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {mobileTab === 'queue' ? (
              <div className="h-full flex flex-col p-4 pt-1 overflow-y-auto">
                <div className="serif text-[22px] font-normal leading-tight text-[var(--ink)] mb-1">
                  Очередь на сегодня
                </div>
                <div className="text-[12px] text-[var(--mu)] mb-3">
                  {today.length} каналов с самой высокой оценкой · всего в базе{' '}
                  {(totalPredictions || predictions.length).toLocaleString('ru-RU')}
                </div>
                <div className="flex-1 overflow-y-auto">{renderQueueRows()}</div>
              </div>
            ) : (
              selected && (
                <ChannelCard
                  item={selected}
                  object={objectsById[selected.object_id]}
                  position={index + 1}
                  total={list.length}
                  done={decided[selected.channel_id]}
                  compact={mobileSnap === 'peek'}
                  onPrev={() => step(-1)}
                  onNext={() => step(1)}
                  onDecided={onDecided}
                  onOpenTickets={onOpenTickets}
                />
              )
            )}
          </div>
        </FieldBottomSheet>
      </div>
    </div>
  );
};

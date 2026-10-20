import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { ObjectItem, PredictionItem, MaintenanceTicket } from '../types';
import { probabilityOf, LEVEL_TEXT } from '../lib/plain';
import { RiskMap, MapPin } from '../situation/RiskMap';
import { FieldList } from './FieldList';
import { FieldObjectCard } from './FieldObjectCard';
import { FieldBottomSheet, SnapHeight } from './FieldBottomSheet';
import { useToast } from '../lib/toast';
import { api } from '../lib/api';

interface Props {
  objects: ObjectItem[];
  predictions: PredictionItem[];
  onOpenTickets: (objectId?: string) => void;
  snapshotDate?: string | null;
}

const RISK_WEIGHT: Record<string, number> = {
  CRITICAL: 3,
  WARNING: 2,
  ATTENTION: 1,
  NORMAL: 0,
};

// Default technician demo position in central Moscow
const DEMO_POS: [number, number] = [55.7512, 37.6184];

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const FieldView: React.FC<Props> = ({
  objects,
  predictions,
  onOpenTickets,
  snapshotDate = '28.01.2026',
}) => {
  const toast = useToast();

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('obj');
    } catch {
      return null;
    }
  });
  const [filter, setFilter] = useState<'all' | 'near' | 'tickets'>(() => {
    try {
      const f = new URLSearchParams(window.location.search).get('filter');
      if (f === 'near' || f === 'tickets') return f;
    } catch {}
    return 'all';
  });
  const [mobileSnap, setMobileSnap] = useState<SnapHeight>(() => {
    try {
      const s = new URLSearchParams(window.location.search).get('snap');
      if (s === 'peek' || s === 'full') return s;
    } catch {}
    return 'half';
  });
  const [isOffline, setIsOffline] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has('offline');
    } catch {
      return false;
    }
  });
  const [offlineQueue, setOfflineQueue] = useState<
    Array<{ id: string; type: string; objectId: string; text: string }>
  >(() => {
    try {
      const stored = localStorage.getItem('nk_tech_queue');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Tickets
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);

  // Step flow state per object: 0 = Не начато, 1 = В пути, 2 = На месте, 3 = Проверено
  const [objectSteps, setObjectSteps] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('nk_tech_steps');
      const fromStore = stored ? JSON.parse(stored) : {};
      const stepParam = new URLSearchParams(window.location.search).get('step');
      const objParam = new URLSearchParams(window.location.search).get('obj');
      if (stepParam && objParam && fromStore[objParam] === undefined) {
        const s = parseInt(stepParam, 10);
        if (!isNaN(s)) return { ...fromStore, [objParam]: s };
      }
      return fromStore;
    } catch {}
    return {};
  });
  // Checklist checked items per object
  const [checklistState, setChecklistState] = useState<Record<string, boolean[]>>(() => {
    try {
      const stored = localStorage.getItem('nk_tech_checklist');
      const fromStore = stored ? JSON.parse(stored) : {};
      const checkParam = new URLSearchParams(window.location.search).get('check');
      const objParam = new URLSearchParams(window.location.search).get('obj');
      if (checkParam && objParam) {
        return { ...fromStore, [objParam]: checkParam.split(',').map(v => v === '1' || v === 'true') };
      }
      return fromStore;
    } catch {}
    return {};
  });
  // SOS help sent status per object
  const [helpSent, setHelpSent] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('nk_tech_help');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  });

  // Geolocation
  const [technicianPos, setTechnicianPos] = useState<[number, number]>(DEMO_POS);
  const [isDemoPosition, setIsDemoPosition] = useState(true);

  // Try real GPS if available and within Moscow bounds
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          if (latitude >= 55.4 && latitude <= 56.1 && longitude >= 37.1 && longitude <= 38.0) {
            setTechnicianPos([latitude, longitude]);
            setIsDemoPosition(false);
          }
        },
        () => {
          // Fallback to demo position
          setTechnicianPos(DEMO_POS);
          setIsDemoPosition(true);
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    }
  }, []);

  // Persist demo states to localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem('nk_tech_steps', JSON.stringify(objectSteps));
    } catch {}
  }, [objectSteps]);

  useEffect(() => {
    try {
      localStorage.setItem('nk_tech_checklist', JSON.stringify(checklistState));
    } catch {}
  }, [checklistState]);

  useEffect(() => {
    try {
      localStorage.setItem('nk_tech_queue', JSON.stringify(offlineQueue));
    } catch {}
  }, [offlineQueue]);

  useEffect(() => {
    try {
      localStorage.setItem('nk_tech_help', JSON.stringify(helpSent));
    } catch {}
  }, [helpSent]);

  const handleResetDemoMarks = useCallback(() => {
    try {
      localStorage.removeItem('nk_tech_steps');
      localStorage.removeItem('nk_tech_checklist');
      localStorage.removeItem('nk_tech_queue');
      localStorage.removeItem('nk_tech_help');
    } catch {}
    setObjectSteps({});
    setChecklistState({});
    setOfflineQueue([]);
    setHelpSent({});
    toast('Демо-отметки сброшены', 'info');
  }, [toast]);

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    try {
      const data = await api<MaintenanceTicket[]>('/api/tickets');
      setTickets(data || []);
      setApiError(null);
    } catch {
      // offline or network issue
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleRefresh = async () => {
    if (isOffline) {
      setApiError('Офлайн-режим. Показаны сохранённые данные.');
      toast('Офлайн-режим: обновление по сети недоступно', 'info');
      return;
    }
    setLoading(true);
    setApiError(null);
    try {
      await fetchTickets();
      toast('Данные обновлены', 'success');
    } catch {
      setApiError('Не удалось обновить данные');
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  };

  // Group tickets by object_id
  const ticketsByObject = useMemo(() => {
    const map = new Map<string, MaintenanceTicket[]>();
    for (const t of tickets) {
      const list = map.get(t.object_id) || [];
      list.push(t);
      map.set(t.object_id, list);
    }
    return map;
  }, [tickets]);

  // Group and sort highest-risk prediction for each object
  const predsByObject = useMemo(() => {
    const map = new Map<string, PredictionItem>();
    for (const p of predictions) {
      const existing = map.get(p.object_id);
      if (!existing) {
        map.set(p.object_id, p);
      } else {
        const curWeight = RISK_WEIGHT[p.risk_level] ?? 0;
        const prevWeight = RISK_WEIGHT[existing.risk_level] ?? 0;
        if (
          curWeight > prevWeight ||
          (curWeight === prevWeight && probabilityOf(p) > probabilityOf(existing))
        ) {
          map.set(p.object_id, p);
        }
      }
    }
    return map;
  }, [predictions]);

  // Object's max calibrated probability across predictions
  const getObjectMaxProb = useMemo(() => {
    const maxProbMap = new Map<string, number>();
    for (const p of predictions) {
      const prob = probabilityOf(p);
      const prev = maxProbMap.get(p.object_id) ?? 0;
      if (prob > prev) maxProbMap.set(p.object_id, prob);
    }
    return (objectId: string) => maxProbMap.get(objectId) ?? 0;
  }, [predictions]);

  // Separate CRITICAL objects (queue), WARNING/ATTENTION (watch), and NORMAL
  const { criticalObjects, watchObjects, normalObjects } = useMemo(() => {
    const critical: ObjectItem[] = [];
    const watch: ObjectItem[] = [];
    const normal: ObjectItem[] = [];

    for (const obj of objects) {
      if (obj.risk_level === 'CRITICAL') {
        critical.push(obj);
      } else if (obj.risk_level === 'WARNING' || obj.risk_level === 'ATTENTION') {
        watch.push(obj);
      } else {
        normal.push(obj);
      }
    }

    // CRITICAL queue sorted by object's max calibrated probability descending
    critical.sort((a, b) => {
      const diff = getObjectMaxProb(b.object_id) - getObjectMaxProb(a.object_id);
      if (Math.abs(diff) > 1e-6) return diff;
      return (b.predicted_failures_count ?? 0) - (a.predicted_failures_count ?? 0);
    });

    // Watch objects sorted by risk level then max probability
    watch.sort((a, b) => {
      const wa = RISK_WEIGHT[a.risk_level] ?? 0;
      const wb = RISK_WEIGHT[b.risk_level] ?? 0;
      if (wb !== wa) return wb - wa;
      return getObjectMaxProb(b.object_id) - getObjectMaxProb(a.object_id);
    });

    normal.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    return { criticalObjects: critical, watchObjects: watch, normalObjects: normal };
  }, [objects, getObjectMaxProb]);

  // Selected object and prediction
  const selectedObject = useMemo(
    () => (selectedObjectId ? objects.find(o => o.object_id === selectedObjectId) : null),
    [objects, selectedObjectId]
  );
  const selectedPred = useMemo(
    () => (selectedObjectId ? predsByObject.get(selectedObjectId) : undefined),
    [predsByObject, selectedObjectId]
  );
  const selectedTicket = useMemo(
    () => (selectedObjectId ? ticketsByObject.get(selectedObjectId)?.[0] : undefined),
    [ticketsByObject, selectedObjectId]
  );

  // Distance helper
  const getDistance = useCallback(
    (obj: ObjectItem) => getDistanceKm(technicianPos[0], technicianPos[1], obj.lat, obj.lon),
    [technicianPos]
  );
  const formatDistance = useCallback((km: number) => `≈ ${km.toFixed(1).replace('.', ',')} км`, []);

  // Map pins
  const pins = useMemo<MapPin[]>(() => {
    return objects
      .filter(o => o.risk_level !== 'NORMAL' || o.object_id === selectedObjectId)
      .map(o => {
        const pred = predsByObject.get(o.object_id);
        const prob = pred ? probabilityOf(pred) : null;
        const step = objectSteps[o.object_id] ?? 0;
        return {
          objectId: o.object_id,
          pct: prob != null ? Math.round(prob * 100) : null,
          risk: o.risk_level || 'NORMAL',
          done: step === 3,
        };
      });
  }, [objects, predsByObject, selectedObjectId, objectSteps]);

  // Offline toggle
  const handleToggleOffline = () => {
    if (!isOffline) {
      setIsOffline(true);
      toast('Включён режим «Офлайн». Данные сохранены на телефоне.', 'info');
    } else {
      setIsOffline(false);
      if (offlineQueue.length > 0) {
        toast(`Связь восстановлена · в пилоте отметки уйдут диспетчеру (${offlineQueue.length})`, 'info');
        setOfflineQueue([]);
      } else {
        toast('Связь восстановлена', 'info');
      }
    }
  };

  // Step and checklist actions
  const handleStepChange = (newStep: number) => {
    if (!selectedObjectId) return;
    setObjectSteps(prev => ({ ...prev, [selectedObjectId]: newStep }));
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('step');
      window.history.replaceState({}, '', u);
    } catch {}

    if (isOffline) {
      setOfflineQueue(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'step_change',
          objectId: selectedObjectId,
          text: `Шаг ${newStep}`,
        },
      ]);
    }
  };

  const handleChecklistToggle = (index: number) => {
    if (!selectedObjectId) return;
    setChecklistState(prev => {
      const current = prev[selectedObjectId] || [];
      const updated = [...current];
      updated[index] = !updated[index];
      return { ...prev, [selectedObjectId]: updated };
    });
  };

  const handleSendHelp = () => {
    if (!selectedObjectId) return;
    setHelpSent(prev => ({ ...prev, [selectedObjectId]: true }));

    if (isOffline) {
      setOfflineQueue(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          type: 'help_signal',
          objectId: selectedObjectId,
          text: 'Сигнал помощи',
        },
      ]);
      toast('Сигнал помощи записан на этом устройстве', 'info');
    } else {
      toast('Сигнал помощи записан на этом устройстве (демо: диспетчеру не отправляется)', 'info');
    }
  };

  const handleSelectObject = (id: string | null) => {
    setSelectedObjectId(id);
    // Выбрали объект — шторка сворачивается в строку-сводку (видна карта и маршрут);
    // вернулись к списку — обычная средняя высота.
    setMobileSnap(id ? 'peek' : 'half');
    try {
      const u = new URL(window.location.href);
      if (id) u.searchParams.set('obj', id);
      else u.searchParams.delete('obj');
      window.history.replaceState({}, '', u);
    } catch {}
  };

  // Auto-advance to next object in critical queue
  const handleNextObject = () => {
    const remaining = criticalObjects.filter(
      o => (objectSteps[o.object_id] ?? 0) < 3 && o.object_id !== selectedObjectId
    );
    if (remaining.length > 0) {
      handleSelectObject(remaining[0].object_id);
    } else {
      handleSelectObject(null);
      toast('Все срочные объекты осмотрены!', 'success');
    }
  };

  const selectedPct = selectedPred
    ? Math.round(probabilityOf(selectedPred) * 100)
    : null;

  const selectedDistanceStr = selectedObject ? formatDistance(getDistance(selectedObject)) : '';

  // У открытой карточки только два положения: строка-сводка и полная карточка.
  const sheetSnap: SnapHeight = selectedObject && mobileSnap === 'half' ? 'full' : mobileSnap;

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top-Left Connection Pill */}
      <div className="absolute left-3.5 top-3.5 z-40 flex items-center gap-2 flex-wrap pointer-events-none max-w-[calc(100vw-28px)]">
        <button
          type="button"
          onClick={handleToggleOffline}
          aria-pressed={isOffline}
          className="pointer-events-auto min-h-[44px] px-3.5 rounded-full flex items-center gap-2 text-xs sm:text-[13px] font-semibold border shadow-md transition-all active:scale-95 cursor-pointer max-w-full"
          style={{
            background: isOffline ? 'var(--ams)' : 'var(--sf)',
            borderColor: isOffline ? 'var(--am)' : 'var(--ln2)',
            color: 'var(--ink)',
          }}
        >
          {isOffline ? (
            <WifiOff className="w-4 h-4 text-[var(--amt)] shrink-0" />
          ) : (
            <Wifi className="w-4 h-4 text-[var(--gn)] shrink-0" />
          )}
          <span className="truncate">
            {isOffline
              ? offlineQueue.length > 0
                ? `Офлайн · отметки на устройстве (${offlineQueue.length})`
                : `Офлайн · данные до ${snapshotDate}`
              : `Есть связь · ${snapshotDate}`}
          </span>
        </button>
      </div>

      {/* Offline Alert Banner */}
      {isOffline && (
        <div
          role="status"
          className="absolute left-3.5 right-3.5 sm:left-4 sm:right-auto sm:max-w-md top-16 z-40 p-3.5 rounded-2xl flex flex-col gap-1.5 text-xs sm:text-[13px] font-medium shadow-lg"
          style={{ background: 'var(--sf)', color: 'var(--ink)', border: '1px solid var(--am)' }}
        >
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-[var(--am)] shrink-0" />
            <span className="font-semibold text-[var(--amt)]">Режим «Офлайн»</span>
          </div>
          <div className="text-[var(--mu)] leading-snug">
            Нет сети. Данные сохранены на телефоне. Демо-режим техника: отметки видны только на этом телефоне и не меняют заявки на сервере.
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleResetDemoMarks}
              className="text-xs text-[var(--mu)] hover:text-[var(--ink)] underline cursor-pointer bg-transparent border-0 p-0"
            >
              Сбросить демо-отметки
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Map */}
      <div className="absolute inset-0 z-0">
        <RiskMap
          objects={objects}
          pins={pins}
          selectedObjectId={selectedObjectId || undefined}
          onPick={id => handleSelectObject(id)}
          interactive={true}
          center={selectedObject ? [selectedObject.lat, selectedObject.lon] : DEMO_POS}
          zoom={13}
          you={technicianPos}
          youLabel={isDemoPosition ? 'Вы здесь (демо-позиция)' : 'Вы здесь'}
          routeTo={selectedObject ? [selectedObject.lat, selectedObject.lon] : null}
          zoomOnSelect={true}
          focusOffsetY={mobileSnap === 'half' ? 0.0035 : 0}
        />
      </div>

      {/* Desktop Floating Right Panel */}
      <aside
        className="hidden lg:flex absolute right-4 top-4 bottom-4 w-[430px] rounded-[26px] overflow-hidden shadow-2xl z-30 flex-col border"
        style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}
      >
        {selectedObject ? (
          <FieldObjectCard
            object={selectedObject}
            highestPred={selectedPred}
            ticket={selectedTicket}
            pct={selectedPct}
            distanceText={selectedDistanceStr}
            isDemoPosition={isDemoPosition}
            step={objectSteps[selectedObject.object_id] ?? 0}
            onStepChange={handleStepChange}
            checklistState={checklistState[selectedObject.object_id] || []}
            onChecklistToggle={handleChecklistToggle}
            onBack={() => handleSelectObject(null)}
            onNextObject={handleNextObject}
            onOpenTickets={onOpenTickets}
            onSendHelp={handleSendHelp}
            helpSent={!!helpSent[selectedObject.object_id]}
            isOffline={isOffline}
            onResetDemoMarks={handleResetDemoMarks}
          />
        ) : (
          <FieldList
            criticalObjects={criticalObjects}
            watchObjects={watchObjects}
            normalObjects={normalObjects}
            predsByObject={predsByObject}
            ticketsByObject={ticketsByObject}
            objectSteps={objectSteps}
            selectedObjectId={selectedObjectId || undefined}
            onSelectObject={id => handleSelectObject(id)}
            getDistance={getDistance}
            formatDistance={formatDistance}
            filter={filter}
            onFilterChange={setFilter}
            snapshotDate={snapshotDate}
            loading={loading}
            onRefresh={handleRefresh}
          />
        )}
      </aside>

      {/* Mobile Draggable Bottom Sheet */}
      <FieldBottomSheet
        snap={sheetSnap}
        onSnapChange={setMobileSnap}
        snaps={selectedObject ? ['peek', 'full'] : undefined}
      >
        {selectedObject ? (
          <FieldObjectCard
            object={selectedObject}
            highestPred={selectedPred}
            ticket={selectedTicket}
            pct={selectedPct}
            distanceText={selectedDistanceStr}
            isDemoPosition={isDemoPosition}
            step={objectSteps[selectedObject.object_id] ?? 0}
            onStepChange={handleStepChange}
            checklistState={checklistState[selectedObject.object_id] || []}
            onChecklistToggle={handleChecklistToggle}
            onBack={() => handleSelectObject(null)}
            onNextObject={handleNextObject}
            onOpenTickets={onOpenTickets}
            onSendHelp={handleSendHelp}
            helpSent={!!helpSent[selectedObject.object_id]}
            isOffline={isOffline}
            onResetDemoMarks={handleResetDemoMarks}
            compact={sheetSnap === 'peek'}
            onExpand={() => setMobileSnap('full')}
          />
        ) : (
          <FieldList
            criticalObjects={criticalObjects}
            watchObjects={watchObjects}
            normalObjects={normalObjects}
            predsByObject={predsByObject}
            ticketsByObject={ticketsByObject}
            objectSteps={objectSteps}
            selectedObjectId={selectedObjectId || undefined}
            onSelectObject={id => handleSelectObject(id)}
            getDistance={getDistance}
            formatDistance={formatDistance}
            filter={filter}
            onFilterChange={setFilter}
            snapshotDate={snapshotDate}
            loading={loading}
            onRefresh={handleRefresh}
          />
        )}
      </FieldBottomSheet>
    </div>
  );
};

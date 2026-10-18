import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Sparkles, Map as MapIcon, RotateCcw, Plus, RefreshCw } from 'lucide-react';
import { MaintenanceTicket, ObjectItem, PredictionItem } from '../types';
import { DecisionLedger } from './DecisionLedger';
import { TicketTiles, TicketTileType } from '../tickets/TicketTiles';
import { TicketStatusTrack, StageCounts } from '../tickets/TicketStatusTrack';
import { TicketRow } from '../tickets/TicketRow';
import { TicketMiniMap } from '../tickets/TicketMiniMap';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { api } from '../lib/api';

interface MaintenanceTicketsProps {
  filterObjectId?: string | null;
  onClearFilter?: () => void;
  onRefreshStats?: () => void;
  objects?: ObjectItem[];
  predictions?: PredictionItem[];
}

export const MaintenanceTickets: React.FC<MaintenanceTicketsProps> = ({
  filterObjectId,
  onClearFilter,
  onRefreshStats,
  objects: initialObjects,
  predictions: initialPredictions,
}) => {
  const { requireDispatcher } = useSession();
  const toast = useToast();

  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [objects, setObjects] = useState<ObjectItem[]>(initialObjects || []);
  const [predictions, setPredictions] = useState<PredictionItem[]>(initialPredictions || []);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tileFilter, setTileFilter] = useState<TicketTileType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAssigningUrgent, setIsAssigningUrgent] = useState(false);
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  // Sync objects and predictions if passed via props
  useEffect(() => {
    if (initialObjects && initialObjects.length > 0) {
      setObjects(initialObjects);
    }
  }, [initialObjects]);

  useEffect(() => {
    if (initialPredictions && initialPredictions.length > 0) {
      setPredictions(initialPredictions);
    }
  }, [initialPredictions]);

  // Fetch tickets, and objects/predictions if not provided
  const fetchTickets = useCallback(async () => {
    try {
      const data = await api<MaintenanceTicket[]>('/api/tickets');
      setTickets(data || []);
    } catch {
      // silently handle network error on initial mount
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();

    if (!initialObjects || initialObjects.length === 0) {
      api<ObjectItem[]>('/api/objects')
        .then((res) => {
          if (res) setObjects(res);
        })
        .catch(() => {});
    }

    if (!initialPredictions || initialPredictions.length === 0) {
      api<{ items: PredictionItem[] }>('/api/predictions?limit=500')
        .then((res) => {
          if (res?.items) setPredictions(res.items);
        })
        .catch(() => {});
    }
  }, [fetchTickets, initialObjects, initialPredictions]);

  // Status change handler (with dispatcher PIN authentication)
  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    const d = await requireDispatcher();
    if (!d) return;

    setStatusUpdatingId(ticketId);
    try {
      const updated = await api<MaintenanceTicket>(`/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        json: {
          new_status: newStatus,
          dispatcher_badge: d.badge,
          dispatcher_pin: d.pin,
        },
      });
      setTickets((prev) => prev.map((t) => (t.ticket_id === ticketId ? updated : t)));
      toast(`Статус наряда ${ticketId} изменён: ${newStatus}`, 'success');
      onRefreshStats?.();
    } catch (err: any) {
      toast(err?.message || 'Не удалось обновить статус наряда', 'error');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Assign brigade selection handler
  const handleSelectBrigade = (ticketId: string, brigadeName: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.ticket_id === ticketId ? { ...t, assigned_team: brigadeName } : t
      )
    );
    toast('Бригада выбрана в этом окне (демо), на сервер не отправлено.', 'info');
  };

  // Candidates for model suggestions: critical predictions that don't yet have tickets
  const candidatePredictions = useMemo(() => {
    const ticketChannelSet = new Set(tickets.map((t) => t.channel_id));
    return predictions
      .filter((p) => p.risk_level === 'CRITICAL' && !ticketChannelSet.has(p.channel_id))
      .slice(0, 5);
  }, [predictions, tickets]);

  // Generate ticket from model prediction (with dispatcher PIN authentication)
  const handleGenerateTicket = async () => {
    const d = await requireDispatcher();
    if (!d) return;

    setIsGenerating(true);
    // Pick the top critical candidate channel, or fallback to known channel
    const targetChannelId = candidatePredictions[0]?.channel_id || '120466';

    try {
      const newTicket = await api<MaintenanceTicket>('/api/tickets/generate', {
        method: 'POST',
        json: {
          channel_id: targetChannelId,
          priority: 'ВЫСОКИЙ',
          notes: 'Автоматическая генерация по факту прогнозирования предаварийного состояния (горизонт 24–72 ч).',
          dispatcher_badge: d.badge,
          dispatcher_pin: d.pin,
        },
      });
      setTickets((prev) => [newTicket, ...prev]);
      setExpandedTicketId(newTicket.ticket_id);
      toast(`Сформирован наряд ${newTicket.ticket_id}`, 'success');
      onRefreshStats?.();
    } catch (err: any) {
      toast(err?.message || 'Не удалось сформировать наряд', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Assign all urgent draft tickets
  const handleAssignAllUrgent = async () => {
    const urgentDrafts = tickets.filter(
      (t) => t.status === 'ЧЕРНОВИК' && (t.priority === 'ВЫСОКИЙ' || t.failure_risk_percent >= 70)
    );
    if (urgentDrafts.length === 0) return;

    const d = await requireDispatcher();
    if (!d) return;

    setIsAssigningUrgent(true);
    try {
      for (const t of urgentDrafts) {
        await api<MaintenanceTicket>(`/api/tickets/${t.ticket_id}/status`, {
          method: 'PATCH',
          json: {
            new_status: 'НАЗНАЧЕН',
            dispatcher_badge: d.badge,
            dispatcher_pin: d.pin,
          },
        });
      }
      await fetchTickets();
      toast(`Все срочные наряды (${urgentDrafts.length}) переданы бригадам`, 'success');
      onRefreshStats?.();
    } catch (err: any) {
      toast(err?.message || 'Не удалось передать все срочные наряды', 'error');
    } finally {
      setIsAssigningUrgent(false);
    }
  };

  // Export TXT order sheet (preserving exact existing download format)
  const handleExportPrint = (ticket: MaintenanceTicket) => {
    const content = `
================================================================================
АО «МОСКОЛЛЕКТОР» — СИСТЕМА «НЕЙРОКОНТУР»
НАРЯД-ЗАКАЗ НА ПЛАНОВО-ПРЕДУПРЕДИТЕЛЬНЫЙ РЕМОНТ (ППР)
№ ${ticket.ticket_id} от ${ticket.created_at}
================================================================================
ОБЪЕКТ: ${ticket.object_name} (ID: ${ticket.object_id})
УЧАСТОК / ТРАССА: ${ticket.corridor}
ПИКЕТ (ПК): ${ticket.picket}
ДАТЧИК: ${ticket.sensor_name} (Канал ID: ${ticket.channel_id})
ТИП ОБОРУДОВАНИЯ: ${ticket.sensor_type}
БАЛЛ РИСКА МОДЕЛИ: ${(ticket.failure_risk_percent / 100).toFixed(3)}
ПРИОРИТЕТ: ${ticket.priority}
ТЕКУЩИЙ СТАТУС: ${ticket.status}

ОСНОВАНИЕ ДЛЯ РАБОТ:
${ticket.regulation_reference}

ОПИСАНИЕ РАБОТ:
${ticket.work_description}

НЕОБХОДИМЫЕ МАТЕРИАЛЫ И ЗИП:
${ticket.required_materials.map((m) => ` - ${m}`).join('\n')}

ОТВЕТСТВЕННАЯ БРИГАДА:
${ticket.assigned_team}

ОЦЕНКА ЗАТРАТ:
Расчетная стоимость ТО: ${ticket.estimated_cost_rub.toLocaleString('ru-RU')} ₽
================================================================================
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Наряд_${ticket.ticket_id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`Наряд ${ticket.ticket_id} скачан (TXT)`, 'success');
  };

  // Counts for top tiles
  const urgentCount = useMemo(() => {
    return tickets.filter(
      (t) => t.status === 'ЧЕРНОВИК' && (t.priority === 'ВЫСОКИЙ' || t.failure_risk_percent >= 70)
    ).length;
  }, [tickets]);

  const soonCount = useMemo(() => {
    return tickets.filter(
      (t) => t.status === 'ЧЕРНОВИК' && !(t.priority === 'ВЫСОКИЙ' || t.failure_risk_percent >= 70)
    ).length;
  }, [tickets]);

  const idleCount = useMemo(() => {
    return tickets.filter((t) => t.status !== 'ЧЕРНОВИК').length;
  }, [tickets]);

  // Counts for status track
  const stageCounts: StageCounts = useMemo(() => {
    return {
      draft: tickets.filter((t) => t.status === 'ЧЕРНОВИК').length,
      assigned: tickets.filter((t) => t.status === 'НАЗНАЧЕН').length,
      work: tickets.filter((t) => t.status === 'В_РАБОТЕ').length,
      done: tickets.filter((t) => t.status === 'ВЫПОЛНЕН').length,
    };
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // 1. External filter by object
      if (filterObjectId && String(t.object_id) !== String(filterObjectId)) return false;

      // 2. Tile filter (Срочно / Скоро / Не трогать)
      if (tileFilter === 'crit') {
        const isCrit = t.status === 'ЧЕРНОВИК' && (t.priority === 'ВЫСОКИЙ' || t.failure_risk_percent >= 70);
        if (!isCrit) return false;
      } else if (tileFilter === 'soon') {
        const isSoon = t.status === 'ЧЕРНОВИК' && !(t.priority === 'ВЫСОКИЙ' || t.failure_risk_percent >= 70);
        if (!isSoon) return false;
      } else if (tileFilter === 'idle') {
        if (t.status === 'ЧЕРНОВИК') return false;
      }

      // 3. Status track stage filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = t.ticket_id.toLowerCase().includes(q);
        const matchObj = t.object_name.toLowerCase().includes(q);
        const matchSensor = t.sensor_name.toLowerCase().includes(q);
        const matchPicket = t.picket.toLowerCase().includes(q);
        const matchChannel = String(t.channel_id).includes(q);
        if (!matchId && !matchObj && !matchSensor && !matchPicket && !matchChannel) return false;
      }

      return true;
    });
  }, [tickets, filterObjectId, tileFilter, statusFilter, searchQuery]);

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setTileFilter('all');
    setSearchQuery('');
    onClearFilter?.();
  };

  const selectedTicket = useMemo(() => {
    return tickets.find((t) => t.ticket_id === expandedTicketId) || null;
  }, [tickets, expandedTicketId]);

  return (
    <div className="space-y-6 sm:space-y-7 pb-10">
      {/* Title */}
      <div>
        <h1 className="serif text-3xl sm:text-[42px] font-normal leading-tight tracking-tight" style={{ color: 'var(--ink)' }}>
          Заявки
        </h1>
      </div>

      {/* External Filter Banner */}
      {filterObjectId && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-amber-500/10 border-amber-500/30 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-500">Фильтр по объекту #{filterObjectId}</span>
            <span style={{ color: 'var(--mu)' }}>
              ({filteredTickets.length} {filteredTickets.length === 1 ? 'наряд' : 'нарядов'})
            </span>
          </div>
          {onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/40 hover:bg-amber-500/20 text-amber-500 cursor-pointer"
            >
              Сбросить фильтр
            </button>
          )}
        </div>
      )}

      {/* Top 3 Tiles: Срочно / Скоро / Не трогать */}
      <TicketTiles
        urgentCount={urgentCount}
        soonCount={soonCount}
        idleCount={idleCount}
        activeTile={tileFilter}
        onSelectTile={(t) => setTileFilter(t)}
        onAssignAllUrgent={handleAssignAllUrgent}
        isAssigningUrgent={isAssigningUrgent}
      />

      {/* Status Track: Новая → Передана → В работе → Готово */}
      <TicketStatusTrack
        counts={stageCounts}
        activeStatus={statusFilter}
        onSelectStatus={(s) => setStatusFilter(s)}
        onDropTicket={(ticketId, targetStatus) => handleStatusChange(ticketId, targetStatus)}
      />

      {/* Mobile Map Toggle Button */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setShowMobileMap(!showMobileMap)}
          className="w-full min-h-[48px] rounded-full border border-[var(--ln2)] bg-transparent flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer"
          style={{ color: 'var(--ink)' }}
        >
          <MapIcon className="w-4 h-4 text-[var(--ac)]" />
          <span>{showMobileMap ? 'Скрыть карту' : 'Показать заявки на карте'}</span>
        </button>
      </div>

      {/* Mobile Mini Map (when toggled open) */}
      {showMobileMap && (
        <div className="lg:hidden">
          <TicketMiniMap
            objects={objects}
            tickets={filteredTickets}
            selectedObjectId={selectedTicket?.object_id}
            onPickObject={(objId) => {
              const matched = filteredTickets.find((t) => t.object_id === objId);
              if (matched) setExpandedTicketId(matched.ticket_id);
            }}
            className="h-[300px]"
          />
        </div>
      )}

      {/* Main Grid: Left List (filtered) + Right Sticky Mini Map (desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-6 lg:gap-8 items-start">
        {/* Left Column: Search Bar & Tickets List */}
        <div className="min-w-0 space-y-3.5">
          {/* Search + Model Suggestions Toolbar */}
          <div
            className="flex items-center gap-3 pb-2.5 border-b-[1.5px]"
            style={{ borderColor: 'var(--ink)' }}
          >
            <label className="flex-1 min-w-[120px] flex items-center gap-2 text-[var(--mu)]">
              <Search className="w-4 h-4 shrink-0 text-[var(--mu)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Номер или объект"
                aria-label="Поиск по заявкам"
                className="w-full border-0 bg-transparent outline-none text-sm sm:text-base font-medium min-h-[44px]"
                style={{ color: 'var(--ink)' }}
              />
            </label>

            {/* Model Suggestions Button */}
            <button
              type="button"
              onClick={handleGenerateTicket}
              disabled={isGenerating}
              aria-label="Сформировать наряд по модели"
              title="Модель подскажет, что проверить и создаст наряд"
              className="relative min-h-[48px] px-4 sm:px-5 rounded-full flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-[var(--onac)] border-0 cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 shrink-0"
              style={{ background: 'var(--ac)' }}
            >
              <Sparkles className={`w-4 h-4 shrink-0 ${isGenerating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isGenerating ? 'Создаём…' : 'Подсказки модели'}
              </span>

              {/* Red counter badge */}
              {candidatePredictions.length > 0 && (
                <span
                  className="absolute -top-1.5 -right-1 min-w-[20px] h-5 rounded-full text-white font-bold text-[11px] leading-5 text-center px-1 border-2 border-[var(--bg)] shadow-sm"
                  style={{ background: 'var(--rd)' }}
                >
                  {candidatePredictions.length}
                </span>
              )}
            </button>
          </div>

          {/* List Count and Filters indicator */}
          <div className="flex items-center justify-between text-xs px-1" style={{ color: 'var(--mu)' }}>
            <span>
              Показано нарядов: <b className="num text-[var(--ink)]">{filteredTickets.length}</b> из {tickets.length}
            </span>
            {(statusFilter !== 'ALL' || tileFilter !== 'all' || searchQuery || filterObjectId) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[var(--ac)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Сбросить фильтры</span>
              </button>
            )}
          </div>

          {/* Tickets List or Empty State */}
          {loading ? (
            <div className="rounded-[22px] border border-[var(--ln)] p-12 text-center text-xs" style={{ color: 'var(--mu)' }}>
              Загрузка наряд-заказов…
            </div>
          ) : filteredTickets.length === 0 ? (
            <div
              className="rounded-[22px] border border-[var(--ln)] p-8 sm:p-12 text-center space-y-3 bg-[var(--sf)]"
              style={{ boxShadow: 'var(--sh)' }}
            >
              <h3 className="serif text-xl sm:text-2xl font-normal" style={{ color: 'var(--ink)' }}>
                Ничего не найдено
              </h3>
              <p className="text-xs sm:text-sm max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--mu)' }}>
                Сбросьте фильтры или измените поисковый запрос, чтобы увидеть все наряды.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-secondary h-10 px-5 text-xs sm:text-sm font-semibold cursor-pointer"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="space-y-2.5" role="list">
              {filteredTickets.map((ticket) => (
                <TicketRow
                  key={ticket.ticket_id}
                  ticket={ticket}
                  isExpanded={expandedTicketId === ticket.ticket_id}
                  onToggleExpand={() =>
                    setExpandedTicketId(
                      expandedTicketId === ticket.ticket_id ? null : ticket.ticket_id
                    )
                  }
                  onStatusChange={handleStatusChange}
                  onFocusMap={(objId) => {
                    setExpandedTicketId(ticket.ticket_id);
                    if (window.innerWidth < 1024) setShowMobileMap(true);
                  }}
                  onDownload={handleExportPrint}
                  onSelectBrigade={handleSelectBrigade}
                  isUpdatingStatus={statusUpdatingId === ticket.ticket_id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column (Desktop): Sticky Mini Map */}
        <div className="hidden lg:block sticky top-4">
          <TicketMiniMap
            objects={objects}
            tickets={filteredTickets}
            selectedObjectId={selectedTicket?.object_id}
            onPickObject={(objId) => {
              const matched = filteredTickets.find((t) => t.object_id === objId);
              if (matched) setExpandedTicketId(matched.ticket_id);
            }}
            className="h-[520px]"
          />
        </div>
      </div>

      {/* Decision Ledger (Visible SHA-256 chain) */}
      <DecisionLedger onRefresh={fetchTickets} />
    </div>
  );
};

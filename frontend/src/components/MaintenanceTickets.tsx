import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Download, CheckCircle, Clock, Wrench, AlertTriangle, Layers
} from 'lucide-react';
import { MaintenanceTicket } from '../types';
import { DecisionLedger } from './DecisionLedger';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { api } from '../lib/api';

interface MaintenanceTicketsProps {
  onRefreshStats?: () => void;
}

const STATUS_TABS = [
  { id: 'ALL', label: 'Все' },
  { id: 'ЧЕРНОВИК', label: 'Черновик' },
  { id: 'НАЗНАЧЕН', label: 'Назначен' },
  { id: 'В_РАБОТЕ', label: 'В работе' },
  { id: 'ВЫПОЛНЕН', label: 'Выполнен' },
];

export const MaintenanceTickets: React.FC<MaintenanceTicketsProps> = ({ onRefreshStats }) => {
  const { requireDispatcher } = useSession();
  const toast = useToast();

  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchTickets = async () => {
    try {
      const data = await api<MaintenanceTicket[]>('/api/tickets');
      setTickets(data || []);
    } catch {
      // silently handle network error on initial mount
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    const d = await requireDispatcher();
    if (!d) return;
    try {
      const updated = await api<MaintenanceTicket>(`/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        json: {
          new_status: newStatus,
          dispatcher_badge: d.badge,
          dispatcher_pin: d.pin,
        },
      });
      setTickets(prev => prev.map(t => (t.ticket_id === ticketId ? updated : t)));
      toast(`Статус наряда ${ticketId} изменён: ${newStatus}`, 'success');
      onRefreshStats?.();
    } catch (err: any) {
      toast(err?.message || 'Не удалось обновить статус наряда', 'error');
    }
  };

  const handleGenerateTicket = async () => {
    const d = await requireDispatcher();
    if (!d) return;
    setIsGenerating(true);
    try {
      const newTicket = await api<MaintenanceTicket>('/api/tickets/generate', {
        method: 'POST',
        json: {
          channel_id: '120466',
          priority: 'ВЫСОКИЙ',
          notes: 'Автоматическая генерация по факту прогнозирования предаварийного состояния (горизонт 24–72 ч).',
          dispatcher_badge: d.badge,
          dispatcher_pin: d.pin,
        },
      });
      setTickets(prev => [newTicket, ...prev]);
      toast(`Сформирован наряд ${newTicket.ticket_id}`, 'success');
      onRefreshStats?.();
    } catch (err: any) {
      toast(err?.message || 'Не удалось сформировать наряд', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

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
${ticket.required_materials.map(m => ` - ${m}`).join('\n')}

ОТВЕТСТВЕННАЯ БРИГАДА:
${ticket.assigned_team}

СЦЕНАРНАЯ ОЦЕНКА ЗАТРАТ:
Расчетная стоимость ТО: ${ticket.estimated_cost_rub.toLocaleString('ru-RU')} ₽
Предотвращенный ущерб аварийного выезда: ${(ticket.estimated_cost_rub + ticket.saved_opex_rub).toLocaleString('ru-RU')} ₽
Сценарная разница затрат: ${ticket.saved_opex_rub.toLocaleString('ru-RU')} ₽
================================================================================
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Наряд_${ticket.ticket_id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchId = t.ticket_id.toLowerCase().includes(q);
        const matchObj = t.object_name.toLowerCase().includes(q);
        const matchSensor = t.sensor_name.toLowerCase().includes(q);
        const matchPicket = t.picket.toLowerCase().includes(q);
        const matchChannel = String(t.channel_id).includes(q);
        if (!matchId && !matchObj && !matchSensor && !matchPicket && !matchChannel) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, searchQuery]);

  const totalSaved = tickets.reduce((acc, t) => acc + (t.saved_opex_rub || 0), 0);
  const activeCount = tickets.filter(t => t.status === 'НАЗНАЧЕН' || t.status === 'В_РАБОТЕ').length;
  const completedCount = tickets.filter(t => t.status === 'ВЫПОЛНЕН').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold">Наряды и заявки ТО</h1>
            <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
              Регламент ТОиР
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Реестр заявок на техническое обслуживание по результатам предиктивного анализа телеметрии
          </p>
        </div>

        <button
          onClick={handleGenerateTicket}
          disabled={isGenerating}
          className="btn btn-primary self-start sm:self-auto h-9 text-xs"
        >
          <Plus className="w-4 h-4" />
          <span>{isGenerating ? 'Формирование…' : 'Сформировать наряд по модели'}</span>
        </button>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="panel p-3.5 space-y-1">
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Всего нарядов</div>
          <div className="num text-2xl font-bold">{tickets.length}</div>
          <div className="text-[11px]" style={{ color: 'var(--faint)' }}>СМВУ Москоллектор</div>
        </div>

        <div className="panel p-3.5 space-y-1">
          <div className="text-xs" style={{ color: 'var(--muted)' }}>В работе бригад</div>
          <div className="num text-2xl font-bold" style={{ color: 'var(--warn)' }}>{activeCount}</div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Назначено или выполняется</div>
        </div>

        <div className="panel p-3.5 space-y-1">
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Выполнено</div>
          <div className="num text-2xl font-bold" style={{ color: 'var(--ok)' }}>{completedCount}</div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Завершенные наряды</div>
        </div>

        <div className="panel p-3.5 space-y-1">
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Предотвращенный ущерб</div>
          <div className="num text-2xl font-bold" style={{ color: 'var(--ok)' }}>
            {(totalSaved / 1000).toFixed(1)} <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>тыс ₽</span>
          </div>
          <div className="text-[11px]" style={{ color: 'var(--faint)' }}>Сценарная разница затрат</div>
        </div>
      </div>

      {/* Filter Toolbar (Segmented Tabs + Priority + Search) */}
      <div className="panel p-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status segmented buttons */}
          <div className="flex gap-1 p-1 rounded-lg overflow-x-auto scroll-thin" style={{ background: 'var(--bg)' }} role="tablist">
            {STATUS_TABS.map(tab => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(tab.id)}
                  className="px-3 h-7 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                  style={active ? { background: 'var(--surface-3)', color: 'var(--text)' } : { color: 'var(--muted)' }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search + Priority */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
              <input
                className="input pl-9 h-8 text-xs"
                placeholder="Поиск по номеру, объекту, ПК…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="input h-8 text-xs w-36 shrink-0"
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              aria-label="Фильтр по приоритету"
            >
              <option value="ALL">Все приоритеты</option>
              <option value="ВЫСОКИЙ">Высокий</option>
              <option value="СРЕДНИЙ">Средний</option>
              <option value="НИЗКИЙ">Низкий</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets List: 2 Columns on desktop (≥1280px), 1 Column below */}
      <div>
        <div className="flex items-center justify-between mb-3 text-xs" style={{ color: 'var(--muted)' }}>
          <span>Найдено нарядов: <span className="num font-semibold text-[var(--text)]">{filteredTickets.length}</span></span>
          <span>Сортировка: новые первыми</span>
        </div>

        {loading ? (
          <div className="panel p-10 text-center text-xs" style={{ color: 'var(--muted)' }}>
            Загрузка наряд-заказов…
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="panel p-10 text-center text-xs" style={{ color: 'var(--muted)' }}>
            Нет нарядов, соответствующих выбранным фильтрам
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredTickets.map(ticket => {
              const priorityClass =
                ticket.priority === 'ВЫСОКИЙ'
                  ? 'risk-CRITICAL'
                  : ticket.priority === 'СРЕДНИЙ'
                    ? 'risk-WARNING'
                    : 'risk-NORMAL';

              const statusChipClass =
                ticket.status === 'ВЫПОЛНЕН'
                  ? 'risk-NORMAL'
                  : ticket.status === 'В_РАБОТЕ'
                    ? 'risk-WARNING'
                    : ticket.status === 'НАЗНАЧЕН'
                      ? 'risk-ATTENTION'
                      : '';

              const riskPercent = Math.round(ticket.failure_risk_percent);

              return (
                <div
                  key={ticket.ticket_id}
                  className="panel p-4 flex flex-col justify-between space-y-3 transition-colors hover:border-[var(--line-2)]"
                >
                  {/* Top line: chips & IDs */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`chip ${priorityClass}`}>
                        {ticket.priority}
                      </span>
                      <span className="num font-semibold text-sm">
                        {ticket.ticket_id}
                      </span>
                      <span
                        className={`chip ${statusChipClass}`}
                        style={!statusChipClass ? { background: 'var(--surface-2)', color: 'var(--muted)' } : undefined}
                      >
                        {ticket.status === 'В_РАБОТЕ' ? 'В работе' : ticket.status === 'ЧЕРНОВИК' ? 'Черновик' : ticket.status === 'НАЗНАЧЕН' ? 'Назначен' : 'Выполнен'}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="num font-bold text-sm" style={{ color: 'var(--ok)' }}>
                        +{ticket.saved_opex_rub.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="num text-[11px]" style={{ color: 'var(--muted)' }}>
                        Риск: {riskPercent}%
                      </div>
                    </div>
                  </div>

                  {/* Location & Sensor */}
                  <div className="space-y-1 text-xs">
                    <div className="font-medium truncate text-sm">
                      {ticket.sensor_name} <span className="num text-xs font-normal" style={{ color: 'var(--muted)' }}>(#{ticket.channel_id})</span>
                    </div>
                    <div className="truncate" style={{ color: 'var(--muted)' }}>
                      {ticket.object_name} · ПК <span className="num">{ticket.picket}</span> · {ticket.corridor}
                    </div>
                  </div>

                  {/* Work description (2 lines clamped) */}
                  <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {ticket.work_description}
                  </p>

                  {/* Materials chips */}
                  {ticket.required_materials && ticket.required_materials.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {ticket.required_materials.slice(0, 3).map((mat, i) => (
                        <span key={i} className="chip text-[11px]" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                          {mat}
                        </span>
                      ))}
                      {ticket.required_materials.length > 3 && (
                        <span className="chip text-[11px]" style={{ background: 'var(--surface-2)', color: 'var(--faint)' }}>
                          +{ticket.required_materials.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bottom line: brigade & actions */}
                  <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--line)' }}>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      Бригада: <span className="font-medium text-[var(--text)]">{ticket.assigned_team}</span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        onClick={() => handleExportPrint(ticket)}
                        className="icon-btn h-8 w-8"
                        title="Скачать бланк наряда (TXT)"
                        aria-label="Скачать бланк"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {ticket.status === 'ЧЕРНОВИК' && (
                        <button
                          onClick={() => handleStatusChange(ticket.ticket_id, 'НАЗНАЧЕН')}
                          className="btn btn-secondary h-8 text-xs"
                        >
                          Назначить
                        </button>
                      )}

                      {ticket.status === 'НАЗНАЧЕН' && (
                        <button
                          onClick={() => handleStatusChange(ticket.ticket_id, 'В_РАБОТЕ')}
                          className="btn btn-secondary h-8 text-xs"
                        >
                          В работу
                        </button>
                      )}

                      {ticket.status === 'В_РАБОТЕ' && (
                        <button
                          onClick={() => handleStatusChange(ticket.ticket_id, 'ВЫПОЛНЕН')}
                          className="btn btn-primary h-8 text-xs"
                        >
                          Выполнить
                        </button>
                      )}

                      {ticket.status === 'ВЫПОЛНЕН' && (
                        <button
                          onClick={() => handleStatusChange(ticket.ticket_id, 'В_РАБОТЕ')}
                          className="btn btn-secondary h-8 text-xs"
                          title="Вернуть в работу"
                        >
                          Вернуть
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decision Ledger Table (SHA-256) rendered below tickets */}
      <DecisionLedger onRefresh={fetchTickets} />
    </div>
  );
};

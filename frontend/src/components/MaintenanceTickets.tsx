import React, { useState, useEffect } from 'react';
import { 
  Wrench, CheckCircle, Download, ShieldAlert, Sparkles, Check
} from 'lucide-react';
import { MaintenanceTicket } from '../types';
import { DemoAccessHint } from './DemoAccessHint';

interface MaintenanceTicketsProps {
  onRefreshStats?: () => void;
}

export const MaintenanceTickets: React.FC<MaintenanceTicketsProps> = ({ onRefreshStats }) => {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dispatcherBadge, setDispatcherBadge] = useState('');
  const [dispatcherPin, setDispatcherPin] = useState('');
  const hasCredentials = Boolean(dispatcherBadge.trim() && /^\d{6}$/.test(dispatcherPin));

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
        if (data.length > 0 && !selectedTicket) {
          setSelectedTicket(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load tickets', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    if (!hasCredentials) {
      setErrorMessage('Для изменения статуса введите табельный номер и 6-значный PIN.');
      return;
    }
    try {
      setErrorMessage(null);
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_status: newStatus,
          dispatcher_badge: dispatcherBadge,
          dispatcher_pin: dispatcherPin
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setTickets(prev => prev.map(t => t.ticket_id === ticketId ? updated : t));
        if (selectedTicket?.ticket_id === ticketId) {
          setSelectedTicket(updated);
        }
        setNotice(`Статус наряда ${ticketId} изменён на "${newStatus}"`);
        setTimeout(() => setNotice(null), 3000);
        onRefreshStats?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.detail || 'Не удалось изменить статус наряда.');
      }
    } catch (e) {
      console.error('Failed to update status', e);
      setErrorMessage('Сетевая ошибка при изменении статуса наряда.');
    }
  };

  const handleGenerateTicket = async () => {
    if (!hasCredentials) {
      setErrorMessage('Для создания наряда введите табельный номер и 6-значный PIN.');
      return;
    }
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/tickets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: '120466',
          priority: 'ВЫСОКИЙ',
          notes: 'Автоматическая генерация по факту прогнозирования предаварийного состояния (горизонт 24–72 ч).',
          dispatcher_badge: dispatcherBadge,
          dispatcher_pin: dispatcherPin
        })
      });
      if (res.ok) {
        const newTicket = await res.json();
        setTickets(prev => [newTicket, ...prev]);
        setSelectedTicket(newTicket);
        setNotice(`Сформирован новый наряд-заказ ${newTicket.ticket_id}`);
        setTimeout(() => setNotice(null), 3500);
        onRefreshStats?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.detail || 'Не удалось создать наряд.');
      }
    } catch (e) {
      console.error('Failed to generate ticket', e);
      setErrorMessage('Сетевая ошибка при создании наряда.');
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

  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = t.ticket_id.toLowerCase().includes(q);
      const matchObj = t.object_name.toLowerCase().includes(q);
      const matchSensor = t.sensor_name.toLowerCase().includes(q);
      const matchPicket = t.picket.toLowerCase().includes(q);
      if (!matchId && !matchObj && !matchSensor && !matchPicket) return false;
    }
    return true;
  });

  const totalSaved = tickets.reduce((acc, t) => acc + (t.saved_opex_rub || 0), 0);
  const activeCount = tickets.filter(t => t.status === 'НАЗНАЧЕН' || t.status === 'В_РАБОТЕ').length;
  const completedCount = tickets.filter(t => t.status === 'ВЫПОЛНЕН').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notice && (
        <div className="p-3 bg-[#2FBF71]/15 border border-[#2FBF71]/30 text-[#2FBF71] text-xs rounded-lg flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-white hover:text-[#2FBF71] cursor-pointer">✕</button>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 bg-[#F0453A]/15 border border-[#F0453A]/30 text-[#F0453A] text-xs rounded-lg flex items-center gap-2" role="alert">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Dispatcher authentication panel with DemoAccessHint */}
      <div className="eng-panel p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[#E7EAF0]">Авторизация дежурного диспетчера</div>
            <p className="text-xs text-[#9AA3B2] mt-0.5">
              Для формирования нарядов и изменения статусов выполнения введите табельный номер и PIN.
            </p>
          </div>
          <DemoAccessHint onFill={(b, p) => { setDispatcherBadge(b); setDispatcherPin(p); }} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1">
          <div className="flex-1">
            <label className="text-xs text-[#9AA3B2] block mb-1">Табельный номер</label>
            <input
              type="text"
              value={dispatcherBadge}
              onChange={e => setDispatcherBadge(e.target.value)}
              autoComplete="off"
              placeholder="ДИСП-7041"
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-1.5 text-[#E7EAF0] text-xs focus:border-[#7C4DFF] focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-[#9AA3B2] block mb-1">PIN-код (6 цифр)</label>
            <input
              type="password"
              value={dispatcherPin}
              onChange={e => setDispatcherPin(e.target.value)}
              maxLength={6}
              inputMode="numeric"
              autoComplete="new-password"
              placeholder="••••••"
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-1.5 text-[#E7EAF0] text-xs font-mono tracking-widest focus:border-[#7C4DFF] focus:outline-none"
            />
          </div>
          {!hasCredentials && (
            <p className="text-xs text-[#6B7385] sm:max-w-56 pb-1">
              Режим просмотра. Для редактирования введите данные диспетчера.
            </p>
          )}
        </div>
      </div>

      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#E7EAF0]">
              Управление нарядами ТО и ППР
            </h2>
            <span className="eng-badge badge-cyan">Регламент ТОиР</span>
          </div>
          <p className="text-xs text-[#9AA3B2] mt-1">
            Реестр заявок на техническое обслуживание по результатам предиктивного анализа телеметрии СМВУ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateTicket}
            disabled={isGenerating || !hasCredentials}
            className="px-4 py-2 bg-[#7C4DFF] hover:bg-[#9170FF] disabled:opacity-40 text-white font-medium text-xs rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'Формирование...' : '+ Сформировать наряд по модели'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="eng-panel p-4">
          <div className="text-xs text-[#9AA3B2]">Всего нарядов в базе</div>
          <div className="text-2xl font-bold font-mono text-[#E7EAF0] mt-1">{tickets.length}</div>
          <div className="text-xs text-[#6B7385] mt-1">СМВУ Москоллектор</div>
        </div>

        <div className="eng-panel p-4">
          <div className="text-xs text-[#9AA3B2]">В работе бригад</div>
          <div className="text-2xl font-bold font-mono text-[#F5A524] mt-1">{activeCount}</div>
          <div className="text-xs text-[#F5A524]/80 mt-1">Назначено или в работе</div>
        </div>

        <div className="eng-panel p-4">
          <div className="text-xs text-[#9AA3B2]">Выполнено</div>
          <div className="text-2xl font-bold font-mono text-[#2FBF71] mt-1">{completedCount}</div>
          <div className="text-xs text-[#2FBF71]/80 mt-1">Завершённые заявки</div>
        </div>

        <div className="eng-panel p-4">
          <div className="text-xs text-[#9AA3B2]">Сценарный потенциал</div>
          <div className="text-2xl font-bold font-mono text-[#4C9BFF] mt-1">
            {(totalSaved / 1000).toFixed(1)} <span className="text-xs text-[#9AA3B2]">тыс ₽</span>
          </div>
          <div className="text-xs text-[#6B7385] mt-1">Предотвращённый ущерб</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121620] p-3 rounded-xl border border-white/10">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[#9AA3B2] mr-1">Статус:</span>
          {(['ALL', 'ЧЕРНОВИК', 'НАЗНАЧЕН', 'В_РАБОТЕ', 'ВЫПОЛНЕН'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                statusFilter === st 
                  ? 'bg-[#7C4DFF] text-white font-medium' 
                  : 'text-[#9AA3B2] hover:text-[#E7EAF0] hover:bg-white/5'
              }`}
            >
              {st === 'ALL' ? 'Все' : st === 'В_РАБОТЕ' ? 'В работе' : st === 'ЧЕРНОВИК' ? 'Черновик' : st === 'НАЗНАЧЕН' ? 'Назначен' : 'Выполнен'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Поиск по номеру, датчику, ПК..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 bg-[#0B0E14] border border-white/10 rounded-lg text-xs text-[#E7EAF0] placeholder-[#6B7385] focus:outline-none focus:border-[#7C4DFF] w-64"
          />
        </div>
      </div>

      {/* Main Grid: Ticket List + Selected Ticket Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tickets Table */}
        <div className="lg:col-span-7 eng-panel overflow-hidden">
          <div className="p-3.5 border-b border-white/10 flex justify-between items-center bg-[#181D29]">
            <span className="text-xs font-semibold text-[#E7EAF0]">
              Реестр наряд-заказов ({filteredTickets.length})
            </span>
            <span className="text-xs text-[#9AA3B2]">
              Сортировка: по дате формирования
            </span>
          </div>

          <div className="divide-y divide-white/5 max-h-[560px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-[#9AA3B2] text-xs">
                Загрузка наряд-заказов…
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-[#9AA3B2] text-xs">
                Нет нарядов, соответствующих выбранным фильтрам
              </div>
            ) : (
              filteredTickets.map(ticket => {
                const isSelected = selectedTicket?.ticket_id === ticket.ticket_id;
                return (
                  <div
                    key={ticket.ticket_id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-white/10 border-l-2 border-[#7C4DFF]' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[#E7EAF0]">
                            {ticket.ticket_id}
                          </span>
                          <span className={`eng-badge text-xs ${
                            ticket.priority === 'ВЫСОКИЙ' ? 'badge-critical' : 'badge-warning'
                          }`}>
                            {ticket.priority}
                          </span>
                          <span className={`eng-badge text-xs ${
                            ticket.status === 'ВЫПОЛНЕН' ? 'badge-normal' :
                            ticket.status === 'В_РАБОТЕ' ? 'badge-warning' :
                            ticket.status === 'НАЗНАЧЕН' ? 'badge-cyan' : 'bg-white/5 text-[#9AA3B2] border border-white/10'
                          }`}>
                            {ticket.status === 'В_РАБОТЕ' ? 'В РАБОТЕ' : ticket.status}
                          </span>
                        </div>
                        <div className="text-xs text-[#E7EAF0] mt-1 font-medium">
                          {ticket.sensor_name}
                        </div>
                        <div className="text-xs text-[#9AA3B2] mt-0.5">
                          {ticket.object_name} · <span className="font-mono">{ticket.picket}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono text-[#2FBF71] font-semibold">
                          +{ticket.saved_opex_rub.toLocaleString('ru-RU')} ₽
                        </div>
                        <div className="text-xs text-[#9AA3B2] font-mono mt-1">
                          Балл {(ticket.failure_risk_percent / 100).toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Ticket Card Details */}
        <div className="lg:col-span-5">
          {selectedTicket ? (
            <div className="eng-panel p-5 space-y-4 sticky top-16">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs text-[#9AA3B2]">Наряд-заказ на ППР</div>
                  <h3 className="text-base font-bold text-[#E7EAF0] font-mono mt-0.5">
                    {selectedTicket.ticket_id}
                  </h3>
                  <div className="text-xs text-[#9AA3B2] mt-0.5">
                    Создан: {selectedTicket.created_at}
                  </div>
                </div>

                <button
                  onClick={() => handleExportPrint(selectedTicket)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-[#E7EAF0] flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Скачать бланк наряда"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Печать бланка</span>
                </button>
              </div>

              {/* Status Flow Control */}
              <div>
                <label className="text-xs text-[#9AA3B2] block mb-2">Изменить статус выполнения:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['ЧЕРНОВИК', 'НАЗНАЧЕН', 'В_РАБОТЕ', 'ВЫПОЛНЕН'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(selectedTicket.ticket_id, st)}
                      disabled={!hasCredentials || selectedTicket.status === st}
                      className={`py-1.5 text-xs rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        selectedTicket.status === st
                          ? 'bg-[#7C4DFF] text-white border-[#7C4DFF] font-medium'
                          : 'text-[#9AA3B2] border-white/10 hover:text-[#E7EAF0] hover:bg-white/5'
                      }`}
                    >
                      {st === 'В_РАБОТЕ' ? 'В работе' : st === 'ЧЕРНОВИК' ? 'Черновик' : st === 'НАЗНАЧЕН' ? 'Назначен' : 'Выполнен'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Object & Location Info */}
              <div className="bg-[#0B0E14] p-3.5 rounded-lg border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#9AA3B2]">Диспетчерский узел:</span>
                  <span className="text-[#E7EAF0] font-medium">{selectedTicket.object_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9AA3B2]">Трасса / сектор:</span>
                  <span className="text-[#E7EAF0]">{selectedTicket.corridor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9AA3B2]">Пикет (ПК):</span>
                  <span className="text-[#4C9BFF] font-mono font-semibold">{selectedTicket.picket}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9AA3B2]">Датчик / Канал:</span>
                  <span className="text-[#E7EAF0] font-mono">#{selectedTicket.channel_id} ({selectedTicket.sensor_type})</span>
                </div>
              </div>

              {/* Description & Regulations */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#9AA3B2] block mb-1">Нормативное основание:</span>
                  <div className="text-[#E7EAF0] bg-[#0B0E14] p-2.5 rounded-lg border border-white/5 text-xs">
                    {selectedTicket.regulation_reference}
                  </div>
                </div>

                <div>
                  <span className="text-[#9AA3B2] block mb-1">Содержание регламентных работ:</span>
                  <div className="text-[#E7EAF0] bg-[#0B0E14] p-2.5 rounded-lg border border-white/5 leading-relaxed text-xs">
                    {selectedTicket.work_description}
                  </div>
                </div>
              </div>

              {/* Required Materials & Brigade */}
              <div className="space-y-3 text-xs border-t border-white/10 pt-3">
                <div>
                  <span className="text-[#9AA3B2] block mb-1.5">Необходимые инструменты и ЗИП:</span>
                  <ul className="space-y-1">
                    {selectedTicket.required_materials.map((m, i) => (
                      <li key={i} className="flex items-center gap-2 text-[#E7EAF0]">
                        <Check className="w-3 h-3 text-[#2FBF71]" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-[#9AA3B2]">Исполнитель:</span>
                  <span className="text-[#E7EAF0] font-medium text-xs bg-white/5 px-2.5 py-1 rounded-lg">
                    {selectedTicket.assigned_team}
                  </span>
                </div>
              </div>

              {/* Financial Box */}
              <div className="bg-[#181D29] border border-white/10 p-3.5 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <div className="text-[#9AA3B2] text-xs">Сценарная разница затрат</div>
                  <div className="text-lg font-bold font-mono text-[#2FBF71]">
                    +{selectedTicket.saved_opex_rub.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
                <div className="text-right text-xs text-[#9AA3B2] font-mono">
                  Затраты на ТО: {selectedTicket.estimated_cost_rub.toLocaleString('ru-RU')} ₽<br />
                  Аварийный выезд: {(selectedTicket.estimated_cost_rub + selectedTicket.saved_opex_rub).toLocaleString('ru-RU')} ₽
                </div>
              </div>
            </div>
          ) : (
            <div className="eng-panel p-8 text-center text-[#9AA3B2] text-xs">
              Выберите наряд из списка слева для просмотра параметров
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

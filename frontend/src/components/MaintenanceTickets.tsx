import React, { useState, useEffect } from 'react';
import { 
  Wrench, CheckCircle, Clock, AlertTriangle, Filter, Plus, 
  FileText, Download, UserCheck, ShieldAlert, Sparkles, ChevronRight, Check
} from 'lucide-react';
import { MaintenanceTicket } from '../types';

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
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status?new_status=${encodeURIComponent(newStatus)}`, {
        method: 'PATCH'
      });
      if (res.ok) {
        const updated = await res.json();
        setTickets(prev => prev.map(t => t.ticket_id === ticketId ? updated : t));
        if (selectedTicket?.ticket_id === ticketId) {
          setSelectedTicket(updated);
        }
        setNotice(`Статус наряда ${ticketId} изменен на "${newStatus}"`);
        setTimeout(() => setNotice(null), 3000);
        onRefreshStats?.();
      }
    } catch (e) {
      console.error('Failed to update status', e);
    }
  };

  const handleGenerateTicket = async () => {
    setIsGenerating(true);
    try {
      // Create ticket for random or first critical sensor
      const res = await fetch('/api/tickets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: '120466',
          priority: 'ВЫСОКИЙ',
          notes: 'Автоматическая генерация по факту прогнозирования предаварийного состояния (горизонт 24ч).'
        })
      });
      if (res.ok) {
        const newTicket = await res.json();
        setTickets(prev => [newTicket, ...prev]);
        setSelectedTicket(newTicket);
        setNotice(`Сформирован новый наряд-заказ ${newTicket.ticket_id}`);
        setTimeout(() => setNotice(null), 3500);
        onRefreshStats?.();
      }
    } catch (e) {
      console.error('Failed to generate ticket', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPrint = (ticket: MaintenanceTicket) => {
    const content = `
================================================================================
АО «МОСКОЛЛЕКТОР» — СЛУЖБА ДИСПЕТЧЕРИЗАЦИИ И НАДЗОРА
НАРЯД-ЗАКАЗ НА ПЛАНОВО-ПРЕДУПРЕДИТЕЛЬНЫЙ РЕМОНТ (ППР / ТО)
№ ${ticket.ticket_id} от ${ticket.created_at}
================================================================================
ОБЪЕКТ: ${ticket.object_name} (ID: ${ticket.object_id})
УЧАСТОК / ТРАССА: ${ticket.corridor}
ПИКЕТ (ПК): ${ticket.picket}
ДАТЧИК: ${ticket.sensor_name} (Канал ID: ${ticket.channel_id})
ТИП ОБОРУДОВАНИЯ: ${ticket.sensor_type}
ВЕРОЯТНОСТЬ ОТКАЗА (ML): ${ticket.failure_risk_percent}%
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

ЭКОНОМИЧЕСКИЙ ЭФФЕКТ:
Расчетная стоимость ТО: ${ticket.estimated_cost_rub.toLocaleString('ru-RU')} ₽
Предотвращенный ущерб аварийного выезда: ${(ticket.estimated_cost_rub + ticket.saved_opex_rub).toLocaleString('ru-RU')} ₽
ЧИСТАЯ ЭКОНОМИЯ OPEX: ${ticket.saved_opex_rub.toLocaleString('ru-RU')} ₽
================================================================================
Подпись диспетчера ОДС: __________________ (Шифр оператора: 7041-СМВУ)
Подпись производителя работ: ____________
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
        <div className="p-3 bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] font-mono text-xs rounded flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-white hover:text-[#00FF66]">✕</button>
        </div>
      )}

      {/* Top Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-wide">
              Управление нарядами ТО и ППР
            </h2>
            <span className="eng-badge badge-cyan font-mono">Регламент Р ТЭК</span>
          </div>
          <p className="text-xs text-[#8B949E] mt-1">
            Автоматическое формирование заказ-нарядов на превентивный ремонт до наступления аварийных отказов
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateTicket}
            disabled={isGenerating}
            className="px-4 py-2 bg-[#00FF66] hover:bg-[#00FF66]/90 disabled:opacity-50 text-black font-semibold text-xs rounded flex items-center gap-2 cursor-pointer transition-all shadow-[0_0_16px_rgba(0,255,102,0.2)]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'Формирование...' : '+ Сформировать наряд по ИИ'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="eng-panel p-4">
          <div className="text-[11px] text-[#8B949E] uppercase font-mono">Всего нарядов в базе</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{tickets.length}</div>
          <div className="text-[11px] text-[#8B949E] mt-1 font-mono">СМВУ Москоллектор</div>
        </div>

        <div className="eng-panel p-4">
          <div className="text-[11px] text-[#8B949E] uppercase font-mono">В работе бригад</div>
          <div className="text-2xl font-bold font-mono text-[#FFB800] mt-1">{activeCount}</div>
          <div className="text-[11px] text-[#FFB800]/80 mt-1 font-mono">Назначены на трассы</div>
        </div>

        <div className="eng-panel p-4">
          <div className="text-[11px] text-[#8B949E] uppercase font-mono">Успешно закрыто</div>
          <div className="text-2xl font-bold font-mono text-[#00FF66] mt-1">{completedCount}</div>
          <div className="text-[11px] text-[#00FF66]/80 mt-1 font-mono">Отказ устранен</div>
        </div>

        <div className="eng-panel p-4">
          <div className="text-[11px] text-[#8B949E] uppercase font-mono">Сбереженный OPEX</div>
          <div className="text-2xl font-bold font-mono text-[#58A6FF] mt-1">
            {(totalSaved / 1000).toFixed(1)} <span className="text-xs text-[#8B949E]">тыс ₽</span>
          </div>
          <div className="text-[11px] text-[#58A6FF]/80 mt-1 font-mono">Без холостых выездов</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1117] p-3 rounded border border-white/5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#8B949E] font-mono mr-1">Статус:</span>
          {(['ALL', 'ЧЕРНОВИК', 'НАЗНАЧЕН', 'В_РАБОТЕ', 'ВЫПОЛНЕН'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer ${
                statusFilter === st 
                  ? 'bg-white/10 text-white border-white/30' 
                  : 'text-[#8B949E] border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              {st === 'ALL' ? 'Все' : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Поиск по номеру, датчику, ПК..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 bg-[#07090E] border border-white/10 rounded text-xs text-white placeholder-[#8B949E] focus:outline-none focus:border-[#00FF66] w-64 font-mono"
          />
        </div>
      </div>

      {/* Main Grid: Ticket List + Selected Ticket Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tickets Table */}
        <div className="lg:col-span-7 eng-panel overflow-hidden">
          <div className="p-3 border-b border-white/10 flex justify-between items-center bg-[#12161F]">
            <span className="font-mono text-xs text-white uppercase tracking-wider">
              Реестр наряд-заказов ({filteredTickets.length})
            </span>
            <span className="text-[11px] text-[#8B949E] font-mono">
              Сортировка: по дате формирования
            </span>
          </div>

          <div className="divide-y divide-white/5 max-h-[560px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-[#8B949E] font-mono text-xs">
                Загрузка наряд-заказов...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-[#8B949E] font-mono text-xs">
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
                      isSelected ? 'bg-white/10 border-l-2 border-[#00FF66]' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-white">
                            {ticket.ticket_id}
                          </span>
                          <span className={`eng-badge text-[10px] ${
                            ticket.priority === 'ВЫСОКИЙ' ? 'badge-critical' : 'badge-warning'
                          }`}>
                            {ticket.priority}
                          </span>
                          <span className={`eng-badge text-[10px] ${
                            ticket.status === 'ВЫПОЛНЕН' ? 'badge-normal' :
                            ticket.status === 'В_РАБОТЕ' ? 'badge-warning' :
                            ticket.status === 'НАЗНАЧЕН' ? 'badge-cyan' : 'bg-white/5 text-[#8B949E] border border-white/10'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>
                        <div className="text-xs text-white mt-1 font-medium">
                          {ticket.sensor_name}
                        </div>
                        <div className="text-[11px] text-[#8B949E] font-mono mt-0.5">
                          {ticket.object_name} • {ticket.picket}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono text-[#00FF66]">
                          +{ticket.saved_opex_rub.toLocaleString('ru-RU')} ₽
                        </div>
                        <div className="text-[10px] text-[#8B949E] font-mono mt-1">
                          Риск {ticket.failure_risk_percent}%
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
            <div className="eng-panel p-5 space-y-5 sticky top-4">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs text-[#8B949E] font-mono">Наряд-заказ на ППР</div>
                  <h3 className="text-base font-bold text-white font-mono mt-0.5">
                    {selectedTicket.ticket_id}
                  </h3>
                  <div className="text-xs text-[#8B949E] mt-0.5">
                    Создан: {selectedTicket.created_at}
                  </div>
                </div>

                <button
                  onClick={() => handleExportPrint(selectedTicket)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-white font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Скачать официальный бланк"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Печать бланка</span>
                </button>
              </div>

              {/* Status Flow Control */}
              <div>
                <label className="text-xs text-[#8B949E] font-mono block mb-2">Изменить статус выполнения:</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['ЧЕРНОВИК', 'НАЗНАЧЕН', 'В_РАБОТЕ', 'ВЫПОЛНЕН'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(selectedTicket.ticket_id, st)}
                      className={`py-1.5 text-[11px] font-mono rounded border transition-all cursor-pointer ${
                        selectedTicket.status === st
                          ? 'bg-[#00FF66]/20 text-[#00FF66] border-[#00FF66]/50 font-semibold'
                          : 'text-[#8B949E] border-white/10 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {st === 'В_РАБОТЕ' ? 'В РАБОТЕ' : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Object & Location Info */}
              <div className="bg-[#07090E] p-3.5 rounded border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Диспетчерский узел:</span>
                  <span className="text-white font-medium">{selectedTicket.object_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Трасса / сектор:</span>
                  <span className="text-white font-mono">{selectedTicket.corridor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Пикет (ПК):</span>
                  <span className="text-[#00FF66] font-mono font-semibold">{selectedTicket.picket}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Датчик / Канал:</span>
                  <span className="text-white font-mono">{selectedTicket.channel_id} ({selectedTicket.sensor_type})</span>
                </div>
              </div>

              {/* Description & Regulations */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#8B949E] block mb-1">Нормативное основание:</span>
                  <div className="text-white bg-[#07090E] p-2.5 rounded border border-white/5 font-mono text-[11px]">
                    {selectedTicket.regulation_reference}
                  </div>
                </div>

                <div>
                  <span className="text-[#8B949E] block mb-1">Содержание регламентных работ:</span>
                  <div className="text-white bg-[#07090E] p-2.5 rounded border border-white/5 leading-relaxed">
                    {selectedTicket.work_description}
                  </div>
                </div>
              </div>

              {/* Required Materials & Brigade */}
              <div className="space-y-3 text-xs border-t border-white/10 pt-3">
                <div>
                  <span className="text-[#8B949E] block mb-1.5">Необходимые инструменты и ЗИП:</span>
                  <ul className="space-y-1">
                    {selectedTicket.required_materials.map((m, i) => (
                      <li key={i} className="flex items-center gap-2 text-white">
                        <Check className="w-3 h-3 text-[#00FF66]" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-[#8B949E]">Исполнитель:</span>
                  <span className="text-white font-medium font-mono text-[11px] bg-white/5 px-2 py-1 rounded">
                    {selectedTicket.assigned_team}
                  </span>
                </div>
              </div>

              {/* Financial Box */}
              <div className="bg-[#00FF66]/5 border border-[#00FF66]/20 p-3 rounded text-xs flex justify-between items-center">
                <div>
                  <div className="text-[#8B949E] text-[11px]">Чистая экономия наряда</div>
                  <div className="text-lg font-bold font-mono text-[#00FF66]">
                    +{selectedTicket.saved_opex_rub.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
                <div className="text-right text-[11px] text-[#8B949E] font-mono">
                  Затраты на ТО: {selectedTicket.estimated_cost_rub.toLocaleString('ru-RU')} ₽<br />
                  Авария избегнута: 18 500 ₽
                </div>
              </div>
            </div>
          ) : (
            <div className="eng-panel p-8 text-center text-[#8B949E] font-mono text-xs">
              Выберите наряд из списка слева для просмотра параметров
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

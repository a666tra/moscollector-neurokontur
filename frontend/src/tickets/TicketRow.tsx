import React from 'react';
import { 
  Flame, Clock, Wrench, Check, RotateCcw, Truck, Play, User, 
  MapPin, Download, AlertTriangle, ChevronDown, ChevronUp, Sparkles, Zap
} from 'lucide-react';
import { MaintenanceTicket } from '../types';
import { formatPk } from '../lib/plain';

interface TicketRowProps {
  ticket: MaintenanceTicket;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (ticketId: string, nextStatus: string) => void;
  onFocusMap?: (objectId: string) => void;
  onDownload?: (ticket: MaintenanceTicket) => void;
  onSelectBrigade?: (ticketId: string, brigadeName: string) => void;
  /** Active tickets per brigade name (for the load dots); missing = free */
  brigadeLoad?: Record<string, number>;
  isUpdatingStatus?: boolean;
}

const BRIGADES = ['Условная бригада 1', 'Условная бригада 2', 'Условная бригада 3', 'Условная бригада 4', 'Условная бригада 5'];

export const TicketRow: React.FC<TicketRowProps> = ({
  ticket,
  isExpanded,
  onToggleExpand,
  onStatusChange,
  onFocusMap,
  onDownload,
  onSelectBrigade,
  brigadeLoad = {},
  isUpdatingStatus = false,
}) => {
  const isUrgent = ticket.priority === 'ВЫСОКИЙ' || ticket.failure_risk_percent >= 70;
  const isSoon = !isUrgent && (ticket.priority === 'СРЕДНИЙ' || ticket.failure_risk_percent >= 40);
  const isDraft = ticket.status === 'ЧЕРНОВИК';
  const isAssigned = ticket.status === 'НАЗНАЧЕН';
  const isWork = ticket.status === 'В_РАБОТЕ';
  const isDone = ticket.status === 'ВЫПОЛНЕН';

  const riskPercent = Math.round(ticket.failure_risk_percent);

  // Border and badge color
  const borderColor = isUrgent
    ? 'var(--rd)'
    : isSoon
    ? 'var(--am)'
    : isWork
    ? 'var(--ac)'
    : isDone
    ? 'var(--gn)'
    : 'var(--ln)';

  const priorityLabel = isUrgent ? 'Срочно' : isSoon ? 'Скоро' : 'Плановый';
  const priorityBadgeBg = isUrgent ? 'var(--rds)' : isSoon ? 'var(--ams)' : 'var(--sf2)';
  const priorityBadgeColor = isUrgent ? 'var(--rdt)' : isSoon ? 'var(--amt)' : 'var(--mu)';

  // Left icon
  const getIcon = () => {
    if (isDone) return <Check className="w-5 h-5 text-white" strokeWidth={2.8} />;
    if (isWork) return <Wrench className="w-5 h-5 text-white" strokeWidth={2.4} />;
    if (isUrgent) return <Flame className="w-5 h-5 text-white" strokeWidth={2.4} />;
    if (isSoon) return <Clock className="w-5 h-5 text-white" strokeWidth={2.4} />;
    return <User className="w-5 h-5 text-white" strokeWidth={2.4} />;
  };

  const iconBg = isDone
    ? 'var(--gn)'
    : isWork
    ? 'var(--ac)'
    : isUrgent
    ? 'var(--rd)'
    : isSoon
    ? 'var(--am)'
    : 'oklch(0.6 0.02 260)';

  // Next status action configuration
  const getActionConfig = () => {
    switch (ticket.status) {
      case 'ЧЕРНОВИК':
        return {
          label: 'Назначить',
          icon: Truck,
          nextStatus: 'НАЗНАЧЕН',
          className: isUrgent
            ? 'bg-[var(--rd)] text-white hover:brightness-105'
            : 'bg-[var(--am)] text-[#241a00] hover:brightness-105',
          title: 'Назначить бригаду (передать наряд)',
        };
      case 'НАЗНАЧЕН':
        return {
          label: 'В работу',
          icon: Play,
          nextStatus: 'В_РАБОТЕ',
          className: 'bg-[var(--ac)] text-[var(--onac)] hover:brightness-105',
          title: 'Бригада прибыла на объект и начала работы',
        };
      case 'В_РАБОТЕ':
        return {
          label: 'Завершить',
          icon: Check,
          nextStatus: 'ВЫПОЛНЕН',
          className: 'bg-[var(--gn)] text-white hover:brightness-105',
          title: 'Отметить наряд выполненным',
        };
      case 'ВЫПОЛНЕН':
        return {
          label: 'Вернуть',
          icon: RotateCcw,
          nextStatus: 'В_РАБОТЕ',
          className: 'bg-transparent text-[var(--mu)] border border-[var(--ln)] hover:text-[var(--ink)] hover:bg-[var(--sf2)]',
          title: 'Вернуть наряд в работу',
        };
      default:
        return null;
    }
  };

  const action = getActionConfig();

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', ticket.ticket_id);
  };

  return (
    <div
      role="listitem"
      draggable={!isDone}
      onDragStart={handleDragStart}
      className={`rounded-[22px] transition-all duration-200 border-[2.5px] overflow-hidden ${
        isExpanded ? 'shadow-sm' : ''
      }`}
      style={{
        borderColor: isExpanded ? 'var(--ac)' : borderColor,
        background: isExpanded ? 'var(--sf)' : isUrgent && isDraft ? 'var(--rds)' : 'var(--sf)',
        opacity: isDone ? 0.65 : 1,
      }}
    >
      {/* Main Row */}
      <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3.5">
        {/* Toggle & Details Clickable Area */}
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={`Заявка ${ticket.ticket_id}: ${ticket.object_name}`}
          className="flex-1 min-w-0 flex items-start sm:items-center gap-2 sm:gap-3.5 text-left bg-transparent border-0 p-0 cursor-pointer min-h-[52px] overflow-hidden"
        >
          {/* Priority Icon */}
          <span
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-0.5 sm:mt-0 ${
              isUrgent && isDraft ? 'nk-ring' : ''
            }`}
            style={{ background: iconBg }}
          >
            {getIcon()}
          </span>

          {/* Texts & Chips */}
          <div className="min-w-0 flex-1 flex flex-col gap-1 overflow-hidden">
            {/* Title Line */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
              <span className="font-semibold text-xs sm:text-base leading-snug break-words" style={{ color: 'var(--ink)' }}>
                {ticket.object_name}
              </span>
              <span className="text-[11px] sm:text-xs num font-normal shrink-0" style={{ color: 'var(--mu)' }}>
                · {formatPk(ticket.picket)}
              </span>
              <span
                className="chip text-[10.5px] sm:text-[11px] h-5 px-1.5 sm:px-2 rounded-full font-bold shrink-0"
                style={{ background: priorityBadgeBg, color: priorityBadgeColor }}
              >
                {priorityLabel}
              </span>
            </div>

            {/* Subtitle Line: Brigade + Risk Bar + Cost */}
            <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap text-xs min-w-0">
              {/* Brigade Chip */}
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-[12px] font-medium max-w-full shrink-0"
                style={{
                  background: isDraft && !ticket.assigned_team ? (isUrgent ? 'var(--rds)' : 'var(--ams)') : 'var(--sf2)',
                  color: isDraft && !ticket.assigned_team ? (isUrgent ? 'var(--rdt)' : 'var(--amt)') : 'var(--ink)',
                }}
              >
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[100px] sm:max-w-none">
                  {ticket.assigned_team && ticket.assigned_team !== 'Линейная бригада ОДС'
                    ? ticket.assigned_team
                    : isDraft
                    ? 'Нужна бригада'
                    : ticket.assigned_team || 'Бригада не указана'}
                </span>
              </span>

              {/* Mini Risk Bar */}
              <div
                className="inline-flex items-center gap-1 shrink-0"
                aria-label={`Оценка по журналу СМВУ: ${riskPercent}%`}
                title="Оценка по журналу СМВУ (вероятность отклонения телеметрии)"
              >
                <div className="w-8 sm:w-11 h-1.5 rounded-full bg-[var(--ln)] overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(5, riskPercent))}%`,
                      background: riskPercent >= 70 ? 'var(--rd)' : riskPercent >= 40 ? 'var(--am)' : 'var(--gn)',
                    }}
                  />
                </div>
                <span
                  className="font-bold text-[11px] sm:text-[12px] num"
                  style={{
                    color: riskPercent >= 70 ? 'var(--rdt)' : riskPercent >= 40 ? 'var(--amt)' : 'var(--ok)',
                  }}
                >
                  {riskPercent}%
                </span>
              </div>

              {/* Cost: ТО: плановая стоимость */}
              <span className="text-[11px] sm:text-[11.5px] num shrink-0" style={{ color: 'var(--mu)' }}>
                ТО: <b style={{ color: 'var(--ink)' }}>{ticket.estimated_cost_rub.toLocaleString('ru-RU')} ₽</b>
              </span>
            </div>
          </div>
        </button>

        {/* Action Button (>= 48px height, min-width ~108px, visible word on mobile) */}
        {action && (
          <div className="shrink-0 ml-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(ticket.ticket_id, action.nextStatus);
              }}
              disabled={isUpdatingStatus}
              title={action.title}
              aria-label={`${action.label} заявку ${ticket.ticket_id}`}
              className={`min-h-[48px] min-w-[108px] px-3 sm:px-4 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 disabled:opacity-50 border-0 ${action.className}`}
            >
              <action.icon className="w-4 h-4 shrink-0" strokeWidth={2.5} />
              <span className="whitespace-nowrap">{action.label}</span>
            </button>
          </div>
        )}
      </div>

      {/* Expanded Inspector Panel */}
      {isExpanded && (
        <div
          className="border-t px-3.5 sm:px-5 py-3.5 sm:py-4 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 animate-[nkUp_0.25s_ease-out]"
          style={{ borderColor: 'var(--ln)', background: 'var(--sf)' }}
        >
          {/* Left Column: Risk & Materials & Work */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="serif text-4xl sm:text-5xl font-normal leading-none num"
                  style={{ color: riskPercent >= 70 ? 'var(--rdt)' : 'var(--amt)' }}
                >
                  {riskPercent}%
                </span>
                <div className="flex-1">
                  <div className="h-2.5 rounded-full bg-[var(--ln)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(5, riskPercent))}%`,
                        background: riskPercent >= 70 ? 'var(--rd)' : 'var(--am)',
                      }}
                    />
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--mu)' }}>
                    Оценка по журналу СМВУ (горизонт 24–72 ч)
                  </div>
                </div>
              </div>

              {ticket.work_description && (
                <p className="text-xs leading-relaxed mt-2.5" style={{ color: 'var(--ink)' }}>
                  {ticket.work_description}
                </p>
              )}
            </div>

            {/* Materials */}
            {ticket.required_materials && ticket.required_materials.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--mu)' }}>
                  Необходимые материалы и ЗИП:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.required_materials.map((mat, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: 'var(--sf2)', color: 'var(--ink)' }}
                    >
                      {mat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Brigade selection & Actions */}
          <div className="flex flex-col justify-between space-y-3">
            <div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold" style={{ color: 'var(--mu)' }}>
                    Бригада
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const free = BRIGADES.reduce((best, b) =>
                        (brigadeLoad[b] || 0) < (brigadeLoad[best] || 0) ? b : best
                      , BRIGADES[0]);
                      onSelectBrigade?.(ticket.ticket_id, free);
                    }}
                    aria-label="Автоматически: самая свободная бригада"
                    className="min-h-[44px] pl-2.5 pr-3.5 rounded-full text-sm font-bold flex items-center gap-1.5 cursor-pointer"
                    style={{ border: '1.5px solid var(--ac)', background: 'var(--acs)', color: 'var(--ac)' }}
                  >
                    <Zap className="w-[18px] h-[18px]" />
                    Авто
                  </button>
                </div>

                <div
                  role="group"
                  aria-label="Выбрать бригаду"
                  className="grid grid-cols-5 gap-0.5 p-[3px] rounded-full"
                  style={{ background: 'var(--sf)', border: '1.5px solid var(--ln2)' }}
                >
                  {BRIGADES.map((bName, idx) => {
                    const isCurrent = ticket.assigned_team === bName;
                    const load = brigadeLoad[bName] || 0;
                    const dot = load === 0 ? 'var(--gn)' : load < 3 ? 'var(--am)' : 'var(--rd)';
                    return (
                      <button
                        key={bName}
                        type="button"
                        onClick={() => onSelectBrigade?.(ticket.ticket_id, bName)}
                        aria-pressed={isCurrent}
                        aria-label={`${bName}${load ? `, заявок: ${load}` : ', свободна'}`}
                        className="min-w-0 h-11 rounded-full border-0 text-base font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-[background,color] duration-200"
                        style={{
                          background: isCurrent ? 'var(--ac)' : 'transparent',
                          color: isCurrent ? 'var(--onac)' : 'var(--ink)',
                        }}
                      >
                        {idx + 1}
                        <i
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: dot, boxShadow: `0 0 0 2px ${isCurrent ? 'var(--ac)' : 'var(--sf)'}` }}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-medium" style={{ color: 'var(--mu)' }}>
                  <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: 'var(--gn)' }} />свободна</span>
                  <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: 'var(--am)' }} />1–2 заявки</span>
                  <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full" style={{ background: 'var(--rd)' }} />загружена</span>
                </div>
              </div>
              <div className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: 'var(--mu)' }}>
                Демо: выбор бригады запоминается только в этом окне и попадёт в скачанный бланк. Сервер его не получает.
              </div>
            </div>

            {/* Bottom Actions: На карте, Скачать */}
            <div className="flex items-center gap-3 pt-2 border-t flex-wrap" style={{ borderColor: 'var(--ln)' }}>
              {onFocusMap && ticket.object_id && (
                <button
                  type="button"
                  onClick={() => onFocusMap(ticket.object_id)}
                  className="btn btn-secondary h-9 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-[var(--ac)]" />
                  <span>На карте</span>
                </button>
              )}

              {onDownload && (
                <button
                  type="button"
                  onClick={() => onDownload(ticket)}
                  className="btn btn-secondary h-9 px-3.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--ac)]" />
                  <span>Скачать наряд</span>
                </button>
              )}

              <span className="text-[11px] num ml-auto" style={{ color: 'var(--mu)' }}>
                № {ticket.ticket_id}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useMemo } from 'react';
import { RiskMap, MapPin } from '../situation/RiskMap';
import { MaintenanceTicket, ObjectItem } from '../types';

interface TicketMiniMapProps {
  objects: ObjectItem[];
  tickets: MaintenanceTicket[];
  selectedObjectId?: string;
  onPickObject?: (objectId: string) => void;
  className?: string;
}

export const TicketMiniMap: React.FC<TicketMiniMapProps> = ({
  objects,
  tickets,
  selectedObjectId,
  onPickObject,
  className = '',
}) => {
  const pins: MapPin[] = useMemo(() => {
    return tickets
      .map((t) => {
        const isUrgent = t.priority === 'ВЫСОКИЙ' || t.failure_risk_percent >= 70;
        const isSoon = !isUrgent && (t.priority === 'СРЕДНИЙ' || t.failure_risk_percent >= 40);
        const isDraft = t.status === 'ЧЕРНОВИК';
        const isAssigned = t.status === 'НАЗНАЧЕН';
        const isWork = t.status === 'В_РАБОТЕ';
        const isDone = t.status === 'ВЫПОЛНЕН';

        const color = isDraft
          ? 'var(--rd)'
          : isAssigned
          ? 'oklch(0.6 0.02 260)'
          : isWork
          ? 'var(--ac)'
          : 'var(--gn)';

        return {
          objectId: t.object_id,
          pct: Math.round(t.failure_risk_percent),
          risk: isUrgent ? 'CRITICAL' : isSoon ? 'WARNING' : 'NORMAL',
          done: isDone,
          color,
        };
      })
      .filter((p) => Boolean(p.objectId));
  }, [tickets]);

  return (
    <div
      className={`relative rounded-[24px] overflow-hidden border border-[var(--ln)] bg-[var(--sf)] ${className}`}
      style={{ boxShadow: 'var(--sh)' }}
    >
      {/* Map Canvas */}
      <RiskMap
        objects={objects}
        pins={pins}
        selectedObjectId={selectedObjectId}
        onPick={onPickObject}
        interactive={true}
        zoom={11.5}
      />

      {/* Floating Status Dots Legend (Desktop) */}
      <div
        className="hidden lg:flex absolute left-3 top-3 z-[400] items-center gap-2.5 px-3.5 py-2 rounded-full border border-[var(--ln)] shadow-md select-none"
        style={{ background: 'var(--sf)' }}
        title="Цвета статусов: новая (красный), передана (серый), в работе (синий), готово (зелёный)"
        aria-label="Цвета статусов: новая (красный), передана (серый), в работе (синий), готово (зелёный)"
      >
        <span className="flex items-center gap-1.5" title="Новая (Черновик)">
          <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: 'var(--rd)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>Новая</span>
        </span>
        <span className="flex items-center gap-1.5" title="Передана бригаде">
          <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: 'oklch(0.6 0.02 260)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>Передана</span>
        </span>
        <span className="flex items-center gap-1.5" title="В работе">
          <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: 'var(--ac)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>В работе</span>
        </span>
        <span className="flex items-center gap-1.5" title="Готово">
          <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: 'var(--gn)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>Готово</span>
        </span>
      </div>

      {/* Mobile 2x2 Legend Grid under map */}
      <div
        className="lg:hidden grid grid-cols-2 gap-2 px-3.5 py-2.5 border-t border-[var(--ln)] text-xs select-none"
        style={{ background: 'var(--sf)' }}
      >
        <div className="flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--rd)' }} />
          <span className="font-medium text-xs" style={{ color: 'var(--ink)' }}>Новая</span>
        </div>
        <div className="flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'oklch(0.6 0.02 260)' }} />
          <span className="font-medium text-xs" style={{ color: 'var(--ink)' }}>Передана</span>
        </div>
        <div className="flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--ac)' }} />
          <span className="font-medium text-xs" style={{ color: 'var(--ink)' }}>В работе</span>
        </div>
        <div className="flex items-center gap-2">
          <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--gn)' }} />
          <span className="font-medium text-xs" style={{ color: 'var(--ink)' }}>Готово</span>
        </div>
      </div>
    </div>
  );
};

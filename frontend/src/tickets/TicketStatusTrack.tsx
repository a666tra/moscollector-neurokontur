import React, { useState } from 'react';
import { FileText, User, Wrench, Check } from 'lucide-react';

export interface StageCounts {
  draft: number;
  assigned: number;
  work: number;
  done: number;
}

interface TicketStatusTrackProps {
  counts: StageCounts;
  activeStatus: string;
  onSelectStatus: (status: string) => void;
  onDropTicket?: (ticketId: string, targetStatus: string) => void;
}

interface StageConfig {
  id: string;
  label: string;
  countKey: keyof StageCounts;
  color: string;
  icon: React.ElementType;
}

const STAGES: StageConfig[] = [
  { id: 'ЧЕРНОВИК', label: 'Новая', countKey: 'draft', color: 'var(--rd)', icon: FileText },
  { id: 'НАЗНАЧЕН', label: 'Передана', countKey: 'assigned', color: 'oklch(0.6 0.02 260)', icon: User },
  { id: 'В_РАБОТЕ', label: 'В работе', countKey: 'work', color: 'var(--ac)', icon: Wrench },
  { id: 'ВЫПОЛНЕН', label: 'Готово', countKey: 'done', color: 'var(--gn)', icon: Check },
];

export const TicketStatusTrack: React.FC<TicketStatusTrackProps> = ({
  counts,
  activeStatus,
  onSelectStatus,
  onDropTicket,
}) => {
  const [overStage, setOverStage] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (overStage !== stageId) {
      setOverStage(stageId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, stageId: string) => {
    if (overStage === stageId) {
      setOverStage(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setOverStage(null);
    const ticketId = e.dataTransfer.getData('text/plain');
    if (ticketId && onDropTicket) {
      onDropTicket(ticketId, targetStatus);
    }
  };

  return (
    <div
      className="relative grid grid-cols-4 pt-1 pb-1 select-none"
      role="group"
      aria-label="Этапы заявки. Нажмите, чтобы отфильтровать, или перетащите строку на этап"
    >
      {/* Horizontal connector line */}
      <i
        className="absolute left-[12.5%] right-[12.5%] top-[19px] h-[3.5px] rounded-[2px] pointer-events-none"
        style={{ background: 'var(--ln)' }}
      />

      {STAGES.map((s) => {
        const count = counts[s.countKey] || 0;
        const isActive = activeStatus === s.id;
        const isOver = overStage === s.id;
        const Icon = s.icon;

        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectStatus(isActive ? 'ALL' : s.id)}
            onDragOver={(e) => handleDragOver(e, s.id)}
            onDragLeave={(e) => handleDragLeave(e, s.id)}
            onDrop={(e) => handleDrop(e, s.id)}
            aria-pressed={isActive}
            aria-label={`Этап ${s.label}: ${count} заявок`}
            className="relative border-0 bg-transparent flex flex-col items-center gap-1.5 p-0 pb-1 cursor-pointer transition-transform duration-150 min-h-[72px]"
            style={{ color: 'var(--ink)' }}
          >
            {/* Circle Badge */}
            <span
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
              style={{
                border: `3px solid ${s.color}`,
                background: isActive || isOver ? s.color : 'var(--bg)',
                color: isActive || isOver ? '#ffffff' : s.color,
                boxShadow: isOver
                  ? `0 0 0 8px ${s.color}33`
                  : isActive
                  ? '0 0 0 5px var(--acs)'
                  : 'none',
                transform: isOver ? 'scale(1.22)' : 'scale(1)',
              }}
            >
              <Icon className="w-4 h-4" strokeWidth={2.5} />
            </span>

            {/* Count */}
            <span
              className="serif text-xl sm:text-2xl font-normal leading-none num transition-colors"
              style={{ color: isActive ? s.color : 'var(--ink)' }}
            >
              {count}
            </span>

            {/* Label */}
            <span
              className="text-xs sm:text-[13.5px] tracking-tight transition-colors whitespace-nowrap"
              style={{
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--ink)' : 'var(--mu)',
              }}
            >
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

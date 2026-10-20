import React from 'react';
import { Flame, Clock, Lock, Truck } from 'lucide-react';

export type TicketTileType = 'all' | 'crit' | 'soon' | 'idle';

interface TicketTilesProps {
  urgentCount: number;
  soonCount: number;
  idleCount: number;
  activeTile: TicketTileType;
  onSelectTile: (tile: TicketTileType) => void;
  onAssignAllUrgent?: () => void;
  isAssigningUrgent?: boolean;
}

export const TicketTiles: React.FC<TicketTilesProps> = ({
  urgentCount,
  soonCount,
  idleCount,
  activeTile,
  onSelectTile,
  onAssignAllUrgent,
  isAssigningUrgent = false,
}) => {
  return (
    <div
      className="grid grid-cols-3 gap-2 sm:gap-3.5"
      role="group"
      aria-label="Фильтры по срочности"
    >
      {/* 1. Срочно */}
      <div
        className={`relative rounded-[22px] transition-all duration-200 flex flex-col md:flex-row items-center p-2.5 sm:p-3.5 border-[2.5px] ${
          activeTile === 'crit'
            ? 'border-[var(--rd)] shadow-sm'
            : 'border-transparent hover:border-[var(--rd)]/40'
        }`}
        style={{
          background: 'var(--rds)',
          opacity: urgentCount || activeTile === 'crit' ? 1 : 0.6,
        }}
      >
        <button
          type="button"
          onClick={() => onSelectTile(activeTile === 'crit' ? 'all' : 'crit')}
          aria-pressed={activeTile === 'crit'}
          aria-label={`Срочно: ${urgentCount} заявок`}
          className="w-full flex-1 min-w-0 flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-left bg-transparent border-0 p-0 cursor-pointer min-h-[44px]"
        >
          <span
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 text-white ${
              urgentCount > 0 ? 'nk-ring' : ''
            }`}
            style={{ background: 'var(--rd)' }}
          >
            <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
          </span>
          <span className="flex flex-col items-center sm:items-start leading-tight">
            <span
              className="serif text-2xl sm:text-3xl font-normal leading-none num"
              style={{ color: 'var(--ink)' }}
            >
              {urgentCount}
            </span>
            <span
              className="text-xs sm:text-sm font-bold mt-0.5 tracking-tight"
              style={{ color: 'var(--rdt)' }}
            >
              Срочно
            </span>
          </span>
        </button>

        {urgentCount > 0 && onAssignAllUrgent && (
          <div className="w-full md:w-auto mt-2 md:mt-0 md:ml-2 shrink-0 flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAssignAllUrgent();
              }}
              disabled={isAssigningUrgent}
              aria-label="Назначить бригады на все срочные заявки"
              title="Назначить все срочные заявки"
              className="w-full max-w-full md:w-auto min-h-[44px] md:h-11 px-1.5 sm:px-3.5 py-1 rounded-full text-[10.5px] sm:text-xs font-bold text-white flex items-center justify-center gap-1 text-center leading-tight transition-opacity hover:opacity-90 disabled:opacity-50 border-0 cursor-pointer shadow-sm"
              style={{ background: 'var(--rd)' }}
            >
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span>{isAssigningUrgent ? 'Назначаем…' : 'Назначить все'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Скоро */}
      <div
        className={`relative rounded-[22px] transition-all duration-200 flex items-center p-2.5 sm:p-3.5 border-[2.5px] ${
          activeTile === 'soon'
            ? 'border-[var(--am)] shadow-sm'
            : 'border-transparent hover:border-[var(--am)]/40'
        }`}
        style={{
          background: 'var(--ams)',
          opacity: soonCount || activeTile === 'soon' ? 1 : 0.6,
        }}
      >
        <button
          type="button"
          onClick={() => onSelectTile(activeTile === 'soon' ? 'all' : 'soon')}
          aria-pressed={activeTile === 'soon'}
          aria-label={`Скоро: ${soonCount} заявок`}
          className="flex-1 min-w-0 flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-left bg-transparent border-0 p-0 cursor-pointer min-h-[44px]"
        >
          <span
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 text-white"
            style={{ background: 'var(--am)' }}
          >
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </span>
          <span className="flex flex-col items-center sm:items-start leading-tight">
            <span
              className="serif text-2xl sm:text-3xl font-normal leading-none num"
              style={{ color: 'var(--ink)' }}
            >
              {soonCount}
            </span>
            <span
              className="text-xs sm:text-sm font-bold mt-0.5 tracking-tight"
              style={{ color: 'var(--amt)' }}
            >
              Скоро
            </span>
          </span>
        </button>
      </div>

      {/* 3. Не трогать */}
      <div
        className={`relative rounded-[22px] transition-all duration-200 flex items-center p-2.5 sm:p-3.5 border-[2.5px] ${
          activeTile === 'idle'
            ? 'border-[var(--ln2)] shadow-sm'
            : 'border-transparent hover:border-[var(--ln2)]'
        }`}
        style={{
          background: 'var(--sf2)',
          opacity: idleCount || activeTile === 'idle' ? 1 : 0.6,
        }}
      >
        <button
          type="button"
          onClick={() => onSelectTile(activeTile === 'idle' ? 'all' : 'idle')}
          aria-pressed={activeTile === 'idle'}
          aria-label={`Не трогать: ${idleCount} заявок`}
          className="flex-1 min-w-0 flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-left bg-transparent border-0 p-0 cursor-pointer min-h-[44px]"
        >
          <span
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 text-white"
            style={{ background: 'oklch(0.6 0.02 260)' }}
          >
            <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
          </span>
          <span className="flex flex-col items-center sm:items-start leading-tight">
            <span
              className="serif text-2xl sm:text-3xl font-normal leading-none num"
              style={{ color: 'var(--ink)' }}
            >
              {idleCount}
            </span>
            <span
              className="text-xs sm:text-sm font-bold mt-0.5 tracking-tight truncate max-w-full"
              style={{ color: 'var(--mu)' }}
            >
              Не трогать
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

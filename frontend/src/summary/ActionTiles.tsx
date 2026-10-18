import React, { useMemo } from 'react';
import { MaintenanceTicket } from '../types';
import { Flame, FileText, Truck, ArrowRight } from 'lucide-react';

interface Props {
  tickets: MaintenanceTicket[];
  loading: boolean;
  onOpenTickets: () => void;
}

export const ActionTiles: React.FC<Props> = ({ tickets, loading, onOpenTickets }) => {
  const urgentCount = useMemo(() => {
    return tickets.filter(
      (t) => t.status === 'ЧЕРНОВИК' && (t.priority === 'ВЫСОКИЙ' || t.failure_risk_percent >= 70)
    ).length;
  }, [tickets]);

  const draftCount = useMemo(() => {
    return tickets.filter((t) => t.status === 'ЧЕРНОВИК').length;
  }, [tickets]);

  const workCount = useMemo(() => {
    return tickets.filter((t) => t.status === 'В_РАБОТЕ').length;
  }, [tickets]);

  // Segments for urgent bar: urgent (red), soon (amber), in work (blue), done (green)
  const urgentSegments = useMemo(() => {
    if (tickets.length === 0) return [{ f: 1, c: 'var(--ln2)' }];
    const high = tickets.filter(
      (t) => t.status !== 'ВЫПОЛНЕН' && (t.priority === 'ВЫСОКИЙ' || t.failure_risk_percent >= 70)
    ).length;
    const med = tickets.filter(
      (t) => t.status !== 'ВЫПОЛНЕН' && t.priority !== 'ВЫСОКИЙ' && t.failure_risk_percent < 70
    ).length;
    const done = tickets.filter((t) => t.status === 'ВЫПОЛНЕН').length;
    const segs: Array<{ f: number; c: string }> = [];
    if (high > 0) segs.push({ f: high, c: 'var(--rd)' });
    if (med > 0) segs.push({ f: med, c: 'var(--am)' });
    if (done > 0) segs.push({ f: done, c: 'var(--gn)' });
    return segs.length > 0 ? segs : [{ f: 1, c: 'var(--ln2)' }];
  }, [tickets]);

  // Segments for draft bar
  const draftSegments = useMemo(() => {
    if (tickets.length === 0) return [{ f: 1, c: 'var(--ln2)' }];
    const draft = tickets.filter((t) => t.status === 'ЧЕРНОВИК').length;
    const assigned = tickets.filter((t) => t.status === 'НАЗНАЧЕН').length;
    const work = tickets.filter((t) => t.status === 'В_РАБОТЕ').length;
    const done = tickets.filter((t) => t.status === 'ВЫПОЛНЕН').length;
    const segs: Array<{ f: number; c: string }> = [];
    if (draft > 0) segs.push({ f: draft, c: 'var(--am)' });
    if (assigned > 0) segs.push({ f: assigned, c: 'oklch(0.6 0.02 260)' });
    if (work > 0) segs.push({ f: work, c: 'var(--ac)' });
    if (done > 0) segs.push({ f: done, c: 'var(--gn)' });
    return segs.length > 0 ? segs : [{ f: 1, c: 'var(--ln2)' }];
  }, [tickets]);

  // 5 brigade indicators for work tile
  const brigadeSegments = useMemo(() => {
    const activeBrigades = Math.min(5, workCount);
    return Array.from({ length: 5 }, (_, i) => ({
      f: 1,
      c: i < activeBrigades ? 'var(--ac)' : 'var(--ln2)',
    }));
  }, [workCount]);

  const tiles = [
    {
      id: 'urgent',
      count: urgentCount,
      label: 'Срочно',
      sublabel: 'требуют назначения бригады',
      icon: Flame,
      color: 'var(--rd)',
      textColor: 'var(--rdt)',
      bg: 'var(--rds)',
      segments: urgentSegments,
      pulse: urgentCount > 0,
    },
    {
      id: 'draft',
      count: draftCount,
      label: 'Без бригады',
      sublabel: 'черновики нарядов',
      icon: FileText,
      color: 'var(--am)',
      textColor: 'var(--amt)',
      bg: 'var(--ams)',
      segments: draftSegments,
      pulse: false,
    },
    {
      id: 'work',
      count: workCount,
      label: 'Бригады в деле',
      sublabel: 'наряды в статусе «В работе»',
      icon: Truck,
      color: 'var(--ac)',
      textColor: 'var(--ac)',
      bg: 'var(--acs)',
      segments: brigadeSegments,
      pulse: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-5 min-w-0 w-full">
      {tiles.map((t) => {
        const IconComponent = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={onOpenTickets}
            className="text-left border-2 rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 flex flex-col justify-between gap-4 cursor-pointer hover:-translate-y-1 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] min-w-0"
            style={{
              background: t.bg,
              borderColor: 'transparent',
              color: 'var(--ink)',
            }}
            aria-label={`${t.label}: ${loading ? 'загрузка' : t.count}`}
          >
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 w-full">
              {/* Circular Icon with pulse */}
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0 text-white relative"
                style={{
                  background: t.color,
                  animation: t.pulse ? 'nkRing 1.6s infinite' : 'none',
                }}
              >
                <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>

              {/* Number and label */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className="serif font-normal text-3xl sm:text-4xl lg:text-5xl leading-none num text-[var(--ink)]">
                  {loading ? '…' : t.count}
                </span>
                <span
                  className="font-bold text-sm sm:text-base leading-tight mt-1 truncate"
                  style={{ color: t.textColor }}
                >
                  {t.label}
                </span>
                <span className="text-[11px] sm:text-xs text-[var(--mu)] truncate mt-0.5">
                  {t.sublabel}
                </span>
              </div>

              {/* Arrow navigation pill */}
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--sf)', color: 'var(--ink)' }}
              >
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            {/* Segmented bar */}
            <div className="flex gap-1 w-full pt-1" aria-hidden="true">
              {t.segments.map((seg, idx) => (
                <div
                  key={idx}
                  style={{
                    flex: seg.f,
                    height: '8px',
                    borderRadius: '4px',
                    background: seg.c,
                  }}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
};

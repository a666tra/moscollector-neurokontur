import React, { useRef, useState } from 'react';

export type SnapHeight = 'peek' | 'half' | 'full';

interface Props {
  snap: SnapHeight;
  onSnapChange: (snap: SnapHeight) => void;
  children: React.ReactNode;
  className?: string;
  snaps?: SnapHeight[];
  heights?: Partial<Record<SnapHeight, string>>;
}

const DEFAULT_SNAPS: SnapHeight[] = ['peek', 'half', 'full'];

const DEFAULT_HEIGHTS: Record<SnapHeight, string> = {
  peek: '208px',
  half: '56%',
  full: '90%',
};

export const FieldBottomSheet: React.FC<Props> = ({
  snap,
  onSnapChange,
  children,
  className,
  snaps,
  heights,
}) => {
  const startY = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const activeSnaps = snaps && snaps.length > 0 ? snaps : DEFAULT_SNAPS;
  const activeHeights: Record<SnapHeight, string> = {
    ...DEFAULT_HEIGHTS,
    ...heights,
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    setIsDragging(false);

    const curIdx = Math.max(0, activeSnaps.indexOf(snap));

    if (dy < -28) {
      // Dragged up
      onSnapChange(activeSnaps[Math.min(activeSnaps.length - 1, curIdx + 1)]);
    } else if (dy > 28) {
      // Dragged down
      onSnapChange(activeSnaps[Math.max(0, curIdx - 1)]);
    } else {
      // Short tap on handle
      if (activeSnaps.length === 2) {
        onSnapChange(snap === activeSnaps[0] ? activeSnaps[1] : activeSnaps[0]);
      } else {
        onSnapChange(snap === 'peek' ? 'half' : 'peek');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const curIdx = Math.max(0, activeSnaps.indexOf(snap));

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (activeSnaps.length === 2) {
        onSnapChange(snap === activeSnaps[0] ? activeSnaps[1] : activeSnaps[0]);
      } else {
        onSnapChange(snap === 'peek' ? 'half' : 'peek');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (curIdx < activeSnaps.length - 1) onSnapChange(activeSnaps[curIdx + 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (curIdx > 0) onSnapChange(activeSnaps[curIdx - 1]);
    }
  };

  return (
    <div
      className={`lg:hidden absolute left-0 right-0 bottom-0 z-30 flex flex-col rounded-t-[28px] overflow-hidden shadow-2xl transition-[height] duration-350 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${className || ''}`}
      style={{
        height: activeHeights[snap] || DEFAULT_HEIGHTS[snap],
        background: 'var(--sf)',
        boxShadow: '0 -8px 32px -8px rgba(0, 0, 0, 0.32)',
        zIndex: 500,
      }}
    >
      {/* Draggable Handle */}
      <div
        className="flex-none touch-none cursor-grab active:cursor-grabbing select-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Изменить высоту панели"
          aria-expanded={snap === 'full'}
          onKeyDown={handleKeyDown}
          className="h-7 w-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac)]"
        >
          <span
            className="w-12 h-1.5 rounded-full transition-colors"
            style={{ background: isDragging ? 'var(--mu)' : 'var(--ln2)' }}
          />
        </div>
      </div>

      {/* Sheet Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
};

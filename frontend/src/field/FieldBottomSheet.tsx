import React, { useRef, useState } from 'react';

export type SnapHeight = 'peek' | 'half' | 'full';

interface Props {
  snap: SnapHeight;
  onSnapChange: (snap: SnapHeight) => void;
  children: React.ReactNode;
}

const SNAP_STYLES: Record<SnapHeight, string> = {
  peek: '208px',
  half: '56%',
  full: '90%',
};

export const FieldBottomSheet: React.FC<Props> = ({ snap, onSnapChange, children }) => {
  const startY = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

    const snaps: SnapHeight[] = ['peek', 'half', 'full'];
    const curIdx = snaps.indexOf(snap);

    if (dy < -28) {
      // Dragged up
      onSnapChange(snaps[Math.min(2, curIdx + 1)]);
    } else if (dy > 28) {
      // Dragged down
      onSnapChange(snaps[Math.max(0, curIdx - 1)]);
    } else {
      // Short tap on handle toggles peek <-> half
      onSnapChange(snap === 'peek' ? 'half' : 'peek');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSnapChange(snap === 'peek' ? 'half' : 'peek');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (snap === 'peek') onSnapChange('half');
      else if (snap === 'half') onSnapChange('full');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (snap === 'full') onSnapChange('half');
      else if (snap === 'half') onSnapChange('peek');
    }
  };

  return (
    <div
      className="lg:hidden absolute left-0 right-0 bottom-0 z-30 flex flex-col rounded-t-[28px] overflow-hidden shadow-2xl transition-[height] duration-350 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      style={{
        height: SNAP_STYLES[snap],
        background: 'var(--sf)',
        boxShadow: '0 -8px 32px -8px rgba(0, 0, 0, 0.32)',
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

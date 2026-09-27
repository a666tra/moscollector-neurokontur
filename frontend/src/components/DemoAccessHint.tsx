import React from 'react';
import { useDemoAccess } from '../useDemoAccess';

interface DemoAccessHintProps {
  onFill: (badge: string, pin: string) => void;
  className?: string;
}

export const DemoAccessHint: React.FC<DemoAccessHintProps> = ({ onFill, className = '' }) => {
  const { enabled, badge, pin } = useDemoAccess();

  if (!enabled || !badge || !pin) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-[#9AA3B2] bg-[#181D29] border border-white/10 px-3 py-1.5 rounded-lg ${className}`}>
      <span>
        Демо-стенд: табельный <span className="font-mono text-[#E7EAF0] font-medium">{badge}</span>, PIN <span className="font-mono text-[#E7EAF0] font-medium">{pin}</span>
      </span>
      <button
        type="button"
        onClick={() => onFill(badge, pin)}
        className="px-2 py-0.5 text-[11px] font-medium text-[#7C4DFF] hover:text-[#9170FF] hover:bg-[#7C4DFF]/10 rounded border border-[#7C4DFF]/30 transition-colors cursor-pointer"
      >
        Подставить
      </button>
    </div>
  );
};

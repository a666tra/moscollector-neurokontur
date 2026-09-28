import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
interface Toast { id: number; tone: Tone; text: string }
const ToastCtx = createContext<(text: string, tone?: Tone) => void>(() => {});

/** Non-blocking notifications in the corner (replaces window.alert). */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev.slice(-2), { id, tone, text }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed z-[2000] top-5 left-1/2 -translate-x-1/2 w-max max-w-[calc(100vw-32px)] space-y-2" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className="flex items-center gap-2 pl-4 pr-2 py-2.5 rounded-full text-sm rise"
               style={{ background: 'var(--ink)', color: 'var(--bg)', animationDuration: '.35s' }}>
            {t.tone === 'error'
              ? <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--cr)' }} />
              : <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--ok)' }} />}
            <span className="flex-1">{t.text}</span>
            <button className="w-6 h-6 rounded-full flex items-center justify-center opacity-60 hover:opacity-100" aria-label="Закрыть"
                    onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

export const useToast = () => useContext(ToastCtx);

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
      <div className="fixed z-[2000] bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-[380px] space-y-2" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className="panel flex items-start gap-3 p-3 shadow-lg" style={{ background: 'var(--surface-2)' }}>
            {t.tone === 'error'
              ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--crit)' }} />
              : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: t.tone === 'success' ? 'var(--ok)' : 'var(--accent-text)' }} />}
            <div className="text-sm flex-1">{t.text}</div>
            <button className="text-[var(--faint)] hover:text-[var(--text)]" aria-label="Закрыть"
                    onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

export const useToast = () => useContext(ToastCtx);

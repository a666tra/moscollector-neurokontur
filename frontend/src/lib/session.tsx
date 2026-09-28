import React, { createContext, useContext, useEffect, useState } from 'react';
import { X, UserCheck } from 'lucide-react';
import { api } from './api';
import { useDemoAccess } from '../useDemoAccess';

export interface Dispatcher {
  badge: string;
  pin: string;
  full_name: string;
  role: string;
  clearance_level: number;
  can_confirm_false_alarm: boolean;
  can_force_dispatch: boolean;
}

interface SessionValue {
  dispatcher: Dispatcher | null;
  /** Opens the shift dialog if needed; resolves with the dispatcher or null if cancelled. */
  requireDispatcher: () => Promise<Dispatcher | null>;
  openShift: () => void;
  endShift: () => void;
}

const SessionCtx = createContext<SessionValue>({
  dispatcher: null, requireDispatcher: async () => null, openShift: () => {}, endShift: () => {},
});

/** Dispatcher shift: badge + PIN are checked once (POST /api/alarms/session) and kept only in memory. */
export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dispatcher, setDispatcher] = useState<Dispatcher | null>(null);
  const [open, setOpen] = useState(false);
  const [waiters, setWaiters] = useState<Array<(d: Dispatcher | null) => void>>([]);

  const close = (d: Dispatcher | null) => {
    setOpen(false);
    waiters.forEach(w => w(d));
    setWaiters([]);
  };

  const requireDispatcher = () =>
    dispatcher ? Promise.resolve(dispatcher)
      : new Promise<Dispatcher | null>(resolve => { setWaiters(w => [...w, resolve]); setOpen(true); });

  return (
    <SessionCtx.Provider value={{ dispatcher, requireDispatcher, openShift: () => setOpen(true), endShift: () => setDispatcher(null) }}>
      {children}
      {open && <ShiftDialog onCancel={() => close(null)} onStarted={d => { setDispatcher(d); close(d); }} />}
    </SessionCtx.Provider>
  );
};

export const useSession = () => useContext(SessionCtx);

const ShiftDialog: React.FC<{ onCancel: () => void; onStarted: (d: Dispatcher) => void }> = ({ onCancel, onStarted }) => {
  const demo = useDemoAccess();
  const [badge, setBadge] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demo.enabled && demo.badge && demo.pin) { setBadge(demo.badge); setPin(demo.pin); }
  }, [demo.enabled, demo.badge, demo.pin]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const d = await api<Omit<Dispatcher, 'pin'>>('/api/alarms/session', {
        method: 'POST', json: { dispatcher_badge: badge.trim(), dispatcher_pin: pin.trim() },
      });
      onStarted({ ...d, pin: pin.trim() });
    } catch (err: any) {
      setError(err?.message || 'Не удалось начать смену.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center p-0 sm:p-4"
         style={{ background: 'rgba(10,10,12,.45)', backdropFilter: 'blur(3px)' }} onClick={onCancel}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-[440px] p-8 rounded-t-[28px] sm:rounded-[28px] flex flex-col gap-4 rise"
            style={{ background: 'var(--sf)', boxShadow: 'var(--shadow)', animationDuration: '.35s' }}>
        <div className="flex items-start justify-between">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--acs)' }}>
            <UserCheck className="w-7 h-7" style={{ color: 'var(--ac)' }} />
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Закрыть"><X className="w-4 h-4" /></button>
        </div>
        <div className="serif font-semibold text-[40px] leading-[.95]">Начать смену</div>
        <div className="text-sm -mt-1.5" style={{ color: 'var(--mut)' }}>Так мы узнаем, кто принял решение. Вход нужен один раз за смену.</div>
        <label className="block space-y-1.5">
          <span className="text-[13px]" style={{ color: 'var(--mut)' }}>Табельный номер</span>
          <input className="input num !h-[54px] !rounded-[14px] !text-base" value={badge} onChange={e => setBadge(e.target.value)} placeholder="ДИСП-0000" autoComplete="username" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px]" style={{ color: 'var(--mut)' }}>PIN из 6 цифр</span>
          <input className="input num !h-[54px] !rounded-[14px] !text-xl tracking-[.4em]" type="password" inputMode="numeric" maxLength={6} value={pin}
                 onChange={e => setPin(e.target.value.replace(/\D/g, ''))} autoComplete="current-password" />
        </label>
        {demo.enabled && <div className="text-xs" style={{ color: 'var(--ac)' }}>Демо-стенд: данные уже подставлены.</div>}
        {error && <div className="text-sm" style={{ color: 'var(--cr)' }}>{error}</div>}
        <button className="h-14 rounded-full text-base font-semibold disabled:opacity-50" style={{ background: 'var(--ac)', color: 'var(--act)' }}
                disabled={busy || !badge || pin.length !== 6}>
          {busy ? 'Проверяем…' : 'Начать смену'}
        </button>
      </form>
    </div>
  );
};

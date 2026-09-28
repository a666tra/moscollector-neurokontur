import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Map as MapIcon, ClipboardList, LineChart, Stethoscope, PlayCircle, SlidersHorizontal, Briefcase, UserCircle, X, Info,
} from 'lucide-react';
import { Landing } from './shell/Landing';
import { Situation } from './situation/Situation';
import { MaintenanceTickets } from './components/MaintenanceTickets';
import { MetricsView } from './components/MetricsView';
import { FalseAlarmFilter } from './components/FalseAlarmFilter';
import { StreamSimulator } from './components/StreamSimulator';
import { SettingsModal } from './components/SettingsModal';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider } from './lib/toast';
import { ThemeProvider, ThemeButton } from './lib/theme';
import { ConfirmedAlarmItem, ObjectItem, PredictionItem } from './types';

type View = 'situation' | 'tickets' | 'quality';
type Tool = 'signal' | 'simulator' | null;

const VIEWS: Array<{ id: View; title: string; short: string; icon: React.ElementType }> = [
  { id: 'situation', title: 'Обстановка', short: 'Обстановка', icon: MapIcon },
  { id: 'tickets', title: 'Заявки и журнал', short: 'Заявки', icon: ClipboardList },
  { id: 'quality', title: 'Качество модели', short: 'Качество', icon: LineChart },
];
const TOOLS = [
  { id: 'signal', icon: Stethoscope, title: 'Разобрать сигнал', sub: 'настоящая тревога или ложная' },
  { id: 'simulator', icon: PlayCircle, title: 'Симулятор потока', sub: 'проиграть события датчиков' },
  { id: 'settings', icon: SlidersHorizontal, title: 'Параметры и пороги', sub: 'когда считать риск высоким' },
] as const;

const readView = (): View => {
  const v = new URLSearchParams(window.location.search).get('view');
  return v === 'tickets' || v === 'quality' ? v : 'situation';
};

export const App: React.FC = () => (
  <ThemeProvider>
    <ToastProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </ToastProvider>
  </ThemeProvider>
);

const Root: React.FC = () => {
  const [entered, setEntered] = useState(() => new URLSearchParams(window.location.search).has('view'));
  const [view, setViewState] = useState<View>(readView);
  const { openShift, dispatcher } = useSession();
  const setView = (v: View) => {
    setViewState(v);
    setEntered(true);
    try { const u = new URL(window.location.href); u.searchParams.set('view', v); window.history.replaceState({}, '', u); } catch { /* ignore */ }
  };
  if (!entered) {
    return <Landing onEnter={() => { setView('situation'); if (!dispatcher) openShift(); }} onOpenQuality={() => setView('quality')} />;
  }
  return <Workspace view={view} setView={setView} onExit={() => setEntered(false)} />;
};

const Workspace: React.FC<{ view: View; setView: (v: View) => void; onExit: () => void }> = ({ view, setView, onExit }) => {
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [confirmed, setConfirmed] = useState<ConfirmedAlarmItem[]>([]);
  const [tool, setTool] = useState<Tool>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const load = useCallback(async () => {
    const get = (u: string) => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [obj, pred, conf] = await Promise.all([get('/api/objects'), get('/api/predictions?limit=500'), get('/api/alarms/confirmed')]);
    if (obj) setObjects(obj);
    if (pred) setPredictions(pred.items || []);
    if (conf) setConfirmed(conf);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openTool = (id: string) => {
    setToolsOpen(false);
    if (id === 'settings') setSettingsOpen(true); else setTool(id as Tool);
  };
  const now = new Date();
  const stamp = `${now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}, ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* desktop header */}
      <header className="hidden lg:flex shrink-0 h-16 items-center gap-5 px-5 border-b relative z-[900]" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
        <button onClick={onExit} className="serif italic font-semibold text-[26px] leading-none mr-2" title="О проекте">НейроКонтур</button>
        <nav className="flex p-1 rounded-full" style={{ background: 'var(--sf2)' }}>
          {VIEWS.map(v => {
            const active = v.id === view;
            return (
              <button key={v.id} onClick={() => setView(v.id)} aria-current={active ? 'page' : undefined}
                      className="h-9 px-4 rounded-full flex items-center gap-2 text-sm whitespace-nowrap transition-colors"
                      style={active ? { background: 'var(--sf)', boxShadow: '0 1px 3px rgba(0,0,0,.12)', fontWeight: 600 } : { color: 'var(--mut)' }}>
                <v.icon className="w-4 h-4" style={active ? { color: 'var(--ac)' } : undefined} />{v.title}
              </button>
            );
          })}
        </nav>
        <span className="ml-auto text-[13px] whitespace-nowrap hidden xl:inline" style={{ color: 'var(--mut)' }}>{stamp} · прогноз на 1–3 дня</span>
        <ToolsMenu open={toolsOpen} setOpen={setToolsOpen} onPick={openTool} />
        <ThemeButton />
        <ShiftButton />
      </header>

      {/* mobile header */}
      <header className="lg:hidden absolute z-[900] left-4 right-4 top-4 glass rounded-full flex items-center gap-2 py-1.5 pl-4 pr-1.5">
        <button onClick={onExit} className="font-semibold text-[17px]">{VIEWS.find(v => v.id === view)!.title}</button>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeButton className="w-10 h-10 rounded-full flex items-center justify-center" />
          <ShiftButton compact />
        </div>
      </header>

      <main className="flex-1 min-h-0 relative pb-16 lg:pb-0">
        {view === 'situation' && <Situation objects={objects} predictions={predictions} confirmed={confirmed} onChanged={load} />}
        {view === 'tickets' && <div className="h-full overflow-y-auto px-4 pt-20 pb-6 lg:p-6"><div className="max-w-[1320px] mx-auto"><MaintenanceTickets onRefreshStats={load} /></div></div>}
        {view === 'quality' && <div className="h-full overflow-y-auto px-4 pt-20 pb-6 lg:p-6"><div className="max-w-[1320px] mx-auto"><MetricsView /></div></div>}
      </main>

      {/* mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[1100] grid grid-cols-4 h-16 border-t" style={{ borderColor: 'var(--ln)', background: 'var(--sf)' }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)} className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium"
                  style={{ color: v.id === view ? 'var(--ac)' : 'var(--mut)' }}>
            <v.icon className="w-5 h-5" />{v.short}
          </button>
        ))}
        <button onClick={() => setToolsOpen(true)} className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium" style={{ color: 'var(--mut)' }}>
          <Briefcase className="w-5 h-5" />Ещё
        </button>
      </nav>
      {toolsOpen && (
        <div className="lg:hidden fixed inset-0 z-[1300] flex items-end" style={{ background: 'rgba(10,10,12,.45)' }} onClick={() => setToolsOpen(false)}>
          <div className="w-full rounded-t-[28px] p-3 pb-6" style={{ background: 'var(--sf)' }} onClick={e => e.stopPropagation()}>
            {TOOLS.map(t => <ToolItem key={t.id} {...t} onClick={() => openTool(t.id)} />)}
            <ToolItem icon={Info} title="О проекте" sub="первый экран и цифры проверки" onClick={() => { setToolsOpen(false); onExit(); }} />
          </div>
        </div>
      )}

      {tool && (
        <Drawer title={tool === 'signal' ? 'Разобрать сигнал' : 'Симулятор потока'} onClose={() => setTool(null)}>
          {tool === 'signal' ? <FalseAlarmFilter /> : <StreamSimulator onRefreshStats={load} />}
        </Drawer>
      )}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={load} />
    </div>
  );
};

const ToolItem: React.FC<{ icon: React.ElementType; title: string; sub: string; onClick: () => void }> = ({ icon: I, title, sub, onClick }) => (
  <button onClick={onClick} className="w-full flex gap-3 p-3 rounded-xl text-left hover:bg-[var(--sf2)]">
    <I className="w-5 h-5 shrink-0" style={{ color: 'var(--ac)' }} />
    <span><b className="block text-sm font-medium">{title}</b><span className="text-xs" style={{ color: 'var(--mut)' }}>{sub}</span></span>
  </button>
);

const ToolsMenu: React.FC<{ open: boolean; setOpen: (v: boolean) => void; onPick: (id: string) => void }> = ({ open, setOpen, onPick }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, setOpen]);
  return (
    <div className="relative" ref={ref}>
      <button className="icon-btn" title="Инструменты" aria-label="Инструменты" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Briefcase className="w-[18px] h-[18px]" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-[280px] p-1.5 rounded-2xl rise" style={{ background: 'var(--sf)', boxShadow: 'var(--shadow)', animationDuration: '.25s' }}>
          {TOOLS.map(t => <ToolItem key={t.id} {...t} onClick={() => onPick(t.id)} />)}
        </div>
      )}
    </div>
  );
};

const ShiftButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { dispatcher, openShift, endShift } = useSession();
  if (!dispatcher) {
    return compact
      ? <button onClick={openShift} aria-label="Начать смену" className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--ac)', color: 'var(--act)' }}><UserCircle className="w-5 h-5" /></button>
      : <button onClick={openShift} className="btn btn-primary"><UserCircle className="w-[18px] h-[18px]" />Начать смену</button>;
  }
  return (
    <button onClick={endShift} title="Завершить смену" className="h-10 px-4 rounded-full border flex items-center gap-2 num text-[13px] font-medium"
            style={{ borderColor: 'var(--ln)', background: 'var(--oks)' }}>
      <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ok)' }} />{dispatcher.badge}{!compact && ' на смене'}
    </button>
  );
};

const Drawer: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[1400] flex justify-end" style={{ background: 'rgba(10,10,12,.45)' }} onClick={onClose}>
    <div className="w-full max-w-[920px] h-full flex flex-col" style={{ background: 'var(--bg)' }} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 h-16 border-b shrink-0" style={{ borderColor: 'var(--ln)', background: 'var(--sf)' }}>
        <div className="serif font-semibold text-[28px] leading-none">{title}</div>
        <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
    </div>
  </div>
);

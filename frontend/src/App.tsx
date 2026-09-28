import React, { useCallback, useEffect, useState } from 'react';
import {
  Map as MapIcon, ClipboardList, LineChart, Stethoscope, Play, SlidersHorizontal, Info, LogOut, UserCheck, X, MoreHorizontal,
} from 'lucide-react';
import { Landing, Logo } from './shell/Landing';
import { Situation } from './situation/Situation';
import { MaintenanceTickets } from './components/MaintenanceTickets';
import { MetricsView } from './components/MetricsView';
import { FalseAlarmFilter } from './components/FalseAlarmFilter';
import { StreamSimulator } from './components/StreamSimulator';
import { SettingsModal } from './components/SettingsModal';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider } from './lib/toast';
import { fmtInt, fmtNum } from './lib/api';
import { ConfirmedAlarmItem, ObjectItem, PredictionItem, SystemStats } from './types';

type View = 'situation' | 'tickets' | 'quality';
type Tool = 'signal' | 'simulator' | null;

const VIEWS: Array<{ id: View; title: string; sub: string; icon: React.ElementType }> = [
  { id: 'situation', title: 'Обстановка', sub: 'Карта и очередь риска', icon: MapIcon },
  { id: 'tickets', title: 'Заявки и журнал', sub: 'Наряды ТО, решения смены', icon: ClipboardList },
  { id: 'quality', title: 'Качество модели', sub: 'Проверка на реальных данных', icon: LineChart },
];

const readView = (): View => {
  const v = new URLSearchParams(window.location.search).get('view');
  return v === 'tickets' || v === 'quality' ? v : 'situation';
};

export const App: React.FC = () => (
  <ToastProvider>
    <SessionProvider>
      <Root />
    </SessionProvider>
  </ToastProvider>
);

const Root: React.FC = () => {
  const [entered, setEntered] = useState(() => new URLSearchParams(window.location.search).has('view'));
  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => {
    setViewState(v);
    setEntered(true);
    try { const u = new URL(window.location.href); u.searchParams.set('view', v); window.history.replaceState({}, '', u); } catch { /* ignore */ }
  };
  if (!entered) return <Landing onEnter={() => setView('situation')} onOpenQuality={() => setView('quality')} />;
  return <Workspace view={view} setView={setView} onExit={() => setEntered(false)} />;
};

const Workspace: React.FC<{ view: View; setView: (v: View) => void; onExit: () => void }> = ({ view, setView, onExit }) => {
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [counts, setCounts] = useState<{ critical: number; warning: number } | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedAlarmItem[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [roc, setRoc] = useState<number | undefined>();
  const [tool, setTool] = useState<Tool>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const load = useCallback(async () => {
    const get = (u: string) => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [obj, pred, conf, st] = await Promise.all([
      get('/api/objects'), get('/api/predictions?limit=500'), get('/api/alarms/confirmed'), get('/api/stats/summary'),
    ]);
    if (obj) setObjects(obj);
    if (pred) { setPredictions(pred.items || []); setCounts({ critical: pred.critical_count, warning: pred.warning_count }); }
    if (conf) setConfirmed(conf);
    if (st) setStats(st);
  }, []);

  useEffect(() => {
    load();
    fetch('/api/predictions/backtest').then(r => (r.ok ? r.json() : null))
      .then(d => setRoc(d?.summary?.all?.lgbm_weekly?.roc_auc?.median)).catch(() => {});
  }, [load]);

  const current = VIEWS.find(v => v.id === view)!;
  const openTool = (t: Tool) => { setTool(t); setMoreOpen(false); };

  return (
    <div className="h-full flex" style={{ background: 'var(--bg)' }}>
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-[244px] shrink-0 flex-col border-r" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
        <button onClick={onExit} className="flex items-center gap-3 px-5 h-16 border-b text-left" style={{ borderColor: 'var(--line)' }} title="О проекте">
          <Logo />
          <div>
            <div className="text-sm font-semibold">НейроКонтур</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>Москоллектор · ОДС</div>
          </div>
        </button>
        <nav className="p-3 space-y-1">
          <div className="px-2 pt-2 pb-1 label">Рабочие области</div>
          {VIEWS.map(v => {
            const active = v.id === view;
            return (
              <button key={v.id} onClick={() => setView(v.id)} aria-current={active ? 'page' : undefined}
                      className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                      style={active ? { background: 'var(--accent-soft)', boxShadow: 'inset 2px 0 0 var(--accent)' } : undefined}>
                <v.icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: active ? 'var(--accent-text)' : 'var(--muted)' }} />
                <span>
                  <span className="block text-sm font-medium" style={{ color: active ? 'var(--text)' : 'var(--muted)' }}>{v.title}</span>
                  <span className="block text-xs" style={{ color: 'var(--faint)' }}>{v.sub}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto p-3 space-y-1 border-t" style={{ borderColor: 'var(--line)' }}>
          <div className="px-2 pt-1 pb-1 label">Инструменты</div>
          <ToolButton icon={Stethoscope} text="Разобрать сигнал" onClick={() => openTool('signal')} />
          <ToolButton icon={Play} text="Симулятор потока" onClick={() => openTool('simulator')} />
          <ToolButton icon={SlidersHorizontal} text="Параметры и пороги" onClick={() => setSettingsOpen(true)} />
          <ToolButton icon={Info} text="О проекте" onClick={onExit} />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="shrink-0 border-b" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-4 px-4 lg:px-6 h-14 lg:h-16">
            <div className="lg:hidden"><Logo /></div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{current.title}</div>
              <div className="text-xs truncate hidden sm:block" style={{ color: 'var(--muted)' }}>{current.sub}</div>
            </div>
            <div className="hidden md:flex items-center ml-auto">
              <Kpi label="Критично" value={fmtInt(counts?.critical)} color="var(--crit)" />
              <Kpi label="Предупреждение" value={fmtInt(counts?.warning)} color="var(--warn)" />
              <Kpi label="Заявок ТО" value={fmtInt(stats?.tickets_count)} />
              <Kpi label="ROC-AUC модели" value={fmtNum(roc, 2)} />
            </div>
            <div className="ml-auto md:ml-4"><ShiftButton /></div>
          </div>
          <div className="md:hidden grid grid-cols-3 border-t text-center" style={{ borderColor: 'var(--line)' }}>
            <MobileKpi label="Критично" value={fmtInt(counts?.critical)} color="var(--crit)" />
            <MobileKpi label="Предупр." value={fmtInt(counts?.warning)} color="var(--warn)" />
            <MobileKpi label="Заявок ТО" value={fmtInt(stats?.tickets_count)} />
          </div>
        </header>

        <main className="flex-1 min-h-0 pb-16 lg:pb-0">
          {view === 'situation' && <Situation objects={objects} predictions={predictions} confirmed={confirmed} onChanged={load} />}
          {view === 'tickets' && <div className="h-full overflow-y-auto p-4 lg:p-6"><MaintenanceTickets onRefreshStats={load} /></div>}
          {view === 'quality' && <div className="h-full overflow-y-auto p-4 lg:p-6"><MetricsView /></div>}
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[1100] grid grid-cols-4 h-16 border-t" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)} className="flex flex-col items-center justify-center gap-1 text-[11px]"
                    style={{ color: v.id === view ? 'var(--accent-text)' : 'var(--muted)' }}>
              <v.icon className="w-5 h-5" />{v.title.split(' ')[0]}
            </button>
          ))}
          <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center justify-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}>
            <MoreHorizontal className="w-5 h-5" />Ещё
          </button>
        </nav>
      </div>

      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-[1300] bg-black/60 flex items-end" onClick={() => setMoreOpen(false)}>
          <div className="w-full rounded-t-2xl p-3 pb-6 space-y-1" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
            <ToolButton icon={Stethoscope} text="Разобрать сигнал" onClick={() => openTool('signal')} />
            <ToolButton icon={Play} text="Симулятор потока" onClick={() => openTool('simulator')} />
            <ToolButton icon={SlidersHorizontal} text="Параметры и пороги" onClick={() => { setMoreOpen(false); setSettingsOpen(true); }} />
            <ToolButton icon={Info} text="О проекте" onClick={onExit} />
          </div>
        </div>
      )}

      {tool && (
        <Drawer title={tool === 'signal' ? 'Разобрать сигнал' : 'Симулятор потока телеметрии'} onClose={() => setTool(null)}>
          {tool === 'signal' ? <FalseAlarmFilter /> : <StreamSimulator onRefreshStats={load} />}
        </Drawer>
      )}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={load} />
    </div>
  );
};

const ToolButton: React.FC<{ icon: React.ElementType; text: string; onClick: () => void }> = ({ icon: I, text, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-[var(--surface-2)]" style={{ color: 'var(--muted)' }}>
    <I className="w-4 h-4" />{text}
  </button>
);

const Kpi: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="px-4 border-l first:border-l-0" style={{ borderColor: 'var(--line)' }}>
    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{label}</div>
    <div className="num text-base font-semibold flex items-center gap-1.5">
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}{value}
    </div>
  </div>
);

const MobileKpi: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="py-2 border-l first:border-l-0" style={{ borderColor: 'var(--line)' }}>
    <div className="num text-sm font-semibold flex items-center justify-center gap-1.5">
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}{value}
    </div>
    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{label}</div>
  </div>
);

const ShiftButton: React.FC = () => {
  const { dispatcher, openShift, endShift } = useSession();
  if (!dispatcher) {
    return <button className="btn btn-secondary h-9" onClick={openShift}><UserCheck className="w-4 h-4" />Начать смену</button>;
  }
  return (
    <div className="flex items-center gap-2">
      <div className="text-right hidden sm:block">
        <div className="num text-xs font-semibold">{dispatcher.badge}</div>
        <div className="text-[11px] max-w-[160px] truncate" style={{ color: 'var(--muted)' }}>{dispatcher.full_name}</div>
      </div>
      <span className="sm:hidden num text-xs font-semibold">{dispatcher.badge}</span>
      <button className="icon-btn" onClick={endShift} title="Завершить смену" aria-label="Завершить смену"><LogOut className="w-4 h-4" /></button>
    </div>
  );
};

const Drawer: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[1400] bg-black/60 flex justify-end" onClick={onClose}>
    <div className="w-full max-w-[920px] h-full flex flex-col border-l" style={{ background: 'var(--bg)', borderColor: 'var(--line-2)' }} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 h-14 border-b shrink-0" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
        <div className="font-semibold">{title}</div>
        <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
    </div>
  </div>
);

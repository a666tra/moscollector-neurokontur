import React, { useCallback, useEffect, useState } from 'react';
import {
  Map as MapIcon, ClipboardList, LineChart, FlaskConical, LayoutDashboard, SlidersHorizontal, ArrowLeftRight, MoreHorizontal, X,
} from 'lucide-react';
import { Landing } from './shell/Landing';
import { Situation } from './situation/Situation';
import { MaintenanceTickets } from './components/MaintenanceTickets';
import { MetricsView } from './components/MetricsView';
import { ScenarioLab } from './scenarios/ScenarioLab';
import { SummaryView } from './summary/SummaryView';
import { FalseAlarmFilter } from './components/FalseAlarmFilter';
import { StreamSimulator } from './components/StreamSimulator';
import { SettingsModal } from './components/SettingsModal';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider } from './lib/toast';
import { ThemeProvider, ThemeButton } from './lib/theme';
import { ConfirmedAlarmItem, ObjectItem, PredictionItem, UserRole } from './types';
import { FieldView } from './field/FieldView';

type View = 'summary' | 'field' | 'situation' | 'tickets' | 'quality' | 'scenarios';
type Tool = 'signal' | 'simulator' | null;

const VIEWS: Array<{ id: View; title: string; short: string; icon: React.ElementType }> = [
  { id: 'situation', title: 'Обстановка', short: 'Обстановка', icon: MapIcon },
  { id: 'tickets', title: 'Заявки и журнал', short: 'Заявки', icon: ClipboardList },
  { id: 'summary', title: 'Сводка', short: 'Сводка', icon: LayoutDashboard },
  { id: 'quality', title: 'Качество модели', short: 'Качество', icon: LineChart },
  { id: 'scenarios', title: 'Сценарии', short: 'Сценарии', icon: FlaskConical },
];

const TECH_VIEWS: Array<{ id: View; title: string; short: string; icon: React.ElementType }> = [
  { id: 'field', title: 'Поле', short: 'Поле', icon: MapIcon },
  { id: 'tickets', title: 'Заявки', short: 'Заявки', icon: ClipboardList },
];

const readRole = (): UserRole => {
  const r = new URLSearchParams(window.location.search).get('role');
  return r === 'tech' ? 'tech' : 'disp';
};

const readView = (role: UserRole): View => {
  const v = new URLSearchParams(window.location.search).get('view') as View;
  if (role === 'tech') {
    return v === 'tickets' ? 'tickets' : 'field';
  }
  return v === 'summary' || v === 'tickets' || v === 'quality' || v === 'scenarios' ? v : 'situation';
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
  const [role, setRoleState] = useState<UserRole>(readRole);
  const [entered, setEntered] = useState(() => new URLSearchParams(window.location.search).has('view'));
  const [view, setViewState] = useState<View>(() => readView(readRole()));
  const { openShift, dispatcher } = useSession();

  const handleSelectRole = (nextRole: UserRole) => {
    setRoleState(nextRole);
    const nextView: View = nextRole === 'tech' ? 'field' : 'situation';
    setViewState(nextView);
    setEntered(true);
    if (nextRole === 'disp' && !dispatcher) {
      openShift();
    }
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('role', nextRole);
      u.searchParams.set('view', nextView);
      window.history.replaceState({}, '', u);
    } catch { /* ignore */ }
  };

  const setView = (v: View) => {
    setViewState(v);
    setEntered(true);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('role', role);
      u.searchParams.set('view', v);
      window.history.replaceState({}, '', u);
    } catch { /* ignore */ }
  };

  const handleExit = () => {
    setEntered(false);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('view');
      window.history.replaceState({}, '', u);
    } catch { /* ignore */ }
  };

  if (!entered) {
    return (
      <Landing
        onSelectRole={handleSelectRole}
        onOpenQuality={() => {
          setRoleState('disp');
          setView('quality');
        }}
        onOpenScenarios={() => {
          setRoleState('disp');
          setView('scenarios');
        }}
      />
    );
  }
  return <Workspace role={role} view={view} setView={setView} onExit={handleExit} />;
};

const Workspace: React.FC<{ role: UserRole; view: View; setView: (v: View) => void; onExit: () => void }> = ({ role, view, setView, onExit }) => {
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [totalPredictions, setTotalPredictions] = useState<number>(0);
  const [confirmed, setConfirmed] = useState<ConfirmedAlarmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [settingsOpen, setSettingsOpen] = useState(() => new URLSearchParams(window.location.search).has('settings'));
  const [moreOpen, setMoreOpen] = useState(false);
  const [ticketFilterObjectId, setTicketFilterObjectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const get = async (u: string) => {
        const res = await fetch(u);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      };
      const [obj, pred, conf, health] = await Promise.all([
        get('/api/objects'),
        get('/api/predictions?limit=500'),
        get('/api/alarms/confirmed'),
        fetch('/api/health').then(r => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (obj) setObjects(obj);
      if (pred) {
        setPredictions(pred.items || []);
        if (typeof pred.total === 'number') setTotalPredictions(pred.total);
      }
      if (conf) setConfirmed(conf);
      if (health?.data_snapshot_date) setSnapshotDate(health.data_snapshot_date);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const formatSnapshotDate = (raw?: string | null): string | null => {
    if (!raw) return null;
    const parts = raw.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return raw;
  };
  const formatShortDate = (raw?: string | null): string => {
    if (!raw) return 'до 28.01.2026';
    const parts = raw.split('-');
    if (parts.length === 3) return `до ${parts[2]}.${parts[1]}.${parts[0]}`;
    return `до ${raw}`;
  };
  const snapshotFormatted = formatSnapshotDate(snapshotDate);
  const fullDateText = snapshotFormatted ? `данные до ${snapshotFormatted}` : 'данные до 28.01.2026';
  const shortDateText = formatShortDate(snapshotDate);
  const clockText = `${fullDateText} · прогноз на 1–3 дня`;
  const clockTooltip = 'Дата, до которой построены признаки модели в стенде';

  const isTech = role === 'tech';

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Desktop Header */}
      <header
        className="hidden lg:flex shrink-0 h-16 items-center gap-2.5 xl:gap-3.5 px-3.5 xl:px-5 border-b relative z-[900]"
        style={{ background: 'var(--bg)', borderColor: 'var(--ln)' }}
      >
        <button
          onClick={onExit}
          className="serif italic font-medium text-[24px] xl:text-[27px] leading-none mr-1 xl:mr-2 text-[var(--ink)] bg-transparent border-0 p-0 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
          title="На главную"
        >
          НейроКонтур
        </button>

        {isTech && (
          <span
            className="font-mono text-[11px] font-semibold tracking-[0.08em] px-2.5 py-1 rounded-full shrink-0"
            style={{ background: 'var(--sf2)', color: 'var(--ink)' }}
          >
            РЕЖИМ ТЕХНИКА
          </span>
        )}

        {/* Pill tab-switcher */}
        <nav
          className="flex items-center gap-1 p-1 rounded-full shrink-0"
          style={{ background: 'var(--sf2)' }}
        >
          {(isTech ? TECH_VIEWS : VIEWS).map(v => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                onClick={() => {
                  if (v.id === 'tickets') setTicketFilterObjectId(null);
                  setView(v.id);
                }}
                aria-current={active ? 'page' : undefined}
                className="h-9 px-3 xl:px-3.5 rounded-full flex items-center gap-1.5 xl:gap-2 text-[13px] xl:text-sm whitespace-nowrap transition-all duration-150 cursor-pointer border-0"
                style={
                  active
                    ? {
                        background: 'var(--sf)',
                        color: 'var(--ink)',
                        boxShadow: 'var(--sh)',
                        fontWeight: 600,
                      }
                    : {
                        background: 'transparent',
                        color: 'var(--mu)',
                        fontWeight: 500,
                      }
                }
              >
                <v.icon
                  className="w-4 h-4 shrink-0"
                  style={active ? { color: 'var(--ac)' } : { color: 'currentColor' }}
                />
                <span>{v.title}</span>
              </button>
            );
          })}
        </nav>

        {/* Status dot + date: below 1500px show only green dot + short date, at >=1500px full text */}
        <span
          className="ml-auto flex items-center gap-2 text-[13px] whitespace-nowrap cursor-help shrink-0"
          style={{ color: 'var(--mu)' }}
          title={clockTooltip}
        >
          <i className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--gn)' }} />
          <span className="hidden min-[1500px]:inline">{clockText}</span>
          <span className="min-[1500px]:hidden">{shortDateText}</span>
        </span>

        {/* Settings button */}
        {!isTech && (
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Параметры и пороги"
            title="Параметры и пороги"
            className="w-9 h-9 xl:w-10 xl:h-10 rounded-full border flex items-center justify-center shrink-0 transition-colors hover:bg-[var(--sf2)] cursor-pointer"
            style={{ borderColor: 'var(--ln)', background: 'var(--sf)', color: 'var(--ink)' }}
          >
            <SlidersHorizontal className="w-[17px] h-[17px] xl:w-[18px] xl:h-[18px]" />
          </button>
        )}

        {/* Theme toggle */}
        <ThemeButton className="w-9 h-9 xl:w-10 xl:h-10 rounded-full border border-[var(--ln)] bg-[var(--sf)] text-[var(--ink)] flex items-center justify-center hover:bg-[var(--sf2)] shrink-0 cursor-pointer" />

        {/* Change role button */}
        <button
          onClick={onExit}
          aria-label="Сменить роль"
          className="h-9 xl:h-10 px-3 xl:px-3.5 rounded-full border flex items-center gap-1.5 xl:gap-2 text-[13px] xl:text-sm font-medium whitespace-nowrap transition-colors hover:bg-[var(--sf2)] shrink-0 cursor-pointer"
          style={{ borderColor: 'var(--ln)', background: 'var(--sf)', color: 'var(--ink)' }}
        >
          <ArrowLeftRight className="w-4 h-4 shrink-0" />
          <span>Сменить роль</span>
        </button>
      </header>

      {/* Mobile Header */}
      <header
        className="lg:hidden shrink-0 h-14 flex items-center justify-between px-3 sm:px-3.5 border-b relative z-[900] max-w-full overflow-hidden"
        style={{ background: 'var(--bg)', borderColor: 'var(--ln)' }}
      >
        <button
          onClick={onExit}
          className="serif italic font-medium text-[20px] sm:text-[22px] leading-none text-[var(--ink)] bg-transparent border-0 p-0 cursor-pointer shrink-0 truncate max-w-[130px] sm:max-w-none"
          title="На главную"
        >
          НейроКонтур
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span
            className="font-mono text-[11px] sm:text-[11.5px] font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border flex items-center gap-1.5 shrink-0"
            style={{ borderColor: 'var(--ln)', background: 'var(--sf2)', color: 'var(--ink)' }}
            title={clockTooltip}
          >
            <i className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--gn)' }} />
            <span>{shortDateText}</span>
          </span>
          <ThemeButton className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[var(--sf2)] text-[var(--ink)] flex items-center justify-center border-0 cursor-pointer shrink-0" />
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 min-h-0 relative overflow-x-hidden">
        {loading && objects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ac)', borderTopColor: 'transparent' }} />
            <span className="text-[15px] font-medium" style={{ color: 'var(--mu)' }}>Загружаем данные…</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm max-w-md w-full" style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}>
              <span className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Не удалось загрузить данные</span>
              <button onClick={load} className="btn btn-primary px-4 py-2 text-xs font-semibold shrink-0">
                Повторить
              </button>
            </div>
          </div>
        ) : (
          <>
            {view === 'situation' && (
              <Situation
                objects={objects}
                predictions={predictions}
                confirmed={confirmed}
                totalPredictions={totalPredictions}
                onChanged={load}
                onOpenTickets={(objId) => {
                  setTicketFilterObjectId(objId || null);
                  setView('tickets');
                }}
              />
            )}
            {view === 'tickets' && (
              <div className="h-full overflow-y-auto px-3 sm:px-4 py-4 pb-20 lg:p-6">
                <div className="max-w-[1400px] mx-auto">
                  <MaintenanceTickets
                    filterObjectId={ticketFilterObjectId}
                    onClearFilter={() => setTicketFilterObjectId(null)}
                    onRefreshStats={load}
                    objects={objects}
                    predictions={predictions}
                  />
                </div>
              </div>
            )}
            {view === 'summary' && (
              <div className="h-full overflow-y-auto overflow-x-hidden w-full px-3.5 sm:px-4 py-4 pb-20 lg:p-6">
                <SummaryView
                  onOpenScenarios={() => setView('scenarios')}
                  onOpenTickets={() => {
                    setTicketFilterObjectId(null);
                    setView('tickets');
                  }}
                />
              </div>
            )}
            {view === 'quality' && (
              <div className="h-full overflow-y-auto px-4 py-4 lg:p-6">
                <div className="max-w-[1320px] mx-auto">
                  <MetricsView onOpenSettings={() => setSettingsOpen(true)} />
                </div>
              </div>
            )}
            {view === 'scenarios' && <div className="h-full overflow-y-auto px-4 py-4 lg:p-6"><div className="max-w-[1320px] mx-auto"><ScenarioLab /></div></div>}
            {view === 'field' && (
              <FieldView
                objects={objects}
                predictions={predictions}
                snapshotDate={snapshotFormatted || '28.01.2026'}
                onOpenTickets={(objId) => {
                  setTicketFilterObjectId(objId || null);
                  setView('tickets');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Tab Bar */}
      {isTech ? (
        <nav
          className="lg:hidden shrink-0 h-[68px] grid grid-cols-3 border-t z-[1100]"
          style={{ borderColor: 'var(--ln)', background: 'var(--sf)' }}
        >
          {TECH_VIEWS.map(v => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                onClick={() => {
                  if (v.id === 'tickets') setTicketFilterObjectId(null);
                  setView(v.id);
                }}
                className="flex flex-col items-center justify-center gap-1 text-[11.5px] font-medium cursor-pointer border-0 bg-transparent min-h-[48px]"
                style={{ color: active ? 'var(--ink)' : 'var(--mu)', fontWeight: active ? 700 : 500 }}
              >
                <span
                  className="w-14 h-7.5 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: active ? 'var(--acs)' : 'transparent' }}
                >
                  <v.icon className="w-5 h-5 shrink-0" style={active ? { color: 'var(--ac)' } : undefined} />
                </span>
                <span>{v.short}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-[11.5px] font-medium cursor-pointer border-0 bg-transparent min-h-[48px]"
            style={{ color: moreOpen ? 'var(--ink)' : 'var(--mu)', fontWeight: moreOpen ? 700 : 500 }}
          >
            <span
              className="w-14 h-7.5 rounded-full flex items-center justify-center transition-colors"
              style={{ background: moreOpen ? 'var(--acs)' : 'transparent' }}
            >
              <MoreHorizontal className="w-5 h-5 shrink-0" style={moreOpen ? { color: 'var(--ac)' } : undefined} />
            </span>
            <span>Ещё</span>
          </button>
        </nav>
      ) : (
        <nav
          className="lg:hidden shrink-0 h-[68px] grid grid-cols-5 border-t z-[1100]"
          style={{ borderColor: 'var(--ln)', background: 'var(--sf)' }}
        >
          {[
            { id: 'situation', short: 'Обстановка', icon: MapIcon },
            { id: 'tickets', short: 'Заявки', icon: ClipboardList },
            { id: 'summary', short: 'Сводка', icon: LayoutDashboard },
            { id: 'scenarios', short: 'Сценарии', icon: FlaskConical },
          ].map(v => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                onClick={() => {
                  if (v.id === 'tickets') setTicketFilterObjectId(null);
                  setView(v.id as View);
                }}
                className="flex flex-col items-center justify-center gap-1 text-[11.5px] cursor-pointer border-0 bg-transparent min-h-[48px]"
                style={{ color: active ? 'var(--ink)' : 'var(--mu)', fontWeight: active ? 700 : 500 }}
              >
                <span
                  className="w-14 h-7.5 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: active ? 'var(--acs)' : 'transparent' }}
                >
                  <v.icon className="w-5 h-5 shrink-0" style={active ? { color: 'var(--ac)' } : undefined} />
                </span>
                <span className="leading-none">{v.short}</span>
              </button>
            );
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-[11.5px] cursor-pointer border-0 bg-transparent min-h-[48px]"
            style={{
              color: view === 'quality' || moreOpen ? 'var(--ink)' : 'var(--mu)',
              fontWeight: view === 'quality' || moreOpen ? 700 : 500,
            }}
          >
            <span
              className="w-14 h-7.5 rounded-full flex items-center justify-center transition-colors"
              style={{ background: view === 'quality' || moreOpen ? 'var(--acs)' : 'transparent' }}
            >
              <MoreHorizontal className="w-5 h-5 shrink-0" style={view === 'quality' ? { color: 'var(--ac)' } : undefined} />
            </span>
            <span className="leading-none">{view === 'quality' ? 'Качество' : 'Ещё'}</span>
          </button>
        </nav>
      )}

      {/* Mobile "More" Drawer */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[1300] flex items-end"
          style={{ background: 'oklch(0.1 0.02 260 / 0.5)' }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Дополнительные разделы"
            className="w-full rounded-t-[24px] p-4 pb-8 flex flex-col gap-2 shadow-2xl"
            style={{ background: 'var(--sf)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: 'var(--ln2)' }} />

            <button
              onClick={() => {
                setMoreOpen(false);
                setView('quality');
              }}
              className="flex items-center gap-3.5 px-4 h-14 rounded-2xl text-left border-0 cursor-pointer font-medium text-[16px] transition-colors"
              style={{ background: 'var(--sf2)', color: 'var(--ink)' }}
            >
              <LineChart className="w-5 h-5 shrink-0 text-[var(--ac)]" />
              <span>Качество модели</span>
            </button>

            <button
              onClick={() => {
                setMoreOpen(false);
                setSettingsOpen(true);
              }}
              className="flex items-center gap-3.5 px-4 h-14 rounded-2xl text-left border-0 cursor-pointer font-medium text-[16px] transition-colors"
              style={{ background: 'var(--sf2)', color: 'var(--ink)' }}
            >
              <SlidersHorizontal className="w-5 h-5 shrink-0 text-[var(--ac)]" />
              <span>Параметры и пороги</span>
            </button>

            <button
              onClick={() => {
                setMoreOpen(false);
                onExit();
              }}
              className="flex items-center gap-3.5 px-4 h-14 rounded-2xl text-left border-0 cursor-pointer font-medium text-[16px] transition-colors"
              style={{ background: 'var(--sf2)', color: 'var(--ink)' }}
            >
              <ArrowLeftRight className="w-5 h-5 shrink-0 text-[var(--mu)]" />
              <span>Сменить роль</span>
            </button>
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

const Drawer: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1400] flex justify-end" style={{ background: 'rgba(10,10,12,.45)' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[920px] h-full flex flex-col"
        style={{ background: 'var(--bg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b shrink-0" style={{ borderColor: 'var(--ln)', background: 'var(--sf)' }}>
          <div className="serif font-semibold text-[28px] leading-none">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
      </div>
    </div>
  );
};

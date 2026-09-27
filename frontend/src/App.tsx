import React, { useState, useEffect } from 'react';
import { 
  Map, ShieldAlert, Filter, Wrench, Play, BarChart3, 
  Activity, Clock, Sliders, Info
} from 'lucide-react';
import { HeroCover } from './components/HeroCover';
import { CollectorMap } from './components/CollectorMap';
import { RiskDashboard } from './components/RiskDashboard';
import { FalseAlarmFilter } from './components/FalseAlarmFilter';
import { MaintenanceTickets } from './components/MaintenanceTickets';
import { StreamSimulator } from './components/StreamSimulator';
import { MetricsView } from './components/MetricsView';
import { SettingsModal } from './components/SettingsModal';
import { DemoAccessHint } from './components/DemoAccessHint';
import { SystemStats } from './types';

type ActiveTab = 'map' | 'risks' | 'alarms' | 'tickets' | 'simulator' | 'metrics';

export const App: React.FC = () => {
  const [showHero, setShowHero] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') || params.get('hero') === 'false') {
      return false;
    }
    return !sessionStorage.getItem('hero_dismissed');
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as ActiveTab;
    if (tabParam && ['map', 'risks', 'alarms', 'tickets', 'simulator', 'metrics'].includes(tabParam)) {
      return tabParam;
    }
    return 'map';
  });

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    } catch (_) {}
  };
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [backtestWeeks, setBacktestWeeks] = useState<number>(21);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [objects, setObjects] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | undefined>(undefined);
  const [createdTicketIds, setCreatedTicketIds] = useState<Set<string>>(new Set());
  const [dispatcherBadge, setDispatcherBadge] = useState('');
  const [dispatcherPin, setDispatcherPin] = useState('');
  const [ticketActionError, setTicketActionError] = useState('');
  const [ticketActionNotice, setTicketActionNotice] = useState('');

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats/summary');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to load system stats', e);
    }
  };

  const fetchBacktestWeeks = async () => {
    try {
      const res = await fetch('/api/predictions/backtest');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.test_weeks === 'number') {
          setBacktestWeeks(data.test_weeks);
        }
      }
    } catch (e) {
      console.error('Failed to load backtest test_weeks', e);
    }
  };

  const fetchAppData = async () => {
    try {
      const [objRes, predRes] = await Promise.all([
        fetch('/api/objects'),
        fetch('/api/predictions?limit=500')
      ]);
      if (objRes.ok) {
        const objData = await objRes.json();
        setObjects(objData);
      }
      if (predRes.ok) {
        const predData = await predRes.json();
        setPredictions(predData.items || []);
      }
    } catch (e) {
      console.error('Failed to fetch objects or predictions', e);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchBacktestWeeks();
    fetchAppData();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateTicket = async (channelId: string) => {
    if (!dispatcherBadge.trim() || !/^\d{6}$/.test(dispatcherPin)) {
      setTicketActionNotice('');
      setTicketActionError('Введите табельный номер и 6-значный PIN, чтобы сформировать заявку на ТО.');
      return;
    }

    setTicketActionError('');
    setTicketActionNotice('');
    try {
      const res = await fetch('/api/tickets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          priority: 'ВЫСОКИЙ',
          notes: 'Сформировано по результатам предиктивного анализа риска СМВУ (горизонт 24–72 ч).',
          dispatcher_badge: dispatcherBadge.trim(),
          dispatcher_pin: dispatcherPin
        })
      });
      if (res.ok) {
        setCreatedTicketIds(prev => new Set([...prev, channelId]));
        setTicketActionNotice('Заявка на ТО успешно сформирована в реестре нарядов.');
        fetchStats();
        return;
      }
      const body = await res.json().catch(() => null);
      const detail = typeof body?.detail === 'string' ? body.detail : '';
      setTicketActionError(res.status === 401
        ? 'Учётные данные не подтверждены. Проверьте табельный номер и PIN.'
        : res.status === 403
          ? 'Данный уровень доступа не позволяет создавать заявки на ТО.'
          : detail || `Не удалось создать заявку (HTTP ${res.status}).`);
    } catch (e) {
      console.error('Failed to create ticket', e);
      setTicketActionError('Не удалось связаться с API. Проверьте подключение к серверу.');
    }
  };

  const handleSelectObject = (obj: any) => {
    setSelectedObjectId(obj.object_id);
  };

  // Live Moscow time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleEnterDashboard = (tab: ActiveTab = 'map') => {
    setActiveTab(tab);
    setShowHero(false);
    sessionStorage.setItem('hero_dismissed', 'true');
  };

  if (showHero) {
    return (
      <HeroCover 
        stats={stats} 
        onEnter={() => handleEnterDashboard('map')} 
        onOpenMetrics={() => handleEnterDashboard('metrics')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#E7EAF0] flex flex-col font-sans">
      {/* Top Header per DESIGN.md */}
      <header className="bg-[#121620] border-b border-white/10 sticky top-0 z-50 px-4 py-2">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
          {/* Logo + Subtitle */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#7C4DFF]/15 border border-[#7C4DFF]/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#7C4DFF]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#E7EAF0] leading-tight">
                Москоллектор · НейроКонтур
              </div>
              <div className="text-xs text-[#9AA3B2] leading-tight">
                Прогноз инцидентов коллекторов
              </div>
            </div>
          </div>

          {/* Navigation Tabs (scrollable on mobile, single line on desktop) */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            <button
              onClick={() => handleTabChange('map')}
              className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap border-b-2 flex items-center gap-2 ${
                activeTab === 'map'
                  ? 'border-[#7C4DFF] text-[#E7EAF0] font-semibold'
                  : 'border-transparent text-[#9AA3B2] hover:text-[#E7EAF0]'
              }`}
            >
              <Map className="w-4 h-4 text-[#7C4DFF]" />
              <span>Карта сети</span>
            </button>

            <button
              onClick={() => handleTabChange('risks')}
              className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap border-b-2 flex items-center gap-2 ${
                activeTab === 'risks'
                  ? 'border-[#7C4DFF] text-[#E7EAF0] font-semibold'
                  : 'border-transparent text-[#9AA3B2] hover:text-[#E7EAF0]'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-[#F0453A]" />
              <span>Риски 24–72 ч</span>
              {stats?.critical_sensors_count ? (
                <span className="ml-1 px-1.5 py-0.2 bg-[#F0453A]/20 text-[#F0453A] font-mono rounded-full text-xs font-semibold">
                  {stats.critical_sensors_count}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => handleTabChange('alarms')}
              className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap border-b-2 flex items-center gap-2 ${
                activeTab === 'alarms'
                  ? 'border-[#7C4DFF] text-[#E7EAF0] font-semibold'
                  : 'border-transparent text-[#9AA3B2] hover:text-[#E7EAF0]'
              }`}
            >
              <Filter className="w-4 h-4 text-[#4C9BFF]" />
              <span>Фильтр тревог</span>
            </button>

            <button
              onClick={() => handleTabChange('tickets')}
              className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap border-b-2 flex items-center gap-2 ${
                activeTab === 'tickets'
                  ? 'border-[#7C4DFF] text-[#E7EAF0] font-semibold'
                  : 'border-transparent text-[#9AA3B2] hover:text-[#E7EAF0]'
              }`}
            >
              <Wrench className="w-4 h-4 text-[#F5A524]" />
              <span>Наряды ТО/ППР</span>
              {stats?.tickets_count ? (
                <span className="ml-1 px-1.5 py-0.2 bg-[#F5A524]/20 text-[#F5A524] font-mono rounded-full text-xs font-semibold">
                  {stats.tickets_count}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => handleTabChange('simulator')}
              className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap border-b-2 flex items-center gap-2 ${
                activeTab === 'simulator'
                  ? 'border-[#7C4DFF] text-[#E7EAF0] font-semibold'
                  : 'border-transparent text-[#9AA3B2] hover:text-[#E7EAF0]'
              }`}
            >
              <Play className="w-4 h-4 text-[#2FBF71]" />
              <span>Симулятор (демо)</span>
            </button>

            <button
              onClick={() => handleTabChange('metrics')}
              className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap border-b-2 flex items-center gap-2 ${
                activeTab === 'metrics'
                  ? 'border-[#7C4DFF] text-[#E7EAF0] font-semibold'
                  : 'border-transparent text-[#9AA3B2] hover:text-[#E7EAF0]'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-[#7C4DFF]" />
              <span>Проверка модели</span>
            </button>
          </nav>

          {/* Right Action Icons & Clock */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Clock: hidden on narrow screens per DESIGN.md */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#9AA3B2] font-mono mr-2">
              <Clock className="w-3.5 h-3.5 text-[#7C4DFF]" />
              <span>{currentTime} МСК</span>
            </div>

            {/* Settings Icon Button with Tooltip */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="p-2 text-[#9AA3B2] hover:text-[#E7EAF0] hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-colors cursor-pointer"
              title="Параметры и пороги"
              aria-label="Параметры и пороги"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* About / Hero Icon Button with Tooltip */}
            <button
              type="button"
              onClick={() => setShowHero(true)}
              className="p-2 text-[#9AA3B2] hover:text-[#E7EAF0] hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-colors cursor-pointer"
              title="О системе"
              aria-label="О системе"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace View */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 sm:p-6">
        {activeTab === 'map' && (
          <CollectorMap 
            objects={objects} 
            onSelectObject={handleSelectObject} 
            selectedObjectId={selectedObjectId} 
          />
        )}
        {activeTab === 'risks' && (
          <div className="space-y-4">
            <section className="eng-panel p-4 space-y-3" aria-label="Авторизация диспетчера">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-[#E7EAF0]">Учётные данные для оформления наряда ТО</div>
                  <p className="text-xs text-[#9AA3B2] mt-0.5">
                    Для создания наряда введите табельный номер и 6-значный PIN оператора ОДС.
                  </p>
                </div>
                <DemoAccessHint onFill={(b, p) => { setDispatcherBadge(b); setDispatcherPin(p); }} />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-end pt-1">
                <label className="text-xs text-[#9AA3B2]">
                  Табельный номер
                  <input
                    type="text"
                    value={dispatcherBadge}
                    onChange={event => { setDispatcherBadge(event.target.value); setTicketActionError(''); setTicketActionNotice(''); }}
                    placeholder="ДИСП-7041"
                    autoComplete="off"
                    className="block w-full sm:w-44 mt-1 bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-[#E7EAF0] focus:border-[#7C4DFF] focus:outline-none"
                  />
                </label>
                <label className="text-xs text-[#9AA3B2]">
                  PIN (6 цифр)
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={dispatcherPin}
                    onChange={event => { setDispatcherPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setTicketActionError(''); setTicketActionNotice(''); }}
                    placeholder="••••••"
                    autoComplete="off"
                    className="block w-full sm:w-36 mt-1 bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-[#E7EAF0] focus:border-[#7C4DFF] focus:outline-none font-mono"
                  />
                </label>
              </div>

              {ticketActionError && <p role="alert" className="text-xs text-[#F0453A] mt-2">{ticketActionError}</p>}
              {ticketActionNotice && <p role="status" className="text-xs text-[#2FBF71] mt-2">{ticketActionNotice}</p>}
            </section>

            <RiskDashboard
              predictions={predictions}
              onCreateTicket={handleCreateTicket}
              createdTicketIds={createdTicketIds}
            />
          </div>
        )}
        {activeTab === 'alarms' && <FalseAlarmFilter />}
        {activeTab === 'tickets' && <MaintenanceTickets onRefreshStats={fetchStats} />}
        {activeTab === 'simulator' && <StreamSimulator onRefreshStats={fetchStats} />}
        {activeTab === 'metrics' && <MetricsView />}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSaved={() => {
          fetchStats();
          fetchAppData();
        }}
      />

      {/* Footer Status Line per Task 2 */}
      <footer className="bg-[#121620] border-t border-white/10 px-4 py-2.5 text-xs text-[#9AA3B2]">
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span>
            Модель LightGBM · проверка на {backtestWeeks} неделе реального журнала СМВУ · демо-стенд без подключения к СМВУ/CMMS
          </span>
          <span className="text-[#6B7385]">
            АО «Москоллектор» · Комплекс городского хозяйства Москвы
          </span>
        </div>
      </footer>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Map, ShieldAlert, Filter, Wrench, Play, BarChart3, 
  Activity, Clock, Compass, Layers, RefreshCw, Info, ChevronRight,
  TrendingUp, CheckCircle, ShieldCheck, Sliders
} from 'lucide-react';
import { HeroCover } from './components/HeroCover';
import { CollectorMap } from './components/CollectorMap';
import { RiskDashboard } from './components/RiskDashboard';
import { FalseAlarmFilter } from './components/FalseAlarmFilter';
import { MaintenanceTickets } from './components/MaintenanceTickets';
import { StreamSimulator } from './components/StreamSimulator';
import { MetricsView } from './components/MetricsView';
import { SettingsModal } from './components/SettingsModal';
import { SystemStats } from './types';

type ActiveTab = 'map' | 'risks' | 'alarms' | 'tickets' | 'simulator' | 'metrics';

export const App: React.FC = () => {
  const [showHero, setShowHero] = useState<boolean>(() => {
    // Show hero on first visit unless bypassed
    return !sessionStorage.getItem('hero_dismissed');
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [objects, setObjects] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | undefined>(undefined);
  const [createdTicketIds, setCreatedTicketIds] = useState<Set<string>>(new Set());


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
    fetchAppData();
    const interval = setInterval(fetchStats, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleCreateTicket = async (channelId: string) => {
    try {
      const res = await fetch('/api/tickets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          priority: 'ВЫСОКИЙ',
          notes: 'Сформировано по прогнозу деградации датчика (горизонт 24ч).'
        })
      });
      if (res.ok) {
        setCreatedTicketIds(prev => new Set([...prev, channelId]));
        fetchStats();
      }
    } catch (e) {
      console.error('Failed to create ticket', e);
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

  const handleEnterDashboard = () => {
    setShowHero(false);
    sessionStorage.setItem('hero_dismissed', 'true');
  };

  if (showHero) {
    return <HeroCover stats={stats} onEnter={handleEnterDashboard} />;
  }

  return (
    <div className="min-h-screen bg-[#07090E] text-[#E6EDF3] flex flex-col font-sans">
      {/* Top Situational Center Header */}
      <header className="bg-[#0D1117] border-b border-white/10 sticky top-0 z-50 px-4 py-2.5">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Subsystem */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center">
                <Activity className="w-4 h-4 text-[#00FF66]" />
              </div>
              <div>
                <div className="font-mono text-xs tracking-wider uppercase font-bold text-white flex items-center gap-2">
                  <span>Москоллектор • НейроКонтур</span>
                  <span className="eng-badge badge-normal text-[10px]">ОДС #1</span>
                </div>
                <div className="text-[10px] text-[#8B949E]">
                  Предиктивный мониторинг 825 км подземных коллекторов
                </div>
              </div>
            </div>

            {/* Quick Mobile Hero Switch */}
            <button
              onClick={() => setShowHero(true)}
              className="md:hidden p-1.5 text-[#8B949E] hover:text-white rounded border border-white/10"
              title="О системе"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1.5 text-xs font-mono rounded flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'map'
                  ? 'bg-white/10 text-white font-semibold border border-white/20'
                  : 'text-[#8B949E] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Map className="w-3.5 h-3.5 text-[#00FF66]" />
              <span>Карта сети</span>
            </button>

            <button
              onClick={() => setActiveTab('risks')}
              className={`px-3 py-1.5 text-xs font-mono rounded flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'risks'
                  ? 'bg-white/10 text-white font-semibold border border-white/20'
                  : 'text-[#8B949E] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#FF3B30]" />
              <span>Риски и предикция</span>
              {stats?.critical_sensors_count ? (
                <span className="ml-1 px-1.5 py-0.2 bg-[#FF3B30]/20 text-[#FF3B30] rounded-full text-[10px]">
                  {stats.critical_sensors_count}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setActiveTab('alarms')}
              className={`px-3 py-1.5 text-xs font-mono rounded flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'alarms'
                  ? 'bg-white/10 text-white font-semibold border border-white/20'
                  : 'text-[#8B949E] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-[#58A6FF]" />
              <span>Фильтр тревог</span>
            </button>

            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-3 py-1.5 text-xs font-mono rounded flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'tickets'
                  ? 'bg-white/10 text-white font-semibold border border-white/20'
                  : 'text-[#8B949E] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-[#FFB800]" />
              <span>Наряды ТО/ППР</span>
              {stats?.tickets_count ? (
                <span className="ml-1 px-1.5 py-0.2 bg-[#FFB800]/20 text-[#FFB800] rounded-full text-[10px]">
                  {stats.tickets_count}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 text-xs font-mono rounded flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'simulator'
                  ? 'bg-white/10 text-white font-semibold border border-white/20'
                  : 'text-[#8B949E] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Play className="w-3.5 h-3.5 text-[#00FF66]" />
              <span>Live-Симулятор</span>
            </button>

            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-3 py-1.5 text-xs font-mono rounded flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'metrics'
                  ? 'bg-white/10 text-white font-semibold border border-white/20'
                  : 'text-[#8B949E] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#58A6FF]" />
              <span>ML-Метрики</span>
            </button>
          </nav>

          {/* Right Status Block */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-[#8B949E]">
              <Clock className="w-3.5 h-3.5 text-[#00FF66]" />
              <span>{currentTime} МСК</span>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="px-2.5 py-1 text-xs text-[#00FF66] hover:bg-[#00FF66]/10 rounded border border-[#00FF66]/30 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Настройки порогов и безопасности"
            >
              <Sliders className="w-3 h-3" />
              <span>Параметры и пороги</span>
            </button>

            <button
              onClick={() => setShowHero(true)}
              className="px-2.5 py-1 text-xs text-[#8B949E] hover:text-white rounded border border-white/10 hover:border-white/20 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Info className="w-3 h-3" />
              <span>О системе</span>
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
          <RiskDashboard 
            predictions={predictions} 
            onCreateTicket={handleCreateTicket} 
            createdTicketIds={createdTicketIds} 
          />
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

      {/* Bottom Ticker / Playbook Engineering Status Strip */}
      <footer className="bg-[#0D1117] border-t border-white/10 px-4 py-2 text-[11px] font-mono text-[#8B949E]">
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-[#00FF66]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse"></span>
              ML СМВУ: АКТИВЕН (3-Way Split)
            </span>
            <span>•</span>
            <span>Инференс сети: <strong className="text-[#00FF66]">{stats?.inference_latency_ms || 57.45} мс</strong></span>
            <span>•</span>
            <span>Прямая подтвержденная экономия: <strong className="text-white">{(stats?.total_saved_opex_rub || 0).toLocaleString('ru-RU')} ₽</strong></span>
            <span>•</span>
            <span>Прогноз OPEX / год: <strong className="text-[#FFB800]">{((stats?.annual_projected_opex_rub || 57102000) / 1000000).toFixed(1)} млн ₽</strong></span>
          </div>

          <div className="text-[10px] text-[#8B949E]">
            ЛЦТ 2026 • Кейс 8 (АО «Москоллектор») • 152-ФЗ / 149-ФЗ • ГОСТ Р 53195
          </div>
        </div>
      </footer>

    </div>
  );
};

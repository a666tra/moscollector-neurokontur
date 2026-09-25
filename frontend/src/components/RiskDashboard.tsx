import React, { useState } from 'react';
import { PredictionItem, RealtimeScoreResult } from '../types';
import { 
  AlertCircle, CheckCircle2, AlertTriangle, Wrench, Search, Zap, 
  HelpCircle, Play, ChevronDown, ChevronUp, Cpu, Activity, Clock
} from 'lucide-react';

interface RiskDashboardProps {
  predictions: PredictionItem[];
  onCreateTicket: (channelId: string) => void;
  createdTicketIds: Set<string>;
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({
  predictions,
  onCreateTicket,
  createdTicketIds
}) => {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [systemFilter, setSystemFilter] = useState('ALL');
  
  // Real-time inference sandbox state
  const [showSandbox, setShowSandbox] = useState(false);
  const [testChannelId, setTestChannelId] = useState('120578');
  const [testSilence, setTestSilence] = useState(12.0);
  const [testChatter, setTestChatter] = useState(5);
  const [testBattery, setTestBattery] = useState(1);
  const [testGasSpikes, setTestGasSpikes] = useState(0);
  const [sandboxModel, setSandboxModel] = useState('champion_lightgbm');
  const [scoringLoading, setScoringLoading] = useState(false);
  const [liveResult, setLiveResult] = useState<RealtimeScoreResult | null>(null);

  const handleLiveScore = async () => {
    setScoringLoading(true);
    try {
      const res = await fetch('/api/predictions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: testChannelId,
          cnt_24h: 15,
          cnt_7d: 85,
          chatter_cnt: testChatter,
          silence_hours: testSilence,
          battery_glitches: testBattery,
          gas_spikes: testGasSpikes,
          last_value: testGasSpikes > 0 ? "1.85" : "Норма",
          model_name: sandboxModel
        })
      });
      if (res.ok) {
        const data = await res.json();
        setLiveResult(data);
      }
    } catch (e) {
      console.error('Realtime score error', e);
    } finally {
      setScoringLoading(false);
    }
  };

  const selectChannelForSandbox = (p: PredictionItem) => {
    setTestChannelId(p.channel_id);
    setShowSandbox(true);
    // pre-fill based on factors
    const hasSilence = p.explanation_factors.some(f => f.includes('Молчание'));
    const hasChatter = p.explanation_factors.some(f => f.includes('Дребезг'));
    const hasBattery = p.explanation_factors.some(f => f.includes('питания'));
    const hasGas = p.explanation_factors.some(f => f.includes('метана'));
    setTestSilence(hasSilence ? 36.0 : 1.5);
    setTestChatter(hasChatter ? 7 : 0);
    setTestBattery(hasBattery ? 2 : 0);
    setTestGasSpikes(hasGas ? 2 : 0);
  };

  const filtered = predictions.filter(p => {
    if (riskFilter !== 'ALL' && p.risk_level !== riskFilter) return false;
    if (systemFilter !== 'ALL' && !p.system_type.toLowerCase().includes(systemFilter.toLowerCase())) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.channel_id.includes(q) ||
        p.sensor_name.toLowerCase().includes(q) ||
        p.object_name.toLowerCase().includes(q) ||
        p.sensor_type.toLowerCase().includes(q) ||
        p.tag.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Banner & Sandbox Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#0D1117] p-3.5 rounded border border-white/10">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide font-mono flex items-center gap-2">
            <span>Реестр предиктивного скоринга датчиков СМВУ</span>
            <span className="eng-badge badge-normal text-[10px]">Горизонт 24–72ч</span>
          </h2>
          <p className="text-[11px] text-[#8B949E] mt-0.5 font-mono">
            Автоматический расчет вероятности отказа оборудования и формирование предписаний ТО/ППР
          </p>
        </div>

        <button
          onClick={() => setShowSandbox(!showSandbox)}
          className="px-3 py-1.5 bg-[#58A6FF]/10 hover:bg-[#58A6FF]/20 border border-[#58A6FF]/30 text-[#58A6FF] rounded text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>{showSandbox ? 'Скрыть Live-Инференс' : '⚡ Открыть Live-Инференс датчика'}</span>
          {showSandbox ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Live Inference Sandbox Panel */}
      {showSandbox && (
        <div className="bg-[#12161F] p-4 rounded border border-[#58A6FF]/40 space-y-4 animate-fade-in font-mono text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <div className="flex items-center gap-2 text-white font-bold">
              <Zap className="w-4 h-4 text-[#00FF66]" />
              <span>Динамический расчет вероятности отказа (On-Demand LightGBM Inference)</span>
            </div>
            <span className="text-[10px] text-[#8B949E]">
              Прямой вызов C-ядра модели без кэша
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[11px] text-[#8B949E] block mb-1">ID канала датчика:</label>
              <input
                type="text"
                value={testChannelId}
                onChange={e => setTestChannelId(e.target.value)}
                className="w-full bg-[#07090E] border border-white/10 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#8B949E] block mb-1">Модель инференса:</label>
              <select
                value={sandboxModel}
                onChange={e => setSandboxModel(e.target.value)}
                className="w-full bg-[#07090E] border border-[#00FF66]/30 text-[#00FF66] rounded px-2 py-1.5 text-xs font-mono"
              >
                <option value="champion_lightgbm">LightGBM (Champion)</option>
                <option value="logistic_regression">LogReg (High-Recall)</option>
                <option value="random_forest">RandomForest (Precision)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-[#8B949E] block mb-1">Молчание (часов):</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="168"
                value={testSilence}
                onChange={e => setTestSilence(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#07090E] border border-white/10 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#8B949E] block mb-1">Дребезг (микро-флипы):</label>
              <input
                type="number"
                min="0"
                max="50"
                value={testChatter}
                onChange={e => setTestChatter(parseInt(e.target.value) || 0)}
                className="w-full bg-[#07090E] border border-white/10 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#8B949E] block mb-1">Сбои питания (АКБ):</label>
              <input
                type="number"
                min="0"
                max="10"
                value={testBattery}
                onChange={e => setTestBattery(parseInt(e.target.value) || 0)}
                className="w-full bg-[#07090E] border border-white/10 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#8B949E] block mb-1">Всплески метана:</label>
              <input
                type="number"
                min="0"
                max="10"
                value={testGasSpikes}
                onChange={e => setTestGasSpikes(parseInt(e.target.value) || 0)}
                className="w-full bg-[#07090E] border border-white/10 rounded px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
            <button
              onClick={handleLiveScore}
              disabled={scoringLoading}
              className="px-4 py-2 bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-semibold rounded flex items-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(0,255,102,0.2)]"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>{scoringLoading ? 'Инференс...' : 'Запустить live-инференс'}</span>
            </button>

            {liveResult && (
              <div className="flex items-center gap-4 bg-[#07090E] p-2.5 rounded border border-white/10 text-xs">
                <div>
                  <span className="text-[#8B949E]">Вероятность отказа: </span>
                  <span className="text-[#00FF66] font-bold">{(liveResult.failure_probability * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-[#8B949E]">Уровень: </span>
                  <span className={`eng-badge text-[10px] ${
                    liveResult.risk_level === 'CRITICAL' ? 'badge-critical' :
                    liveResult.risk_level === 'WARNING' ? 'badge-warning' : 'badge-normal'
                  }`}>
                    {liveResult.risk_level}
                  </span>
                </div>
                <div>
                  <span className="text-[#8B949E]">Время инференса: </span>
                  <span className="text-white font-semibold">{liveResult.inference_latency_ms} мс</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls Bar: Search and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#0D1117] p-3 rounded border border-white/10 font-mono">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8B949E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по ID, пикету, объекту, тегу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161B22] text-white border border-white/10 rounded pl-9 pr-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00FF66]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-[#161B22] text-white border border-white/10 rounded px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-[#00FF66]"
          >
            <option value="ALL">Все уровни риска ({predictions.length})</option>
            <option value="CRITICAL">🔴 Критические (&ge;70%)</option>
            <option value="WARNING">🟡 Предупреждение (Порог tau)</option>
            <option value="ATTENTION">🔵 Внимание (&ge;25%)</option>
            <option value="NORMAL">🟢 Штатные</option>
          </select>

          <select
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
            className="bg-[#161B22] text-white border border-white/10 rounded px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-[#00FF66]"
          >
            <option value="ALL">Все подсистемы</option>
            <option value="Пожар">Пожарная охрана</option>
            <option value="ОПС">ОПС</option>
            <option value="Газ">Газоанализаторы</option>
            <option value="Люк">Люки и Двери</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="eng-panel overflow-hidden">
        <div className="overflow-x-auto max-h-[580px]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#12161F] text-[#8B949E] border-b border-white/10 sticky top-0 z-10">
              <tr>
                <th className="p-3">Канал / Тег</th>
                <th className="p-3">Объект и Пикет</th>
                <th className="p-3">Тип оборудования</th>
                <th className="p-3">Вероятность отказа</th>
                <th className="p-3">Факторы риска (Explainability)</th>
                <th className="p-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.slice(0, 100).map((p) => {
                const isTicketCreated = createdTicketIds.has(p.channel_id);
                return (
                  <tr key={p.channel_id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-semibold text-white">
                      <div>#{p.channel_id}</div>
                      <div className="text-[10px] text-[#8B949E] font-normal">{p.tag || p.sensor_name}</div>
                    </td>

                    <td className="p-3">
                      <div className="text-white font-medium">{p.object_name}</div>
                      <div className="text-[10px] text-[#00FF66]">{p.tag.includes('ПК') ? p.tag.split(' ').pop() : 'ПК28'}</div>
                    </td>

                    <td className="p-3">
                      <span className="eng-badge bg-white/5 text-[#8B949E] border border-white/10">
                        {p.sensor_type}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`eng-badge ${
                          p.risk_level === 'CRITICAL' ? 'badge-critical' :
                          p.risk_level === 'WARNING' ? 'badge-warning' :
                          p.risk_level === 'ATTENTION' ? 'badge-cyan' : 'badge-normal'
                        }`}>
                          {(p.failure_probability * 100).toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-[#8B949E]">
                          {p.risk_level === 'CRITICAL' ? 'Критично' :
                           p.risk_level === 'WARNING' ? 'ППР' : 'Норма'}
                        </span>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {p.explanation_factors.map((f, i) => (
                          <span key={i} className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-[#8B949E]">
                            {f}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => selectChannelForSandbox(p)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-[11px] cursor-pointer"
                          title="Тестировать в Live Sandbox"
                        >
                          Live
                        </button>

                        <button
                          onClick={() => onCreateTicket(p.channel_id)}
                          disabled={isTicketCreated}
                          className={`px-3 py-1 text-[11px] rounded flex items-center gap-1 cursor-pointer transition-colors ${
                            isTicketCreated
                              ? 'bg-white/5 text-[#8B949E] cursor-not-allowed'
                              : 'bg-[#FFB800] hover:bg-[#FFB800]/90 text-black font-semibold shadow-[0_0_10px_rgba(255,184,0,0.2)]'
                          }`}
                        >
                          <Wrench className="w-3 h-3" />
                          <span>{isTicketCreated ? 'Наряд создан' : 'Наряд ТО'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { PredictionItem, RealtimeScoreResult } from '../types';
import { 
  Wrench, Search, Zap, 
  Play, ChevronDown, ChevronUp, Cpu
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
  const [liveError, setLiveError] = useState<string | null>(null);

  const handleLiveScore = async () => {
    setScoringLoading(true);
    setLiveError(null);
    setLiveResult(null);
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
      if (!res.ok) throw new Error(`Сервис вернул HTTP ${res.status}`);
      const data = await res.json();
      setLiveResult(data);
    } catch (e) {
      console.error('Realtime score error', e);
      setLiveError(e instanceof Error ? e.message : 'Не удалось выполнить скоринг');
    } finally {
      setScoringLoading(false);
    }
  };

  const selectChannelForSandbox = (p: PredictionItem) => {
    setTestChannelId(p.channel_id);
    setShowSandbox(true);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 eng-panel p-4">
        <div>
          <h2 className="text-base font-semibold text-[#E7EAF0] flex items-center gap-2">
            <span>Реестр предиктивного ранжирования каналов СМВУ</span>
            <span className="eng-badge badge-normal text-xs">Горизонт 24–72 ч</span>
          </h2>
          <p className="text-xs text-[#9AA3B2] mt-0.5">
            Ранжирование каналов по риску инцидента на основе признаков деградации телеметрии; решение по наряду принимает диспетчер
          </p>
        </div>

        <button
          onClick={() => setShowSandbox(!showSandbox)}
          className="px-3.5 py-1.5 bg-[#7C4DFF]/10 hover:bg-[#7C4DFF]/20 border border-[#7C4DFF]/30 text-[#E7EAF0] rounded-lg text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors shrink-0"
        >
          <Cpu className="w-3.5 h-3.5 text-[#7C4DFF]" />
          <span>{showSandbox ? 'Скрыть Live-инференс' : 'Открыть Live-инференс канала'}</span>
          {showSandbox ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Live Inference Sandbox Panel */}
      {showSandbox && (
        <div className="bg-[#121620] p-4 sm:p-5 rounded-xl border border-[#7C4DFF]/30 space-y-4 text-xs">
          <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2 text-[#E7EAF0] font-semibold text-sm">
              <Zap className="w-4 h-4 text-[#7C4DFF]" />
              <span>Прямой инференс модели по заданным параметрам канала</span>
            </div>
            <span className="text-xs text-[#9AA3B2]">
              Вызов C-ядра модели без обращения к кэшу
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-[#9AA3B2] block mb-1">ID канала датчика:</label>
              <input
                type="text"
                value={testChannelId}
                onChange={e => setTestChannelId(e.target.value)}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] font-mono focus:border-[#7C4DFF] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[#9AA3B2] block mb-1">Модель инференса:</label>
              <select
                value={sandboxModel}
                onChange={e => setSandboxModel(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#7C4DFF]/40 text-[#E7EAF0] rounded-lg px-2 py-1.5 text-xs focus:border-[#7C4DFF] focus:outline-none"
              >
                <option value="champion_lightgbm">LightGBM (Champion)</option>
                <option value="logistic_regression">LogReg (High-Recall)</option>
                <option value="random_forest">RandomForest (Precision)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-[#9AA3B2] block mb-1">Молчание (часов):</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="168"
                value={testSilence}
                onChange={e => setTestSilence(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] font-mono focus:border-[#7C4DFF] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[#9AA3B2] block mb-1">Дребезг (микро-флипы):</label>
              <input
                type="number"
                min="0"
                max="50"
                value={testChatter}
                onChange={e => setTestChatter(parseInt(e.target.value) || 0)}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] font-mono focus:border-[#7C4DFF] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[#9AA3B2] block mb-1">Сбои питания (АКБ):</label>
              <input
                type="number"
                min="0"
                max="10"
                value={testBattery}
                onChange={e => setTestBattery(parseInt(e.target.value) || 0)}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] font-mono focus:border-[#7C4DFF] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[#9AA3B2] block mb-1">Всплески метана:</label>
              <input
                type="number"
                min="0"
                max="10"
                value={testGasSpikes}
                onChange={e => setTestGasSpikes(parseInt(e.target.value) || 0)}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] font-mono focus:border-[#7C4DFF] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
            <button
              onClick={handleLiveScore}
              disabled={scoringLoading}
              className="px-4 py-2 bg-[#7C4DFF] hover:bg-[#9170FF] text-white font-medium rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{scoringLoading ? 'Инференс...' : 'Запустить Live-инференс'}</span>
            </button>

            {liveResult && (
              <div className="flex flex-wrap items-center gap-4 bg-[#0B0E14] p-3 rounded-lg border border-white/10 text-xs">
                <div>
                  <span className="text-[#9AA3B2]">Балл риска: </span>
                  <span className="text-[#7C4DFF] font-bold font-mono">
                    {(liveResult.raw_model_score ?? liveResult.failure_probability).toFixed(3)}
                  </span>
                </div>
                <div>
                  <span className="text-[#9AA3B2]">Калиброванная вер-ть: </span>
                  <span className="text-[#4C9BFF] font-bold font-mono">
                    {liveResult.calibrated_proxy_probability !== null && liveResult.calibrated_proxy_probability !== undefined
                      ? `${(liveResult.calibrated_proxy_probability * 100).toFixed(2)}%`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[#9AA3B2]">Уровень: </span>
                  <span className={`eng-badge ${
                    liveResult.risk_level === 'CRITICAL' ? 'badge-critical' :
                    liveResult.risk_level === 'WARNING' ? 'badge-warning' : 'badge-normal'
                  }`}>
                    {liveResult.risk_level === 'CRITICAL' ? 'Критический' :
                     liveResult.risk_level === 'WARNING' ? 'Предупреждение' : 'Штатный'}
                  </span>
                </div>
                <div>
                  <span className="text-[#9AA3B2]">Время инференса: </span>
                  <span className="text-[#E7EAF0] font-mono font-semibold">{liveResult.inference_latency_ms} мс</span>
                </div>
              </div>
            )}
            {liveError && <p role="alert" className="text-xs text-[#F0453A]">{liveError}</p>}
          </div>
        </div>
      )}

      {/* Controls Bar: Search and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 eng-panel p-3.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#9AA3B2] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по ID, пикету, объекту, тегу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0B0E14] text-[#E7EAF0] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#7C4DFF]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-[#0B0E14] text-[#E7EAF0] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#7C4DFF]"
          >
            <option value="ALL">Все уровни риска ({predictions.length})</option>
            <option value="CRITICAL">🔴 Критический риск (балл &ge; 0.70)</option>
            <option value="WARNING">🟡 Предупреждение (балл &ge; tau)</option>
            <option value="ATTENTION">🔵 Внимание (балл &ge; 0.20)</option>
            <option value="NORMAL">🟢 Штатный мониторинг</option>
          </select>

          <select
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
            className="bg-[#0B0E14] text-[#E7EAF0] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#7C4DFF]"
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
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181D29] text-[#9AA3B2] border-b border-white/10 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 font-medium">Канал / Тег</th>
                <th className="py-3 px-4 font-medium">Объект и Пикет</th>
                <th className="py-3 px-4 font-medium">Тип оборудования</th>
                <th className="py-3 px-4 font-medium text-right">Балл риска [0, 1]</th>
                <th className="py-3 px-4 font-medium text-right">Калибр. вероятность</th>
                <th className="py-3 px-4 font-medium">Факторы риска</th>
                <th className="py-3 px-4 font-medium text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#121620]">
              {filtered.slice(0, 100).map((p) => {
                const isTicketCreated = createdTicketIds.has(p.channel_id);
                return (
                  <tr key={p.channel_id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-[#E7EAF0]">#{p.channel_id}</div>
                      <div className="text-[11px] text-[#9AA3B2]">{p.tag || p.sensor_name}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-[#E7EAF0] font-medium">{p.object_name}</div>
                      <div className="text-[11px] text-[#4C9BFF] font-mono">{p.tag.includes('ПК') ? p.tag.split(' ').pop() : 'Пикет не указан'}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="eng-badge bg-white/5 text-[#9AA3B2] border border-white/10">
                        {p.sensor_type}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`eng-badge ${
                          p.risk_level === 'CRITICAL' ? 'badge-critical' :
                          p.risk_level === 'WARNING' ? 'badge-warning' :
                          p.risk_level === 'ATTENTION' ? 'badge-cyan' : 'badge-normal'
                        }`}>
                          <span className="font-mono">{(p.raw_model_score ?? p.failure_probability).toFixed(3)}</span>
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[#E7EAF0] font-mono font-medium">
                          {p.calibrated_proxy_probability !== null && p.calibrated_proxy_probability !== undefined
                            ? `${(p.calibrated_proxy_probability * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                        <span className="text-[10px] text-[#6B7385]">
                          {p.is_calibrated && p.calibrated_proxy_probability != null ? 'Beta 24–72ч' : 'Калибровка'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {p.explanation_factors.map((f, i) => (
                          <span key={i} className="text-[11px] bg-white/5 px-2 py-0.5 rounded-md text-[#9AA3B2]">
                            {f}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => selectChannelForSandbox(p)}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[#9AA3B2] hover:text-[#E7EAF0] rounded-md text-xs transition-colors cursor-pointer"
                          title="Тестировать в Live Sandbox"
                        >
                          Live
                        </button>

                        <button
                          onClick={() => onCreateTicket(p.channel_id)}
                          disabled={isTicketCreated}
                          className={`px-3 py-1 text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isTicketCreated
                              ? 'bg-white/5 text-[#6B7385] cursor-not-allowed'
                              : 'bg-[#7C4DFF] hover:bg-[#9170FF] text-white font-medium'
                          }`}
                        >
                          <Wrench className="w-3 h-3" />
                          <span>{isTicketCreated ? 'Заявка создана' : 'Наряд ТО'}</span>
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

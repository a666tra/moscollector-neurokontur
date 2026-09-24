import React, { useState, useEffect } from 'react';
import { AlarmClassificationResponse, ConfirmedAlarmItem } from '../types';
import { 
  ShieldAlert, CheckCircle, AlertTriangle, Cpu, DollarSign, Activity, 
  UserCheck, Shield, Send, CheckCircle2, History 
} from 'lucide-react';

export const FalseAlarmFilter: React.FC = () => {
  const [channelId, setChannelId] = useState('120578');
  const [val, setVal] = useState('Замкнут');
  const [flips, setFlips] = useState(4);
  const [duration, setDuration] = useState(1.5);
  const [dispatcherBadge, setDispatcherBadge] = useState('7041-ОДС');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  const [confirmedHistory, setConfirmedHistory] = useState<ConfirmedAlarmItem[]>([]);

  const [result, setResult] = useState<AlarmClassificationResponse | null>({
    channel_id: '120578',
    verdict: 'FALSE_ALARM',
    is_false_alarm: true,
    confidence: 0.94,
    diagnosis: 'Характерный спектр механического дребезга геркона двери (4 переключения за 90с). Внешняя вибрация от линии метро.',
    recommended_action: 'Рекомендация ИИ: Подавление ложной тревоги. ТРЕБУЕТСЯ ПОДТВЕРЖДЕНИЕ ДИСПЕТЧЕРА ОДС перед отменой выезда бригады.',
    avoided_callout_cost_rub: 18500
  });

  const fetchConfirmedHistory = async () => {
    try {
      const res = await fetch('/api/alarms/confirmed');
      if (res.ok) {
        const data = await res.json();
        setConfirmedHistory(data);
      }
    } catch (e) {
      console.error('Failed to load confirmed history', e);
    }
  };

  useEffect(() => {
    fetchConfirmedHistory();
  }, []);

  const handleClassify = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alarms/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          current_value: val,
          recent_events_count_1h: flips + 2,
          recent_flips_count_1h: flips,
          duration_minutes: duration
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('Classification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDecision = async (decision: 'CONFIRM_FALSE_ALARM' | 'FORCE_DISPATCH') => {
    if (!result) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/alarms/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: result.channel_id,
          decision: decision,
          dispatcher_badge: dispatcherBadge,
          notes: decision === 'CONFIRM_FALSE_ALARM' 
            ? 'Подтверждено диспетчером: спектральный дребезг геркона' 
            : 'Диспетчер принял решение о принудительной отправке бригады'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setConfirmationNotice(data.message);
        setTimeout(() => setConfirmationNotice(null), 4000);
        fetchConfirmedHistory();
      }
    } catch (e) {
      console.error('Confirmation error', e);
    } finally {
      setConfirming(false);
    }
  };

  const loadPreset = (presetType: string) => {
    if (presetType === 'DOOR_CHATTER') {
      setChannelId('120578');
      setVal('Замкнут');
      setFlips(5);
      setDuration(1.2);
    } else if (presetType === 'GAS_SPIKE') {
      setChannelId('120466');
      setVal('2.45');
      setFlips(0);
      setDuration(12.0);
    } else if (presetType === 'SENSOR_DEAD') {
      setChannelId('120298');
      setVal('Неисправен');
      setFlips(1);
      setDuration(45.0);
    }
  };

  const cumulativeConfirmedSaved = confirmedHistory.reduce((acc, h) => acc + (h.avoided_cost_rub || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {confirmationNotice && (
        <div className="p-3 bg-[#00FF66]/15 border border-[#00FF66]/30 text-[#00FF66] font-mono text-xs rounded flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {confirmationNotice}
          </span>
          <button onClick={() => setConfirmationNotice(null)} className="text-white hover:text-[#00FF66]">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-wide">
              Интеллектуальная фильтрация ложных тревог (СМВУ)
            </h2>
            <span className="eng-badge badge-normal font-mono">
              Дребезг контактов
            </span>
          </div>
          <p className="text-xs text-[#8B949E] mt-1 font-mono">
            Двухфакторная классификация: математический отсев помех + протокол подтверждения диспетчером (ГОСТ Р 53195)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPreset('DOOR_CHATTER')}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs font-mono text-white transition-colors cursor-pointer"
          >
            Пресет: Дребезг двери
          </button>
          <button
            onClick={() => loadPreset('GAS_SPIKE')}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs font-mono text-white transition-colors cursor-pointer"
          >
            Пресет: Выброс метана
          </button>
          <button
            onClick={() => loadPreset('SENSOR_DEAD')}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs font-mono text-white transition-colors cursor-pointer"
          >
            Пресет: Деградация сенсора
          </button>
        </div>
      </div>

      {/* Safety Compliance Alert */}
      <div className="bg-[#FFB800]/5 border border-[#FFB800]/20 p-3 rounded text-xs font-mono flex items-center justify-between text-[#8B949E]">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#FFB800]" />
          <span>
            <strong className="text-white">Регламент ОДС и 149-ФЗ:</strong> Система блокирует ложный выезд ТОЛЬКО после личного подтверждения дежурного диспетчера. Автоматическая отмена без человека исключена.
          </span>
        </div>
        <div className="text-[#00FF66] font-semibold whitespace-nowrap">
          Подтверждено экономии: {cumulativeConfirmedSaved.toLocaleString('ru-RU')} ₽
        </div>
      </div>

      {/* Interactive Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Parameters */}
        <div className="eng-panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#58A6FF]" />
              Входные параметры сигнала
            </h3>
            <span className="text-[11px] text-[#8B949E] font-mono">СМВУ Контур</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-[#8B949E] mb-1">ID канала телеметрии:</label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full bg-[#161B22] text-white border border-white/10 rounded px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8B949E] mb-1">Значение датчика (телеметрия):</label>
              <input
                type="text"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="w-full bg-[#161B22] text-white border border-white/10 rounded px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-[#8B949E] mb-1">Микропереключений (окно):</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={flips}
                  onChange={(e) => setFlips(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#161B22] text-white border border-white/10 rounded px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-[#00FF66]"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-[#8B949E] mb-1">Длительность сработки (мин):</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="120"
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-[#161B22] text-white border border-white/10 rounded px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-[#00FF66]"
                />
              </div>
            </div>

            <button
              onClick={handleClassify}
              disabled={loading}
              className="w-full py-2.5 bg-[#58A6FF] hover:bg-[#58A6FF]/90 text-black font-semibold text-xs rounded font-mono transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Activity className="w-4 h-4" />
              <span>{loading ? 'Классификация...' : 'Анализировать сигнал ИИ-моделью'}</span>
            </button>
          </div>
        </div>

        {/* Right: Diagnosis & Human-in-the-Loop Decision Output */}
        <div className="eng-panel p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#00FF66]" />
                Вердикт и решение диспетчера ОДС
              </h3>
              <span className={`eng-badge ${
                result?.verdict === 'FALSE_ALARM' ? 'badge-normal' :
                result?.verdict === 'REAL_RISK' ? 'badge-critical' : 'badge-warning'
              }`}>
                {result?.verdict === 'FALSE_ALARM' ? 'ЛОЖНАЯ ТРЕВОГА' :
                 result?.verdict === 'REAL_RISK' ? 'РЕАЛЬНЫЙ РИСК' : 'ДЕГРАДАЦИЯ ОБОРУДОВАНИЯ'}
              </span>
            </div>

            {result && (
              <div className="space-y-4">
                <div className="p-3 bg-black/40 rounded border border-white/10">
                  <div className="text-[11px] text-[#8B949E] font-mono uppercase mb-1">Диагноз системы:</div>
                  <div className="text-sm text-white leading-relaxed">
                    {result.diagnosis}
                  </div>
                </div>

                <div className="p-3 bg-black/40 rounded border border-white/10">
                  <div className="text-[11px] text-[#8B949E] font-mono uppercase mb-1">Рекомендованное действие:</div>
                  <div className={`text-xs font-mono font-medium ${
                    result.is_false_alarm ? 'text-[#00FF66]' : 'text-[#FF3B30]'
                  }`}>
                    {result.recommended_action}
                  </div>
                </div>

                {/* Human in the loop action block */}
                <div className="bg-[#12161F] p-3.5 rounded border border-[#00FF66]/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white font-mono flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-[#00FF66]" />
                      Решение диспетчера ОДС:
                    </span>
                    <input 
                      type="text" 
                      value={dispatcherBadge}
                      onChange={e => setDispatcherBadge(e.target.value)}
                      placeholder="Шифр диспетчера"
                      className="w-28 bg-[#07090E] border border-white/10 rounded px-2 py-0.5 text-[11px] text-white font-mono text-center"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleConfirmDecision('CONFIRM_FALSE_ALARM')}
                      disabled={confirming}
                      className="py-2 bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-semibold text-xs rounded font-mono cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(0,255,102,0.2)]"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Подтвердить ложную тревогу (+18 500 ₽)</span>
                    </button>

                    <button
                      onClick={() => handleConfirmDecision('FORCE_DISPATCH')}
                      disabled={confirming}
                      className="py-2 bg-[#FF3B30]/20 hover:bg-[#FF3B30]/30 border border-[#FF3B30]/40 text-[#FF3B30] font-semibold text-xs rounded font-mono cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Принудительно направить бригаду</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#161B22] p-3 rounded border border-white/5">
                    <div className="text-[11px] text-[#8B949E] font-mono">Уверенность ИИ:</div>
                    <div className="text-xl font-bold font-mono text-white mt-1">
                      {(result.confidence * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div className="bg-[#161B22] p-3 rounded border border-white/5">
                    <div className="text-[11px] text-[#8B949E] font-mono">Потенциальная экономия:</div>
                    <div className="text-xl font-bold font-mono text-[#00FF66] mt-1 flex items-center">
                      +{result.avoided_callout_cost_rub.toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="text-[11px] text-[#8B949E] font-mono pt-3 border-t border-white/10 flex justify-between">
            <span>• Протокол соответствия: Р ТЭК п. 2.7 (Регистрация переходных сигналов СМВУ)</span>
            <span>Решений за сессию: {confirmedHistory.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { AlarmClassificationResponse, ConfirmedAlarmItem, AuthorizedDispatcher, AuditVerificationResult } from '../types';
import { 
  CheckCircle, AlertTriangle, Cpu, Activity, 
  UserCheck, Shield, CheckCircle2, Lock, FileCheck 
} from 'lucide-react';
import { DemoAccessHint } from './DemoAccessHint';

export const FalseAlarmFilter: React.FC = () => {
  const [channelId, setChannelId] = useState('120578');
  const [val, setVal] = useState('Замкнут');
  const [flips, setFlips] = useState(4);
  const [duration, setDuration] = useState(1.5);
  const [dispatcherBadge, setDispatcherBadge] = useState('ДИСП-7041');
  const [dispatcherPin, setDispatcherPin] = useState('');
  const [dispatchers, setDispatchers] = useState<AuthorizedDispatcher[]>([]);
  const [auditStatus, setAuditStatus] = useState<AuditVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  const [confirmedHistory, setConfirmedHistory] = useState<ConfirmedAlarmItem[]>([]);

  const handleDispatcherChange = (b: string) => {
    setDispatcherBadge(b);
    setDispatcherPin('');
    setConfirmationNotice(null);
  };

  const [result, setResult] = useState<AlarmClassificationResponse | null>({
    channel_id: '120578',
    verdict: 'FALSE_ALARM',
    is_false_alarm: true,
    confidence: 0.94,
    diagnosis: 'Паттерн механического дребезга геркона: серия микропереключений за короткое время.',
    recommended_action: 'Рекомендуется отмена аварийного выезда. Назначить проверку концевого выключателя при плановом ТО.',
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

  const fetchDispatchers = async () => {
    try {
      const res = await fetch('/api/alarms/dispatchers');
      if (res.ok) {
        const data = await res.json();
        setDispatchers(data);
      }
    } catch (e) {
      console.error('Failed to load dispatchers', e);
    }
  };

  const verifyAuditLedger = async () => {
    try {
      const res = await fetch('/api/alarms/audit/verify');
      if (res.ok) {
        const data = await res.json();
        setAuditStatus(data);
      }
    } catch (e) {
      console.error('Failed to verify audit ledger', e);
    }
  };

  useEffect(() => {
    fetchConfirmedHistory();
    fetchDispatchers();
    verifyAuditLedger();
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
          dispatcher_pin: dispatcherPin,
          notes: decision === 'CONFIRM_FALSE_ALARM' 
            ? 'Подтверждено диспетчером: механический дребезг'
            : 'Решение диспетчера: аварийный выезд необходим'
        })
      });
      if (res.ok) {
        setConfirmationNotice('Решение успешно зафиксировано в журнале аудита.');
        setTimeout(() => setConfirmationNotice(null), 4000);
        fetchConfirmedHistory();
        verifyAuditLedger();
      } else {
        const err = await res.json();
        alert(err.detail || 'Ошибка авторизации диспетчера');
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
        <div className="p-3 bg-[#2FBF71]/15 border border-[#2FBF71]/30 text-[#2FBF71] text-xs rounded-lg flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {confirmationNotice}
          </span>
          <button onClick={() => setConfirmationNotice(null)} className="text-white hover:text-[#2FBF71] cursor-pointer">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#E7EAF0]">
              Фильтр ложных тревог и дребезга
            </h2>
            <span className="eng-badge badge-normal">
              Диспетчерский контроль
            </span>
          </div>
          <p className="text-xs text-[#9AA3B2] mt-1">
            Алгоритмическая фильтрация импульсных помех и механического дребезга с обязательной фиксацией решения дежурным персоналом
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadPreset('DOOR_CHATTER')}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-[#E7EAF0] transition-colors cursor-pointer"
          >
            Пресет: Дребезг двери
          </button>
          <button
            onClick={() => loadPreset('GAS_SPIKE')}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-[#E7EAF0] transition-colors cursor-pointer"
          >
            Пресет: Выброс метана
          </button>
          <button
            onClick={() => loadPreset('SENSOR_DEAD')}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-[#E7EAF0] transition-colors cursor-pointer"
          >
            Пресет: Деградация сенсора
          </button>
        </div>
      </div>

      {/* Status Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#181D29] border border-white/10 p-3.5 rounded-xl text-xs flex items-center justify-between text-[#9AA3B2]">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-[#F5A524]" />
            <span>
              <strong className="text-[#E7EAF0]">Принцип Human-in-the-Loop:</strong> автоматическая отмена выезда без подтверждения диспетчера заблокирована.
            </span>
          </div>
          <div className="text-[#2FBF71] font-mono font-semibold whitespace-nowrap pl-2">
            Экономия: {cumulativeConfirmedSaved.toLocaleString('ru-RU')} ₽
          </div>
        </div>

        <div className="bg-[#181D29] border border-white/10 p-3.5 rounded-xl text-xs flex items-center justify-between text-[#9AA3B2]">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#7C4DFF]" />
            <span>
              <strong className="text-[#E7EAF0]">Журнал решений ОДС:</strong> цепочка хешей SHA-256
            </span>
          </div>
          <div className="text-[#4C9BFF] font-mono text-[11px] truncate max-w-[200px]" title={auditStatus?.head_hash}>
            {auditStatus?.is_valid ? `Цепь валидна (${auditStatus.chain_length} блоков)` : 'Проверка цепи…'}
          </div>
        </div>
      </div>

      {/* Interactive Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Parameters */}
        <div className="eng-panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-semibold text-sm text-[#E7EAF0] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#4C9BFF]" />
              <span>Параметры входящего сигнала</span>
            </h3>
            <span className="text-xs text-[#9AA3B2]">СМВУ Контур</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#9AA3B2] mb-1">ID канала телеметрии:</label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full bg-[#0B0E14] text-[#E7EAF0] border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#7C4DFF]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#9AA3B2] mb-1">Значение датчика (телеметрия):</label>
              <input
                type="text"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="w-full bg-[#0B0E14] text-[#E7EAF0] border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#7C4DFF]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9AA3B2] mb-1">Микропереключений (окно):</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={flips}
                  onChange={(e) => setFlips(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0B0E14] text-[#E7EAF0] border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#7C4DFF]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9AA3B2] mb-1">Длительность сигнала (мин):</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="120"
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-[#0B0E14] text-[#E7EAF0] border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#7C4DFF]"
                />
              </div>
            </div>

            <button
              onClick={handleClassify}
              disabled={loading}
              className="w-full py-2.5 bg-[#7C4DFF] hover:bg-[#9170FF] text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Activity className="w-4 h-4" />
              <span>{loading ? 'Анализ…' : 'Анализировать сигнал'}</span>
            </button>
          </div>
        </div>

        {/* Right: Diagnosis & Human-in-the-Loop Decision Output */}
        <div className="eng-panel p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
              <h3 className="font-semibold text-sm text-[#E7EAF0] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#2FBF71]" />
                <span>Вердикт модели и решение диспетчера</span>
              </h3>
              <span className={`eng-badge ${
                result?.verdict === 'FALSE_ALARM' ? 'badge-normal' :
                result?.verdict === 'REAL_RISK' ? 'badge-critical' : 'badge-warning'
              }`}>
                {result?.verdict === 'FALSE_ALARM' ? 'КАНДИДАТ НА ШУМ' :
                 result?.verdict === 'REAL_RISK' ? 'РЕАЛЬНЫЙ РИСК' : 'ДЕГРАДАЦИЯ'}
              </span>
            </div>

            {result && (
              <div className="space-y-4">
                <div className="p-3 bg-[#0B0E14] rounded-lg border border-white/10">
                  <div className="text-[11px] text-[#9AA3B2] uppercase mb-1">Диагноз системы:</div>
                  <div className="text-xs sm:text-sm text-[#E7EAF0] leading-relaxed">
                    {result.diagnosis}
                  </div>
                </div>

                <div className="p-3 bg-[#0B0E14] rounded-lg border border-white/10">
                  <div className="text-[11px] text-[#9AA3B2] uppercase mb-1">Рекомендованное действие:</div>
                  <div className={`text-xs font-medium ${
                    result.is_false_alarm ? 'text-[#2FBF71]' : 'text-[#F0453A]'
                  }`}>
                    {result.recommended_action}
                  </div>
                </div>

                {/* Human in the loop action block */}
                <div className="bg-[#181D29] p-4 rounded-xl border border-white/10 space-y-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#E7EAF0] font-medium flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#7C4DFF]" />
                        <span>Уполномоченный диспетчер ОДС:</span>
                      </span>
                      <DemoAccessHint onFill={(b, p) => { setDispatcherBadge(b); setDispatcherPin(p); }} />
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        value={dispatcherBadge}
                        onChange={e => handleDispatcherChange(e.target.value)}
                        className="bg-[#0B0E14] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#E7EAF0] focus:border-[#7C4DFF] focus:outline-none flex-1"
                      >
                        {dispatchers.length > 0 ? (
                          dispatchers.map(d => (
                            <option key={d.badge} value={d.badge}>
                              {d.badge} - {d.full_name.split(' ')[0]} ({d.role})
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="ДИСП-7041">ДИСП-7041 - Кузнецов (Главный инженер)</option>
                            <option value="ДИСП-0482">ДИСП-0482 - Иванов (Старший диспетчер)</option>
                            <option value="ДИСП-3318">ДИСП-3318 - Смирнова (Ведущий диспетчер)</option>
                          </>
                        )}
                      </select>
                      <div className="flex items-center gap-1.5 bg-[#0B0E14] px-2.5 py-1.5 rounded-lg border border-white/10 shrink-0">
                        <Lock className="w-3.5 h-3.5 text-[#7C4DFF]" />
                        <span className="text-[11px] text-[#9AA3B2]">PIN:</span>
                        <input
                          type="password"
                          maxLength={6}
                          value={dispatcherPin}
                          onChange={e => setDispatcherPin(e.target.value)}
                          className="w-16 bg-transparent text-xs text-[#E7EAF0] font-mono text-center focus:outline-none border-b border-white/20 focus:border-[#7C4DFF]"
                          placeholder="••••••"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleConfirmDecision('CONFIRM_FALSE_ALARM')}
                      disabled={confirming}
                      className="py-2.5 bg-[#2FBF71] hover:bg-[#2FBF71]/90 text-white font-medium text-xs rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Подтвердить отмену выезда</span>
                    </button>

                    <button
                      onClick={() => handleConfirmDecision('FORCE_DISPATCH')}
                      disabled={confirming}
                      className="py-2.5 bg-transparent hover:bg-[#F0453A]/10 border border-[#F0453A]/40 text-[#F0453A] font-medium text-xs rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Направить выезд бригады</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#0B0E14] p-3 rounded-lg border border-white/5">
                    <div className="text-[11px] text-[#9AA3B2]">Уверенность модели:</div>
                    <div className="text-xl font-bold font-mono text-[#E7EAF0] mt-1">
                      {(result.confidence * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div className="bg-[#0B0E14] p-3 rounded-lg border border-white/5">
                    <div className="text-[11px] text-[#9AA3B2]">Сценарная сумма:</div>
                    <div className="text-xl font-bold font-mono text-[#2FBF71] mt-1 flex items-center">
                      +{result.avoided_callout_cost_rub.toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-[#9AA3B2] pt-3 border-t border-white/10 flex justify-between">
            <span>Фиксация действий в защищённом протоколе</span>
            <span className="font-mono">Решений: {confirmedHistory.length}</span>
          </div>
        </div>
      </div>

      {/* Cryptographic SHA-256 Audit Log Table */}
      <div className="eng-panel p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#7C4DFF]" />
            <h3 className="font-semibold text-sm text-[#E7EAF0]">
              Журнал решений диспетчеров (SHA-256 Ledger)
            </h3>
            <span className="eng-badge badge-normal text-xs">
              Защита от изменений
            </span>
          </div>
          <button
            onClick={verifyAuditLedger}
            className="text-xs text-[#7C4DFF] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Верифицировать хеш-цепь</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#9AA3B2]">
                <th className="py-2.5 px-3 font-medium">Время</th>
                <th className="py-2.5 px-3 font-medium">Канал</th>
                <th className="py-2.5 px-3 font-medium">Решение</th>
                <th className="py-2.5 px-3 font-medium">Диспетчер</th>
                <th className="py-2.5 px-3 font-medium text-right">Сумма</th>
                <th className="py-2.5 px-3 font-medium">Хеш блока</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {confirmedHistory.slice(0, 5).map((rec, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 text-[#E7EAF0]">{rec.timestamp}</td>
                  <td className="py-2.5 px-3 text-[#4C9BFF] font-mono font-semibold">#{rec.channel_id}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                      rec.decision.includes('FALSE') 
                        ? 'bg-[#2FBF71]/15 text-[#2FBF71] border border-[#2FBF71]/30' 
                        : 'bg-[#F0453A]/15 text-[#F0453A] border border-[#F0453A]/30'
                    }`}>
                      {rec.decision.includes('FALSE') ? 'Отмена выезда' : 'Выезд назначен'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#E7EAF0]">
                    {rec.dispatcher_badge} {rec.dispatcher_name ? `(${rec.dispatcher_name.split(' ')[0]})` : ''}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#2FBF71] font-mono">
                    {rec.avoided_cost_rub.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="py-2.5 px-3 text-[#6B7385] text-xs font-mono">
                    {rec.record_hash ? `${rec.record_hash.substring(0, 16)}...` : 'genesis'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

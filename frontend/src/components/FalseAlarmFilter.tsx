import React, { useState } from 'react';
import { Cpu, Activity, CheckCircle, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { AlarmClassificationResponse } from '../types';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { api } from '../lib/api';

export const FalseAlarmFilter: React.FC = () => {
  const { requireDispatcher } = useSession();
  const toast = useToast();

  const [channelId, setChannelId] = useState('120578');
  const [val, setVal] = useState('Замкнут');
  const [flips, setFlips] = useState(4);
  const [duration, setDuration] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [result, setResult] = useState<AlarmClassificationResponse | null>({
    channel_id: '120578',
    verdict: 'FALSE_ALARM',
    is_false_alarm: true,
    confidence: 0.94,
    diagnosis: 'Паттерн механического дребезга геркона: серия микропереключений за короткое время.',
    recommended_action: 'Рекомендуется отмена аварийного выезда. Назначить проверку концевого выключателя при плановом ТО.',
    avoided_callout_cost_rub: 18500,
  });

  const loadPreset = (presetType: string) => {
    if (presetType === 'DOOR_CHATTER') {
      setChannelId('120578');
      setVal('Замкнут');
      setFlips(5);
      setDuration(1.2);
    } else if (presetType === 'GAS_SPIKE') {
      setChannelId('104034');
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

  const handleClassify = async () => {
    setLoading(true);
    try {
      const data = await api<AlarmClassificationResponse>('/api/alarms/classify', {
        method: 'POST',
        json: {
          channel_id: channelId,
          current_value: val,
          recent_events_count_1h: flips + 2,
          recent_flips_count_1h: flips,
          duration_minutes: duration,
        },
      });
      setResult(data);
    } catch (err: any) {
      toast(err?.message || 'Ошибка классификации сигнала', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDecision = async (decision: 'CONFIRM_FALSE_ALARM' | 'FORCE_DISPATCH') => {
    if (!result) return;
    const d = await requireDispatcher();
    if (!d) return;

    if (decision === 'CONFIRM_FALSE_ALARM' && !d.can_confirm_false_alarm) {
      toast('У вашей учётки нет права подтверждать отмену выезда.', 'error');
      return;
    }
    if (decision === 'FORCE_DISPATCH' && !d.can_force_dispatch) {
      toast('У вашей учётки нет права направлять аварийную бригаду.', 'error');
      return;
    }

    setConfirming(true);
    try {
      await api('/api/alarms/confirm', {
        method: 'POST',
        json: {
          channel_id: result.channel_id,
          decision,
          dispatcher_badge: d.badge,
          dispatcher_pin: d.pin,
          notes:
            decision === 'CONFIRM_FALSE_ALARM'
              ? 'Подтверждено диспетчером: механический дребезг'
              : 'Решение диспетчера: аварийный выезд необходим',
        },
      });
      toast(
        decision === 'CONFIRM_FALSE_ALARM'
          ? 'Отмена выезда зафиксирована в журнале смены'
          : 'Направление бригады зафиксировано в журнале смены',
        'success'
      );
    } catch (err: any) {
      toast(err?.message || 'Не удалось зафиксировать решение', 'error');
    } finally {
      setConfirming(false);
    }
  };

  const verdictChipClass =
    result?.verdict === 'FALSE_ALARM'
      ? 'risk-NORMAL'
      : result?.verdict === 'REAL_RISK'
        ? 'risk-CRITICAL'
        : 'risk-WARNING';

  const verdictLabel =
    result?.verdict === 'FALSE_ALARM'
      ? 'Кандидат на шум'
      : result?.verdict === 'REAL_RISK'
        ? 'Реальный риск'
        : 'Деградация сенсора';

  return (
    <div className="space-y-5 max-w-[920px]">
      {/* Description banner */}
      <div className="flex items-center gap-2.5 text-xs pb-1" style={{ color: 'var(--muted)' }}>
        <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-text)' }} />
        <span>
          Алгоритмическая фильтрация импульсных помех и дребезга контактов. Решение об отмене выезда фиксируется в защищенном журнале смены.
        </span>
      </div>

      {/* 1. Panel: «Сигнал» */}
      <section className="panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
            <h3 className="font-semibold text-sm">Сигнал</h3>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => loadPreset('DOOR_CHATTER')}
              className="btn btn-secondary text-xs h-7 px-2.5"
            >
              Дребезг двери
            </button>
            <button
              type="button"
              onClick={() => loadPreset('GAS_SPIKE')}
              className="btn btn-secondary text-xs h-7 px-2.5"
            >
              Выброс метана
            </button>
            <button
              type="button"
              onClick={() => loadPreset('SENSOR_DEAD')}
              className="btn btn-secondary text-xs h-7 px-2.5"
            >
              Деградация сенсора
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="block space-y-1">
            <span className="label">ID канала телеметрии</span>
            <input
              className="input num"
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              placeholder="120578"
            />
          </label>

          <label className="block space-y-1">
            <span className="label">Значение датчика (телеметрия)</span>
            <input
              className="input num"
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder="Замкнут"
            />
          </label>

          <label className="block space-y-1">
            <span className="label">Микропереключений за окно</span>
            <input
              type="number"
              min="0"
              max="50"
              className="input num"
              value={flips}
              onChange={e => setFlips(parseInt(e.target.value, 10) || 0)}
            />
          </label>

          <label className="block space-y-1">
            <span className="label">Длительность сигнала (мин)</span>
            <input
              type="number"
              step="0.5"
              min="0.1"
              max="120"
              className="input num"
              value={duration}
              onChange={e => setDuration(parseFloat(e.target.value) || 1.0)}
            />
          </label>
        </div>

        <div className="pt-1">
          <button
            onClick={handleClassify}
            disabled={loading}
            className="btn btn-primary w-full h-9 text-xs"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{loading ? 'Анализируем…' : 'Анализировать сигнал'}</span>
          </button>
        </div>
      </section>

      {/* 2. Panel: «Вердикт и решение» */}
      <section className="panel p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: 'var(--ok)' }} />
            <h3 className="font-semibold text-sm">Вердикт и решение</h3>
          </div>
          {result && (
            <span className={`chip ${verdictChipClass}`}>
              {verdictLabel}
            </span>
          )}
        </div>

        {result ? (
          <div className="space-y-4">
            {/* Diagnosis */}
            <div className="p-3.5 rounded-lg border space-y-1" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
              <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Диагноз системы</div>
              <div className="text-xs sm:text-sm leading-relaxed">
                {result.diagnosis}
              </div>
            </div>

            {/* Recommendation */}
            <div className="p-3.5 rounded-lg border space-y-1" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
              <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Рекомендованное действие</div>
              <div
                className="text-xs sm:text-sm font-medium leading-relaxed"
                style={{ color: result.is_false_alarm ? 'var(--ok)' : 'var(--crit)' }}
              >
                {result.recommended_action}
              </div>
            </div>

            {/* Confidence & Potential */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border space-y-1" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Уверенность модели</div>
                <div className="num text-xl font-bold">
                  {(result.confidence * 100).toFixed(1)}%
                </div>
              </div>

              <div className="p-3 rounded-lg border space-y-1" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Предотвращаемый ущерб</div>
                <div className="num text-xl font-bold" style={{ color: 'var(--ok)' }}>
                  +{result.avoided_callout_cost_rub.toLocaleString('ru-RU')} ₽
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--line)' }}>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Подпись решения дежурным диспетчером:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleConfirmDecision('CONFIRM_FALSE_ALARM')}
                  disabled={confirming}
                  className="btn btn-secondary h-9 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--ok)' }} />
                  <span>Подтвердить ложное</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmDecision('FORCE_DISPATCH')}
                  disabled={confirming}
                  className="btn btn-danger h-9 text-xs"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Направить бригаду</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs" style={{ color: 'var(--muted)' }}>
            Нажмите «Анализировать сигнал» для получения диагностического вердикта
          </div>
        )}
      </section>
    </div>
  );
};

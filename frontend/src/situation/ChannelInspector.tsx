import React, { useEffect, useState } from 'react';
import { X, ClipboardList, ShieldCheck, Truck, Clock, MapPin } from 'lucide-react';
import { ObjectItem, PredictionItem, ConfirmedAlarmItem } from '../types';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { probabilityOf, cleanName } from './RiskQueue';

const RISK_LABEL: Record<string, string> = {
  CRITICAL: 'Критично', WARNING: 'Предупреждение', ATTENTION: 'Наблюдение', NORMAL: 'Норма',
};
// Справочник причин решения диспетчера (ТЗ §12, шаг 5)
const FALSE_REASONS = [
  'Дребезг контакта / геркона',
  'Плановые работы на объекте',
  'Проверено по камерам — норма',
  'Помеха связи, показания восстановились',
  'Тестовое срабатывание',
];
const DISPATCH_REASONS = [
  'Подтверждено по камерам',
  'Повторяющиеся тревоги на объекте',
  'Опасные показания газа или температуры',
  'Неисправность датчика — нужна проверка на месте',
];
const PRIORITY: Record<string, string> = { CRITICAL: 'ВЫСОКИЙ', WARNING: 'СРЕДНИЙ', ATTENTION: 'НИЗКИЙ', NORMAL: 'НИЗКИЙ' };

interface Props {
  item: PredictionItem;
  object?: ObjectItem;
  history: ConfirmedAlarmItem[];
  onClose: () => void;
  onDecided: (channelId: string, text: string) => void;
}

type Mode = 'idle' | 'false' | 'dispatch';

/** Channel card: forecast, reasons and the dispatcher's decision (false alarm / crew / maintenance ticket). */
export const ChannelInspector: React.FC<Props> = ({ item, object, history, onClose, onDecided }) => {
  const { requireDispatcher } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMode('idle'); setReason(''); }, [item.channel_id]);

  const prob = probabilityOf(item);

  const decide = async (decision: 'CONFIRM_FALSE_ALARM' | 'FORCE_DISPATCH') => {
    const d = await requireDispatcher();
    if (!d) return;
    if (decision === 'CONFIRM_FALSE_ALARM' && !d.can_confirm_false_alarm) { toast('У вашей учётки нет права отменять выезд.', 'error'); return; }
    if (decision === 'FORCE_DISPATCH' && !d.can_force_dispatch) { toast('У вашей учётки нет права направлять бригаду.', 'error'); return; }
    setBusy(true);
    try {
      await api('/api/alarms/confirm', {
        method: 'POST',
        json: {
          channel_id: item.channel_id, decision,
          dispatcher_badge: d.badge, dispatcher_pin: d.pin,
          notes: `${decision === 'CONFIRM_FALSE_ALARM' ? 'Ложное срабатывание' : 'Выезд бригады'}: ${reason}`,
        },
      });
      const text = decision === 'CONFIRM_FALSE_ALARM' ? `Ложное срабатывание · ${reason}` : `Бригада направлена · ${reason}`;
      toast('Решение записано в журнал смены.', 'success');
      onDecided(item.channel_id, text);
      setMode('idle'); setReason('');
    } catch (e: any) {
      toast(e?.message || 'Не удалось записать решение.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const createTicket = async () => {
    const d = await requireDispatcher();
    if (!d) return;
    setBusy(true);
    try {
      const t = await api<any>('/api/tickets/generate', {
        method: 'POST',
        json: {
          channel_id: item.channel_id, priority: PRIORITY[item.risk_level] || 'СРЕДНИЙ',
          notes: `Прогноз НейроКонтур: вероятность события ${Math.round(prob * 100)} % в окне 24–72 ч.`,
          dispatcher_badge: d.badge, dispatcher_pin: d.pin,
        },
      });
      toast(`Черновик заявки ${t?.ticket_id ?? ''} создан — раздел «Заявки и журнал».`, 'success');
      onDecided(item.channel_id, `Черновик заявки ТО${t?.ticket_id ? ' ' + t.ticket_id : ''}`);
    } catch (e: any) {
      toast(e?.message || 'Не удалось создать заявку.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const reasons = mode === 'false' ? FALSE_REASONS : DISPATCH_REASONS;

  return (
    <div className="flex flex-col w-full max-h-full min-h-0">
      <div className="p-5 pb-4 flex items-start gap-3 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`chip risk-${item.risk_level}`}>{RISK_LABEL[item.risk_level]}</span>
            <span className="num text-xs" style={{ color: 'var(--faint)' }}>#{item.channel_id}</span>
          </div>
          <h3 className="font-semibold leading-snug">{cleanName(item.sensor_name)}</h3>
          <div className="text-sm mt-1 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{item.object_name}{object ? ` · ${object.corridor} · ${object.picket}` : ''}</span>
          </div>
        </div>
        <button className="icon-btn shrink-0" onClick={onClose} aria-label="Закрыть карточку"><X className="w-4 h-4" /></button>
      </div>

      <div className="overflow-y-auto scroll-thin p-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg p-3" style={{ background: 'var(--bg)' }}>
            <div className="label">Вероятность события</div>
            <div className="num text-3xl font-semibold mt-1">{Math.round(prob * 100)}<span className="text-base" style={{ color: 'var(--muted)' }}> %</span></div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg)' }}>
            <div className="label">Горизонт</div>
            <div className="num text-3xl font-semibold mt-1">24–72<span className="text-base" style={{ color: 'var(--muted)' }}> ч</span></div>
          </div>
        </div>
        <div className="text-xs -mt-2" style={{ color: 'var(--faint)' }}>
          {item.system_type} · {item.sensor_type} · балл модели <span className="num">{(item.raw_model_score ?? item.failure_probability).toFixed(3).replace('.', ',')}</span>
        </div>

        <section>
          <div className="label mb-2">Почему модель подняла канал</div>
          {item.explanation_factors?.length ? (
            <ul className="space-y-1.5">
              {item.explanation_factors.map(f => (
                <li key={f} className="text-sm flex gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />{f}</li>
              ))}
            </ul>
          ) : <div className="text-sm" style={{ color: 'var(--muted)' }}>Нет выраженных факторов</div>}
        </section>

        <section>
          <div className="label mb-2">Рекомендация</div>
          <div className="text-sm">{item.recommended_action}</div>
        </section>

        {history.length > 0 && (
          <section>
            <div className="label mb-2">Решения по каналу</div>
            <ul className="space-y-1.5">
              {history.slice(-3).reverse().map(h => (
                <li key={h.record_hash || h.timestamp} className="text-xs flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="num">{h.timestamp?.slice(0, 16)}</span>
                  <span className="truncate">{h.decision === 'FORCE_DISPATCH' ? 'Выезд' : 'Ложное'} · {h.dispatcher_badge}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="p-4 border-t space-y-3" style={{ borderColor: 'var(--line)' }}>
        {mode === 'idle' ? (
          <>
            <button className="btn btn-primary w-full" disabled={busy} onClick={createTicket}>
              <ClipboardList className="w-4 h-4" />Черновик заявки ТО
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-secondary" disabled={busy} onClick={() => setMode('false')}><ShieldCheck className="w-4 h-4" />Ложное</button>
              <button className="btn btn-danger" disabled={busy} onClick={() => setMode('dispatch')}><Truck className="w-4 h-4" />Выезд бригады</button>
            </div>
          </>
        ) : (
          <>
            <div className="label">{mode === 'false' ? 'Причина: ложное срабатывание' : 'Основание для выезда'}</div>
            <div className="flex flex-wrap gap-2">
              {reasons.map(r => (
                <button key={r} onClick={() => setReason(r)}
                        className="text-xs rounded-lg px-2.5 py-1.5 border transition-colors text-left"
                        style={reason === r ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' }
                                            : { borderColor: 'var(--line-2)', color: 'var(--muted)' }}>
                  {r}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-ghost" onClick={() => { setMode('idle'); setReason(''); }}>Назад</button>
              <button className={mode === 'false' ? 'btn btn-primary' : 'btn btn-danger'} disabled={!reason || busy}
                      onClick={() => decide(mode === 'false' ? 'CONFIRM_FALSE_ALARM' : 'FORCE_DISPATCH')}>
                {busy ? 'Записываем…' : mode === 'false' ? 'Подтвердить' : 'Направить'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

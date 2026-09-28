import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Wrench, Hand, Truck, CheckCircle2, AudioLines, History, WifiOff, BatteryLow, Flame, Activity } from 'lucide-react';
import { ObjectItem, PredictionItem } from '../types';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { LEVEL_SOFT, LEVEL_TEXT, LEVEL_VAR, cleanName, plainReason, probabilityOf } from '../lib/plain';

// Справочник причин решения диспетчера (ТЗ §12, шаг 5)
const FALSE_REASONS = ['Дребезг контакта / геркона', 'Плановые работы на объекте', 'Проверено по камерам — норма', 'Помеха связи, показания восстановились'];
const DISPATCH_REASONS = ['Подтверждено по камерам', 'Повторяющиеся тревоги на объекте', 'Опасные показания газа или температуры', 'Неисправность датчика — нужна проверка на месте'];
const PRIORITY: Record<string, string> = { CRITICAL: 'ВЫСОКИЙ', WARNING: 'СРЕДНИЙ', ATTENTION: 'НИЗКИЙ', NORMAL: 'НИЗКИЙ' };

const factorIcon = (t: string) =>
  /Дребезг/i.test(t) ? AudioLines : /часов/i.test(t) ? History : /Молчание/i.test(t) ? WifiOff
    : /питани|батаре/i.test(t) ? BatteryLow : /газ|метан|темп/i.test(t) ? Flame : Activity;

interface Props {
  item: PredictionItem;
  object?: ObjectItem;
  position: number;
  total: number;
  done?: string;
  compact?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDecided: (channelId: string, text: string) => void;
}

type Mode = 'idle' | 'false' | 'dispatch';

/** Channel card: probability, plain-language reasons, and the dispatcher's decision. */
export const ChannelCard: React.FC<Props> = ({ item, object, position, total, done, compact, onPrev, onNext, onDecided }) => {
  const { requireDispatcher } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMode('idle'); setReason(''); }, [item.channel_id]);

  const pct = Math.round(probabilityOf(item) * 100);
  const color = LEVEL_VAR[item.risk_level];

  const decide = async (decision: 'CONFIRM_FALSE_ALARM' | 'FORCE_DISPATCH') => {
    const d = await requireDispatcher();
    if (!d) return;
    if (decision === 'CONFIRM_FALSE_ALARM' && !d.can_confirm_false_alarm) { toast('У вашей учётки нет права давать отбой.', 'error'); return; }
    if (decision === 'FORCE_DISPATCH' && !d.can_force_dispatch) { toast('У вашей учётки нет права направлять бригаду.', 'error'); return; }
    setBusy(true);
    try {
      await api('/api/alarms/confirm', {
        method: 'POST',
        json: {
          channel_id: item.channel_id, decision, dispatcher_badge: d.badge, dispatcher_pin: d.pin,
          notes: `${decision === 'CONFIRM_FALSE_ALARM' ? 'Отбой, ложная тревога' : 'Выезд бригады'}: ${reason}`,
        },
      });
      const text = decision === 'CONFIRM_FALSE_ALARM' ? `Отбой · ${reason}` : `Бригада направлена · ${reason}`;
      toast(decision === 'CONFIRM_FALSE_ALARM' ? 'Отбой записан в журнал смены' : 'Выезд бригады записан в журнал смены', 'success');
      onDecided(item.channel_id, text);
    } catch (e: any) {
      toast(e?.message || 'Не удалось записать решение.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const ticket = async () => {
    const d = await requireDispatcher();
    if (!d) return;
    setBusy(true);
    try {
      const t = await api<any>('/api/tickets/generate', {
        method: 'POST',
        json: {
          channel_id: item.channel_id, priority: PRIORITY[item.risk_level] || 'СРЕДНИЙ',
          notes: `Прогноз НейроКонтур: вероятность инцидента ${pct} % в ближайшие 1–3 дня.`,
          dispatcher_badge: d.badge, dispatcher_pin: d.pin,
        },
      });
      toast(`Черновик заявки ${t?.ticket_id ?? ''} создан`, 'success');
      onDecided(item.channel_id, `Ремонт запланирован${t?.ticket_id ? ' · ' + t.ticket_id : ''}`);
    } catch (e: any) {
      toast(e?.message || 'Не удалось создать заявку.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const reasons = mode === 'false' ? FALSE_REASONS : DISPATCH_REASONS;
  const factors = (item.explanation_factors || []).slice(0, 3);

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <div className="px-5 pt-4 flex items-center gap-2.5">
        <span className="chip" style={{ background: LEVEL_SOFT[item.risk_level], color }}>
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />{LEVEL_TEXT[item.risk_level]}
        </span>
        <span className="num text-xs hidden 2xl:inline whitespace-nowrap" style={{ color: 'var(--mut)' }}>#{item.channel_id}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--mut)' }}>
          <button className="icon-btn !w-9 !h-9" onClick={onPrev} aria-label="Предыдущий"><ArrowLeft className="w-4 h-4" /></button>
          <span className="num whitespace-nowrap">{position} из {total}</span>
          <button className="icon-btn !w-9 !h-9" onClick={onNext} aria-label="Следующий"><ArrowRight className="w-4 h-4" /></button>
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-5">
        <div className={compact ? 'pt-3 flex items-end gap-3' : 'pt-4'}>
          {!compact && <div className="text-[13px]" style={{ color: 'var(--mut)' }}>Вероятность инцидента в ближайшие 1–3 дня</div>}
          <div className={`serif font-semibold tracking-[-0.03em] ${compact ? 'text-[64px] leading-[.8]' : 'text-[104px] leading-[.8] mt-3'}`} style={{ color }}>
            {pct}<span className={compact ? 'text-[28px]' : 'text-[44px]'}>%</span>
          </div>
          {compact && <div className="text-xs pb-1" style={{ color: 'var(--mut)' }}>вероятность<br />за 1–3 дня</div>}
        </div>
        {!compact && (
          <div className="h-2 rounded mt-3 overflow-hidden" style={{ background: 'var(--sf3)' }}>
            <div className="h-full rounded" style={{ width: `${pct}%`, background: color, transition: 'width .5s' }} />
          </div>
        )}
        <div className="mt-3">
          <div className="serif font-semibold text-[26px] leading-[1.05]">{cleanName(item.sensor_name)}</div>
          <div className="text-sm mt-1 flex items-center gap-1.5" style={{ color: 'var(--mut)' }}>
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{item.object_name}{object ? ` · ${object.corridor} · ${object.picket}` : ''}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="eyebrow">Почему так думаем</div>
          {factors.map(f => {
            const I = factorIcon(f);
            return (
              <div key={f} className="flex gap-3 items-center px-3 py-2.5 rounded-2xl" style={{ background: 'var(--sf2)' }}>
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--sf)' }}><I className="w-[18px] h-[18px]" style={{ color: 'var(--ac)' }} /></span>
                <span><b className="block text-sm font-medium">{plainReason(f)}</b><span className="text-xs" style={{ color: 'var(--mut)' }}>{f}</span></span>
              </div>
            );
          })}
          {!compact && <div className="text-xs pt-1" style={{ color: 'var(--mut)' }}>Рекомендация модели: {item.recommended_action}</div>}
        </div>
        {done && (
          <div className="mt-3 px-3.5 py-2.5 rounded-2xl text-sm flex gap-2 items-center" style={{ background: 'var(--oks)' }}>
            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--ok)' }} />{done}
          </div>
        )}
      </div>

      <div className="px-5 pt-3 pb-5 space-y-2">
        {mode === 'idle' ? (
          <>
            {!compact && <div className="eyebrow">Что сделать?</div>}
            <button disabled={busy} onClick={ticket} className="w-full h-[60px] rounded-2xl flex items-center gap-3 px-4 text-left transition hover:brightness-110 disabled:opacity-50"
                    style={{ background: 'var(--ac)', color: 'var(--act)' }}>
              <Wrench className="w-[22px] h-[22px]" />
              <span className="flex-1"><b className="block text-[15px] font-semibold">Запланировать ремонт</b><span className="text-xs opacity-85">создать черновик заявки ТО</span></span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={busy} onClick={() => setMode('false')} className="h-[60px] rounded-2xl flex items-center gap-2.5 px-3.5 text-left border transition hover:bg-[var(--sf2)]"
                      style={{ borderColor: 'var(--ln)', background: 'var(--sf)' }}>
                <Hand className="w-5 h-5" style={{ color: 'var(--mut)' }} />
                <span><b className="block text-sm font-semibold">Отбой</b><span className="text-xs" style={{ color: 'var(--mut)' }}>ложная тревога</span></span>
              </button>
              <button disabled={busy} onClick={() => setMode('dispatch')} className="h-[60px] rounded-2xl flex items-center gap-2.5 px-3.5 text-left transition hover:brightness-95"
                      style={{ background: 'var(--crs)', color: 'var(--cr)' }}>
                <Truck className="w-5 h-5" />
                <span><b className="block text-sm font-semibold">Выезд бригады</b><span className="text-xs opacity-85">отправить людей</span></span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-[15px] font-semibold">{mode === 'false' ? 'Почему это ложная тревога?' : 'Основание для выезда'}</div>
            {reasons.map((r, i) => (
              <button key={r} onClick={() => setReason(r)} className="w-full min-h-[44px] rounded-xl px-3 py-2 flex items-center gap-3 text-left text-sm border"
                      style={reason === r ? { background: 'var(--acs)', borderColor: 'var(--ac)', color: 'var(--ink)' } : { borderColor: 'var(--ln)', color: 'var(--ink)' }}>
                <span className="w-6 h-6 rounded-full border-[1.5px] flex items-center justify-center text-[11px] shrink-0" style={{ borderColor: 'currentColor' }}>{i + 1}</span>{r}
              </button>
            ))}
            <div className="grid grid-cols-[1fr_1.5fr] gap-2 pt-1">
              <button className="h-[52px] rounded-2xl border text-[15px]" style={{ borderColor: 'var(--ln)' }} onClick={() => { setMode('idle'); setReason(''); }}>Назад</button>
              <button className="h-[52px] rounded-2xl text-[15px] font-semibold disabled:opacity-40" disabled={!reason || busy}
                      style={{ background: 'var(--ink)', color: 'var(--bg)' }}
                      onClick={() => decide(mode === 'false' ? 'CONFIRM_FALSE_ALARM' : 'FORCE_DISPATCH')}>
                {busy ? 'Записываем…' : mode === 'false' ? 'Подтвердить отбой' : 'Отправить бригаду'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

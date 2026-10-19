import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Wrench,
  Hand,
  Truck,
  CheckCircle2,
  AudioLines,
  History,
  WifiOff,
  BatteryLow,
  Flame,
  Activity,
  ClipboardList,
  Users,
  X,
  Radio,
} from 'lucide-react';
import { ObjectItem, PredictionItem } from '../types';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { cleanName, plainReason, probabilityOf, formatPk } from '../lib/plain';

// Справочник причин решения диспетчера (ТЗ §12, шаг 5)
const FALSE_REASONS = [
  'Дребезг контакта / геркона',
  'Плановые работы на объекте',
  'Проверено по камерам — норма',
  'Помеха связи, показания восстановились',
];
const DISPATCH_REASONS = [
  'Подтверждено по камерам',
  'Повторяющиеся тревоги на объекте',
  'Опасные показания газа или температуры',
  'Неисправность датчика — нужна проверка на месте',
];
const PRIORITY: Record<string, string> = {
  CRITICAL: 'ВЫСОКИЙ',
  WARNING: 'СРЕДНИЙ',
  ATTENTION: 'НИЗКИЙ',
  NORMAL: 'НИЗКИЙ',
};

const factorIcon = (t: string) =>
  /Дребезг/i.test(t)
    ? AudioLines
    : /часов/i.test(t)
    ? History
    : /Молчание/i.test(t)
    ? WifiOff
    : /питани|батаре/i.test(t)
    ? BatteryLow
    : /газ|метан|темп/i.test(t)
    ? Flame
    : Activity;

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
  onOpenTickets?: (objectId?: string) => void;
}

type Mode = 'idle' | 'false' | 'dispatch';

/**
 * Channel card: status chip, big percentage with 5 dots accuracy caveat,
 * plain-language reasons with icons, brigade status, and three decision paths.
 */
export const ChannelCard: React.FC<Props> = ({
  item,
  object,
  position,
  total,
  done,
  compact = false,
  onPrev,
  onNext,
  onDecided,
  onOpenTickets,
}) => {
  const { requireDispatcher } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode('idle');
    setReason('');
  }, [item.channel_id]);

  const pct = Math.round(probabilityOf(item) * 100);
  const isCritical = item.risk_level === 'CRITICAL';
  const isWarning = item.risk_level === 'WARNING';

  // Status chip colors and text
  const statusInfo = done
    ? {
        text: done.includes('Ремонт')
          ? 'Ремонт запланирован'
          : done.includes('Отбой')
          ? 'Отбой — ложная тревога'
          : done.includes('Бригада')
          ? 'Бригада направлена'
          : 'Решено',
        bg: 'var(--gns)',
        fg: 'var(--gnt)',
        dot: 'var(--gn)',
      }
    : isCritical
    ? {
        text: 'Срочно проверить',
        bg: 'var(--rds)',
        fg: 'var(--rdt)',
        dot: 'var(--rd)',
      }
    : {
        text: 'Проверить скоро',
        bg: 'var(--ams)',
        fg: 'var(--amt)',
        dot: 'var(--am)',
      };

  const bigColor = done ? 'var(--gnt)' : isCritical ? 'var(--rdt)' : 'var(--amt)';

  const decide = async (decision: 'CONFIRM_FALSE_ALARM' | 'FORCE_DISPATCH') => {
    const d = await requireDispatcher();
    if (!d) return;
    if (decision === 'CONFIRM_FALSE_ALARM' && !d.can_confirm_false_alarm) {
      toast('У вашей учётки нет права давать отбой.', 'error');
      return;
    }
    if (decision === 'FORCE_DISPATCH' && !d.can_force_dispatch) {
      toast('У вашей учётки нет права направлять бригаду.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api('/api/alarms/confirm', {
        method: 'POST',
        json: {
          channel_id: item.channel_id,
          decision,
          dispatcher_badge: d.badge,
          dispatcher_pin: d.pin,
          notes: `${decision === 'CONFIRM_FALSE_ALARM' ? 'Отбой, ложная тревога' : 'Выезд бригады'}: ${reason}`,
        },
      });
      const text =
        decision === 'CONFIRM_FALSE_ALARM'
          ? `Отбой · ${reason}`
          : `Бригада направлена · ${reason}`;
      toast(
        decision === 'CONFIRM_FALSE_ALARM'
          ? 'Отбой записан в журнал смены'
          : 'Выезд бригады записан в журнал смены',
        'success'
      );
      setMode('idle');
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
          channel_id: item.channel_id,
          priority: PRIORITY[item.risk_level] || 'СРЕДНИЙ',
          notes: `Прогноз НейроКонтур: вероятность инцидента ${pct} % в ближайшие 1–3 дня.`,
          dispatcher_badge: d.badge,
          dispatcher_pin: d.pin,
        },
      });
      toast(`Черновик заявки ${t?.ticket_id ?? ''} создан`, 'success');
      onDecided(
        item.channel_id,
        `Ремонт запланирован${t?.ticket_id ? ' · ' + t.ticket_id : ''}`
      );
    } catch (e: any) {
      toast(e?.message || 'Не удалось создать заявку.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const factors = (item.explanation_factors || []).slice(0, 3);
  const activeReasons = mode === 'false' ? FALSE_REASONS : DISPATCH_REASONS;

  return (
    <div className="flex flex-col h-full min-h-0 w-full select-text">
      {/* 1. Header / Top row: Status chip + Navigation buttons */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-3 shrink-0">
        <span
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full font-semibold text-[13.5px] leading-tight"
          style={{ background: statusInfo.bg, color: statusInfo.fg }}
        >
          <i className="w-2 h-2 rounded-full shrink-0" style={{ background: statusInfo.dot }} />
          {statusInfo.text}
        </span>

        <div className="flex items-center gap-1.5 text-[13px] text-[var(--mu)]">
          <button
            onClick={onPrev}
            aria-label="Предыдущий канал"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border flex items-center justify-center transition-colors hover:bg-[var(--sf2)] active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--ac)]"
            style={{ borderColor: 'var(--ln)', background: 'var(--sf)', color: 'var(--ink)' }}
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
          </button>
          <span className="font-semibold text-[13.5px] px-1 whitespace-nowrap text-[var(--ink)]">
            {position} из {total}
          </span>
          <button
            onClick={onNext}
            aria-label="Следующий канал"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border flex items-center justify-center transition-colors hover:bg-[var(--sf2)] active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--ac)]"
            style={{ borderColor: 'var(--ln)', background: 'var(--sf)', color: 'var(--ink)' }}
          >
            <ChevronRight className="w-5 h-5 shrink-0" />
          </button>
        </div>
      </div>

      {/* 2. Scrollable Body: Hero %, 5-dots caveat, Title, Reasons, Recommendations */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2.5">
        {/* Big percentage & 5 dots accuracy caveat */}
        <div>
          <div className="flex items-end gap-3">
            <div
              className={`serif tracking-[-0.03em] font-normal leading-[0.85] font-variant-numeric:tabular-nums ${
                compact ? 'text-[50px]' : 'text-[64px] xl:text-[74px]'
              }`}
              style={{ color: bigColor }}
            >
              {pct}
              <span className={compact ? 'text-[22px] ml-1' : 'text-[28px] ml-1'}>%</span>
            </div>

            <div className="pb-1 flex flex-col gap-1" aria-label="Подтверждается около 1 из 5">
              <div className="flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3, 4].map(i => (
                  <i
                    key={i}
                    className="w-3 h-3 rounded-full border-2 transition-colors"
                    style={{
                      borderColor: 'var(--ac)',
                      background: i === 0 ? 'var(--ac)' : 'transparent',
                    }}
                  />
                ))}
              </div>
              <span className="text-[12px] font-medium text-[var(--mu)] leading-none">
                подтверждается ≈ 1 из 5
              </span>
            </div>
          </div>

          <div className="text-[11.5px] text-[var(--mu)] leading-snug mt-1">
            В списке из 100 самых рисковых каналов подтверждается около 1 из 5 (бэктест стенда)
          </div>
        </div>

        {/* Object title & location */}
        <div>
          <h3 className="serif text-[20px] xl:text-[22px] font-normal leading-tight text-[var(--ink)]">
            {cleanName(item.sensor_name)}
          </h3>
          <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--mu)] mt-0.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {item.object_name}
              {object ? ` · ${object.corridor} · ${formatPk(object.picket)}` : ''}
            </span>
          </div>
        </div>

        {/* Reasons list with icons */}
        <div className="space-y-1.5">
          <div className="font-mono text-[10.5px] font-semibold tracking-[0.08em] text-[var(--mu)] uppercase">
            ПОЧЕМУ ТАК ДУМАЕМ
          </div>
          <div className="flex flex-col gap-1.5">
            {factors.map(f => {
              const Icon = factorIcon(f);
              return (
                <div
                  key={f}
                  className="flex gap-2.5 items-center rounded-[12px] p-2 px-2.5"
                  style={{ background: 'var(--sf2)' }}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--sf)', color: 'var(--ac)' }}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-[13.5px] leading-tight text-[var(--ink)] truncate">
                      {plainReason(f)}
                    </span>
                    <span className="block text-[11.5px] text-[var(--mu)] mt-0.5 truncate">
                      {f}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-[12px] text-[var(--mu)] pt-0.5 leading-snug">
            Рекомендация модели:{' '}
            <span className="text-[var(--ink)] font-medium">{item.recommended_action}</span>
          </div>
        </div>

        {/* Brigade status info block (when open) */}
        {!done && (
          <div
            className="rounded-[12px] p-2.5 border flex items-center gap-2 text-[12px]"
            style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
          >
            <Users className="w-3.5 h-3.5 text-[var(--ac)] shrink-0" />
            <span className="text-[var(--mu)] leading-snug">
              Дежурная бригада:{' '}
              <b className="text-[var(--ink)] font-semibold">
                Оперативная бригада ОДС Москоллектор
              </b>
            </span>
          </div>
        )}

        {/* Result banner (when resolved) */}
        {done && (
          <div className="pt-0.5 animate-fadeIn">
            <div
              className="flex gap-2.5 items-start rounded-[14px] p-3 text-[13px] leading-snug"
              style={{ background: 'var(--gns)', color: 'var(--gnt)' }}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--gn)' }} />
              <div>
                <b className="block font-semibold text-[14px]">
                  {done.includes('Ремонт')
                    ? 'Ремонт запланирован'
                    : done.includes('Отбой')
                    ? 'Отбой записан в журнал'
                    : 'Бригада направлена'}
                </b>
                <span className="block text-[12px] opacity-90 mt-0.5">{done}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Sticky Footer / Decision or Result button */}
      <div
        className="p-3.5 pt-2.5 border-t shrink-0 flex flex-col gap-2 bg-[var(--sf)] sticky bottom-0 z-10 overflow-hidden"
        style={{ borderColor: 'var(--ln)', background: 'var(--sf)' }}
      >
        {done ? (
          <button
            onClick={() => onOpenTickets?.(item.object_id)}
            className="w-full min-h-[46px] h-[46px] rounded-[14px] border-[1.5px] flex items-center justify-center gap-2 text-[14px] font-semibold transition hover:bg-[var(--sf2)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[var(--ac)] cursor-pointer"
            style={{ borderColor: 'var(--ln2)', background: 'var(--sf)', color: 'var(--ink)' }}
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            Открыть в заявках и журнале
          </button>
        ) : (
          <>
            {/* Primary Action: Plan Repair */}
            <button
              disabled={busy}
              onClick={ticket}
              className="min-h-[46px] h-[46px] w-full rounded-[14px] flex items-center gap-2.5 px-3.5 text-left transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ac)] cursor-pointer"
              style={{ background: 'var(--ac)', color: 'var(--onac)' }}
            >
              <Wrench className="w-[18px] h-[18px] shrink-0" />
              <span className="leading-tight flex-1">
                <span className="block font-semibold text-[14px]">Запланировать ремонт</span>
                <span className="block text-[11px] opacity-90 mt-0.5">создать черновик заявки ТО</span>
              </span>
            </button>

            {/* Secondary Actions: False alarm and Force dispatch */}
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={busy}
                onClick={() => setMode('false')}
                className="min-h-[44px] h-[44px] rounded-[14px] border-[1.5px] flex items-center gap-2 px-2.5 text-left transition hover:bg-[var(--sf2)] active:scale-[0.99] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--ac)] cursor-pointer"
                style={{ borderColor: 'var(--ln2)', background: 'var(--sf)', color: 'var(--ink)' }}
              >
                <Hand className="w-4 h-4 shrink-0 text-[var(--mu)]" />
                <span className="leading-tight">
                  <span className="block font-semibold text-[13px]">Отбой</span>
                  <span className="block text-[11px] text-[var(--mu)]">ложная тревога</span>
                </span>
              </button>

              <button
                disabled={busy}
                onClick={() => setMode('dispatch')}
                className="min-h-[44px] h-[44px] rounded-[14px] flex items-center gap-2 px-2.5 text-left transition hover:brightness-95 active:scale-[0.99] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--rd)] cursor-pointer"
                style={{ background: 'var(--rds)', color: 'var(--rdt)' }}
              >
                <Truck className="w-4 h-4 shrink-0" />
                <span className="leading-tight">
                  <span className="block font-semibold text-[13px]">Выезд бригады</span>
                  <span className="block text-[11px] opacity-85">отправить людей</span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Reason selection modal for False alarm / Dispatch */}
      {mode !== 'idle' && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-fadeIn"
          onClick={() => setMode('idle')}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={mode === 'false' ? 'Отбой — ложная тревога' : 'Выезд бригады'}
            className="w-full max-w-md rounded-[24px] p-6 flex flex-col gap-4 shadow-2xl animate-scaleUp"
            style={{ background: 'var(--sf)', border: '1px solid var(--ln)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="serif text-[22px] font-normal leading-tight text-[var(--ink)]">
                  {mode === 'false' ? 'Отбой — ложная тревога' : 'Выезд бригады'}
                </h4>
                <p className="text-[13px] text-[var(--mu)] mt-1 leading-snug">
                  {mode === 'false'
                    ? 'Выберите причину — она попадёт в журнал решений'
                    : 'Выберите причину — бригада получит её в наряде'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMode('idle')}
                className="w-10 h-10 rounded-full border flex items-center justify-center text-[var(--mu)] hover:bg-[var(--sf2)] transition-colors"
                style={{ borderColor: 'var(--ln)', background: 'var(--sf)' }}
                aria-label="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 py-1">
              <div className="font-mono text-[11px] font-semibold tracking-[0.08em] text-[var(--mu)] uppercase">
                ПРИЧИНА ИЗ СПРАВОЧНИКА
              </div>
              <div className="flex flex-col gap-2">
                {activeReasons.map(r => {
                  const isChecked = reason === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className="min-h-[52px] w-full rounded-[14px] p-3 text-left flex items-center gap-3 border-2 transition-all active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[var(--ac)]"
                      style={{
                        borderColor: isChecked ? 'var(--ac)' : 'var(--ln2)',
                        background: isChecked ? 'var(--acs)' : 'var(--sf)',
                        color: 'var(--ink)',
                      }}
                    >
                      <i
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                        style={{
                          borderColor: isChecked ? 'var(--ac)' : 'var(--ln2)',
                          background: isChecked ? 'var(--ac)' : 'transparent',
                        }}
                      />
                      <span className="font-medium text-[14px] leading-snug">{r}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_1.8fr] gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMode('idle')}
                className="min-h-[52px] rounded-[16px] border text-[14.5px] font-medium transition hover:bg-[var(--sf2)]"
                style={{ borderColor: 'var(--ln2)', color: 'var(--ink)' }}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!reason || busy}
                onClick={() =>
                  decide(mode === 'false' ? 'CONFIRM_FALSE_ALARM' : 'FORCE_DISPATCH')
                }
                className="min-h-[52px] rounded-[16px] text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-40"
                style={{
                  background: mode === 'false' ? 'var(--ac)' : 'var(--rd)',
                  color: '#ffffff',
                }}
              >
                {busy
                  ? 'Записываем…'
                  : mode === 'false'
                  ? 'Записать отбой'
                  : 'Отправить бригаду'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

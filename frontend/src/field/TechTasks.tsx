import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wrench, Bell, Check, Navigation, Play, RefreshCw } from 'lucide-react';
import { MaintenanceTicket } from '../types';
import { api } from '../lib/api';
import { cleanName } from '../lib/plain';

interface Props {
  /** Открыть объект наряда на карте техника («Поле»). */
  onOpenObject: (objectId: string) => void;
  onOpenField: () => void;
}

const isInWork = (s: string) => s === 'В_РАБОТЕ' || s === 'В РАБОТЕ';

const riskColor = (pct: number) => (pct >= 70 ? 'var(--rdt)' : 'var(--amt)');

/** Три чёрточки прогресса по статусу наряда: передан — 0, в работе — 1, выполнен — 3. */
const Dashes: React.FC<{ filled: number }> = ({ filled }) => (
  <span className="flex items-center gap-1 shrink-0" aria-hidden="true">
    {[0, 1, 2].map(i => (
      <i
        key={i}
        className="block h-1.5 w-[22px] rounded-full"
        style={{ background: i < filled ? 'var(--ac)' : 'var(--ln2)' }}
      />
    ))}
  </span>
);

const RiskBar: React.FC<{ pct: number }> = ({ pct }) => {
  const p = Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : null;
  if (p === null) return <span className="text-[13px] font-bold text-[var(--mu)]">—</span>;
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      <i className="block h-1.5 w-10 rounded-full overflow-hidden" style={{ background: 'var(--ln2)' }} aria-hidden="true">
        <i className="block h-full rounded-full" style={{ width: `${p}%`, background: riskColor(p) }} />
      </i>
      <span className="text-[13px] font-bold tabular-nums" style={{ color: riskColor(p) }}>
        {p} %
      </span>
    </span>
  );
};

interface CardProps {
  ticket: MaintenanceTicket;
  kind: 'now' | 'wait' | 'done';
  onOpen: () => void;
}

const TaskCard: React.FC<CardProps> = ({ ticket, kind, onOpen }) => {
  const name = cleanName(ticket.object_name) || ticket.object_id;
  const palette =
    kind === 'now'
      ? { icon: 'var(--ac)', onIcon: 'var(--onac)', border: 'var(--acs)', btn: 'var(--ac)', onBtn: 'var(--onac)' }
      : kind === 'wait'
        ? { icon: 'var(--am)', onIcon: 'var(--ink)', border: 'var(--ams)', btn: 'var(--am)', onBtn: 'var(--ink)' }
        : { icon: 'var(--gns)', onIcon: 'var(--gnt)', border: 'var(--ln)', btn: 'var(--sf2)', onBtn: 'var(--mu)' };
  const filled = kind === 'done' ? 3 : kind === 'now' ? 1 : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${kind === 'done' ? 'Выполнено' : 'Открыть на карте'}: ${name}`}
      className="w-full min-h-[88px] p-3 rounded-[28px] border-2 flex items-center gap-3 text-left cursor-pointer transition-transform active:scale-[0.99]"
      style={{ background: 'var(--sf)', borderColor: palette.border, opacity: kind === 'done' ? 0.78 : 1 }}
    >
      <span
        className="shrink-0 w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: palette.icon, color: palette.onIcon }}
      >
        {kind === 'now' ? <Wrench className="w-7 h-7" /> : kind === 'wait' ? <Bell className="w-7 h-7" /> : <Check className="w-7 h-7" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-tight text-[var(--ink)] break-words">{name}</span>
        <span className="mt-1.5 flex items-center gap-2.5 flex-wrap">
          <Dashes filled={filled} />
          <RiskBar pct={ticket.failure_risk_percent} />
        </span>
      </span>
      {kind !== 'done' && (
        <span
          className="shrink-0 w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: palette.btn, color: palette.onBtn }}
          aria-hidden="true"
        >
          {kind === 'now' ? <Navigation className="w-7 h-7" /> : <Play className="w-7 h-7" />}
        </span>
      )}
    </button>
  );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; bg: string; fg: string; children: React.ReactNode }> = ({ icon, bg, fg, children }) => (
  <div className="flex items-center gap-2.5 mt-5 mb-2.5 px-1">
    <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: bg, color: fg }}>
      {icon}
    </span>
    <h2 className="text-[20px] font-bold text-[var(--ink)]">{children}</h2>
  </div>
);

/** «Заявки» техника: только наряды, которые диспетчер уже передал бригаде. Статусы меняет диспетчер. */
export const TechTasks: React.FC<Props> = ({ onOpenObject, onOpenField }) => {
  const [tickets, setTickets] = useState<MaintenanceTicket[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api<MaintenanceTicket[]>('/api/tickets');
      setTickets(Array.isArray(data) ? data : []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { now, wait, done } = useMemo(() => {
    const list = tickets || [];
    const byRisk = (a: MaintenanceTicket, b: MaintenanceTicket) =>
      (Number(b.failure_risk_percent) || 0) - (Number(a.failure_risk_percent) || 0);
    return {
      now: list.filter(t => isInWork(t.status)).sort(byRisk),
      wait: list.filter(t => t.status === 'НАЗНАЧЕН').sort(byRisk),
      done: list.filter(t => t.status === 'ВЫПОЛНЕН').sort(byRisk),
    };
  }, [tickets]);

  const active = now.length + wait.length;

  return (
    <div className="relative z-[1] h-full overflow-y-auto px-3.5 sm:px-4 pt-4 pb-24">
      <div className="max-w-[640px] mx-auto">
        <div className="flex items-center gap-3">
          <div
            className="flex-1 min-h-[64px] px-5 rounded-[22px] flex items-center gap-3"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            <Wrench className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="serif text-[30px] leading-none tabular-nums">{active}</span>
            <span className="text-[15px] font-bold">Активные</span>
          </div>
          <div
            className="flex-1 min-h-[64px] px-5 rounded-[22px] flex items-center gap-3 border-2"
            style={{ background: 'var(--sf)', borderColor: 'var(--ln2)', color: 'var(--ink)' }}
          >
            <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="serif text-[30px] leading-none tabular-nums">{done.length}</span>
            <span className="text-[15px] font-bold">Готово</span>
          </div>
        </div>

        {tickets === null && !failed && (
          <div className="mt-6 text-center text-[15px] text-[var(--mu)]" role="status">Загружаем наряды…</div>
        )}

        {failed && (
          <div className="mt-6 p-4 rounded-2xl border text-[15px]" style={{ background: 'var(--ams)', color: 'var(--amt)', borderColor: 'transparent' }} role="alert">
            Не удалось загрузить наряды. Проверьте связь и нажмите «Обновить».
          </div>
        )}

        {tickets !== null && active === 0 && done.length === 0 && !failed && (
          <div className="mt-6 p-5 rounded-2xl border text-[15px] leading-relaxed" style={{ background: 'var(--sf)', borderColor: 'var(--ln)', color: 'var(--ink)' }}>
            Пока нет нарядов для бригады. Когда диспетчер передаст наряд, он появится здесь.
            <button
              type="button"
              onClick={onOpenField}
              className="mt-3 min-h-[48px] px-5 rounded-full border-0 font-bold cursor-pointer block"
              style={{ background: 'var(--ac)', color: 'var(--onac)' }}
            >
              Открыть карту
            </button>
          </div>
        )}

        {now.length > 0 && (
          <>
            <SectionTitle icon={<Wrench className="w-5 h-5" />} bg="var(--ac)" fg="var(--onac)">Сейчас</SectionTitle>
            <div className="flex flex-col gap-3">
              {now.map(t => (
                <TaskCard key={t.ticket_id} ticket={t} kind="now" onOpen={() => onOpenObject(t.object_id)} />
              ))}
            </div>
          </>
        )}

        {wait.length > 0 && (
          <>
            <SectionTitle icon={<Bell className="w-5 h-5" />} bg="var(--am)" fg="var(--ink)">Ждут вас</SectionTitle>
            <div className="flex flex-col gap-3">
              {wait.map(t => (
                <TaskCard key={t.ticket_id} ticket={t} kind="wait" onOpen={() => onOpenObject(t.object_id)} />
              ))}
            </div>
          </>
        )}

        {done.length > 0 && (
          <>
            <SectionTitle icon={<Check className="w-5 h-5" />} bg="var(--gns)" fg="var(--gnt)">Готово</SectionTitle>
            <div className="flex flex-col gap-3">
              {done.map(t => (
                <TaskCard key={t.ticket_id} ticket={t} kind="done" onOpen={() => onOpenObject(t.object_id)} />
              ))}
            </div>
          </>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-[12.5px] leading-relaxed text-[var(--mu)] min-w-0">
            Демо: здесь только наряды, которые диспетчер передал бригаде. Статус наряда меняет диспетчер, а отметки по шагам осмотра техник ставит в разделе «Поле».
          </p>
          <button
            type="button"
            onClick={load}
            disabled={busy}
            aria-label="Обновить список нарядов"
            className="shrink-0 min-h-[48px] px-4 rounded-full border font-semibold text-[14px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--sf)', borderColor: 'var(--ln2)', color: 'var(--ink)' }}
          >
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>
      </div>
    </div>
  );
};

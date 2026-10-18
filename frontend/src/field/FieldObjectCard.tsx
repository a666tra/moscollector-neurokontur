import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Bell, Check, Lock, Navigation, ArrowRight,
  ClipboardList, AlertCircle, Eye, Wrench, ShieldAlert
} from 'lucide-react';
import { ObjectItem, PredictionItem, MaintenanceTicket } from '../types';
import { plainReason, cleanName } from '../lib/plain';
import { useToast } from '../lib/toast';

interface Props {
  object: ObjectItem;
  highestPred?: PredictionItem;
  ticket?: MaintenanceTicket;
  pct: number;
  distanceText: string;
  step: number; // 0 = Не начато, 1 = В пути, 2 = На месте, 3 = Проверено
  onStepChange: (step: number) => void;
  checklistState: boolean[];
  onChecklistToggle: (index: number) => void;
  onBack: () => void;
  onNextObject: () => void;
  onOpenTickets: (objectId?: string) => void;
  onSendHelp: () => void;
  helpSent: boolean;
  isOffline: boolean;
}

export const FieldObjectCard: React.FC<Props> = ({
  object,
  highestPred,
  ticket,
  pct,
  distanceText,
  step,
  onStepChange,
  checklistState,
  onChecklistToggle,
  onBack,
  onNextObject,
  onOpenTickets,
  onSendHelp,
  helpSent,
  isOffline,
}) => {
  const toast = useToast();
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  // Generate checklist tasks from telemetry factors
  const tasks = React.useMemo(() => {
    const list: Array<{ title: string; sub: string; icon: string }> = [];
    const factors = highestPred?.explanation_factors || [];

    for (const factor of factors) {
      if (/Дребезг/i.test(factor)) {
        list.push({ title: 'Зачистить контакты', sub: 'Дребезг контактов датчика', icon: 'wrench' });
      } else if (/Сброс часов/i.test(factor)) {
        list.push({ title: 'Сверить часы', sub: 'Сброс часов контроллера (1970г)', icon: 'clock' });
      } else if (/Молчание|связь/i.test(factor)) {
        list.push({ title: 'Проверить кабель', sub: 'Пропадает связь с СМВУ', icon: 'link' });
      } else if (/метан|газ/i.test(factor)) {
        list.push({ title: 'Проверить датчик метана и вентиляцию', sub: 'Зафиксировано превышение газа', icon: 'alert' });
      } else if (/темп/i.test(factor)) {
        list.push({ title: 'Осмотреть кабель и температурный датчик', sub: 'Рост температуры', icon: 'alert' });
      } else if (/питани/i.test(factor)) {
        list.push({ title: 'Замерить напряжение и контакты питания', sub: 'Питание датчика', icon: 'wrench' });
      }
    }

    if (list.length === 0) {
      if (object.risk_level === 'NORMAL') {
        list.push({ title: 'Осмотреть при обходе', sub: 'Плановое наблюдение; выезд не требуется', icon: 'eye' });
      } else {
        list.push({ title: 'Визуальный осмотр оборудования и колодцев', sub: 'По регламенту ТО Москоллектора', icon: 'eye' });
        list.push({ title: 'Проверка целостности пломб и шкафа СМВУ', sub: 'Диагностика оборудования на объекте', icon: 'wrench' });
      }
    } else if (list.length === 1) {
      list.push({ title: 'Визуальный осмотр оборудования и колодцев', sub: 'По регламенту ТО Москоллектора', icon: 'eye' });
    }

    return list;
  }, [highestPred, object.risk_level]);

  const doneCount = tasks.filter((_, i) => checklistState[i] === true).length;
  const totalCount = tasks.length;
  const allChecked = doneCount === totalCount;
  const isOnSite = step >= 2;

  const handleMainAction = () => {
    if (step === 0) {
      // Step 0 -> Step 1 (Еду на объект -> В пути)
      onStepChange(1);
      toast(isOffline ? 'Выехали на объект (записано офлайн)' : 'Выехали на объект', 'info');
    } else if (step === 1) {
      // Step 1 -> Step 2 (В пути -> Вы на месте)
      onStepChange(2);
      toast(`Вы на месте: ${object.name}`, 'success');
    } else if (step === 2) {
      // Step 2 -> Step 3 (Чек-лист -> Завершить заявку)
      if (!allChecked) {
        toast('Сначала отметьте все шаги', 'info');
        return;
      }
      onStepChange(3);
      setCelebrating(true);
      setTimeout(() => {
        setCelebrating(false);
        onNextObject();
      }, 1700);
    } else if (step === 3) {
      // Step 3 -> Advance to next
      onNextObject();
    }
  };

  const isCritical = object.risk_level === 'CRITICAL';
  const isWarning = object.risk_level === 'WARNING';
  const isDone = step === 3;

  const statusBg = isDone ? 'var(--gns)' : isCritical ? 'var(--rds)' : isWarning ? 'var(--ams)' : 'var(--sf2)';
  const statusFg = isDone ? 'var(--gnt)' : isCritical ? 'var(--rdt)' : isWarning ? 'var(--amt)' : 'var(--mu)';
  const statusDot = isDone ? 'var(--gn)' : isCritical ? 'var(--rd)' : isWarning ? 'var(--am)' : 'var(--mu)';
  const statusText = isDone ? 'Выполнена' : isCritical ? 'Срочно проверить' : isWarning ? 'Проверить скоро' : 'Наблюдать';

  const placeParts = [object.route_name, object.corridor, object.picket].filter(Boolean);
  const place = placeParts.join(' · ') || 'Коллекторная сеть Москвы';

  return (
    <div className="relative flex-1 min-h-0 flex flex-col justify-between overflow-hidden bg-[var(--sf)]">
      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-4">
        {/* Header navigation bar */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[48px] px-2 -ml-2 rounded-xl flex items-center gap-1.5 text-[15px] font-semibold text-[var(--ac)] bg-transparent border-0 cursor-pointer hover:opacity-80 transition-opacity"
            aria-label="Вернуться к списку объектов"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Все</span>
          </button>

          {ticket ? (
            <button
              type="button"
              onClick={() => onOpenTickets(object.object_id)}
              className="min-h-[40px] px-3.5 rounded-full flex items-center gap-1.5 text-xs font-semibold border cursor-pointer transition-colors"
              style={{
                background: ticket.status === 'НАЗНАЧЕН' ? 'var(--ams)' : 'var(--acs)',
                color: ticket.status === 'НАЗНАЧЕН' ? 'var(--amt)' : 'var(--ac)',
                borderColor: 'transparent',
              }}
              title="Открыть наряд в разделе заявок"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Заявка {ticket.ticket_id.slice(-6)}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => toast('Диспетчер ещё не назначил эту заявку', 'info')}
              className="min-h-[40px] px-3 rounded-full flex items-center gap-1.5 text-xs font-medium border cursor-pointer"
              style={{
                background: 'var(--sf2)',
                color: 'var(--mu)',
                borderColor: 'var(--ln)',
              }}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Заявка не назначена</span>
            </button>
          )}
        </div>

        {/* Object Header: Status pill + Object Title + Big Percentage */}
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold"
              style={{ background: statusBg, color: statusFg }}
            >
              <i className="w-2 h-2 rounded-full shrink-0" style={{ background: statusDot }} />
              {statusText}
            </span>

            <h1 className="serif font-normal text-[26px] sm:text-[30px] leading-[1.1] text-[var(--ink)] mt-2.5 mb-1 break-words">
              {object.name}
            </h1>

            <div className="text-[13.5px] font-medium text-[var(--mu)] break-words">
              {place}
            </div>
          </div>

          <div className="text-right shrink-0">
            <div
              className="serif font-normal text-[44px] sm:text-[52px] leading-none"
              style={{ color: isDone ? 'var(--gnt)' : isCritical ? 'var(--rdt)' : 'var(--amt)' }}
            >
              {pct}<span className="text-[20px] font-sans font-light">%</span>
            </div>
            <div className="text-[13.5px] font-semibold text-[var(--ac)] mt-1">
              {distanceText}
            </div>
          </div>
        </div>

        {/* 3-Step Progress Bar */}
        <div className="grid grid-cols-3 gap-1.5 shrink-0 pt-1">
          {[
            { label: 'В пути', idx: 1 },
            { label: 'На месте', idx: 2 },
            { label: 'Проверено', idx: 3 },
          ].map(s => {
            const isCompleted = step >= s.idx;
            const isCurrent = step === s.idx - 1;
            return (
              <div key={s.idx} className="text-center">
                <i
                  className="block h-2 rounded-full transition-all duration-300"
                  style={{ background: isCompleted ? 'var(--gn)' : 'var(--ln2)' }}
                />
                <span
                  className="block text-[12px] mt-1.5 font-medium transition-colors"
                  style={{
                    color: isCompleted ? 'var(--ink)' : isCurrent ? 'var(--ac)' : 'var(--mu)',
                    fontWeight: isCompleted || isCurrent ? 700 : 500,
                  }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Telemetry info & Reasons */}
        <div className="rounded-2xl p-3.5 flex flex-col gap-2 shrink-0" style={{ background: 'var(--sf2)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--mu)]">
              Что происходит:
            </span>
            {(object.predicted_failures_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--rds)] text-[var(--rdt)]">
                {object.predicted_failures_count} датч.
              </span>
            )}
          </div>

          {highestPred ? (
            <div className="text-[14px] leading-snug flex flex-col gap-1.5 text-[var(--ink)]">
              <div className="font-semibold">
                Датчик: {cleanName(highestPred.sensor_name)}
              </div>
              {highestPred.explanation_factors && highestPred.explanation_factors.length > 0 && (
                <ul className="list-disc list-inside space-y-1 text-[13.5px] text-[var(--ink)]">
                  {highestPred.explanation_factors.slice(0, 3).map((f, i) => (
                    <li key={i} className="leading-snug">
                      <span className="font-medium">{plainReason(f)}</span>
                      <span className="text-[var(--mu)] text-xs ml-1">({f})</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="text-[12.5px] text-[var(--mu)]">
                Риск отклонения в телеметрии в ближайшие 1–3 дня.
              </div>
            </div>
          ) : (
            <p className="text-[14px] text-[var(--ink)] m-0">
              {object.risk_level === 'NORMAL'
                ? 'Отклонений не зафиксировано, датчики в норме'
                : 'Требуется плановая проверка оборудования'}
            </p>
          )}
        </div>

        {/* Checklist header & items */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--mu)]">
              Шаги осмотра ({doneCount} из {totalCount}):
            </span>
            <div className="flex items-center gap-1.5" aria-label={`Сделано ${doneCount} из ${totalCount}`}>
              {tasks.map((_, i) => (
                <i
                  key={i}
                  className="w-3 h-3 rounded-full transition-colors"
                  style={{ background: checklistState[i] ? 'var(--gn)' : 'var(--ln2)' }}
                />
              ))}
            </div>
          </div>

          {/* Checklist buttons */}
          <div
            className="flex flex-col gap-2 transition-opacity"
            style={{
              opacity: isOnSite ? 1 : 0.6,
              pointerEvents: isOnSite ? 'auto' : 'none',
            }}
          >
            {tasks.map((t, idx) => {
              const checked = checklistState[idx] === true;
              return (
                <button
                  key={idx}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => onChecklistToggle(idx)}
                  className="w-full min-h-[68px] p-3 rounded-2xl border-2 flex items-center gap-3 text-left transition-all active:scale-[0.99] cursor-pointer"
                  style={{
                    background: checked ? 'var(--gns)' : 'var(--sf)',
                    borderColor: checked ? 'var(--gn)' : 'var(--ln)',
                  }}
                >
                  <span
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: checked ? 'var(--gn)' : 'var(--sf2)',
                      color: checked ? '#fff' : 'var(--mu)',
                    }}
                  >
                    {t.icon === 'wrench' ? <Wrench className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </span>

                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span
                      className="font-bold text-[15px] sm:text-[16px] leading-tight text-[var(--ink)]"
                      style={{ textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.8 : 1 }}
                    >
                      {t.title}
                    </span>
                    <span className="text-[12.5px] text-[var(--mu)] leading-snug">
                      {t.sub}
                    </span>
                  </span>

                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0 transition-transform"
                    style={{
                      borderColor: checked ? 'var(--gn)' : 'var(--ln2)',
                      background: checked ? 'var(--gn)' : 'transparent',
                      transform: checked ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {checked && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          {!isOnSite && (
            <div className="flex items-center justify-center gap-2 py-1 text-sm font-semibold text-[var(--mu)]">
              <Lock className="w-4 h-4" />
              <span>Чек-лист откроется, когда вы будете на месте</span>
            </div>
          )}

          {helpSent && (
            <div
              role="status"
              className="rounded-2xl p-3 flex items-center gap-2.5 font-semibold text-sm"
              style={{ background: 'var(--ams)', color: 'var(--amt)' }}
            >
              <Bell className="w-5 h-5 shrink-0" />
              <span>SOS отправлен диспетчеру</span>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div
        className="shrink-0 p-3.5 sm:p-4 border-t flex items-center gap-2.5 z-10"
        style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}
      >
        <button
          type="button"
          onClick={handleMainAction}
          className="flex-1 min-w-0 min-h-[64px] px-5 rounded-2xl font-bold text-[17px] sm:text-[18px] flex items-center justify-center gap-2.5 border-0 cursor-pointer shadow-md transition-all active:scale-[0.98]"
          style={
            step === 0
              ? { background: 'var(--ac)', color: 'var(--onac, #fff)' }
              : step === 1
              ? { background: 'var(--ac)', color: 'var(--onac, #fff)' }
              : step === 2
              ? allChecked
                ? { background: 'var(--gn)', color: '#fff' }
                : { background: 'var(--sf2)', color: 'var(--mu)', cursor: 'default' }
              : { background: 'var(--ink)', color: 'var(--bg)' }
          }
        >
          {step === 0 && (
            <>
              <Navigation className="w-6 h-6 shrink-0" />
              <span>Еду на объект</span>
            </>
          )}
          {step === 1 && (
            <>
              <Navigation className="w-6 h-6 shrink-0 animate-pulse" />
              <span>В пути… (нажмите: «Вы на месте»)</span>
            </>
          )}
          {step === 2 && (
            <>
              {allChecked ? (
                <>
                  <Check className="w-6 h-6 shrink-0" strokeWidth={3} />
                  <span>Завершить заявку</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 shrink-0" />
                  <span>Отметьте шаги · {doneCount}/{totalCount}</span>
                </>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <span>Следующий объект</span>
              <ArrowRight className="w-6 h-6 shrink-0" />
            </>
          )}
        </button>

        {/* SOS Button */}
        <button
          type="button"
          onClick={() => setHelpModalOpen(true)}
          aria-label="Позвать диспетчера на помощь"
          className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 border-2 cursor-pointer transition-transform active:scale-95 shrink-0"
          style={{
            background: 'var(--ams)',
            borderColor: 'var(--am)',
            color: 'var(--amt)',
          }}
        >
          <Bell className="w-6 h-6 shrink-0" />
          <span className="font-extrabold text-[11px] tracking-wider leading-none">SOS</span>
        </button>
      </div>

      {/* Help Modal */}
      {helpModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'oklch(0.12 0.02 260 / 0.6)' }}
          onClick={() => setHelpModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            className="w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl"
            style={{ background: 'var(--sf)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--ams)] text-[var(--amt)] shrink-0">
                <Bell className="w-6 h-6" />
              </span>
              <h2 id="help-title" className="text-[20px] font-bold text-[var(--ink)] m-0">
                Позвать на помощь?
              </h2>
            </div>

            <p className="text-[15px] leading-relaxed text-[var(--mu)] m-0">
              Диспетчер получит сообщение: <b className="text-[var(--ink)]">«{object.name} — нужна помощь»</b>. Положение на карте условное.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setHelpModalOpen(false)}
                className="flex-1 min-h-[52px] rounded-xl border font-semibold text-[15px] text-[var(--ink)] bg-[var(--sf)] cursor-pointer"
                style={{ borderColor: 'var(--ln2)' }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  setHelpModalOpen(false);
                  onSendHelp();
                }}
                className="flex-1 min-h-[52px] rounded-xl border-0 font-bold text-[15px] cursor-pointer"
                style={{ background: 'var(--am)', color: '#241a00' }}
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebration Screen */}
      {celebrating && (
        <div
          role="status"
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 animate-[nkUp_0.25s_ease-out]"
          style={{ background: 'var(--gns)' }}
        >
          <span
            className="w-28 h-28 rounded-full flex items-center justify-center shadow-xl animate-[nkPopA_0.6s_cubic-bezier(0.2,1.5,0.4,1)_both]"
            style={{ background: 'var(--gn)', color: '#fff' }}
          >
            <Check className="w-16 h-16" strokeWidth={3.5} />
          </span>
          <div className="serif font-normal text-[36px] text-[var(--gnt)] leading-tight">
            Проверено!
          </div>
          <div className="text-[15px] font-semibold text-[var(--gnt)]">
            Следующий объект…
          </div>
        </div>
      )}
    </div>
  );
};

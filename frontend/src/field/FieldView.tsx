import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, CheckCircle2 } from 'lucide-react';
import { ObjectItem, PredictionItem } from '../types';
import { cleanName, plainReason, LEVEL_TEXT, LEVEL_VAR, LEVEL_SOFT } from '../lib/plain';

interface Props {
  objects: ObjectItem[];
  predictions: PredictionItem[];
  onOpenTickets: () => void;
}

const RISK_WEIGHT: Record<string, number> = {
  CRITICAL: 3,
  WARNING: 2,
  ATTENTION: 1,
  NORMAL: 0,
};

export const FieldView: React.FC<Props> = ({ objects, predictions, onOpenTickets }) => {
  const [showNormal, setShowNormal] = useState(false);

  // Group and sort highest-risk prediction for each object
  const predsByObject = useMemo(() => {
    const map = new Map<string, PredictionItem>();
    for (const p of predictions) {
      const existing = map.get(p.object_id);
      if (!existing) {
        map.set(p.object_id, p);
      } else {
        const curWeight = RISK_WEIGHT[p.risk_level] ?? 0;
        const prevWeight = RISK_WEIGHT[existing.risk_level] ?? 0;
        if (curWeight > prevWeight || (curWeight === prevWeight && (p.failure_probability ?? 0) > (existing.failure_probability ?? 0))) {
          map.set(p.object_id, p);
        }
      }
    }
    return map;
  }, [predictions]);

  // Separate urgent objects (CRITICAL, WARNING, ATTENTION) and normal objects (NORMAL)
  const { urgentObjects, normalObjects } = useMemo(() => {
    const urgent: ObjectItem[] = [];
    const normal: ObjectItem[] = [];

    for (const obj of objects) {
      if (obj.risk_level === 'CRITICAL' || obj.risk_level === 'WARNING' || obj.risk_level === 'ATTENTION') {
        urgent.push(obj);
      } else {
        normal.push(obj);
      }
    }

    urgent.sort((a, b) => {
      const wa = RISK_WEIGHT[a.risk_level] ?? 0;
      const wb = RISK_WEIGHT[b.risk_level] ?? 0;
      if (wb !== wa) return wb - wa;
      return (b.predicted_failures_count ?? 0) - (a.predicted_failures_count ?? 0);
    });

    normal.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    return { urgentObjects: urgent, normalObjects: normal };
  }, [objects]);

  const renderCard = (obj: ObjectItem) => {
    const highestPred = predsByObject.get(obj.object_id);
    const riskLevel = obj.risk_level || 'NORMAL';
    const label = LEVEL_TEXT[riskLevel] || LEVEL_TEXT.NORMAL;
    const color = LEVEL_VAR[riskLevel] || LEVEL_VAR.NORMAL;
    const bg = LEVEL_SOFT[riskLevel] || LEVEL_SOFT.NORMAL;

    const placeParts = [obj.route_name, obj.corridor, obj.picket].filter(Boolean);
    const place = placeParts.join(' · ');

    const whatToDo = highestPred?.recommended_action
      || (obj.risk_level === 'NORMAL' ? 'Плановое наблюдение; выезд не требуется.' : 'Провести визуальный осмотр оборудования и колодцев.');

    const factorBullets = highestPred?.explanation_factors
      ? highestPred.explanation_factors.slice(0, 2).map((factor, idx) => (
          <li key={idx} className="leading-snug">
            {plainReason(factor)}
          </li>
        ))
      : null;

    return (
      <article
        key={obj.object_id}
        className="w-full rounded-2xl border p-3.5 sm:p-4 flex flex-col gap-2.5 shadow-sm min-w-0 overflow-hidden"
        style={{
          background: 'var(--sf)',
          borderColor: 'var(--ln)',
          borderLeftWidth: '5px',
          borderLeftColor: color,
        }}
      >
        {/* Status badge + Place info */}
        <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-[14px] sm:text-[15px] leading-none shrink-0"
            style={{
              background: bg,
              color,
            }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            {label}
          </span>
          {place && (
            <span className="text-[13px] sm:text-[14px] font-medium break-words text-right flex-1 min-w-[120px]" style={{ color: 'var(--mut)' }}>
              {place}
            </span>
          )}
        </div>

        {/* Object Name */}
        <h2 className="text-[18px] sm:text-[19px] font-bold leading-tight break-words" style={{ color: 'var(--ink)' }}>
          {obj.name}
        </h2>

        {/* Что происходит */}
        <div
          className="rounded-xl p-2.5 sm:p-3 flex flex-col gap-1 min-w-0"
          style={{ background: 'var(--sf2)' }}
        >
          <span className="text-[16px] font-bold" style={{ color: 'var(--mut)' }}>
            Что происходит:
          </span>
          {highestPred ? (
            <div className="text-[15px] leading-snug font-medium flex flex-col gap-1 break-words" style={{ color: 'var(--ink)' }}>
              <div>Датчик: {cleanName(highestPred.sensor_name)}</div>
              {factorBullets && factorBullets.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5">
                  {factorBullets}
                </ul>
              )}
              <div>Риск поломки в ближайшие 1–3 дня.</div>
              {(obj.predicted_failures_count ?? 0) > 1 && (
                <div>Проблемных датчиков на объекте: {obj.predicted_failures_count}</div>
              )}
            </div>
          ) : (
            <p className="text-[15px] leading-snug font-medium break-words" style={{ color: 'var(--ink)' }}>
              {obj.risk_level === 'NORMAL'
                ? 'Отклонений не зафиксировано, датчики в норме'
                : 'Требуется плановая проверка объекта'}
            </p>
          )}
        </div>

        {/* Что сделать */}
        <div
          className="rounded-xl p-2.5 sm:p-3 flex flex-col gap-1 min-w-0"
          style={{ background: 'var(--sf2)' }}
        >
          <span className="text-[16px] font-bold" style={{ color: 'var(--mut)' }}>
            Что сделать:
          </span>
          <p className="text-[15px] leading-snug font-medium break-words" style={{ color: 'var(--ink)' }}>
            {whatToDo}
          </p>
        </div>

        {/* Button «Открыть заявку» */}
        <button
          type="button"
          onClick={onOpenTickets}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl font-semibold text-[15px] sm:text-[16px] flex items-center justify-center gap-2 border transition-colors active:scale-[0.99]"
          style={{
            background: 'var(--sf)',
            borderColor: 'var(--ln2)',
            color: 'var(--ink)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: 'var(--ac)' }} />
          <span>Открыть заявку</span>
        </button>
      </article>
    );
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden px-3.5 sm:px-4 pt-[70px] pb-20 lg:pt-6 lg:pb-8">
      <div className="w-full max-w-[760px] mx-auto flex flex-col gap-3.5 sm:gap-5 min-w-0">
        {/* Header */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
            <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
              Обход объектов
            </h1>
            <span
              className="text-[14px] sm:text-[16px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0"
              style={{ background: 'var(--sf2)', color: 'var(--mut)', borderColor: 'var(--ln)' }}
            >
              {urgentObjects.length > 0 ? `Требуют выезда: ${urgentObjects.length}` : 'Все в норме'}
            </span>
          </div>
          <p className="text-[14px] sm:text-[16px] leading-snug" style={{ color: 'var(--mut)' }}>
            Список коллекторов и камер в порядке срочности проверки.
          </p>
        </div>

        {/* Empty state or Urgent list */}
        {urgentObjects.length === 0 ? (
          <div
            className="rounded-2xl border p-6 flex items-center gap-4 shadow-sm"
            style={{ background: 'var(--oks)', borderColor: 'var(--ok)' }}
          >
            <CheckCircle2 className="w-8 h-8 shrink-0" style={{ color: 'var(--ok)' }} />
            <p className="text-[17px] font-semibold" style={{ color: 'var(--ink)' }}>
              Сейчас всё спокойно. Объектов, требующих выезда, нет.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {urgentObjects.map(renderCard)}
          </div>
        )}

        {/* Collapsed section: Остальные объекты (N) */}
        {normalObjects.length > 0 && (
          <div className="flex flex-col gap-4 mt-2">
            <button
              type="button"
              onClick={() => setShowNormal(!showNormal)}
              className="w-full min-h-[48px] px-4 py-3.5 rounded-2xl border font-semibold text-[16px] flex items-center justify-between gap-3 shadow-sm transition-colors"
              style={{ background: 'var(--sf)', borderColor: 'var(--ln)', color: 'var(--ink)' }}
              aria-expanded={showNormal}
            >
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--ok)' }} />
                <span>Остальные объекты ({normalObjects.length})</span>
              </span>
              {showNormal ? (
                <ChevronUp className="w-5 h-5 shrink-0" style={{ color: 'var(--mut)' }} />
              ) : (
                <ChevronDown className="w-5 h-5 shrink-0" style={{ color: 'var(--mut)' }} />
              )}
            </button>

            {showNormal && (
              <div className="flex flex-col gap-4 pl-1">
                {normalObjects.map(renderCard)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

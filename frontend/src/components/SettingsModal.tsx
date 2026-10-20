import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  Save,
  Shield,
  Cpu,
  Eye,
  Check,
  Flame,
  Clock,
  Activity,
  Truck,
  Wrench,
} from 'lucide-react';
import { SystemSettings, PredictionItem } from '../types';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { api } from '../lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_SETTINGS: SystemSettings = {
  decision_threshold: 0.42,
  chatter_window_seconds: 90,
  chatter_min_flips: 5,
  gas_warning_threshold_vol_pct: 1.0,
  callout_cost_rub: 18500,
  preventive_cost_rub: 3200,
  require_dispatcher_confirmation: true,
  auto_suppress_chatter: false,
  selected_model: 'champion_lightgbm',
};

// Reusable real draggable slider component (mouse drag, touch drag, keyboard arrows, aria)
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
}

const DraggableSlider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  formatValue = (v) => v.toString(),
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const updateFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      let v = min + p * (max - min);
      v = Math.round(v / step) * step;
      v = Math.max(min, Math.min(max, v));
      // Fix float rounding
      const decimals = step.toString().split('.')[1]?.length || 0;
      v = parseFloat(v.toFixed(decimals));
      onChange(v);
    },
    [min, max, step, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(true);
    updateFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      updateFromPointer(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;

    if (delta !== 0) {
      e.preventDefault();
      let v = value + delta;
      v = Math.max(min, Math.min(max, v));
      const decimals = step.toString().split('.')[1]?.length || 0;
      v = parseFloat(v.toFixed(decimals));
      onChange(v);
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={formatValue(value)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className="relative h-12 flex items-center cursor-ew-resize select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] rounded-full px-2"
    >
      {/* Background track */}
      <span
        className="absolute left-0 right-0 h-3 rounded-full transition-colors"
        style={{ background: 'var(--ln2)' }}
      />
      {/* Filled progress track */}
      <span
        className="absolute left-0 h-3 rounded-full"
        style={{
          width: `${pct}%`,
          background: 'var(--ac)',
          transition: isDragging ? 'none' : 'width 0.15s ease-out',
        }}
      />
      {/* Thumb knob */}
      <span
        className="absolute top-1/2 w-8 h-8 -mt-4 -ml-4 rounded-full border-4 shadow-md transition-transform"
        style={{
          left: `${pct}%`,
          background: 'var(--sf)',
          borderColor: 'var(--ac)',
          transform: isDragging ? 'scale(1.2)' : 'scale(1)',
          transition: isDragging ? 'transform 0.15s' : 'left 0.15s ease-out, transform 0.15s',
        }}
      />
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { requireDispatcher } = useSession();
  const toast = useToast();

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [defaultSettings, setDefaultSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [holdoutRocAuc, setHoldoutRocAuc] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  // Server-side totals: the list holds only the top-500 channels by risk, the counts cover all channels
  const [predMeta, setPredMeta] = useState<{ total: number; activeCount: number; activeThr: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      api<SystemSettings>('/api/settings/defaults')
        .then((defs) => {
          if (defs) setDefaultSettings((prev) => ({ ...prev, ...defs }));
        })
        .catch(() => {});

      api<SystemSettings>('/api/settings')
        .then((data) => {
          setSettings((prev) => ({ ...prev, ...data }));
          setDefaultSettings((prev) => ({
            ...prev,
            chatter_window_seconds: data.chatter_window_seconds ?? prev.chatter_window_seconds,
            chatter_min_flips: data.chatter_min_flips ?? prev.chatter_min_flips,
            decision_threshold: data.decision_threshold ?? prev.decision_threshold,
            callout_cost_rub: data.callout_cost_rub ?? prev.callout_cost_rub,
            preventive_cost_rub: data.preventive_cost_rub ?? prev.preventive_cost_rub,
          }));
        })
        .catch(() => {});

      api<{ model_comparison?: { champion_lightgbm?: { roc_auc?: number } } }>('/api/predictions/metrics')
        .then((data) => {
          const auc = data?.model_comparison?.champion_lightgbm?.roc_auc;
          if (typeof auc === 'number') {
            setHoldoutRocAuc(auc);
          }
        })
        .catch(() => {});

      api<{
        items: PredictionItem[];
        total?: number;
        critical_count?: number;
        warning_count?: number;
        active_threshold?: number;
      }>('/api/predictions?limit=500')
        .then((data) => {
          if (data?.items) {
            setPredictions(data.items);
            if (
              typeof data.total === 'number' &&
              typeof data.critical_count === 'number' &&
              typeof data.warning_count === 'number' &&
              typeof data.active_threshold === 'number'
            ) {
              setPredMeta({
                total: data.total,
                activeCount: data.critical_count + data.warning_count,
                activeThr: data.active_threshold,
              });
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const d = await requireDispatcher();
    if (!d) return;

    setLoading(true);
    try {
      await api('/api/settings', {
        method: 'POST',
        json: {
          ...settings,
          dispatcher_badge: d.badge,
          dispatcher_pin: d.pin,
        },
      });
      toast('Параметры и пороги успешно обновлены', 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      toast(err?.message || 'Ошибка сохранения (требуются права Главного инженера)', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
  };

  // Preview of channels queue count
  const probabilityOf = (p: PredictionItem): number => {
    if (typeof p.raw_model_score === 'number') return p.raw_model_score;
    if (typeof p.failure_probability === 'number') return p.failure_probability;
    return 0;
  };

  const totalChannels = predMeta?.total ?? (predictions.length > 0 ? predictions.length : null);
  // Exact count where the data allows it; otherwise a lower bound ("≥ N"); never invented numbers
  const queue = (() => {
    if (predictions.length === 0) return null;
    const thr = settings.decision_threshold;
    if (predMeta && Math.abs(thr - predMeta.activeThr) < 1e-6) {
      return { n: predMeta.activeCount, approx: false };
    }
    const n = predictions.filter((p) => probabilityOf(p) >= thr).length;
    const minShown = Math.min(...predictions.map(probabilityOf));
    const complete = !predMeta || predictions.length >= predMeta.total;
    return { n, approx: !complete && thr < minShown };
  })();
  const inQueueText = queue ? `${queue.approx ? '≥ ' : ''}${queue.n}` : '—';
  const isTopOnly = predMeta ? predictions.length < predMeta.total : false;

  // Histogram of real per-channel risk scores (40 bins over 0.10..0.90; values outside are clamped to the edge bins)
  const HIST_BINS = 40;
  const histogram = (() => {
    if (predictions.length === 0) return null;
    const counts = new Array<number>(HIST_BINS).fill(0);
    predictions.forEach((p) => {
      const idx = Math.floor(((probabilityOf(p) - 0.1) / 0.8) * HIST_BINS);
      counts[Math.max(0, Math.min(HIST_BINS - 1, idx))] += 1;
    });
    const maxCount = Math.max(...counts, 1);
    return counts.map((c, i) => ({
      h: c === 0 ? 0 : Math.max(2, Math.round((c / maxCount) * 76)),
      active: 0.1 + ((i + 0.5) / HIST_BINS) * 0.8 >= settings.decision_threshold,
    }));
  })();
  const tauLabel = settings.decision_threshold.toFixed(2).replace('.', ',');

  // 3 Preset buttons under decision threshold
  // Presets: Все (lowest 0.30) / Норма (0.42 / WARNING) / Главные (0.60 / CRITICAL)
  const presets = [
    { label: 'Все', value: 0.3, icon: Eye, sub: 'низкий порог (0.30)' },
    { label: 'Норма', value: 0.42, icon: Check, sub: 'базовый порог (0.42)' },
    { label: 'Главные', value: 0.6, icon: Flame, sub: 'строгий порог (0.60)' },
  ];

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'oklch(0.12 0.02 260 / .65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Настройки"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[580px] max-h-[92vh] flex flex-col rounded-t-[26px] sm:rounded-[28px] overflow-hidden shadow-2xl animate-in fade-in duration-200"
        style={{
          background: 'var(--sf)',
          color: 'var(--ink)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--ln)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--acs)', color: 'var(--ac)' }}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </span>
            <div>
              <h2 className="serif text-xl sm:text-2xl font-normal leading-none text-[var(--ink)] m-0">
                Настройки
              </h2>
              <p className="text-xs text-[var(--mu)] mt-0.5 m-0">
                Параметры и пороги предиктивного контура
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors cursor-pointer hover:bg-[var(--sf2)]"
            style={{ borderColor: 'var(--ln)', color: 'var(--ink)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-w-0">
          {/* Model info card with mandatory labeled 0.771 */}
          <div
            className="rounded-[20px] p-3.5 sm:p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0"
            style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Cpu className="w-5 h-5 text-[var(--ac)] shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-xs sm:text-sm text-[var(--ink)] block">
                  Модель: LightGBM (чемпион)
                </span>
                <span className="text-[11px] text-[var(--mu)] block">
                  статический бинарный классификатор
                </span>
              </div>
            </div>

            <div className="flex flex-wrap max-w-full">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-[var(--sf)] border text-[var(--ac)] text-left sm:text-right max-w-full whitespace-normal break-words"
                style={{ borderColor: 'var(--ln)' }}
              >
                ROC-AUC {holdoutRocAuc !== null ? holdoutRocAuc.toFixed(3) : '0.771'} — отложенная выборка (январь)
              </span>
            </div>
          </div>

          {/* Group 1: Queue threshold (tau) with live preview */}
          <div
            className="rounded-[22px] p-4 sm:p-5 border flex flex-col gap-3 min-w-0"
            style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ background: 'var(--rd)' }}
                >
                  <Eye className="w-4 h-4" />
                </span>
                <div>
                  <span className="font-bold text-sm sm:text-base text-[var(--ink)] block">
                    Что попадёт в очередь
                  </span>
                  <span className="text-[12.5px] text-[var(--mu)] block">
                    {isTopOnly
                      ? `столбики — ${predictions.length} каналов с наивысшим риском`
                      : 'столбики — каналы по оценке риска'}
                  </span>
                </div>
              </div>

              <div className="flex items-baseline gap-1 shrink-0">
                <span className="serif text-3xl sm:text-4xl font-normal num text-[var(--ink)]">
                  {inQueueText}
                </span>
                <span className="text-xs text-[var(--mu)] font-medium">
                  {totalChannels !== null ? `из ${totalChannels}` : ''}
                </span>
              </div>
            </div>

            {/* Queue preview: histogram of real risk scores (placeholder until data arrives) */}
            {histogram ? (
              <div className="px-3 sm:px-[18px] mt-1">
                <div
                  role="img"
                  aria-label={`Распределение оценок риска: в очереди ${inQueueText}${totalChannels !== null ? ` из ${totalChannels}` : ''}`}
                  className="h-[76px] flex items-end gap-[2px]"
                  style={{ borderBottom: '1.5px solid var(--ln2)' }}
                >
                  {histogram.map((b, i) => (
                    <i
                      key={i}
                      className="flex-1 min-w-0 rounded-t-[3px] transition-colors duration-200"
                      style={{ height: `${b.h}px`, background: b.active ? 'var(--rd)' : 'var(--ln2)' }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="h-[76px] flex items-center justify-center text-[12.5px] text-[var(--mu)]"
                style={{ borderBottom: '1.5px solid var(--ln2)' }}
              >
                Оценки риска загружаются…
              </div>
            )}

            {/* Draggable Slider for Tau */}
            <div className="pt-1">
              <div className="flex justify-between items-baseline gap-2 text-[12.5px] text-[var(--mu)] mb-1 px-3 sm:px-[18px] whitespace-nowrap">
                <span>мягкий отбор</span>
                <span className="font-mono font-semibold text-[13px] text-[var(--ink)]">
                  порог {tauLabel}
                </span>
                <span>строгий отбор</span>
              </div>
              <DraggableSlider
                label="Порог риска очереди диспетчера"
                value={settings.decision_threshold}
                min={0.1}
                max={0.9}
                step={0.01}
                formatValue={(v) => v.toFixed(2)}
                onChange={(val) => setSettings({ ...settings, decision_threshold: val })}
              />
            </div>

            {/* Preset Buttons: Все / Норма / Главные */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {presets.map((p) => {
                const IconComp = p.icon;
                const isSelected = Math.abs(settings.decision_threshold - p.value) < 0.02;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setSettings({ ...settings, decision_threshold: p.value })}
                    className="min-h-[58px] p-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                    style={{
                      background: isSelected ? 'var(--acs)' : 'var(--sf)',
                      borderColor: isSelected ? 'var(--ac)' : 'var(--ln2)',
                      color: 'var(--ink)',
                    }}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-center gap-1.5">
                      <IconComp className="w-4 h-4 text-[var(--ac)]" />
                      <span className="font-bold text-xs sm:text-sm">{p.label}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--mu)]">
                      {p.value.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-[var(--mu)] leading-relaxed m-0 pt-1">
              Меняет только список проверки диспетчера. Уровни объектов на карте считаются по
              калиброванной вероятности и этим порогом не меняются.
            </p>
          </div>

          {/* Group 2: Chatter Filter Sliders */}
          <div
            className="rounded-[22px] p-4 sm:p-5 border flex flex-col gap-3.5 min-w-0"
            style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ background: 'var(--ac)' }}
              >
                <Activity className="w-4 h-4" />
              </span>
              <span className="font-bold text-sm sm:text-base text-[var(--ink)]">
                Дребезг контактов
              </span>
            </div>

            {/* Slider 1: Chatter Window Seconds */}
            <div
              className="rounded-[18px] p-3 sm:p-4 border flex flex-col gap-1 bg-[var(--sf)]"
              style={{ borderColor: 'var(--ln)' }}
            >
              <div className="flex justify-between items-center px-1">
                <span className="text-xs sm:text-sm text-[var(--mu)] flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Окно анализа, сек
                </span>
                <span className="serif text-2xl font-normal num text-[var(--ink)]">
                  {settings.chatter_window_seconds}
                </span>
              </div>
              <DraggableSlider
                label="Окно анализа дребезга контактов"
                value={settings.chatter_window_seconds}
                min={10}
                max={300}
                step={10}
                onChange={(val) => setSettings({ ...settings, chatter_window_seconds: val })}
              />
            </div>

            {/* Slider 2: Chatter Min Flips */}
            <div
              className="rounded-[18px] p-3 sm:p-4 border flex flex-col gap-1 bg-[var(--sf)]"
              style={{ borderColor: 'var(--ln)' }}
            >
              <div className="flex justify-between items-center px-1">
                <span className="text-xs sm:text-sm text-[var(--mu)] flex items-center gap-1.5">
                  <Activity className="w-4 h-4" /> Порог срабатываний
                </span>
                <span className="serif text-2xl font-normal num text-[var(--ink)]">
                  {settings.chatter_min_flips}
                </span>
              </div>
              <DraggableSlider
                label="Порог микро-срабатываний дребезга"
                value={settings.chatter_min_flips}
                min={1}
                max={20}
                step={1}
                onChange={(val) => setSettings({ ...settings, chatter_min_flips: val })}
              />
            </div>
          </div>

          {/* Group 3: Cost Norms Sliders */}
          <div
            className="rounded-[22px] p-4 sm:p-5 border flex flex-col gap-3.5 min-w-0"
            style={{ background: 'var(--sf2)', borderColor: 'var(--ln)' }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ background: 'oklch(0.55 0.02 260)' }}
              >
                <Truck className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-sm sm:text-base text-[var(--ink)] block">
                  Нормативы сценарных затрат
                </span>
                <span className="text-[11px] text-[var(--mu)] block">
                  справочные нормативы затрат, не прямая экономия
                </span>
              </div>
            </div>

            {/* Slider 1: Emergency Callout Cost */}
            <div
              className="rounded-[18px] p-3 sm:p-4 border flex flex-col gap-1 bg-[var(--sf)]"
              style={{ borderColor: 'var(--ln)' }}
            >
              <div className="flex justify-between items-center px-1">
                <span className="text-xs sm:text-sm text-[var(--mu)] flex items-center gap-1.5">
                  <Truck className="w-4 h-4" /> Аварийный выезд бригады, ₽
                </span>
                <span className="serif text-xl sm:text-2xl font-normal num text-[var(--ink)]">
                  {settings.callout_cost_rub.toLocaleString('ru-RU')}
                </span>
              </div>
              <DraggableSlider
                label="Норматив стоимости аварийного выезда"
                value={settings.callout_cost_rub}
                min={500}
                max={50000}
                step={500}
                formatValue={(v) => `${v.toLocaleString('ru-RU')} ₽`}
                onChange={(val) => setSettings({ ...settings, callout_cost_rub: val })}
              />
            </div>

            {/* Slider 2: Preventive Maintenance Cost */}
            <div
              className="rounded-[18px] p-3 sm:p-4 border flex flex-col gap-1 bg-[var(--sf)]"
              style={{ borderColor: 'var(--ln)' }}
            >
              <div className="flex justify-between items-center px-1">
                <span className="text-xs sm:text-sm text-[var(--mu)] flex items-center gap-1.5">
                  <Wrench className="w-4 h-4" /> Плановое ТО/ППР датчика, ₽
                </span>
                <span className="serif text-xl sm:text-2xl font-normal num text-[var(--ink)]">
                  {settings.preventive_cost_rub.toLocaleString('ru-RU')}
                </span>
              </div>
              <DraggableSlider
                label="Норматив стоимости планового ТО"
                value={settings.preventive_cost_rub}
                min={100}
                max={20000}
                step={100}
                formatValue={(v) => `${v.toLocaleString('ru-RU')} ₽`}
                onChange={(val) => setSettings({ ...settings, preventive_cost_rub: val })}
              />
            </div>
          </div>

          {/* Safety rule reminder */}
          <div
            className="rounded-[22px] p-4 border flex items-center gap-3"
            style={{ background: 'var(--ams)', borderColor: 'var(--ln)' }}
          >
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--am)', color: '#241a00' }}
            >
              <Shield className="w-5 h-5" />
            </span>
            <span className="font-semibold text-xs sm:text-sm leading-snug text-[var(--ink)]">
              Отмену выезда решает человек: автоматическая отмена выездов без подтверждения
              оператором запрещена.
            </span>
          </div>
        </div>

        {/* Footer with sticky buttons */}
        <div
          className="flex items-center justify-between p-4 sm:p-5 border-t shrink-0 sticky bottom-0"
          style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}
        >
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[48px] px-4 rounded-full border-0 bg-transparent text-[var(--mu)] font-semibold text-sm flex items-center gap-2 cursor-pointer hover:text-[var(--ink)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Сбросить</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="min-h-[48px] px-6 rounded-full border-0 font-semibold text-sm sm:text-base flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 text-white shadow-md"
            style={{ background: 'var(--ac)' }}
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Сохранение…' : 'Готово'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

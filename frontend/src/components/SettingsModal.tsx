import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, X, RotateCcw, Save, Shield, Cpu } from 'lucide-react';
import { SystemSettings, SystemStats } from '../types';
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { requireDispatcher } = useSession();
  const toast = useToast();

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [defaultSettings, setDefaultSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [holdoutRocAuc, setHoldoutRocAuc] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      api<SystemSettings>('/api/settings/defaults')
        .then(defs => {
          if (defs) setDefaultSettings(prev => ({ ...prev, ...defs }));
        })
        .catch(() => {});

      api<SystemSettings>('/api/settings')
        .then(data => {
          setSettings(prev => ({ ...prev, ...data }));
          setDefaultSettings(prev => ({
            ...prev,
            chatter_window_seconds: data.chatter_window_seconds ?? prev.chatter_window_seconds,
            chatter_min_flips: data.chatter_min_flips ?? prev.chatter_min_flips,
            decision_threshold: data.decision_threshold ?? prev.decision_threshold,
            callout_cost_rub: data.callout_cost_rub ?? prev.callout_cost_rub,
            preventive_cost_rub: data.preventive_cost_rub ?? prev.preventive_cost_rub,
          }));
        })
        .catch(() => {});

      api<SystemStats>('/api/stats/summary')
        .then(data => {
          if (typeof data?.model_roc_auc === 'number') {
            setHoldoutRocAuc(data.model_roc_auc);
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
      toast(
        err?.message || 'Ошибка сохранения (требуются права Главного инженера)',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
  };

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Параметры и пороги безопасности"
        className="panel w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-b-none sm:rounded-xl shadow-2xl"
        style={{ background: 'var(--surface)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b shrink-0" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)' }}>
              <SlidersHorizontal className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Параметры и пороги безопасности</h3>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Конфигурация предиктивного контура СМВУ
              </p>
            </div>
          </div>
          <button className="icon-btn h-8 w-8" onClick={onClose} aria-label="Закрыть">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 scroll-thin">
          {/* 1. Model Architecture */}
          <div className="p-4 rounded-xl border flex items-center justify-between" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Cpu className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
              <span>Модель: LightGBM (чемпион)</span>
            </div>
            <span
              className="num text-xs font-medium"
              style={{ color: 'var(--accent-text)' }}
              title="Hold-out (отложенная выборка)"
            >
              ROC-AUC {holdoutRocAuc !== null ? holdoutRocAuc.toFixed(3) : '…'} (отложенная выборка)
            </span>
          </div>

          {/* 2. Threshold tau */}
          <div className="space-y-2.5 p-4 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold">Порог риска очереди диспетчера (tau):</span>
              <span className="num font-bold text-xs px-2.5 py-0.5 rounded" style={{ background: 'var(--bg)', color: 'var(--accent-text)' }}>
                {settings.decision_threshold.toFixed(4)}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Рабочий порог ранжирования каналов в оперативной очереди пульта
            </p>
            <input
              type="range"
              min="0.10"
              max="0.90"
              step="0.0005"
              value={settings.decision_threshold}
              onChange={e => setSettings({ ...settings, decision_threshold: parseFloat(e.target.value) })}
              className="w-full cursor-pointer"
            />
            <div className="flex justify-between text-[11px] num" style={{ color: 'var(--faint)' }}>
              <span>0.10 (высокий Recall)</span>
              <span>0.90 (высокий Precision)</span>
            </div>
            <p className="text-[11px] leading-relaxed pt-1" style={{ color: 'var(--muted)' }}>
              Меняет, сколько каналов попадает в список проверки. Уровни объектов на карте считаются по калиброванной вероятности и этим порогом не меняются.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Пороги сырого балла (raw-score):</span>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.845 })}
                className="btn btn-secondary text-xs h-6 px-2 num"
              >
                LGBM raw: 0.845
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.80 })}
                className="btn btn-secondary text-xs h-6 px-2 num"
              >
                LR raw: 0.80
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.7695 })}
                className="btn btn-secondary text-xs h-6 px-2 num"
              >
                RF raw: 0.7695
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.42 })}
                className="btn btn-secondary text-xs h-6 px-2 num"
              >
                Базовый raw: 0.42
              </button>
            </div>
          </div>

          {/* 3. Chatter Filter */}
          <div className="space-y-3 p-4 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
            <div className="text-xs font-semibold">Параметры фильтра дребезга контактов</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="label">Окно анализа дребезга (сек)</span>
                <input
                  type="number"
                  min="10"
                  max="300"
                  className="input num text-xs"
                  value={settings.chatter_window_seconds}
                  onChange={e => setSettings({ ...settings, chatter_window_seconds: parseInt(e.target.value, 10) || defaultSettings.chatter_window_seconds })}
                />
              </label>

              <label className="block space-y-1">
                <span className="label">Порог микро-срабатываний</span>
                <input
                  type="number"
                  min="2"
                  max="15"
                  className="input num text-xs"
                  value={settings.chatter_min_flips}
                  onChange={e => setSettings({ ...settings, chatter_min_flips: parseInt(e.target.value, 10) || defaultSettings.chatter_min_flips })}
                />
              </label>
            </div>
          </div>

          {/* 4. Costs */}
          <div className="space-y-3 p-4 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
            <div className="text-xs font-semibold">Нормативы сценарных затрат</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="label">Аварийный выезд бригады (руб)</span>
                <input
                  type="number"
                  step="500"
                  className="input num text-xs"
                  value={settings.callout_cost_rub}
                  onChange={e => setSettings({ ...settings, callout_cost_rub: parseFloat(e.target.value) || 18500 })}
                />
              </label>

              <label className="block space-y-1">
                <span className="label">Плановое ТО/ППР датчика (руб)</span>
                <input
                  type="number"
                  step="100"
                  className="input num text-xs"
                  value={settings.preventive_cost_rub}
                  onChange={e => setSettings({ ...settings, preventive_cost_rub: parseFloat(e.target.value) || 3200 })}
                />
              </label>
            </div>
          </div>

          {/* 5. Safety rule */}
          <div className="p-4 rounded-xl border space-y-2" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--warn)' }}>
              <Shield className="w-4 h-4" />
              <span>Регламент безопасности ОДС</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Автоматическая отмена выездов без подтверждения оператором запрещена. Система генерирует рекомендацию, решение принимает диспетчер с фиксацией в журнале смены.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t shrink-0" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <button
            type="button"
            onClick={handleReset}
            className="btn btn-ghost text-xs h-9"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>По умолчанию</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="btn btn-primary text-xs h-9"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{loading ? 'Сохранение…' : 'Сохранить'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

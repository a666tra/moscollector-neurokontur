import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, X, RotateCcw, Save, Shield, Cpu } from 'lucide-react';
import { SystemSettings } from '../types';
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
  chatter_window_seconds: 60,
  chatter_min_flips: 4,
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api<SystemSettings>('/api/settings')
        .then(data => setSettings(prev => ({ ...prev, ...data })))
        .catch(() => {});
    }
  }, [isOpen]);

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
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
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
          <div className="space-y-3 p-4 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Cpu className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
                <span>Архитектура активной модели:</span>
              </div>
              <span className="chip" style={{ background: 'var(--surface-3)', color: 'var(--accent-text)' }}>
                {settings.selected_model === 'logistic_regression'
                  ? 'Logistic Regression'
                  : settings.selected_model === 'random_forest'
                    ? 'Random Forest'
                    : 'Champion (LightGBM)'}
              </span>
            </div>

            <div className="space-y-2">
              <label
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                style={{
                  background: settings.selected_model === 'champion_lightgbm' || !settings.selected_model ? 'var(--accent-soft)' : 'var(--bg)',
                  borderColor: settings.selected_model === 'champion_lightgbm' || !settings.selected_model ? 'var(--accent)' : 'var(--line)',
                }}
              >
                <input
                  type="radio"
                  name="selected_model"
                  value="champion_lightgbm"
                  checked={settings.selected_model === 'champion_lightgbm' || !settings.selected_model}
                  onChange={() => setSettings({ ...settings, selected_model: 'champion_lightgbm' })}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs">LightGBM Classifier (Champion)</span>
                    <span className="num text-xs font-medium" style={{ color: 'var(--accent-text)' }}>ROC-AUC 0.845</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Градиентный бустинг по инженерным признакам. Оптимальный баланс охвата и скорости.
                  </p>
                </div>
              </label>

              <label
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                style={{
                  background: settings.selected_model === 'logistic_regression' ? 'var(--accent-soft)' : 'var(--bg)',
                  borderColor: settings.selected_model === 'logistic_regression' ? 'var(--accent)' : 'var(--line)',
                }}
              >
                <input
                  type="radio"
                  name="selected_model"
                  value="logistic_regression"
                  checked={settings.selected_model === 'logistic_regression'}
                  onChange={() => setSettings({ ...settings, selected_model: 'logistic_regression' })}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs">Logistic Regression (Balanced L2)</span>
                    <span className="num text-xs font-medium" style={{ color: 'var(--attn)' }}>Recall 67.8%</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Максимальная полнота обнаружения предаварийных состояний при индивидуальном пороге.
                  </p>
                </div>
              </label>

              <label
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                style={{
                  background: settings.selected_model === 'random_forest' ? 'var(--accent-soft)' : 'var(--bg)',
                  borderColor: settings.selected_model === 'random_forest' ? 'var(--accent)' : 'var(--line)',
                }}
              >
                <input
                  type="radio"
                  name="selected_model"
                  value="random_forest"
                  checked={settings.selected_model === 'random_forest'}
                  onChange={() => setSettings({ ...settings, selected_model: 'random_forest' })}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs">Random Forest (100 деревьев)</span>
                    <span className="num text-xs font-medium" style={{ color: 'var(--warn)' }}>Precision 45.0%</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Ансамбль деревьев решений для консервативной фильтрации нарядов с высокой точностью.
                  </p>
                </div>
              </label>
            </div>
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
            <div className="pt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Калибровочные пороги:</span>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.845 })}
                className="btn btn-secondary text-xs h-6 px-2 num"
              >
                LGBM: 0.845
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.80 })}
                className="btn btn-secondary text-xs h-6 px-2 num"
              >
                LR: 0.80
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.7695 })}
                className="btn btn-secondary text-xs h-6 px-2 num"
              >
                RF: 0.7695
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.42 })}
                className="btn btn-secondary text-xs h-6 px-2 num"
              >
                Базовый: 0.42
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
                  onChange={e => setSettings({ ...settings, chatter_window_seconds: parseInt(e.target.value, 10) || 60 })}
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
                  onChange={e => setSettings({ ...settings, chatter_min_flips: parseInt(e.target.value, 10) || 4 })}
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
            <label className="flex items-center gap-2 pt-1 text-xs cursor-not-allowed">
              <input
                type="checkbox"
                checked={settings.require_dispatcher_confirmation}
                disabled
              />
              <span>Обязательное подтверждение диспетчером (активно)</span>
            </label>
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

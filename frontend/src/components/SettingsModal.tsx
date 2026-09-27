import React, { useState, useEffect } from 'react';
import { Sliders, Shield, Save, RotateCcw, X, Check, AlertCircle, Cpu } from 'lucide-react';
import { SystemSettings } from '../types';
import { DemoAccessHint } from './DemoAccessHint';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [settings, setSettings] = useState<SystemSettings>({
    decision_threshold: 0.42,
    chatter_window_seconds: 60,
    chatter_min_flips: 4,
    gas_warning_threshold_vol_pct: 1.0,
    callout_cost_rub: 18500,
    preventive_cost_rub: 3200,
    require_dispatcher_confirmation: true,
    auto_suppress_chatter: false,
    selected_model: 'champion_lightgbm'
  });
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [dispatcherBadge, setDispatcherBadge] = useState('');
  const [dispatcherPin, setDispatcherPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/settings')
        .then(res => res.json())
        .then(data => setSettings(prev => ({ ...prev, ...data })))
        .catch(e => console.error('Failed to load settings', e));
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!dispatcherBadge.trim() || !/^\d{6}$/.test(dispatcherPin)) {
      setErrorMessage('Введите табельный номер и 6-значный PIN для подтверждения изменений.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          dispatcher_badge: dispatcherBadge,
          dispatcher_pin: dispatcherPin
        })
      });
      if (res.ok) {
        setSavedSuccess(true);
        setDispatcherPin('');
        setTimeout(() => setSavedSuccess(false), 2500);
        onSaved();
      } else {
        const err = await res.json();
        setErrorMessage(err.detail || 'Ошибка сохранения настроек (требуются права Главного инженера)');
      }
    } catch (e: any) {
      console.error('Failed to save settings', e);
      setErrorMessage(e.message || 'Сетевая ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSettings({
      decision_threshold: 0.42,
      chatter_window_seconds: 60,
      chatter_min_flips: 4,
      gas_warning_threshold_vol_pct: 1.0,
      callout_cost_rub: 18500,
      preventive_cost_rub: 3200,
      require_dispatcher_confirmation: true,
      auto_suppress_chatter: false,
      selected_model: 'champion_lightgbm'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="bg-[#121620] border border-white/20 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl animate-fade-in text-xs">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#7C4DFF]" />
            <h3 className="text-base font-semibold text-[#E7EAF0]">
              Параметры предиктивного контура и регламентов безопасности
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-[#9AA3B2] hover:text-[#E7EAF0] p-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
          {/* 0. Model Architecture Selection */}
          <div className="space-y-3 bg-[#0B0E14] p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#E7EAF0] font-semibold text-xs">
                <Cpu className="w-4 h-4 text-[#7C4DFF]" />
                <span>Архитектура активной модели (Multi-Model):</span>
              </div>
              <span className="eng-badge badge-normal text-xs">
                {settings.selected_model === 'logistic_regression' ? 'Logistic Regression' :
                 settings.selected_model === 'random_forest' ? 'Random Forest' : 'Champion (LightGBM)'}
              </span>
            </div>
            
            <div className="space-y-2">
              <label 
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  settings.selected_model === 'champion_lightgbm' || !settings.selected_model
                    ? 'bg-[#7C4DFF]/10 border-[#7C4DFF]/40 text-[#E7EAF0]'
                    : 'bg-[#181D29] border-white/10 text-[#9AA3B2] hover:border-white/20'
                }`}
              >
                <input 
                  type="radio" 
                  name="selected_model"
                  value="champion_lightgbm"
                  checked={settings.selected_model === 'champion_lightgbm' || !settings.selected_model}
                  onChange={() => setSettings({ ...settings, selected_model: 'champion_lightgbm' })}
                  className="mt-1 accent-[#7C4DFF]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#E7EAF0] text-xs">LightGBM Classifier (Champion)</span>
                    <span className="text-[#7C4DFF] text-xs font-mono">ROC-AUC 0.845 · 62,86 мс</span>
                  </div>
                  <p className="text-xs text-[#9AA3B2] mt-0.5">
                    Градиентный бустинг по инженерным признакам. Оптимальное качество ранжирования и быстродействие.
                  </p>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  settings.selected_model === 'logistic_regression'
                    ? 'bg-[#4C9BFF]/10 border-[#4C9BFF]/40 text-[#E7EAF0]'
                    : 'bg-[#181D29] border-white/10 text-[#9AA3B2] hover:border-white/20'
                }`}
              >
                <input 
                  type="radio" 
                  name="selected_model"
                  value="logistic_regression"
                  checked={settings.selected_model === 'logistic_regression'}
                  onChange={() => setSettings({ ...settings, selected_model: 'logistic_regression' })}
                  className="mt-1 accent-[#4C9BFF]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#E7EAF0] text-xs">Logistic Regression (Balanced L2)</span>
                    <span className="text-[#4C9BFF] text-xs font-mono">Recall 67.8% · ROC-AUC 0.825</span>
                  </div>
                  <p className="text-xs text-[#9AA3B2] mt-0.5">
                    Максимальная полнота охвата предаварийных признаков при собственном пороге.
                  </p>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  settings.selected_model === 'random_forest'
                    ? 'bg-[#F5A524]/10 border-[#F5A524]/40 text-[#E7EAF0]'
                    : 'bg-[#181D29] border-white/10 text-[#9AA3B2] hover:border-white/20'
                }`}
              >
                <input 
                  type="radio" 
                  name="selected_model"
                  value="random_forest"
                  checked={settings.selected_model === 'random_forest'}
                  onChange={() => setSettings({ ...settings, selected_model: 'random_forest' })}
                  className="mt-1 accent-[#F5A524]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#E7EAF0] text-xs">Random Forest (100 деревьев)</span>
                    <span className="text-[#F5A524] text-xs font-mono">Precision 45.0% · ROC-AUC 0.734</span>
                  </div>
                  <p className="text-xs text-[#9AA3B2] mt-0.5">
                    Ансамбль деревьев решений для консервативной фильтрации нарядов с высокой точностью.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 1. ML Threshold */}
          <div className="space-y-2 bg-[#0B0E14] p-4 rounded-xl border border-white/5">
            <div className="flex justify-between items-center">
              <span className="text-[#E7EAF0] font-semibold text-xs">
                Порог балла риска для очереди диспетчера (tau):
              </span>
              <span className="text-[#7C4DFF] font-bold text-xs font-mono bg-white/5 px-2.5 py-0.5 rounded-md border border-white/10">
                {settings.decision_threshold.toFixed(4)}
              </span>
            </div>
            <p className="text-xs text-[#9AA3B2]">
              Рабочий порог ранжирования каналов в очереди диспетчерского пульта.
            </p>
            <input 
              type="range"
              min="0.10"
              max="0.90"
              step="0.0005"
              value={settings.decision_threshold}
              onChange={e => setSettings({ ...settings, decision_threshold: parseFloat(e.target.value) })}
              className="w-full accent-[#7C4DFF] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-[#6B7385] font-mono">
              <span>0.10 (Высокий Recall)</span>
              <span>0.90 (Высокий Precision)</span>
            </div>
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#9AA3B2]">Пороги калибровки:</span>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.845 })}
                className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-[#7C4DFF] border border-white/10 cursor-pointer font-mono"
              >
                LGBM: 0.845
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.8000 })}
                className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-[#4C9BFF] border border-white/10 cursor-pointer font-mono"
              >
                LR: 0.80
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.7695 })}
                className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-[#F5A524] border border-white/10 cursor-pointer font-mono"
              >
                RF: 0.7695
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.42 })}
                className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-[#E7EAF0] border border-white/10 cursor-pointer font-mono"
              >
                Базовый: 0.42
              </button>
            </div>
          </div>

          {/* 2. Chatter Filter Parameters */}
          <div className="space-y-3 bg-[#0B0E14] p-4 rounded-xl border border-white/5">
            <div className="text-[#E7EAF0] font-semibold text-xs">Параметры фильтра механического дребезга</div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#9AA3B2] block mb-1">
                  Окно анализа дребезга (секунд):
                </label>
                <input 
                  type="number"
                  min="10"
                  max="300"
                  value={settings.chatter_window_seconds}
                  onChange={e => setSettings({ ...settings, chatter_window_seconds: parseInt(e.target.value) || 60 })}
                  className="w-full bg-[#181D29] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] font-mono focus:border-[#7C4DFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#9AA3B2] block mb-1">
                  Порог микро-срабатываний:
                </label>
                <input 
                  type="number"
                  min="2"
                  max="15"
                  value={settings.chatter_min_flips}
                  onChange={e => setSettings({ ...settings, chatter_min_flips: parseInt(e.target.value) || 4 })}
                  className="w-full bg-[#181D29] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] font-mono focus:border-[#7C4DFF] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Gas & Economics */}
          <div className="space-y-3 bg-[#0B0E14] p-4 rounded-xl border border-white/5">
            <div className="text-[#E7EAF0] font-semibold text-xs">Нормативы сценарных затрат и безопасности</div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#9AA3B2] block mb-1">
                  Аварийный выезд бригады (руб):
                </label>
                <input 
                  type="number"
                  step="500"
                  value={settings.callout_cost_rub}
                  onChange={e => setSettings({ ...settings, callout_cost_rub: parseFloat(e.target.value) || 18500 })}
                  className="w-full bg-[#181D29] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] font-mono focus:border-[#7C4DFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#9AA3B2] block mb-1">
                  Плановое ТО/ППР датчика (руб):
                </label>
                <input 
                  type="number"
                  step="100"
                  value={settings.preventive_cost_rub}
                  onChange={e => setSettings({ ...settings, preventive_cost_rub: parseFloat(e.target.value) || 3200 })}
                  className="w-full bg-[#181D29] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] font-mono focus:border-[#7C4DFF] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. Safety Constraint (Human in the loop) */}
          <div className="bg-[#181D29] border border-white/10 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-[#F5A524] font-semibold text-xs">
              <Shield className="w-4 h-4" />
              <span>Регламент безопасности ОДС</span>
            </div>
            <p className="text-xs text-[#9AA3B2] leading-relaxed">
              Автоматическая отмена выездов без подтверждения оператором запрещена. Система генерирует рекомендацию, окончательное решение принимает диспетчер с обязательной фиксацией табельного номера.
            </p>
            <div className="flex items-center gap-2 pt-1 text-[#E7EAF0]">
              <input 
                type="checkbox" 
                checked={settings.require_dispatcher_confirmation}
                disabled
                className="rounded accent-[#7C4DFF]"
              />
              <span className="text-xs">Обязательное подтверждение диспетчером (активно)</span>
            </div>
          </div>

          {/* 5. Level-3 RBAC authorization with DemoAccessHint */}
          <div className="bg-[#181D29] border border-[#7C4DFF]/30 p-4 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#E7EAF0] font-semibold text-xs">
                <Shield className="w-4 h-4 text-[#7C4DFF]" />
                <span>Авторизация изменений конфигурации (Level-3)</span>
              </div>
              <DemoAccessHint onFill={(b, p) => { setDispatcherBadge(b); setDispatcherPin(p); }} />
            </div>
            
            <p className="text-xs text-[#9AA3B2]">
              Для внесения изменений в пороговые коэффициенты и выбор активной модели требуется табельный номер и PIN должностного лица уровня Главного инженера ОДС.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-xs text-[#9AA3B2] block mb-1">
                  Табельный номер:
                </label>
                <input
                  type="text"
                  value={dispatcherBadge}
                  onChange={e => setDispatcherBadge(e.target.value)}
                  autoComplete="off"
                  placeholder="ДИСП-7041"
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] text-xs focus:border-[#7C4DFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#9AA3B2] block mb-1">
                  PIN-код (6 цифр):
                </label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={dispatcherPin}
                  onChange={e => setDispatcherPin(e.target.value)}
                  placeholder="••••••"
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-lg px-2.5 py-1.5 text-[#E7EAF0] text-xs font-mono tracking-widest focus:border-[#7C4DFF] focus:outline-none"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="bg-[#F0453A]/15 border border-[#F0453A]/30 text-[#F0453A] p-2.5 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center border-t border-white/10 pt-4">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 bg-transparent hover:bg-white/5 border border-white/10 text-[#9AA3B2] hover:text-[#E7EAF0] rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>По умолчанию</span>
          </button>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-[#2FBF71] flex items-center gap-1 text-xs font-medium">
                <Check className="w-4 h-4" /> Сохранено
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-[#7C4DFF] hover:bg-[#9170FF] disabled:opacity-50 text-white font-medium text-xs rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{loading ? 'Применение...' : 'Применить настройки'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

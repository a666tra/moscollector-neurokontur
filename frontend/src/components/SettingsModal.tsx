import React, { useState, useEffect } from 'react';
import { Sliders, Shield, Save, RotateCcw, X, Check, AlertCircle, Cpu } from 'lucide-react';
import { SystemSettings } from '../types';

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
      setErrorMessage('Введите табельный номер и действующий 6-значный PIN. Без учётных данных изменить настройки нельзя.');
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
        setErrorMessage(err.detail || 'Ошибка сохранения настроек (Требуется Level-3 RBAC)');
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
      <div className="bg-[#0D1117] border border-white/20 rounded max-w-2xl w-full p-6 space-y-6 shadow-2xl animate-fade-in text-xs font-mono">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#00FF66]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Настройки предиктивного контура и регламентов безопасности
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-[#8B949E] hover:text-white p-1 rounded hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-2">
          {/* 0. Model Architecture Selection */}
          <div className="space-y-3 bg-[#07090E] p-4 rounded border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Cpu className="w-4 h-4 text-[#00FF66]" />
                <span>Архитектура ML-модели (Multi-Model):</span>
              </div>
              <span className="eng-badge badge-normal font-mono text-[10px]">
                {settings.selected_model === 'logistic_regression' ? 'Logistic Regression' :
                 settings.selected_model === 'random_forest' ? 'Random Forest' : 'Champion (LightGBM)'}
              </span>
            </div>
            
            <div className="space-y-2">
              <label 
                className={`flex items-start gap-3 p-2.5 rounded border cursor-pointer transition-all ${
                  settings.selected_model === 'champion_lightgbm' || !settings.selected_model
                    ? 'bg-[#00FF66]/10 border-[#00FF66]/40 text-white'
                    : 'bg-white/5 border-white/10 text-[#8B949E] hover:border-white/20'
                }`}
              >
                <input 
                  type="radio" 
                  name="selected_model"
                  value="champion_lightgbm"
                  checked={settings.selected_model === 'champion_lightgbm' || !settings.selected_model}
                  onChange={() => setSettings({ ...settings, selected_model: 'champion_lightgbm' })}
                  className="mt-1 accent-[#00FF66]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">LightGBM Classifier (Champion)</span>
                    <span className="text-[#00FF66] text-[10px] font-mono">ROC-AUC 0.77 • 1.5 мс</span>
                  </div>
                  <p className="text-[10px] text-[#8B949E] mt-0.5">
                    Градиентный бустинг по инженерным признакам. Базовая модель локального прототипа; промышленная валидация ещё не проведена.
                  </p>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 p-2.5 rounded border cursor-pointer transition-all ${
                  settings.selected_model === 'logistic_regression'
                    ? 'bg-[#58A6FF]/10 border-[#58A6FF]/40 text-white'
                    : 'bg-white/5 border-white/10 text-[#8B949E] hover:border-white/20'
                }`}
              >
                <input 
                  type="radio" 
                  name="selected_model"
                  value="logistic_regression"
                  checked={settings.selected_model === 'logistic_regression'}
                  onChange={() => setSettings({ ...settings, selected_model: 'logistic_regression' })}
                  className="mt-1 accent-[#58A6FF]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Logistic Regression (Balanced L2)</span>
                    <span className="text-[#58A6FF] text-[10px] font-mono">Recall 67.82% • ROC-AUC 0.8247</span>
                  </div>
                  <p className="text-[10px] text-[#8B949E] mt-0.5">
                    Полнота 67.82% на отложенных proxy-метках при собственном пороге 0.80. Для рабочего порога показатели другие; сезонный эффект не проверен.
                  </p>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 p-2.5 rounded border cursor-pointer transition-all ${
                  settings.selected_model === 'random_forest'
                    ? 'bg-[#FFB800]/10 border-[#FFB800]/40 text-white'
                    : 'bg-white/5 border-white/10 text-[#8B949E] hover:border-white/20'
                }`}
              >
                <input 
                  type="radio" 
                  name="selected_model"
                  value="random_forest"
                  checked={settings.selected_model === 'random_forest'}
                  onChange={() => setSettings({ ...settings, selected_model: 'random_forest' })}
                  className="mt-1 accent-[#FFB800]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Random Forest (100 деревьев)</span>
                    <span className="text-[#FFB800] text-[10px] font-mono">Precision 45.0% • ROC-AUC 0.7335</span>
                  </div>
                  <p className="text-[10px] text-[#8B949E] mt-0.5">
                    Точность 45.0% на отложенных proxy-метках при собственном пороге 0.7695. Снижение реальных выездов не измерено.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 1. ML Threshold */}
          <div className="space-y-2 bg-[#07090E] p-4 rounded border border-white/5">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">
                Порог балла модели для очереди диспетчера (tau):
              </span>
              <span className="text-[#00FF66] font-bold text-sm bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {settings.decision_threshold.toFixed(4)}
              </span>
            </div>
            <p className="text-[11px] text-[#8B949E]">
              Порог безразмерного балла модели, а не вероятности отказа. Рабочее значение по умолчанию — 0.42.
            </p>
            <input 
              type="range"
              min="0.10"
              max="0.90"
              step="0.0005"
              value={settings.decision_threshold}
              onChange={e => setSettings({ ...settings, decision_threshold: parseFloat(e.target.value) })}
              className="w-full accent-[#00FF66] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#8B949E]">
              <span>0.10 (Высокий Recall)</span>
              <span>0.90 (Высокий Precision)</span>
            </div>
            <div className="pt-2 flex items-center gap-2">
              <span className="text-[10px] text-[#8B949E]">Пороги из отчёта моделей:</span>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.845 })}
                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-[#00FF66] border border-white/10"
              >
                LGBM: 0.845
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.8000 })}
                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-[#58A6FF] border border-white/10"
              >
                LR: 0.80
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.7695 })}
                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-[#FFB800] border border-white/10"
              >
                RF: 0.7695
              </button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, decision_threshold: 0.42 })}
                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-white border border-white/10"
              >
                Базовый: 0.42
              </button>
            </div>
          </div>

          {/* 2. Chatter Filter Parameters */}
          <div className="space-y-3 bg-[#07090E] p-4 rounded border border-white/5">
            <div className="text-white font-semibold">Параметры фильтра механического дребезга</div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-[#8B949E] block mb-1">
                  Окно анализа дребезга (секунд):
                </label>
                <input 
                  type="number"
                  min="10"
                  max="300"
                  value={settings.chatter_window_seconds}
                  onChange={e => setSettings({ ...settings, chatter_window_seconds: parseInt(e.target.value) || 60 })}
                  className="w-full bg-[#12161F] border border-white/10 rounded px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#8B949E] block mb-1">
                  Порог микро-срабатываний:
                </label>
                <input 
                  type="number"
                  min="2"
                  max="15"
                  value={settings.chatter_min_flips}
                  onChange={e => setSettings({ ...settings, chatter_min_flips: parseInt(e.target.value) || 4 })}
                  className="w-full bg-[#12161F] border border-white/10 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          </div>

          {/* 3. Gas & Economics */}
          <div className="space-y-3 bg-[#07090E] p-4 rounded border border-white/5">
            <div className="text-white font-semibold">Нормативы сценарных затрат и безопасности</div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-[#8B949E] block mb-1">
                  Аварийный выезд бригады (руб):
                </label>
                <input 
                  type="number"
                  step="500"
                  value={settings.callout_cost_rub}
                  onChange={e => setSettings({ ...settings, callout_cost_rub: parseFloat(e.target.value) || 18500 })}
                  className="w-full bg-[#12161F] border border-white/10 rounded px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#8B949E] block mb-1">
                  Плановое ТО/ППР датчика (руб):
                </label>
                <input 
                  type="number"
                  step="100"
                  value={settings.preventive_cost_rub}
                  onChange={e => setSettings({ ...settings, preventive_cost_rub: parseFloat(e.target.value) || 3200 })}
                  className="w-full bg-[#12161F] border border-white/10 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          </div>

          {/* 4. Safety Constraint (Human in the loop) */}
          <div className="bg-[#FFB800]/5 border border-[#FFB800]/20 p-4 rounded space-y-2">
            <div className="flex items-center gap-2 text-[#FFB800] font-semibold">
              <Shield className="w-4 h-4" />
              <span>Ограничение действий в локальном демо</span>
            </div>
            <p className="text-[11px] text-[#8B949E] leading-relaxed">
              Автоматическая блокировка выездов аварийных служб без подтверждения оператором запрещена. Система генерирует обоснованную рекомендацию, но окончательное решение об отмене выезда принимает диспетчер с фиксацией личного табельного номера.
            </p>
            <div className="flex items-center gap-2 pt-1 text-white">
              <input 
                type="checkbox" 
                checked={settings.require_dispatcher_confirmation}
                disabled
                className="rounded accent-[#00FF66]"
              />
              <span className="text-[11px]">Обязательное подтверждение диспетчером (Активно, неизменяемо)</span>
            </div>
          </div>

          {/* 5. Level-3 RBAC authorization */}
          <div className="bg-[#1F2937]/50 border border-blue-500/30 p-4 rounded space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400 font-semibold">
                <Shield className="w-4 h-4 text-blue-400" />
              <span>Авторизация изменений конфигурации (локальный Level-3)</span>
              </div>
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded font-mono">
                Уровень доступа: Главный инженер
              </span>
            </div>
            
            <p className="text-[11px] text-[#8B949E]">
              Для внесения изменений в пороговые коэффициенты и выбор активной модели требуется табельный номер и PIN должностного лица уровня не ниже Главного инженера ОДС.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-[11px] text-[#8B949E] block mb-1">
                  Табельный номер (Level-3):
                </label>
                <input
                  type="text"
                  value={dispatcherBadge}
                  onChange={e => setDispatcherBadge(e.target.value)}
                  autoComplete="off"
                  placeholder="Введите табельный номер"
                  className="w-full bg-[#12161F] border border-white/10 rounded px-2.5 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#8B949E] block mb-1">
                  6-значный PIN-код:
                </label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={dispatcherPin}
                  onChange={e => setDispatcherPin(e.target.value)}
                  placeholder="6 цифр"
                  className="w-full bg-[#12161F] border border-white/10 rounded px-2.5 py-1.5 text-white tracking-widest font-mono"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded text-[11px] flex items-center gap-2">
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
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[#8B949E] hover:text-white rounded flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>По умолчанию</span>
          </button>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-[#00FF66] flex items-center gap-1 text-[11px]">
                <Check className="w-3.5 h-3.5" /> Сохранено
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-[#00FF66] hover:bg-[#00FF66]/90 disabled:opacity-50 text-black font-semibold rounded flex items-center gap-2 cursor-pointer shadow-[0_0_16px_rgba(0,255,102,0.2)]"
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

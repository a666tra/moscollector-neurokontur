import React, { useState, useEffect } from 'react';
import { Sliders, Shield, Save, RotateCcw, X, Check, AlertCircle } from 'lucide-react';
import { SystemSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [settings, setSettings] = useState<SystemSettings>({
    decision_threshold: 0.40,
    chatter_window_seconds: 60,
    chatter_min_flips: 4,
    gas_warning_threshold_vol_pct: 1.0,
    callout_cost_rub: 18500,
    preventive_cost_rub: 3200,
    require_dispatcher_confirmation: true,
    auto_suppress_chatter: false
  });
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/settings')
        .then(res => res.json())
        .then(data => setSettings(data))
        .catch(e => console.error('Failed to load settings', e));
    }
  }, [isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
        onSaved();
      }
    } catch (e) {
      console.error('Failed to save settings', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSettings({
      decision_threshold: 0.40,
      chatter_window_seconds: 60,
      chatter_min_flips: 4,
      gas_warning_threshold_vol_pct: 1.0,
      callout_cost_rub: 18500,
      preventive_cost_rub: 3200,
      require_dispatcher_confirmation: true,
      auto_suppress_chatter: false
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
          {/* 1. ML Threshold */}
          <div className="space-y-2 bg-[#07090E] p-4 rounded border border-white/5">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">
                Порог классификации деградации датчика (tau):
              </span>
              <span className="text-[#00FF66] font-bold text-sm bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {settings.decision_threshold.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-[#8B949E]">
              Значение вероятности, выше которого датчик отмечается как требующий ППР (по умолчанию 0.40).
            </p>
            <input 
              type="range"
              min="0.10"
              max="0.90"
              step="0.02"
              value={settings.decision_threshold}
              onChange={e => setSettings({ ...settings, decision_threshold: parseFloat(e.target.value) })}
              className="w-full accent-[#00FF66] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#8B949E]">
              <span>0.10 (Максимальная полнота / высокий Recall)</span>
              <span>0.90 (Строгая точность / высокий Precision)</span>
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
            <div className="text-white font-semibold">Нормативы затрат и безопасности (Р ТЭК)</div>
            
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
              <span>Регламент безопасности ОДС (ГОСТ Р 53195 / КИИ 149-ФЗ)</span>
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

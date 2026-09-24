import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, AlertTriangle, ShieldCheck, Flame, 
  BatteryLow, Radio, CheckCircle, Zap, ArrowDown, Activity, Clock
} from 'lucide-react';
import { SimulationResult } from '../types';

interface StreamSimulatorProps {
  onRefreshStats?: () => void;
}

export const StreamSimulator: React.FC<StreamSimulatorProps> = ({ onRefreshStats }) => {
  const [history, setHistory] = useState<SimulationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speedMs, setSpeedMs] = useState(2000);
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  // Trigger a single scenario
  const triggerScenario = async (scenarioType: string) => {
    setLoadingScenario(scenarioType);
    try {
      const res = await fetch('/api/simulation/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_type: scenarioType })
      });
      if (res.ok) {
        const stepResult: SimulationResult = await res.json();
        setHistory(prev => [stepResult, ...prev.slice(0, 49)]); // keep last 50
        onRefreshStats?.();
      }
    } catch (e) {
      console.error('Simulation step error', e);
    } finally {
      setLoadingScenario(null);
    }
  };

  // Continuous stream toggle
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        const scenarios = ['NORMAL_STREAM', 'NORMAL_STREAM', 'FALSE_ALARM_BURST', 'BATTERY_DROP', 'GAS_SPIKE'];
        const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        triggerScenario(randomScenario);
      }, speedMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, speedMs]);

  // Aggregate stats from history
  const totalEvents = history.length;
  const falseAlarmsCount = history.filter(h => h.ml_verdict === 'FALSE_ALARM').length;
  const ticketsCreatedCount = history.filter(h => h.ticket_created).length;
  const totalSaved = history.reduce((sum, h) => sum + (h.avoided_callout_rub || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-wide">
              Симулятор реального времени и сценариев ОДС
            </h2>
            <span className="eng-badge badge-normal font-mono animate-pulse">
              Live Stream Engine
            </span>
          </div>
          <p className="text-xs text-[#8B949E] mt-1">
            Интерактивная демонстрация работы ML-контура классификации сигналов, подавления дребезга и формирования нарядов
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-4 py-2 font-mono text-xs font-semibold rounded flex items-center gap-2 cursor-pointer transition-all ${
              isRunning 
                ? 'bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white' 
                : 'bg-[#00FF66] hover:bg-[#00FF66]/90 text-black shadow-[0_0_16px_rgba(0,255,102,0.2)]'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Остановить поток</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Запустить авто-поток</span>
              </>
            )}
          </button>

          <button
            onClick={() => setHistory([])}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[#8B949E] hover:text-white rounded cursor-pointer transition-colors"
            title="Очистить историю симуляции"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scenario Injection Bar (Jury Pitch Buttons) */}
      <div className="eng-panel p-4">
        <div className="text-xs font-mono uppercase text-[#8B949E] mb-3 tracking-wider flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#00FF66]" />
          <span>Быстрый вброс тестовых сценариев (Live Demo):</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Scenario 1: False Alarm Burst */}
          <button
            onClick={() => triggerScenario('FALSE_ALARM_BURST')}
            disabled={loadingScenario !== null}
            className="p-3 bg-[#12161F] hover:bg-[#1A202C] border border-[#58A6FF]/30 hover:border-[#58A6FF] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white group-hover:text-[#58A6FF] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#58A6FF]" />
                Дребезг геркона двери
              </span>
              <span className="eng-badge badge-cyan text-[10px]">Тест 80%</span>
            </div>
            <div className="text-[11px] text-[#8B949E] leading-snug">
              5 флипов за 90 сек на КД АВ. ML блокирует ложный выезд бригады.
            </div>
            <div className="text-[10px] text-[#00FF66] font-mono mt-2">
              Экономия: +18 500 ₽
            </div>
          </button>

          {/* Scenario 2: Gas Spike */}
          <button
            onClick={() => triggerScenario('GAS_SPIKE')}
            disabled={loadingScenario !== null}
            className="p-3 bg-[#12161F] hover:bg-[#1A202C] border border-[#FF3B30]/30 hover:border-[#FF3B30] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white group-hover:text-[#FF3B30] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#FF3B30]" />
                Скачок метана CH4 2.8%
              </span>
              <span className="eng-badge badge-critical text-[10px]">Авария</span>
            </div>
            <div className="text-[11px] text-[#8B949E] leading-snug">
              Превышение порога взрывобезопасности 1.0%. Немедленный наряд ТО.
            </div>
            <div className="text-[10px] text-[#FF3B30] font-mono mt-2">
              Статус: Авто-наряд З-ТО
            </div>
          </button>

          {/* Scenario 3: Battery Drop */}
          <button
            onClick={() => triggerScenario('BATTERY_DROP')}
            disabled={loadingScenario !== null}
            className="p-3 bg-[#12161F] hover:bg-[#1A202C] border border-[#FFB800]/30 hover:border-[#FFB800] rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white group-hover:text-[#FFB800] flex items-center gap-1.5">
                <BatteryLow className="w-3.5 h-3.5 text-[#FFB800]" />
                Просадка питания 10.8V
              </span>
              <span className="eng-badge badge-warning text-[10px]">Деградация</span>
            </div>
            <div className="text-[11px] text-[#8B949E] leading-snug">
              Переход на аккумулятор. Прогноз отказа за 48 часов, плановый ППР.
            </div>
            <div className="text-[10px] text-[#FFB800] font-mono mt-2">
              Статус: Наряд в график
            </div>
          </button>

          {/* Scenario 4: Normal Stream */}
          <button
            onClick={() => triggerScenario('NORMAL_STREAM')}
            disabled={loadingScenario !== null}
            className="p-3 bg-[#12161F] hover:bg-[#1A202C] border border-white/10 hover:border-white/30 rounded text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white group-hover:text-[#00FF66] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00FF66]" />
                Штатная телеметрия
              </span>
              <span className="eng-badge badge-normal text-[10px]">Норма</span>
            </div>
            <div className="text-[11px] text-[#8B949E] leading-snug">
              События без отклонений. Запись в штатный архив СМВУ Москоллектора.
            </div>
            <div className="text-[10px] text-[#8B949E] font-mono mt-2">
              Статус: Без триггеров
            </div>
          </button>
        </div>
      </div>

      {/* Simulator Real-Time KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="eng-panel p-3">
          <div className="text-[11px] text-[#8B949E] font-mono uppercase">Обработано событий</div>
          <div className="text-2xl font-bold font-mono text-white mt-0.5">{totalEvents}</div>
          <div className="text-[10px] text-[#8B949E] font-mono">В текущей сессии</div>
        </div>

        <div className="eng-panel p-3">
          <div className="text-[11px] text-[#8B949E] font-mono uppercase">Отфильтровано тревог</div>
          <div className="text-2xl font-bold font-mono text-[#58A6FF] mt-0.5">{falseAlarmsCount}</div>
          <div className="text-[10px] text-[#58A6FF] font-mono">
            {totalEvents > 0 ? ((falseAlarmsCount / totalEvents) * 100).toFixed(0) : '0'}% от потока
          </div>
        </div>

        <div className="eng-panel p-3">
          <div className="text-[11px] text-[#8B949E] font-mono uppercase">Сформировано нарядов</div>
          <div className="text-2xl font-bold font-mono text-[#FFB800] mt-0.5">{ticketsCreatedCount}</div>
          <div className="text-[10px] text-[#FFB800] font-mono">По Р ТЭК</div>
        </div>

        <div className="eng-panel p-3">
          <div className="text-[11px] text-[#8B949E] font-mono uppercase">Предотвращено затрат</div>
          <div className="text-2xl font-bold font-mono text-[#00FF66] mt-0.5">
            {totalSaved.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-[10px] text-[#00FF66] font-mono">Экономия выездов</div>
        </div>
      </div>

      {/* Live Stream Feed / Timeline */}
      <div className="eng-panel overflow-hidden">
        <div className="p-3 bg-[#12161F] border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00FF66]" />
            <span className="font-mono text-xs text-white uppercase tracking-wider">
              Поток телеметрии в реальном времени (Инференс &lt; 0.1 сек)
            </span>
          </div>
          <div className="text-[11px] text-[#8B949E] font-mono">
            Автопрокрутка активна
          </div>
        </div>

        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-12 text-center text-[#8B949E] font-mono text-xs space-y-2">
              <Radio className="w-8 h-8 text-[#8B949E] mx-auto opacity-40 animate-pulse" />
              <div>Ожидание телеметрии...</div>
              <div className="text-[11px] text-[#8B949E]/70">
                Нажмите одну из кнопок сценариев выше или включите «Запустить авто-поток»
              </div>
            </div>
          ) : (
            history.map((step, idx) => (
              <div key={idx} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#8B949E]">
                      #{step.step_id}
                    </span>
                    <span className="font-mono text-xs font-semibold text-white">
                      {step.sensor_name}
                    </span>
                    <span className="text-[11px] text-[#8B949E] font-mono">
                      (канал {step.channel_id})
                    </span>
                    <span className="eng-badge bg-white/5 text-[#8B949E] font-mono text-[10px]">
                      {step.picket}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-white bg-[#07090E] px-2 py-0.5 rounded border border-white/10">
                      Значение: <span className="font-semibold text-[#00FF66]">{step.emitted_value}</span>
                    </span>

                    <span className={`eng-badge text-[11px] ${
                      step.ml_verdict === 'REAL_RISK' ? 'badge-critical' :
                      step.ml_verdict === 'FALSE_ALARM' ? 'badge-cyan' :
                      step.ml_verdict === 'SENSOR_DEGRADATION' ? 'badge-warning' : 'badge-normal'
                    }`}>
                      {step.ml_verdict === 'REAL_RISK' ? 'КРИТИЧЕСКИЙ РИСК' :
                       step.ml_verdict === 'FALSE_ALARM' ? 'ЛОЖНАЯ ТРЕВОГА' :
                       step.ml_verdict === 'SENSOR_DEGRADATION' ? 'ДЕГРАДАЦИЯ' : 'НОРМА'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-[#8B949E] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-white font-medium">{step.object_name}</span>: {step.explanation}
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    {step.ticket_created && (
                      <span className="text-[#FFB800] flex items-center gap-1 font-semibold">
                        <CheckCircle className="w-3 h-3" /> Наряд: {step.ticket_id}
                      </span>
                    )}
                    {step.avoided_callout_rub > 0 && (
                      <span className="text-[#00FF66] font-semibold">
                        +Сэкономлено: {step.avoided_callout_rub.toLocaleString('ru-RU')} ₽
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

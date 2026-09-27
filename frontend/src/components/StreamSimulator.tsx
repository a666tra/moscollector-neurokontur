import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Flame, 
  BatteryLow, Radio, CheckCircle, Zap, ShieldCheck, Activity
} from 'lucide-react';
import { SimulationResult } from '../types';
import { DemoAccessHint } from './DemoAccessHint';

interface StreamSimulatorProps {
  onRefreshStats?: () => void;
}

export const StreamSimulator: React.FC<StreamSimulatorProps> = ({ onRefreshStats }) => {
  const [history, setHistory] = useState<SimulationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speedMs, setSpeedMs] = useState(2000);
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);
  const [dispatcherBadge, setDispatcherBadge] = useState('');
  const [dispatcherPin, setDispatcherPin] = useState('');
  const [actionError, setActionError] = useState('');
  const timerRef = useRef<any>(null);
  const hasDispatcherCredentials = dispatcherBadge.trim().length > 0 && /^\d{6}$/.test(dispatcherPin);

  const triggerScenario = async (scenarioType: string) => {
    const requiresDispatcher = scenarioType === 'GAS_SPIKE' || scenarioType === 'BATTERY_DROP';
    if (requiresDispatcher && !hasDispatcherCredentials) {
      setActionError('Для сценариев с автоматическим формированием заявки укажите табельный номер и PIN диспетчера.');
      return;
    }

    setActionError('');
    setLoadingScenario(scenarioType);
    try {
      const res = await fetch('/api/simulation/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_type: scenarioType,
          ...(requiresDispatcher ? {
            dispatcher_badge: dispatcherBadge.trim(),
            dispatcher_pin: dispatcherPin
          } : {})
        })
      });
      if (res.ok) {
        const stepResult: SimulationResult = await res.json();
        setHistory(prev => [stepResult, ...prev.slice(0, 49)]);
        onRefreshStats?.();
      } else {
        const body = await res.json().catch(() => null);
        const detail = typeof body?.detail === 'string' ? body.detail : '';
        setActionError(res.status === 401
          ? 'Учётные данные не подтверждены. Проверьте табельный номер и PIN.'
          : res.status === 403
            ? 'Данный уровень доступа не позволяет создавать заявки.'
            : detail || `Не удалось выполнить сценарий (HTTP ${res.status}).`);
        if (res.status === 401 || res.status === 403) setIsRunning(false);
      }
    } catch (e) {
      console.error('Simulation step error', e);
      setActionError('Не удалось связаться с сервером API.');
    } finally {
      setLoadingScenario(null);
    }
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        const scenarios = hasDispatcherCredentials
          ? ['NORMAL_STREAM', 'NORMAL_STREAM', 'FALSE_ALARM_BURST', 'BATTERY_DROP', 'GAS_SPIKE']
          : ['NORMAL_STREAM', 'NORMAL_STREAM', 'FALSE_ALARM_BURST'];
        const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        triggerScenario(randomScenario);
      }, speedMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, speedMs, dispatcherBadge, dispatcherPin]);

  const totalEvents = history.length;
  const falseAlarmsCount = history.filter(h => h.ml_verdict === 'FALSE_ALARM').length;
  const ticketsCreatedCount = history.filter(h => h.ticket_created).length;
  const totalSaved = history.reduce((sum, h) => sum + (h.scenario_potential_rub || 0), 0);

  return (
    <div className="space-y-6">
      {/* Dispatcher auth banner with DemoAccessHint */}
      <section className="eng-panel p-4 space-y-3" aria-label="Авторизация дежурного диспетчера">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[#E7EAF0]">Авторизация дежурного диспетчера</div>
            <p className="text-xs text-[#9AA3B2] mt-0.5">
              Сценарии с формированием наряда требуют авторизации оператора ОДС.
            </p>
          </div>
          <DemoAccessHint onFill={(b, p) => { setDispatcherBadge(b); setDispatcherPin(p); }} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end pt-1">
          <label className="text-xs text-[#9AA3B2]">
            Табельный номер
            <input
              type="text"
              value={dispatcherBadge}
              onChange={event => { setDispatcherBadge(event.target.value); setActionError(''); }}
              placeholder="ДИСП-7041"
              autoComplete="off"
              className="block w-full sm:w-44 mt-1 bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-[#E7EAF0] focus:border-[#7C4DFF] focus:outline-none"
            />
          </label>
          <label className="text-xs text-[#9AA3B2]">
            PIN (6 цифр)
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={dispatcherPin}
              onChange={event => { setDispatcherPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setActionError(''); }}
              placeholder="••••••"
              autoComplete="off"
              className="block w-full sm:w-36 mt-1 bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-[#E7EAF0] font-mono tracking-widest focus:border-[#7C4DFF] focus:outline-none"
            />
          </label>
          {actionError && <p role="alert" className="text-xs text-[#F0453A] sm:self-end pb-1">{actionError}</p>}
        </div>
      </section>

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#E7EAF0]">
              Симулятор сценариев телеметрии СМВУ
            </h2>
            <span className="eng-badge badge-normal">
              Интерактивный стенд
            </span>
          </div>
          <p className="text-xs text-[#9AA3B2] mt-1">
            Интерактивная подача типовых паттернов телеметрии для проверки логики классификации и формирования нарядов
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-4 py-2 text-xs font-medium rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-xs ${
              isRunning 
                ? 'bg-[#F0453A] hover:bg-[#F0453A]/90 text-white' 
                : 'bg-[#7C4DFF] hover:bg-[#9170FF] text-white'
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
                <span>Запустить поток</span>
              </>
            )}
          </button>

          <button
            onClick={() => setHistory([])}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[#9AA3B2] hover:text-[#E7EAF0] rounded-lg cursor-pointer transition-colors"
            title="Очистить историю симуляции"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scenario Injection Bar */}
      <div className="eng-panel p-4">
        <div className="text-xs uppercase text-[#9AA3B2] mb-3 font-semibold flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#7C4DFF]" />
          <span>Типовые сценарии телеметрии:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Scenario 1: False Alarm Burst */}
          <button
            onClick={() => triggerScenario('FALSE_ALARM_BURST')}
            disabled={loadingScenario !== null}
            className="p-3.5 bg-[#181D29] hover:bg-[#181D29]/80 border border-[#4C9BFF]/30 hover:border-[#4C9BFF] rounded-xl text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#E7EAF0] group-hover:text-[#4C9BFF] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#4C9BFF]" />
                Дребезг геркона двери
              </span>
              <span className="eng-badge badge-cyan text-xs">Импульс</span>
            </div>
            <div className="text-xs text-[#9AA3B2] leading-snug">
              Серия микропереключений за короткий интервал. Фильтр отсекает ложный выезд.
            </div>
          </button>

          {/* Scenario 2: Gas Spike */}
          <button
            onClick={() => triggerScenario('GAS_SPIKE')}
            disabled={loadingScenario !== null || !hasDispatcherCredentials}
            className="p-3.5 bg-[#181D29] hover:bg-[#181D29]/80 border border-[#F0453A]/30 hover:border-[#F0453A] rounded-xl text-left transition-colors group cursor-pointer disabled:opacity-40"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#E7EAF0] group-hover:text-[#F0453A] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#F0453A]" />
                Рост метана CH₄
              </span>
              <span className="eng-badge badge-critical text-xs">Тревога</span>
            </div>
            <div className="text-xs text-[#9AA3B2] leading-snug">
              Превышение концентрации газа. Модель подтверждает риск и формирует срочный наряд.
            </div>
          </button>

          {/* Scenario 3: Battery Drop */}
          <button
            onClick={() => triggerScenario('BATTERY_DROP')}
            disabled={loadingScenario !== null || !hasDispatcherCredentials}
            className="p-3.5 bg-[#181D29] hover:bg-[#181D29]/80 border border-[#F5A524]/30 hover:border-[#F5A524] rounded-xl text-left transition-colors group cursor-pointer disabled:opacity-40"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#E7EAF0] group-hover:text-[#F5A524] flex items-center gap-1.5">
                <BatteryLow className="w-3.5 h-3.5 text-[#F5A524]" />
                Просадка питания 10,8 В
              </span>
              <span className="eng-badge badge-warning text-xs">Деградация</span>
            </div>
            <div className="text-xs text-[#9AA3B2] leading-snug">
              Признак деградации АКБ питания датчика. Формируется наряд на плановое ТО.
            </div>
          </button>

          {/* Scenario 4: Normal Stream */}
          <button
            onClick={() => triggerScenario('NORMAL_STREAM')}
            disabled={loadingScenario !== null}
            className="p-3.5 bg-[#181D29] hover:bg-[#181D29]/80 border border-white/10 hover:border-white/30 rounded-xl text-left transition-colors group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#E7EAF0] group-hover:text-[#2FBF71] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2FBF71]" />
                Штатная телеметрия
              </span>
              <span className="eng-badge badge-normal text-xs">Норма</span>
            </div>
            <div className="text-xs text-[#9AA3B2] leading-snug">
              Поступление пакета телеметрии в пределах штатных порогов без аномалий.
            </div>
          </button>
        </div>
      </div>

      {/* Simulator Real-Time KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="eng-panel p-3.5">
          <div className="text-xs text-[#9AA3B2]">Событий в сессии</div>
          <div className="text-2xl font-bold font-mono text-[#E7EAF0] mt-1">{totalEvents}</div>
          <div className="text-xs text-[#6B7385] mt-0.5">В текущей сессии</div>
        </div>

        <div className="eng-panel p-3.5">
          <div className="text-xs text-[#9AA3B2]">Отфильтровано шума</div>
          <div className="text-2xl font-bold font-mono text-[#4C9BFF] mt-1">{falseAlarmsCount}</div>
          <div className="text-xs text-[#4C9BFF] mt-0.5">
            {totalEvents > 0 ? ((falseAlarmsCount / totalEvents) * 100).toFixed(0) : '0'}% от общего потока
          </div>
        </div>

        <div className="eng-panel p-3.5">
          <div className="text-xs text-[#9AA3B2]">Сформировано нарядов</div>
          <div className="text-2xl font-bold font-mono text-[#F5A524] mt-1">{ticketsCreatedCount}</div>
          <div className="text-xs text-[#F5A524] mt-0.5">Заявок в реестре</div>
        </div>

        <div className="eng-panel p-3.5">
          <div className="text-xs text-[#9AA3B2]">Сценарный потенциал</div>
          <div className="text-2xl font-bold font-mono text-[#2FBF71] mt-1">
            {totalSaved.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-xs text-[#6B7385] mt-0.5">Предотвращённый ущерб</div>
        </div>
      </div>

      {/* Live Stream Feed / Timeline */}
      <div className="eng-panel overflow-hidden">
        <div className="p-3.5 bg-[#181D29] border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#7C4DFF]" />
            <span className="text-xs font-semibold text-[#E7EAF0]">
              Журнал симулятора телеметрии
            </span>
          </div>
          <div className="text-xs text-[#9AA3B2]">
            Автопрокрутка при активном потоке
          </div>
        </div>

        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-12 text-center text-[#9AA3B2] text-xs space-y-2">
              <Radio className="w-8 h-8 text-[#9AA3B2] mx-auto opacity-40 animate-pulse" />
              <div>Ожидание подачи сигналов…</div>
              <div className="text-xs text-[#6B7385]">
                Выберите сценарий выше или запустите автоматический поток
              </div>
            </div>
          ) : (
            history.map((step, idx) => (
              <div key={idx} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6B7385] font-mono">
                      #{step.step_id}
                    </span>
                    <span className="text-xs font-semibold text-[#E7EAF0]">
                      {step.sensor_name}
                    </span>
                    <span className="text-xs text-[#9AA3B2] font-mono">
                      (канал #{step.channel_id})
                    </span>
                    <span className="eng-badge bg-white/5 text-[#9AA3B2] text-xs font-mono">
                      {step.picket}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#E7EAF0] bg-[#0B0E14] px-2.5 py-0.5 rounded-md border border-white/10 font-mono">
                      Значение: <span className="font-semibold text-[#4C9BFF]">{step.emitted_value}</span>
                    </span>

                    <span className={`eng-badge text-xs ${
                      step.ml_verdict === 'REAL_RISK' ? 'badge-critical' :
                      step.ml_verdict === 'FALSE_ALARM' ? 'badge-cyan' :
                      step.ml_verdict === 'SENSOR_DEGRADATION' ? 'badge-warning' : 'badge-normal'
                    }`}>
                      {step.ml_verdict === 'REAL_RISK' ? 'РЕАЛЬНЫЙ РИСК' :
                       step.ml_verdict === 'FALSE_ALARM' ? 'КАНДИДАТ НА ШУМ' :
                       step.ml_verdict === 'SENSOR_DEGRADATION' ? 'ДЕГРАДАЦИЯ' : 'НОРМА'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-[#9AA3B2] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[#E7EAF0] font-medium">{step.object_name}</span>: {step.explanation}
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs">
                    {step.ticket_created && (
                      <span className="text-[#F5A524] flex items-center gap-1 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" /> Наряд: {step.ticket_id}
                      </span>
                    )}
                    {(step.scenario_potential_rub || 0) > 0 && (
                      <span className="text-[#2FBF71] font-semibold">
                        +{(step.scenario_potential_rub || 0).toLocaleString('ru-RU')} ₽
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

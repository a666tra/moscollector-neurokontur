import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Flame, 
  BatteryLow, Radio, CheckCircle, Zap, ShieldCheck, Activity
} from 'lucide-react';
import { SimulationResult } from '../types';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { api } from '../lib/api';

interface StreamSimulatorProps {
  onRefreshStats?: () => void;
}

export const StreamSimulator: React.FC<StreamSimulatorProps> = ({ onRefreshStats }) => {
  const { dispatcher, requireDispatcher } = useSession();
  const toast = useToast();

  const [history, setHistory] = useState<SimulationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speedMs] = useState(2000);
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  const triggerScenario = async (scenarioType: string) => {
    const requiresDispatcher = scenarioType === 'GAS_SPIKE' || scenarioType === 'BATTERY_DROP';
    let d = dispatcher;
    if (requiresDispatcher && !d) {
      d = await requireDispatcher();
      if (!d) return;
    }

    setLoadingScenario(scenarioType);
    try {
      const stepResult = await api<SimulationResult>('/api/simulation/step', {
        method: 'POST',
        json: {
          scenario_type: scenarioType,
          ...(d ? {
            dispatcher_badge: d.badge,
            dispatcher_pin: d.pin,
          } : {}),
        },
      });
      setHistory(prev => [stepResult, ...prev.slice(0, 49)]);
      onRefreshStats?.();
    } catch (err: any) {
      toast(err?.message || 'Не удалось выполнить шаг симуляции', 'error');
      if (isRunning) setIsRunning(false);
    } finally {
      setLoadingScenario(null);
    }
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        const scenarios = dispatcher
          ? ['NORMAL_STREAM', 'NORMAL_STREAM', 'FALSE_ALARM_BURST', 'BATTERY_DROP', 'GAS_SPIKE']
          : ['NORMAL_STREAM', 'NORMAL_STREAM', 'FALSE_ALARM_BURST'];
        const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        triggerScenario(randomScenario);
      }, speedMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, speedMs, dispatcher]);

  const totalEvents = history.length;
  const falseAlarmsCount = history.filter(h => h.ml_verdict === 'FALSE_ALARM').length;
  const ticketsCreatedCount = history.filter(h => h.ticket_created).length;
  const totalSaved = history.reduce((sum, h) => sum + (h.scenario_potential_rub || 0), 0);

  return (
    <div className="space-y-5 max-w-[920px]">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Симулятор потока телеметрии</h2>
            <span className="chip" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
              СМВУ Контур
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Подача сигналов в реальном времени для проверки классификатора и автоматической генерации нарядов
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`btn text-xs h-8 ${isRunning ? 'btn-danger' : 'btn-primary'}`}
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
            className="icon-btn h-8 w-8"
            title="Очистить журнал симуляции"
            aria-label="Очистить"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scenario Injection Bar */}
      <div className="panel p-4 space-y-3">
        <div className="text-xs font-semibold flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          <Zap className="w-3.5 h-3.5" style={{ color: 'var(--accent-text)' }} />
          <span>Подача сценариев телеметрии</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Scenario 1: False Alarm Burst */}
          <button
            type="button"
            onClick={() => triggerScenario('FALSE_ALARM_BURST')}
            disabled={loadingScenario !== null}
            className="p-3.5 rounded-xl border text-left transition-colors hover:border-[var(--line-2)] space-y-1.5"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" style={{ color: 'var(--attn)' }} />
                Дребезг геркона двери
              </span>
              <span className="chip risk-ATTENTION text-[11px]">Импульс</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Серия микропереключений геркона за короткий интервал. Фильтр дребезга блокирует ложный выезд.
            </p>
          </button>

          {/* Scenario 2: Gas Spike */}
          <button
            type="button"
            onClick={() => triggerScenario('GAS_SPIKE')}
            disabled={loadingScenario !== null}
            className="p-3.5 rounded-xl border text-left transition-colors hover:border-[var(--line-2)] space-y-1.5"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" style={{ color: 'var(--crit)' }} />
                Рост метана CH₄
              </span>
              <span className="chip risk-CRITICAL text-[11px]">Тревога</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Превышение концентрации газа. Модель подтверждает риск аварии и формирует срочный наряд.
            </p>
          </button>

          {/* Scenario 3: Battery Drop */}
          <button
            type="button"
            onClick={() => triggerScenario('BATTERY_DROP')}
            disabled={loadingScenario !== null}
            className="p-3.5 rounded-xl border text-left transition-colors hover:border-[var(--line-2)] space-y-1.5"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <BatteryLow className="w-3.5 h-3.5" style={{ color: 'var(--warn)' }} />
                Просадка питания 10,8 В
              </span>
              <span className="chip risk-WARNING text-[11px]">Деградация</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Признак постепенной деградации АКБ питания датчика. Формируется наряд на плановое ТО.
            </p>
          </button>

          {/* Scenario 4: Normal Stream */}
          <button
            type="button"
            onClick={() => triggerScenario('NORMAL_STREAM')}
            disabled={loadingScenario !== null}
            className="p-3.5 rounded-xl border text-left transition-colors hover:border-[var(--line-2)] space-y-1.5"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--ok)' }} />
                Штатная телеметрия
              </span>
              <span className="chip risk-NORMAL text-[11px]">Норма</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Поступление пакета телеметрии в пределах штатных порогов без аномалий и сбоев.
            </p>
          </button>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="panel p-3 space-y-1">
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Событий в сессии</div>
          <div className="num text-2xl font-bold">{totalEvents}</div>
          <div className="text-[11px]" style={{ color: 'var(--faint)' }}>Пакетов телеметрии</div>
        </div>

        <div className="panel p-3 space-y-1">
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Отфильтровано шума</div>
          <div className="num text-2xl font-bold" style={{ color: 'var(--attn)' }}>{falseAlarmsCount}</div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {totalEvents > 0 ? ((falseAlarmsCount / totalEvents) * 100).toFixed(0) : '0'}% от потока
          </div>
        </div>

        <div className="panel p-3 space-y-1">
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Сформировано нарядов</div>
          <div className="num text-2xl font-bold" style={{ color: 'var(--warn)' }}>{ticketsCreatedCount}</div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Заявок в реестре</div>
        </div>

        <div className="panel p-3 space-y-1">
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Сценарный потенциал</div>
          <div className="num text-2xl font-bold" style={{ color: 'var(--ok)' }}>
            {totalSaved.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-[11px]" style={{ color: 'var(--faint)' }}>Предотвращенный ущерб</div>
        </div>
      </div>

      {/* Live Stream Feed / Timeline */}
      <div className="panel overflow-hidden">
        <div className="p-3.5 border-b flex justify-between items-center" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
            <span className="text-xs font-semibold">Журнал симулятора</span>
          </div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            Последние 50 событий
          </div>
        </div>

        <div className="divide-y max-h-[460px] overflow-y-auto scroll-thin" style={{ borderColor: 'var(--line)' }}>
          {history.length === 0 ? (
            <div className="p-10 text-center text-xs space-y-2" style={{ color: 'var(--muted)' }}>
              <Radio className="w-7 h-7 mx-auto opacity-40 animate-pulse" />
              <div>Ожидание подачи сигналов…</div>
              <div className="text-[11px]" style={{ color: 'var(--faint)' }}>
                Выберите сценарий выше или запустите автоматический поток
              </div>
            </div>
          ) : (
            history.map((step, idx) => {
              const verdictChip =
                step.ml_verdict === 'REAL_RISK'
                  ? 'risk-CRITICAL'
                  : step.ml_verdict === 'FALSE_ALARM'
                    ? 'risk-ATTENTION'
                    : step.ml_verdict === 'SENSOR_DEGRADATION'
                      ? 'risk-WARNING'
                      : 'risk-NORMAL';

              const verdictTitle =
                step.ml_verdict === 'REAL_RISK'
                  ? 'Реальный риск'
                  : step.ml_verdict === 'FALSE_ALARM'
                    ? 'Кандидат на шум'
                    : step.ml_verdict === 'SENSOR_DEGRADATION'
                      ? 'Деградация'
                      : 'Норма';

              return (
                <div key={idx} className="p-3.5 hover:bg-[var(--surface-2)] transition-colors space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="num text-xs" style={{ color: 'var(--faint)' }}>
                        #{step.step_id}
                      </span>
                      <span className="text-xs font-semibold">
                        {step.sensor_name}
                      </span>
                      <span className="num text-xs" style={{ color: 'var(--muted)' }}>
                        (#{step.channel_id})
                      </span>
                      <span className="chip text-[11px]" style={{ background: 'var(--surface-3)', color: 'var(--muted)' }}>
                        ПК <span className="num">{step.picket}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="num text-xs px-2 py-0.5 rounded border" style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}>
                        Значение: <span className="font-semibold text-[var(--accent-text)]">{step.emitted_value}</span>
                      </span>
                      <span className={`chip ${verdictChip}`}>
                        {verdictTitle}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs flex flex-wrap items-center justify-between gap-2" style={{ color: 'var(--muted)' }}>
                    <div>
                      <span className="font-medium text-[var(--text)]">{step.object_name}</span>: {step.explanation}
                    </div>

                    <div className="flex items-center gap-3 num text-xs">
                      {step.ticket_created && (
                        <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--warn)' }}>
                          <CheckCircle className="w-3.5 h-3.5" /> Наряд: {step.ticket_id}
                        </span>
                      )}
                      {(step.scenario_potential_rub || 0) > 0 && (
                        <span className="font-semibold" style={{ color: 'var(--ok)' }}>
                          +{(step.scenario_potential_rub || 0).toLocaleString('ru-RU')} ₽
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { ShieldCheck, Activity, Compass, ArrowRight, Zap } from 'lucide-react';
import { SystemStats } from '../types';

interface HeroCoverProps {
  stats: SystemStats | null;
  onEnter: () => void;
}

export const HeroCover: React.FC<HeroCoverProps> = ({ stats, onEnter }) => {
  return (
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-12 max-w-7xl mx-auto">
      {/* Top Bar */}
      <header className="flex justify-between items-center border-b border-white/10 pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-[#00FF66]" />
          </div>
          <div>
            <div className="font-mono text-sm tracking-wider uppercase text-white font-semibold">
              Москоллектор.НейроКонтур
            </div>
            <div className="text-xs text-[#8B949E]">
              АО «Москоллектор» • Комплекс городского хозяйства Москвы
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="eng-badge badge-normal flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse"></span>
            ЛОКАЛЬНОЕ ДЕМО
          </span>
          <span className="eng-badge badge-cyan font-mono text-xs">
            ЛЦТ 2026 • КЕЙС #8
          </span>
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="my-auto py-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-[#00FF66]/20 bg-[#00FF66]/5 text-[#00FF66] font-mono text-xs mb-6">
            <ShieldCheck className="w-3.5 h-3.5" />
            Демонстрационный прототип анализа телеметрии
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1] mb-6">
            Ранжируем сигналы для проверки диспетчером
          </h1>

          <p className="text-lg text-[#8B949E] leading-relaxed mb-8 max-w-2xl">
            Оценка каналов по proxy-разметке, тестовые сценарии фильтра и черновики заявок. Карта и статусы демонстрационные; подтверждённых ремонтов и действующих интеграций нет.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={onEnter}
              className="px-6 py-3.5 bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-semibold text-sm rounded flex items-center gap-2 transition-all shadow-[0_0_24px_rgba(0,255,102,0.25)] hover:shadow-[0_0_32px_rgba(0,255,102,0.4)] cursor-pointer"
            >
              <span>Открыть демонстрационный центр</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-xs text-[#8B949E] font-mono flex items-center gap-2 pl-2">
              <span className="text-white font-medium">Горизонт эксперимента:</span> 24–72 часа • <span className="text-white font-medium">Скоринг:</span> 62,86 мс на 11 485 каналов
            </div>
          </div>
        </div>

        {/* 4 Key Metric Pillars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-12 border-t border-white/10">
          <div className="eng-panel p-5">
            <div className="text-xs text-[#8B949E] uppercase tracking-wider mb-1 font-mono">Масштаб по ТЗ</div>
            <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
              {stats?.monitored_km || 825} <span className="text-sm font-normal text-[#8B949E]">км</span>
            </div>
            <div className="text-xs text-[#00FF66] mt-2 flex items-center gap-1 font-mono">
              <Compass className="w-3 h-3" /> Контекст задачи, не охват пилота
            </div>
          </div>

          <div className="eng-panel p-5">
            <div className="text-xs text-[#8B949E] uppercase tracking-wider mb-1 font-mono">LightGBM • test</div>
            <div className="text-2xl sm:text-3xl font-bold text-[#00FF66] font-mono">
              0,1679
            </div>
            <div className="text-xs text-[#8B949E] mt-2 font-mono">
              PR-AUC • ROC-AUC 0,7710 • proxy-метки
            </div>
          </div>

          <div className="eng-panel p-5">
            <div className="text-xs text-[#8B949E] uppercase tracking-wider mb-1 font-mono">Proxy-метки в test</div>
            <div className="text-2xl sm:text-3xl font-bold text-[#58A6FF] font-mono">
              174
            </div>
            <div className="text-xs text-[#8B949E] mt-2 font-mono flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#58A6FF]" /> Не подтверждённые ремонты
            </div>
          </div>

          <div className="eng-panel p-5">
            <div className="text-xs text-[#8B949E] uppercase tracking-wider mb-1 font-mono">Экономика</div>
            <div className="text-2xl sm:text-3xl font-bold text-[#FFB800] font-mono">
              СЦЕНАРИЙ
            </div>
            <div className="text-xs text-[#00FF66] mt-2 font-mono flex items-center gap-1">
              <Zap className="w-3 h-3" /> Вводные не подтверждены заказчиком
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Regulations */}
      <footer className="flex flex-col sm:flex-row justify-between items-center text-xs text-[#8B949E] border-t border-white/5 pt-6 gap-2">
        <div className="flex items-center gap-4">
          <span>Статус:</span>
          <span className="text-white">локальный прототип</span>
        </div>
        <div className="font-mono text-[11px]">
          SCADA / CMMS не подключены
        </div>
      </footer>
    </div>
  );
};

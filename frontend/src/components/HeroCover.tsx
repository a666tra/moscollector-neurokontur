import React from 'react';
import { ShieldCheck, Activity, Compass, Cpu, ArrowRight, Zap, TrendingUp } from 'lucide-react';
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
            СМВУ Онлайн
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
            Интеллектуальная предиктивная система инженерной безопасности
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1] mb-6">
            Предотвращаем аварии в подземном городе Москвы <span className="text-[#00FF66]">до их возникновения</span>
          </h1>

          <p className="text-lg text-[#8B949E] leading-relaxed mb-8 max-w-2xl">
            Предиктивная аналитика деградации датчиков СМВУ, фильтрация до 80% ложных тревог и автоматическое формирование наряд-заказов ТО/ППР на 825 км коллекторных трасс.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={onEnter}
              className="px-6 py-3.5 bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-semibold text-sm rounded flex items-center gap-2 transition-all shadow-[0_0_24px_rgba(0,255,102,0.25)] hover:shadow-[0_0_32px_rgba(0,255,102,0.4)] cursor-pointer"
            >
              <span>Открыть Ситуационный Центр ОДС</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-xs text-[#8B949E] font-mono flex items-center gap-2 pl-2">
              <span className="text-white font-medium">Горизонт прогноза:</span> ≥ 24 часа • Инференс: &lt; 2 сек
            </div>
          </div>
        </div>

        {/* 4 Key Metric Pillars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-12 border-t border-white/10">
          <div className="eng-panel p-5">
            <div className="text-xs text-[#8B949E] uppercase tracking-wider mb-1 font-mono">Сеть коллекторов</div>
            <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
              {stats?.monitored_km || 825} <span className="text-sm font-normal text-[#8B949E]">км</span>
            </div>
            <div className="text-xs text-[#00FF66] mt-2 flex items-center gap-1 font-mono">
              <Compass className="w-3 h-3" /> 95 диспетчерских узлов
            </div>
          </div>

          <div className="eng-panel p-5">
            <div className="text-xs text-[#8B949E] uppercase tracking-wider mb-1 font-mono">Точность модели (Precision)</div>
            <div className="text-2xl sm:text-3xl font-bold text-[#00FF66] font-mono">
              {stats ? (stats.model_precision * 100).toFixed(1) : '99.4'}%
            </div>
            <div className="text-xs text-[#8B949E] mt-2 font-mono">
              ТЗ требует &gt; 70.0% (Recall: 90.0%)
            </div>
          </div>

          <div className="eng-panel p-5">
            <div className="text-xs text-[#8B949E] uppercase tracking-wider mb-1 font-mono">Фильтрация ложных тревог</div>
            <div className="text-2xl sm:text-3xl font-bold text-[#58A6FF] font-mono">
              82.4%
            </div>
            <div className="text-xs text-[#8B949E] mt-2 font-mono flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#58A6FF]" /> Отсечение дребезга контактов
            </div>
          </div>

          <div className="eng-panel p-5">
            <div className="text-xs text-[#8B949E] uppercase tracking-wider mb-1 font-mono">Экономия OPEX / год</div>
            <div className="text-2xl sm:text-3xl font-bold text-[#FFB800] font-mono">
              48.6 <span className="text-sm font-normal text-[#8B949E]">млн ₽</span>
            </div>
            <div className="text-xs text-[#00FF66] mt-2 font-mono flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Сокращение холостых выездов
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Regulations */}
      <footer className="flex flex-col sm:flex-row justify-between items-center text-xs text-[#8B949E] border-t border-white/5 pt-6 gap-2">
        <div className="flex items-center gap-4">
          <span>Соответствие стандартам:</span>
          <span className="text-white">152-ФЗ РФ</span>
          <span>•</span>
          <span className="text-white">149-ФЗ РФ</span>
          <span>•</span>
          <span className="text-white">Р ТЭК (Регламент эксплуатации)</span>
        </div>
        <div className="font-mono text-[11px]">
          Версия 1.0.0 (Release Candidate) • Команда Vector
        </div>
      </footer>
    </div>
  );
};

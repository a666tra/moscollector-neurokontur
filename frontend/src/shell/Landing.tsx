import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { RiskMap, MapPin } from '../situation/RiskMap';
import { ThemeButton } from '../lib/theme';
import { fmtNum } from '../lib/api';
import { probabilityOf } from '../lib/plain';
import { ObjectItem, PredictionItem } from '../types';

interface Props {
  onEnter: () => void;
  onOpenQuality: () => void;
}

/** First screen «Контуры риска»: live risk map as the backdrop, the idea in one sentence, verified numbers. */
export const Landing: React.FC<Props> = ({ onEnter, onOpenQuality }) => {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  // Short desktop screens (e.g. 1366×768 laptops): smaller headline, no step list — nothing overlaps the KPI row.
  const short = isDesktop && window.innerHeight < 860;
  const [bt, setBt] = useState<any>(null);
  const [perf, setPerf] = useState<any>(null);
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [preds, setPreds] = useState<PredictionItem[]>([]);
  useEffect(() => {
    const get = (u: string) => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
    get('/api/predictions/backtest').then(setBt);
    get('/api/predictions/metrics').then(d => setPerf(d?.performance_benchmark));
    get('/api/objects').then(d => d && setObjects(d));
    get('/api/predictions?limit=300').then(d => d && setPreds(d.items || []));
  }, []);

  const pins: MapPin[] = useMemo(() => {
    const seen = new Set<string>();
    return preds.filter(p => (p.risk_level === 'CRITICAL' || p.risk_level === 'WARNING') && !seen.has(p.object_id) && seen.add(p.object_id))
      .slice(0, 8).map(p => ({ objectId: p.object_id, pct: Math.round(probabilityOf(p) * 100), risk: p.risk_level }));
  }, [preds]);

  const s = bt?.summary?.all;
  const p100 = s?.lgbm_weekly?.precision_at_100?.median;
  const prev = s?.prevalence?.median;
  const channels = typeof bt?.channels === 'number' ? bt.channels.toLocaleString('ru-RU') : '—';
  const kpis = [
    { v: bt?.test_weeks ?? '—', u: ' нед.', t: 'проверки на реальном журнале' },
    { v: fmtNum(s?.lgbm_weekly?.roc_auc?.median, 2), u: '', t: 'ROC-AUC, медиана по неделям' },
    { v: typeof p100 === 'number' ? Math.round(p100 * 100) : '—', u: ' %', t: typeof p100 === 'number' && prev ? `точность топ-100, в ${Math.round(p100 / prev)} раз выше случайной` : 'точность топ-100', accent: true },
    { v: typeof perf?.full_batch_latency_ms === 'number' ? Math.round(perf.full_batch_latency_ms) : '—', u: ' мс', t: 'пересчёт всех каналов' },
  ];

  return (
    <div className="relative min-h-full lg:h-full lg:overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* map backdrop */}
      <div className="absolute inset-x-0 top-0 h-[470px] lg:h-auto lg:inset-0">
        <RiskMap objects={objects} pins={pins} interactive={false}
                 zoom={isDesktop ? 11.3 : 10.3} center={isDesktop ? [55.752, 37.5] : [55.745, 37.62]} />
        <div className="hidden lg:block absolute inset-0 pointer-events-none z-[450]"
             style={{ background: 'linear-gradient(90deg, var(--bg) 0%, var(--bg) 30%, transparent 58%)' }} />
        <div className="lg:hidden absolute inset-x-0 bottom-0 h-[150px] pointer-events-none z-[450]"
             style={{ background: 'linear-gradient(180deg, transparent, var(--bg))' }} />
      </div>

      {/* header */}
      <header className="lg:hidden absolute z-[700] left-4 right-4 top-5 glass rounded-full flex items-center py-1.5 pl-4 pr-1.5">
        <span className="serif italic font-semibold text-[22px] leading-none">НейроКонтур</span>
        <ThemeButton className="ml-auto w-10 h-10 rounded-full flex items-center justify-center" />
      </header>
      <header className="hidden lg:flex absolute z-[700] left-14 right-10 top-7 items-center gap-6">
        <span className="serif italic font-semibold text-[32px] leading-none tracking-[-0.01em]">НейроКонтур</span>
        <span className="num text-[11px] tracking-[.08em]" style={{ color: 'var(--mut)' }}>АО «МОСКОЛЛЕКТОР» · ЛЦТ 2026</span>
        <div className="ml-auto flex items-center gap-2 p-1.5 rounded-full glass">
          <button onClick={onOpenQuality} className="px-3.5 text-sm hover:underline">Как проверяли модель</button>
          <ThemeButton className="w-10 h-10 rounded-full flex items-center justify-center" />
          <button onClick={onEnter} className="btn btn-primary">Начать смену <ArrowUpRight className="w-4 h-4" /></button>
        </div>
      </header>

      {/* content */}
      <div className={`relative z-[600] px-6 pt-[450px] pb-32 lg:p-0 lg:absolute lg:left-14 ${short ? 'lg:top-[100px]' : 'lg:top-[150px]'} lg:w-[560px] flex flex-col gap-5 lg:gap-[22px]`}>
        <h1 className={`serif font-medium tracking-[-0.035em] text-[76px] leading-[.8] ${short ? 'lg:text-[100px]' : 'lg:text-[150px]'} lg:leading-[.82] rise`} style={{ animationDelay: '.1s' }}>
          Контуры<br className="hidden lg:block" /> <i style={{ color: 'var(--ac)' }}>риска</i>
        </h1>
        <p className={`text-base ${short ? 'lg:text-lg' : 'lg:text-xl'} leading-[1.45] max-w-[470px] lg:mt-3.5 rise`} style={{ color: 'var(--mut)', animationDelay: '.25s' }}>
          Каждое утро показываем на карте, где в подземных коллекторах Москвы <b className="font-medium" style={{ color: 'var(--ink)' }}>может случиться поломка в ближайшие 1–3 дня</b> — и что с этим делать.
        </p>
        <div className={`hidden ${short ? '' : 'lg:flex'} flex-col gap-2.5 rise`} style={{ animationDelay: '.35s' }}>
          {[`Модель проверяет ${channels} датчиков`, 'Отмечает на карте опасные места и объясняет почему', 'Диспетчер одним нажатием решает: ремонт, выезд или отбой'].map((t, i) => (
            <div key={i} className="flex items-center gap-3.5 text-[15px]">
              <span className="w-8 h-8 rounded-full flex items-center justify-center num text-[13px] font-semibold" style={{ background: 'var(--sf)', boxShadow: 'var(--shadow)', color: 'var(--ac)' }}>{i + 1}</span>{t}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:hidden border-t-[1.5px] pt-2.5" style={{ borderColor: 'var(--ink)' }}>
          {kpis.map((k, i) => <Kpi key={i} {...k} small />)}
        </div>
        <button onClick={onOpenQuality} className="lg:hidden self-start text-sm underline" style={{ color: 'var(--mut)' }}>Как проверяли модель</button>
      </div>
      <div className="hidden lg:grid absolute z-[600] left-14 bottom-11 w-[620px] grid-cols-4 gap-6 rise" style={{ animationDelay: '.45s' }}>
        {kpis.map((k, i) => <Kpi key={i} {...k} />)}
      </div>

      {/* legend */}
      <div className="hidden lg:flex absolute z-[600] right-10 bottom-9 glass rounded-full items-center gap-4 px-4 py-2.5 text-[13px]">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--cr)' }} />срочно проверить</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--wr)' }} />проверить скоро</span>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--mut)' }}><span className="w-3.5 h-[3px] rounded" style={{ background: 'var(--ac)' }} />коллектор</span>
        <span className="num text-[10px]" style={{ color: 'var(--mut)' }}>демо-стенд · карта схематична</span>
      </div>

      {/* mobile CTA */}
      <div className="lg:hidden fixed z-[800] left-5 right-5 bottom-6 flex flex-col gap-2">
        <button onClick={onEnter} className="h-[60px] rounded-full text-[17px] font-semibold flex items-center justify-center gap-2.5" style={{ background: 'var(--ac)', color: 'var(--act)' }}>
          Начать смену <ArrowUpRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

const Kpi: React.FC<{ v: React.ReactNode; u: string; t: string; accent?: boolean; small?: boolean }> = ({ v, u, t, accent, small }) => (
  <div className={small ? '' : 'border-t-[1.5px] pt-2.5'} style={{ borderColor: accent ? 'var(--ac)' : 'var(--ink)' }}>
    <div className={`serif font-semibold ${small ? 'text-[32px]' : 'text-[50px]'} leading-[.9]`} style={accent ? { color: 'var(--ac)' } : undefined}>
      {v}<span className={small ? 'text-[16px]' : 'text-[22px]'}>{u}</span>
    </div>
    <div className="text-xs mt-1.5" style={{ color: 'var(--mut)' }}>{t}</div>
  </div>
);

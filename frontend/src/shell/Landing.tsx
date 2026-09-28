import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, LineChart } from 'lucide-react';
import { fmtNum } from '../lib/api';
import { useDemoAccess } from '../useDemoAccess';

interface Props {
  onEnter: () => void;
  onOpenQuality: () => void;
}

type Pt = [number, number];
const RISK = { CRITICAL: '#F0443A', WARNING: '#F59E0B', ATTENTION: '#3B8EF0', NORMAL: '#22A06B' } as Record<string, string>;

/** Schematic of the real collector network (from /api/objects/geojson/network), risk points pulse. */
const NetworkSketch: React.FC = () => {
  const [geo, setGeo] = useState<any>(null);
  useEffect(() => { fetch('/api/objects/geojson/network').then(r => r.json()).then(setGeo).catch(() => {}); }, []);
  const view = useMemo(() => {
    if (!geo) return null;
    const all: Pt[] = [];
    geo.features.forEach((f: any) => {
      if (f.geometry.type === 'LineString') all.push(...f.geometry.coordinates);
      else all.push(f.geometry.coordinates);
    });
    const k = Math.cos((55.75 * Math.PI) / 180);
    const xs = all.map(p => p[0] * k), ys = all.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const W = 600, H = 600, pad = 40, s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
    const ox = (W - s * (x1 - x0)) / 2, oy = (H - s * (y1 - y0)) / 2;
    const P = (p: Pt): Pt => [ox + (p[0] * k - x0) * s, H - (oy + (p[1] - y0) * s)];
    return { P, W, H };
  }, [geo]);
  if (!geo || !view) return <div className="w-full aspect-square" />;
  const { P, W, H } = view;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Схема сети коллекторов с точками риска">
      <circle cx={W / 2} cy={H / 2} r={W * 0.46} fill="none" stroke="rgba(255,255,255,.05)" />
      <circle cx={W / 2} cy={H / 2} r={W * 0.3} fill="none" stroke="rgba(255,255,255,.05)" />
      {geo.features.filter((f: any) => f.geometry.type === 'LineString').map((f: any, i: number) => (
        <polyline key={i} points={f.geometry.coordinates.map((c: Pt) => P(c).join(',')).join(' ')}
                  fill="none" stroke="#8E78FF" strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {geo.features.filter((f: any) => f.geometry.type === 'Point').map((f: any, i: number) => {
        const [x, y] = P(f.geometry.coordinates);
        const risk = f.properties?.risk_level || 'NORMAL';
        const r = risk === 'CRITICAL' ? 6 : risk === 'WARNING' ? 5 : 3.5;
        return (
          <g key={i}>
            {risk === 'CRITICAL' && (
              <circle cx={x} cy={y} r={r} fill={RISK[risk]} className="nk-pulse" style={{ transformBox: 'fill-box', animationDelay: `${(i % 7) * 0.3}s` }} />
            )}
            <circle cx={x} cy={y} r={r} fill={RISK[risk] || RISK.NORMAL} stroke="#0D0C11" strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
};

export const Landing: React.FC<Props> = ({ onEnter, onOpenQuality }) => {
  const [bt, setBt] = useState<any>(null);
  const [perf, setPerf] = useState<any>(null);
  const demo = useDemoAccess();
  useEffect(() => {
    fetch('/api/predictions/backtest').then(r => (r.ok ? r.json() : null)).then(setBt).catch(() => {});
    fetch('/api/predictions/metrics').then(r => (r.ok ? r.json() : null)).then(d => setPerf(d?.performance_benchmark)).catch(() => {});
  }, []);
  const s = bt?.summary?.all;
  const p100 = s?.lgbm_weekly?.precision_at_100?.median;
  const prev = s?.prevalence?.median;
  const kpis = [
    { v: bt?.test_weeks ?? '—', u: 'недель', t: 'проверки на реальном журнале 2026 г.' },
    { v: fmtNum(s?.lgbm_weekly?.roc_auc?.median, 2), u: '', t: 'ROC-AUC, медиана по неделям' },
    { v: typeof p100 === 'number' ? Math.round(p100 * 100) : '—', u: '%', t: typeof p100 === 'number' && prev ? `точность топ-100, в ${Math.round(p100 / prev)} раз выше случайной` : 'точность списка топ-100' },
    { v: typeof perf?.full_batch_latency_ms === 'number' ? Math.round(perf.full_batch_latency_ms) : '—', u: 'мс', t: `пересчёт ${bt?.channels ? bt.channels.toLocaleString('ru-RU') : ''} каналов` },
  ];

  return (
    <div className="min-h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      <header className="flex items-center justify-between px-5 sm:px-10 h-16 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <div className="text-sm font-semibold">НейроКонтур</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>АО «Москоллектор» · ОДС</div>
          </div>
        </div>
        <div className="hidden sm:block text-xs" style={{ color: 'var(--muted)' }}>ЛЦТ 2026 · задача 8</div>
      </header>

      <main className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 px-5 sm:px-10 py-10 lg:py-16 max-w-[1400px] w-full mx-auto items-center">
        <div className="space-y-8 max-w-[620px]">
          <div className="text-sm font-medium" style={{ color: 'var(--accent-text)' }}>Прогноз инцидентов в инженерных коллекторах Москвы</div>
          <h1 className="text-[44px] sm:text-[64px] leading-[1.02] font-bold tracking-[-0.03em]">
            Инцидент —<br /><span style={{ color: 'var(--muted)' }}>до того, как он случился.</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
            Каждое утро диспетчер ОДС получает список каналов СМВУ, где в ближайшие 24–72 часа вероятен инцидент:
            с причиной, местом на карте и черновиком заявки на ТО. Решение остаётся за диспетчером.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 border-y" style={{ borderColor: 'var(--line)' }}>
            {kpis.map((k, i) => (
              <div key={i} className={`py-4 ${i % 2 ? 'pl-4' : 'sm:pl-4 first:pl-0'} ${i > 0 ? 'sm:border-l' : ''}`} style={{ borderColor: 'var(--line)' }}>
                <div className="num text-2xl font-semibold">{k.v}<span className="text-sm ml-1" style={{ color: 'var(--muted)' }}>{k.u}</span></div>
                <div className="text-xs mt-1 leading-snug" style={{ color: 'var(--muted)' }}>{k.t}</div>
              </div>
            ))}
          </div>

          <div className="panel p-5 space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Ситуационный центр ОДС</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  <span className="num">{bt?.channels ? bt.channels.toLocaleString('ru-RU') : '—'}</span> каналов · карта · очередь риска · заявки ТО
                </div>
              </div>
              {demo.enabled && <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>демо-смена <span className="num">{demo.badge}</span></span>}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn btn-primary h-11 flex-1 justify-between px-4" onClick={onEnter}>
                Войти в ситуационный центр <ArrowRight className="w-4 h-4" />
              </button>
              <button className="btn btn-secondary h-11" onClick={onOpenQuality}><LineChart className="w-4 h-4" />Как мы проверяли модель</button>
            </div>
          </div>
        </div>

        <div className="relative max-w-[560px] w-full mx-auto">
          <NetworkSketch />
          <div className="absolute left-0 bottom-2 panel px-3 py-2 text-xs flex items-center gap-2" style={{ background: 'var(--surface)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--crit)' }} />
            <span style={{ color: 'var(--muted)' }}>Объекты с критическим прогнозом — по данным модели</span>
          </div>
        </div>
      </main>

      <footer className="px-5 sm:px-10 py-5 text-xs border-t leading-relaxed" style={{ borderColor: 'var(--line)', color: 'var(--faint)' }}>
        События для проверки модели размечены по журналу СМВУ (неисправности, сбои связи, опасные показания газа и температуры) — актов ремонтов в данных нет.
        Стенд не подключён к СМВУ и CMMS заказчика; карта схематичная, без реальных координат узлов.
      </footer>
    </div>
  );
};

export const Logo: React.FC = () => (
  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }} aria-hidden>
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  </div>
);

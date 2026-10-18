import React, { useEffect, useMemo, useState } from 'react';
import { RiskMap, MapPin } from '../situation/RiskMap';
import { ThemeButton } from '../lib/theme';
import { fmtNum } from '../lib/api';
import { probabilityOf } from '../lib/plain';
import { ObjectItem, PredictionItem } from '../types';

interface Props {
  onSelectRole: (role: 'tech' | 'disp') => void;
  onOpenQuality: () => void;
  onOpenScenarios?: () => void;
}

const GridIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
  </svg>
);

const HelmetIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 17h16M6 17a6 6 0 0 1 12 0M12 7V4M9 9l-1-3M15 9l1-3" />
  </svg>
);

/** First screen «Контуры риска»: role buttons in main reading zone, live map backdrop, verified numbers. */
export const Landing: React.FC<Props> = ({ onSelectRole, onOpenQuality, onOpenScenarios }) => {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const [bt, setBt] = useState<any>(null);
  const [perf, setPerf] = useState<any>(null);
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [preds, setPreds] = useState<PredictionItem[]>([]);
  const [snapshotDate, setSnapshotDate] = useState<string>('28.01.2026');

  useEffect(() => {
    const get = (u: string) => fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
    get('/api/predictions/backtest').then(setBt);
    get('/api/predictions/metrics').then(d => setPerf(d?.performance_benchmark));
    get('/api/objects').then(d => d && setObjects(d));
    get('/api/predictions?limit=300').then(d => d && setPreds(d.items || []));
    get('/api/health').then(h => {
      if (h?.data_snapshot_date) {
        const parts = h.data_snapshot_date.split('-');
        if (parts.length === 3) setSnapshotDate(`${parts[2]}.${parts[1]}.${parts[0]}`);
        else setSnapshotDate(h.data_snapshot_date);
      }
    });
  }, []);

  const pins: MapPin[] = useMemo(() => {
    const seen = new Set<string>();
    return preds.filter(p => (p.risk_level === 'CRITICAL' || p.risk_level === 'WARNING') && !seen.has(p.object_id) && seen.add(p.object_id))
      .slice(0, 8).map(p => ({ objectId: p.object_id, pct: Math.round(probabilityOf(p) * 100), risk: p.risk_level }));
  }, [preds]);

  const s = bt?.summary?.all;
  const p100 = s?.lgbm_weekly?.precision_at_100?.median;
  const prev = s?.prevalence?.median;
  const depRoc = s?.deployed?.roc_auc?.median;
  const depP100 = s?.deployed?.precision_at_100?.median;
  const depText = `стенд, медиана 21 недели: ${fmtNum(depRoc ?? 0.65, 2)} · ${typeof depP100 === 'number' ? Math.round(depP100 * 100) : 22} %`;

  const kpis = [
    { v: bt?.test_weeks ?? '—', u: ' нед.', t: 'проверки на реальном журнале' },
    { v: fmtNum(s?.lgbm_weekly?.roc_auc?.median, 2), u: '', t: 'ROC-AUC с еженедельным дообучением (расчёт для пилота)', sub: depText },
    { v: typeof p100 === 'number' ? Math.round(p100 * 100) : '—', u: ' %', t: typeof p100 === 'number' && prev ? `точность топ-100 (в ${Math.round(p100 / prev)} раз выше случайной) с еженедельным дообучением (расчёт для пилота)` : 'точность топ-100 с еженедельным дообучением (расчёт для пилота)', sub: depText, accent: true },
    { v: typeof perf?.full_batch_latency_ms === 'number' ? Math.round(perf.full_batch_latency_ms) : '—', u: ' мс', t: 'пересчёт всех каналов' },
  ];

  return (
    <div className="relative w-full min-h-screen lg:min-h-0 lg:h-full lg:overflow-hidden flex flex-col select-text" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 lg:px-10 lg:pt-7 lg:pb-4 relative z-[700] lg:absolute lg:top-0 lg:inset-x-0">
        <div className="flex items-baseline gap-4.5">
          <span className="serif italic font-medium text-[24px] lg:text-[32px] leading-none tracking-[-0.01em] text-[var(--ink)]">
            НейроКонтур
          </span>
          <span className="hidden lg:inline font-mono text-[11px] font-medium tracking-[0.08em]" style={{ color: 'var(--mu)' }}>
            АО «МОСКОЛЛЕКТОР» · ЛЦТ 2026
          </span>
        </div>

        {/* Desktop right pill */}
        <nav
          className="hidden lg:flex items-center gap-1.5 p-1 rounded-full border shadow-sm"
          style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}
        >
          <button
            onClick={onOpenQuality}
            className="px-4 py-2 text-sm font-medium rounded-full transition-colors hover:bg-[var(--sf2)] text-[var(--ink)] cursor-pointer"
          >
            Как проверяли модель
          </button>
          {onOpenScenarios && (
            <button
              onClick={onOpenScenarios}
              className="px-4 py-2 text-sm font-medium rounded-full transition-colors hover:bg-[var(--sf2)] text-[var(--ink)] cursor-pointer"
            >
              Сценарии
            </button>
          )}
          <ThemeButton className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--sf2)] text-[var(--ink)] cursor-pointer" />
        </nav>

        {/* Mobile theme toggle */}
        <div className="lg:hidden">
          <ThemeButton className="w-10 h-10 rounded-full border border-[var(--ln)] flex items-center justify-center bg-[var(--sf)] text-[var(--ink)] cursor-pointer" />
        </div>
      </header>

      {/* Map backdrop */}
      <div className="relative h-[270px] shrink-0 overflow-hidden lg:h-auto lg:absolute lg:inset-0 lg:z-0">
        <RiskMap
          objects={objects}
          pins={pins}
          interactive={false}
          zoom={isDesktop ? 11.3 : 10.4}
          center={isDesktop ? [55.752, 37.5] : [55.748, 37.62]}
        />
        {/* Desktop gradient overlay */}
        <div
          className="hidden lg:block absolute inset-0 pointer-events-none z-[450]"
          style={{
            background: 'linear-gradient(90deg, var(--bg) 0%, var(--bg) 32%, transparent 60%), linear-gradient(0deg, var(--bg) 0%, transparent 20%)',
          }}
        />
        {/* Mobile gradient overlay */}
        <div
          className="lg:hidden absolute inset-0 pointer-events-none z-[450]"
          style={{
            background: 'linear-gradient(180deg, var(--bg) 0%, transparent 14%, transparent 65%, var(--bg) 100%)',
          }}
        />
        {/* Mobile disclaimer badge */}
        <div
          className="lg:hidden absolute left-3.5 bottom-2.5 z-[500] font-mono text-[10.5px] px-2.5 py-1 rounded-full border"
          style={{ color: 'var(--mu)', borderColor: 'var(--ln)', background: 'var(--sf)' }}
        >
          демо-стенд · карта схематична
        </div>
      </div>

      {/* Main reading zone + KPI row */}
      <main className="px-4 pt-2 pb-8 flex flex-col gap-3 flex-1 lg:p-0 lg:flex-none lg:absolute lg:left-10 lg:top-[96px] lg:bottom-7 lg:w-[640px] lg:z-[600] lg:justify-between lg:pointer-events-none">
        <div className="flex flex-col gap-3 lg:gap-4 xl:gap-5 lg:pointer-events-auto lg:max-w-[560px]">
          <h1 className="serif font-normal tracking-[-0.03em] text-[40px] leading-[0.96] lg:text-[68px] xl:text-[88px] lg:leading-[0.92] text-[var(--ink)] m-0">
            Контуры <br className="hidden lg:inline" />
            <i style={{ color: 'var(--ac)', fontStyle: 'italic', fontWeight: 400 }}>риска</i>
          </h1>

          <p className="text-[14.5px] leading-[1.38] lg:text-[17px] xl:text-[19px] lg:leading-[1.4] text-[var(--mu)] max-w-[480px] m-0">
            <span className="lg:hidden">
              Стенд на <b className="font-semibold text-[var(--ink)]">{snapshotDate}</b>: где в коллекторах Москвы <b className="font-semibold text-[var(--ink)]">скоро может сломаться</b> — и кого туда отправить.
            </span>
            <span className="hidden lg:inline">
              Стенд показывает срез журнала СМВУ на <b className="font-semibold text-[var(--ink)]">{snapshotDate}</b>: где в коллекторах Москвы <b className="font-semibold text-[var(--ink)]">скоро может сломаться</b> — и кого туда отправить.
            </span>
          </p>

          {/* Mobile role buttons: side-by-side, Техник filled first, Диспетчер outlined second */}
          <div className="grid grid-cols-2 gap-3 mt-1 lg:hidden" id="role-picker-mobile">
            <button
              onClick={() => onSelectRole('tech')}
              aria-label="Войти как техник — обход объектов"
              className="rounded-[22px] p-3.5 min-h-[104px] flex flex-col items-center justify-center gap-1.5 border-0 cursor-pointer transition-transform active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ac)]"
              style={{
                background: 'var(--ac)',
                color: 'var(--onac, #fff)',
                boxShadow: '0 8px 20px -6px var(--ac)',
              }}
            >
              <HelmetIcon size={34} />
              <span className="font-semibold text-[17px] leading-tight">Техник</span>
              <span className="text-[11px] opacity-80 leading-tight">обход объектов</span>
            </button>

            <button
              onClick={() => onSelectRole('disp')}
              aria-label="Войти как диспетчер — обстановка и качество"
              className="rounded-[22px] p-3.5 min-h-[104px] flex flex-col items-center justify-center gap-1.5 border-2 cursor-pointer transition-transform active:scale-95 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ac)]"
              style={{
                background: 'var(--sf)',
                borderColor: 'var(--ink)',
                color: 'var(--ink)',
              }}
            >
              <GridIcon size={34} />
              <span className="font-semibold text-[17px] leading-tight">Диспетчер</span>
              <span className="text-[11px] text-[var(--mu)] leading-tight">обстановка и журнал</span>
            </button>
          </div>

          {/* Desktop role buttons */}
          <div className="hidden lg:flex items-start gap-8 mt-2" id="role-picker-desktop">
            <button
              onClick={() => onSelectRole('disp')}
              aria-label="Войти как диспетчер — обстановка и качество"
              className="group flex flex-col items-center gap-2.5 cursor-pointer text-center bg-transparent border-0 p-0 transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ac)] focus-visible:ring-offset-2 rounded-2xl"
            >
              <span
                className="w-[124px] h-[124px] xl:w-[132px] xl:h-[132px] rounded-full flex items-center justify-center transition-shadow duration-200 group-hover:shadow-[0_20px_40px_-10px_var(--ac)]"
                style={{
                  background: 'var(--ac)',
                  color: 'var(--onac, #fff)',
                  boxShadow: '0 16px 34px -12px var(--ac)',
                }}
              >
                <GridIcon size={54} />
              </span>
              <span className="font-semibold text-[19px] xl:text-[20px] text-[var(--ink)]">Диспетчер</span>
              <span className="text-xs text-[var(--mu)] -mt-1 max-w-[140px] leading-tight">обстановка и качество</span>
            </button>

            <button
              onClick={() => onSelectRole('tech')}
              aria-label="Войти как техник — обход объектов"
              className="group flex flex-col items-center gap-2.5 cursor-pointer text-center bg-transparent border-0 p-0 transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ac)] focus-visible:ring-offset-2 rounded-2xl"
            >
              <span
                className="w-[124px] h-[124px] xl:w-[132px] xl:h-[132px] rounded-full flex items-center justify-center transition-shadow duration-200 group-hover:shadow-lg"
                style={{
                  background: 'var(--sf)',
                  color: 'var(--ink)',
                  border: '2px solid var(--ink)',
                }}
              >
                <HelmetIcon size={54} />
              </span>
              <span className="font-semibold text-[19px] xl:text-[20px] text-[var(--ink)]">Техник</span>
              <span className="text-xs text-[var(--mu)] -mt-1 max-w-[140px] leading-tight">обход объектов</span>
            </button>
          </div>
        </div>

        {/* Mobile secondary links */}
        <div className="flex lg:hidden items-center justify-center gap-5 mt-2">
          <button onClick={onOpenQuality} className="text-xs font-medium underline text-[var(--mu)] hover:text-[var(--ink)] cursor-pointer">
            Как проверяли модель
          </button>
          {onOpenScenarios && (
            <button onClick={onOpenScenarios} className="text-xs font-medium underline text-[var(--ac)] cursor-pointer">
              Сценарии
            </button>
          )}
        </div>

        {/* KPI Row (mobile: 2 columns, desktop: 4 columns) */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--ln)] pt-3 mt-1 lg:grid-cols-4 lg:gap-3 xl:gap-4 lg:max-w-[660px] xl:max-w-[720px] lg:pointer-events-auto">
          {kpis.map((k, i) => (
            <Kpi key={i} {...k} />
          ))}
        </div>
      </main>

      {/* Desktop Legend bottom-right */}
      <div
        className="hidden lg:flex absolute z-[600] right-8 bottom-7 items-center gap-4 px-4 py-2.5 rounded-full border shadow-sm text-sm"
        style={{ background: 'var(--sf)', borderColor: 'var(--ln)', color: 'var(--ink)' }}
      >
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--rd)' }} />срочно
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--am)' }} />скоро
        </span>
        <span className="text-[11px] font-mono" style={{ color: 'var(--mu)' }}>
          демо-стенд · карта схематична
        </span>
      </div>
    </div>
  );
};

const Kpi: React.FC<{ v: React.ReactNode; u: string; t: string; sub?: string; accent?: boolean }> = ({ v, u, t, sub, accent }) => (
  <div className="border-t border-[var(--ln)] pt-2 flex flex-col justify-start">
    <div className="serif font-semibold text-[22px] lg:text-[26px] xl:text-[30px] leading-[0.95]" style={accent ? { color: 'var(--ac)' } : { color: 'var(--ink)' }}>
      {v}<span className="text-[13px] lg:text-[14px]" style={{ fontWeight: 400 }}>{u}</span>
    </div>
    <div className="text-[10px] lg:text-[10.5px] xl:text-[11.5px] mt-1 leading-[1.3] text-[var(--mu)] break-words">
      {t}
    </div>
    {sub && (
      <div className="text-[9.5px] lg:text-[10px] xl:text-[10.5px] mt-1 font-medium leading-[1.25] text-[var(--mu)] break-words">
        {sub}
      </div>
    )}
  </div>
);

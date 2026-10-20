import { ScenarioRunResponse } from '../types';
import { incidentInScenario } from './scenarioLabels';

export interface LiveCounts {
  fast: number;
  /** null when the detector is not shown for the selected scenario */
  staticDedup: number | null;
  naive: number | null;
}

/**
 * Single source of truth for the running alert counters shown in the player and in the timeline lanes.
 * The totals are exact (from the API); the split over time is conventional:
 * the static/naive totals are spread evenly over the moments of the fast-contour alerts.
 */
export function computeLiveCounts(
  run: ScenarioRunResponse | null,
  scenarioId: string,
  mode: 'day' | 'month',
  currentMinute: number
): LiveCounts | null {
  const comp = run?.comparison;
  if (!comp?.fast || !comp?.static_dedup || !comp?.naive) return null;
  const totalFast = comp.fast.alerts_total;
  const totalStatic = comp.static_dedup.alerts_total;
  const totalNaive = comp.naive.alerts_total;
  if (![totalFast, totalStatic, totalNaive].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;

  const isMonth = mode === 'month';
  const isAll = scenarioId === 'all';
  const maxMinutes = isMonth ? 30 : 1440;
  const m = Math.min(Math.max(0, currentMinute), maxMinutes);
  const isAtEnd = m >= maxMinutes - 0.001;

  const raw = run?.incident_list || [];
  const scenarioAlerts = raw.filter((inc) => incidentInScenario(inc, scenarioId));
  const incidentOnly = raw.filter(
    (inc) => !inc.is_reminder && !inc.is_escalation && incidentInScenario(inc, scenarioId)
  );

  const distribute = (total: number, ts: number[]) => {
    if (ts.length === 0) return [] as Array<{ t: number; count: number }>;
    const base = Math.floor(total / ts.length);
    const rem = total % ts.length;
    return ts.map((t, idx) => ({ t, count: base + (idx < rem ? 1 : 0) }));
  };
  const countUpTo = (dist: Array<{ t: number; count: number }>, maxTotal: number) => {
    if (isAtEnd) return maxTotal;
    let sum = 0;
    for (const item of dist) if (item.t <= m) sum += item.count;
    return sum;
  };

  if (isMonth) {
    const daily = (list: typeof raw) => {
      const d = Array(30).fill(0);
      list.forEach((inc) => {
        d[Math.min(29, Math.max(0, Math.floor(inc.ts / 86400)))]++;
      });
      return d as number[];
    };
    const incDaily = daily(incidentOnly);
    const fastDaily = daily(scenarioAlerts);
    const totInc = incDaily.reduce((a, b) => a + b, 0) || 1;
    const floorDay = Math.floor(m);
    const upTo = (arr: number[]) => arr.slice(0, floorDay).reduce((a, b) => a + b, 0);
    return {
      fast: isAtEnd ? fastDaily.reduce((a, b) => a + b, 0) : upTo(fastDaily),
      staticDedup: isAll
        ? isAtEnd
          ? totalStatic
          : upTo(incDaily.map((c) => Math.round(totalStatic * (c / totInc))))
        : null,
      naive: isAll
        ? isAtEnd
          ? totalNaive
          : upTo(incDaily.map((c) => Math.round(totalNaive * (c / totInc))))
        : null,
    };
  }

  const fastTs = scenarioAlerts.map((inc) => inc.ts / 60).sort((a, b) => a - b);
  return {
    fast: isAll
      ? countUpTo(distribute(totalFast, fastTs), totalFast)
      : isAtEnd
        ? fastTs.length
        : fastTs.filter((t) => t <= m).length,
    staticDedup: isAll ? countUpTo(distribute(totalStatic, fastTs), totalStatic) : null,
    naive: isAll ? countUpTo(distribute(totalNaive, fastTs), totalNaive) : null,
  };
}

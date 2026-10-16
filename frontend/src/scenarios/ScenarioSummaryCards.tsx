import React from 'react';
import { Target, Clock, ShieldAlert, ArrowDownRight, Layers } from 'lucide-react';
import { ScenarioRunResponse } from '../types';
import { fmtInt, fmtNum, fmtPct } from '../lib/api';

interface ScenarioSummaryCardsProps {
  data: ScenarioRunResponse;
}

export const ScenarioSummaryCards: React.FC<ScenarioSummaryCardsProps> = ({ data }) => {
  const { summary, comparison, ratios } = data;
  const s1Lead = summary.scenarios?.S1?.lead_time_median_min;
  const s3Lead = summary.scenarios?.S3?.lead_time_median_min;
  const overallLead = summary.lead_time?.median_min;

  const formatSignedMin = (val?: number | null) => {
    if (val === null || val === undefined || !Number.isFinite(val)) return '—';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1).replace('.', ',')} мин`;
  };

  const isNegative = (val?: number | null) => typeof val === 'number' && val < 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Card 1: Detection Rate */}
      <div className="panel p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Охват аварий</span>
          <Target className="w-4 h-4" style={{ color: 'var(--ac)' }} />
        </div>
        <div>
          <div className="serif font-semibold text-3xl sm:text-4xl leading-none" style={{ color: 'var(--ink)' }}>
            {summary.overall.detected_events}{' '}
            <span className="text-xl font-normal" style={{ color: 'var(--mut)' }}>
              из {summary.overall.total_events}
            </span>
          </div>
          <div className="text-sm font-semibold mt-1" style={{ color: 'var(--ok)' }}>
            {fmtPct(summary.overall.detection_rate, 1)} обнаружено
          </div>
        </div>
        <div className="text-xs pt-2 border-t" style={{ borderColor: 'var(--ln)', color: 'var(--mut)' }}>
          Аварий внесено → обнаружено (наш контур)
        </div>
      </div>

      {/* Card 2: Lead Time */}
      <div className="panel p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Заранее до порога</span>
          <Clock className="w-4 h-4" style={{ color: 'var(--ac)' }} />
        </div>
        <div>
          <div
            className="serif font-semibold text-3xl sm:text-4xl leading-none"
            style={{
              color: isNegative(overallLead) ? 'var(--wr)' : 'var(--ac)',
            }}
          >
            {formatSignedMin(overallLead)}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
            <span
              className="px-2 py-0.5 rounded-full font-medium"
              style={{
                background: isNegative(s1Lead) ? 'var(--wrs)' : 'var(--acs)',
                color: isNegative(s1Lead) ? 'var(--wr)' : 'var(--ac)',
              }}
            >
              S1 (газ): {formatSignedMin(s1Lead)}
            </span>
            <span
              className="px-2 py-0.5 rounded-full font-medium"
              style={{
                background: isNegative(s3Lead) ? 'var(--wrs)' : 'var(--acs)',
                color: isNegative(s3Lead) ? 'var(--wr)' : 'var(--ac)',
              }}
            >
              S3 (перегрев): {formatSignedMin(s3Lead)}
            </span>
          </div>
        </div>
        <div className="text-xs pt-2 border-t" style={{ borderColor: 'var(--ln)', color: 'var(--mut)' }}>
          Медиана упреждения до аварийного порога (МНК-наклон)
        </div>
      </div>

      {/* Card 3: False Alarms per 100 channels/day */}
      <div className="panel p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Ложные тревоги</span>
          <ShieldAlert className="w-4 h-4" style={{ color: 'var(--ok)' }} />
        </div>
        <div>
          <div className="serif font-semibold text-3xl sm:text-4xl leading-none" style={{ color: 'var(--ink)' }}>
            {fmtNum(summary.false_alarms?.per_100_channels_per_day, 1)}{' '}
            <span className="text-base font-normal" style={{ color: 'var(--mut)' }}>
              vs {fmtNum(comparison.naive?.false_alarms?.per_100_channels_per_day, 1)}
            </span>
          </div>
          <div className="text-xs font-medium mt-1.5" style={{ color: 'var(--mut)' }}>
            на 100 каналов в сутки (наш контур vs порог)
          </div>
        </div>
        <div className="text-xs pt-2 border-t" style={{ borderColor: 'var(--ln)', color: 'var(--mut)' }}>
          Всего ложных: <b style={{ color: 'var(--ink)' }}>{summary.false_alarms?.count}</b> против{' '}
          <b style={{ color: 'var(--wr)' }}>{comparison.naive?.false_alarms?.count}</b> у порога
        </div>
      </div>

      {/* Card 4: Dispatcher Flow Compression */}
      <div className="panel p-5 flex flex-col justify-between gap-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Поток диспетчеру</span>
          <ArrowDownRight className="w-4 h-4" style={{ color: 'var(--ac)' }} />
        </div>
        <div>
          <div className="text-sm font-medium leading-snug">
            простой порог:{' '}
            <b className="num" style={{ color: 'var(--wr)' }}>
              {fmtInt(comparison.naive?.alerts_total)}
            </b>{' '}
            оповещений <br />
            → наш контур:{' '}
            <b className="num" style={{ color: 'var(--ok)' }}>
              {fmtInt(summary.incidents)}
            </b>{' '}
            инцидентов
          </div>
          <div className="flex flex-col gap-0.5 mt-2 text-xs" style={{ color: 'var(--mut)' }}>
            <div>
              сокращение потока к порогу:{' '}
              <b className="num" style={{ color: 'var(--ac)' }}>
                {fmtNum(ratios?.naive_alerts_to_fast_incidents, 1)}x
              </b>
            </div>
            <div>
              сокращение к порогу с дедупликацией ({fmtInt(comparison.static_dedup?.incidents)}):{' '}
              <b className="num" style={{ color: 'var(--ink)' }}>
                {fmtNum(ratios?.static_dedup_incidents_to_fast_incidents, 1)}x
              </b>
            </div>
          </div>
        </div>
        <div className="text-xs pt-2 border-t" style={{ borderColor: 'var(--ln)', color: 'var(--mut)' }}>
          Повторные тревоги собраны в инциденты (окно 30 мин)
        </div>
      </div>
    </div>
  );
};

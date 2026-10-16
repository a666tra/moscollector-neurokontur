import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Flame,
  Droplets,
  Zap,
  WifiOff,
  Thermometer,
  Wind,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { ScenarioIncidentItem } from '../types';
import { getAlertClassLabel, getSeverityLabel } from './scenarioLabels';

interface ScenarioIncidentTimelineProps {
  incidents: ScenarioIncidentItem[];
  mode: 'day' | 'month';
  onSelectChannel: (channelId: string) => void;
  selectedChannelId?: string | null;
}

type ClassFilter = 'ALL' | 'GAS' | 'TEMP' | 'FIRE' | 'FLOOD' | 'CHATTER' | 'COMM_LOSS';

export const ScenarioIncidentTimeline: React.FC<ScenarioIncidentTimelineProps> = ({
  incidents,
  mode,
  onSelectChannel,
  selectedChannelId,
}) => {
  const [filter, setFilter] = useState<ClassFilter>('ALL');

  const formatIncidentTime = (ts: number, m: 'day' | 'month') => {
    if (m === 'day') {
      const h = Math.floor(ts / 3600);
      const min = Math.floor((ts % 3600) / 60);
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    } else {
      const d = Math.floor(ts / 86400) + 1;
      const h = Math.floor((ts % 86400) / 3600);
      const min = Math.floor((ts % 3600) / 60);
      return `Д.${d} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  };

  const getClassCategory = (cls: string): ClassFilter => {
    if (cls.startsWith('GAS')) return 'GAS';
    if (cls.startsWith('TEMP')) return 'TEMP';
    if (cls === 'FIRE') return 'FIRE';
    if (cls === 'FLOOD') return 'FLOOD';
    if (cls === 'CHATTER') return 'CHATTER';
    if (cls === 'COMM_LOSS') return 'COMM_LOSS';
    return 'ALL';
  };


  const getClassIcon = (cls: string) => {
    if (cls.startsWith('GAS')) return <Wind className="w-3.5 h-3.5" />;
    if (cls.startsWith('TEMP')) return <Thermometer className="w-3.5 h-3.5" />;
    if (cls === 'FIRE') return <Flame className="w-3.5 h-3.5" />;
    if (cls === 'FLOOD') return <Droplets className="w-3.5 h-3.5" />;
    if (cls === 'CHATTER') return <Zap className="w-3.5 h-3.5" />;
    if (cls === 'COMM_LOSS') return <WifiOff className="w-3.5 h-3.5" />;
    return <Radio className="w-3.5 h-3.5" />;
  };

  const getSeverityStyle = (severity: string) => {
    const s = severity?.toUpperCase();
    if (s === 'CRITICAL' || s === 'ALARM') {
      return { background: 'var(--crs)', color: 'var(--cr)', border: '1px solid var(--cr)' };
    }
    if (s === 'WARNING') {
      return { background: 'var(--wrs)', color: 'var(--wr)', border: '1px solid var(--wr)' };
    }
    return { background: 'var(--ats)', color: 'var(--at)', border: '1px solid var(--at)' };
  };

  const filteredIncidents = useMemo(() => {
    const list = filter === 'ALL' ? incidents : incidents.filter(i => getClassCategory(i.cls) === filter);
    return list.slice(0, 200);
  }, [incidents, filter]);

  const countsByCategory = useMemo(() => {
    const map: Record<ClassFilter, number> = {
      ALL: incidents.length,
      GAS: 0,
      TEMP: 0,
      FIRE: 0,
      FLOOD: 0,
      CHATTER: 0,
      COMM_LOSS: 0,
    };
    for (const inc of incidents) {
      const cat = getClassCategory(inc.cls);
      if (cat !== 'ALL') map[cat] = (map[cat] || 0) + 1;
    }
    return map;
  }, [incidents]);

  return (
    <div className="panel p-5 flex flex-col gap-4">
      {/* Header and Filter Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--ln)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold">
              Лента инцидентов детектора
            </h2>
            <span className="num text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--sf2)', color: 'var(--mut)' }}>
              {filteredIncidents.length} из {incidents.length}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--mut)' }}>
            Нажмите на инцидент или канал, чтобы открыть телеметрию и график эталона
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`h-7 px-2.5 rounded-full font-medium transition-colors ${
              filter === 'ALL' ? 'font-semibold' : ''
            }`}
            style={
              filter === 'ALL'
                ? { background: 'var(--ink)', color: 'var(--bg)' }
                : { background: 'var(--sf2)', color: 'var(--mut)' }
            }
            title="Все инциденты"
          >
            Все ({countsByCategory.ALL})
          </button>
          <button
            type="button"
            onClick={() => setFilter('GAS')}
            className={`h-7 px-2.5 rounded-full font-medium transition-colors ${
              filter === 'GAS' ? 'font-semibold' : ''
            }`}
            style={
              filter === 'GAS'
                ? { background: 'var(--ac)', color: 'var(--act)' }
                : { background: 'var(--sf2)', color: 'var(--mut)' }
            }
            title="Метан (GAS_RATE, GAS_WARNING, GAS_ALARM)"
          >
            Метан ({countsByCategory.GAS})
          </button>
          <button
            type="button"
            onClick={() => setFilter('TEMP')}
            className={`h-7 px-2.5 rounded-full font-medium transition-colors ${
              filter === 'TEMP' ? 'font-semibold' : ''
            }`}
            style={
              filter === 'TEMP'
                ? { background: 'var(--ac)', color: 'var(--act)' }
                : { background: 'var(--sf2)', color: 'var(--mut)' }
            }
            title="Температура (TEMP_RATE, TEMP_WARNING, TEMP_ALARM)"
          >
            Температура ({countsByCategory.TEMP})
          </button>
          <button
            type="button"
            onClick={() => setFilter('FIRE')}
            className={`h-7 px-2.5 rounded-full font-medium transition-colors ${
              filter === 'FIRE' ? 'font-semibold' : ''
            }`}
            style={
              filter === 'FIRE'
                ? { background: 'var(--ac)', color: 'var(--act)' }
                : { background: 'var(--sf2)', color: 'var(--mut)' }
            }
            title="Пожар (FIRE)"
          >
            Пожар ({countsByCategory.FIRE})
          </button>
          <button
            type="button"
            onClick={() => setFilter('FLOOD')}
            className={`h-7 px-2.5 rounded-full font-medium transition-colors ${
              filter === 'FLOOD' ? 'font-semibold' : ''
            }`}
            style={
              filter === 'FLOOD'
                ? { background: 'var(--ac)', color: 'var(--act)' }
                : { background: 'var(--sf2)', color: 'var(--mut)' }
            }
            title="Затопление (FLOOD)"
          >
            Затопление ({countsByCategory.FLOOD})
          </button>
          <button
            type="button"
            onClick={() => setFilter('CHATTER')}
            className={`h-7 px-2.5 rounded-full font-medium transition-colors ${
              filter === 'CHATTER' ? 'font-semibold' : ''
            }`}
            style={
              filter === 'CHATTER'
                ? { background: 'var(--ac)', color: 'var(--act)' }
                : { background: 'var(--sf2)', color: 'var(--mut)' }
            }
            title="Дребезг контакта (CHATTER)"
          >
            Дребезг ({countsByCategory.CHATTER})
          </button>
          <button
            type="button"
            onClick={() => setFilter('COMM_LOSS')}
            className={`h-7 px-2.5 rounded-full font-medium transition-colors ${
              filter === 'COMM_LOSS' ? 'font-semibold' : ''
            }`}
            style={
              filter === 'COMM_LOSS'
                ? { background: 'var(--ac)', color: 'var(--act)' }
                : { background: 'var(--sf2)', color: 'var(--mut)' }
            }
            title="Потеря связи (COMM_LOSS)"
          >
            Потеря связи ({countsByCategory.COMM_LOSS})
          </button>
        </div>
      </div>

      {/* Incident List inside fixed-height scrollable container */}
      <div className="max-h-[500px] overflow-y-auto scroll-thin divide-y" style={{ borderColor: 'var(--ln)' }}>
        {filteredIncidents.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--mut)' }}>
            Инцидентов в выбранной категории нет
          </div>
        ) : (
          filteredIncidents.map((inc, idx) => {
            const isSelected = selectedChannelId === inc.channel_id;
            const isMatched = Boolean(inc.matched_truth_event_id);

            return (
              <div
                key={`${inc.channel_id}-${inc.ts}-${idx}`}
                onClick={() => onSelectChannel(inc.channel_id)}
                className={`p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[var(--sf2)] transition-colors ${
                  isSelected ? 'bg-[var(--sf2)] ring-1 ring-[var(--ac)]' : ''
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectChannel(inc.channel_id);
                  }
                }}
                aria-label={`Инцидент ${getAlertClassLabel(inc.cls)} (${inc.cls}) на канале ${inc.channel_id}`}
              >
                {/* Left: Time, Badges, Reason */}
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Timestamp */}
                    <span className="num font-semibold text-xs flex items-center gap-1" style={{ color: 'var(--ink)' }}>
                      <Clock className="w-3 h-3 text-[var(--mut)]" />
                      {formatIncidentTime(inc.ts, mode)}
                    </span>

                    {/* Severity Badge */}
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={getSeverityStyle(inc.severity)}
                      title={inc.severity}
                    >
                      {getSeverityLabel(inc.severity)}
                    </span>

                    {/* Class Badge */}
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1"
                      style={{ background: 'var(--sf2)', color: 'var(--ink)' }}
                      title={inc.cls}
                    >
                      {getClassIcon(inc.cls)}
                      <span>{getAlertClassLabel(inc.cls)}</span>
                    </span>

                    {/* Channel ID */}
                    <span className="num text-xs font-mono font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--sf3)', color: 'var(--ink)' }}>
                      канал {inc.channel_id}
                    </span>

                    {/* Reminders / Escalations */}
                    {inc.is_reminder && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--sf2)', color: 'var(--mut)' }} title="Напоминание">
                        напоминание
                      </span>
                    )}
                    {inc.is_escalation && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--crs)', color: 'var(--cr)' }} title="Эскалация (is_escalation)">
                        эскалация
                      </span>
                    )}
                  </div>

                  {/* Reason Text */}
                  <div className="text-xs sm:text-sm font-medium leading-snug line-clamp-2" style={{ color: 'var(--ink)' }}>
                    {inc.reason_ru}
                  </div>
                </div>

                {/* Right: Truth event marker and Action */}
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  {isMatched ? (
                    <span
                      className="chip text-[11px] py-1 px-2.5 h-auto rounded-full font-medium flex items-center gap-1.5"
                      style={{ background: 'var(--oks)', color: 'var(--ok)' }}
                      title={`Совпало с эталонным событием ${inc.matched_truth_event_id}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>подтверждено эталоном</span>
                    </span>
                  ) : (
                    <span
                      className="chip text-[11px] py-1 px-2.5 h-auto rounded-full font-medium flex items-center gap-1.5"
                      style={{ background: 'var(--wrs)', color: 'var(--wr)' }}
                      title="Не совпало с заложенным эталоном аварии (ложное срабатывание)"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>ложное</span>
                    </span>
                  )}

                  <span className="icon-btn w-7 h-7 text-[var(--mut)]" title="Открыть телеметрию">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

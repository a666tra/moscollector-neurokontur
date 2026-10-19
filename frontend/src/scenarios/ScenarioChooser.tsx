import React from 'react';
import {
  LayoutGrid,
  Wind,
  Zap,
  Thermometer,
  Flame,
  Droplets,
  Activity,
  WifiOff,
  Radio,
} from 'lucide-react';
import { ScenarioCatalogResponse } from '../types';

interface ScenarioChooserProps {
  selectedId: string; // 'all' | 'S1' | ... | 'S8'
  onSelect: (id: string) => void;
  activeSeed: number;
  catalog?: ScenarioCatalogResponse | null;
}

export const SCENARIO_ICONS: Record<string, React.ElementType> = {
  all: LayoutGrid,
  S1: Wind,
  S2: Zap,
  S3: Thermometer,
  S4: Flame,
  S5: Droplets,
  S6: Activity,
  S7: WifiOff,
  S8: Radio,
};

export const SCENARIO_SHORT_LABELS: Record<string, string> = {
  all: 'Все сразу',
  S1: 'Газ',
  S2: 'Скачок газа',
  S3: 'Перегрев',
  S4: 'Пожар',
  S5: 'Затопление',
  S6: 'Дребезг',
  S7: 'Связь',
  S8: 'Колебание',
};

export const ScenarioChooser: React.FC<ScenarioChooserProps> = ({
  selectedId,
  onSelect,
  activeSeed,
  catalog,
}) => {
  const catalogScenarios = catalog?.scenarios || [];

  const items = [
    {
      id: 'all',
      name: 'Все сценарии',
      shortLabel: 'Все сразу',
      icon: LayoutGrid,
    },
    ...catalogScenarios.map((s) => ({
      id: s.id,
      name: `${s.id} ${s.name}`,
      shortLabel: SCENARIO_SHORT_LABELS[s.id] || s.id,
      icon: SCENARIO_ICONS[s.id] || Activity,
    })),
  ];

  const currentItem = items.find((i) => i.id === selectedId) || items[0];

  return (
    <div className="space-y-3">
      {/* Horizontal scrollable radio group */}
      <div
        role="radiogroup"
        aria-label="Выбор сценария"
        className="flex items-start gap-1.5 sm:gap-3.5 overflow-x-auto py-1.5 px-1 scrollbar-none"
      >
        {items.map((item) => {
          const isSelected = selectedId === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(item.id)}
              className="flex-none flex flex-col items-center gap-1.5 p-0 bg-transparent border-0 cursor-pointer group focus:outline-none w-[68px] sm:w-[90px]"
            >
              <span
                className="w-[50px] h-[50px] sm:w-[66px] sm:h-[66px] rounded-full flex items-center justify-center transition-all duration-200"
                style={{
                  background: isSelected ? 'var(--ac)' : 'var(--sf2)',
                  color: isSelected ? 'var(--onac)' : 'var(--ink)',
                  transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: isSelected ? '0 8px 20px -6px var(--ac)' : 'none',
                }}
              >
                <Icon className="w-6 h-6 sm:w-[30px] sm:h-[30px]" />
              </span>

              <span
                className="text-xs leading-tight text-center transition-colors"
                style={{
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? 'var(--ink)' : 'var(--mu)',
                }}
              >
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected scenario name & seed caption */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs sm:text-sm">
        <span className="font-semibold text-[var(--ink)]">
          {currentItem.name}
        </span>
        <span className="text-[var(--mu)] font-mono">
          смена #{activeSeed} · прогон воспроизводим
        </span>
      </div>
    </div>
  );
};

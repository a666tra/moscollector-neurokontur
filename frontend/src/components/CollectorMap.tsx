import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ObjectItem } from '../types';
import { Filter } from 'lucide-react';

interface CollectorMapProps {
  objects: ObjectItem[];
  onSelectObject: (obj: ObjectItem) => void;
  selectedObjectId?: string;
}

export const CollectorMap: React.FC<CollectorMapProps> = ({
  objects,
  onSelectObject,
  selectedObjectId
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [filterRisk, setFilterRisk] = useState<string>('ALL');
  const [filterCorridor, setFilterCorridor] = useState<string>('ALL');

  const corridors = Array.from(new Set(objects.map(o => o.corridor))).filter(Boolean);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Initialize Leaflet map centered on Moscow
    const map = L.map(mapContainerRef.current, {
      center: [55.751244, 37.618423],
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Standard OpenStreetMap tiles (styled with dark CSS filter in index.css)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Load collector network GeoJSON
    fetch('/api/objects/geojson/network')
      .then(res => res.json())
      .then(geoData => {
        if (!mapInstanceRef.current) return;
        const lineLayer = L.geoJSON(geoData, {
          style: (feature) => {
            if (feature?.geometry.type === 'LineString') {
              return {
                color: '#4C9BFF',
                weight: 3,
                opacity: 0.7,
                dashArray: '6, 6'
              };
            }
            return {};
          },
          filter: (feature) => feature.geometry.type === 'LineString'
        }).addTo(mapInstanceRef.current);
        geojsonLayerRef.current = lineLayer;
      })
      .catch(err => console.error('GeoJSON load error:', err));

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update object markers when filter or objects change
  useEffect(() => {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    const filtered = objects.filter(obj => {
      if (filterRisk !== 'ALL' && obj.risk_level !== filterRisk) return false;
      if (filterCorridor !== 'ALL' && obj.corridor !== filterCorridor) return false;
      return true;
    });

    filtered.forEach(obj => {
      const isSelected = obj.object_id === selectedObjectId;
      let color = '#2FBF71';
      let radius = 6;

      if (obj.risk_level === 'CRITICAL') {
        color = '#F0453A';
        radius = 9;
      } else if (obj.risk_level === 'WARNING') {
        color = '#F5A524';
        radius = 7.5;
      } else if (obj.risk_level === 'ATTENTION') {
        color = '#4C9BFF';
        radius = 6.5;
      }

      if (isSelected) {
        radius += 4;
      }

      const marker = L.circleMarker([obj.lat, obj.lon], {
        radius: radius,
        fillColor: color,
        fillOpacity: isSelected ? 1.0 : 0.85,
        color: isSelected ? '#FFFFFF' : 'rgba(0,0,0,0.8)',
        weight: isSelected ? 3 : 1.5
      });

      // Bind tooltip
      marker.bindTooltip(
        `<div style="font-family: 'Inter', sans-serif; font-size: 11px;">
          <strong>${obj.name}</strong><br/>
          Трасса: ${obj.route_name} (<span style="font-family: 'JetBrains Mono', monospace;">${obj.picket}</span>)<br/>
          Датчиков: <span style="font-family: 'JetBrains Mono', monospace;">${obj.sensor_count}</span> · Отказов 24ч: <span style="font-family: 'JetBrains Mono', monospace;">${obj.predicted_failures_count}</span>
        </div>`,
        { direction: 'top', className: 'dark-tooltip' }
      );

      marker.on('click', () => {
        onSelectObject(obj);
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [objects, filterRisk, filterCorridor, selectedObjectId, onSelectObject]);

  return (
    <div className="relative w-full h-[600px] rounded-xl border border-white/10 overflow-hidden bg-[#0B0E14]">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Topology Context Banner */}
      <div className="absolute top-3 left-4 right-4 z-[1000] flex items-center justify-between bg-[#121620]/95 backdrop-blur-md px-3.5 py-2 rounded-lg border border-white/10 text-xs text-[#9AA3B2]">
        <div className="flex items-center gap-2">
          <span className="text-[#F5A524]">ℹ️</span>
          <span>
            <strong className="text-[#E7EAF0]">Топология сети коллекторов (149-ФЗ):</strong> GPS-координаты узлов деперсонализированы в целях защиты КИИ. Инженерная привязка сохранена по технологическим пикетам (ПК1–ПК120) и секторам из тегов СМВУ.
          </span>
        </div>
      </div>

      {/* Floating Filter Overlay */}
      <div className="absolute top-14 left-4 z-[1000] flex flex-wrap gap-2 bg-[#121620]/90 backdrop-blur-md p-2 rounded-lg border border-white/10 text-xs">
        <div className="flex items-center gap-1.5 px-2 py-1 text-[#9AA3B2]">
          <Filter className="w-3.5 h-3.5" />
          <span>Фильтры:</span>
        </div>

        <select
          value={filterRisk}
          onChange={(e) => setFilterRisk(e.target.value)}
          className="bg-[#181D29] text-[#E7EAF0] border border-white/10 rounded-md px-2.5 py-1 text-xs focus:outline-none focus:border-[#7C4DFF]"
        >
          <option value="ALL">Все уровни риска ({objects.length})</option>
          <option value="CRITICAL">🔴 Критические ({objects.filter(o => o.risk_level === 'CRITICAL').length})</option>
          <option value="WARNING">🟡 Предупреждение ({objects.filter(o => o.risk_level === 'WARNING').length})</option>
          <option value="ATTENTION">🔵 Внимание ({objects.filter(o => o.risk_level === 'ATTENTION').length})</option>
          <option value="NORMAL">🟢 В норме ({objects.filter(o => o.risk_level === 'NORMAL').length})</option>
        </select>

        <select
          value={filterCorridor}
          onChange={(e) => setFilterCorridor(e.target.value)}
          className="bg-[#181D29] text-[#E7EAF0] border border-white/10 rounded-md px-2.5 py-1 text-xs focus:outline-none focus:border-[#7C4DFF]"
        >
          <option value="ALL">Все секторы Москвы</option>
          {corridors.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-[#121620]/90 backdrop-blur-md p-3.5 rounded-lg border border-white/10 text-xs space-y-1.5">
        <div className="text-[#9AA3B2] uppercase text-[10px] tracking-wider mb-1 font-medium">Спектр рисков коллекторов</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F0453A]"></span>
          <span>Критический риск (&ge;70%) — Срочное ТО</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F5A524]"></span>
          <span>Предупреждение (&ge;42%) — В план ППР</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4C9BFF]"></span>
          <span>Внимание (20–42%) — Контроль ОДС</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2FBF71]"></span>
          <span>Штатная работа (&lt;20%)</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-[#4C9BFF]"></span>
          <span>Трасса коллектора (825 км)</span>
        </div>
      </div>
    </div>
  );
};

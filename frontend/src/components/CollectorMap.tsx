import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ObjectItem } from '../types';
import { MapPin, AlertTriangle, ShieldCheck, Filter } from 'lucide-react';

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
                color: '#58A6FF',
                weight: 3.5,
                opacity: 0.65,
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
      let color = '#00FF66';
      let radius = 6;

      if (obj.risk_level === 'CRITICAL') {
        color = '#FF3B30';
        radius = 9;
      } else if (obj.risk_level === 'WARNING') {
        color = '#FFB800';
        radius = 7.5;
      } else if (obj.risk_level === 'ATTENTION') {
        color = '#58A6FF';
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
        `<div style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">
          <strong>${obj.name}</strong><br/>
          Трасса: ${obj.route_name} (${obj.picket})<br/>
          Датчиков: ${obj.sensor_count} • Отказов 24ч: ${obj.predicted_failures_count}
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
    <div className="relative w-full h-[600px] rounded border border-white/10 overflow-hidden bg-[#07090E]">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* 149-FZ Topology Disclaimer Banner */}
      <div className="absolute top-3 left-4 right-4 z-[1000] flex items-center justify-between bg-[#0D1117]/95 backdrop-blur-md px-3 py-1.5 rounded border border-white/10 text-[11px] font-mono text-[#8B949E]">
        <div className="flex items-center gap-2">
          <span className="text-[#FFB800]">⚠️</span>
          <span>
            <strong className="text-white">Демонстрационная топология (149-ФЗ):</strong> GPS-координаты узлов деперсонализированы в целях защиты КИИ Москвы. Инженерная привязка сохранена по опорным секторам тоннелей и технологическим пикетам (ПК1–ПК120) из тегов СМВУ.
          </span>
        </div>
      </div>

      {/* Floating Filter Overlay */}
      <div className="absolute top-12 left-4 z-[1000] flex flex-wrap gap-2 bg-[#0D1117]/90 backdrop-blur-md p-2 rounded border border-white/10 text-xs">
        <div className="flex items-center gap-1.5 px-2 py-1 text-[#8B949E] font-mono">
          <Filter className="w-3.5 h-3.5" />
          <span>ФИЛЬТРЫ:</span>
        </div>

        <select
          value={filterRisk}
          onChange={(e) => setFilterRisk(e.target.value)}
          className="bg-[#161B22] text-white border border-white/10 rounded px-2.5 py-1 font-mono text-xs focus:outline-none focus:border-[#00FF66]"
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
          className="bg-[#161B22] text-white border border-white/10 rounded px-2.5 py-1 font-mono text-xs focus:outline-none focus:border-[#00FF66]"
        >
          <option value="ALL">Все секторы Москвы</option>
          {corridors.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-[#0D1117]/90 backdrop-blur-md p-3 rounded border border-white/10 font-mono text-[11px] space-y-1.5">
        <div className="text-[#8B949E] uppercase text-[10px] tracking-wider mb-1">Спектр рисков коллекторов</div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B30]"></span>
          <span>Критический отказ (&ge;70%) — Срочное ТО</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFB800]"></span>
          <span>Предупреждение (&ge;42%) — В план ППР</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#58A6FF]"></span>
          <span>Внимание (20–42%) — Контроль ОДС</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00FF66]"></span>
          <span>Штатная работа (&lt;20%)</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-[#58A6FF]"></span>
          <span>Трасса коллектора (825 км)</span>
        </div>
      </div>
    </div>
  );
};

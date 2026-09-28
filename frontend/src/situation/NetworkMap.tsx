import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Plus, Minus, LocateFixed } from 'lucide-react';
import { ObjectItem } from '../types';

export const RISK_COLOR: Record<string, string> = {
  CRITICAL: '#F0443A', WARNING: '#F59E0B', ATTENTION: '#3B8EF0', NORMAL: '#22A06B',
};
const RISK_RADIUS: Record<string, number> = { CRITICAL: 8, WARNING: 6.5, ATTENTION: 5.5, NORMAL: 4.5 };
const MOSCOW: L.LatLngExpression = [55.751, 37.618];

interface Props {
  objects: ObjectItem[];
  selectedObjectId?: string;
  onSelectObject: (id: string) => void;
}

/** Collector network on a dark basemap: routes from GeoJSON, objects coloured by forecast risk. */
export const NetworkMap: React.FC<Props> = ({ objects, selectedObjectId, onSelectObject }) => {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const onSelect = useRef(onSelectObject);
  onSelect.current = onSelectObject;

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { center: MOSCOW, zoom: 11, zoomControl: false, attributionControl: true });
    // Esri dark canvas: free, no API key; labels on a separate reference layer.
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    L.tileLayer(esri + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Tiles © Esri' }).addTo(m);
    L.tileLayer(esri + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, opacity: 0.8 }).addTo(m);
    markers.current = L.layerGroup().addTo(m);
    map.current = m;
    fetch('/api/objects/geojson/network')
      .then(r => r.json())
      .then(geo => {
        if (!map.current) return;
        L.geoJSON(geo, {
          filter: f => f.geometry.type === 'LineString',
          style: () => ({ color: '#8E78FF', weight: 3, opacity: 0.55 }),
        }).addTo(map.current);
      })
      .catch(() => {});
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(box.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const layer = markers.current;
    if (!layer) return;
    layer.clearLayers();
    const order = ['NORMAL', 'ATTENTION', 'WARNING', 'CRITICAL'];
    [...objects].sort((a, b) => order.indexOf(a.risk_level) - order.indexOf(b.risk_level)).forEach(o => {
      const selected = o.object_id === selectedObjectId;
      const color = RISK_COLOR[o.risk_level] || RISK_COLOR.NORMAL;
      const r = (RISK_RADIUS[o.risk_level] || 5) + (selected ? 3 : 0);
      if (o.risk_level === 'CRITICAL') {
        L.marker([o.lat, o.lon], {
          interactive: false,
          icon: L.divIcon({
            className: '', iconSize: [r * 2, r * 2],
            html: `<div class="nk-pulse" style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${color}"></div>`,
          }),
        }).addTo(layer);
      }
      L.circleMarker([o.lat, o.lon], {
        radius: r, fillColor: color, fillOpacity: 0.95,
        color: selected ? '#FFFFFF' : '#0D0C11', weight: selected ? 2.5 : 1.5,
      })
        .bindTooltip(
          `<b>${o.name}</b><br/>${o.corridor} · ${o.picket}<br/>каналов под риском: ${o.predicted_failures_count} из ${o.sensor_count}`,
          { className: 'nk-tip', direction: 'top', offset: [0, -6] },
        )
        .on('click', () => onSelect.current(o.object_id))
        .addTo(layer);
    });
  }, [objects, selectedObjectId]);

  useEffect(() => {
    const o = objects.find(x => x.object_id === selectedObjectId);
    if (o && map.current) map.current.flyTo([o.lat, o.lon], Math.max(map.current.getZoom(), 13), { duration: 0.6 });
  }, [selectedObjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full">
      <div ref={box} className="absolute inset-0" />
      <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2">
        <button className="icon-btn" aria-label="Приблизить" onClick={() => map.current?.zoomIn()}><Plus className="w-4 h-4" /></button>
        <button className="icon-btn" aria-label="Отдалить" onClick={() => map.current?.zoomOut()}><Minus className="w-4 h-4" /></button>
        <button className="icon-btn" aria-label="Вся Москва" onClick={() => map.current?.flyTo(MOSCOW, 11, { duration: 0.6 })}><LocateFixed className="w-4 h-4" /></button>
      </div>
      <div className="absolute left-3 bottom-8 z-[500] panel px-3 py-2 hidden sm:flex items-center gap-4 text-xs" style={{ background: 'rgba(21,19,27,.92)' }}>
        {[['CRITICAL', 'Критично'], ['WARNING', 'Предупреждение'], ['ATTENTION', 'Наблюдение'], ['NORMAL', 'Норма']].map(([k, t]) => (
          <span key={k} className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: RISK_COLOR[k] }} />{t}
          </span>
        ))}
        <span className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          <span className="w-4 h-0.5 rounded" style={{ background: '#8E78FF' }} />Трасса коллектора
        </span>
      </div>
    </div>
  );
};

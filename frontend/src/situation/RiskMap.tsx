import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ObjectItem } from '../types';

export interface MapPin { objectId: string; pct: number; risk: string; done?: boolean }

interface Props {
  objects: ObjectItem[];
  pins: MapPin[];
  selectedObjectId?: string;
  onPick?: (objectId: string) => void;
  interactive?: boolean;
  center?: [number, number];
  zoom?: number;
  onReady?: (map: L.Map) => void;
}

export const MOSCOW: [number, number] = [55.756, 37.632];

/** «Изолинии» map: grey OSM base, collector routes, risk halos with contour rings and % pins.
 *  Colours come from CSS classes, so the map follows the light/dark theme without re-rendering. */
export const RiskMap: React.FC<Props> = ({ objects, pins, selectedObjectId, onPick, interactive = true, center = MOSCOW, zoom = 12, onReady }) => {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const halos = useRef<L.LayerGroup | null>(null);
  const marks = useRef<L.LayerGroup | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, {
      center, zoom, zoomSnap: 0.1, zoomControl: false, attributionControl: true,
      dragging: interactive, scrollWheelZoom: interactive, doubleClickZoom: interactive, touchZoom: interactive, keyboard: interactive,
    });
    m.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(m);
    halos.current = L.layerGroup().addTo(m);
    const routes = L.layerGroup().addTo(m);
    marks.current = L.layerGroup().addTo(m);
    fetch('/api/objects/geojson/network').then(r => r.json()).then(geo => {
      geo.features.filter((f: any) => f.geometry.type === 'LineString').forEach((f: any) => {
        const ll = f.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
        L.polyline(ll, { className: 'rt-casing', weight: 7, interactive: false }).addTo(routes);
        L.polyline(ll, { className: 'rt', weight: 3, interactive: false }).addTo(routes);
        ll.forEach((p: [number, number]) => L.circleMarker(p, { radius: 2.4, className: 'rt-node', interactive: false }).addTo(routes));
      });
    }).catch(() => {});
    map.current = m;
    onReady?.(m);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(box.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = halos.current, mk = marks.current;
    if (!h || !mk) return;
    h.clearLayers(); mk.clearLayers();
    const pinBy = Object.fromEntries(pins.map(p => [p.objectId, p]));
    objects.forEach(o => {
      if (o.risk_level === 'NORMAL') return;
      const p = pinBy[o.object_id];
      const R = p ? 320 + p.pct * 9 : 260;
      [1, 0.66, 0.36].forEach((f, i) => {
        L.circle([o.lat, o.lon], { radius: R * f, className: `halo halo-${o.risk_level}`, interactive: false }).addTo(h);
        if (o.risk_level !== 'ATTENTION') {
          L.circle([o.lat, o.lon], { radius: R * f, className: `iso iso-${o.risk_level} iso-${i}`, interactive: false, fill: false }).addTo(h);
        }
      });
    });
    objects.forEach(o => {
      if (pinBy[o.object_id]) return;
      L.circleMarker([o.lat, o.lon], { radius: o.risk_level === 'NORMAL' ? 2.6 : 4, className: `obj obj-${o.risk_level}`, interactive: !!pick.current })
        .on('click', () => pick.current?.(o.object_id)).addTo(mk);
    });
    const objBy = Object.fromEntries(objects.map(o => [o.object_id, o]));
    [...pins].sort((a, b) => (a.objectId === selectedObjectId ? 1 : 0) - (b.objectId === selectedObjectId ? 1 : 0) || a.pct - b.pct)
      .forEach(p => {
        const o = objBy[p.objectId];
        if (!o) return;
        const sel = p.objectId === selectedObjectId;
        const icon = L.divIcon({
          className: '', iconSize: [0, 0],
          html: `<div class="nk-pin ${sel ? 'sel' : ''} ${p.done ? 'done' : ''}" style="color:var(--${p.risk === 'CRITICAL' ? 'cr' : p.risk === 'WARNING' ? 'wr' : 'at'})">`
            + `${sel ? '<div class="ring"></div>' : ''}<div class="stem"></div><div class="dot"></div>`
            + `<div class="pill"><span>${p.done ? '✓' : p.pct + '%'}</span></div></div>`,
        });
        L.marker([o.lat, o.lon], { icon, zIndexOffset: sel ? 1000 : p.pct, keyboard: false, title: o.name })
          .on('click', () => pick.current?.(p.objectId)).addTo(mk);
      });
  }, [objects, pins, selectedObjectId]);

  useEffect(() => {
    const m = map.current;
    const o = objects.find(x => x.object_id === selectedObjectId);
    if (m && o && interactive && !m.getBounds().pad(-0.2).contains([o.lat, o.lon])) m.flyTo([o.lat, o.lon], Math.max(m.getZoom(), 12.5), { duration: 0.6 });
  }, [selectedObjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="absolute inset-0" />;
};

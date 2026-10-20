import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { ObjectItem } from '../types';

export interface MapPin {
  objectId: string;
  pct?: number | null;
  risk: string;
  done?: boolean;
  color?: string;
  label?: string;
  textLabel?: string;
  tooltip?: string;
}

interface Props {
  objects: ObjectItem[];
  pins: MapPin[];
  selectedObjectId?: string;
  hoveredObjectId?: string | null;
  onPick?: (objectId: string) => void;
  onHover?: (objectId: string | null) => void;
  interactive?: boolean;
  center?: [number, number];
  zoom?: number;
  onReady?: (map: L.Map) => void;
  you?: [number, number] | null;
  youLabel?: string;
  routeTo?: [number, number] | null;
  focusOffsetY?: number;
  zoomOnSelect?: boolean;
  textLabel?: (pin: MapPin) => string;
}

export const MOSCOW: [number, number] = [55.756, 37.632];

const LAT0_RAD = (55.75 * Math.PI) / 180;
const METERS_PER_DEG_LAT = 111195;
const METERS_PER_DEG_LON = 111195 * Math.cos(LAT0_RAD);

interface Segment {
  p1: [number, number];
  p2: [number, number];
}

function projectPointToSegment(
  latP: number,
  lonP: number,
  latA: number,
  lonA: number,
  latB: number,
  lonB: number
): { lat: number; lon: number; distMeters: number } {
  const dx = (lonB - lonA) * METERS_PER_DEG_LON;
  const dy = (latB - latA) * METERS_PER_DEG_LAT;
  const segLenSq = dx * dx + dy * dy;

  const wx = (lonP - lonA) * METERS_PER_DEG_LON;
  const wy = (latP - latA) * METERS_PER_DEG_LAT;

  if (segLenSq <= 0.00001) {
    const distMeters = Math.hypot(wx, wy);
    return { lat: latA, lon: lonA, distMeters };
  }

  const t = Math.max(0, Math.min(1, (wx * dx + wy * dy) / segLenSq));
  const projLat = latA + t * (latB - latA);
  const projLon = lonA + t * (lonB - lonA);

  const distMeters = Math.hypot(
    (lonP - projLon) * METERS_PER_DEG_LON,
    (latP - projLat) * METERS_PER_DEG_LAT
  );

  return { lat: projLat, lon: projLon, distMeters };
}

/**
 * Linear scale for pin radius based on zoom:
 * 7px at zoom <= 10, 12px at zoom >= 15, linear in between.
 */
function getPinRadius(z: number): number {
  if (z <= 10) return 7;
  if (z >= 15) return 12;
  return 7 + (z - 10) * 1;
}

/**
 * Dot radius by zoom:
 * z <= 11: 3.4 px, 12: 4.0 px, 13: 4.6 px, >= 14: 5.2 px
 */
function getDotRadius(z: number): number {
  if (z <= 11) return 3.4;
  if (z < 13) return 4.0;
  if (z < 14) return 4.6;
  return 5.2;
}

function getDotZoomBucket(z: number): number {
  if (z <= 11) return 11;
  if (z < 13) return 12;
  if (z < 14) return 13;
  return 14;
}

/**
 * RiskMap component:
 * - Shared component for Landing, Situation, Field, Tickets, Scenarios.
 * - Blue collector routes with small hollow circular nodes.
 * - Zoom-scaled pins with animated risk zones (halos).
 * - CRITICAL: 2 pulsing rings (2.4s period); WARNING: 1 pulsing ring (3.6s period).
 * - Limits animated elements to top 100 pins by risk.
 * - Non-overlapping auto-labels for top pins, always showing selected/hovered.
 * - Hit target >= 44x44px, keyboard focusable, tooltip on hover/focus.
 */
export const RiskMap: React.FC<Props> = ({
  objects,
  pins,
  selectedObjectId,
  hoveredObjectId,
  onPick,
  onHover,
  interactive = true,
  center = MOSCOW,
  zoom = 12,
  onReady,
  you = null,
  youLabel,
  routeTo = null,
  focusOffsetY = 0,
  zoomOnSelect = false,
  textLabel,
}) => {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  const dotsLayerRef = useRef<L.LayerGroup | null>(null);
  const pinsLayerRef = useRef<L.LayerGroup | null>(null);
  const youLayerRef = useRef<L.LayerGroup | null>(null);

  const pinsMarkersRef = useRef<Map<string, { key: string; marker: L.Marker }>>(new Map());
  const segmentsRef = useRef<Segment[]>([]);
  const snapCacheRef = useRef<Map<string, [number, number]>>(new Map());

  const youMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const pick = useRef(onPick);
  pick.current = onPick;
  const hover = useRef(onHover);
  hover.current = onHover;

  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [routesReady, setRoutesReady] = useState(false);
  const [mapMoveSeq, setMapMoveSeq] = useState(0);

  const displayLatLng = useCallback(
    (o: { object_id: string; lat: number; lon: number }): [number, number] => {
      const cached = snapCacheRef.current.get(o.object_id);
      if (cached) return cached;

      const segs = segmentsRef.current;
      if (!segs || segs.length === 0) {
        return [o.lat, o.lon];
      }

      let bestDist = Infinity;
      let bestPoint: [number, number] = [o.lat, o.lon];

      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const proj = projectPointToSegment(o.lat, o.lon, seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1]);
        if (proj.distMeters < bestDist) {
          bestDist = proj.distMeters;
          bestPoint = [proj.lat, proj.lon];
        }
      }

      const res: [number, number] = bestDist <= 300 ? bestPoint : [o.lat, o.lon];
      snapCacheRef.current.set(o.object_id, res);
      return res;
    },
    []
  );

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, {
      center,
      zoom,
      zoomSnap: 0.1,
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      keyboard: interactive,
    });
    m.attributionControl.setPrefix(false);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap · трассы схематичны · объекты привязаны к трассе',
    }).addTo(m);

    const routes = L.layerGroup().addTo(m);
    const dotsLayer = L.layerGroup().addTo(m);
    const pinsLayer = L.layerGroup().addTo(m);
    const youLayer = L.layerGroup().addTo(m);

    dotsLayerRef.current = dotsLayer;
    pinsLayerRef.current = pinsLayer;
    youLayerRef.current = youLayer;

    // Update zoom and view sequence state on zoomend / moveend
    m.on('zoomend moveend', () => {
      setCurrentZoom(m.getZoom());
      setMapMoveSeq(s => s + 1);
    });

    fetch('/api/objects/geojson/network')
      .then(r => r.json())
      .then(geo => {
        const segs: Segment[] = [];
        geo.features
          .filter((f: any) => f.geometry && f.geometry.type === 'LineString')
          .forEach((f: any) => {
            const ll = f.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
            L.polyline(ll, { className: 'rt', weight: 2.6, interactive: false }).addTo(routes);
            ll.forEach((p: [number, number]) =>
              L.circleMarker(p, { radius: 2.8, className: 'rt-node', interactive: false }).addTo(routes)
            );
            for (let i = 0; i < ll.length - 1; i++) {
              segs.push({ p1: ll[i], p2: ll[i + 1] });
            }
          });
        segmentsRef.current = segs;
        snapCacheRef.current.clear();
        setRoutesReady(true);
      })
      .catch(() => {});

    map.current = m;
    onReady?.(m);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      dotsLayerRef.current = null;
      pinsLayerRef.current = null;
      youLayerRef.current = null;
      pinsMarkersRef.current.clear();
      snapCacheRef.current.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pinnedIdsKey = useMemo(() => {
    return Array.from(new Set(pins.map(p => p.objectId))).sort().join(',');
  }, [pins]);

  const dotZoomBucket = getDotZoomBucket(currentZoom);

  // 1. Draw non-pin background objects along collector lines (rebuilt only when objects, pinnedIdsKey, dotZoomBucket, routesReady, interactive change)
  useEffect(() => {
    const dl = dotsLayerRef.current;
    if (!dl) return;
    dl.clearLayers();

    const pinnedSet = new Set(pinnedIdsKey ? pinnedIdsKey.split(',') : []);
    const dotR = getDotRadius(currentZoom);

    objects.forEach(o => {
      if (pinnedSet.has(o.object_id)) return;
      const pos = displayLatLng(o);

      L.circleMarker(pos, {
        radius: dotR,
        className: `obj obj-${o.risk_level}`,
        interactive: false,
      }).addTo(dl);

      if (interactive && pick.current) {
        L.circleMarker(pos, {
          radius: 15,
          opacity: 0,
          fillOpacity: 0,
          interactive: true,
          className: 'obj-hit-target',
        })
          .on('click', () => pick.current?.(o.object_id))
          .addTo(dl);
      }
    });
  }, [objects, pinnedIdsKey, dotZoomBucket, routesReady, interactive, displayLatLng]);

  // 2. Incremental diff for pinsLayer
  useEffect(() => {
    const pl = pinsLayerRef.current;
    const m = map.current;
    if (!pl) return;

    const objBy = new Map<string, ObjectItem>();
    for (let i = 0; i < objects.length; i++) {
      objBy.set(objects[i].object_id, objects[i]);
    }

    const pinWeight = (p: MapPin) => {
      if (p.pct != null) return p.pct;
      if (p.risk === 'CRITICAL') return 90;
      if (p.risk === 'WARNING') return 60;
      return 10;
    };

    // Identify top 100 pins by risk (for capping animated pulsing rings to ~100 elements)
    const sortedByRisk = [...pins].sort((a, b) => pinWeight(b) - pinWeight(a));
    const top100RiskSet = new Set(sortedByRisk.slice(0, 100).map(p => p.objectId));

    // Collision detection for labels (avoid overlapping labels)
    // Selected pin has highest priority, then highest risk %
    const priorityPins = [...pins].sort((a, b) => {
      if (a.objectId === selectedObjectId) return -1;
      if (b.objectId === selectedObjectId) return 1;
      return pinWeight(b) - pinWeight(a);
    });

    const showPillSet = new Set<string>();
    const approvedPoints: { x: number; y: number }[] = [];

    priorityPins.forEach((p, idx) => {
      const o = objBy.get(p.objectId);
      if (!o) return;
      const pos = displayLatLng(o);
      const isSel = p.objectId === selectedObjectId;
      const isHov = p.objectId === hoveredObjectId;
      if (isSel || isHov) {
        showPillSet.add(p.objectId);
        if (m) approvedPoints.push(m.latLngToLayerPoint(pos));
        return;
      }

      // Auto-label candidates: top 12 pins (or top 24 at high zoom)
      const isCandidate = idx < (currentZoom >= 13.5 ? 24 : 12);
      if (!isCandidate) return;

      if (m) {
        const pt = m.latLngToLayerPoint(pos);
        // Bounding box collision check (approx 46px wide x 24px high)
        const collides = approvedPoints.some(
          ap => Math.abs(ap.x - pt.x) < 46 && Math.abs(ap.y - pt.y) < 24
        );
        if (!collides) {
          showPillSet.add(p.objectId);
          approvedPoints.push(pt);
        }
      } else if (idx < 8) {
        showPillSet.add(p.objectId);
      }
    });

    // Calculate zoom-scaled radius & halo size
    const r = getPinRadius(currentZoom);
    const haloD = Math.round(r * 6.5);

    // Track active pin IDs in this render
    const currentPinIds = new Set<string>();
    // Infinite pulse animations are costly on weak GPUs: only the first 8 risky pins (and the selected one) pulse
    let pulseBudget = 8;

    for (let i = 0; i < pins.length; i++) {
      const p = pins[i];
      const o = objBy.get(p.objectId);
      if (!o) continue;

      currentPinIds.add(p.objectId);
      const pos = displayLatLng(o);

      const sel = p.objectId === selectedObjectId;
      const isHov = p.objectId === hoveredObjectId;
      const pinLabel = p.label || p.textLabel || (textLabel ? textLabel(p) : undefined);
      const showPill = (showPillSet.has(p.objectId) || isHov) && (p.done || pinLabel != null || p.pct != null);
      const inTop100 = top100RiskSet.has(p.objectId);
      let pulse = inTop100 && !p.done;
      if (pulse && !sel) {
        if (pulseBudget > 0) pulseBudget--;
        else pulse = false;
      }
      const isCritical = p.risk === 'CRITICAL';
      const isWarning = p.risk === 'WARNING';

      const colorVar = p.color || (p.done ? 'var(--gn)' : isCritical ? 'var(--rd)' : isWarning ? 'var(--am)' : 'var(--at)');

      const isNearTop = m ? m.latLngToContainerPoint(pos).y < 40 : false;

      // Key string containing everything that affects the DOM of this marker
      const key = `${p.risk}_${p.done ? 1 : 0}_${colorVar}_${pinLabel || ''}_${p.textLabel || ''}_${p.tooltip || ''}_${p.pct ?? ''}_${sel ? 1 : 0}_${isHov ? 1 : 0}_${showPill ? 1 : 0}_${isNearTop ? 1 : 0}_${r}_${haloD}_${pulse ? 1 : 0}_${interactive ? 1 : 0}_${pos[0]},${pos[1]}`;

      const existing = pinsMarkersRef.current.get(p.objectId);
      if (existing && existing.key === key) {
        const targetZ = sel ? 1000 : isHov ? 900 : pinWeight(p);
        if (existing.marker.options.zIndexOffset !== targetZ) {
          existing.marker.setZIndexOffset(targetZ);
        }
        continue;
      }

      if (existing) {
        existing.marker.remove();
        pinsMarkersRef.current.delete(p.objectId);
      }

      const pctText = pinLabel
        ? pinLabel
        : p.pct != null
        ? `риск ${p.pct} %`
        : 'без оценки';
      const ariaLabel = p.tooltip
        ? `${o.name}, ${p.tooltip}`
        : p.done
        ? `${o.name}, ${pinLabel || 'решено'}`
        : isCritical
        ? `${o.name}, ${pctText}, срочно проверить`
        : isWarning
        ? `${o.name}, ${pctText}, проверить скоро`
        : `${o.name}, ${pctText}`;

      const pulseHtml = pulse
        ? isCritical
          ? `<div class="nk-pulse-ring crit-1"></div><div class="nk-pulse-ring crit-2"></div>`
          : `<div class="nk-pulse-ring warn-1"></div>`
        : '';

      const checkSvg = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6.5L4.5 9L10 3"/></svg>`;

      const pillClass = `nk-pin-pill ${isNearTop ? 'pill-below' : ''}`;
      const pillHtml = pinLabel
        ? `<div class="${pillClass}">${pinLabel}</div>`
        : p.done
        ? `<div class="${pillClass}">решено</div>`
        : p.pct != null
        ? `<div class="${pillClass}">${p.pct}%</div>`
        : '';

      const tipText = p.tooltip ? `${o.name} · ${p.tooltip}` : o.name;

      const html = `
        <div class="nk-pin-wrap ${sel ? 'sel' : ''} ${isHov ? 'hov' : ''} ${showPill ? 'show-pill' : ''}" style="--pin-color: ${colorVar}; --r: ${r}px; --halo-d: ${haloD}px;">
          <div class="nk-pin-hit" tabindex="${interactive ? 0 : -1}" role="${interactive ? 'button' : 'img'}" aria-label="${ariaLabel}">
            ${pulseHtml}
            <div class="nk-soft-halo"></div>
            ${sel || p.done ? '<div class="nk-sel-ring"></div>' : ''}
            <div class="nk-pin-core ${p.done ? 'done' : ''}">
              ${p.done ? checkSvg : ''}
            </div>
            ${pillHtml}
            <div class="nk-pin-tip">${tipText}</div>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'nk-leaflet-pin',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html,
      });

      const marker = L.marker(pos, {
        icon,
        zIndexOffset: sel ? 1000 : isHov ? 900 : pinWeight(p),
        keyboard: false,
        interactive: interactive,
      });

      if (interactive) {
        if (pick.current) {
          marker.on('click', () => pick.current?.(p.objectId));
        }
        marker.on('mouseover', () => hover.current?.(p.objectId));
        marker.on('mouseout', () => hover.current?.(null));
      }

      marker.addTo(pl);

      // Attach keyboard navigation to the hit element
      if (interactive && pick.current) {
        const el = marker.getElement();
        if (el) {
          const hitBtn = el.querySelector('.nk-pin-hit') as HTMLElement | null;
          if (hitBtn) {
            hitBtn.addEventListener('keydown', (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pick.current?.(p.objectId);
              }
            });
          }
        }
      }

      pinsMarkersRef.current.set(p.objectId, { key, marker });
    }

    // Remove pins whose pin is gone
    pinsMarkersRef.current.forEach((entry, objId) => {
      if (!currentPinIds.has(objId)) {
        entry.marker.remove();
        pinsMarkersRef.current.delete(objId);
      }
    });
  }, [pins, selectedObjectId, hoveredObjectId, currentZoom, interactive, routesReady, textLabel, objects, displayLatLng, mapMoveSeq]);

  // 3. Draw 'You' position marker and route line if provided
  useEffect(() => {
    const yl = youLayerRef.current;
    if (!yl) return;

    if (you && you[0] && you[1]) {
      const youLabelText = youLabel || 'Вы здесь (демо-позиция)';
      const youHtml = `
        <div class="nk-you-wrap">
          <div class="nk-you-hit" tabindex="${interactive ? 0 : -1}" role="img" aria-label="${youLabelText}">
            <div class="nk-you-halo"></div>
            <div class="nk-you-core"></div>
            <div class="nk-you-tip">${youLabelText}</div>
          </div>
        </div>
      `;
      const youIcon = L.divIcon({
        className: 'nk-leaflet-pin',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: youHtml,
      });

      if (!youMarkerRef.current) {
        youMarkerRef.current = L.marker([you[0], you[1]], {
          icon: youIcon,
          zIndexOffset: 2500,
          interactive,
        }).addTo(yl);
      } else {
        youMarkerRef.current.setLatLng([you[0], you[1]]);
        youMarkerRef.current.setIcon(youIcon);
      }

      // Метка объекта нарисована на ближайшей точке трассы (displayLatLng), поэтому и линия маршрута
      // должна заканчиваться там же, а не в «сырых» координатах объекта.
      const target = selectedObjectId ? (objects || []).find(o => o.object_id === selectedObjectId) : undefined;
      const routeEnd: [number, number] | null = target ? displayLatLng(target) : routeTo;
      if (routeEnd && routeEnd[0] && routeEnd[1]) {
        if (!routePolylineRef.current) {
          routePolylineRef.current = L.polyline([you, routeEnd], {
            color: 'var(--ac)',
            weight: 2.5,
            dashArray: '6, 6',
            opacity: 0.85,
            interactive: false,
          }).addTo(yl);
        } else {
          routePolylineRef.current.setLatLngs([you, routeEnd]);
        }
      } else if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
      }
    } else {
      if (youMarkerRef.current) {
        youMarkerRef.current.remove();
        youMarkerRef.current = null;
      }
      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
      }
    }
  }, [you, youLabel, routeTo, interactive, selectedObjectId, objects, displayLatLng, routesReady]);

  // 4. Fly to selected object
  useEffect(() => {
    const m = map.current;
    const o = objects.find(x => x.object_id === selectedObjectId);
    if (m && o && interactive) {
      // Map hidden (e.g. mobile list view) has zero size: flyTo would produce NaN LatLng and crash the page
      const sz = m.getSize();
      if (!sz.x || !sz.y) return;
      const pos = displayLatLng(o);
      const targetLat = focusOffsetY ? pos[0] - focusOffsetY : pos[0];
      m.flyTo([targetLat, pos[1]], zoomOnSelect ? 16 : Math.max(m.getZoom(), 12.5), { duration: 0.6 });
    }
  }, [selectedObjectId, zoomOnSelect, focusOffsetY, routesReady, displayLatLng, interactive, objects]);

  return <div ref={box} className="absolute inset-0 overflow-hidden" />;
};

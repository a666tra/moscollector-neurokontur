import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ObjectItem } from '../types';

export interface MapPin { objectId: string; pct?: number | null; risk: string; done?: boolean }

interface Props {
  objects: ObjectItem[];
  pins: MapPin[];
  selectedObjectId?: string;
  onPick?: (objectId: string) => void;
  interactive?: boolean;
  center?: [number, number];
  zoom?: number;
  onReady?: (map: L.Map) => void;
  you?: [number, number] | null;
  youLabel?: string;
  routeTo?: [number, number] | null;
  focusOffsetY?: number;
  zoomOnSelect?: boolean;
}

export const MOSCOW: [number, number] = [55.756, 37.632];

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
 * RiskMap component:
 * - Shared component for Landing, Situation, Field (and later Tickets, Scenarios).
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
  onPick,
  interactive = true,
  center = MOSCOW,
  zoom = 12,
  onReady,
  you = null,
  youLabel,
  routeTo = null,
  focusOffsetY = 0,
  zoomOnSelect = false,
}) => {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marks = useRef<L.LayerGroup | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  const [currentZoom, setCurrentZoom] = useState(zoom);

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
      attribution: '© OpenStreetMap · трассы схематичны',
    }).addTo(m);

    const routes = L.layerGroup().addTo(m);
    marks.current = L.layerGroup().addTo(m);

    // Update zoom level state on zoomend to scale pins and recalculate label collisions
    m.on('zoomend', () => {
      setCurrentZoom(m.getZoom());
    });

    fetch('/api/objects/geojson/network')
      .then(r => r.json())
      .then(geo => {
        geo.features
          .filter((f: any) => f.geometry.type === 'LineString')
          .forEach((f: any) => {
            const ll = f.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
            L.polyline(ll, { className: 'rt', weight: 2.6, interactive: false }).addTo(routes);
            ll.forEach((p: [number, number]) =>
              L.circleMarker(p, { radius: 2.8, className: 'rt-node', interactive: false }).addTo(routes)
            );
          });
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
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mk = marks.current;
    const m = map.current;
    if (!mk) return;
    mk.clearLayers();

    const pinBy = Object.fromEntries(pins.map(p => [p.objectId, p]));
    const objBy = Object.fromEntries(objects.map(o => [o.object_id, o]));

    // 1. Draw non-pin background objects along collector lines
    objects.forEach(o => {
      if (pinBy[o.object_id]) return;
      L.circleMarker([o.lat, o.lon], {
        radius: o.risk_level === 'NORMAL' ? 2.6 : 3.5,
        className: `obj obj-${o.risk_level}`,
        interactive: interactive && !!pick.current,
      })
        .on('click', () => pick.current?.(o.object_id))
        .addTo(mk);
    });

    // 2. Identify top 100 pins by risk (for capping animated pulsing rings to ~100 elements)
    const sortedByRisk = [...pins].sort((a, b) => b.pct - a.pct);
    const top100RiskSet = new Set(sortedByRisk.slice(0, 100).map(p => p.objectId));

    // 3. Collision detection for labels (avoid overlapping labels)
    // Selected pin has highest priority, then highest risk %
    const priorityPins = [...pins].sort((a, b) => {
      if (a.objectId === selectedObjectId) return -1;
      if (b.objectId === selectedObjectId) return 1;
      return b.pct - a.pct;
    });

    const showPillSet = new Set<string>();
    const approvedPoints: { x: number; y: number }[] = [];

    priorityPins.forEach((p, idx) => {
      const o = objBy[p.objectId];
      if (!o) return;
      const isSel = p.objectId === selectedObjectId;
      if (isSel) {
        showPillSet.add(p.objectId);
        if (m) approvedPoints.push(m.latLngToLayerPoint([o.lat, o.lon]));
        return;
      }

      // Auto-label candidates: top 12 pins (or top 24 at high zoom)
      const isCandidate = idx < (currentZoom >= 13.5 ? 24 : 12);
      if (!isCandidate) return;

      if (m) {
        const pt = m.latLngToLayerPoint([o.lat, o.lon]);
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

    // 4. Calculate zoom-scaled radius & halo size
    const r = getPinRadius(currentZoom);
    const haloD = Math.round(r * 6.5);

    // 5. Render pins sorted so selected and higher risk pins are on top
    [...pins]
      .sort((a, b) => (a.objectId === selectedObjectId ? 1 : 0) - (b.objectId === selectedObjectId ? 1 : 0) || (a.pct ?? -1) - (b.pct ?? -1))
      .forEach(p => {
        const o = objBy[p.objectId];
        if (!o) return;

        const sel = p.objectId === selectedObjectId;
        const showPill = showPillSet.has(p.objectId) && (p.done || p.pct != null);
        const inTop100 = top100RiskSet.has(p.objectId);
        const pulse = inTop100 && !p.done;
        const isCritical = p.risk === 'CRITICAL';
        const isWarning = p.risk === 'WARNING';

        const colorVar = p.done ? 'var(--gn)' : isCritical ? 'var(--rd)' : isWarning ? 'var(--am)' : 'var(--at)';

        const pctText = p.pct != null ? `риск ${p.pct} %` : 'без оценки';
        const ariaLabel = p.done
          ? `${o.name}, решено`
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

        const pillHtml = p.done
          ? `<div class="nk-pin-pill">решено</div>`
          : p.pct != null
          ? `<div class="nk-pin-pill">${p.pct}%</div>`
          : '';

        const html = `
          <div class="nk-pin-wrap ${sel ? 'sel' : ''} ${showPill ? 'show-pill' : ''}" style="--pin-color: ${colorVar}; --r: ${r}px; --halo-d: ${haloD}px;">
            <div class="nk-pin-hit" tabindex="${interactive ? 0 : -1}" role="${interactive ? 'button' : 'img'}" aria-label="${ariaLabel}">
              ${pulseHtml}
              <div class="nk-soft-halo"></div>
              ${sel || p.done ? '<div class="nk-sel-ring"></div>' : ''}
              <div class="nk-pin-core ${p.done ? 'done' : ''}">
                ${p.done ? checkSvg : ''}
              </div>
              ${pillHtml}
              <div class="nk-pin-tip">${o.name}</div>
            </div>
          </div>
        `;

        const icon = L.divIcon({
          className: 'nk-leaflet-pin',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          html,
        });

        const marker = L.marker([o.lat, o.lon], {
          icon,
          zIndexOffset: sel ? 1000 : p.pct,
          keyboard: false,
          interactive: interactive,
        });

        if (interactive && pick.current) {
          marker.on('click', () => pick.current?.(p.objectId));
        }

        marker.addTo(mk);

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
      });

    // 6. Draw 'You' position marker if provided
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
      L.marker([you[0], you[1]], { icon: youIcon, zIndexOffset: 2500, interactive }).addTo(mk);

      // 7. Route line from 'you' to selected object
      if (routeTo && routeTo[0] && routeTo[1]) {
        L.polyline([you, routeTo], {
          color: 'var(--ac)',
          weight: 2.5,
          dashArray: '6, 6',
          opacity: 0.85,
          interactive: false,
        }).addTo(mk);
      }
    }
  }, [objects, pins, selectedObjectId, currentZoom, interactive, you, youLabel, routeTo]);

  useEffect(() => {
    const m = map.current;
    const o = objects.find(x => x.object_id === selectedObjectId);
    if (m && o && interactive) {
      const targetLat = focusOffsetY ? o.lat - focusOffsetY : o.lat;
      if (zoomOnSelect) {
        m.flyTo([targetLat, o.lon], 16, { duration: 0.6 });
      } else if (!m.getBounds().pad(-0.2).contains([o.lat, o.lon])) {
        m.flyTo([targetLat, o.lon], Math.max(m.getZoom(), 12.5), { duration: 0.6 });
      }
    }
  }, [selectedObjectId, zoomOnSelect, focusOffsetY]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="absolute inset-0 overflow-hidden" />;
};

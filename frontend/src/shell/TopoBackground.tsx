import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Animated "topographic" background (two slowly drifting layers of contour lines).
 * Purely decorative: pointer-events none, aria-hidden, no data, no network.
 * Contour lines are generated once (marching squares over a sum of gaussian hills) and
 * RASTERISED ONCE into two bitmaps (canvas -> blob URL). Only compositor-friendly CSS
 * transforms animate afterwards, so no SVG is re-rasterised on every frame
 * (the old inline-SVG version with vector-effect: non-scaling-stroke was repainted each frame).
 * Bitmaps are redrawn only when the theme changes or the host size changes noticeably.
 * Ported from the Claude Design prototype (NeuroKontur.dc.html: contours/drawBg/POSE).
 */

type Peak = [number, number, number, number, number]; // x, y, amplitude, sx, sy
type Contour = { d: string; L: number };

function contours(peaks: Peak[], step: number, lo: number, W: number, H: number, cell: number): Contour[] {
  const nx = Math.ceil(W / cell);
  const ny = Math.ceil(H / cell);
  const dx = W / nx;
  const dy = H / ny;
  const F = new Float32Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = i * dx;
      const y = j * dy;
      let v = 0;
      for (const [px, py, a, sx, sy] of peaks) {
        const u = (x - px) / sx;
        const w = (y - py) / sy;
        v += a * Math.exp(-(u * u + w * w));
      }
      v +=
        0.06 * Math.sin(x / 130 + 1.3) * Math.cos(y / 110) +
        0.045 * Math.sin((x + y) / 95) +
        0.03 * Math.cos(x / 55 - y / 70);
      F[j * (nx + 1) + i] = v;
    }
  }
  const g = (i: number, j: number) => F[j * (nx + 1) + i];
  const out: Contour[] = [];
  const f1 = (n: number) => Math.round(n * 10) / 10;

  for (let L = lo; L < 1.25; L += step) {
    const pts: Record<string, [number, number]> = {};
    const adj: Record<string, string[]> = {};
    type Ref = { k: string };
    const link = (a: Ref, b: Ref) => {
      (adj[a.k] = adj[a.k] || []).push(b.k);
      (adj[b.k] = adj[b.k] || []).push(a.k);
    };
    const Hh = (i: number, j: number, a: number, b: number): Ref => {
      const k = 'h' + i + ',' + j;
      if (!pts[k]) pts[k] = [(i + (L - a) / (b - a)) * dx, j * dy];
      return { k };
    };
    const Vv = (i: number, j: number, a: number, b: number): Ref => {
      const k = 'v' + i + ',' + j;
      if (!pts[k]) pts[k] = [i * dx, (j + (L - a) / (b - a)) * dy];
      return { k };
    };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const tl = g(i, j);
        const tr = g(i + 1, j);
        const br = g(i + 1, j + 1);
        const bl = g(i, j + 1);
        const c = (tl >= L ? 8 : 0) | (tr >= L ? 4 : 0) | (br >= L ? 2 : 0) | (bl >= L ? 1 : 0);
        if (c === 0 || c === 15) continue;
        const T = () => Hh(i, j, tl, tr);
        const B = () => Hh(i, j + 1, bl, br);
        const Lf = () => Vv(i, j, tl, bl);
        const R = () => Vv(i + 1, j, tr, br);
        const table: Record<number, Array<[() => Ref, () => Ref]>> = {
          1: [[Lf, B]],
          2: [[B, R]],
          3: [[Lf, R]],
          4: [[T, R]],
          5: [[T, R], [Lf, B]],
          6: [[T, B]],
          7: [[T, Lf]],
          8: [[T, Lf]],
          9: [[T, B]],
          10: [[T, Lf], [B, R]],
          11: [[T, R]],
          12: [[Lf, R]],
          13: [[B, R]],
          14: [[Lf, B]],
        };
        table[c].forEach(([a, b]) => link(a(), b()));
      }
    }
    const seen: Record<string, number> = {};
    let d = '';
    const walk = (start: string, closed: boolean) => {
      let prev: string | null = null;
      let cur: string | undefined = start;
      const P: Array<[number, number]> = [];
      while (cur && !seen[cur]) {
        seen[cur] = 1;
        P.push(pts[cur]);
        const nb: string[] = (adj[cur] || []).filter((k) => k !== prev && !seen[k]);
        prev = cur;
        cur = nb[0];
      }
      const Q = P.filter((_, i) => i % 2 === 0 || i === P.length - 1);
      if (Q.length < 4) return;
      const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const a0 = closed ? mid(Q[Q.length - 1], Q[0]) : Q[0];
      d += 'M' + f1(a0[0]) + ' ' + f1(a0[1]);
      for (let i = closed ? 0 : 1; i < Q.length; i++) {
        const c = Q[i];
        const nxt = Q[i + 1] || (closed ? Q[0] : null);
        const e = nxt ? mid(c, nxt) : c;
        d += 'Q' + f1(c[0]) + ' ' + f1(c[1]) + ' ' + f1(e[0]) + ' ' + f1(e[1]);
      }
      if (closed) d += 'Z';
    };
    Object.keys(adj)
      .filter((k) => adj[k].length === 1)
      .forEach((k) => {
        if (!seen[k]) walk(k, false);
      });
    Object.keys(adj).forEach((k) => {
      if (!seen[k]) walk(k, true);
    });
    if (d) out.push({ d, L });
  }
  return out;
}

/** Per-screen "camera pose" of the two layers: moving between screens glides the lines (parallax). */
export type TopoPose = 'tickets' | 'summary' | 'scenarios' | 'quality' | 'tech';

const POSE: Record<TopoPose, [string, string]> = {
  tickets: ['translate(-5%,-3%) scale(1.15) rotate(0deg)', 'translate(4%,3%) scale(1.3) rotate(3deg)'],
  summary: ['translate(6%,-8%) scale(1.45) rotate(-5deg)', 'translate(-6%,2%) scale(1.2) rotate(2deg)'],
  scenarios: ['translate(-13%,6%) scale(1.3) rotate(6deg)', 'translate(8%,-5%) scale(1.4) rotate(-3deg)'],
  quality: ['translate(11%,4%) scale(1.5) rotate(-2deg)', 'translate(-9%,-6%) scale(1.25) rotate(5deg)'],
  tech: ['translate(0%,-6%) scale(1.3) rotate(3deg)', 'translate(5%,5%) scale(1.15) rotate(-4deg)'],
};

interface Props {
  /** null = hide the background (fades out, animation paused), otherwise show it with that screen's pose */
  pose: TopoPose | null;
}

type Path = { d: string; o: number };

const MAX_SIDE = 2000; // cap on the bitmap side in device pixels (keeps texture memory sane on retina)

/** Rasterise one layer of contour paths to a PNG blob URL. Resolves '' if canvas is unavailable. */
function rasterise(paths: Path[], lineCss: number, W: number, H: number, sc: number, color: string): Promise<string> {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return Promise.resolve('');
  const s = Math.max(W / 1600, H / 1000);
  ctx.setTransform(s, 0, 0, s, (W - 1600 * s) / 2, (H - 1000 * s) / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = (lineCss * sc) / s;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of paths) {
    ctx.globalAlpha = p.o;
    ctx.stroke(new Path2D(p.d));
  }
  return new Promise((res) => cv.toBlob((b) => res(b ? URL.createObjectURL(b) : ''), 'image/png'));
}

/** Resolve the accent colour for canvas (canvas may reject oklch() in old engines -> fallback). */
function accentForCanvas(): string {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--ac').trim();
  const fallback = dark ? '#86aef0' : '#2b55d6';
  if (!raw) return fallback;
  try {
    const c = document.createElement('canvas').getContext('2d');
    if (!c) return fallback;
    c.fillStyle = '#000001';
    c.fillStyle = raw;
    return c.fillStyle === '#000001' ? fallback : raw;
  } catch {
    return fallback;
  }
}

export const TopoBackground: React.FC<Props> = ({ pose }) => {
  const { layerA, layerB } = useMemo(() => {
    const A = contours(
      [
        [430, 320, 1.2, 190, 130],
        [1160, 650, 1.25, 210, 160],
        [230, 840, 0.8, 130, 100],
        [1330, 190, 0.65, 130, 110],
        [800, 840, 0.45, 160, 110],
      ],
      0.04,
      0.08,
      1600,
      1000,
      14
    ).map((o) => ({ d: o.d, o: +(0.13 + Math.min(1, o.L) * 0.17).toFixed(2) }));
    const B = contours(
      [
        [900, 200, 0.8, 330, 190],
        [160, 480, 0.7, 260, 240],
        [1450, 840, 0.75, 300, 200],
      ],
      0.06,
      0.1,
      1600,
      1000,
      20
    ).map((o) => ({ d: o.d, o: 0.1 }));
    return { layerA: A, layerB: B };
  }, []);

  const hostRef = useRef<HTMLDivElement>(null);
  const urlsRef = useRef<[string, string]>(['', '']);
  const sizeRef = useRef<[number, number]>([0, 0]);
  const aliveRef = useRef(true);
  const [urls, setUrls] = useState<[string, string]>(['', '']);

  useEffect(() => {
    aliveRef.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let drawing = false;
    let again = false;

    const draw = async () => {
      const host = hostRef.current;
      if (!host) return;
      if (drawing) {
        again = true;
        return;
      }
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      drawing = true;
      sizeRef.current = [r.width, r.height];
      const lw = r.width * 1.28;
      const lh = r.height * 1.28;
      let sc = Math.min(window.devicePixelRatio || 1, 2);
      const mx = Math.max(lw, lh) * sc;
      if (mx > MAX_SIDE) sc *= MAX_SIDE / mx;
      const W = Math.round(lw * sc);
      const H = Math.round(lh * sc);
      const color = accentForCanvas();
      try {
        const [ua, ub] = await Promise.all([
          rasterise(layerA, 0.9, W, H, sc, color),
          rasterise(layerB, 0.8, W, H, sc, color),
        ]);
        if (!aliveRef.current) {
          [ua, ub].forEach((u) => u && URL.revokeObjectURL(u));
          return;
        }
        const old = urlsRef.current;
        urlsRef.current = [ua, ub];
        setUrls([ua, ub]);
        setTimeout(() => old.forEach((u) => u && URL.revokeObjectURL(u)), 3000);
      } finally {
        drawing = false;
        if (again) {
          again = false;
          draw();
        }
      }
    };

    // first draw right after the first paint so it never blocks the initial render
    timer = setTimeout(draw, 60);

    // redraw when the theme (accent colour) changes
    const mo = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(draw, 80);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // redraw only on a real size change (> 8 %), debounced
    let ro: ResizeObserver | undefined;
    if (hostRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const h = hostRef.current;
          if (!h) return;
          const r = h.getBoundingClientRect();
          const [zw, zh] = sizeRef.current;
          if (!zw || !zh || Math.abs(r.width - zw) > zw * 0.08 || Math.abs(r.height - zh) > zh * 0.08) draw();
        }, 250);
      });
      ro.observe(hostRef.current);
    }

    return () => {
      aliveRef.current = false;
      clearTimeout(timer);
      mo.disconnect();
      ro?.disconnect();
      urlsRef.current.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [layerA, layerB]);


  // --- FPS governor: if the device cannot keep ~45 fps with the drifting layers, freeze the drift
  //     (the lines stay, only the idle motion stops) so the whole UI stays smooth. ---
  const [lite, setLite] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('nk-topo-lite') === '1';
    } catch {
      return false;
    }
  });
  const show = !!pose;
  useEffect(() => {
    if (!show || lite) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let stopped = false;
    let bad = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sample = () => {
      if (stopped) return;
      if (document.hidden) {
        timer = setTimeout(sample, 2000);
        return;
      }
      const dts: number[] = [];
      let last = 0;
      const tick = (t: number) => {
        if (stopped) return;
        if (last) dts.push(t - last);
        last = t;
        if (dts.length < 45) {
          raf = requestAnimationFrame(tick);
          return;
        }
        dts.sort((a, b) => a - b);
        const median = dts[Math.floor(dts.length / 2)];
        bad = median > 26 ? bad + 1 : 0; // slower than ~38 fps
        if (bad >= 2) {
          setLite(true);
          try {
            sessionStorage.setItem('nk-topo-lite', '1');
          } catch {
            /* ignore */
          }
          return;
        }
        timer = setTimeout(sample, bad ? 800 : 15000);
      };
      raf = requestAnimationFrame(tick);
    };
    timer = setTimeout(sample, 2500);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [show, lite]);

  const p = POSE[pose || 'tickets'];
  const play = show && !lite ? 'running' : 'paused';
  const layerStyle = (url: string, anim: string): React.CSSProperties => ({
    width: '100%',
    height: '100%',
    backgroundImage: url ? `url(${url})` : 'none',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    willChange: 'transform',
    backfaceVisibility: 'hidden',
    animation: `${anim} infinite alternate ease-in-out`,
    animationPlayState: play,
  });

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="nk-topo"
      data-topo-lite={lite ? '1' : '0'}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: show ? 1 : 0,
        visibility: show ? 'visible' : 'hidden',
        transition: 'opacity .7s ease, visibility .7s',
        contain: 'strict',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-14%',
          transform: p[1],
          transition: 'transform 1.8s cubic-bezier(.25,.7,.2,1)',
          willChange: 'transform',
        }}
      >
        <div data-topo-layer style={layerStyle(urls[1], 'nkDrift2 62s')} />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: '-14%',
          transform: p[0],
          transition: 'transform 1.4s cubic-bezier(.3,.7,.2,1)',
          willChange: 'transform',
        }}
      >
        <div data-topo-layer style={layerStyle(urls[0], 'nkDrift 44s')} />
      </div>
    </div>
  );
};

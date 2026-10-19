import React, { useMemo } from 'react';

/**
 * Animated "topographic" background (two slowly drifting layers of contour lines).
 * Purely decorative: pointer-events none, aria-hidden, no data, no network.
 * Contour lines are generated once (marching squares over a sum of gaussian hills),
 * then only CSS transforms animate (cheap, GPU friendly).
 * Ported 1:1 from the Claude Design prototype (NeuroKontur.dc.html: contours/buildBg/POSE).
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
  /** null = hide the background (fades out), otherwise show it with that screen's pose */
  pose: TopoPose | null;
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

  const p = POSE[pose || 'tickets'];

  return (
    <div
      aria-hidden="true"
      className="nk-topo"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: pose ? 1 : 0,
        transition: 'opacity .7s ease',
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
        <svg
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%', display: 'block', animation: 'nkDrift2 62s ease-in-out infinite alternate' }}
        >
          {layerB.map((g, i) => (
            <path
              key={i}
              d={g.d}
              fill="none"
              stroke="var(--ac)"
              strokeOpacity={g.o}
              strokeWidth={0.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
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
        <svg
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%', display: 'block', animation: 'nkDrift 44s ease-in-out infinite alternate' }}
        >
          {layerA.map((g, i) => (
            <path
              key={i}
              d={g.d}
              fill="none"
              stroke="var(--ac)"
              strokeOpacity={g.o}
              strokeWidth={0.9}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
    </div>
  );
};

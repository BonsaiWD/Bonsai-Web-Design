/*
 * Particle roots for the resting bonsai. A few roots leave the base of the
 * tree, spread across the width of the hero and thin out towards its edges,
 * so the tree is anchored to the page instead of floating. A taproot runs
 * down to the bottom centre, where the scroll-drawn root (RootStage) takes
 * over. Laid out in CSS pixels of the hero, so it is rebuilt on resize.
 */

import { mulberry32 } from './bonsaiField';

/** Stride 6: x, y (CSS px), t (0 at the base, 1 at the tip), brightness, seed, size. */
export const ROOT_STRIDE = 6;

type P = [number, number];

const cubic = (a: P, b: P, c: P, d: P, t: number): P => {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
};

interface Strand {
  curve: [P, P, P, P];
  /** Root time at the strand's start and end, so forks light up after their root. */
  t0: number;
  t1: number;
  brightness: number;
  wiggle: number;
}

export function buildRoots(w: number, h: number, base: P, tap: P): Float32Array {
  const rand = mulberry32(7);
  const strands: Strand[] = [];

  // Lateral roots: [end x, end y] as fractions of the hero.
  const ends: P[] = [
    [0.02, 0.9], [0.14, 0.975], [0.28, 1.0],
    [0.98, 0.87], [0.86, 0.96], [0.72, 0.995],
  ];
  ends.forEach(([fx, fy], k) => {
    const side = fx < 0.5 ? -1 : 1;
    const s: P = [base[0] + side * (6 + 8 * (k % 3)), base[1]];
    const e: P = [fx * w, fy * h];
    const c1: P = [s[0] + (e[0] - s[0]) * 0.16, s[1] + (e[1] - s[1]) * 0.6];
    const c2: P = [s[0] + (e[0] - s[0]) * 0.55, e[1] - 4];
    strands.push({ curve: [s, c1, c2, e], t0: 0, t1: 1, brightness: 1, wiggle: 2 + (k % 3) });

    // Two forks per root, splitting off towards the ground.
    for (const at of [0.38, 0.68]) {
      const p = cubic(s, c1, c2, e, at);
      const q = cubic(s, c1, c2, e, at + 0.01);
      const len = 50 + 70 * rand();
      const dir: P = [q[0] - p[0], q[1] - p[1]];
      const n = Math.hypot(dir[0], dir[1]) || 1;
      const ang = Math.atan2(dir[1], dir[0]) + side * 0.5;
      const f: P = [p[0] + Math.cos(ang) * len, p[1] + Math.abs(Math.sin(ang)) * len * 0.6 + 6];
      const m: P = [p[0] + (dir[0] / n) * len * 0.4, p[1] + (dir[1] / n) * len * 0.4];
      strands.push({ curve: [p, m, m, f], t0: at, t1: at + 0.3, brightness: 0.7, wiggle: 1 });
    }
  });

  // The taproot, down to where the page's root begins.
  const tc1: P = [base[0], base[1] + (tap[1] - base[1]) * 0.5];
  const tc2: P = [tap[0], tap[1] - (tap[1] - base[1]) * 0.45];
  strands.push({ curve: [base, tc1, tc2, tap], t0: 0, t1: 0.7, brightness: 1.25, wiggle: 0 });

  const out: number[] = [];
  for (const st of strands) {
    const [a, b, c, d] = st.curve;
    // Arc length, then a mote every few pixels, sparser towards the tip.
    const steps = 160;
    const pts: P[] = [];
    const lens: number[] = [0];
    for (let i = 0; i <= steps; i++) {
      pts.push(cubic(a, b, c, d, i / steps));
      if (i > 0) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const total = lens[steps];
    let at = 0;
    let j = 1;
    while (at < total) {
      while (j < steps && lens[j] < at) j++;
      const f = at / total;
      const [x0, y0] = pts[j - 1];
      const [x1, y1] = pts[j];
      const seg = lens[j] - lens[j - 1] || 1;
      const r = (at - lens[j - 1]) / seg;
      const tx = (x1 - x0) / seg;
      const ty = (y1 - y0) / seg;
      const wob = Math.sin(f * Math.PI * (2 + st.wiggle)) * st.wiggle * 2 * f;
      const jit = (rand() - 0.5) * (1.4 + 2 * f);
      out.push(
        x0 + (x1 - x0) * r - ty * (wob + jit),
        y0 + (y1 - y0) * r + tx * (wob + jit),
        st.t0 + (st.t1 - st.t0) * f,
        st.brightness * (1 - 0.7 * f) * (0.6 + 0.4 * rand()),
        rand(),
        0.7 + 0.8 * rand() * (1 - 0.4 * f)
      );
      at += 1.8 + 4 * f;
    }
  }
  return new Float32Array(out);
}

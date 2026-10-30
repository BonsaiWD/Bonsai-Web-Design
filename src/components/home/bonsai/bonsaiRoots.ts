/*
 * Particle roots for the resting bonsai, grown rather than drawn: each root
 * is a seeded random walk that wanders, sinks under gravity, tapers and
 * forks into finer roots, laid down as a soft cloud of motes (dense at the
 * core, thinning at the edges) so it reads as a root, not a thread. A
 * taproot steers to the bottom centre of the hero, where the scroll-drawn
 * root (RootStage) carries on into the next section; lateral roots splay
 * out from the base of the pot and fade into the dark. Laid out in CSS
 * pixels of the hero, so it is rebuilt on resize.
 */

import { mulberry32 } from './bonsaiField';

/** Stride 6: x, y (CSS px), t (0 at the pot, 1 at the farthest tip), brightness, seed, size. */
export const ROOT_STRIDE = 6;

type P = [number, number];

interface Root {
  x: number;
  y: number;
  angle: number;
  width: number;
  /** How far it may grow, in px. */
  length: number;
  /** Distance along the roots from the pot, where this one starts. */
  from: number;
  depth: number;
  /** The taproot steers here. */
  target?: P;
}

const DOWN = Math.PI / 2;
const STEP = 2.2;

/**
 * @param base  centre of the pot's base, where the roots start
 * @param tap   bottom centre of the hero, where the taproot ends
 * @param spread  about half the pot's width
 */
export function buildRoots(base: P, tap: P, spread: number): Float32Array {
  const rand = mulberry32(11);
  // Roughly normal, in about -1..1.
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  const floor = tap[1] - 3;

  const roots: Root[] = [{ x: base[0], y: base[1], angle: DOWN, width: 11, length: Infinity, from: 0, depth: 0, target: tap }];
  const reach = Math.hypot(tap[0] - base[0], tap[1] - base[1]);
  for (const side of [-1, 1, -1, 1, -1, 1, 1]) {
    roots.push({
      x: base[0] + side * spread * (0.15 + 0.65 * rand()),
      y: base[1] - 6 * rand(),
      angle: DOWN - side * (0.5 + 0.6 * rand()),
      width: 3 + 4 * rand(),
      length: 110 + 120 * rand(),
      from: 0,
      depth: 1,
    });
  }

  const motes: number[] = [];
  let farthest = 1;

  while (roots.length) {
    const r = roots.pop()!;
    let { x, y, angle, width } = r;
    let turn = 0;
    let grown = 0;
    const taper = r.target ? 0 : (width - 0.5) / r.length;

    while (width > 0.5 && grown < r.length) {
      if (r.target) {
        // The taproot wanders a little but always arrives, thinning to the
        // width of the page's trace.
        // It meanders near the pot and steadies as it nears the page's trace.
        const left = Math.hypot(r.target[0] - x, r.target[1] - y);
        if (left < STEP) break;
        const near = 1 - Math.min(1, left / reach);
        const want = Math.atan2(r.target[1] - y, r.target[0] - x);
        turn = turn * 0.8 + gauss() * 0.05 * (1 - near);
        angle += turn + (want - angle) * (0.02 + 0.12 * near);
        width = Math.min(r.width, 1.5 + left * 0.05);
      } else {
        // Lateral roots wander with some momentum and slowly sink.
        turn = turn * 0.82 + gauss() * 0.06;
        angle += turn + (DOWN - angle) * 0.015;
        width -= taper * STEP;
      }
      x += Math.cos(angle) * STEP;
      y += Math.sin(angle) * STEP;
      grown += STEP;
      if (y > floor) break;

      // A soft cross-section: more motes, and brighter, at the core.
      const dist = r.from + grown;
      const n = Math.max(1, Math.round(width * 1.5));
      for (let i = 0; i < n; i++) {
        const across = gauss() * width * 0.6;
        const along = (rand() - 0.5) * STEP;
        const core = 1 - Math.min(1, Math.abs(across) / (width * 0.5 + 0.01));
        motes.push(
          x - Math.sin(angle) * across + Math.cos(angle) * along,
          y + Math.cos(angle) * across + Math.sin(angle) * along,
          dist,
          (0.55 + 0.45 * core) * (0.5 + 0.5 * Math.min(1, width / 6)) * (0.8 + 0.2 * rand()),
          rand(),
          (0.6 + 0.6 * rand()) * (0.7 + 0.3 * Math.min(1, width / 6))
        );
      }
      farthest = Math.max(farthest, dist);

      // Fork into finer roots now and then.
      const forks = r.target ? width > 3 && rand() < 0.02 : width > 1 && rand() < 0.035;
      if (forks && r.depth < 4) {
        const side = rand() < 0.5 ? -1 : 1;
        roots.push({
          x,
          y,
          angle: angle + side * (0.45 + 0.55 * rand()),
          width: width * 0.55,
          length: (r.target ? 110 : r.length - grown) * (0.45 + 0.5 * rand()),
          from: dist,
          depth: r.depth + 1,
        });
      }
    }
  }

  // Light runs out from the pot: t is distance along the roots, 0..1.
  for (let i = 2; i < motes.length; i += 6) motes[i] /= farthest;
  return new Float32Array(motes);
}

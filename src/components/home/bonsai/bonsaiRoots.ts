/*
 * Particle roots for the resting bonsai: a few strands leave the base of the
 * pot and spiral down around each other, narrowing into a single taproot at
 * the bottom centre of the hero, where the scroll-drawn root (RootStage)
 * carries on into the next section. Each strand is a soft band of motes,
 * brighter where it passes in front, so the twist reads in depth. Laid out
 * in CSS pixels of the hero, so it is rebuilt on resize.
 */

import { mulberry32 } from './bonsaiField';

/** Stride 6: x, y (CSS px), t (0 at the pot, 1 at the taproot), brightness, seed, size. */
export const ROOT_STRIDE = 6;

type P = [number, number];

const STRANDS = 5;
const TURNS = 1.3;

const cubic = (a: P, b: P, c: P, d: P, t: number): P => {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
};

/**
 * @param base  centre of the pot's base, where the strands start
 * @param tap   bottom centre of the hero, where they gather into the taproot
 * @param spread  starting radius of the spiral, about half the pot's width
 */
export function buildRoots(base: P, tap: P, spread: number): Float32Array {
  const rand = mulberry32(7);
  const out: number[] = [];

  // The spiral's axis: straight down out of the pot, easing over to the tap.
  const drop = tap[1] - base[1];
  const c1: P = [base[0], base[1] + drop * 0.45];
  const c2: P = [tap[0], tap[1] - drop * 0.4];

  for (let k = 0; k < STRANDS; k++) {
    const phase = (k / STRANDS) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const reach = 0.9 + 0.2 * rand();
    let prev: P | null = null;
    let travelled = 0;
    let next = 0;

    for (let i = 0; i <= 600; i++) {
      const u = i / 600;
      const [ax, ay] = cubic(base, c1, c2, tap, u);
      // Wide at the pot, gathering to a thread at the taproot.
      const radius = spread * reach * Math.pow(1 - u, 1.4) + 2;
      const angle = phase + u * TURNS * Math.PI * 2;
      // A helix seen from the front: sideways swing, a slight vertical
      // ellipse, and depth (cos) for brightness.
      const x = ax + radius * Math.sin(angle);
      const y = ay + radius * Math.cos(angle) * 0.16;
      const depth = (Math.cos(angle) + 1) / 2;

      if (prev) travelled += Math.hypot(x - prev[0], y - prev[1]);
      prev = [x, y];
      if (travelled < next) continue;
      next = travelled + 1.6 + 1.4 * u;

      // A soft band, thicker near the pot, so a strand never reads as a thread.
      const band = 1.2 + 3 * (1 - u);
      for (let m = 0; m < 2; m++) {
        out.push(
          x + (rand() - 0.5) * band,
          y + (rand() - 0.5) * band,
          u,
          (0.45 + 0.55 * depth) * (0.75 + 0.25 * rand()) * (1 - 0.35 * u),
          rand(),
          (0.6 + 0.6 * rand()) * (0.75 + 0.5 * depth)
        );
      }
    }

    // A few fine root hairs where the strand is still wide.
    for (const at of [0.12, 0.3]) {
      const u0 = at + 0.04 * rand();
      const [ax, ay] = cubic(base, c1, c2, tap, u0);
      const radius = spread * reach * Math.pow(1 - u0, 1.4) + 2;
      const angle = phase + u0 * TURNS * Math.PI * 2;
      const sx = ax + radius * Math.sin(angle);
      const sy = ay + radius * Math.cos(angle) * 0.16;
      const side = Math.sign(Math.sin(angle)) || 1;
      const len = 18 + 22 * rand();
      for (let d = 0; d < len; d += 2.2) {
        const f = d / len;
        out.push(
          sx + side * d * 0.8,
          sy + d * 0.55 + f * f * 6,
          u0 + 0.1 * f,
          0.5 * (1 - f),
          rand(),
          0.5 + 0.3 * rand()
        );
      }
    }
  }
  return new Float32Array(out);
}

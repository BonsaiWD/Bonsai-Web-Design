/*
 * Circuit wiring for the hero's drain (owner's request, 2026-10-30): as the
 * hero scrolls away and the tree's light drains to the root, a bus of
 * PCB traces lights up beneath it and carries the light down to the same
 * point, where the page's own trace (RootStage) carries on.
 *
 * Each trace starts at a via under the tree, drops, runs across to its lane
 * with 45° corners, runs down beside the others and fans in to the drain
 * point at 45°. The farther out a trace starts, the lower it turns, so none
 * cross. Some carry a short stub off the drop, ending in a small pad. Laid
 * down as motes, like the roots, in CSS pixels of the hero, so it is rebuilt
 * on resize; t runs 0..1 along each trace, so light reaches the drain along
 * all of them at once.
 */

import { mulberry32 } from './bonsaiField';

type P = [number, number];

/** Traces on each side of the drain. */
const PER_SIDE = 4;
/** Spacing of the lanes where the traces run down together, in px. */
const PITCH = 8;
/** The 45° corners, in px. */
const CHAMFER = 9;
/** Mote spacing along a trace, in px. */
const STEP = 1.5;

/**
 * @param rect   the tree's rectangle in the hero: x, y, width, height
 * @param drain  bottom centre of the hero, where the tree drains
 * @returns motes laid out like the roots' (ROOT_STRIDE)
 */
export function buildCircuit(rect: [number, number, number, number], drain: P): Float32Array {
  const [, ty, tw, th] = rect;
  const [cx, bottom] = drain;
  const rand = mulberry32(23);
  const motes: number[] = [];

  const mote = ([x, y]: P, t: number, brightness: number, size: number) =>
    motes.push(x, y, Math.min(1, t), brightness * (0.85 + 0.15 * rand()), rand(), size);

  /** Motes along a polyline, with t running from t0 to t1. */
  const lay = (pts: P[], t0: number, t1: number, brightness: number, size: number) => {
    const lengths = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    let walked = 0;
    lengths.forEach((len, i) => {
      const [a, b] = [pts[i], pts[i + 1]];
      for (let s = 0; s < len; s += STEP) {
        const f = s / len;
        mote([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], t0 + ((walked + s) / total) * (t1 - t0), brightness, size);
      }
      walked += len;
    });
  };

  /** A pad: a ring of motes. */
  const ring = ([x, y]: P, r: number, t: number, brightness: number) => {
    const n = Math.max(8, Math.round((Math.PI * 2 * r) / 1.2));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      mote([x + Math.cos(a) * r, y + Math.sin(a) * r], t, brightness, 0.95);
    }
  };

  for (const side of [-1, 1]) {
    const inward = -side;
    let turnAt = 0;
    for (let k = 0; k < PER_SIDE; k++) {
      const lane = cx + side * PITCH * (k + 0.5);
      const start: P = [
        cx + side * (44 + (tw * 0.42 - 44) * ((k + 0.25 + 0.5 * rand()) / PER_SIDE)),
        ty + th * (0.4 + 0.3 * rand()),
      ];
      const fanIn = bottom - PITCH * (k + 0.5);
      // Farther traces turn lower, so the runs across never cross a drop
      // (in very short windows they may have to turn sooner).
      turnAt = Math.min(Math.max(start[1] + 26 + 24 * rand(), turnAt + PITCH + 5), fanIn - CHAMFER - 4);
      const pts: P[] = [
        start,
        [start[0], turnAt - CHAMFER],
        [start[0] + inward * CHAMFER, turnAt],
        [lane - inward * CHAMFER, turnAt],
        [lane, turnAt + CHAMFER],
        [lane, fanIn],
        [cx, bottom],
      ];
      lay(pts, 0, 1, 0.6, 0.85);
      ring(start, 3.2, 0, 0.75);

      // Now and then a stub off the drop, outwards, ending in a small pad.
      const drop = turnAt - CHAMFER - start[1];
      if (drop > 40 && rand() < 0.6) {
        const at: P = [start[0], start[1] + drop * (0.35 + 0.4 * rand())];
        const end: P = [at[0] - inward * 16, at[1] + 7];
        const t = (at[1] - start[1]) / (bottom - start[1] + Math.abs(lane - start[0]));
        lay([at, [at[0] - inward * 9, at[1]], end], t, t + 0.06, 0.5, 0.8);
        ring(end, 2.2, t + 0.06, 0.65);
      }
    }
  }

  return new Float32Array(motes);
}

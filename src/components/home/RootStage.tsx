'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styled, { useTheme } from 'styled-components';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'framer-motion';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';
import { DUR, EASE_OUT } from '@/lib/motion';
import { GLINT_EASE } from '@/styles/bronze';
import { mulberry32 } from './bonsai/bonsaiField';

/*
 * The bonsai's root, drawn by scroll down the whole page, part root and
 * part circuit trace. It leaves the hero where the bonsai's taproot ends,
 * then runs like a PCB trace: straight runs down the side gutters, 45°
 * bends, and horizontal crossings between sections through a via just above
 * each section. Along the way it forks like a root, each fork ending in a
 * small pad. At the contact section it runs on down into the form, whose
 * steps are its last fan of traces (ContactWizard draws them, at the element
 * marked with ROOT_END_ATTR); without that mark it ends there in a fan of its own.
 * When a project is sent, a glint runs down its last stretch into the form
 * (PLANTED_EVENT).
 *
 * Organic roots, grown the same way as the hero's (a seeded random walk
 * that wanders, sinks and forks), sprout from it: where the hero's taproot
 * arrives, beside each via, now and then off the side runs, and in a wider
 * spray at the end. They fade towards their tips and grow in as the tip of
 * the trace passes.
 *
 * None of it runs through the page's content. Each side run keeps to the
 * margin beside its section's content column, and where that margin is too
 * narrow for the jog or the forks (as on most laptops) it goes straight down
 * without them. The organic roots stop growing where they meet content.
 *
 * A soft glow follows the tip and brightens while the page is scrolling,
 * then settles when it stops. It sits behind the sections (z-index -1 in an
 * isolated stage). Phones get no root. Under reduced motion it is drawn in
 * full, with no glow.
 */

/** Where the root isn't drawn (phones). One media feature, so it can be combined with `and`. */
export const ROOT_HIDDEN_QUERY = '(max-width: 767px)';

const ease = `cubic-bezier(${EASE_OUT.join(', ')})`;

const Stage = styled.div`
  position: relative;
  isolation: isolate;
`;

const Svg = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
  pointer-events: none;

  @media ${ROOT_HIDDEN_QUERY} {
    display: none;
  }
`;

const Trace = styled(motion.path)<{ $width: number; $alpha: number }>`
  fill: none;
  stroke: ${({ theme }) => theme.colors.primary};
  stroke-width: ${({ $width }) => $width};
  stroke-opacity: ${({ $alpha }) => $alpha};
  stroke-linecap: round;
  stroke-linejoin: round;
`;

const Via = styled.circle`
  fill: ${({ theme }) => theme.colors.background};
  stroke: ${({ theme }) => theme.colors.primary};
  stroke-opacity: 0.6;
  stroke-width: 1;
  transition: fill ${DUR.state}s ${ease};

  &[data-reached='true'] {
    fill: ${({ theme }) => theme.colors.primary};
  }
`;

const RootletPath = styled.path`
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

// The glint that runs down the last stretch when a project is sent, bone-white like the hero's
const Glint = styled.path`
  fill: none;
  stroke: ${({ theme }) => theme.colors.text};
  stroke-width: 1.75;
  stroke-linecap: round;
  opacity: 0;
`;

const Pad = styled.circle`
  fill: ${({ theme }) => theme.colors.primary};
  fill-opacity: 0;
  transition: fill-opacity ${DUR.state}s ${ease};

  &[data-reached='true'] {
    fill-opacity: 0.55;
  }
`;

type P = [number, number];

interface Fork {
  d: string;
  /** Depth (y) where the fork starts and ends, for drawing it as the tip passes. */
  from: number;
  to: number;
  end: P;
}

interface Rootlet {
  d: string;
  from: number;
  to: number;
  width: number;
  /** Start and tip, for the fade along it. */
  a: P;
  b: P;
}

interface Geometry {
  w: number;
  h: number;
  main: string;
  forks: Fork[];
  rootlets: Rootlet[];
  vias: P[];
}

/** A rectangle in the stage, by its edges. */
interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** Lengths of the comet of light near the tip: a soft tail and a bright head. */
const TAIL = 200;
const HEAD = 70;

/** The room the root keeps from the page's content, so it never runs through text. */
const CLEAR = 12;

/** The attribute that marks where the root ends inside the last section: it runs down to the top centre of that element. */
export const ROOT_END_ATTR = 'data-root-end';

/** The root's tip sits this far down the viewport as the page scrolls. */
export const ROOT_TIP_AT = 0.72;

/** Dispatched on window when a project is sent: a glint runs down the root's last stretch. */
export const PLANTED_EVENT = 'bonsai:planted';

/** How long that glint takes, and how far back up the root it starts (px). */
export const ROOT_GLINT_MS = 900;
const GLINT_RUN = 520;
const GLINT = 90;

/** An element's offset within an ancestor, by layout, so a transform mid-animation doesn't skew it. */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): P {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== ancestor; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return [x, y];
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const fmt = ([x, y]: P) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** A polyline with softly rounded corners, like a routed trace. */
function trace(points: P[], radius = 10) {
  const pts = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
  let d = `M${fmt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const p1: P = [b[0] - ((b[0] - a[0]) / l1) * r, b[1] - ((b[1] - a[1]) / l1) * r];
    const p2: P = [b[0] + ((c[0] - b[0]) / l2) * r, b[1] + ((c[1] - b[1]) / l2) * r];
    d += ` L${fmt(p1)} Q${fmt(b)} ${fmt(p2)}`;
  }
  return `${d} L${fmt(pts[pts.length - 1])}`;
}

/** A root fork off a vertical run: 45° inwards, down, ending in a pad, with a short split at the bend. */
function forksAt(x: number, y: number, inward: number, length: number): Fork[] {
  const bend: P = [x + inward * 24, y + 24];
  const end: P = [bend[0], bend[1] + length];
  const split: P = [bend[0] + inward * 20, bend[1] + 20];
  return [
    { d: trace([[x, y], bend, end], 8), from: y, to: end[1], end },
    { d: trace([bend, split]), from: bend[1], to: split[1], end: split },
  ];
}

const DOWN = Math.PI / 2;

/**
 * An organic root: a random walk that wanders with some momentum, sinks a
 * little (gravity), and forks into finer roots, as in the hero. It stops
 * where it would leave the free ground, i.e. reach the page's content.
 */
function grow(rand: () => number, free: (p: P) => boolean, start: P, angle: number, length: number, width: number, gravity = 0.02, depth = 0): Rootlet[] {
  const pts: P[] = [start];
  const found: Rootlet[] = [];
  let [x, y] = start;
  let a = angle;
  let turn = 0;
  for (let g = 0; g < length; g += 4) {
    turn = turn * 0.8 + (rand() - 0.5) * 0.18;
    a += turn + (DOWN - a) * gravity;
    x += Math.cos(a) * 4;
    y += Math.sin(a) * 4;
    if (!free([x, y])) break;
    pts.push([x, y]);
    if (depth < 2 && g > 16 && rand() < 0.05) {
      const side = rand() < 0.5 ? -1 : 1;
      found.push(...grow(rand, free, [x, y], a + side * (0.5 + 0.5 * rand()), (length - g) * (0.4 + 0.4 * rand()), width * 0.65, gravity, depth + 1));
    }
  }
  // Stopped almost at once: too short to read as a root.
  if (pts.length < 4) return [];
  const d = `M${pts.map(fmt).join(' L')}`;
  const ys = pts.map((p) => p[1]);
  return [{ d, from: Math.min(...ys), to: Math.max(...ys), width, a: start, b: pts[pts.length - 1] }, ...found];
}

/** A section's content column (its container, less padding), in stage coordinates. */
function contentBox(section: HTMLElement): Box {
  const col = section.firstElementChild as HTMLElement;
  const pad = getComputedStyle(col);
  const x = section.offsetLeft + col.offsetLeft;
  const y = section.offsetTop + col.offsetTop;
  return {
    l: x + parseFloat(pad.paddingLeft),
    t: y + parseFloat(pad.paddingTop),
    r: x + col.clientWidth - parseFloat(pad.paddingRight),
    b: y + col.clientHeight - parseFloat(pad.paddingBottom),
  };
}

function measure(stage: HTMLElement): Geometry {
  const w = stage.clientWidth;
  const h = stage.scrollHeight;
  const cx = w / 2;
  const gutter = clamp(w * 0.03, 20, 56);
  const sections = Array.from(stage.querySelectorAll<HTMLElement>(':scope > section'));
  const boxes = sections.map(contentBox);
  // Ground the roots may grow through: anywhere at least CLEAR away from every section's content.
  const free = ([x, y]: P) => boxes.every((b) => x < b.l - CLEAR || x > b.r + CLEAR || y < b.t - CLEAR || y > b.b + CLEAR);
  const pts: P[] = [[cx, 0]];
  const forks: Fork[] = [];
  const rootlets: Rootlet[] = [];
  const vias: P[] = [];
  const rand = mulberry32(5);
  let prevSide = cx;

  // Where the hero's taproot arrives: a few roots spread out, so the two read as one.
  for (const side of [-1, 1, 1]) {
    rootlets.push(...grow(rand, free, [cx + side * 4, 6], DOWN - side * (0.9 + 0.4 * rand()), 140 + 90 * rand(), 1.3, 0.012));
  }

  sections.forEach((section, i) => {
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    // The side run sits in the gutter, or halfway across the margin beside the content where that is narrower,
    // and reaches in towards the content only as far as `room` allows.
    const margin = i % 2 === 0 ? boxes[i].l : w - boxes[i].r;
    const inset = Math.min(gutter, margin / 2);
    const side = i % 2 === 0 ? inset : w - inset;
    const out = Math.sign(side - cx);
    const room = margin - inset - CLEAR;

    if (i > 0) {
      // From the previous gutter: 45° in, across the gap, 45° into the via.
      const towards = Math.sign(cx - prevSide);
      pts.push([prevSide, top - 70], [prevSide + towards * 40, top - 30], [cx - towards * 30, top - 30], [cx, top]);
      vias.push([cx, top]);
      // Rootlets reaching out sideways from the via, staying above the heading.
      for (const side of [-1, 1]) {
        rootlets.push(...grow(rand, free, [cx + side * 6, top + 2], DOWN - side * (1.2 + 0.2 * rand()), 110 + 80 * rand(), 1.1, 0.006));
      }
    }

    if (i === sections.length - 1) {
      const mark = section.querySelector<HTMLElement>(`[${ROOT_END_ATTR}]`);
      if (mark) {
        // The end, where the section marks it: straight down into the form, which draws the last fan.
        const [mx, my] = offsetWithin(mark, stage);
        const ex = mx + mark.offsetWidth / 2;
        if (Math.abs(ex - cx) > 1) pts.push([cx, my - 40 - Math.abs(ex - cx)], [ex, my - 40]);
        pts.push([ex, my]);
      } else {
        // The end: a fan of traces spreading like roots, each ending in a pad.
        for (const k of [-2, -1, 1, 2]) {
          const a = Math.abs(k);
          const dir = Math.sign(k);
          const end: P = [cx + dir * (60 + 80 * a), top + 16 * a];
          forks.push({ d: trace([[cx, top], [cx + dir * 16 * a, top + 16 * a], end], 8), from: top, to: top + 120 * a, end });
        }
      }
      // And a wider spray of roots, as the root system ends.
      for (const side of [-1, 1, -1, 1]) {
        rootlets.push(...grow(rand, free, [cx + side * 8, top + 4], DOWN - side * (0.8 + 0.5 * rand()), 170 + 110 * rand(), 1.3, 0.01));
      }
      return;
    }

    // Out of the via: 45° away, across, 45° down onto the gutter.
    const entry = top + 70;
    pts.push([cx + out * 30, top + 30], [side - out * 40, top + 30], [side, entry]);

    // Down the gutter, with one small jog inwards (12px) and two root forks (reaching 44px in), where there is room.
    const leave = bottom - 70;
    const run = leave - entry;
    if (run > 260) {
      if (room >= 12) {
        const jog = entry + run * 0.5;
        pts.push([side, jog], [side - out * 12, jog + 12], [side - out * 12, jog + 92], [side, jog + 104]);
      }
      if (room >= 44) {
        forks.push(...forksAt(side, entry + run * 0.26, -out, 40 + (i % 3) * 18));
        forks.push(...forksAt(side, entry + run * 0.74, -out, 70 - (i % 3) * 12));
      }
      // Organic roots wandering inwards off the run, as far as the content.
      for (const at of [0.1, 0.42, 0.85]) {
        rootlets.push(...grow(rand, free, [side, entry + run * at], DOWN + out * (0.7 + 0.4 * rand()), 150 + 110 * rand(), 1.2));
      }
    }
    pts.push([side, leave]);
    prevSide = side;
  });

  return { w, h, main: trace(pts), forks, rootlets, vias };
}

export default function RootStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<SVGPathElement>(null);
  const haloRef = useRef<SVGPathElement>(null);
  const tailRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGGElement>(null);
  const glintRef = useRef<SVGPathElement>(null);
  const forkRefs = useRef<(SVGPathElement | null)[]>([]);
  const padRefs = useRef<(SVGCircleElement | null)[]>([]);
  const rootletRefs = useRef<(SVGPathElement | null)[]>([]);
  const viaRefs = useRef<(SVGCircleElement | null)[]>([]);
  const lookup = useRef<{ ys: Float32Array; ls: Float32Array; total: number } | null>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const reduce = useReducedMotionSafe();
  const theme = useTheme();

  // The tip sits 72% of the way down the viewport. Its length is eased, so
  // a horizontal crossing (drawn over a few pixels of scroll) runs smoothly.
  const { scrollYProgress, scrollY } = useScroll({ target: stageRef, offset: [`start ${ROOT_TIP_AT}`, `end ${ROOT_TIP_AT}`] });
  const target = useMotionValue(0);
  const drawn = useSpring(target, { stiffness: 120, damping: 30, restDelta: 0.5 });

  // The glow brightens with scroll speed and settles when scrolling stops.
  const velocity = useVelocity(scrollY);
  const speed = useTransform(velocity, (v) => Math.min(1, Math.abs(v) / 1400));
  const glow = useSpring(speed, { stiffness: 80, damping: 22 });
  const cometOpacity = useTransform(glow, (g) => 0.3 + 0.7 * g);
  const haloOpacity = useTransform(glow, (g) => 0.5 + 0.5 * g);

  const aim = (progress: number) => {
    const lk = lookup.current;
    if (!geo || !lk) return;
    const tipY = progress * geo.h;
    let lo = 0;
    let hi = lk.ys.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lk.ys[mid] < tipY) lo = mid + 1;
      else hi = mid;
    }
    target.set(lk.ls[lo]);
  };

  const render = (len: number) => {
    const lk = lookup.current;
    const path = mainRef.current;
    if (!geo || !lk || !path) return;
    const total = lk.total;
    for (const el of [mainRef.current, haloRef.current]) if (el) el.style.strokeDashoffset = String(total - len);
    if (tailRef.current) tailRef.current.style.strokeDashoffset = String(TAIL - len);
    if (headRef.current) headRef.current.style.strokeDashoffset = String(HEAD - len);

    const tip = path.getPointAtLength(len);
    if (tipRef.current) {
      tipRef.current.style.opacity = len > 2 && len < total - 2 ? '1' : '0';
      tipRef.current.setAttribute('transform', `translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)})`);
    }
    geo.vias.forEach(([, y], i) => viaRefs.current[i]?.setAttribute('data-reached', String(tip.y >= y - 1)));
    geo.forks.forEach((f, i) => {
      const local = clamp((tip.y - f.from) / (f.to - f.from + 40), 0, 1);
      const el = forkRefs.current[i];
      if (el) el.style.strokeDashoffset = String(1 - local);
      padRefs.current[i]?.setAttribute('data-reached', String(local >= 1));
    });
    geo.rootlets.forEach((r, i) => {
      const local = clamp((tip.y - r.from) / (r.to - r.from + 60), 0, 1);
      const el = rootletRefs.current[i];
      if (el) el.style.strokeDashoffset = String(1 - local);
    });
  };

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (!reduce) aim(p);
  });
  useMotionValueEvent(drawn, 'change', render);

  // Re-measure whenever the page content changes size.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => setGeo(measure(stage)));
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  // Once the trace is in the DOM: its length-by-depth lookup and dash setup.
  useEffect(() => {
    const path = mainRef.current;
    if (!geo || !path) return;
    const total = path.getTotalLength();
    const n = Math.ceil(total / 6) + 1;
    const ys = new Float32Array(n);
    const ls = new Float32Array(n);
    let maxY = 0;
    for (let i = 0; i < n; i++) {
      const l = Math.min(total, i * 6);
      maxY = Math.max(maxY, path.getPointAtLength(l).y);
      ys[i] = maxY;
      ls[i] = l;
    }
    lookup.current = { ys, ls, total };
    for (const el of [mainRef.current, haloRef.current]) if (el) el.style.strokeDasharray = `${total} ${total}`;
    if (tailRef.current) tailRef.current.style.strokeDasharray = `${TAIL} ${total + TAIL}`;
    if (headRef.current) headRef.current.style.strokeDasharray = `${HEAD} ${total + HEAD}`;
    if (glintRef.current) glintRef.current.style.strokeDasharray = `${GLINT} ${total + GLINT}`;
    if (reduce) {
      drawn.jump(total);
      render(total);
    } else {
      aim(scrollYProgress.get());
      render(drawn.get());
    }
    // render and aim read the latest geometry through closures; rerun only on layout changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, reduce]);

  // When a project is sent, a glint runs down the root's last stretch and fades as it reaches the form.
  useEffect(() => {
    const onPlanted = () => {
      const lk = lookup.current;
      const el = glintRef.current;
      if (!lk || !el) return;
      el.animate(
        [
          { offset: 0, strokeDashoffset: `${GLINT - (lk.total - GLINT_RUN)}px`, opacity: 0 },
          { offset: 0.2, opacity: 1 },
          { offset: 0.85, opacity: 1 },
          { offset: 1, strokeDashoffset: `${GLINT - lk.total}px`, opacity: 0 },
        ],
        { duration: ROOT_GLINT_MS, easing: GLINT_EASE },
      );
    };
    window.addEventListener(PLANTED_EVENT, onPlanted);
    return () => window.removeEventListener(PLANTED_EVENT, onPlanted);
  }, []);

  return (
    <Stage ref={stageRef}>
      {children}
      {geo && (
        <Svg width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
          <defs>
            <radialGradient id="root-tip-halo">
              <stop offset="0%" stopColor={theme.colors.primary} stopOpacity={0.14} />
              <stop offset="100%" stopColor={theme.colors.primary} stopOpacity={0} />
            </radialGradient>
            {geo.rootlets.map((r, i) => (
              <linearGradient
                key={i}
                id={`root-fade-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={r.a[0]}
                y1={r.a[1]}
                x2={r.b[0]}
                y2={r.b[1]}
              >
                <stop offset="0%" stopColor={theme.colors.primary} stopOpacity={0.6} />
                <stop offset="100%" stopColor={theme.colors.primary} stopOpacity={0.08} />
              </linearGradient>
            ))}
          </defs>
          <Trace ref={haloRef} d={geo.main} $width={4} $alpha={0.08} style={{ opacity: reduce ? 1 : haloOpacity }} />
          <Trace ref={mainRef} d={geo.main} $width={1.25} $alpha={0.5} />
          {geo.forks.map((f, i) => (
            <Trace
              key={`f${i}`}
              d={f.d}
              $width={0.8}
              $alpha={0.34}
              pathLength={1}
              style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
              ref={(el) => {
                forkRefs.current[i] = el;
              }}
            />
          ))}
          {geo.rootlets.map((r, i) => (
            <RootletPath
              key={`r${i}`}
              d={r.d}
              stroke={`url(#root-fade-${i})`}
              strokeWidth={r.width}
              pathLength={1}
              style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
              ref={(el) => {
                rootletRefs.current[i] = el;
              }}
            />
          ))}
          {geo.forks.map((f, i) => (
            <Pad
              key={`p${i}`}
              cx={f.end[0]}
              cy={f.end[1]}
              r={2.2}
              ref={(el) => {
                padRefs.current[i] = el;
              }}
            />
          ))}
          {geo.vias.map(([x, y], i) => (
            <Via
              key={`v${i}`}
              cx={x}
              cy={y}
              r={4.5}
              ref={(el) => {
                viaRefs.current[i] = el;
              }}
            />
          ))}
          {!reduce && (
            <motion.g style={{ opacity: cometOpacity }}>
              <Trace ref={tailRef} d={geo.main} $width={3} $alpha={0.22} />
              <Trace ref={headRef} d={geo.main} $width={1.5} $alpha={0.75} />
              <g ref={tipRef} style={{ opacity: 0 }}>
                <circle r={22} fill="url(#root-tip-halo)" />
                <circle r={3} fill={theme.colors.primary} fillOpacity={0.7} />
              </g>
            </motion.g>
          )}
          {!reduce && <Glint ref={glintRef} d={geo.main} />}
        </Svg>
      )}
    </Stage>
  );
}

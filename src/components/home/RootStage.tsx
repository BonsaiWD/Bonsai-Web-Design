'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import styled, { useTheme } from 'styled-components';
import { motion, useMotionValue, useMotionValueEvent, useScroll } from 'framer-motion';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';
import { DUR, EASE_OUT } from '@/lib/motion';

const ease = `cubic-bezier(${EASE_OUT.join(', ')})`;

/*
 * The bonsai's root, drawn by scroll down the whole page. It leaves the hero
 * where the dissolved tree drains away, then weaves between the side
 * gutters, crossing the page between sections. Each crossing is a node just
 * above the next section's heading, so the root links one section to the
 * next. Two strands twist around each other and meet at every node. The
 * root ends at the contact section in a spray of fine rootlets.
 *
 * It sits behind the sections (z-index -1 in an isolated stage), so their
 * translucent washes veil it slightly. Phones get no root. Under reduced
 * motion it is drawn in full, with no tip.
 */

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

  @media (max-width: 767px) {
    display: none;
  }
`;

const Strand = styled(motion.path)<{ $twin?: boolean }>`
  fill: none;
  stroke: ${({ theme }) => theme.colors.primary};
  stroke-opacity: ${({ $twin }) => ($twin ? 0.28 : 0.5)};
  stroke-width: ${({ $twin }) => ($twin ? 0.75 : 1.25)};
  stroke-linecap: round;
`;

const Rootlet = styled.path`
  fill: none;
  stroke: ${({ theme }) => theme.colors.primary};
  stroke-opacity: 0.32;
  stroke-width: 0.75;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
`;

const Node = styled.circle`
  fill: ${({ theme }) => theme.colors.background};
  stroke: ${({ theme }) => theme.colors.primary};
  stroke-opacity: 0.6;
  stroke-width: 1;
  transition: fill ${DUR.state}s ${ease};

  &[data-reached='true'] {
    fill: ${({ theme }) => theme.colors.primary};
  }
`;

const Tip = styled.g`
  transition: opacity ${DUR.state}s ${ease};
`;

type Point = [number, number];

interface Geometry {
  w: number;
  h: number;
  main: string;
  twin: string;
  nodes: Point[];
  rootlets: { d: string; y: number }[];
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Smooth curve through the points (Catmull-Rom as cubic Béziers). */
function curve(p: Point[]) {
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i];
    const b = p[i];
    const c = p[i + 1];
    const e = p[i + 2] ?? c;
    const c1: Point = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2: Point = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
  }
  return d;
}

function rootlet([x, y]: Point, dx: number, dy: number) {
  return `M${x},${y} q${(dx * 0.45).toFixed(1)},${(dy * 0.1).toFixed(1)} ${dx.toFixed(1)},${dy.toFixed(1)}`;
}

function measure(stage: HTMLElement): Geometry {
  const w = stage.clientWidth;
  const h = stage.scrollHeight;
  const gutter = clamp(w * 0.03, 20, 56);
  const sections = Array.from(stage.querySelectorAll<HTMLElement>(':scope > section'));
  const main: Point[] = [[w / 2, 0]];
  const twin: Point[] = [[w / 2, 0]];
  const nodes: Point[] = [];
  const rootlets: { d: string; y: number }[] = [];

  sections.forEach((section, i) => {
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    const last = i === sections.length - 1;

    if (i > 0) {
      const node: Point = [w / 2, top];
      main.push(node);
      twin.push(node);
      nodes.push(node);
      const spread = last ? [-180, -120, -70, 70, 120, 180] : [-90, 90];
      spread.forEach((dx, k) => {
        rootlets.push({ d: rootlet(node, dx * (0.8 + 0.4 * ((k * 37) % 10) / 10), last ? 18 + k * 4 : 14), y: top });
      });
    }
    if (last) return;

    const side = i % 2 === 0 ? gutter : w - gutter;
    const lean = i % 2 === 0 ? 1 : -1;
    const heading = section.querySelector('h2');
    const headTop = heading ? heading.getBoundingClientRect().top - section.getBoundingClientRect().top : 120;
    const enter = top + clamp(headTop - 40, 28, 110);
    const leave = bottom - 140;
    const steps = Math.max(1, Math.round((leave - enter) / 240));
    for (let k = 0; k <= steps; k++) {
      const y = enter + ((leave - enter) * k) / steps;
      const wander = Math.sin(y * 0.005 + i * 1.7) * 12 * lean;
      main.push([side + wander, y]);
      twin.push([side + wander + (k % 2 === 0 ? 7 : -7), y]);
    }
  });

  return { w, h, main: curve(main), twin: curve(twin), nodes, rootlets };
}

export default function RootStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<SVGGElement>(null);
  const rootletRefs = useRef<(SVGPathElement | null)[]>([]);
  const nodeRefs = useRef<(SVGCircleElement | null)[]>([]);
  const lookup = useRef<{ ys: Float32Array; ls: Float32Array; total: number } | null>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const reduce = useReducedMotionSafe();
  const theme = useTheme();
  const drawn = useMotionValue(0);

  // The tip sits 72% of the way down the viewport.
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start 0.72', 'end 0.72'] });

  const update = useCallback(
    (progress: number) => {
      const lk = lookup.current;
      if (!geo || !lk) return;
      const tipY = reduce ? geo.h : progress * geo.h;

      // Binary search the length at which the root reaches tipY.
      let lo = 0;
      let hi = lk.ys.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (lk.ys[mid] < tipY) lo = mid + 1;
        else hi = mid;
      }
      const len = lk.ls[lo];
      drawn.set(len / lk.total);

      geo.nodes.forEach(([, y], i) => nodeRefs.current[i]?.setAttribute('data-reached', String(tipY >= y)));
      geo.rootlets.forEach(({ y }, i) => {
        const el = rootletRefs.current[i];
        if (el) el.style.strokeDashoffset = String(1 - clamp((tipY - y) / 140, 0, 1));
      });

      const tip = tipRef.current;
      const path = mainRef.current;
      if (tip && path) {
        const visible = !reduce && len > 2 && len < lk.total - 2;
        tip.style.opacity = visible ? '1' : '0';
        if (visible) {
          const pt = path.getPointAtLength(len);
          tip.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
        }
      }
    },
    [geo, reduce, drawn]
  );

  useMotionValueEvent(scrollYProgress, 'change', update);

  // Re-measure whenever the page content changes size.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => setGeo(measure(stage)));
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  // Build the length-by-depth lookup once the path is in the DOM.
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
    update(scrollYProgress.get());
  }, [geo, update, scrollYProgress]);

  return (
    <Stage ref={stageRef}>
      {children}
      {geo && (
        <Svg width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
          <defs>
            <radialGradient id="root-tip-halo">
              <stop offset="0%" stopColor={theme.colors.primary} stopOpacity={0.1} />
              <stop offset="100%" stopColor={theme.colors.primary} stopOpacity={0} />
            </radialGradient>
          </defs>
          <Strand $twin d={geo.twin} style={{ pathLength: drawn }} />
          <Strand ref={mainRef} d={geo.main} style={{ pathLength: drawn }} />
          {geo.rootlets.map((r, i) => (
            <Rootlet
              key={i}
              d={r.d}
              pathLength={1}
              ref={(el) => {
                rootletRefs.current[i] = el;
              }}
            />
          ))}
          {geo.nodes.map(([x, y], i) => (
            <Node
              key={i}
              cx={x}
              cy={y}
              r={5.5}
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
            />
          ))}
          <Tip ref={tipRef} style={{ opacity: 0 }}>
            <circle r={18} fill="url(#root-tip-halo)" />
            <circle r={3} fill={theme.colors.primary} fillOpacity={0.7} />
          </Tip>
        </Svg>
      )}
    </Stage>
  );
}

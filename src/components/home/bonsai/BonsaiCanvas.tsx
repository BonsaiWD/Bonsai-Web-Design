'use client';

import { useEffect, useRef, type RefObject } from 'react';
import styled, { useTheme } from 'styled-components';
import { useMotionValueEvent, useScroll } from 'framer-motion';
import { buildBonsaiField } from './bonsaiField';
import { createBonsaiRenderer, type BonsaiRenderer } from './bonsaiRenderer';
import { buildRoots } from './bonsaiRoots';
import { BONSAI_SOURCE, INTRO } from './timeline';

const Canvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
`;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
/** Scrolling during the intro plays the rest of it at this speed, text included. */
const HURRY = 4;

interface Props {
  heroRef: RefObject<HTMLElement | null>;
  /** The hidden still's <img>: the photo the tree is grown from. */
  imageRef: RefObject<HTMLImageElement | null>;
  /** The H1, whose CSS entrance is the intro's clock. */
  clockRef: RefObject<HTMLElement | null>;
  /**
   * The default: no particles until the visitor scrolls, then the photo
   * turns to light with the scroll while the hero holds still on its runway.
   * False for the automatic dissolve (?dissolve=auto), which plays on its own.
   */
  dissolveOnScroll: boolean;
  onFallback: () => void;
}

/*
 * The growing bonsai. Runs one finite timeline (grow, dissolve, rest), then
 * stops its frame loop and redraws only when the hero scrolls or resizes.
 */
export default function BonsaiCanvas({ heroRef, imageRef, clockRef, dissolveOnScroll, onFallback }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  const exit = useRef(0);
  const scrolledDissolve = useRef(0);
  const requestDraw = useRef<() => void>(() => {});

  // Scroll through the hero: first its runway (the default dissolve), then
  // its exit (the drain to the root). Without a runway the whole scroll is
  // exit.
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const hero = heroRef.current;
    const canvas = canvasRef.current;
    if (!hero || !canvas) return;
    const pinned = canvas.clientHeight || 1;
    const runway = Math.max(0, hero.offsetHeight - pinned);
    const scrolled = p * hero.offsetHeight;
    // Short windows get no runway (the hero is compact), so the tree turns
    // to light over the first part of the hero's exit instead.
    scrolledDissolve.current = clamp01(scrolled / (runway > 0 ? runway : pinned * 0.4));
    exit.current = clamp01((scrolled - runway) / pinned);
    requestDraw.current();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = heroRef.current;
    if (!canvas || !hero) return;

    let cancelled = false;
    let renderer: BonsaiRenderer | null = null;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    let last = 0;
    let clock = 0;
    let rate = 1;

    // The CSS entrance animations only; framer runs scroll-linked ones here too.
    const heroAnimations = () =>
      hero.getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation && a.timeline === document.timeline);

    /** Where the intro is now, read from the H1's CSS animation. */
    const readClock = () => {
      const anim = clockRef.current?.getAnimations()[0];
      const now = Number(document.timeline.currentTime);
      if (anim && anim.startTime != null && Number.isFinite(now)) return now - Number(anim.startTime);
      return INTRO.end;
    };

    /*
     * Two dissolves, both kept by the owner (2026-10-29). By default the tree
     * holds, dimmed behind the text, and turns to light as the visitor
     * scrolls (scrolledDissolve). With ?dissolve=auto it dissolves on its own
     * as the text arrives.
     */
    const onScroll = dissolveOnScroll;
    const dissolveLength = INTRO.dissolveEnd - INTRO.dissolveStart;
    const holdEnd = Math.max(INTRO.growEnd, INTRO.text + INTRO.textSettle) + 120;
    const introEnd = onScroll ? holdEnd : INTRO.end;

    const frame = (now: number) => {
      raf = 0;
      if (!renderer) return;
      clock += last ? (now - last) * rate : 0;
      last = now;
      const dissolve = onScroll
        ? scrolledDissolve.current
        : clamp01((clock - INTRO.dissolveStart) / dissolveLength);
      const e = exit.current;
      renderer.draw({
        intro: easeOut(clamp01(clock / INTRO.fadeIn)),
        grow: easeInOut(clamp01((clock - INTRO.growStart) / (INTRO.growEnd - INTRO.growStart))) * 1.06,
        dissolve,
        dim: onScroll ? 0.4 * clamp01((clock - INTRO.text) / INTRO.textSettle) : 0,
        edgeMotes: onScroll ? 0 : 1,
        exit: e,
        time: clock / 1000,
      });
      const busy = clock < introEnd;
      // Offscreen mid-intro, the loop pauses but keeps `last`, so the clock
      // catches up with the text when the hero comes back.
      if (busy && e < 1) raf = requestAnimationFrame(frame);
      else if (!busy) last = 0;
    };

    requestDraw.current = () => {
      if (!raf && renderer) raf = requestAnimationFrame(frame);
    };

    const hurry = () => {
      if (clock >= introEnd || rate !== 1) return;
      rate = HURRY;
      for (const a of heroAnimations()) a.updatePlaybackRate(HURRY);
    };



    const start = async () => {
      // Same URL as the hidden still, so it comes from the HTTP cache. A plain
      // Image, because a srcset <img> reports density-corrected sizes.
      const still = imageRef.current;
      const img = new Image();
      try {
        if (!still) throw new Error('no source image');
        img.src = still.currentSrc || still.src;
        await img.decode();
      } catch {
        if (!cancelled) onFallback();
        return;
      }
      if (cancelled) return;

      // The canvas fills the hero's pinned layer.
      const treeHeight = () => Math.min(canvas.clientHeight * 0.8, 780);
      const count = Math.round(16000 * Math.min(1.2, Math.max(0.6, treeHeight() / 760)));
      const field = buildBonsaiField(img, BONSAI_SOURCE, count);
      renderer = createBonsaiRenderer(canvas, field, { tint: theme.colors.primary, hot: theme.colors.text });
      if (!renderer) {
        onFallback();
        return;
      }

      const layout = () => {
        if (!renderer) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const th = treeHeight();
        const tw = th * field.aspect;
        const x = (w - tw) / 2;
        const y = h * 0.47 - th / 2;
        const [bx, by] = BONSAI_SOURCE.rootBase;
        renderer.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
        renderer.layout([x, y, tw, th], [w / 2, h]);
        renderer.roots(buildRoots([x + bx * tw, y + by * th], [w / 2, h], tw * 0.17));
        requestDraw.current();
      };
      ro = new ResizeObserver(layout);
      ro.observe(canvas);

      clock = readClock();
      if (process.env.NODE_ENV !== 'production') {
        // Review aid: __bonsaiSeek(ms) freezes the intro, text included, at ms.
        (window as unknown as { __bonsaiSeek: (ms: number) => void }).__bonsaiSeek = (ms) => {
          rate = 0;
          clock = ms;
          for (const a of heroAnimations()) {
            a.pause();
            a.currentTime = ms;
          }
          requestDraw.current();
        };
      }
      // Any input plays the rest of the intro quickly: it now runs longer
      // than 5 s, and WCAG 2.2.2 asks that moving content can be cut short.
      window.addEventListener('scroll', hurry, { passive: true });
      window.addEventListener('keydown', hurry);
      window.addEventListener('pointerdown', hurry);
      if (window.scrollY > 0) hurry();
      layout();
    };

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('scroll', hurry);
      window.removeEventListener('keydown', hurry);
      window.removeEventListener('pointerdown', hurry);
      requestDraw.current = () => {};
      renderer?.dispose();
      renderer = null;
    };
  }, [heroRef, imageRef, clockRef, dissolveOnScroll, onFallback, theme.colors.primary, theme.colors.text]);

  return <Canvas ref={canvasRef} aria-hidden="true" />;
}

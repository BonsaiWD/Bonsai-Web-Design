'use client';

import styled, { css, keyframes, type DefaultTheme } from 'styled-components';
import { motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { Container } from '../layout/Container';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useMediaQuery, useReducedMotionSafe } from '@/lib/useMediaQuery';
import { DUR, EASE_OUT, RISE } from '@/lib/motion';
import BonsaiCanvas from './bonsai/BonsaiCanvas';
import BonsaiStill from './bonsai/BonsaiStill';
import { BONSAI_INTRO_QUERY, BONSAI_SOURCE, DISSOLVE_RUNWAY, INTRO, TREE } from './bonsai/timeline';

/*
 * The hero entrance runs on CSS keyframes, not framer initial/animate, so the
 * headline, subtext and CTAs are in the server HTML and appear without
 * waiting for hydration. Supporting elements follow in 100ms steps.
 *
 * Where the bonsai intro plays, the text waits for the tree instead: it
 * settles in front of it as the growth nears its final form (INTRO.text).
 * It is still plain CSS, so it never depends on JavaScript, the image or
 * WebGL; the canvas follows the text's clock, not the other way round.
 */
const heroIn = keyframes`
  from { opacity: 0; transform: translateY(${RISE.item}px); }
  to { opacity: 1; transform: none; }
`;

const heroSettle = keyframes`
  from { opacity: 0; transform: translateY(${RISE.max}px); filter: blur(2px); }
  to { opacity: 1; transform: none; filter: none; }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
`;

const SETTLE_S = INTRO.textSettle / 1000;

/*
 * "timeless" catches the light once as it lands (owner's request,
 * 2026-10-30): a bone-white glint with a bronze halo travels through the word
 * from left to right, like the light through the tree, and leaves it
 * polished bronze (owner, the same day; a resting glow and a bevel were tried
 * and dropped). The glint and the polish are the word's own fill, gradients
 * clipped to the text; the halo is a copy of the word drawn only as its
 * text-shadow, masked to the same band. They share one box, so they move
 * together. The polished word is the resting state, so reduced motion shows
 * it too, without the sweep.
 */
const glint = keyframes`
  from { background-position: 100% 0; mask-position: 100% 0; }
  to { background-position: 0 0; mask-position: 0 0; }
`;
const GLINT_S = 3.6;
const GLINT_EASE = 'cubic-bezier(0.37, 0, 0.63, 1)';

/** Bronze lit toward bone, or shaded toward the page's own dark, which polished metal reflects. */
const lit = (pct: number) => ({ theme }: { theme: DefaultTheme }) =>
  `color-mix(in srgb, ${theme.colors.primary}, ${theme.colors.text} ${pct}%)`;
const shade = (pct: number) => ({ theme }: { theme: DefaultTheme }) =>
  `color-mix(in srgb, ${theme.colors.primary}, ${theme.colors.background} ${pct}%)`;

/*
 * Polished bronze lit from above: bright where the light meets the tops of
 * the letters, a dark horizon across the lowercase, and light bouncing up
 * near the baseline. The stops are in em down the word's box (0.5em padding,
 * then a 1.1 line): the ascenders reach up to 0.66em, the lowercase runs from
 * 0.93em to the baseline at 1.46em.
 */
const polishedBronze = css`
  linear-gradient(
    180deg,
    ${shade(40)} 0.66em,
    ${lit(45)} 0.8em,
    ${lit(60)} 0.93em,
    ${lit(10)} 1.1em,
    ${shade(28)} 1.17em,
    ${shade(12)} 1.22em,
    ${lit(25)} 1.4em,
    ${shade(15)} 1.48em
  )
`;

/*
 * The same polish for the subtext's capitals, one line box (1.8em) tall: the
 * capitals run from 0.53em to the baseline at 1.26em. Gentler than the
 * headline's, so the small text stays legible: its darkest stop is 5:1 on
 * the page.
 */
const bronzeCaps = css`
  linear-gradient(
    180deg,
    ${lit(50)} 0.53em,
    ${lit(10)} 0.76em,
    ${shade(22)} 0.86em,
    ${shade(8)} 0.93em,
    ${lit(25)} 1.18em,
    ${shade(12)} 1.27em
  )
`;
/** The glint crosses the subtext more slowly than "timeless": it has further to go. */
const GLISTEN_S = 5;

const entrance = (delayMs: number) => css`
  @media (prefers-reduced-motion: no-preference) {
    animation: ${heroIn} ${DUR.hero}s cubic-bezier(${EASE_OUT.join(', ')}) ${delayMs}ms both;
  }

  @media ${BONSAI_INTRO_QUERY} {
    animation-name: ${heroSettle};
    animation-duration: ${SETTLE_S}s;
    animation-delay: ${INTRO.text + (delayMs / 100) * INTRO.textStep}ms;
  }
`;

/*
 * Phones and short windows: the hero grows to fit its CTAs instead of clipping
 * them, and the scroll cue is hidden. From 768px wide the centred content is
 * about 415px tall and the cue 88px tall, 40px from the bottom, so the cue
 * clears the button by at least 16px from 736px tall.
 */
const COMPACT_HEIGHT = 735;
const COMPACT = `(max-width: 767px), (max-height: ${COMPACT_HEIGHT}px)`;

/*
 * The section is a stage around a pinned layer that holds everything. Where
 * the bonsai plays, it adds a runway (set in CSS, so it is right before
 * hydration): the hero holds still while the tree turns to light with the
 * scroll, then scrolls away as usual. Everywhere else, and for the automatic
 * dissolve (?dissolve=auto) or the still fallback, it is exactly as tall as
 * the layer, so nothing pins.
 */
const HeroWrapper = styled.section`
  position: relative;
  width: 100%;
  background-color: ${({ theme }) => theme.colors.background};

  @media ${BONSAI_INTRO_QUERY} {
    height: ${(1 + DISSOLVE_RUNWAY) * 100}svh;

    &[data-dissolve='auto'],
    &[data-bonsai='still'] {
      height: auto;
    }
  }

  @media ${COMPACT} {
    height: auto;
  }
`;

const Pin = styled.div`
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100svh;
  width: 100%;
  overflow: clip;
  display: flex;
  align-items: center;
  justify-content: center;

  @media ${COMPACT} {
    position: relative;
    height: auto;
    min-height: 100vh;
    min-height: 100svh;
    padding: 104px 0 ${({ theme }) => theme.spacing.xxl};
  }
`;

const noSubscribe = () => () => {};
/**
 * The automatic dissolve, kept by link (?dissolve=auto); the scroll-driven
 * dissolve is the default (owner, 2026-10-29). False on the server and
 * during hydration.
 */
const useAutoDissolve = () =>
  useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get('dissolve') === 'auto',
    () => false
  );

const BackgroundImage = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* Elegant Multi-layered Gradient */
  background:
    /* Subtle vignette with deep green */
    radial-gradient(ellipse at center, transparent 0%, rgba(16, 32, 24, 0.5) 100%),
    /* Primary gold accent - top left */
    radial-gradient(circle at 15% 20%, rgba(200, 159, 129, 0.15) 0%, transparent 40%),
    /* Secondary emerald accent - bottom right */
    radial-gradient(circle at 85% 80%, rgba(93, 117, 102, 0.18) 0%, transparent 40%),
    /* Tertiary gold accent - center right */
    radial-gradient(circle at 90% 40%, rgba(200, 159, 129, 0.08) 0%, transparent 35%),
    /* Ambient depth - subtle overall glow */
    radial-gradient(ellipse at 50% 50%, rgba(93, 117, 102, 0.06) 0%, transparent 60%),
    /* Base gradient for depth with deep greens */
    linear-gradient(180deg, rgba(20, 40, 30, 0.6) 0%, transparent 50%, rgba(16, 32, 24, 0.8) 100%);
  z-index: 1;
`;

/*
 * A soft pool of the page ground behind the text, so the tree never fights
 * the headline. It arrives with the text.
 */
const TextScrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(
    ellipse 46% 34% at 50% 50%,
    ${({ theme }) => `color-mix(in srgb, ${theme.colors.background} 70%, transparent)`},
    transparent
  );

  @media ${BONSAI_INTRO_QUERY} {
    animation: ${fadeIn} ${SETTLE_S}s cubic-bezier(${EASE_OUT.join(', ')}) ${INTRO.text}ms both;
  }
`;

const Content = styled(Container)`
  position: relative;
  z-index: 2;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const PreTitle = styled.span`
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.9rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.gold};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  display: block;
  ${entrance(0)}
`;

const Tagline = styled.h1`
  font-size: 3.5rem;
  line-height: 1.1;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => `calc(${theme.spacing.xl} + ${theme.spacing.md})`};
  max-width: 900px;
  font-weight: 400;
  ${entrance(0)}

  em {
    font-family: ${({ theme }) => theme.fonts.heading};
    font-style: italic;
    color: ${({ theme }) => theme.colors.primary};
  }

  /*
   * The padding gives the halo room (and the italic its overhang); the
   * negative margin takes it back out of the line. The band sits in a gradient
   * 2.4 times the box's width, so moving it from 100% to 0% sweeps it from just
   * before the first letter to just past the last. Ahead of the band the word
   * is flat bronze; behind it the band's layer is clear and the polished
   * bronze beneath shows, so 0% (where it rests) is polished all through.
   */
  @supports (background-clip: text) or (-webkit-background-clip: text) {
    em {
      position: relative;
      display: inline-block;
      padding: 0.5em 0.6em;
      margin: -0.5em -0.6em;
      background:
        linear-gradient(
            100deg,
            transparent 0 41%,
            ${({ theme }) => theme.colors.text} 48% 52%,
            ${({ theme }) => theme.colors.primary} 59% 100%
          )
          0 0 / 240% 100% no-repeat,
        ${polishedBronze};
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* The band's halo, over the letters */
    em::after {
      content: attr(data-glow) / '';
      position: absolute;
      inset: 0;
      padding: inherit;
      white-space: nowrap;
      text-shadow:
        0 0 0.06em ${({ theme }) => theme.colors.text},
        0 0 0.18em ${({ theme }) => theme.colors.primary},
        0 0 0.5em ${({ theme }) => theme.colors.primary};
      mask: linear-gradient(100deg, transparent 0 41%, #000 48% 52%, transparent 59%) 0 0 / 240% 100% no-repeat;
      pointer-events: none;
      user-select: none;
      animation: inherit;
    }

    @media (prefers-reduced-motion: no-preference) {
      em {
        animation: ${glint} ${GLINT_S}s ${GLINT_EASE} 600ms both;
      }
    }

    /* Where the bonsai plays, the glint runs as the headline lands, with the tree's last growth */
    @media ${BONSAI_INTRO_QUERY} {
      em {
        animation-delay: ${Math.round(INTRO.text + INTRO.textSettle * 0.4)}ms;
      }
    }
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    font-size: 5rem;
  }
`;

/*
 * The subtext in bronze capitals, tracked like the header's links (owner,
 * 2026-10-30). All of it arrives at once with the usual entrance; then, as
 * in "timeless", a bone-white glint travels through it from left to right
 * and leaves it polished bronze. The bronze is the text's own fill, clipped
 * to it and repeated once per line; the band is a second layer 3 times the
 * box's width, so it starts clear of the first letter and ends clear of the
 * last on any number of lines. Reduced motion shows the polished bronze at
 * once.
 */
const SubText = styled.p`
  font-size: 1.1rem;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  max-width: 560px;
  line-height: 1.8;
  font-weight: 300;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-wrap: balance;
  ${entrance(100)}

  @supports (background-clip: text) or (-webkit-background-clip: text) {
    background:
      linear-gradient(
          100deg,
          transparent 0 38%,
          ${({ theme }) => theme.colors.text} 45% 47%,
          ${({ theme }) => theme.colors.primary} 54% 100%
        )
        0 0 / 300% 100% no-repeat,
      ${bronzeCaps} 0 0 / 100% 1.8em repeat-y;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;

    @media (prefers-reduced-motion: no-preference) {
      animation:
        ${heroIn} ${DUR.hero}s cubic-bezier(${EASE_OUT.join(', ')}) 100ms both,
        ${glint} ${GLISTEN_S}s ${GLINT_EASE} 700ms both;
    }

    /* Where the bonsai plays, it settles with the headline and catches the light just after "timeless" */
    @media ${BONSAI_INTRO_QUERY} {
      animation-name: ${heroSettle}, ${glint};
      animation-duration: ${SETTLE_S}s, ${GLISTEN_S}s;
      animation-delay:
        ${INTRO.text + INTRO.textStep}ms,
        ${Math.round(INTRO.text + INTRO.textSettle * 0.4) + INTRO.textStep}ms;
    }
  }
`;

const focusRing = css`
  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

const CTA_HEIGHT = 48;

/** The hero's centred content, with the button lowered, in px (measured; the same at every desktop width). */
const CONTENT_HEIGHT = 462;

const treeHeight = `min(${TREE.share * 100}svh, ${TREE.max}px)`;

/**
 * Where the button's middle rests, as a fraction of the tree's height: above
 * the pot's rim, over the trunk, so it sits closer to the subtext (owner,
 * 2026-10-30).
 */
const CTA_REST = BONSAI_SOURCE.rim - 0.075;

/*
 * One action, "Plant your project" (owner, 2026-10-30: "See the work" and
 * the price line left the hero), as a line of text on a bronze hairline,
 * centred under the subtext. A box would show that the pot sits left of the
 * page's centre; a hairline doesn't.
 *
 * Where the tree is drawn behind it and the hero isn't compact, it rests above
 * the pot's rim: it leaves the content's flow by a button's height (so
 * the text sits as if it were still there) and moves down to
 * CTA_REST. That is its place in the tree (centred TREE.centre down the
 * layer) less the button's place in the centred content (half the content
 * less half the button below the layer's middle). The tree is a share of the
 * pinned layer's height, as in BonsaiCanvas, so the move follows the window.
 * The still fallback frames the whole photo, so it keeps the button in the
 * flow under the text, as do phones and short windows.
 */
const CtaRow = styled.div`
  display: flex;
  ${entrance(200)}

  @media ${BONSAI_INTRO_QUERY} and (min-height: ${COMPACT_HEIGHT + 1}px) {
    ${HeroWrapper}:not([data-bonsai='still']) & {
      margin-top: ${CTA_HEIGHT}px;
      translate: 0
        calc(
          ${(TREE.centre - 0.5).toFixed(2)} * 100svh + ${(CTA_REST - 0.5).toFixed(3)} * ${treeHeight} -
            ${(CONTENT_HEIGHT - CTA_HEIGHT) / 2}px
        );
    }
  }
`;

const PrimaryCta = styled.a`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: ${CTA_HEIGHT}px;
  /* Letter-spacing trails the last letter, so the right padding gives it back and the label sits centred */
  padding: 0 ${({ theme }) => `calc(${theme.spacing.lg} - 0.15em) 0 ${theme.spacing.lg}`};
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text};
  transition: color ${DUR.hover}s cubic-bezier(${EASE_OUT.join(', ')});

  /* The hairline it rests on, fading out at both ends; it reaches a little wider on hover */
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 8px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(200, 159, 129, 0.6) 25% 75%, transparent);
    pointer-events: none;
    transition: transform ${DUR.state}s cubic-bezier(${EASE_OUT.join(', ')});
  }

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }

  &:hover::after {
    transform: scaleX(1.2);
  }

  ${focusRing}
`;

const ScrollIndicator = styled.div`
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0.5;

  /* Opacity only, so the centering transform is left alone */
  @media (prefers-reduced-motion: no-preference) {
    animation: ${fadeIn} ${DUR.hero}s cubic-bezier(${EASE_OUT.join(', ')}) 400ms both;
  }

  /* Where the bonsai plays, its glowing taproot leads the eye down instead */
  @media ${BONSAI_INTRO_QUERY} {
    display: none;
  }

  /* Where the hero is compact the cue would sit on the button */
  @media ${COMPACT} {
    display: none;
  }
`;

const Line = styled.div`
  width: 1px;
  height: 60px;
  background: ${({ theme }) => theme.colors.textSecondary};
`;

export default function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);
  const reduce = useReducedMotionSafe();
  const intro = useMediaQuery(BONSAI_INTRO_QUERY);
  const [fallback, setFallback] = useState(false);
  const showStill = useCallback(() => setFallback(true), []);
  const auto = useAutoDissolve();
  const pinRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  // The backdrop drifts and fades only as the hero leaves. While the hero is
  // held on its runway it stays put; moving it there would slide it off the
  // top and uncover the bare ground under the header.
  const leaving = useMotionValue(0);
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const hero = ref.current;
    const pin = pinRef.current;
    if (!hero || !pin) return;
    const total = hero.offsetHeight;
    const runway = Math.max(0, total - pin.offsetHeight);
    leaving.set(Math.min(1, Math.max(0, (p * total - runway) / (total - runway || 1))));
  });
  const y = useTransform(leaving, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(leaving, [0, 0.5], [1, 0]);

  return (
    <HeroWrapper
      id="hero"
      ref={ref}
      data-bonsai={fallback ? 'still' : undefined}
      data-dissolve={auto ? 'auto' : undefined}
    >
      <Pin ref={pinRef}>
        <BackgroundImage style={{ y: reduce ? 0 : y, opacity: reduce ? 1 : opacity }} />
        <BonsaiStill imgRef={stillRef} />
        {intro && !fallback && (
          <BonsaiCanvas
            heroRef={ref}
            imageRef={stillRef}
            clockRef={headlineRef}
            dissolveOnScroll={!auto}
            onFallback={showStill}
          />
        )}
        <TextScrim />

        <Content>
          <PreTitle>Est. 2022</PreTitle>

          <Tagline ref={headlineRef}>
            Crafting <em data-glow="timeless">timeless</em> digital legacies.
          </Tagline>

          <SubText>
            We craft tailored web experiences for brands that refuse to compromise on elegance.
          </SubText>

          <CtaRow>
            <PrimaryCta href="#contact">Plant your project</PrimaryCta>
          </CtaRow>
        </Content>

        <ScrollIndicator>
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.1em' }}>SCROLL</span>
          <Line />
        </ScrollIndicator>
      </Pin>
    </HeroWrapper>
  );
}

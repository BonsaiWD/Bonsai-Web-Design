'use client';

import styled, { css, keyframes } from 'styled-components';
import { motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { Container } from '../layout/Container';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useMediaQuery, useReducedMotionSafe } from '@/lib/useMediaQuery';
import { DUR, EASE_OUT, RISE } from '@/lib/motion';
import { frostedGlass } from '@/styles/frosted';
import BonsaiCanvas from './bonsai/BonsaiCanvas';
import BonsaiStill from './bonsai/BonsaiStill';
import { BONSAI_INTRO_QUERY, DISSOLVE_RUNWAY, INTRO } from './bonsai/timeline';

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
 * from left to right, like the light through the tree, and leaves a soft
 * glow behind the solid bronze letters, with a bevel (light on their upper
 * edges, shade under the lower) so they stand out from it (owner, the same
 * day). The glint is the word's own fill, a gradient clipped to the text; the
 * halo is a copy of the word drawn only as its text-shadow, masked to the
 * same band, and the glow and bevel it leaves are another copy beneath the
 * letters, so they never veil them. All three share one box, so they move
 * together. The glowing word is the resting state, so reduced motion shows
 * it too, without the sweep.
 */
const glint = keyframes`
  from { background-position: 100% 0; mask-position: 100% 0; }
  to { background-position: 0 0; mask-position: 0 0; }
`;
const GLINT_S = 3.6;
const GLINT_EASE = 'cubic-bezier(0.37, 0, 0.63, 1)';

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
 * about 444px tall and the cue 88px tall, 40px from the bottom, so the cue
 * clears the price line by at least 16px from 736px tall.
 */
const COMPACT = '(max-width: 767px), (max-height: 735px)';

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
  margin-bottom: ${({ theme }) => theme.spacing.xl};
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
   * before the first letter to just past the last. Everything left of the band
   * keeps the glow, so 0% (where it rests) glows all through.
   */
  @supports (background-clip: text) or (-webkit-background-clip: text) {
    em {
      position: relative;
      display: inline-block;
      padding: 0.5em 0.6em;
      margin: -0.5em -0.6em;
      background: linear-gradient(
          100deg,
          ${({ theme }) => theme.colors.primary} 0 41%,
          ${({ theme }) => theme.colors.text} 48% 52%,
          ${({ theme }) => theme.colors.primary} 59% 100%
        )
        0 0 / 240% 100% no-repeat;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    em::before,
    em::after {
      content: attr(data-glow) / '';
      position: absolute;
      inset: 0;
      padding: inherit;
      white-space: nowrap;
      pointer-events: none;
      user-select: none;
      animation: inherit;
    }

    /* What the band leaves, beneath the letters: bevel (seen only at their edges), then glow */
    em::before {
      z-index: -1;
      text-shadow:
        -0.012em -0.016em 0 ${({ theme }) => `color-mix(in srgb, ${theme.colors.text} 55%, transparent)`},
        0.016em 0.024em 0 ${({ theme }) => `color-mix(in srgb, ${theme.colors.background} 90%, transparent)`},
        0 0 0.18em ${({ theme }) => `color-mix(in srgb, ${theme.colors.primary} 50%, transparent)`},
        0 0 0.5em ${({ theme }) => `color-mix(in srgb, ${theme.colors.primary} 50%, transparent)`};
      mask: linear-gradient(100deg, #000 0 44%, transparent 52%) 0 0 / 240% 100% no-repeat;
    }

    /* The band's halo, over the letters */
    em::after {
      text-shadow:
        0 0 0.06em ${({ theme }) => theme.colors.text},
        0 0 0.18em ${({ theme }) => theme.colors.primary},
        0 0 0.5em ${({ theme }) => theme.colors.primary};
      mask: linear-gradient(100deg, transparent 0 41%, #000 48% 52%, transparent 59%) 0 0 / 240% 100% no-repeat;
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

const SubText = styled.p`
  font-size: 1.1rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  max-width: 500px;
  line-height: 1.8;
  font-weight: 300;
  ${entrance(100)}
`;

const focusRing = css`
  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  ${entrance(200)}

  @media (max-width: 767px) {
    column-gap: ${({ theme }) => theme.spacing.lg};
  }
`;

const PrimaryCta = styled.a`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 ${({ theme }) => theme.spacing.xl};
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border-radius: 0;
  ${frostedGlass}

  @media (max-width: 767px) {
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }

  /* Bronze hover halo (0.15), faded in on opacity rather than box-shadow */
  &::after {
    content: '';
    position: absolute;
    inset: -4px;
    border: 4px solid rgba(200, 159, 129, 0.15);
    opacity: 0;
    pointer-events: none;
    transition: opacity ${DUR.hover}s cubic-bezier(${EASE_OUT.join(', ')});
  }

  &:hover::after {
    opacity: 1;
  }

  ${focusRing}
`;

const SecondaryCta = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.85rem;
  font-weight: 400;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text};
  text-decoration: underline;
  text-decoration-color: ${({ theme }) => theme.colors.primary};
  text-decoration-thickness: 1px;
  text-underline-offset: 6px;
  transition: color ${DUR.hover}s cubic-bezier(${EASE_OUT.join(', ')});

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }

  ${focusRing}
`;

const PriceLine = styled.p`
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.85rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: ${({ theme }) => theme.spacing.lg} 0 0;
  ${entrance(300)}
`;

const PriceClause = styled.span`
  @media (max-width: 767px) {
    display: block;
  }
`;

const PriceSeparator = styled.span`
  color: ${({ theme }) => theme.colors.primary};

  /* On phones the two clauses stack, so the dot is not needed */
  @media (max-width: 767px) {
    display: none;
  }
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

  /* Where the hero is compact the cue would sit on the price line */
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
            <PrimaryCta href="#contact">Plant a project</PrimaryCta>
            <SecondaryCta href="#portfolio">See the work</SecondaryCta>
          </CtaRow>

          <PriceLine>
            <PriceClause>Custom sites from $1500 per page</PriceClause>{' '}
            <PriceSeparator>·</PriceSeparator>{' '}
            <PriceClause>Updates and care at $120/hr</PriceClause>
          </PriceLine>
        </Content>

        <ScrollIndicator>
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.1em' }}>SCROLL</span>
          <Line />
        </ScrollIndicator>
      </Pin>
    </HeroWrapper>
  );
}

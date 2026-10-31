'use client';

import styled, { css, keyframes, type DefaultTheme } from 'styled-components';
import { motion, useInView, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { Container } from '../layout/Container';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type AnimationEvent } from 'react';
import { useMediaQuery, useReducedMotionSafe } from '@/lib/useMediaQuery';
import { DUR, EASE_OUT, RISE } from '@/lib/motion';
import BonsaiCanvas from './bonsai/BonsaiCanvas';
import BonsaiStill from './bonsai/BonsaiStill';
import { BONSAI_INTRO_QUERY, DISSOLVE_RUNWAY, INTRO } from './bonsai/timeline';

/*
 * The hero entrance runs on CSS keyframes, not framer initial/animate, so the
 * headline and CTA are in the server HTML and appear without waiting for
 * hydration. Supporting elements follow in 100ms steps.
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
 * Each of the headline's statements catches the light as it lands (owner's
 * request, 2026-10-30, first made for "timeless"): a bone-white glint with a
 * bronze halo travels through the words from left to right, like the light
 * through the tree, and leaves them polished bronze. The glint and the polish
 * are the words' own fill, gradients clipped to the text; the halo is a copy
 * of the words drawn only as their text-shadow, masked to the same band. They
 * share one box, so they move together. The polished words are the resting
 * state, so reduced motion shows them too, without the sweep.
 */
const glint = keyframes`
  from { background-position: 100% 0; mask-position: 100% 0; }
  to { background-position: 0 0; mask-position: 0 0; }
`;
const GLINT_S = 3.6;
const GLINT_EASE = 'cubic-bezier(0.37, 0, 0.63, 1)';

/** Bronze lit toward bone, as polished metal reflects the light. */
const lit = (pct: number) => ({ theme }: { theme: DefaultTheme }) =>
  `color-mix(in srgb, ${theme.colors.primary}, ${theme.colors.text} ${pct}%)`;

/*
 * Polished bronze for the statements' capitals, lit from above, with a little
 * glisten at rest (owner, 2026-10-30): close to bone on the tops of the
 * capitals and again near the baseline, falling quickly to a band between
 * whose darkest stop is plain bronze. The stops are in em down the box (0.5em
 * padding, then a 1.1 line): in Jost the capitals run from 0.7em to the
 * baseline at 1.4em.
 */
const bronzeCaps = css`
  linear-gradient(
    180deg,
    ${lit(80)} 0.7em,
    ${lit(45)} 0.87em,
    ${lit(5)} 1.01em,
    ${lit(25)} 1.07em,
    ${lit(65)} 1.3em,
    ${lit(20)} 1.41em
  )
`;

/*
 * The first statement catches the light after the headline's quick entrance
 * or, where the bonsai plays, as the headline lands; each one after it a
 * moment after it starts to fade in.
 */
const GLINT_AT = { quick: 600, intro: Math.round(INTRO.text + INTRO.textSettle * 0.4), next: 300 };

/*
 * What the websites do, completing "Bespoke websites…" (owner, 2026-10-30),
 * each led by "that" on the headline's second line, where they take turns in
 * a loop (the owner's choice), which waits while the pointer rests on the headline or the
 * hero is out of view, and stops with the pause button (WCAG 2.2.2). Reduced
 * motion keeps the first.
 */
const STATEMENTS = [
  'make a lasting impression',
  'turn visitors into clients',
  'set you apart',
  'earn trust at first glance',
  'look sharp and load fast',
  'grow with your business',
] as const;
/** For screen readers and search, the whole sentence at once. */
const SPOKEN = `that ${STATEMENTS.slice(0, -1).join(', ')}, and ${STATEMENTS[STATEMENTS.length - 1]}.`;
/** In ms: how long a statement rests, polished, after its glint, and how long two take to cross. */
const ROTATE = { hold: 2400, cross: 1200 };

const glintBand = css`
  linear-gradient(
      100deg,
      transparent 0 41%,
      ${({ theme }) => theme.colors.text} 48% 52%,
      ${({ theme }) => theme.colors.primary} 59% 100%
    )
    0 0 / 240% 100% no-repeat
`;

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
 * about 265px tall and the cue 88px tall, 40px from the bottom, so the cue
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

/*
 * Capitals tracked like the BONSAI wordmark, in Italiana, lighter and with
 * subtler serifs than its Playfair (owner, 2026-10-30), over the statements
 * in Jost capitals. At half its size and tracked 0.1em, even the longest
 * statement stays within its width (owner, 2026-10-30).
 */
const Tagline = styled.h1`
  font-family: ${({ theme }) => theme.fonts.display};
  /* On phones as large as one line allows: it runs about 9.7 times its size */
  font-size: min(2.25rem, calc((100vw - 2 * ${({ theme }) => theme.spacing.md}) / 10));
  line-height: 1.1;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => `calc(${theme.spacing.xl} + ${theme.spacing.md})`};
  max-width: 900px;
  font-weight: 400;
  text-wrap: balance;
  ${entrance(0)}

  em {
    font-family: ${({ theme }) => theme.fonts.caps};
    font-size: 0.5em;
    font-style: normal;
    /* Lighter, near the header's 300 but not as faint (owner, 2026-10-30) */
    font-weight: 350;
    letter-spacing: 0.1em;
    color: ${({ theme }) => theme.colors.primary};
  }

  /*
   * The padding gives the halo room; the negative margin takes it back out of
   * the line, and the extra on the left balances the tracking after the last
   * letter, so the words sit centred. The band sits in a gradient
   * 2.4 times the box's width, so moving it from 100% to 0% sweeps it from just
   * before the first letter to just past the last. Ahead of the band the word
   * is flat bronze; behind it the band's layer is clear and the polished
   * bronze beneath shows, so 0% (where it rests) is polished all through.
   */
  @supports (background-clip: text) or (-webkit-background-clip: text) {
    em {
      position: relative;
      display: inline-block;
      padding: 0.5em 0.6em 0.5em 0.7em;
      margin: -0.5em -0.6em;
      background:
        ${glintBand},
        ${bronzeCaps};
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* The band's halo, over the letters, wrapping as they do on phones */
    em::after {
      content: attr(data-glow) / '';
      position: absolute;
      inset: 0;
      padding: inherit;
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
      em[data-active] {
        animation: ${glint} ${GLINT_S}s ${GLINT_EASE} ${GLINT_AT.quick}ms both;
      }
    }

    /* Where the bonsai plays, the first glint runs as the headline lands, with the tree's last growth */
    @media ${BONSAI_INTRO_QUERY} {
      em[data-active] {
        animation-delay: ${GLINT_AT.intro}ms;
      }
    }

    /* The statements after it glint as they arrive */
    em[data-active][data-next] {
      animation-delay: ${GLINT_AT.next}ms;
    }
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    font-size: 3.75rem;
  }
`;

/*
 * The statements share one place on the headline's second line, so the
 * headline is as big as the longest and nothing moves as they turn. The one
 * leaving fades as the next arrives, slowly, on an even curve.
 */
const Statements = styled.span`
  display: grid;
  place-items: center;
  margin-top: 0.35em;

  em {
    grid-area: 1 / 1;
    text-wrap: balance;
    opacity: 0;
    transform: translateY(0.12em);
    filter: blur(2px);
    transition:
      opacity ${ROTATE.cross}ms ${GLINT_EASE},
      transform ${ROTATE.cross}ms ${GLINT_EASE},
      filter ${ROTATE.cross}ms ${GLINT_EASE};
  }

  em[data-active] {
    opacity: 1;
    transform: none;
    filter: none;
  }
`;

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

const focusRing = css`
  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

const CTA_HEIGHT = 48;

/*
 * One action (owner, 2026-10-30: "See the work" and the price line left the
 * hero), "Let's plant your next project", as a line of text on a bronze
 * hairline, centred right under the headline (owner, the same day; it had
 * rested over the trunk). A box would show that the pot sits left of the
 * page's centre; a hairline doesn't.
 */
const CtaRow = styled.div`
  display: flex;
  ${entrance(200)}
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

/*
 * The statements loop, so they can be stopped (WCAG 2.2.2): a quiet control
 * in the hero's corner that arrives after the text. Without motion there is
 * nothing to stop.
 */
const PauseButton = styled.button`
  position: absolute;
  right: ${({ theme }) => theme.spacing.md};
  bottom: ${({ theme }) => theme.spacing.md};
  z-index: 2;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.75;
  transition: opacity ${DUR.hover}s cubic-bezier(${EASE_OUT.join(', ')});

  &:hover {
    opacity: 1;
  }

  ${focusRing}

  @media (prefers-reduced-motion: no-preference) {
    animation: ${fadeIn} ${DUR.hero}s cubic-bezier(${EASE_OUT.join(', ')}) 400ms both;
  }

  @media ${BONSAI_INTRO_QUERY} {
    animation-duration: ${SETTLE_S}s;
    animation-delay: ${INTRO.text + 3 * INTRO.textStep}ms;
  }

  @media (prefers-reduced-motion: reduce) {
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

  // The statements turn once the one showing has caught the light and rested.
  const [statement, setStatement] = useState(0);
  const [turned, setTurned] = useState(false);
  const [glinted, setGlinted] = useState(false);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const inView = useInView(ref);
  useEffect(() => {
    if (!glinted || held || paused || !inView) return;
    const timer = window.setTimeout(() => {
      setStatement((i) => (i + 1) % STATEMENTS.length);
      setTurned(true);
      setGlinted(false);
    }, ROTATE.hold);
    return () => window.clearTimeout(timer);
  }, [glinted, held, paused, inView]);
  const onGlintEnd = (e: AnimationEvent<HTMLElement>) => {
    if (e.target === e.currentTarget && !e.pseudoElement && e.animationName === glint.getName()) setGlinted(true);
  };

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

          <Tagline
            ref={headlineRef}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)}
            onPointerLeave={() => setHeld(false)}
          >
            Bespoke websites <VisuallyHidden>{SPOKEN}</VisuallyHidden>
            <Statements aria-hidden="true">
              {STATEMENTS.map((words, i) => (
                <em
                  key={words}
                  data-glow={`that ${words}`}
                  data-active={i === statement ? '' : undefined}
                  data-next={i === statement && turned ? '' : undefined}
                  onAnimationEnd={onGlintEnd}
                >
                  that {words}
                </em>
              ))}
            </Statements>
          </Tagline>

          <CtaRow>
            <PrimaryCta href="#contact">Let’s plant your next project</PrimaryCta>
          </CtaRow>
        </Content>

        <PauseButton
          type="button"
          aria-label={paused ? 'Play the headline' : 'Pause the headline'}
          onClick={() => setPaused((p) => !p)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="currentColor">
            {paused ? (
              <path d="M2.5 1 10.5 6 2.5 11Z" />
            ) : (
              <>
                <rect x="2" y="1" width="2" height="10" />
                <rect x="8" y="1" width="2" height="10" />
              </>
            )}
          </svg>
        </PauseButton>

        <ScrollIndicator>
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.1em' }}>SCROLL</span>
          <Line />
        </ScrollIndicator>
      </Pin>
    </HeroWrapper>
  );
}

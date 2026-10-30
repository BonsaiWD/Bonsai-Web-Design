'use client';

import styled, { css, keyframes } from 'styled-components';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Container } from '../layout/Container';
import { useRef } from 'react';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';
import { DUR, EASE_OUT, RISE } from '@/lib/motion';
import ReimagineStage from './ReimagineStage';

/*
 * The hero entrance runs on CSS keyframes, not framer initial/animate, so the
 * headline, subtext and CTAs are visible in the server HTML before hydration.
 * The H1 is never delayed; supporting elements follow in 100ms steps.
 */
const heroIn = keyframes`
  from { opacity: 0; transform: translateY(${RISE.item}px); }
  to { opacity: 1; transform: none; }
`;

const entrance = (delayMs: number) => css`
  @media (prefers-reduced-motion: no-preference) {
    animation: ${heroIn} ${DUR.hero}s cubic-bezier(${EASE_OUT.join(', ')}) ${delayMs}ms both;
  }
`;

/*
 * The hero runs past the first screen: the copy sits near the top and the
 * before-and-after frame rises from the bottom edge, which also does the old
 * scroll cue's job of inviting the reader down.
 */
const COMPACT = '(max-width: 767px), (max-height: 735px)';

const HeroWrapper = styled.section`
  min-height: 100vh;
  min-height: 100svh;
  width: 100%;
  position: relative;
  overflow: clip;
  padding: clamp(112px, 15svh, 168px) 0 ${({ theme }) => theme.spacing.xxxl};
  background-color: ${({ theme }) => theme.colors.background};

  @media ${COMPACT} {
    padding: 104px 0 ${({ theme }) => theme.spacing.xxl};
  }
`;

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

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    font-size: 5rem;
  }
`;

// Bone at 75% reads crisper on the dark ground than the sage grey, and still sits behind the headline
const SubText = styled.p`
  font-size: 1.2rem;
  color: ${({ theme }) => `color-mix(in srgb, ${theme.colors.text} 75%, transparent)`};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  max-width: 540px;
  line-height: 1.6;
  font-weight: 400;
  letter-spacing: 0.005em;
  text-wrap: balance;
  ${entrance(100)}

  @media (max-width: 767px) {
    font-size: 1.1rem;
  }
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
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.background};
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border-radius: 0;
  /* Override GlobalStyle's a { transition: all }; only the halo below fades */
  transition: none;

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

export default function HeroSection() {
  const ref = useRef(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <HeroWrapper id="hero" ref={ref}>
      <BackgroundImage style={{ y: reduce ? 0 : y, opacity: reduce ? 1 : opacity }} />

      <Content>
        <PreTitle>Est. 2022</PreTitle>

        <Tagline>
          Crafting <em>timeless</em> digital legacies.
        </Tagline>

        <SubText>
          We craft tailored web experiences for brands that refuse to compromise on elegance.
        </SubText>

        <CtaRow>
          <PrimaryCta href="#contact">Start a project</PrimaryCta>
          <SecondaryCta href="#portfolio">See the work</SecondaryCta>
        </CtaRow>

        <PriceLine>
          <PriceClause>Custom sites from $1500 per page</PriceClause>{' '}
          <PriceSeparator>·</PriceSeparator>{' '}
          <PriceClause>Updates and care at $120/hr</PriceClause>
        </PriceLine>

        <ReimagineStage />
      </Content>
    </HeroWrapper>
  );
}

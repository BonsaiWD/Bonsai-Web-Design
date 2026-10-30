'use client';

import styled, { keyframes } from 'styled-components';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import Enso from '../common/Enso';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';
import { DUR, EASE_OUT, EASE_REVEAL } from '@/lib/motion';

/*
 * Hero set piece: a framed concept site shown "as it is" and "reimagined".
 * The wipe plays once when the frame is mostly in view, then the switch
 * flips between the two. Both mock sites are drawn in HTML and sized in
 * container units, so they scale like a screenshot at every width.
 */

type Mode = 'before' | 'after';

// 10% slower than the standard mask reveal, so the transformation reads as a moment
const WIPE_DURATION = DUR.mask * 1.1;

const fadeIn = keyframes`
  from { opacity: 0; }
`;

const Stage = styled(motion.figure)`
  width: 100%;
  max-width: 1080px;
  margin: ${({ theme }) => theme.spacing.xl} auto 0;
  text-align: left;
  transform-origin: 50% 100%;
`;

// Opacity only: the stage's scroll scale owns the transform
const StageInner = styled.div`
  @media (prefers-reduced-motion: no-preference) {
    animation: ${fadeIn} ${DUR.hero}s cubic-bezier(${EASE_OUT.join(', ')}) 400ms both;
  }
`;

/* ---------- Switch ---------- */

const Switch = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const SwitchLabel = styled.span`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-style: italic;
  font-size: 1.1rem;
  color: ${({ theme }) => theme.colors.text};
  margin-right: ${({ theme }) => theme.spacing.sm};

  @media (max-width: 480px) {
    display: none;
  }
`;

const SwitchButton = styled.button<{ $active: boolean }>`
  min-height: 44px;
  padding: 0 ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
  background: none;
  border: 0;
  cursor: pointer;
  transition: color ${DUR.hover}s cubic-bezier(${EASE_OUT.join(', ')});

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

const TRACK = 72;
const DOT = 8;

const Track = styled.span`
  position: relative;
  flex: none;
  width: ${TRACK}px;
  height: 1px;
  background: rgba(200, 159, 129, 0.4);
`;

const TrackDot = styled.span<{ $after: boolean }>`
  position: absolute;
  top: -${(DOT - 1) / 2}px;
  left: 0;
  width: ${DOT}px;
  height: ${DOT}px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  box-shadow: 0 0 10px rgba(200, 159, 129, 0.7);
  transform: translateX(${({ $after }) => ($after ? TRACK - DOT : 0)}px);
  transition: transform ${DUR.state}s cubic-bezier(${EASE_OUT.join(', ')});

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/* ---------- Frame ---------- */

const Frame = styled.div`
  position: relative;
  border: 1px solid rgba(200, 159, 129, 0.18);
  border-radius: 28px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};

  @media (max-width: 768px) {
    border-radius: 20px;
  }
`;

const Chrome = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 10px 20px;
  border-bottom: 1px solid rgba(200, 159, 129, 0.14);
`;

const ConceptTag = styled.span`
  font-size: 0.66rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
`;

const Url = styled.span`
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const Screen = styled.div`
  position: relative;
  aspect-ratio: 16 / 10;
  container-type: inline-size;
  overflow: hidden;

  @media (max-width: 600px) {
    aspect-ratio: 4 / 3;
  }
`;

const Layer = styled(motion.div)`
  position: absolute;
  inset: 0;
`;

// The bronze hairline that rides the wipe's leading edge
const Edge = styled(motion.div)`
  position: absolute;
  inset: 0;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 1px;
    background: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 12px rgba(200, 159, 129, 0.6);
  }
`;

const Caption = styled.figcaption`
  margin-top: ${({ theme }) => theme.spacing.md};
  text-align: center;
  font-size: 0.8rem;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

/* ---------- "As it is": a generic template (sizes in cqw, as a share of the frame width) ---------- */

const B = {
  Site: styled.div`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.text};
    color: ${({ theme }) => theme.colors.background};
    font-family: ${({ theme }) => theme.fonts.main};
    font-size: 1.3cqw;
    line-height: 1.4;
  `,
  Top: styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.4cqw 3cqw;
    background: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.text};
  `,
  Logo: styled.span`
    font-weight: 700;
    font-size: 1.7cqw;
    letter-spacing: 0.02em;
  `,
  Phone: styled.span`
    font-size: 1.15cqw;
  `,
  Nav: styled.div`
    display: flex;
    justify-content: center;
    gap: 1.2cqw;
    padding: 1.1cqw 0;
    border-bottom: 0.2cqw solid ${({ theme }) => theme.colors.textSecondary};
    font-size: 1.2cqw;
    text-decoration: underline;
  `,
  Pipe: styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
    text-decoration: none;
  `,
  Banner: styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.2cqw;
    margin: 2cqw 3cqw;
    background: ${({ theme }) => theme.colors.textSecondary};
    color: ${({ theme }) => theme.colors.text};
    text-align: center;
  `,
  Title: styled.span`
    font-weight: 700;
    font-size: 3.4cqw;
  `,
  Sub: styled.span`
    font-size: 1.5cqw;
  `,
  Button: styled.span`
    margin-top: 0.6cqw;
    padding: 0.9cqw 2.6cqw;
    border-radius: 3cqw;
    background: ${({ theme }) => theme.colors.accent};
    font-weight: 700;
    font-size: 1.2cqw;
    letter-spacing: 0.06em;
  `,
  Dots: styled.span`
    display: flex;
    gap: 0.6cqw;

    i {
      width: 0.8cqw;
      height: 0.8cqw;
      border-radius: 50%;
      background: ${({ theme }) => theme.colors.text};
      opacity: 0.6;
    }
  `,
  Cards: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2cqw;
    padding: 0 3cqw 2.4cqw;
  `,
  Card: styled.div`
    padding: 1.4cqw;
    border: 0.15cqw solid ${({ theme }) => theme.colors.textSecondary};
    text-align: center;

    b {
      display: block;
      font-size: 1.5cqw;
      margin-bottom: 0.4cqw;
    }

    u {
      display: block;
      margin-top: 0.6cqw;
      color: ${({ theme }) => theme.colors.accent};
    }
  `,
};

function BeforeSite() {
  return (
    <B.Site>
      <B.Top>
        <B.Logo>HARBOR LANE COFFEE</B.Logo>
        <B.Phone>Call us today: (555) 014-2290</B.Phone>
      </B.Top>
      <B.Nav>
        <span>Home</span><B.Pipe>|</B.Pipe><span>About Us</span><B.Pipe>|</B.Pipe>
        <span>Our Menu</span><B.Pipe>|</B.Pipe><span>Gallery</span><B.Pipe>|</B.Pipe><span>Contact Us</span>
      </B.Nav>
      <B.Banner>
        <B.Title>Welcome to Harbor Lane Coffee</B.Title>
        <B.Sub>Quality coffee and friendly service since 2009</B.Sub>
        <B.Button>CLICK HERE</B.Button>
        <B.Dots><i /><i /><i /></B.Dots>
      </B.Banner>
      <B.Cards>
        <B.Card><b>Our Coffee</b>Learn more about our coffee.<u>Read more »</u></B.Card>
        <B.Card><b>Our Story</b>Learn more about our story.<u>Read more »</u></B.Card>
        <B.Card><b>Visit Us</b>Learn more about visiting us.<u>Read more »</u></B.Card>
      </B.Cards>
    </B.Site>
  );
}

/* ---------- "Reimagined": the same café in Bonsai's editorial style ---------- */

const A = {
  Site: styled.div`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: 2.6cqw 5cqw 2.2cqw;
    background:
      radial-gradient(circle at 78% 42%, rgba(200, 159, 129, 0.08), transparent 45%),
      ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.main};
    font-size: 1.2cqw;
    overflow: hidden;
  `,
  Top: styled.div`
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  `,
  Wordmark: styled.span`
    font-family: ${({ theme }) => theme.fonts.heading};
    font-size: 1.7cqw;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  `,
  Nav: styled.span`
    display: flex;
    gap: 2.4cqw;
    font-size: 0.95cqw;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,
  Main: styled.div`
    flex: 1;
    display: grid;
    grid-template-columns: 6fr 5fr;
    gap: 5cqw;
    align-items: center;
  `,
  Eyebrow: styled.span`
    display: block;
    font-size: 0.95cqw;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.primary};
    margin-bottom: 1.8cqw;
  `,
  Title: styled.span`
    display: block;
    font-family: ${({ theme }) => theme.fonts.heading};
    font-size: 6cqw;
    line-height: 1.05;
    margin-bottom: 1.8cqw;

    em {
      font-style: italic;
      color: ${({ theme }) => theme.colors.primary};
    }
  `,
  Sub: styled.span`
    display: block;
    max-width: 34cqw;
    font-size: 1.35cqw;
    line-height: 1.7;
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-bottom: 2.4cqw;
  `,
  Ctas: styled.span`
    display: flex;
    align-items: center;
    gap: 2.4cqw;
    font-size: 0.95cqw;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  `,
  Cta: styled.span`
    padding: 1.2cqw 2.2cqw;
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.background};
    font-weight: 600;
  `,
  Link: styled.span`
    text-decoration: underline;
    text-decoration-color: ${({ theme }) => theme.colors.primary};
    text-underline-offset: 0.5cqw;
  `,
  Roasts: styled.div`
    position: relative;
  `,
  RoastEnso: styled(Enso)`
    position: absolute;
    width: 30cqw;
    height: 30cqw;
    right: -6cqw;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.14;
  `,
  RoastHead: styled.span`
    display: block;
    font-size: 0.95cqw;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.textSecondary};
    padding-bottom: 1cqw;
    border-bottom: 1px solid rgba(200, 159, 129, 0.4);
  `,
  Row: styled.span`
    position: relative;
    display: grid;
    grid-template-columns: 3.4cqw 1fr;
    align-items: baseline;
    padding: 1.4cqw 0;
    border-bottom: 1px solid rgba(200, 159, 129, 0.14);

    b {
      font-family: ${({ theme }) => theme.fonts.heading};
      font-weight: 400;
      font-size: 1.1cqw;
      color: ${({ theme }) => theme.colors.primary};
      font-variant-numeric: lining-nums tabular-nums;
    }

    strong {
      display: block;
      font-family: ${({ theme }) => theme.fonts.heading};
      font-weight: 400;
      font-size: 1.9cqw;
    }

    small {
      display: block;
      margin-top: 0.3cqw;
      font-size: 1.05cqw;
      color: ${({ theme }) => theme.colors.textSecondary};
    }
  `,
  Foot: styled.div`
    display: flex;
    justify-content: space-between;
    padding-top: 1.4cqw;
    border-top: 1px solid rgba(200, 159, 129, 0.14);
    font-size: 0.95cqw;
    letter-spacing: 0.08em;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,
};

const ROASTS = [
  { name: 'Ethiopia Guji', notes: 'Jasmine, ripe peach' },
  { name: 'Colombia Huila', notes: 'Cocoa, red apple' },
  { name: 'House Espresso', notes: 'Caramel, dense and round' },
];

function AfterSite() {
  return (
    <A.Site>
      <A.Top>
        <A.Wordmark>Harbor Lane</A.Wordmark>
        <A.Nav><span>Menu</span><span>Roastery</span><span>Visit</span></A.Nav>
      </A.Top>
      <A.Main>
        <span>
          <A.Eyebrow>Small-batch roastery · Since 2009</A.Eyebrow>
          <A.Title>Coffee, roasted <em>slowly</em>.</A.Title>
          <A.Sub>Beans from three farms we know by name, roasted every Thursday on Harbor Lane.</A.Sub>
          <A.Ctas>
            <A.Cta>Visit the roastery</A.Cta>
            <A.Link>See the menu</A.Link>
          </A.Ctas>
        </span>
        <A.Roasts>
          <A.RoastEnso rotate={-20} />
          <A.RoastHead>This week&apos;s roasts</A.RoastHead>
          {ROASTS.map((r, i) => (
            <A.Row key={r.name}>
              <b>{String(i + 1).padStart(2, '0')}</b>
              <span>
                <strong>{r.name}</strong>
                <small>{r.notes}</small>
              </span>
            </A.Row>
          ))}
        </A.Roasts>
      </A.Main>
      <A.Foot>
        <span>Open daily, 7 to 3</span>
        <span>14 Harbor Lane</span>
      </A.Foot>
    </A.Site>
  );
}

/* ---------- Stage ---------- */

export default function ReimagineStage() {
  const [mode, setMode] = useState<Mode>('before');
  const touched = useRef(false);
  const stageRef = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();

  // The frame settles to full size as it rises into view; progress 0 is its resting state
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'start 35%'] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);

  // Play the transformation once, the first time the frame is mostly in view
  const inView = useInView(screenRef, { once: true, amount: 0.6 });
  useEffect(() => {
    if (!inView || touched.current) return;
    const t = setTimeout(() => {
      if (!touched.current) setMode('after');
    }, 500);
    return () => clearTimeout(t);
  }, [inView]);

  const choose = (next: Mode) => {
    touched.current = true;
    setMode(next);
  };

  const after = mode === 'after';
  const wipe = { duration: WIPE_DURATION, ease: EASE_REVEAL };

  return (
    <Stage ref={stageRef} style={{ scale: reduce ? 1 : scale }}>
      <StageInner>
        <Switch role="group" aria-label="Compare the concept website">
          <SwitchLabel>A website</SwitchLabel>
          <SwitchButton type="button" $active={!after} aria-pressed={!after} onClick={() => choose('before')}>
            As it is
          </SwitchButton>
          <Track aria-hidden="true">
            <TrackDot $after={after} />
          </Track>
          <SwitchButton type="button" $active={after} aria-pressed={after} onClick={() => choose('after')}>
            Reimagined
          </SwitchButton>
        </Switch>

        <Frame>
          <Chrome aria-hidden="true">
            <ConceptTag>Concept</ConceptTag>
            <Url>harborlanecoffee.example</Url>
            <span />
          </Chrome>
          <Screen ref={screenRef} aria-hidden="true">
            <BeforeSite />
            {reduce ? (
              <Layer initial={false} animate={{ opacity: after ? 1 : 0 }} transition={{ duration: DUR.state }}>
                <AfterSite />
              </Layer>
            ) : (
              <>
                <Layer
                  initial={false}
                  animate={{ clipPath: after ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)' }}
                  transition={wipe}
                >
                  <AfterSite />
                </Layer>
                <Edge
                  initial={false}
                  animate={{ x: after ? '100%' : '0%', opacity: [1, 1, 0] }}
                  transition={{ x: wipe, opacity: { duration: WIPE_DURATION, times: [0, 0.8, 1] } }}
                />
              </>
            )}
          </Screen>
        </Frame>

        <Caption>
          Concept redesign. Harbor Lane Coffee is a fictional business, shown as a typical template site and as Bonsai would reimagine it.
          <VisuallyHidden aria-live="polite">
            {after ? 'Showing the reimagined website.' : 'Showing the website as it is.'}
          </VisuallyHidden>
        </Caption>
      </StageInner>
    </Stage>
  );
}

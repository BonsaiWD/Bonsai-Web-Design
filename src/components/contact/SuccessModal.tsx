'use client';

import styled, { css, keyframes, ThemeProvider } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { DUR, EASE_OUT, RISE } from '@/lib/motion';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';
import { glassPane, glassTheme, lightField } from '@/styles/glass';
import { bronzeWord, glintOnce } from '@/styles/bronze';
import { frostedButton } from './buttons';

/*
 * The thank-you, once a project is planted (owner's request, 2026-10-30): on
 * the same smoked glass as the form, with the form's three steps drawn small
 * and all lit, "planted" in the hero's polished bronze, and the frosted bronze
 * button. It is a modal dialog: focus moves to its button and stays there,
 * Escape or a click outside closes it, and the page behind holds still.
 *
 * It renders into <body>, so it covers the fixed header: from inside the
 * contact section it sits in RootStage's isolated stacking context, where no
 * z-index can lift it above the header.
 */

const ease = `cubic-bezier(${EASE_OUT.join(', ')})`;

// True only on the client after hydration, when document.body exists for the portal
const subscribeNothing = () => () => {};
const useOnClient = () => useSyncExternalStore(subscribeNothing, () => true, () => false);

// It scrolls when the card is taller than the screen (zoomed right in, or a phone held sideways),
// and the card centres itself with auto margins, so it starts at the top instead of being cut off
const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.md};
  overflow: hidden auto;
  overscroll-behavior: contain;
  /* The page, dimmed and softened behind the glass */
  background: ${({ theme }) => `color-mix(in srgb, ${theme.colors.background} 72%, transparent)`};
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  /* Above the fixed header (1002) and the mobile menu overlay (1001) */
  z-index: 1003;
`;

const Stage = styled(motion.div)`
  position: relative;
  width: 100%;
  max-width: 460px;
  margin: auto;
`;

// What the glass looks through: bronze warmth behind the lit steps and a little sage below, both
// fading out inside the field so no edge shows around the card
const Light = styled.div`
  ${lightField}
  inset: -48px;
  background:
    radial-gradient(40% 30% at 50% 26%, rgba(200, 159, 129, 0.3), transparent 70%),
    radial-gradient(44% 34% at 40% 72%, rgba(174, 196, 168, 0.22), transparent 70%);
`;

const Card = styled.div`
  ${glassPane}
  padding: 40px 36px 36px;
  text-align: center;

  @media (max-width: 768px) {
    padding: 32px 20px 28px;
  }
`;

/* ---------- The form's three steps, planted ---------- */

const draw = keyframes`
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
`;

const appear = keyframes`
  from { opacity: 0; }
`;

const Mark = styled.svg`
  display: block;
  width: 120px;
  height: auto;
  margin: 0 auto 22px;
  overflow: visible;
  color: ${({ theme }) => theme.colors.primary};
`;

// Drawn in as the card arrives: the trunk, then the branches
const MarkTrace = styled.path<{ $delay: number }>`
  fill: none;
  stroke: currentColor;
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-opacity: 0.75;

  @media (prefers-reduced-motion: no-preference) {
    stroke-dasharray: 1;
    animation: ${draw} 0.5s ${ease} ${({ $delay }) => $delay}s both;
  }
`;

// Each pad filled and glowing, as in the form once planted
const markLit = css`
  @media (prefers-reduced-motion: no-preference) {
    animation: ${appear} 0.4s ${ease} 0.75s both;
  }
`;

const MarkHalo = styled.circle`
  fill: url(#planted-pad-halo);
  ${markLit}
`;

const MarkPad = styled.circle`
  fill: currentColor;
  ${markLit}
`;

// The form's fan at a third of its size: the root comes in at the top centre and splits into three pads
const MARK_TRUNK = 'M60 0 L60 8';
const MARK_BRANCHES = ['M60 8 L52 16 L22 16 L14 24 L14 28', 'M60 8 L60 28', 'M60 8 L68 16 L98 16 L106 24 L106 28'];
const MARK_PADS = [14, 60, 106];

function PlantedMark() {
    return (
        <Mark viewBox="0 0 120 38" aria-hidden="true">
            <defs>
                <radialGradient id="planted-pad-halo">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                </radialGradient>
            </defs>
            <MarkTrace d={MARK_TRUNK} pathLength={1} $delay={0.2} />
            {MARK_BRANCHES.map((d) => (
                <MarkTrace key={d} d={d} pathLength={1} $delay={0.35} />
            ))}
            {MARK_PADS.map((x) => (
                <g key={x}>
                    <MarkHalo cx={x} cy={32} r={11} />
                    <MarkPad cx={x} cy={32} r={4} />
                </g>
            ))}
        </Mark>
    );
}

// "planted" in the hero's polished bronze (bronzeWord), catching the light once as the card settles
const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 2.25rem;
  font-weight: 400;
  line-height: 1.1;
  color: ${({ theme }) => theme.colors.text};
  text-wrap: balance;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  ${bronzeWord}

  em {
    ${glintOnce(550)}
  }

  @media (max-width: 768px) {
    font-size: 1.9rem;
  }
`;

const Message = styled.p`
  max-width: 34ch;
  margin: 0 auto 32px;
  font-size: 1rem;
  line-height: 1.7;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const CloseButton = styled.button`
  ${frostedButton}
  padding: 0 36px;
`;

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SuccessModal({ isOpen, onClose }: SuccessModalProps) {
    const onClient = useOnClient();
    const reduce = useReducedMotionSafe();
    const closeRef = useRef<HTMLButtonElement>(null);
    const close = useEffectEvent(() => onClose());

    // While open: focus on the button, which is the dialog's only control, so Tab stays there;
    // Escape closes it; and the page behind holds still
    useEffect(() => {
        if (!isOpen) return;
        const root = document.documentElement;
        const { overflow, scrollbarGutter } = root.style;
        // Keep the scrollbar's room while the page is locked, so nothing behind shifts sideways
        root.style.scrollbarGutter = 'stable';
        root.style.overflow = 'hidden';
        closeRef.current?.focus({ preventScroll: true });
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Tab') {
                e.preventDefault();
                closeRef.current?.focus();
                closeRef.current?.scrollIntoView({ block: 'nearest' });
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            root.style.overflow = overflow;
            root.style.scrollbarGutter = scrollbarGutter;
        };
    }, [isOpen]);

    const away = reduce ? { opacity: 0 } : { opacity: 0, y: RISE.item, scale: 0.98 };

    if (!onClient) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <Overlay
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DUR.state, ease: EASE_OUT }}
                    onClick={onClose}
                >
                    <ThemeProvider theme={glassTheme}>
                        <Stage
                            initial={away}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={away}
                            transition={{ duration: DUR.reveal, ease: EASE_OUT }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Light aria-hidden="true" />
                            <Card
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="planted-title"
                                aria-describedby="planted-message"
                            >
                                <PlantedMark />
                                <Title id="planted-title">
                                    Your project is <em data-glow="planted">planted</em>
                                </Title>
                                <Message id="planted-message">
                                    Thank you for reaching out. We have received your inquiry and will get back to
                                    you shortly.
                                </Message>
                                <CloseButton ref={closeRef} type="button" onClick={onClose}>
                                    Close
                                </CloseButton>
                            </Card>
                        </Stage>
                    </ThemeProvider>
                </Overlay>
            )}
        </AnimatePresence>,
        document.body
    );
}

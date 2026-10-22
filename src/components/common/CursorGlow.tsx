'use client';

import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect } from 'react';
import styled from 'styled-components';
import { CUSTOM_CURSOR_QUERY } from '@/lib/motion';
import { useMediaQuery } from '@/lib/useMediaQuery';

const CursorOuter = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.colors.primary};
  pointer-events: none;
  z-index: 9998;
  mix-blend-mode: difference;
`;

const CursorInner = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.gold};
  pointer-events: none;
  z-index: 9999;
  box-shadow: 0 0 20px ${({ theme }) => theme.colors.primary};
`;

export default function CursorGlow() {
  // Same query GlobalStyle uses to hide the native cursor. False on the server
  // and during hydration, so nothing renders until the client confirms a match.
  const enabled = useMediaQuery(CUSTOM_CURSOR_QUERY);

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const scale = useMotionValue(1);

  const springConfig = { damping: 25, stiffness: 200, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);
  // Critically damped (damping >= 2 * sqrt(stiffness * mass) = 34.6) so the ring settles without a bounce
  const scaleSpring = useSpring(scale, { damping: 35, stiffness: 300 });

  const innerSpringConfig = { damping: 30, stiffness: 400, mass: 0.1 };
  const innerX = useSpring(cursorX, innerSpringConfig);
  const innerY = useSpring(cursorY, innerSpringConfig);

  useEffect(() => {
    if (!enabled) return;

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 20);
      cursorY.set(e.clientY - 20);

      // Check if hovering over clickable element
      const target = e.target as HTMLElement;
      const isClickable = target.closest('button, a, input, textarea, select, [role="button"], [onclick]');

      if (isClickable) {
        scale.set(1.25);
      } else {
        scale.set(1);
      }
    };

    window.addEventListener('mousemove', moveCursor);
    return () => window.removeEventListener('mousemove', moveCursor);
  }, [enabled, cursorX, cursorY, scale]);

  if (!enabled) return null;

  return (
    <>
      <CursorOuter
        style={{
          translateX: cursorXSpring,
          translateY: cursorYSpring,
          scale: scaleSpring,
        }}
      />
      <CursorInner
        style={{
          translateX: innerX,
          translateY: innerY,
          scale: scaleSpring,
        }}
      />
    </>
  );
}

'use client';

import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useRef, MouseEvent, ReactNode } from 'react';
import styled from 'styled-components';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';

interface MagneticButtonProps {
    children: ReactNode;
    strength?: number;
    className?: string;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
}

const ButtonWrapper = styled(motion.button)`
  position: relative;
  display: inline-block;

  /* GlobalStyle removes the outline on every button; restore it for keyboard focus */
  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

export default function MagneticButton({
    children,
    strength = 0.3,
    className,
    onClick,
    type = 'button',
    disabled = false,
}: MagneticButtonProps) {
    const ref = useRef<HTMLButtonElement>(null);
    const reduce = useReducedMotionSafe();

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springConfig = { stiffness: 150, damping: 15, mass: 0.1 };
    const springX = useSpring(x, springConfig);
    const springY = useSpring(y, springConfig);

    const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
        // No pull toward the pointer for readers who prefer reduced motion
        if (!ref.current || disabled || reduce) return;

        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distanceX = e.clientX - centerX;
        const distanceY = e.clientY - centerY;

        x.set(distanceX * strength);
        y.set(distanceY * strength);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <ButtonWrapper
            ref={ref}
            className={className}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            type={type}
            disabled={disabled}
            style={{ x: springX, y: springY }}
        >
            {children}
        </ButtonWrapper>
    );
}

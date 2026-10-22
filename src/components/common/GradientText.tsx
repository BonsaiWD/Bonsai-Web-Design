'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, ReactNode } from 'react';
import styled from 'styled-components';

interface GradientTextProps {
    children: ReactNode;
    className?: string;
}

const GradientSpan = styled(motion.span)`
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.textSecondary} 0%,
    ${({ theme }) => theme.colors.primary} 50%,
    ${({ theme }) => theme.colors.gold} 100%
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
  /* background-clip: text only paints inside this box, so extend it past the
     line box to keep italic overhangs and descenders (g, j, y) from being
     clipped; the negative margins cancel the padding so layout is unchanged */
  padding: 0 0.08em 0.2em;
  margin: 0 -0.08em -0.2em;
`;

export default function GradientText({ children, className }: GradientTextProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const backgroundPosition = useTransform(
        scrollYProgress,
        [0, 0.5, 1],
        ['200% 0%', '100% 0%', '0% 0%']
    );

    return (
        <GradientSpan
            ref={ref}
            className={className}
            style={{ backgroundPosition } as unknown as React.CSSProperties}
        >
            {children}
        </GradientSpan>
    );
}

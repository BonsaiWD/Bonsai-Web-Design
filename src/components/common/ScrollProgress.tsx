'use client';

import { motion, useScroll, useSpring } from 'framer-motion';
import styled from 'styled-components';

const ProgressBar = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.primary},
    ${({ theme }) => theme.colors.gold}
  );
  transform-origin: 0%;
  z-index: 9999;
  box-shadow: 0 0 10px rgba(200, 159, 129, 0.5);
`;

export default function ScrollProgress() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001,
    });

    return <ProgressBar style={{ scaleX }} />;
}

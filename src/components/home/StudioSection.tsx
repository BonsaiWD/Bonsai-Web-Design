'use client';

import styled from 'styled-components';
import { Section } from '../layout/Container';
import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useRef } from 'react';
import AnimatedCounter from '../common/AnimatedCounter';
import GradientText from '../common/GradientText';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';
import { DUR, EASE_OUT, RISE } from '@/lib/motion';

const StudioWrapper = styled(Section)`
  background: linear-gradient(
    180deg,
    rgba(16, 32, 24, 0.4) 0%,
    rgba(20, 40, 30, 0.3) 50%,
    rgba(16, 32, 24, 0.4) 100%
  );
  padding: ${({ theme }) => theme.spacing.xxxl} 0;
  overflow: clip;
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// Holds a lazy next/image (optimized AVIF/WebP at the right width) instead of a
// CSS background, which loaded the full 800 KB file on first view at every width
const BackgroundImage = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.1;
  z-index: 0;
`;

const ContentContainer = styled(motion.div)`
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  padding: 0 ${({ theme }) => theme.spacing.lg};
`;

const PreTitle = styled(motion.span)`
  color: ${({ theme }) => theme.colors.primary};
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.9rem;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  display: block;
`;

const Title = styled(motion.h2)`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 3.5rem;
  font-weight: 300;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  letter-spacing: 0.05em;
  text-shadow: 0 2px 12px rgba(200, 159, 129, 0.2);
  line-height: 1.2;

  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const Text = styled(motion.p)`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 1.2rem;
  line-height: 1.8;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  margin-left: auto;
  margin-right: auto;
`;

const StatGrid = styled(motion.div)`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing.xxl};
  width: 100%;
`;

const Stat = styled.div``;

const StatNumber = styled.div`
  font-size: 3rem;
  color: ${({ theme }) => theme.colors.primary};
  font-family: ${({ theme }) => theme.fonts.heading};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const StatLabel = styled.div`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

export default function StudioSection() {
  const ref = useRef(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  // Background parallax only; the content reveals once and then stays put
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <StudioWrapper id="studio" ref={ref}>
      <BackgroundImage style={{ y: reduce ? 0 : y }} aria-hidden="true">
        <Image
          src="/images/studio-background.png"
          alt=""
          fill
          sizes="100vw"
          quality={55}
          style={{ objectFit: 'cover' }}
        />
      </BackgroundImage>

      <ContentContainer
        initial={{ opacity: 0, y: RISE.item }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '0px 0px -15% 0px' }}
        transition={{ duration: DUR.reveal, ease: EASE_OUT }}
      >
        <PreTitle
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          The Studio
        </PreTitle>

        <Title
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <GradientText>Cultivating Digital Excellence.</GradientText>
        </Title>

        <Text
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Like a bonsai, true craftsmanship requires patience, vision, and an unyielding attention to detail. We don&apos;t just build websites; we nurture digital ecosystems that grow with your business.
        </Text>

        <Text
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Our boutique approach ensures that every project receives our full dedication, resulting in work that stands the test of time.
        </Text>

        <StatGrid
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Stat>
            <StatNumber>
              <AnimatedCounter to={50} suffix="+" />
            </StatNumber>
            <StatLabel>Projects</StatLabel>
          </Stat>
        </StatGrid>
      </ContentContainer>
    </StudioWrapper>
  );
}

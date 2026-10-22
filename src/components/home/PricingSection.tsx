'use client';

import styled from 'styled-components';
import { Section, Container } from '../layout/Container';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { FaTools, FaLaptopCode, FaLayerGroup, FaCheck } from 'react-icons/fa';
import GradientText from '../common/GradientText';
import { useRef, useState } from 'react';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';
import { DUR, EASE_OUT, RISE, STAGGER } from '@/lib/motion';

const PricingWrapper = styled(Section)`
  background: linear-gradient(
    180deg,
    rgba(16, 32, 24, 0.3) 0%,
    rgba(20, 40, 30, 0.2) 50%,
    rgba(16, 32, 24, 0.3) 100%
  );
  padding-top: ${({ theme }) => theme.spacing.xxxl};
  padding-bottom: ${({ theme }) => theme.spacing.xxxl};
  overflow: clip;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
  z-index: 2;
`;

const Title = styled(motion.h2)`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 3.5rem;
  font-weight: 300;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  letter-spacing: 0.05em;
  text-shadow: 0 2px 12px rgba(200, 159, 129, 0.2);

  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.xl};
  position: relative;
  z-index: 2;

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: repeat(3, 1fr);
    gap: ${({ theme }) => theme.spacing.lg};
  }
`;

const CardWrapper = styled(motion.div)`
  perspective: 1000px;
  cursor: pointer;
`;

const PricingCard = styled(motion.div) <{ $isHovered?: boolean }>`
  background: rgba(20, 30, 25, 0.5);
  padding: ${({ theme }) => theme.spacing.xl};
  border-radius: 24px;
  border: 1px solid rgba(200, 159, 129, 0.15);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  position: relative;
  overflow: hidden;
  height: 100%;
  align-items: center;
  text-align: center;
  transform-style: preserve-3d;
  will-change: transform;

  /* Multi-layer glass effect */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 24px;
    padding: 1px;
    background: linear-gradient(
      135deg,
      rgba(200, 159, 129, 0.5),
      transparent 40%,
      transparent 60%,
      rgba(200, 159, 129, 0.5)
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0.6;
    transition: opacity 0.4s ease;
  }

  /* Inner glow layer */
  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      ellipse at center,
      rgba(200, 159, 129, 0.08) 0%,
      transparent 50%
    );
    opacity: 0;
    transition: opacity 0.5s ease;
    pointer-events: none;
  }

  &:hover::after {
    opacity: 1;
  }

  &:hover::before {
    opacity: 1;
  }
`;

const FloatingShadow = styled(motion.div)`
  position: absolute;
  bottom: -20px;
  left: 10%;
  right: 10%;
  height: 40px;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.3) 0%,
    transparent 70%
  );
  filter: blur(15px);
  z-index: -1;
  opacity: 0.5;
  transition: all 0.4s ease;
`;

const IconWrapper = styled(motion.div)`
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: ${({ theme }) => theme.colors.primary};
  background: rgba(200, 159, 129, 0.1);
  border-radius: 20px;
  border: 1px solid rgba(200, 159, 129, 0.2);
  filter: drop-shadow(0 0 15px rgba(200, 159, 129, 0.2));
  transition: all 0.4s ease;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const PriceContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const PricePrefix = styled.div`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.8;
`;

const Price = styled.div`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 3rem;
  font-weight: 300;
  color: ${({ theme }) => theme.colors.text};
  letter-spacing: -0.02em;
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.colors.text} 0%,
    ${({ theme }) => theme.colors.primary} 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const PriceLabel = styled.div`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.1rem;
  color: ${({ theme }) => theme.colors.primary};
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 400;
`;

const PriceDescription = styled.div`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
`;

const Divider = styled(motion.div)`
  width: 60px;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    ${({ theme }) => theme.colors.primary},
    transparent
  );
  margin: ${({ theme }) => theme.spacing.sm} auto;
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  width: 100%;
`;

const FeatureItem = styled(motion.li)`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.9rem;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  
  svg {
    color: ${({ theme }) => theme.colors.primary};
    font-size: 0.7rem;
    opacity: 0.8;
    flex-shrink: 0;
  }
`;

interface TiltCardProps {
  children: React.ReactNode;
  index: number;
}

function TiltCard({ children, index }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const reduce = useReducedMotionSafe();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 300, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || reduce) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) / rect.width);
    y.set((e.clientY - centerY) / rect.height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  // Reveal once as the card enters view (staggered), then stay put. Under
  // reduced motion MotionConfig drops the rise and keeps a plain fade.
  return (
    <CardWrapper
      initial={{ opacity: 0, y: RISE.item }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: DUR.reveal, ease: EASE_OUT, delay: index * STAGGER.item * 2 }}
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: reduce ? 0 : rotateX,
          rotateY: reduce ? 0 : rotateY,
          transformStyle: 'preserve-3d',
        }}
        animate={{
          scale: isHovered ? 1.02 : 1,
          z: isHovered ? 30 : 0,
        }}
        transition={{ duration: 0.3 }}
      >
        <PricingCard $isHovered={isHovered}>
          {children}
        </PricingCard>
        <FloatingShadow
          animate={{
            opacity: isHovered ? 0.8 : 0.4,
            scale: isHovered ? 1.1 : 1,
            y: isHovered ? 10 : 0,
          }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </CardWrapper>
  );
}

interface PricingOption {
  id: number;
  title: string;
  price: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  pricePrefix?: string;
}

const pricingOptions: PricingOption[] = [
  {
    id: 1,
    title: 'Hourly Project & Maintenance Rate',
    price: '$120',
    description: '',
    icon: <FaTools />,
    features: [
      'Website Updates',
      'Bug Fixes & Debugging',
      'Feature Enhancements',
      'Content Refresh',
      'Technical Support',
      'Performance Optimization',
      'QA Testing',
    ]
  },
  {
    id: 2,
    title: 'Custom Website',
    price: '$1500',
    pricePrefix: 'Starting at',
    description: 'Per Page',
    icon: <FaLaptopCode />,
    features: [
      'Up To 5 Sections Per Page',
      'Custom Contact Form',
      'Styled Components',
      'Mobile Responsive',
      'Brand Integration',
      'Domain Integration',
      'GitHub Integration',
      'Vercel Deployment',
      'All Options Negotiable'
    ]
  },
  {
    id: 3,
    title: 'Custom Add-ons',
    price: '$250+',
    pricePrefix: 'Starting at',
    description: 'Per Custom Feature',
    icon: <FaLayerGroup />,
    features: [
      'Custom Content Integration',
      'Custom Layouts',
      'Advanced Features',
      'Custom Components',
      'Database Integration',
      'Custom API Endpoints',
      'Custom Authentication',
      'Custom Deployment',
      'AI Integration',
      'Website Analytics',
      'Custom Email Integration'
    ]
  },
];

const featureVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
    },
  }),
};

export default function PricingSection() {
  return (
    <PricingWrapper id="pricing">
      <Container>
        <Header>
          <Title
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <GradientText>Investment</GradientText>
          </Title>
        </Header>

        <Grid>
          {pricingOptions.map((option, index) => (
            <TiltCard key={option.id} index={index}>
              <IconWrapper
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                {option.icon}
              </IconWrapper>

              <PriceContainer>
                {option.pricePrefix && (
                  <PricePrefix>{option.pricePrefix}</PricePrefix>
                )}
                <Price>{option.price}</Price>
                <PriceLabel>{option.title}</PriceLabel>
                <PriceDescription>{option.description}</PriceDescription>
              </PriceContainer>

              <Divider
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
              />

              <FeatureList>
                {option.features.map((feature, i) => (
                  <FeatureItem
                    key={i}
                    custom={i}
                    variants={featureVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                  >
                    <FaCheck />
                    {feature}
                  </FeatureItem>
                ))}
              </FeatureList>
            </TiltCard>
          ))}
        </Grid>
      </Container>
    </PricingWrapper>
  );
}


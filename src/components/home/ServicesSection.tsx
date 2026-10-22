'use client';

import styled from 'styled-components';
import { Section, Container } from '../layout/Container';
import { motion } from 'framer-motion';
import { SiReact, SiFigma, SiShopify, SiNextdotjs } from 'react-icons/si';
import GradientText from '../common/GradientText';
import { DUR, EASE_OUT, RISE, STAGGER } from '@/lib/motion';

const ServicesWrapper = styled(Section)`
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
    grid-template-columns: repeat(2, 1fr);
    gap: ${({ theme }) => theme.spacing.xxl};
  }
`;

const CardWrapper = styled(motion.div)`
  perspective: 1000px;
`;

const ServiceCard = styled(motion.div)`
  background: rgba(20, 30, 25, 0.6);
  padding: ${({ theme }) => theme.spacing.xl};
  border-radius: 16px;
  border: 1px solid rgba(200, 159, 129, 0.1);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  position: relative;
  overflow: hidden;
  height: 100%;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* Elegant Gold Glow on Hover */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 16px;
    padding: 1px;
    background: linear-gradient(
      135deg,
      rgba(200, 159, 129, 0.4),
      transparent 50%,
      rgba(200, 159, 129, 0.4)
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0.5;
    transition: opacity 0.4s ease;
  }

  &:hover {
    transform: translateY(-5px);
    background: rgba(25, 35, 30, 0.8);
    box-shadow: 
      0 10px 30px rgba(0, 0, 0, 0.2),
      0 0 20px rgba(200, 159, 129, 0.1);
    border-color: rgba(200, 159, 129, 0.3);
  }

  &:hover::before {
    opacity: 1;
  }
`;

const IconWrapper = styled.div`
  font-size: 2.5rem;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.9;
  filter: drop-shadow(0 0 10px rgba(200, 159, 129, 0.3));
  transition: transform 0.3s ease;

  ${ServiceCard}:hover & {
    transform: scale(1.05) translateY(-2px);
    filter: drop-shadow(0 0 15px rgba(200, 159, 129, 0.5));
  }
`;

const ServiceTitle = styled.h3`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.8rem;
  color: ${({ theme }) => theme.colors.text};
  font-weight: 400;
  letter-spacing: 0.02em;
`;

const ServiceDescription = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.7;
  font-size: 1.05rem;
  font-weight: 300;
`;

function ScrollRevealCard({ children, index }: { children: React.ReactNode; index: number }) {
  // Reveal once on entry; the second card in a desktop row follows by one stagger step
  return (
    <CardWrapper
      initial={{ opacity: 0, y: RISE.item }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: DUR.reveal, ease: EASE_OUT, delay: (index % 2) * STAGGER.item }}
    >
      {children}
    </CardWrapper>
  );
}

interface Service {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const services: Service[] = [
  {
    id: 1,
    title: 'Experience Design',
    description: 'Intuitive interfaces designed to captivate and convert. We blend aesthetics with functionality to create seamless user journeys.',
    icon: <SiFigma />,
  },
  {
    id: 2,
    title: 'Technical Development',
    description: 'Robust, scalable architectures built with modern frameworks. Speed, security, and performance come as standard.',
    icon: <SiNextdotjs />,
  },
  {
    id: 3,
    title: 'Brand Identity',
    description: 'Crafting visual languages that tell your story. From logos to typography, we build systems that resonate with your audience.',
    icon: <SiReact />, // Using React icon as abstract symbol for "System"
  },
  {
    id: 4,
    title: 'E-Commerce',
    description: 'Seamless shopping experiences. From custom storefronts to secure payment integrations, we help you sell with style.',
    icon: <SiShopify />,
  },
];

export default function ServicesSection() {
  return (
    <ServicesWrapper id="services">
      <Container>
        <Header>
          <Title
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <GradientText>Refined Digital Solutions</GradientText>
          </Title>
        </Header>

        <Grid>
          {services.map((service, index) => (
            <ScrollRevealCard key={service.id} index={index}>
              <ServiceCard>
                <IconWrapper>{service.icon}</IconWrapper>
                <ServiceTitle>{service.title}</ServiceTitle>
                <ServiceDescription>{service.description}</ServiceDescription>
              </ServiceCard>
            </ScrollRevealCard>
          ))}
        </Grid>
      </Container>
    </ServicesWrapper>
  );
}

'use client';

import styled from 'styled-components';
import { Section, Container } from '../layout/Container';
import { motion, stagger, type Variants } from 'framer-motion';
import Image from 'next/image';
import GradientText from '../common/GradientText';
import AnimatedCounter from '../common/AnimatedCounter';
import { DUR, EASE_OUT, RISE, STAGGER } from '@/lib/motion';

// Headshots render at up to 350px: full container width on small phones, and
// the 1fr column of a 1fr / 1.5fr grid (128px gap) between 768px and ~1046px.
const HEADSHOT_SIZES =
  '(min-width: 1047px) 350px, (min-width: 768px) calc(40vw - 70px), (min-width: 382px) 350px, calc(100vw - 32px)';

const AboutWrapper = styled(Section)`
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

// Studio intro (formerly its own section) leads into the team
const Intro = styled(motion.div)`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xxxl};

  @media (max-width: 768px) {
    margin-bottom: ${({ theme }) => theme.spacing.xxl};
  }
`;

const Eyebrow = styled(motion.p)`
  font-size: 0.75rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const IntroCopy = styled(motion.p)`
  max-width: 560px;
  margin: 0 auto ${({ theme }) => theme.spacing.lg};
  font-size: 1.15rem;
  line-height: 1.8;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ProjectStat = styled(motion.div)`
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

const TeamTitle = styled.h3`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 2.25rem;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.primary};
  text-align: center;

  @media (max-width: 768px) {
    font-size: 1.75rem;
  }
`;

const introGroup: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: stagger(STAGGER.item) } },
};

const introItem: Variants = {
  hidden: { opacity: 0, y: RISE.item },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.reveal, ease: EASE_OUT } },
};

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

const TeamContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
  max-width: 1200px;
  margin: 0 auto;
`;

const MemberSection = styled(motion.div) <{ $reverse?: boolean }>`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.xxl};
  align-items: center;

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: ${({ $reverse }) => $reverse ? '1.5fr 1fr' : '1fr 1.5fr'};
    gap: ${({ theme }) => theme.spacing.xxxl};
  }
`;

const PhotoContainer = styled.div<{ $order?: number }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    order: ${({ $order }) => $order || 0};
  }
`;

const PhotoFrame = styled(motion.div)`
  position: relative;
  width: 100%;
  max-width: 350px;
  margin: 0 auto;
  aspect-ratio: 1;
  border-radius: 20px;
  overflow: hidden;
  background: rgba(20, 30, 25, 0.6);
  backdrop-filter: blur(12px);
  border: 2px solid rgba(200, 159, 129, 0.2);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.3),
    0 0 30px rgba(200, 159, 129, 0.1);
  
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 20px;
    padding: 2px;
    background: linear-gradient(
      135deg,
      rgba(200, 159, 129, 0.5),
      transparent 50%,
      rgba(200, 159, 129, 0.5)
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0.6;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }
`;

const NameLabel = styled(motion.div)`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.8rem;
  font-weight: 300;
  text-align: center;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.colors.primary},
    ${({ theme }) => theme.colors.accent}
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 60px;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      ${({ theme }) => theme.colors.primary},
      transparent
    );
  }

  @media (max-width: 768px) {
    font-size: 1.4rem;
    letter-spacing: 0.1em;
  }
`;

const RoleLabel = styled(motion.div)`
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 1rem;
  font-weight: 400;
  text-align: center;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

const BioContent = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const IntroText = styled.p`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.3rem;
  line-height: 1.9;
  color: ${({ theme }) => theme.colors.text};
  font-weight: 300;
  letter-spacing: 0.02em;
  background: rgba(20, 30, 25, 0.3);
  padding: ${({ theme }) => theme.spacing.lg};
  border-radius: 12px;
  border: 1px solid rgba(200, 159, 129, 0.1);
  backdrop-filter: blur(8px);
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(
      180deg,
      ${({ theme }) => theme.colors.primary},
      ${({ theme }) => theme.colors.accent}
    );
    border-radius: 12px 0 0 12px;
  }

  @media (max-width: 768px) {
    font-size: 1.15rem;
    line-height: 1.8;
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

const PhilosophyText = styled.p`
  font-size: 1.15rem;
  line-height: 1.7;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-weight: 300;
  font-style: italic;
  padding-left: ${({ theme }) => theme.spacing.md};
  border-left: 2px solid ${({ theme }) => theme.colors.primary};
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing.lg};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

const StatCard = styled(motion.div)`
  background: rgba(20, 30, 25, 0.4);
  padding: ${({ theme }) => theme.spacing.lg};
  border-radius: 12px;
  border: 1px solid rgba(200, 159, 129, 0.1);
  backdrop-filter: blur(8px);
  text-align: center;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(25, 35, 30, 0.6);
    border-color: rgba(200, 159, 129, 0.3);
    transform: translateY(-2px);
  }
`;

const StatNumber = styled.div`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 2.5rem;
  font-weight: 300;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const StatLabel = styled.div`
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Divider = styled.div`
  width: 100%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(200, 159, 129, 0.3),
    transparent
  );
  margin: 0 auto;
`;

export default function AboutSection() {
  return (
    <AboutWrapper id="about">
      <Container>
        <Intro
          variants={introGroup}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '0px 0px -15% 0px' }}
        >
          <Eyebrow variants={introItem}>The Studio</Eyebrow>
          <Title variants={introItem}>
            <GradientText>Cultivating Digital Excellence.</GradientText>
          </Title>
          <IntroCopy variants={introItem}>
            Like a bonsai, true craftsmanship requires patience, vision, and an unyielding attention to detail. We don&apos;t just build websites; we nurture digital ecosystems that grow with your business.
          </IntroCopy>
          <IntroCopy variants={introItem}>
            Our boutique approach ensures that every project receives our full dedication, resulting in work that stands the test of time.
          </IntroCopy>
          <ProjectStat variants={introItem}>
            <StatNumber>
              <AnimatedCounter to={50} suffix="+" />
            </StatNumber>
            <StatLabel>Projects</StatLabel>
          </ProjectStat>
        </Intro>

        {/* Taller than the viewport, so reveal on a margin rather than viewport.amount */}
        <TeamContainer
          initial={{ opacity: 0, y: RISE.item }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -15% 0px' }}
          transition={{ duration: DUR.reveal, ease: EASE_OUT }}
        >
          <TeamTitle>
            <GradientText>Meet The Team</GradientText>
          </TeamTitle>

          {/* David Shapiro - Image Left, Bio Right */}
          <MemberSection>
            <PhotoContainer>
              <PhotoFrame
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <Image
                  src="/images/headshot.png"
                  alt="David Aaron Shapiro - Bonsai Web Designer"
                  width={350}
                  height={350}
                  sizes={HEADSHOT_SIZES}
                />
              </PhotoFrame>
              <NameLabel
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                David Aaron Shapiro
              </NameLabel>
              <RoleLabel
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 0.7 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                Bonsai Web Designer
              </RoleLabel>
            </PhotoContainer>

            <BioContent
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <IntroText>
                With years of experience building for the web and a Software Engineering degree from Western Governors University, David has dedicated his career to transforming ideas into refined digital realities.
              </IntroText>

              <StatCard
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}
              >
                <StatNumber style={{ marginBottom: 0 }}>WGU</StatNumber>
                <StatLabel>Bachelor of Science in Software Engineering</StatLabel>
              </StatCard>
            </BioContent>
          </MemberSection>

          <Divider />

          {/* Jenna Shapiro - Image Left, Bio Right (same as David) */}
          <MemberSection>
            <PhotoContainer>
              <PhotoFrame
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <Image
                  src="/images/jenna-headshot.jpg"
                  alt="Jenna Shapiro - Creative Director"
                  width={350}
                  height={350}
                  sizes={HEADSHOT_SIZES}
                />
              </PhotoFrame>
              <NameLabel
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                Jenna Shapiro
              </NameLabel>
              <RoleLabel
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 0.7 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                Creative Director
              </RoleLabel>
            </PhotoContainer>

            <BioContent
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <IntroText>
                With an eye for elegance and a passion for visual storytelling, Jenna brings a refined creative vision to every project. Her expertise in design aesthetics ensures each website captures the essence of your brand.
              </IntroText>
            </BioContent>
          </MemberSection>
        </TeamContainer>
      </Container>
    </AboutWrapper>
  );
}

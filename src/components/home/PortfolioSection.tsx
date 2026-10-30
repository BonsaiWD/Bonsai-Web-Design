'use client';

import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Fragment } from 'react';
import { Section, Container } from '../layout/Container';
import GradientText from '../common/GradientText';
import Enso from '../common/Enso';
import { FiArrowUpRight } from 'react-icons/fi';
import { featured, projects } from '@/data/work';

const displayDomain = (url: string) => new URL(url).hostname.replace(/^www\./, '');
const pad = (n: number) => String(n).padStart(2, '0');

const PortfolioWrapper = styled(Section)`
  background: linear-gradient(
    180deg,
    rgba(20, 40, 30, 0.2) 0%,
    rgba(16, 32, 24, 0.3) 50%,
    rgba(20, 40, 30, 0.2) 100%
  );
  padding: ${({ theme }) => theme.spacing.xxxl} 0;
  position: relative;
  overflow: clip;

  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.spacing.xxl} 0;
  }
`;

const Header = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
`;

const Eyebrow = styled(motion.p)`
  font-family: ${({ theme }) => theme.fonts.label};
  font-stretch: 112%;
  font-size: 0.75rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.8;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const SectionTitle = styled(motion.h2)`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 3rem;
  font-weight: 300;
  color: ${({ theme }) => theme.colors.primary};
  letter-spacing: 0.05em;
  text-shadow: 0 2px 12px rgba(200, 159, 129, 0.2);

  @media (max-width: 768px) {
    font-size: 2.25rem;
  }
`;

/* ---------- Featured client ---------- */

const FeaturedPanel = styled(motion.div)`
  position: relative;
  display: grid;
  grid-template-columns: 5fr 7fr;
  gap: ${({ theme }) => theme.spacing.xxl};
  padding: 56px;
  border-radius: 28px;
  border: 1px solid rgba(200, 159, 129, 0.18);
  background:
    radial-gradient(circle at 12% 18%, rgba(200, 159, 129, 0.1), transparent 55%),
    linear-gradient(160deg, rgba(26, 38, 30, 0.85) 0%, rgba(15, 20, 16, 0.85) 100%);
  overflow: hidden;
  margin-bottom: 96px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.xl};
    padding: 40px;
  }

  @media (max-width: 768px) {
    padding: 28px 20px;
    border-radius: 20px;
    margin-bottom: ${({ theme }) => theme.spacing.xxl};
  }
`;

const FeaturedEnso = styled(Enso)`
  position: absolute;
  width: 460px;
  height: 460px;
  left: -40px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.1;
  pointer-events: none;

  @media (max-width: 1024px) {
    width: 360px;
    height: 360px;
    left: auto;
    right: -160px;
    top: -140px;
    transform: none;
  }
`;

const FeaturedIntro = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const MetaRow = styled.div`
  font-family: ${({ theme }) => theme.fonts.label};
  font-stretch: 112%;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  span:last-child {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const MetaDot = styled.span`
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  opacity: 0.6;
`;

const FeaturedTitle = styled.h3`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-style: italic;
  font-size: 3.25rem;
  font-weight: 300;
  line-height: 1.05;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  @media (max-width: 768px) {
    font-size: 2.4rem;
  }
`;

const Tagline = styled.p`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.15rem;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.primary};
  padding-left: ${({ theme }) => theme.spacing.md};
  border-left: 1px solid rgba(200, 159, 129, 0.4);
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const Summary = styled.p`
  font-size: 0.98rem;
  line-height: 1.7;
  color: ${({ theme }) => theme.colors.textSecondary};
  max-width: 420px;
`;

const Branch = styled.ul`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;

  /* The branch line linking every property */
  &::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 46px;
    bottom: 46px;
    width: 1px;
    background: linear-gradient(
      180deg,
      rgba(200, 159, 129, 0.6) 0%,
      rgba(200, 159, 129, 0.25) 100%
    );
  }
`;

const BranchNode = styled.span`
  position: relative;
  z-index: 1;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.background};
  transition: ${({ theme }) => theme.transitions.default};
`;

const BranchArrow = styled.span`
  display: inline-flex;
  font-size: 1.25rem;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.4;
  transition: ${({ theme }) => theme.transitions.default};
`;

const BranchTitle = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.45rem;
  font-weight: 300;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.25;
  transition: ${({ theme }) => theme.transitions.default};

  @media (max-width: 768px) {
    font-size: 1.2rem;
  }
`;

const BranchLink = styled(motion.a)`
  display: grid;
  grid-template-columns: 11px minmax(0, 1fr) auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: 18px 0;
  text-decoration: none;
  border-bottom: 1px solid rgba(200, 159, 129, 0.1);

  li:last-child & {
    border-bottom: none;
  }

  &:hover ${BranchNode}, &:focus-visible ${BranchNode} {
    background: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 5px rgba(200, 159, 129, 0.15);
  }

  &:hover ${BranchArrow}, &:focus-visible ${BranchArrow} {
    opacity: 1;
    transform: translate(3px, -3px);
  }

  &:hover ${BranchTitle}, &:focus-visible ${BranchTitle} {
    color: ${({ theme }) => theme.colors.primary};
  }

  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }

  @media (max-width: 768px) {
    gap: ${({ theme }) => theme.spacing.md};
    padding: 16px 0;
  }
`;

const BranchText = styled.span`
  min-width: 0;
`;

const Kind = styled.span`
  font-family: ${({ theme }) => theme.fonts.label};
  font-stretch: 112%;
  display: block;
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.75;
  margin-bottom: 4px;
`;

const Domain = styled.span`
  display: block;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.75;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/* ---------- Further work ---------- */

const MoreHeading = styled.div`
  font-family: ${({ theme }) => theme.fonts.label};
  font-stretch: 112%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.md};

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(200, 159, 129, 0.4), transparent);
  }
`;

const WorkMeta = styled(MetaRow)`
  flex-wrap: wrap;

  @media (max-width: 768px) {
    letter-spacing: 0.18em;
  }

  span:not(:first-child) {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const WorkTitle = styled.h3`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 2.25rem;
  font-weight: 400;
  line-height: 1.1;
  color: ${({ theme }) => theme.colors.text};
  transition: color 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 768px) {
    font-size: 1.75rem;
  }
`;

const WorkIntro = styled.div`
  grid-area: intro;
  position: relative;
  min-width: 0;
`;

const WorkBody = styled.div`
  grid-area: body;
  position: relative;
  min-width: 0;
`;

const WorkDescription = styled.p`
  max-width: 480px;
  font-size: 1rem;
  line-height: 1.7;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const WorkFoot = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textSecondary};

  span:not(${MetaDot}) {
    opacity: 0.8;
  }
`;

const WorkArrow = styled.span`
  grid-area: arrow;
  position: relative;
  display: inline-flex;
  justify-self: end;
  font-size: 1.4rem;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.35;
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
`;

// One editorial row per project: intro left, description right, like the featured panel's split
const WorkRow = styled(motion.a)`
  position: relative;
  display: grid;
  grid-template-columns: 5fr 6fr 32px;
  grid-template-areas: 'intro body arrow';
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xxl};
  padding: 40px 16px;
  text-decoration: none;
  border-bottom: 1px solid rgba(200, 159, 129, 0.14);

  /* Bronze wash that sweeps in from the left */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(200, 159, 129, 0.09), rgba(200, 159, 129, 0) 70%);
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
  }

  &:hover::before,
  &:focus-visible::before {
    transform: scaleX(1);
  }

  &:hover ${WorkTitle}, &:focus-visible ${WorkTitle} {
    color: ${({ theme }) => theme.colors.primary};
    transform: translateX(12px);
  }

  &:hover ${WorkArrow}, &:focus-visible ${WorkArrow} {
    opacity: 1;
    transform: translate(3px, -3px);
  }

  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: -1px;
  }

  @media (max-width: 1024px) {
    grid-template-columns: minmax(0, 1fr) 32px;
    grid-template-areas:
      'intro arrow'
      'body body';
    gap: ${({ theme }) => theme.spacing.lg};
    padding: 32px 16px;
  }

  /* Labels get the full width on phones; the arrow drops beside the domain */
  @media (max-width: 768px) {
    grid-template-areas:
      'intro intro'
      'body arrow';
    align-items: end;
    padding: 28px 4px;
  }
`;

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export default function PortfolioSection() {
  return (
    <PortfolioWrapper id="portfolio">
      <Container>
        <Header>
          <Eyebrow
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 0.8, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Selected Work
          </Eyebrow>
          <SectionTitle
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <GradientText>Projects</GradientText>
          </SectionTitle>
        </Header>

        <FeaturedPanel
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <FeaturedEnso rotate={-35} />

          <FeaturedIntro>
            <MetaRow>
              <span>Featured Client</span>
              <MetaDot />
              <span>{pad(featured.properties.length)} Properties</span>
            </MetaRow>
            <FeaturedTitle>{featured.name}</FeaturedTitle>
            <Tagline>{featured.tagline}</Tagline>
            <Summary>{featured.summary}</Summary>
          </FeaturedIntro>

          <Branch>
            {featured.properties.map((property, i) => (
              <li key={property.url}>
                <BranchLink
                  href={property.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  custom={i}
                  variants={reveal}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  <BranchNode />
                  <BranchText>
                    <Kind>{property.kind}</Kind>
                    <BranchTitle>{property.title}</BranchTitle>
                    <Domain>{displayDomain(property.url)}</Domain>
                  </BranchText>
                  <BranchArrow>
                    <FiArrowUpRight />
                  </BranchArrow>
                  <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
                </BranchLink>
              </li>
            ))}
          </Branch>
        </FeaturedPanel>

        <MoreHeading>
          <span>More Work</span>
        </MoreHeading>

        {projects.map((project, index) => (
          <WorkRow
            key={project.url}
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            custom={index}
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <WorkIntro>
              <WorkMeta>
                {project.tags.map((tag, i) => (
                  <Fragment key={tag}>
                    {i > 0 && <MetaDot />}
                    <span>{tag}</span>
                  </Fragment>
                ))}
              </WorkMeta>
              <WorkTitle>{project.title}</WorkTitle>
            </WorkIntro>
            <WorkBody>
              <WorkDescription>{project.description}</WorkDescription>
              <WorkFoot>
                <span>{displayDomain(project.url)}</span>
                {project.status && (
                  <>
                    <MetaDot />
                    <span>{project.status}</span>
                  </>
                )}
              </WorkFoot>
            </WorkBody>
            <WorkArrow>
              <FiArrowUpRight />
            </WorkArrow>
            <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
          </WorkRow>
        ))}
      </Container>
    </PortfolioWrapper>
  );
}

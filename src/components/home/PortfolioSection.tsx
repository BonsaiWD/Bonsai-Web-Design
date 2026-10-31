'use client';

import styled, { ThemeProvider } from 'styled-components';
import { motion } from 'framer-motion';
import { Fragment } from 'react';
import { Section, Container } from '../layout/Container';
import GradientText from '../common/GradientText';
import { FiArrowUpRight } from 'react-icons/fi';
import { featured, projects } from '@/data/work';
import { glassPane, glassTheme, lightField } from '@/styles/glass';

const displayDomain = (url: string) => new URL(url).hostname.replace(/^www\./, '');
const pad = (n: number) => String(n).padStart(2, '0');

// A theme colour at some strength, for hairlines and washes that follow whichever palette is in use
const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

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

/* ---------- The glass ---------- */

// The featured client and the additional projects each sit behind a pane of smoked glass
// (src/styles/glass.ts), and the pane and the light it looks through are revealed together
const GlassStage = styled(motion.div)`
  position: relative;
`;

const LightField = styled.div`
  ${lightField}
`;

/* ---------- Featured client ---------- */

const FeaturedStage = styled(GlassStage)`
  margin-bottom: 96px;

  @media (max-width: 768px) {
    margin-bottom: ${({ theme }) => theme.spacing.xxl};
  }
`;

const FeaturedPanel = styled.div`
  ${glassPane}
  display: grid;
  grid-template-columns: 5fr 7fr;
  gap: ${({ theme }) => theme.spacing.xxl};
  padding: 56px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.xl};
    padding: 40px;
  }

  @media (max-width: 768px) {
    padding: 28px 20px;
  }
`;

const FeaturedIntro = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const MetaRow = styled.div`
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

// Upright, as the site's other headings are: an italic display serif here read as a magazine
const FeaturedTitle = styled.h3`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 3.25rem;
  font-weight: 400;
  line-height: 1.08;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  @media (max-width: 768px) {
    font-size: 2.4rem;
  }
`;

// In the ink, not the bronze, so it reads as the title's second voice rather than a third colour.
// Set in Inter: at this size Playfair's hairlines thin out on the glass and the line gets hard to read.
const Tagline = styled.p`
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 1.2rem;
  line-height: 1.6;
  text-wrap: balance;
  color: ${({ theme }) => theme.colors.text};
  padding-left: ${({ theme }) => theme.spacing.md};
  border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 40)};
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
      ${({ theme }) => tint(theme.colors.primary, 60)} 0%,
      ${({ theme }) => tint(theme.colors.primary, 25)} 100%
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

// In Inter, like the tagline, for the same reason: Playfair's hairlines thin out on the glass.
const BranchTitle = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 1.2rem;
  font-weight: 400;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.3;
  transition: ${({ theme }) => theme.transitions.default};
`;

const BranchLink = styled(motion.a)`
  display: grid;
  grid-template-columns: 11px minmax(0, 1fr) auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: 18px 0;
  text-decoration: none;
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 18)};

  li:last-child & {
    border-bottom: none;
  }

  &:hover ${BranchNode}, &:focus-visible ${BranchNode} {
    background: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 5px ${({ theme }) => tint(theme.colors.primary, 15)};
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
  display: block;
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 4px;
`;

const Domain = styled.span`
  display: block;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/* ---------- Further work ---------- */

// Behind the additional projects the light is mirrored, warmth on the left and sage on the right, so the two
// panes read as one light falling across the section rather than a repeat
const MoreLightField = styled(LightField)`
  background:
    radial-gradient(30% 34% at 20% 28%, rgba(200, 159, 129, 0.2), transparent 72%),
    radial-gradient(40% 40% at 78% 66%, rgba(174, 196, 168, 0.28), transparent 70%);
`;

// The rows' own padding brings their text in line with the featured client's
const MorePanel = styled.div`
  ${glassPane}
  padding: 48px 40px 8px;

  @media (max-width: 1024px) {
    padding: 40px 24px 8px;
  }

  @media (max-width: 768px) {
    padding: 28px 16px 4px;
  }
`;

// Positioned so it sits above the glass's sheen, and padded in line with the rows' text
const MoreHeading = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0 16px;
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.md};

  @media (max-width: 768px) {
    padding: 0 4px;
  }

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

  /* On phones, inside the pane, the domain and the status stack so neither breaks mid-word */
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;

    ${MetaDot} {
      display: none;
    }
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

  &:last-child {
    border-bottom: none;
  }

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

// Each pane of glass rises into place as it comes into view
const paneReveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
} as const;

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

        <ThemeProvider theme={glassTheme}>
          <FeaturedStage {...paneReveal}>
            <LightField aria-hidden="true" />
            <FeaturedPanel>
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
          </FeaturedStage>

          <GlassStage {...paneReveal}>
            <MoreLightField aria-hidden="true" />
            <MorePanel>
              <MoreHeading>
                <span>Additional Projects</span>
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
            </MorePanel>
          </GlassStage>
        </ThemeProvider>
      </Container>
    </PortfolioWrapper>
  );
}

'use client';

import styled from 'styled-components';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { Section, Container } from '../layout/Container';
import GradientText from '../common/GradientText';
import { FiArrowUpRight } from 'react-icons/fi';
import { featured, projects } from '@/data/work';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';

const displayDomain = (url: string) => new URL(url).hostname.replace(/^www\./, '');
const pad = (n: number) => String(n).padStart(2, '0');

// Preview plate dimensions (desktop hover)
const PLATE_WIDTH = 320;
const PLATE_HEIGHT = 220;
const PLATE_OFFSET = 32;

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

/* ---------- Enso ring: the shared visual motif ---------- */

const EnsoSvg = styled.svg`
  display: block;
  color: ${({ theme }) => theme.colors.primary};
  overflow: visible;
`;

function Enso({ rotate = 0, className }: { rotate?: number; className?: string }) {
  return (
    <EnsoSvg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <circle
        cx="100"
        cy="100"
        r="80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="430 73"
        transform={`rotate(${rotate} 100 100)`}
      />
    </EnsoSvg>
  );
}

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

/* ---------- Project index ---------- */

const IndexHeading = styled.div`
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

const IndexList = styled.div`
  position: relative;
`;

const RowNumber = styled.span`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 0.95rem;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.6;
`;

const RowTitle = styled.span`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 2rem;
  font-weight: 300;
  color: ${({ theme }) => theme.colors.text};
  letter-spacing: 0.01em;
  transition: ${({ theme }) => theme.transitions.default};

  @media (max-width: 768px) {
    font-size: 1.35rem;
  }
`;

const RowCategory = styled.span`
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};

  @media (max-width: 768px) {
    display: none;
  }
`;

const RowDomain = styled.span`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 1024px) {
    display: none;
  }
`;

const RowMobileMeta = styled.span`
  display: none;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 6px;

  @media (max-width: 768px) {
    display: block;
  }
`;

const RowArrow = styled.span`
  display: inline-flex;
  justify-self: end;
  font-size: 1.4rem;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.35;
  transition: ${({ theme }) => theme.transitions.default};
`;

const Row = styled(motion.a)<{ $dimmed: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 240px 260px 32px;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: 28px 16px;
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

  &:hover ${RowTitle}, &:focus-visible ${RowTitle} {
    color: ${({ theme }) => theme.colors.primary};
    transform: translateX(12px);
  }

  &:hover ${RowArrow}, &:focus-visible ${RowArrow} {
    opacity: 1;
    transform: translate(3px, -3px);
  }

  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: -1px;
  }

  /* Dim the children, not the row: the reveal animation owns the row's opacity */
  > * {
    position: relative;
    opacity: ${({ $dimmed }) => ($dimmed ? 0.4 : 1)};
    transition: opacity 0.4s ease;
  }

  @media (max-width: 1024px) {
    grid-template-columns: 48px minmax(0, 1fr) 220px 32px;
  }

  @media (max-width: 768px) {
    grid-template-columns: 36px minmax(0, 1fr) 24px;
    gap: ${({ theme }) => theme.spacing.md};
    padding: 22px 4px;
  }
`;

const RowTitleBlock = styled.span`
  min-width: 0;
`;

/* ---------- Floating preview plate (desktop only) ---------- */

const Plate = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  width: ${PLATE_WIDTH}px;
  height: ${PLATE_HEIGHT}px;
  pointer-events: none;
  z-index: 5;

  @media (hover: none), (pointer: coarse), (max-width: 1024px) {
    display: none;
  }
`;

const PlateInner = styled(motion.div)<{ $gradient: string }>`
  position: absolute;
  inset: 0;
  border-radius: 18px;
  overflow: hidden;
  background: ${({ $gradient }) => $gradient};
  border: 1px solid rgba(200, 159, 129, 0.28);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.45), 0 0 40px rgba(200, 159, 129, 0.08);
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

const PlateEnso = styled(Enso)`
  position: absolute;
  width: 240px;
  height: 240px;
  right: -70px;
  top: -40px;
  opacity: 0.55;
`;

const PlateSeed = styled.span`
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  box-shadow: 0 0 18px rgba(200, 159, 129, 0.7);
`;

const PlateLabel = styled.span`
  position: relative;
  font-size: 0.66rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
`;

const PlateFooter = styled.div`
  position: relative;
`;

const PlateDescription = styled.p`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-style: italic;
  font-size: 1.15rem;
  line-height: 1.35;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 10px;
`;

const PlateDomain = styled.span`
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.85;
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
  const [hovered, setHovered] = useState<number | null>(null);
  const [canHover, setCanHover] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Plate follows the pointer with a soft spring; under reduced motion it
  // tracks the pointer directly, with no trailing inertia
  const reduce = useReducedMotionSafe();
  const plateX = useMotionValue(0);
  const plateY = useMotionValue(0);
  const springConfig = { damping: 28, stiffness: 220, mass: 0.6 };
  const springX = useSpring(plateX, springConfig);
  const springY = useSpring(plateY, springConfig);
  const x = reduce ? plateX : springX;
  const y = reduce ? plateY : springY;

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!listRef.current) return;
    const rect = listRef.current.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    // Sit to the right of the cursor, flipping left near the edge
    const fitsRight = localX + PLATE_OFFSET + PLATE_WIDTH < rect.width;
    plateX.set(fitsRight ? localX + PLATE_OFFSET : localX - PLATE_OFFSET - PLATE_WIDTH);
    plateY.set(localY - PLATE_HEIGHT / 2);
  };

  const active = hovered !== null ? projects[hovered] : null;

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

        <IndexHeading>
          <span>Index</span>
          <MetaDot />
          <span>{pad(projects.length)} Projects</span>
        </IndexHeading>

        <IndexList
          ref={listRef}
          onPointerMove={canHover ? handlePointerMove : undefined}
          onPointerLeave={() => setHovered(null)}
        >
          {projects.map((project, index) => (
            <Row
              key={project.id}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              $dimmed={canHover && hovered !== null && hovered !== index}
              onPointerEnter={() => setHovered(index)}
              custom={index}
              variants={reveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <RowNumber>{pad(index + 1)}</RowNumber>
              <RowTitleBlock>
                <RowTitle>{project.title}</RowTitle>
                <RowMobileMeta>{project.category}</RowMobileMeta>
              </RowTitleBlock>
              <RowCategory>{project.category}</RowCategory>
              <RowDomain>{displayDomain(project.url)}</RowDomain>
              <RowArrow>
                <FiArrowUpRight />
              </RowArrow>
              <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
            </Row>
          ))}

          <AnimatePresence>
            {canHover && active && (
              <Plate
                style={{ x, y }}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.25 }}
              >
                <AnimatePresence initial={false}>
                  <PlateInner
                    key={active.id}
                    $gradient={active.gradient}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <PlateEnso rotate={(hovered ?? 0) * 47} />
                    <PlateSeed
                      style={{
                        right: `${48 + ((hovered ?? 0) % 3) * 22}px`,
                        top: `${54 + ((hovered ?? 0) % 4) * 14}px`,
                      }}
                    />
                    <PlateLabel>{active.category}</PlateLabel>
                    <PlateFooter>
                      <PlateDescription>{active.description}</PlateDescription>
                      <PlateDomain>{displayDomain(active.url)} ↗</PlateDomain>
                    </PlateFooter>
                  </PlateInner>
                </AnimatePresence>
              </Plate>
            )}
          </AnimatePresence>
        </IndexList>
      </Container>
    </PortfolioWrapper>
  );
}

'use client';

import styled from 'styled-components';
import Link from 'next/link';
import { FiArrowUpRight } from 'react-icons/fi';
import MetaDot from '../common/MetaDot';
import type { ProjectSummary } from '@/lib/portal';
import { DUR } from '@/lib/motion';
import { formatDate, STAGE_LABELS } from './labels';
import {
  caps,
  ease,
  Eyebrow,
  Lead,
  Note,
  PageTitle,
  PortalPage,
  RuleHeading,
  STUDIO_EMAIL,
  TextLink,
  tint,
} from './ui';

const Rows = styled.ol`
  list-style: none;
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 14)};
`;

const Index = styled.span`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1rem;
  font-variant-numeric: lining-nums tabular-nums;
  color: ${({ theme }) => theme.colors.primary};
`;

const Name = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.75rem;
  font-weight: 400;
  line-height: 1.2;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  transition:
    color ${DUR.state}s ${ease},
    transform ${DUR.state}s ${ease};

  @media (max-width: 768px) {
    font-size: 1.4rem;
  }
`;

const Meta = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textSecondary};

  /* On a phone the items stack, so no dot is left hanging at the end of a line */
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;

    ${MetaDot} {
      display: none;
    }
  }
`;

const Stage = styled.span`
  ${caps}
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  color: ${({ theme }) => theme.colors.primary};
`;

const Arrow = styled.span`
  display: inline-flex;
  justify-self: end;
  font-size: 1.4rem;
  color: ${({ theme }) => theme.colors.primary};
  opacity: 0.4;
  transition:
    opacity ${DUR.state}s ${ease},
    transform ${DUR.state}s ${ease};
`;

const Row = styled(Link)`
  position: relative;
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) 2rem;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: 2rem 1rem;
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 14)};
  text-decoration: none;

  /* Bronze wash that sweeps in from the left, as on the work index */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, ${({ theme }) => tint(theme.colors.primary, 9)}, transparent 70%);
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 0.6s ${ease};
    pointer-events: none;
  }

  &:focus-visible::before {
    transform: scaleX(1);
  }

  &:focus-visible ${Name} {
    color: ${({ theme }) => theme.colors.primary};
    transform: translateX(0.5rem);
  }

  &:focus-visible ${Arrow} {
    opacity: 1;
    transform: translate(3px, -3px);
  }

  /* Touch screens keep :hover after a tap, so only devices that can hover get it */
  @media (hover: hover) {
    &:hover::before {
      transform: scaleX(1);
    }

    &:hover ${Name} {
      color: ${({ theme }) => theme.colors.primary};
      transform: translateX(0.5rem);
    }

    &:hover ${Arrow} {
      opacity: 1;
      transform: translate(3px, -3px);
    }
  }

  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: -1px;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1.75rem minmax(0, 1fr) 1.5rem;
    gap: ${({ theme }) => theme.spacing.md};
    padding: 1.5rem 0.25rem;
  }
`;

const Empty = styled.div`
  padding: ${({ theme }) => theme.spacing.xl} 0;
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 14)};
`;

interface ProjectListProps {
  firstName: string | null;
  isAdmin: boolean;
  projects: ProjectSummary[];
}

export default function ProjectList({ firstName, isAdmin, projects }: ProjectListProps) {
  return (
    <PortalPage>
      <Eyebrow>Client portal</Eyebrow>
      <PageTitle>
        {firstName ? (
          <>
            Welcome back, <em>{firstName}</em>
          </>
        ) : (
          <>
            Your <em>projects</em>
          </>
        )}
      </PageTitle>
      <Lead>Where each project stands, and what comes next. We keep this page current as the work moves.</Lead>

      <RuleHeading>{isAdmin ? 'All client projects' : 'Projects'}</RuleHeading>
      {projects.length === 0 ? (
        <Empty>
          <Note>
            Your project appears here once we have set it up. Questions in the meantime? Email{' '}
            <TextLink href={`mailto:${STUDIO_EMAIL}`}>{STUDIO_EMAIL}</TextLink>.
          </Note>
        </Empty>
      ) : (
        <Rows>
          {projects.map((project, i) => (
            <li key={project.id}>
              <Row href={`/portal/projects/${project.id}`}>
                <Index>{String(i + 1).padStart(2, '0')}</Index>
                <span>
                  <Name>{project.name}</Name>
                  <Meta>
                    <Stage>{STAGE_LABELS[project.stage]}</Stage>
                    {project.targetLaunch && (
                      <>
                        <MetaDot />
                        <span>Target launch {formatDate(project.targetLaunch)}</span>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <MetaDot />
                        <span>{project.clientEmail}</span>
                      </>
                    )}
                  </Meta>
                </span>
                <Arrow aria-hidden="true">
                  <FiArrowUpRight />
                </Arrow>
              </Row>
            </li>
          ))}
        </Rows>
      )}
    </PortalPage>
  );
}

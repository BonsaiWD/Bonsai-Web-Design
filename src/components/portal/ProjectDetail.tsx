'use client';

import styled from 'styled-components';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';
import BranchNode from '../common/BranchNode';
import MetaDot from '../common/MetaDot';
import type { MilestoneStatus } from '@/db/schema';
import type { ProjectView } from '@/lib/portal';
import { DUR } from '@/lib/motion';
import { formatDate, MILESTONE_LABELS, STAGE_LABELS, STAGE_SEQUENCE } from './labels';
import { caps, ease, Eyebrow, focusRing, Lead, Note, PortalPage, RuleHeading, tint, VisuallyHidden } from './ui';

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: color ${DUR.state}s ${ease};

  @media (hover: hover) {
    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  }

  ${focusRing}
`;

// Asymmetric split, as on the featured work panel
const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.xxl};

  @media (min-width: 1024px) {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  }
`;

// A single name, so the whole title may be italic
const Title = styled.h1`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-style: italic;
  font-size: 3.25rem;
  font-weight: 400;
  line-height: 1.05;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  @media (max-width: 768px) {
    font-size: 2.4rem;
  }
`;

const Facts = styled.dl`
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 14)};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const Fact = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0.875rem 0;
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 14)};

  dt {
    ${caps}
    font-size: 0.7rem;
    letter-spacing: 0.22em;
    color: ${({ theme }) => theme.colors.primary};
  }

  dd {
    font-size: 0.95rem;
    color: ${({ theme }) => theme.colors.text};
    text-align: right;
  }
`;

// Sized by its column, which is narrow on laptops and wide once the layout stacks
const TrackFrame = styled.div`
  container-type: inline-size;
`;

const Track = styled.ol`
  list-style: none;
  display: flex;
  gap: 0.375rem;
`;

const Step = styled.li<{ $state: 'done' | 'current' | 'next' }>`
  ${caps}
  flex: 1;
  min-width: 0;
  padding-top: 0.75rem;
  border-top: 1px solid
    ${({ $state, theme }) =>
      $state === 'current' ? theme.colors.primary : tint(theme.colors.primary, $state === 'done' ? 60 : 18)};
  /* A second line inside the border thickens the current step without moving its label */
  box-shadow: ${({ $state, theme }) => ($state === 'current' ? `inset 0 1px 0 ${theme.colors.primary}` : 'none')};
  font-size: 0.66rem;
  letter-spacing: 0.16em;
  color: ${({ $state, theme }) => ($state === 'current' ? theme.colors.primary : theme.colors.textSecondary)};
  opacity: ${({ $state }) => ($state === 'next' ? 0.75 : 1)};

  /* Five labels need about this much room ("Development" is the widest); below it the
     Stage fact above names the current one */
  @container (max-width: 33.75rem) {
    span {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  }
`;

/* ---------- Milestones on the branch line ---------- */

const NODE = 0.6875; // rem, the BranchNode's size
const ROW_PADDING = 1.375; // rem
const NODE_OFFSET = 0.5625; // rem: centres the node on the first line of the title

const Milestones = styled.ol`
  list-style: none;
`;

const MilestoneRow = styled.li<{ $done: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: ${NODE}rem minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${ROW_PADDING}rem 0;
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};

  &:last-child {
    border-bottom: none;
  }

  /* Branch segment down to the next node, which sits the same distance into its own row:
     stronger once this milestone is done */
  &:not(:last-child)::before {
    content: '';
    position: absolute;
    left: calc(${NODE / 2}rem - 0.5px);
    top: ${ROW_PADDING + NODE_OFFSET + NODE / 2}rem;
    /* 100% stops at the padding box; the extra pixel crosses the row's divider */
    height: calc(100% + 1px);
    width: 1px;
    background: ${({ $done, theme }) => tint(theme.colors.primary, $done ? 60 : 25)};
  }

  @media (max-width: 768px) {
    gap: ${({ theme }) => theme.spacing.md};
  }
`;

const Node = styled(BranchNode)<{ $status: MilestoneStatus }>`
  display: block;
  margin-top: ${NODE_OFFSET}rem;
  background: ${({ $status, theme }) => ($status === 'done' ? theme.colors.primary : theme.colors.background)};
  border-color: ${({ $status, theme }) =>
    $status === 'upcoming' ? tint(theme.colors.primary, 55) : theme.colors.primary};
`;

const MilestoneTitle = styled.h3`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.35rem;
  font-weight: 400;
  line-height: 1.3;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const MilestoneMeta = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 0;
`;

const Status = styled.span<{ $active: boolean }>`
  ${caps}
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
`;

const Description = styled.p`
  max-width: 35rem;
  font-size: 0.95rem;
  line-height: 1.7;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
`;

function stepState(stage: ProjectView['stage'], step: (typeof STAGE_SEQUENCE)[number]) {
  const current = STAGE_SEQUENCE.indexOf(stage);
  const index = STAGE_SEQUENCE.indexOf(step);
  if (index < current) return 'done';
  if (index === current) return 'current';
  return 'next';
}

interface ProjectDetailProps {
  project: ProjectView;
}

export default function ProjectDetail({ project }: ProjectDetailProps) {
  const { milestones } = project;
  const done = milestones.filter((m) => m.status === 'done').length;
  const waiting = milestones.filter((m) => m.status === 'waiting_on_client').length;
  const onHold = project.stage === 'on_hold';

  return (
    <PortalPage>
      <BackLink href="/portal">
        <FiArrowLeft aria-hidden="true" />
        All projects
      </BackLink>
      <Layout>
        <div>
          <Eyebrow>Project</Eyebrow>
          <Title>{project.name}</Title>
          {project.summary && <Lead>{project.summary}</Lead>}

          <Facts>
            <Fact>
              <dt>Stage</dt>
              <dd>{STAGE_LABELS[project.stage]}</dd>
            </Fact>
            {project.targetLaunch && (
              <Fact>
                <dt>Target launch</dt>
                <dd>{formatDate(project.targetLaunch)}</dd>
              </Fact>
            )}
            {milestones.length > 0 && (
              <Fact>
                <dt>Milestones</dt>
                <dd>
                  {done} of {milestones.length} done
                </dd>
              </Fact>
            )}
            {waiting > 0 && (
              <Fact>
                <dt>Waiting on you</dt>
                <dd>
                  {waiting} {waiting === 1 ? 'milestone' : 'milestones'}
                </dd>
              </Fact>
            )}
          </Facts>

          {onHold ? (
            <Note>Work is paused for now. This page updates when it resumes.</Note>
          ) : (
            <TrackFrame>
              <Track aria-label="Project stages">
                {STAGE_SEQUENCE.map((step) => {
                  const state = stepState(project.stage, step);
                  return (
                    <Step key={step} $state={state} aria-current={state === 'current' ? 'step' : undefined}>
                      <span>{STAGE_LABELS[step]}</span>
                      {state === 'done' && <VisuallyHidden>, complete</VisuallyHidden>}
                    </Step>
                  );
                })}
              </Track>
            </TrackFrame>
          )}
        </div>

        <section aria-labelledby="milestones-heading">
          <RuleHeading id="milestones-heading">Milestones</RuleHeading>
          {milestones.length === 0 ? (
            <Note>Milestones appear here once we have planned the project with you.</Note>
          ) : (
            <Milestones>
              {milestones.map((milestone) => (
                <MilestoneRow key={milestone.id} $done={milestone.status === 'done'}>
                  <Node $status={milestone.status} aria-hidden="true" />
                  <div>
                    <MilestoneTitle>{milestone.title}</MilestoneTitle>
                    <MilestoneMeta>
                      <Status $active={milestone.status === 'in_progress' || milestone.status === 'waiting_on_client'}>
                        {MILESTONE_LABELS[milestone.status]}
                      </Status>
                      {/* A due date stops mattering once the milestone is done */}
                      {milestone.dueDate && milestone.status !== 'done' && (
                        <>
                          <MetaDot />
                          <span>Due {formatDate(milestone.dueDate)}</span>
                        </>
                      )}
                    </MilestoneMeta>
                    {milestone.description && <Description>{milestone.description}</Description>}
                  </div>
                </MilestoneRow>
              ))}
            </Milestones>
          )}
        </section>
      </Layout>
    </PortalPage>
  );
}

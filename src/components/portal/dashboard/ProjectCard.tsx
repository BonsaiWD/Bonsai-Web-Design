'use client';

import Link from 'next/link';
import styled from 'styled-components';
import { FiArrowRight } from 'react-icons/fi';
import { plural } from '@/lib/portal-format';
import { MILESTONE_LABELS, STAGE_LABELS, STAGE_TONES } from '../labels';
import { projectHref } from '../tabs';
import { DateText, DueText, DURATION, ease, Eyebrow, focusRing, MetaLine, MetaText, panelStyles, space, StatusBadge, tint, type } from '../ui';
import { StageProgress } from './parts';
import type { ProjectCardView } from './types';

// Sized by its own width: a lone project gets the whole column, so its card goes two-up
const Frame = styled.div`
  container-type: inline-size;
  min-width: 0;
`;

const Card = styled.article`
  ${panelStyles}
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  min-width: 0;
  height: 100%;
  transition: border-color ${DURATION.hover}s ${ease};

  /* Footers line up when cards sit side by side */
  > footer {
    margin-top: auto;
  }

  @container (min-width: 38rem) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: ${space[8]};

    > footer {
      grid-column: 1 / -1;
    }
  }

  @media (hover: hover) {
    &:hover {
      border-color: ${({ theme }) => tint(theme.colors.primary, 40)};
    }

    &:hover h3 a {
      text-decoration: underline;
      text-decoration-color: ${({ theme }) => tint(theme.colors.primary, 45)};
      text-underline-offset: 0.2em;
    }
  }

  &:focus-within {
    border-color: ${({ theme }) => tint(theme.colors.primary, 55)};
  }
`;

const Head = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};

  h3 {
    ${type.h3}
    font-size: 1.25rem;
    overflow-wrap: anywhere;
  }

  /* The title's link covers the card, so the whole card opens the project */
  h3 a {
    color: inherit;
    text-decoration: none;
    ${focusRing}

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
  }
`;

const StageLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[2]} ${space[5]};
`;

const Next = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  padding-top: ${space[5]};
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};

  @container (min-width: 38rem) {
    padding: 0 0 0 ${space[8]};
    border-top: none;
    border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  }

  > p:nth-child(2) {
    ${type.label}
    font-size: 1rem;
    overflow-wrap: anywhere;
  }
`;

const Foot = styled.footer`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${space[2]} ${space[4]};

  > span:last-child {
    ${type.meta}
    display: inline-flex;
    align-items: center;
    gap: ${space[2]};
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 500;
  }
`;

const Needs = styled.span`
  ${type.figures}
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 500;
`;

// One of the client's projects: where it stands, what is next and what needs them
export function ProjectCard({ card, today }: { card: ProjectCardView; today: string }) {
  const next = card.nextMilestone;
  return (
    <Frame>
      <Card aria-labelledby={`project-card-${card.id}`}>
        <Head>
          <h3 id={`project-card-${card.id}`}>
            <Link href={projectHref(card.id)}>{card.name}</Link>
          </h3>
          <StageLine>
            <StatusBadge tone={STAGE_TONES[card.stage]}>{STAGE_LABELS[card.stage]}</StatusBadge>
            {card.targetLaunch && (
              <MetaText>
                {card.stage === 'launched' ? 'Launched' : 'Target launch'} <DateText value={card.targetLaunch} />
              </MetaText>
            )}
          </StageLine>
          <StageProgress stage={card.stage} />
        </Head>

        <Next>
          <Eyebrow>{next ? 'Next milestone' : 'Milestones'}</Eyebrow>
          {next ? (
            <>
              <p>{next.title}</p>
              <MetaLine>
                {MILESTONE_LABELS[next.status].client}
                {next.dueDate && <DueText value={next.dueDate} today={today} />}
              </MetaLine>
            </>
          ) : (
            <p>{card.milestones.total ? 'Every milestone is done.' : 'We are planning the steps with you.'}</p>
          )}
        </Next>

        <Foot>
          <MetaLine>
            {card.milestones.total > 0 && `${card.milestones.done} of ${plural(card.milestones.total, 'milestone')} done`}
            {card.needs > 0 && <Needs>{card.needs === 1 ? '1 thing needs you' : `${card.needs} things need you`}</Needs>}
          </MetaLine>
          <span aria-hidden="true">
            Open project
            <FiArrowRight />
          </span>
        </Foot>
      </Card>
    </Frame>
  );
}

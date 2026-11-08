'use client';

import styled from 'styled-components';
import { dueInfo, formatShortDate } from '@/lib/portal-format';
import { EmptyState, Eyebrow, H1, H2, LAPTOP, Lead, MetaText, space, Stack } from '../ui';
import { AttentionPanel, DeadlinePanel } from './parts';
import { ProjectCard } from './ProjectCard';
import type { AttentionItem, DeadlineItem, ProjectCardView } from './types';

const Intro = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  margin-bottom: ${space[10]};
`;

// The words carry the meaning; the colour only marks it as late
const Overdue = styled.span`
  color: ${({ theme }) => theme.colors.error};
`;

/*
 * Parts separated by the bronze dot, as in MetaLine: each part carries its dot in front, and
 * the row is pulled left by one slot inside a clipping box, so a wrapped line never starts or
 * ends on a dot.
 */
const DOT_SLOT = '1.75rem';

const SummaryClip = styled.div`
  overflow: hidden;
`;

const SummaryLine = styled(Lead)`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  row-gap: ${space[1]};
  max-width: none;
  margin-left: -${DOT_SLOT};

  > span {
    position: relative;
    padding-left: ${DOT_SLOT};
  }

  > span::before {
    content: '';
    position: absolute;
    left: calc(${DOT_SLOT} / 2 - 2px);
    top: 50%;
    width: 4px;
    height: 4px;
    margin-top: -2px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
    opacity: 0.6;
  }
`;

/*
 * Attention, then deadlines, then projects: the order a phone reads them in. On laptops the
 * deadlines sit in an aside beside both; the second row takes any extra height, so the
 * projects start right under the attention list.
 */
const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'attention' 'deadlines' 'projects';
  gap: ${space[8]};

  @media (min-width: ${LAPTOP}) {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'attention deadlines'
      'projects deadlines';
    column-gap: ${space[10]};
    align-items: start;
  }
`;

const Area = styled.div<{ $area: string }>`
  grid-area: ${({ $area }) => $area};
  min-width: 0;
`;

const Cards = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${space[5]};

  @media (min-width: 640px) {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  }
`;

interface ClientDashboardProps {
  firstName: string | null;
  // The client's company, or what a preview shows
  eyebrow: string | null;
  today: string;
  attention: AttentionItem[];
  deadlines: DeadlineItem[];
  projects: ProjectCardView[];
}

export default function ClientDashboard({ firstName, eyebrow, today, attention, deadlines, projects }: ClientDashboardProps) {
  const open = attention.filter((item) => item.tone !== 'info');
  // The client's own late dates come first in the headline; the next date prefers theirs too
  const overdue = deadlines.filter((item) => item.owner === 'client' && item.date < today);
  const upcoming = deadlines.find((item) => item.date >= today && item.owner === 'client') ?? deadlines.find((item) => item.date >= today);
  const many = projects.length > 1;
  const greeting = firstName ? `Welcome back, ${firstName}` : 'Welcome back';

  if (projects.length === 0) {
    return (
      <Stack $gap={8}>
        <Intro>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <H1>{greeting}</H1>
        </Intro>
        <EmptyState title="Your project will appear here">
          We&apos;re setting it up now. You&apos;ll see each step, what we share for review and our messages here, and we&apos;ll email you
          when something needs you.
        </EmptyState>
      </Stack>
    );
  }

  return (
    <>
      <Intro>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <H1>{greeting}</H1>
        <SummaryClip>
          <SummaryLine>
            <span>
              {open.length === 0 ? 'Nothing needs you right now' : open.length === 1 ? '1 thing needs you' : `${open.length} things need you`}
            </span>
            {overdue.length > 0 && (
              <Overdue>
                {overdue.length === 1 ? `${overdue[0].title} is ${dueInfo(overdue[0].date, today).label}` : `${overdue.length} deadlines have passed`}
              </Overdue>
            )}
            {upcoming && (
              <span>
                next deadline <time dateTime={upcoming.date}>{formatShortDate(upcoming.date)}</time>
              </span>
            )}
          </SummaryLine>
        </SummaryClip>
      </Intro>

      <Grid>
        <Area $area="attention">
          <AttentionPanel
            id="dashboard-attention"
            title="Needs your attention"
            items={attention}
            today={today}
            showProject={many}
            calm={{ title: "You're all caught up.", text: "We'll email you when something needs you." }}
          />
        </Area>

        <Area $area="deadlines">
          <DeadlinePanel
            id="dashboard-deadlines"
            title="Upcoming deadlines"
            items={deadlines}
            today={today}
            perspective="client"
            showProject={many}
            empty="No dates are set yet. They appear here as we plan each step."
          />
        </Area>

        <Area $area="projects">
          <Stack as="section" aria-labelledby="dashboard-projects" $gap={5}>
            <div>
              <H2 id="dashboard-projects">{many ? 'Your projects' : 'Your project'}</H2>
              {many && <MetaText>{projects.length} projects</MetaText>}
            </div>
            <Cards>
              {projects.map((card) => (
                <ProjectCard key={card.id} card={card} today={today} />
              ))}
            </Cards>
          </Stack>
        </Area>
      </Grid>
    </>
  );
}

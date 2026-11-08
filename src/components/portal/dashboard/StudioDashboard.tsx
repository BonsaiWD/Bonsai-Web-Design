'use client';

import Link from 'next/link';
import styled from 'styled-components';
import { FiPlus, FiUserPlus } from 'react-icons/fi';
import { firstName, plural } from '@/lib/portal-format';
import { projectHref } from '../tabs';
import {
  ButtonLink,
  Cluster,
  DueText,
  EmptyState,
  Eyebrow,
  focusRing,
  H1,
  ListPanel,
  Notice,
  PHONE,
  Panel,
  space,
  Split,
  Stack,
  tint,
  type,
} from '../ui';
import { ActivityPanel, AttentionPanel, DeadlinePanel, MetaLine, PanelTitle, sinceLabel, ToneMarker } from './parts';
import { ProjectsTable } from './ProjectsTable';
import type { ActivityView, AttentionItem, DeadlineItem, ProjectCardView, StudioStats } from './types';

const Intro = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${space[5]} ${space[8]};
  margin-bottom: ${space[8]};

  > div:first-child {
    display: flex;
    flex-direction: column;
    gap: ${space[3]};
  }

  @media (max-width: ${PHONE}) {
    > div:last-child,
    > div:last-child a {
      width: 100%;
    }
  }
`;

/* ---------- Stats ---------- */

const Tiles = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;

  @media (min-width: ${PHONE}) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const Tile = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  min-width: 0;
  padding: ${space[4]} ${space[5]};

  /* Hairlines between tiles: a 2 by 2 grid on phones, one row from 768px */
  &:nth-child(even) {
    border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  }

  &:nth-child(n + 3) {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  }

  @media (min-width: ${PHONE}) {
    padding: 0 ${space[6]};

    &:first-child {
      padding-left: 0;
    }

    &:last-child {
      padding-right: 0;
    }

    & + & {
      border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
    }

    &:nth-child(n + 3) {
      border-top: none;
    }
  }

  dt {
    ${type.meta}
    order: 2;
  }

  dd {
    ${type.h2}
    ${type.figures}
    order: 1;
    margin: 0;
    font-size: 2rem;
    font-weight: 500;
    line-height: 1.1;
  }

  /* The quiet line under each figure */
  dd + dd {
    ${type.meta}
    order: 3;
    font-size: 0.8125rem;
    font-weight: 400;
    line-height: 1.4;
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const StatsPanel = styled(Panel)`
  @media (max-width: ${PHONE}) {
    padding: 0;
  }
`;

// Doubled class: the tile's own dd rule sets the figure colour
const AlertFigure = styled.dd<{ $alert: boolean }>`
  && {
    color: ${({ $alert, theme }) => ($alert ? theme.colors.error : theme.colors.text)};
  }
`;

// "Sunday, Nov 8": today is a UTC calendar day, so it is formatted in UTC
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });

function Stats({ stats }: { stats: StudioStats }) {
  return (
    <StatsPanel aria-label="Studio at a glance">
      <Tiles>
        <Tile>
          <dt>Active projects</dt>
          <dd>{stats.activeProjects}</dd>
          <dd>of {plural(stats.totalProjects, 'project')}</dd>
        </Tile>
        <Tile>
          <dt>Waiting on clients</dt>
          <dd>{stats.waitingOnClients}</dd>
          <dd>{stats.clientsWaitedOn ? `across ${plural(stats.clientsWaitedOn, 'project')}` : 'nothing with clients'}</dd>
        </Tile>
        <Tile>
          <dt>Waiting on us</dt>
          <dd>{stats.waitingOnUs}</dd>
          <dd>{stats.waitingOnUs ? 'listed below' : 'all clear'}</dd>
        </Tile>
        <Tile>
          <dt>Overdue</dt>
          <AlertFigure $alert={stats.overdue > 0}>{stats.overdue}</AlertFigure>
          <dd>{stats.overdue === 1 ? 'deadline passed' : 'deadlines passed'}</dd>
        </Tile>
      </Tiles>
    </StatsPanel>
  );
}

/* ---------- Waiting on clients ---------- */

const Groups = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;

  > li + li {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }
`;

const Group = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  padding: ${space[4]} ${space[6]} ${space[5]};

  h3 {
    ${type.label}
    font-family: ${({ theme }) => theme.fonts.main};
    overflow-wrap: anywhere;
  }

  @media (max-width: ${PHONE}) {
    padding: ${space[4]} ${space[5]} ${space[5]};
  }
`;

const ProjectLink = styled(Link)`
  ${type.meta}
  color: ${({ theme }) => theme.colors.textSecondary};
  text-decoration: none;
  ${focusRing}

  @media (hover: hover) {
    &:hover {
      color: ${({ theme }) => theme.colors.text};
      text-decoration: underline;
      text-decoration-color: ${({ theme }) => tint(theme.colors.primary, 45)};
      text-underline-offset: 0.2em;
    }
  }
`;

const Waits = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${space[3]};

  li {
    display: flex;
    align-items: flex-start;
    gap: ${space[3]};
  }

  li > div {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    min-width: 0;
  }

  a {
    ${type.body}
    color: ${({ theme }) => theme.colors.text};
    text-decoration: none;
    overflow-wrap: anywhere;
    ${focusRing}

    @media (hover: hover) {
      &:hover {
        text-decoration: underline;
        text-decoration-color: ${({ theme }) => tint(theme.colors.primary, 45)};
        text-underline-offset: 0.2em;
      }
    }
  }
`;

const Calm = styled.p`
  ${type.meta}
  padding: ${space[5]} ${space[6]};

  @media (max-width: ${PHONE}) {
    padding: ${space[5]};
  }
`;

interface WaitGroup {
  projectId: string;
  projectName: string;
  clientName: string;
  items: AttentionItem[];
}

function groupWaits(items: AttentionItem[], projects: ProjectCardView[]): WaitGroup[] {
  const groups = new Map<string, WaitGroup>();
  for (const item of items) {
    const card = projects.find((candidate) => candidate.id === item.projectId);
    const group = groups.get(item.projectId) ?? {
      projectId: item.projectId,
      projectName: item.projectName,
      clientName: card?.client.name ?? 'Client',
      items: [],
    };
    group.items.push(item);
    groups.set(item.projectId, group);
  }
  // The client waited on longest first
  const oldest = (group: WaitGroup) => group.items.map((item) => item.since ?? '9999').sort()[0];
  return [...groups.values()].sort((a, b) => (oldest(a) < oldest(b) ? -1 : 1));
}

// Each client's own to-do list, worded as they see it, with how long it has waited
function WaitingOnClients({ items, projects, today }: { items: AttentionItem[]; projects: ProjectCardView[]; today: string }) {
  const groups = groupWaits(items, projects);
  return (
    <ListPanel aria-labelledby="dashboard-waiting">
      <PanelTitle
        id="dashboard-waiting"
        title="Waiting on clients"
        note={items.length ? 'Their to-do lists, as they see them' : undefined}
      />
      {groups.length === 0 ? (
        <Calm>Nothing is waiting on a client right now.</Calm>
      ) : (
        <Groups>
          {groups.map((group) => (
            <Group key={group.projectId}>
              <div>
                <h3>{group.clientName}</h3>
                <ProjectLink href={projectHref(group.projectId)}>{group.projectName}</ProjectLink>
              </div>
              <Waits aria-label={`Waiting on ${firstName(group.clientName) ?? group.clientName}`}>
                {group.items.map((item) => (
                  <li key={item.key}>
                    <ToneMarker tone={item.tone} />
                    <div>
                      <Link href={projectHref(item.projectId, item.tab, item.anchor)}>{item.title}</Link>
                      <MetaLine>
                        {item.since && sinceLabel(item.since, today, true)}
                        {item.due && <DueText value={item.due} today={today} />}
                      </MetaLine>
                    </div>
                  </li>
                ))}
              </Waits>
            </Group>
          ))}
        </Groups>
      )}
    </ListPanel>
  );
}

/* ---------- The dashboard ---------- */

interface StudioDashboardProps {
  today: string;
  stats: StudioStats;
  attention: AttentionItem[];
  waiting: AttentionItem[];
  deadlines: DeadlineItem[];
  projects: ProjectCardView[];
  activity: ActivityView[];
  hasClients: boolean;
  deleted: boolean;
}

export default function StudioDashboard({
  today,
  stats,
  attention,
  waiting,
  deadlines,
  projects,
  activity,
  hasClients,
  deleted,
}: StudioDashboardProps) {
  return (
    <>
      <Intro>
        <div>
          <Eyebrow>
            <time dateTime={today}>{dayFormat.format(new Date(`${today}T00:00:00Z`))}</time>
          </Eyebrow>
          <H1>Studio overview</H1>
        </div>
        <Cluster>
          <ButtonLink href="/portal/admin/projects/new">
            <FiPlus aria-hidden="true" />
            New project
          </ButtonLink>
          <ButtonLink href="/portal/admin/clients?add=1" $variant="secondary">
            <FiUserPlus aria-hidden="true" />
            Add client
          </ButtonLink>
        </Cluster>
      </Intro>

      <Stack $gap={8}>
        {deleted && (
          <Notice>
            <p>The project was deleted, along with everything in it.</p>
          </Notice>
        )}

        {projects.length === 0 ? (
          <EmptyState
            title={hasClients ? 'Start your first project' : 'Add your first client'}
            action={
              <ButtonLink href={hasClients ? '/portal/admin/projects/new' : '/portal/admin/clients?add=1'}>
                {hasClients ? 'New project' : 'Add client'}
              </ButtonLink>
            }
          >
            {hasClients
              ? 'Create a project for a client, then plan its milestones. They see it as soon as it exists.'
              : 'Clients sign in with their email address. Add one, send the invite, then create their project.'}
          </EmptyState>
        ) : (
          <>
            <Stats stats={stats} />

            <Split>
              <AttentionPanel
                id="dashboard-attention"
                title="Needs your attention"
                items={attention}
                today={today}
                showProject
                calm={{
                  title: 'Nothing needs the studio right now.',
                  text: 'Overdue steps, change requests and failed emails show up here.',
                }}
              />
              <WaitingOnClients items={waiting} projects={projects} today={today} />
            </Split>

            <ProjectsTable projects={projects} today={today} />

            <Split>
              <ActivityPanel
                id="dashboard-activity"
                title="Recent activity"
                items={activity}
                perspective="studio"
                showProject
                empty="Nothing has happened yet. Changes, decisions and emails are logged here."
                note="Across every project, studio-only entries included"
              />
              <DeadlinePanel
                id="dashboard-deadlines"
                title="Upcoming deadlines"
                items={deadlines}
                today={today}
                perspective="studio"
                showProject
                empty="No open dates. Add due dates to milestones to see them here."
              />
            </Split>
          </>
        )}
      </Stack>
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styled from 'styled-components';
import { FiChevronRight, FiSettings } from 'react-icons/fi';
import type { ProjectStage } from '@/db/schema';
import { formatDate } from '@/lib/portal-format';
import { STAGE_LABELS, STAGE_SEQUENCE, STAGE_TONES } from './labels';
import { PROJECT_TABS, projectHref, type ProjectTab } from './tabs';
import { ButtonLink, CountBadge, focusRing, H1, MetaText, PHONE, space, StatusBadge, tint, type, VisuallyHidden } from './ui';

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  margin-bottom: ${space[8]};
`;

const Crumbs = styled.nav`
  ${type.meta}

  ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space[1]};
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: ${space[1]};
  }

  a {
    color: ${({ theme }) => theme.colors.textSecondary};
    ${focusRing}

    @media (hover: hover) {
      &:hover {
        color: ${({ theme }) => theme.colors.text};
      }
    }
  }

  svg {
    color: ${({ theme }) => tint(theme.colors.textSecondary, 70)};
  }
`;

const TitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space[4]} ${space[6]};

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[3]};
    min-width: 0;
  }

  h1 {
    overflow-wrap: anywhere;
  }
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[2]} ${space[5]};
`;

/* ---------- Stage track ---------- */

const TrackFrame = styled.div`
  container-type: inline-size;
`;

const Track = styled.ol`
  display: grid;
  grid-template-columns: repeat(${STAGE_SEQUENCE.length}, minmax(0, 1fr));
  gap: ${space[2]};
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Step = styled.li<{ $state: 'done' | 'current' | 'next' }>`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  min-width: 0;

  &::before {
    content: '';
    height: 3px;
    background: ${({ $state, theme }) =>
      $state === 'current' ? theme.colors.primary : $state === 'done' ? tint(theme.colors.primary, 55) : tint(theme.colors.primary, 16)};
  }

  span {
    font-size: 0.875rem;
    font-weight: ${({ $state }) => ($state === 'current' ? 600 : 400)};
    color: ${({ $state, theme }) => ($state === 'current' ? theme.colors.text : theme.colors.textSecondary)};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Five labels need room; on narrow screens only the current stage keeps its label */
  @container (max-width: 30rem) {
    span {
      ${({ $state }) => ($state === 'current' ? '' : 'visibility: hidden;')}
      overflow: visible;
    }
  }
`;

/* ---------- Tabs ---------- */

const TabBar = styled.nav`
  position: relative;
  margin: 0 -${space[2]};
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 14)};
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  ul {
    display: flex;
    gap: ${space[1]};
    margin: 0;
    padding: 0 ${space[2]};
    list-style: none;
  }

  @media (max-width: ${PHONE}) {
    margin: 0 -${space[4]};

    ul {
      padding: 0 ${space[3]};
    }
  }
`;

const Tab = styled(Link)<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${space[2]};
  min-height: 3rem;
  padding: 0 ${space[3]};
  font-size: 0.9375rem;
  font-weight: 500;
  white-space: nowrap;
  color: ${({ $active, theme }) => ($active ? theme.colors.text : theme.colors.textSecondary)};
  box-shadow: inset 0 -2px 0 ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  transition: color 0.2s;
  ${focusRing}

  &:focus-visible {
    outline-offset: -2px;
  }

  @media (hover: hover) {
    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  }
`;

export interface ProjectHeaderProps {
  project: {
    id: string;
    name: string;
    stage: ProjectStage;
    targetLaunch: string | null;
    clientName: string;
    clientEmail: string;
    clientCompany: string | null;
  };
  showStudio: boolean;
  // How many things need the viewer on each tab
  badges: Partial<Record<ProjectTab, number>>;
}

export default function ProjectHeader({ project, showStudio, badges }: ProjectHeaderProps) {
  const pathname = usePathname();
  const base = projectHref(project.id);
  const currentIndex = STAGE_SEQUENCE.indexOf(project.stage);
  const clientLabel = [project.clientName || project.clientEmail, project.clientCompany].filter(Boolean).join(' · ');

  return (
    <Header>
      <Crumbs aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/portal">{showStudio ? 'Overview' : 'Projects'}</Link>
            <FiChevronRight aria-hidden="true" />
          </li>
          <li aria-current="page">{project.name}</li>
        </ol>
      </Crumbs>

      <TitleRow>
        <div>
          <H1>{project.name}</H1>
          <MetaRow>
            <StatusBadge tone={STAGE_TONES[project.stage]}>{STAGE_LABELS[project.stage]}</StatusBadge>
            {project.targetLaunch && <MetaText>Target launch {formatDate(project.targetLaunch)}</MetaText>}
            {showStudio && <MetaText>Client: {clientLabel}</MetaText>}
          </MetaRow>
        </div>
        {showStudio && (
          <ButtonLink href={`${base}/settings`} $variant="secondary" $size="sm">
            <FiSettings aria-hidden="true" />
            Project settings
          </ButtonLink>
        )}
      </TitleRow>

      {project.stage !== 'on_hold' && (
        <TrackFrame>
          <Track aria-label="Project stages">
            {STAGE_SEQUENCE.map((stage, index) => {
              const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'next';
              return (
                <Step key={stage} $state={state} aria-current={state === 'current' ? 'step' : undefined}>
                  <span>{STAGE_LABELS[stage]}</span>
                  {state === 'done' && <VisuallyHidden>, complete</VisuallyHidden>}
                </Step>
              );
            })}
          </Track>
        </TrackFrame>
      )}

      <TabBar aria-label="Project sections">
        <ul>
          {PROJECT_TABS.map((tab) => {
            const href = `${base}${tab.path}`;
            const active = tab.key === 'overview' ? pathname === base : pathname.startsWith(href);
            const count = badges[tab.key] ?? 0;
            return (
              <li key={tab.key}>
                <Tab href={href} $active={active} aria-current={active ? 'page' : undefined}>
                  {tab.label}
                  {count > 0 && (
                    <>
                      <CountBadge aria-hidden="true">{count}</CountBadge>
                      <VisuallyHidden>
                        , {count} {count === 1 ? 'item needs' : 'items need'} attention
                      </VisuallyHidden>
                    </>
                  )}
                </Tab>
              </li>
            );
          })}
        </ul>
      </TabBar>
    </Header>
  );
}

'use client';

import Link from 'next/link';
import { Children, type ReactNode } from 'react';
import styled, { css } from 'styled-components';
import { FiAlertCircle, FiArrowRight, FiCheck } from 'react-icons/fi';
import BranchNode from '@/components/common/BranchNode';
import type { ProjectStage } from '@/db/schema';
import { daysBetween, plural } from '@/lib/portal-format';
import { STAGE_LABELS, STAGE_SEQUENCE } from '../labels';
import { projectHref } from '../tabs';
import {
  DateChip,
  DateText,
  DueText,
  DURATION,
  ease,
  focusRing,
  H2,
  ListPanel,
  LocalTime,
  MetaText,
  PanelHeader,
  PHONE,
  Rows,
  space,
  StatusBadge,
  tint,
  type,
  VisuallyHidden,
} from '../ui';
import type { ActivityView, AttentionItem, DeadlineItem, Perspective } from './types';

/* ---------- Small pieces ---------- */

/*
 * Meta items separated by the bronze dot, as everywhere on the site. Each item carries its
 * dot in front of it, and the row is pulled left by one dot's width inside a clipping box,
 * so the item that starts a line hides its dot: a wrapped line never begins or ends on one.
 */
const META_SLOT = '1rem';

const MetaClip = styled.div`
  overflow: hidden;
  min-width: 0;
`;

const MetaRow = styled.div`
  ${type.meta}
  ${type.figures}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  row-gap: ${space[1]};
  margin-left: -${META_SLOT};

  > span {
    position: relative;
    display: inline-flex;
    align-items: center;
    padding-left: ${META_SLOT};
    min-width: 0;
    overflow-wrap: anywhere;
  }

  > span::before {
    content: '';
    position: absolute;
    left: calc(${META_SLOT} / 2 - 2px);
    top: 50%;
    width: 4px;
    height: 4px;
    margin-top: -2px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
    opacity: 0.6;
  }
`;

export function MetaLine({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <MetaClip>
      <MetaRow>
        {items.map((item, index) => (
          <span key={index}>{item}</span>
        ))}
      </MetaRow>
    </MetaClip>
  );
}

// A heading row inside a list panel: title and a quiet count or note
export function PanelTitle({ id, title, note, action }: { id: string; title: string; note?: ReactNode; action?: ReactNode }) {
  return (
    <PanelHeader>
      <HeaderText>
        <H2 id={id}>{title}</H2>
        {note && <MetaText>{note}</MetaText>}
      </HeaderText>
      {action}
    </PanelHeader>
  );
}

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  min-width: 0;
`;

// "Waiting 3 days", "Yesterday": how long an item has been open, in calendar days. An open
// item says "Waiting", so it can't be read as a due date next to "3 days overdue".
export function sinceLabel(since: string, today: string, waiting: boolean): string {
  const days = Math.max(0, daysBetween(since.slice(0, 10), today));
  if (waiting) return days === 0 ? 'Waiting since today' : `Waiting ${plural(days, 'day')}`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

const TONE_WORDS = { alert: 'Urgent', action: 'To do', info: 'Update' } as const;

// Where an item opens: its own page when it has one (an invoice), else the tab and anchor
export function itemHref(item: Pick<AttentionItem, 'projectId' | 'tab' | 'anchor' | 'href'>): string {
  return item.href ?? projectHref(item.projectId, item.tab, item.anchor);
}

const Dot = styled.span<{ $tone: 'action' | 'info' }>`
  display: block;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;

  ${({ $tone, theme }) =>
    $tone === 'action'
      ? css`
          background: ${theme.colors.primary};
          box-shadow: 0 0 0 3px ${tint(theme.colors.primary, 20)};
        `
      : css`
          border: 1.5px solid ${tint(theme.colors.textSecondary, 70)};
        `}
`;

const MarkerBox = styled.span<{ $tone: AttentionItem['tone'] }>`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.6em;
  font-size: 1.05rem;
  color: ${({ $tone, theme }) => ($tone === 'alert' ? theme.colors.error : theme.colors.primary)};
`;

// The same shapes as StatusBadge, so tone never rests on colour alone
export function ToneMarker({ tone }: { tone: AttentionItem['tone'] }) {
  return (
    <MarkerBox $tone={tone} aria-hidden="true">
      {tone === 'alert' ? <FiAlertCircle /> : <Dot $tone={tone} />}
    </MarkerBox>
  );
}

// A link that makes its whole row the target, while only its own text is announced
const RowLink = styled(Link)`
  ${type.label}
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.text};
  text-decoration: none;
  overflow-wrap: anywhere;
  ${focusRing}

  &::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  &:focus-visible {
    outline-offset: 2px;
  }
`;

const LinkRow = styled.li`
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: ${space[4]};
  padding: ${space[4]} ${space[6]};
  transition: background-color ${DURATION.hover}s ${ease};

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    flex: 1;
    min-width: 0;
  }

  > svg {
    flex-shrink: 0;
    margin-top: 0.3rem;
    color: ${({ theme }) => tint(theme.colors.primary, 70)};
    transition: transform ${DURATION.hover}s ${ease};
  }

  @media (hover: hover) {
    &:hover {
      background: ${({ theme }) => tint(theme.colors.primary, 5)};
    }

    &:hover ${RowLink} {
      text-decoration: underline;
      text-decoration-color: ${({ theme }) => tint(theme.colors.primary, 45)};
      text-underline-offset: 0.2em;
    }

    &:hover > svg {
      transform: translateX(2px);
    }
  }

  @media (max-width: ${PHONE}) {
    padding: ${space[4]} ${space[5]};
    gap: ${space[3]};
  }

  @media (prefers-reduced-motion: reduce) {
    > svg {
      transition: none;
    }
  }
`;

const Detail = styled.p`
  ${type.meta}
  color: ${({ theme }) => theme.colors.textSecondary};
  max-width: 60ch;
  overflow-wrap: anywhere;
`;

const SubHeading = styled.h3`
  ${type.overline}
  font-family: ${({ theme }) => theme.fonts.main};
  padding: ${space[4]} ${space[6]} ${space[2]};
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  color: ${({ theme }) => theme.colors.textSecondary};

  @media (max-width: ${PHONE}) {
    padding: ${space[4]} ${space[5]} ${space[2]};
  }
`;

/* ---------- Attention ---------- */

function AttentionRows({ items, today, showProject }: { items: AttentionItem[]; today: string; showProject: boolean }) {
  return (
    <Rows>
      {items.map((item) => (
        <LinkRow key={item.key}>
          <ToneMarker tone={item.tone} />
          <div>
            <RowLink href={itemHref(item)}>
              <VisuallyHidden>{TONE_WORDS[item.tone]}: </VisuallyHidden>
              {item.title}
            </RowLink>
            {item.detail && <Detail>{item.detail}</Detail>}
            <MetaLine>
              {showProject && item.projectName}
              {item.due && <DueText value={item.due} today={today} />}
              {item.since && sinceLabel(item.since, today, item.tone !== 'info')}
            </MetaLine>
          </div>
          <FiArrowRight aria-hidden="true" />
        </LinkRow>
      ))}
    </Rows>
  );
}

const CaughtUpRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${space[3]};
  padding: ${space[6]};
  ${type.body}
  color: ${({ theme }) => theme.colors.text};

  svg {
    flex-shrink: 0;
    margin-top: 0.25em;
    color: ${({ theme }) => theme.colors.primary};
  }

  p {
    margin: 0;
  }

  p + p {
    ${type.meta}
    margin-top: ${space[1]};
  }

  @media (max-width: ${PHONE}) {
    padding: ${space[5]};
  }
`;

interface AttentionPanelProps {
  id: string;
  title: string;
  items: AttentionItem[];
  today: string;
  showProject: boolean;
  // Shown when nothing needs the reader
  calm: { title: string; text?: string };
  note?: ReactNode;
  // Heading for studio follow-ups that are waiting on the client
  followUpTitle?: string;
}

// Things to act on first, then follow-ups that wait on the client, then a quieter list of news
export function AttentionPanel({ id, title, items, today, showProject, calm, note, followUpTitle = 'To follow up with clients' }: AttentionPanelProps) {
  // Counted with the client's to-do list, not as work for the reader
  const followUps = items.filter((item) => item.tone !== 'info' && item.blockedOn === 'client');
  const open = items.filter((item) => item.tone !== 'info' && item.blockedOn !== 'client');
  const news = items.filter((item) => item.tone === 'info');
  return (
    <ListPanel aria-labelledby={id}>
      <PanelTitle id={id} title={title} note={note ?? (open.length ? plural(open.length, 'thing') : undefined)} />
      {open.length > 0 ? (
        <AttentionRows items={open} today={today} showProject={showProject} />
      ) : (
        <CaughtUpRow>
          <FiCheck aria-hidden="true" />
          <div>
            <p>{calm.title}</p>
            {calm.text && <p>{calm.text}</p>}
          </div>
        </CaughtUpRow>
      )}
      {followUps.length > 0 && (
        <>
          <SubHeading>{followUpTitle}</SubHeading>
          <AttentionRows items={followUps} today={today} showProject={showProject} />
        </>
      )}
      {news.length > 0 && (
        <>
          <SubHeading>Recent updates</SubHeading>
          <AttentionRows items={news} today={today} showProject={showProject} />
        </>
      )}
    </ListPanel>
  );
}

/* ---------- Deadlines ---------- */

const DeadlineRow = styled(LinkRow)`
  align-items: center;

  > svg {
    margin-top: 0;
  }
`;

const EmptyNote = styled.p`
  ${type.meta}
  padding: ${space[5]} ${space[6]};

  @media (max-width: ${PHONE}) {
    padding: ${space[5]};
  }
`;

interface DeadlinePanelProps {
  id: string;
  title: string;
  items: DeadlineItem[];
  today: string;
  perspective: Perspective;
  showProject: boolean;
  limit?: number;
  empty: string;
  clientFirst?: string;
}

function ownerNote(item: DeadlineItem, perspective: Perspective, clientFirst?: string): string | null {
  if (item.owner !== 'client') return null;
  return perspective === 'client' ? 'For you' : `With ${clientFirst ?? 'the client'}`;
}

// Calendar tiles, soonest first; anything overdue is already at the top
export function DeadlinePanel({ id, title, items, today, perspective, showProject, limit = 6, empty, clientFirst }: DeadlinePanelProps) {
  const shown = items.slice(0, limit);
  const overdue = items.filter((item) => item.date < today).length;
  const note = overdue ? `${overdue} overdue` : items.length > shown.length ? `Next ${shown.length} of ${items.length}` : undefined;
  return (
    <ListPanel aria-labelledby={id}>
      <PanelTitle id={id} title={title} note={note} />
      {shown.length === 0 ? (
        <EmptyNote>{empty}</EmptyNote>
      ) : (
        <Rows>
          {shown.map((item) => (
            <DeadlineRow key={item.key}>
              <DateChip value={item.date} overdue={item.date < today} />
              <div>
                <RowLink href={itemHref(item)}>
                  <VisuallyHidden>
                    <DateText value={item.date} />:{' '}
                  </VisuallyHidden>
                  {item.title}
                </RowLink>
                <MetaLine>
                  <DueText value={item.date} today={today} />
                  {ownerNote(item, perspective, clientFirst)}
                </MetaLine>
                {showProject && <MetaText>{item.projectName}</MetaText>}
              </div>
              <FiArrowRight aria-hidden="true" />
            </DeadlineRow>
          ))}
        </Rows>
      )}
    </ListPanel>
  );
}

/* ---------- Activity ----------
   The bronze branch line again: each entry is a node, newest at the top. */

const NODE = 0.6875; // rem: BranchNode's size

const Feed = styled.ol`
  list-style: none;
  margin: 0;
  padding: ${space[2]} 0;
`;

const FeedItem = styled.li`
  position: relative;
  display: grid;
  grid-template-columns: ${NODE}rem minmax(0, 1fr);
  gap: ${space[4]};
  padding: ${space[3]} ${space[6]};

  /* The line from this node down to the next one */
  &:not(:last-child)::before {
    content: '';
    position: absolute;
    left: calc(${space[6]} + ${NODE / 2}rem - 0.5px);
    top: calc(${space[3]} + 0.45rem + ${NODE / 2}rem);
    height: 100%;
    width: 1px;
    background: ${({ theme }) => tint(theme.colors.primary, 25)};
  }

  > span {
    margin-top: 0.45rem;
  }

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    min-width: 0;
  }

  @media (max-width: ${PHONE}) {
    padding: ${space[3]} ${space[5]};

    &:not(:last-child)::before {
      left: calc(${space[5]} + ${NODE / 2}rem - 0.5px);
    }
  }
`;

const Summary = styled.p`
  ${type.body}
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;

  /* Every entry can link, so the links stay quiet until pointed at */
  a {
    color: inherit;
    text-decoration: none;
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

const Flags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${space[1]} ${space[4]};
  margin-top: ${space[1]};
`;

interface ActivityPanelProps {
  id: string;
  title: string;
  items: ActivityView[];
  perspective: Perspective;
  showProject: boolean;
  empty: string;
  note?: ReactNode;
}

export function ActivityPanel({ id, title, items, perspective, showProject, empty, note }: ActivityPanelProps) {
  return (
    <ListPanel aria-labelledby={id}>
      <PanelTitle id={id} title={title} note={note} />
      {items.length === 0 ? (
        <EmptyNote>{empty}</EmptyNote>
      ) : (
        <Feed>
          {items.map((item) => (
            <FeedItem key={item.id}>
              <BranchNode aria-hidden="true" />
              <div>
                <Summary>{item.href ? <Link href={item.href}>{item.summary}</Link> : item.summary}</Summary>
                <MetaLine>
                  {item.actorIsViewer ? 'You' : (item.actorName ?? (perspective === 'client' ? 'Bonsai Web Design' : 'The portal'))}
                  <LocalTime value={item.at} />
                  {showProject && item.projectName}
                </MetaLine>
                {(item.studioOnly || item.email) && (
                  <Flags>
                    {item.studioOnly && <StatusBadge tone="muted">Studio only</StatusBadge>}
                    {item.email?.status === 'failed' && <StatusBadge tone="alert">Email to {item.email.to} failed</StatusBadge>}
                    {item.email?.status === 'skipped' && <StatusBadge tone="muted">Preview: email to {item.email.to} not sent</StatusBadge>}
                  </Flags>
                )}
              </div>
            </FeedItem>
          ))}
        </Feed>
      )}
    </ListPanel>
  );
}

/* ---------- Stage progress ---------- */

const Segments = styled.span`
  display: flex;
  gap: ${space[1]};
  width: 100%;
  max-width: 14rem;
`;

const Segment = styled.span<{ $state: 'done' | 'current' | 'next' }>`
  flex: 1;
  height: 3px;
  background: ${({ $state, theme }) =>
    $state === 'current' ? theme.colors.primary : $state === 'done' ? tint(theme.colors.primary, 55) : tint(theme.colors.primary, 16)};
`;

// The project header's stage track in miniature: one segment per stage
export function StageProgress({ stage }: { stage: ProjectStage }) {
  const index = STAGE_SEQUENCE.indexOf(stage);
  if (index < 0) return null;
  return (
    <>
      <Segments aria-hidden="true">
        {STAGE_SEQUENCE.map((step, position) => (
          <Segment key={step} $state={position < index ? 'done' : position === index ? 'current' : 'next'} />
        ))}
      </Segments>
      <VisuallyHidden>
        {STAGE_LABELS[stage]} is stage {index + 1} of {STAGE_SEQUENCE.length}
      </VisuallyHidden>
    </>
  );
}

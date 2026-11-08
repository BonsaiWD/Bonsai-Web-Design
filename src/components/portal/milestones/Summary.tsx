'use client';

import styled from 'styled-components';
import { FiArrowRight } from 'react-icons/fi';
import { dueInfo } from '@/lib/portal-format';
import { projectHref } from '../tabs';
import { DateText, DueText, Eyebrow, focusRing, GuardedLink, inlineTouchTarget, MetaLine, MetaText, PHONE, Panel, space, tint, TOUCH, TOUCH_TARGET, type, VisuallyHidden } from '../ui';
import { asksForInitials } from './signoff';
import type { MilestoneView } from './types';

const Cells = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);

  @media (min-width: ${PHONE}) {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.15fr) minmax(0, 1.15fr);
  }
`;

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  min-width: 0;
  padding: ${space[5]} 0;

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }

  & + & {
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
      border-top: none;
      border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
    }
  }
`;

const Figure = styled.p`
  ${type.h2}
  ${type.figures}
  font-weight: 500;

  span {
    ${type.body}
    margin-left: ${space[1]};
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

// One segment per milestone, so the bar reads as steps rather than a percentage
const Segments = styled.div`
  display: flex;
  gap: ${space[1]};
  max-width: 16rem;
`;

const Segment = styled.span<{ $done: boolean }>`
  flex: 1;
  height: 4px;
  background: ${({ $done, theme }) => ($done ? theme.colors.primary : tint(theme.colors.primary, 16))};
`;

const CellTitle = styled.p`
  ${type.label}
  font-size: 1rem;
  overflow-wrap: anywhere;
`;

const JumpLink = styled.a`
  color: ${({ theme }) => theme.colors.text};
  text-decoration: underline;
  text-decoration-color: ${({ theme }) => tint(theme.colors.primary, 45)};
  text-underline-offset: 0.2em;
  ${focusRing}
  ${inlineTouchTarget}

  @media (hover: hover) {
    &:hover {
      text-decoration-color: ${({ theme }) => theme.colors.primary};
    }
  }
`;

const WaitList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  margin: 0;
  padding: 0;
  list-style: none;

  a {
    display: inline-flex;
    align-items: flex-start;
    gap: ${space[2]};
    ${type.label}
    font-size: 1rem;
    color: ${({ theme }) => theme.colors.text};
    text-decoration: none;
    overflow-wrap: anywhere;
    ${focusRing}

    /* Stacked links get real 44px rows on phones and touch screens, so targets never overlap */
    @media ${TOUCH} {
      padding-block: calc((${TOUCH_TARGET} - 1.4em) / 2);
    }

    svg {
      flex-shrink: 0;
      margin-top: 0.3em;
      color: ${({ theme }) => theme.colors.primary};
    }

    @media (hover: hover) {
      &:hover span {
        text-decoration: underline;
        text-decoration-color: ${({ theme }) => tint(theme.colors.primary, 45)};
        text-underline-offset: 0.2em;
      }
    }
  }
`;

interface WaitingItem {
  key: string;
  href: string;
  label: string;
  due: string | null;
}

// What is waiting on the client, worded for whoever is reading
function waitingItems(milestones: MilestoneView[], projectId: string, forClient: boolean): WaitingItem[] {
  const items: WaitingItem[] = [];
  for (const m of milestones) {
    const anchor = `#milestone-${m.id}`;
    // Only steps waiting on the client, and a linked review comes before any initials
    if (m.status !== 'waiting_on_client') continue;
    const review = m.linked.find((d) => d.status === 'in_review');
    if (review) {
      items.push({
        key: m.id,
        href: projectHref(projectId, 'deliverables', `deliverable-${review.id}`),
        label: forClient ? `Review ${review.title}` : `${m.title}: review of ${review.title}`,
        due: m.dueDate,
      });
    } else if (asksForInitials({ requiresSignoff: m.requiresSignoff, signed: Boolean(m.signoff), status: m.status, reviewPending: false })) {
      items.push({ key: m.id, href: anchor, label: forClient ? `Sign off ${m.title}` : `${m.title}: initials`, due: m.dueDate });
    } else {
      items.push({ key: m.id, href: anchor, label: m.title, due: m.dueDate });
    }
  }
  return items;
}

interface SummaryProps {
  projectId: string;
  milestones: MilestoneView[];
  today: string;
  forClient: boolean;
  clientName: string;
}

export default function Summary({ projectId, milestones, today, forClient, clientName }: SummaryProps) {
  const total = milestones.length;
  const doneCount = milestones.filter((m) => m.status === 'done').length;
  // Earliest open date first, so anything overdue leads
  const next = milestones
    .filter((m) => m.status !== 'done' && m.dueDate)
    .sort((a, b) => ((a.dueDate as string) < (b.dueDate as string) ? -1 : 1))[0];
  // The first step not yet done is where the project is now
  const current = milestones.find((m) => m.status !== 'done');
  const waiting = waitingItems(milestones, projectId, forClient);
  const shown = waiting.slice(0, 3);
  const nextDue = next?.dueDate ? dueInfo(next.dueDate, today) : null;

  return (
    <Panel aria-labelledby="milestone-summary-heading">
      <VisuallyHidden as="h2" id="milestone-summary-heading">
        Summary
      </VisuallyHidden>
      <Cells>
        <Cell>
          <Eyebrow>Progress</Eyebrow>
          <Figure>
            {doneCount} of {total}
            <span>done</span>
          </Figure>
          <Segments aria-hidden="true">
            {milestones.map((m) => (
              <Segment key={m.id} $done={m.status === 'done'} />
            ))}
          </Segments>
          <MetaText>{current ? <>Current step: {current.title}</> : 'Every step is complete.'}</MetaText>
        </Cell>

        <Cell>
          <Eyebrow>Next deadline</Eyebrow>
          {next?.dueDate && nextDue ? (
            <>
              <CellTitle>
                <JumpLink href={`#milestone-${next.id}`}>{next.title}</JumpLink>
              </CellTitle>
              <MetaLine>
                <DueText value={next.dueDate} today={today} />
                {/* "Due Mar 4, 2027" already names the day; the relative labels need it added */}
                {nextDue.tone !== 'later' && <DateText value={next.dueDate} />}
              </MetaLine>
            </>
          ) : (
            <MetaText>{doneCount === total ? 'Every milestone is done.' : 'No open milestone has a date yet.'}</MetaText>
          )}
        </Cell>

        <Cell>
          <Eyebrow>{forClient ? 'Waiting on you' : `Waiting on ${clientName}`}</Eyebrow>
          {shown.length > 0 ? (
            <WaitList>
              {shown.map((item) => (
                <li key={item.key}>
                  {item.href.startsWith('#') ? (
                    <a href={item.href}>
                      <FiArrowRight aria-hidden="true" />
                      <span>{item.label}</span>
                    </a>
                  ) : (
                    // Leaves the tab, so it asks first when a milestone has unsaved edits
                    <GuardedLink href={item.href}>
                      <FiArrowRight aria-hidden="true" />
                      <span>{item.label}</span>
                    </GuardedLink>
                  )}
                  {item.due && (
                    <MetaLine>
                      <DueText value={item.due} today={today} />
                    </MetaLine>
                  )}
                </li>
              ))}
              {waiting.length > shown.length && <MetaText as="li">and {waiting.length - shown.length} more below</MetaText>}
            </WaitList>
          ) : (
            <MetaText>{forClient ? "Nothing right now. We'll email you when something needs you." : `Nothing is waiting on ${clientName}.`}</MetaText>
          )}
        </Cell>
      </Cells>
    </Panel>
  );
}

'use client';

import { Fragment } from 'react';
import { FiLock, FiMessageCircle } from 'react-icons/fi';
import { initials } from '@/lib/portal-format';
import { TextAnchor, TextLink, VisuallyHidden } from '@/components/portal/ui';
import { linkify } from './linkify';
import {
  Avatar,
  BodyText,
  Bubble,
  Day,
  DayHeading,
  EarlierNote,
  Empty,
  FormerLabel,
  InternalLabel,
  MessageList,
  NewDivider,
  PendingNote,
  Run,
  RunColumn,
  RunHeader,
  ThreadBody,
} from './styles';
import { dayKey, dayLabel, fullMoment, timeOfDay, useTimeZone } from './time';
import type { MessageView, Perspective, Side } from './types';

// Messages from one person this close together share one name and time
const RUN_GAP_MS = 5 * 60 * 1000;

interface RunData {
  key: string;
  own: boolean;
  you: boolean;
  side: Side;
  formerClient: boolean;
  internal: boolean;
  authorName: string;
  messages: MessageView[];
}

type DayItem = { kind: 'run'; run: RunData } | { kind: 'divider'; key: string };

interface DayData {
  key: string;
  items: DayItem[];
}

function groupThread(messages: MessageView[], options: { timeZone: string; viewerId: string; perspective: Perspective; dividerId: string | null }) {
  const days: DayData[] = [];
  let run: RunData | null = null;
  let previous: MessageView | null = null;

  for (const m of messages) {
    const key = dayKey(m.createdAt, options.timeZone);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, items: [] };
      days.push(day);
      run = null;
    }
    const startsUnread = m.id === options.dividerId;
    if (startsUnread) {
      day.items.push({ kind: 'divider', key: `divider-${m.id}` });
      run = null;
    }
    const continues =
      run &&
      previous &&
      previous.authorId === m.authorId &&
      previous.internal === m.internal &&
      new Date(m.createdAt).getTime() - new Date(previous.createdAt).getTime() <= RUN_GAP_MS;
    if (run && continues) {
      run.messages.push(m);
    } else {
      // The viewer's side of the conversation sits on the right. A previous client's messages
      // (the project has since moved) are no one's own: the current client didn't write them.
      const own = m.side === options.perspective && !m.formerClient;
      run = {
        key: m.id,
        own,
        // Not while the studio previews the client's view: there, studio messages read as the client sees them
        you: own && m.authorId === options.viewerId,
        side: m.side,
        formerClient: Boolean(m.formerClient),
        internal: m.internal,
        authorName: m.authorName,
        messages: [m],
      };
      day.items.push({ kind: 'run', run });
    }
    previous = m;
  }
  return days;
}

function MessageText({ body }: { body: string }) {
  return (
    <BodyText>
      {linkify(body).map((segment, index) =>
        segment.kind === 'text' ? (
          <Fragment key={index}>{segment.text}</Fragment>
        ) : (
          <TextAnchor key={index} href={segment.href} target="_blank" rel="noopener noreferrer">
            {segment.text}
            <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
          </TextAnchor>
        ),
      )}
    </BodyText>
  );
}

function RunItem({ run, timeZone }: { run: RunData; timeZone: string }) {
  const first = run.messages[0];
  const pending = run.messages.some((m) => m.pending);
  const tone = run.internal ? 'internal' : run.own ? 'own' : 'other';
  return (
    <Run $own={run.own}>
      <Avatar $side={run.side} aria-hidden="true">
        {initials(run.authorName)}
      </Avatar>
      <RunColumn $own={run.own}>
        <RunHeader $own={run.own}>
          <strong>{run.you ? 'You' : run.authorName}</strong>
          {run.formerClient && <FormerLabel>Previous client</FormerLabel>}
          <time dateTime={first.createdAt} title={fullMoment(first.createdAt, timeZone)}>
            {timeOfDay(first.createdAt, timeZone)}
          </time>
          {run.internal && (
            <InternalLabel>
              <FiLock aria-hidden="true" />
              Internal note
              <VisuallyHidden>, only the studio sees this</VisuallyHidden>
            </InternalLabel>
          )}
        </RunHeader>
        {run.messages.map((m, index) => (
          <Bubble key={m.id} id={`message-${m.id}`} $tone={tone} $own={run.own} $first={index === 0} $pending={m.pending}>
            <MessageText body={m.body} />
          </Bubble>
        ))}
        {pending && <PendingNote>Sending…</PendingNote>}
      </RunColumn>
    </Run>
  );
}

interface ThreadProps {
  messages: MessageView[];
  perspective: Perspective;
  viewerId: string;
  now: string;
  dividerId: string | null;
  dividerCount: number;
  total: number;
  limited: boolean;
  showAllHref: string;
  emptyText: string;
}

export function Thread({ messages, perspective, viewerId, now, dividerId, dividerCount, total, limited, showAllHref, emptyText }: ThreadProps) {
  const timeZone = useTimeZone();

  if (messages.length === 0) {
    return (
      <ThreadBody>
        <Empty>
          <span aria-hidden="true">
            <FiMessageCircle />
          </span>
          <h3>No messages yet</h3>
          <p>{emptyText}</p>
        </Empty>
      </ThreadBody>
    );
  }

  const todayKey = dayKey(now, timeZone);
  const days = groupThread(messages, { timeZone, viewerId, perspective, dividerId });

  return (
    <ThreadBody>
      {limited && (
        <EarlierNote>
          Showing the latest {messages.length.toLocaleString('en-US')} of {total.toLocaleString('en-US')} messages.{' '}
          <TextLink href={showAllHref} scroll={false}>
            Show earlier messages
          </TextLink>
        </EarlierNote>
      )}
      {days.map((day) => {
        const headingId = `messages-day-${day.key}`;
        return (
          <Day key={day.key} aria-labelledby={headingId}>
            <DayHeading id={headingId}>
              <time dateTime={day.key}>{dayLabel(day.key, todayKey)}</time>
            </DayHeading>
            <MessageList>
              {day.items.map((item) =>
                item.kind === 'divider' ? (
                  <NewDivider key={item.key}>{dividerCount === 1 ? '1 new message' : `${dividerCount} new messages`}</NewDivider>
                ) : (
                  <RunItem key={item.run.key} run={item.run} timeZone={timeZone} />
                ),
              )}
            </MessageList>
          </Day>
        );
      })}
    </ThreadBody>
  );
}

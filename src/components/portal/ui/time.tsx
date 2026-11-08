'use client';

import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { dateParts, dueInfo, formatDate } from '@/lib/portal-format';
import { radius, tint, type } from './tokens';

const utcFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

/*
 * A moment in time (a sign-off, a message) in the viewer's own time zone, with the zone
 * named: "Nov 8, 2026, 7:30 PM EST". The server renders UTC, then the browser swaps in
 * local time after hydration, so the first render always matches.
 */
export function LocalTime({ value, className }: { value: string | Date; className?: string }) {
  const iso = typeof value === 'string' ? value : value.toISOString();
  const [text, setText] = useState(() => utcFormat.format(new Date(iso)));
  useEffect(() => {
    const local = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(iso));
    // Formatting depends on the browser's time zone, known only after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(local);
  }, [iso]);
  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}

// A calendar day such as a due date: "Mar 4, 2027"
export function DateText({ value }: { value: string }) {
  return <time dateTime={value}>{formatDate(value)}</time>;
}

const DueWrap = styled.span<{ $tone: 'overdue' | 'soon' | 'later' | 'done' }>`
  ${type.figures}
  color: ${({ $tone, theme }) =>
    $tone === 'overdue' ? theme.colors.error : $tone === 'soon' ? theme.colors.primary : theme.colors.textSecondary};
  font-weight: ${({ $tone }) => ($tone === 'overdue' || $tone === 'soon' ? 500 : 400)};
`;

// "Due in 3 days", "2 days overdue"; today comes from the server so both renders agree
export function DueText({ value, today, done = false }: { value: string; today: string; done?: boolean }) {
  if (done) {
    return (
      <DueWrap $tone="done">
        <time dateTime={value}>{formatDate(value)}</time>
      </DueWrap>
    );
  }
  const { label, tone } = dueInfo(value, today);
  return (
    <DueWrap $tone={tone}>
      <time dateTime={value}>{label}</time>
    </DueWrap>
  );
}

const Chip = styled.span<{ $overdue: boolean }>`
  ${type.figures}
  flex-shrink: 0;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border: 1px solid ${({ $overdue, theme }) => tint($overdue ? theme.colors.error : theme.colors.primary, $overdue ? 60 : 30)};
  border-radius: ${radius.panel};
  background: ${({ theme }) => theme.colors.background};

  span:first-child {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${({ $overdue, theme }) => ($overdue ? theme.colors.error : theme.colors.primary)};
  }

  span:last-child {
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.1;
    color: ${({ theme }) => theme.colors.text};
  }
`;

// A small calendar tile for deadline lists
export function DateChip({ value, overdue = false }: { value: string; overdue?: boolean }) {
  const { day, month } = dateParts(value);
  return (
    <Chip $overdue={overdue} aria-hidden="true">
      <span>{month}</span>
      <span>{day}</span>
    </Chip>
  );
}

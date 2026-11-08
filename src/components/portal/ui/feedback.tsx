'use client';

import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import styled, { css } from 'styled-components';
import { FiAlertCircle, FiCheck, FiInfo, FiLock } from 'react-icons/fi';
import { radius, space, tint, type } from './tokens';

/*
 * Status tones. Colour is never the only signal: every tone has its own marker shape.
 *   action   - the viewer needs to do something: filled bronze dot
 *   active   - in progress, waiting on the other side: bronze ring
 *   done     - finished, approved, paid, signed: check mark
 *   alert    - overdue, changes requested: alert icon in the error colour
 *   muted    - upcoming, draft, withdrawn, void: hollow grey ring
 */
export type StatusTone = 'action' | 'active' | 'done' | 'alert' | 'muted';

const Marker = styled.span<{ $tone: StatusTone }>`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;

  ${({ $tone, theme }) => {
    switch ($tone) {
      case 'action':
        return css`
          background: ${theme.colors.primary};
          box-shadow: 0 0 0 3px ${tint(theme.colors.primary, 20)};
        `;
      case 'active':
        return css`
          border: 2px solid ${theme.colors.primary};
        `;
      case 'muted':
        return css`
          border: 1.5px solid ${tint(theme.colors.textSecondary, 70)};
        `;
      default:
        return css``;
    }
  }}
`;

// Badge text is 14px on a 1.3 line; the marker sits centred on the first line
const BADGE_LINE = '(0.875rem * 1.3)';

/* A badge never shrinks beside a title, as when it could not wrap. One longer than its whole
   row ("Email to <address> failed") is held to the row's width and wraps, breaking an address
   if it must, rather than running out of its panel. */
const Badge = styled.span<{ $tone: StatusTone }>`
  display: inline-flex;
  align-items: flex-start;
  gap: ${space[2]};
  flex-shrink: 0;
  max-width: 100%;
  font-size: 0.875rem;
  line-height: 1.3;
  font-weight: 500;
  overflow-wrap: anywhere;
  color: ${({ $tone, theme }) =>
    $tone === 'alert'
      ? theme.colors.error
      : $tone === 'action'
        ? theme.colors.primary
        : $tone === 'muted' || $tone === 'done'
          ? theme.colors.textSecondary
          : theme.colors.text};

  svg {
    flex-shrink: 0;
    font-size: 1rem;
    margin-top: calc((${BADGE_LINE} - 1rem) / 2);
    color: ${({ $tone, theme }) => ($tone === 'alert' ? theme.colors.error : theme.colors.primary)};
  }

  ${Marker} {
    margin-top: calc((${BADGE_LINE} - 0.625rem) / 2);
  }
`;

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <Badge $tone={tone}>
      {tone === 'done' ? (
        <FiCheck aria-hidden="true" />
      ) : tone === 'alert' ? (
        <FiAlertCircle aria-hidden="true" />
      ) : (
        <Marker $tone={tone} aria-hidden="true" />
      )}
      {children}
    </Badge>
  );
}

// A small count next to a tab or heading, e.g. how many things need the viewer
export const CountBadge = styled.span`
  ${type.figures}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.375rem;
  height: 1.375rem;
  padding: 0 ${space[2]};
  border-radius: ${radius.round};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.background};
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1;
`;

const EmptyWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${space[3]};
  padding: ${space[8]} ${space[6]};
  border: 1px dashed ${({ theme }) => tint(theme.colors.primary, 22)};
  border-radius: ${radius.panel};

  h3 {
    ${type.h3}
  }

  p {
    ${type.body}
    max-width: 52ch;
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

// What an empty section is for, and what to do about it
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <EmptyWrap>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </EmptyWrap>
  );
}

const NoticeWrap = styled.div<{ $tone: 'info' | 'alert' }>`
  display: flex;
  align-items: flex-start;
  gap: ${space[3]};
  padding: ${space[4]} ${space[5]};
  border-left: 2px solid ${({ $tone, theme }) => ($tone === 'alert' ? theme.colors.error : theme.colors.primary)};
  background: ${({ $tone, theme }) => tint($tone === 'alert' ? theme.colors.error : theme.colors.primary, 8)};
  ${type.body}
  color: ${({ theme }) => theme.colors.text};

  > svg {
    flex-shrink: 0;
    margin-top: 0.25em;
    color: ${({ $tone, theme }) => ($tone === 'alert' ? theme.colors.error : theme.colors.primary)};
  }

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[2]};
    min-width: 0;
  }

  p {
    margin: 0;
  }
`;

// An inline explanation: why something is blocked, what a preview means, what happens next
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'alert'; children: ReactNode }) {
  return (
    <NoticeWrap $tone={tone} role={tone === 'alert' ? 'alert' : undefined}>
      {tone === 'alert' ? <FiAlertCircle aria-hidden="true" /> : <FiInfo aria-hidden="true" />}
      <div>{children}</div>
    </NoticeWrap>
  );
}

/* ---------- Status line ---------- */

const StatusText = styled.p<{ $error: boolean }>`
  ${type.meta}
  display: flex;
  align-items: flex-start;
  gap: ${space[2]};
  color: ${({ $error, theme }) => ($error ? theme.colors.error : theme.colors.text)};

  &:focus {
    outline: none;
  }

  /* Out of the layout while empty, so it adds no gap, but still in the page to announce */
  &[data-empty='true'] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  svg {
    flex-shrink: 0;
    margin-top: 0.2em;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// Always rendered, so a screen reader hears each new message. Dialogs that close on success
// move focus here, since the button that opened them may be gone.
export const StatusLine = forwardRef<HTMLParagraphElement, { message: string; error?: boolean; className?: string }>(function StatusLine(
  { message, error = false, className },
  ref,
) {
  return (
    <StatusText ref={ref} className={className} role="status" aria-live="polite" tabIndex={-1} data-empty={!message} $error={error}>
      {message && !error && <FiCheck aria-hidden="true" />}
      {message}
    </StatusText>
  );
});

export type Announce = (message: string, focus?: boolean, error?: boolean) => void;

// A status line and the function that fills it. Focus moves in an effect, after React has
// committed: by then an item that changed group has moved, and focus stays on it.
export function useAnnouncer() {
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState({ message: '', error: false, focus: false, at: 0 });
  useEffect(() => {
    if (status.focus) statusRef.current?.focus();
  }, [status]);
  const announce = useCallback<Announce>((message, focus = true, error = false) => setStatus({ message, error, focus, at: Date.now() }), []);
  return { statusRef, message: status.message, error: status.error, announce };
}

/* ---------- Client-only actions, in the studio's preview ---------- */

const OnlyClientText = styled.p`
  ${type.meta}
  display: flex;
  align-items: flex-start;
  gap: ${space[2]};

  svg {
    flex-shrink: 0;
    margin-top: 0.2em;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// "Only Jane Doe can approve this.": what an admin previewing as the client sees instead of a
// button the server would refuse
export function ClientOnlyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <OnlyClientText className={className}>
      <FiLock aria-hidden="true" />
      <span>{children}</span>
    </OnlyClientText>
  );
}

'use client';

import type { ReactNode } from 'react';
import styled, { css } from 'styled-components';
import { FiAlertCircle, FiCheck, FiInfo } from 'react-icons/fi';
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

const Badge = styled.span<{ $tone: StatusTone }>`
  display: inline-flex;
  align-items: center;
  gap: ${space[2]};
  font-size: 0.875rem;
  line-height: 1.3;
  font-weight: 500;
  white-space: nowrap;
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
    color: ${({ $tone, theme }) => ($tone === 'alert' ? theme.colors.error : theme.colors.primary)};
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

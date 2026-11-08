'use client';

import styled, { css } from 'styled-components';
import BranchNode from '@/components/common/BranchNode';
import type { MilestoneStatus } from '@/db/schema';
import { DURATION, ease, PHONE, space, tint, type } from '../ui';

/* ---------- The branch line ----------
   Each row draws the segment from its own node down to the next one. A segment leaving a
   finished milestone is drawn stronger, so the line shows how far the project has come. */

const NODE = 0.6875; // rem: BranchNode's size
const ROW_TOP = 1.5; // rem: the row's top padding
const PHONE_ROW_TOP = 1.25; // rem
const NODE_OFFSET = 0.35; // rem: centres the node on the title's first line

export const Timeline = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
`;

export const Item = styled.li<{ $done: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: ${NODE}rem minmax(0, 1fr);
  gap: ${space[6]};
  padding: ${ROW_TOP}rem ${space[6]} ${space[6]};
  scroll-margin-top: ${space[8]};
  transition: background-color ${DURATION.state}s ${ease};

  & + & {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  &:not(:last-child)::before {
    content: '';
    position: absolute;
    left: calc(${space[6]} + ${NODE / 2}rem - 0.5px);
    top: ${ROW_TOP + NODE_OFFSET + NODE / 2}rem;
    /* 100% ends at this row's bottom edge; the extra pixel crosses the next row's hairline */
    height: calc(100% + 1px);
    width: 1px;
    background: ${({ $done, theme }) => tint(theme.colors.primary, $done ? 60 : 25)};
  }

  /* Arriving from an email or the dashboard lights the milestone up */
  &:target {
    background: ${({ theme }) => tint(theme.colors.primary, 6)};
  }

  @media (max-width: ${PHONE}) {
    gap: ${space[4]};
    padding: ${PHONE_ROW_TOP}rem ${space[5]} ${space[5]};

    &:not(:last-child)::before {
      left: calc(${space[5]} + ${NODE / 2}rem - 0.5px);
      top: ${PHONE_ROW_TOP + NODE_OFFSET + NODE / 2}rem;
    }
  }
`;

export const Node = styled(BranchNode)<{ $status: MilestoneStatus; $asking: boolean }>`
  display: block;
  margin-top: ${NODE_OFFSET}rem;

  ${({ $status, $asking, theme }) => {
    if ($status === 'done') {
      return css`
        background: ${theme.colors.primary};
      `;
    }
    if ($asking || $status === 'waiting_on_client') {
      return css`
        box-shadow: 0 0 0 3px ${tint(theme.colors.primary, 20)};
      `;
    }
    if ($status === 'in_progress') {
      return css`
        border-width: 2px;
      `;
    }
    return css`
      border-color: ${tint(theme.colors.primary, 55)};
    `;
  }}
`;

export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[4]};
  min-width: 0;
`;

export const ItemHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space[2]} ${space[5]};
`;

export const TitleGroup = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${space[3]};
  min-width: 0;

  h3 {
    overflow-wrap: anywhere;
  }
`;

export const IndexNumber = styled.span`
  ${type.figures}
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.primary};
`;

export const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[2]} ${space[4]};
  min-height: 1.5rem;
`;

export const Description = styled.p`
  ${type.body}
  max-width: 62ch;
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: pre-line;
  overflow-wrap: anywhere;
`;

// "Your sign-off is needed" and other asks: the one place in a row that wants attention
export const Callout = styled.div<{ $tone?: 'action' | 'quiet' }>`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  padding: ${space[4]} ${space[5]};
  border-left: 2px solid ${({ $tone = 'action', theme }) => ($tone === 'action' ? theme.colors.primary : tint(theme.colors.primary, 40))};
  background: ${({ $tone = 'action', theme }) => tint(theme.colors.primary, $tone === 'action' ? 8 : 4)};

  h4 {
    ${type.label}
    font-family: ${({ theme }) => theme.fonts.main};
  }

  p {
    ${type.meta}
    max-width: 60ch;
  }

  @media (max-width: ${PHONE}) {
    padding: ${space[4]};

    /* Small buttons grow to a comfortable touch target on phones */
    button,
    a {
      min-height: 2.75rem;
    }
  }
`;

// A signed record: quieter than an ask, but clearly a record
export const Record = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  padding-left: ${space[4]};
  border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 40)};

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

export const RecordLine = styled.p`
  ${type.body}
  display: flex;
  align-items: flex-start;
  gap: ${space[2]};
  color: ${({ theme }) => theme.colors.text};

  > svg {
    flex-shrink: 0;
    margin-top: 0.3em;
    color: ${({ theme }) => theme.colors.primary};
  }

  time {
    ${type.figures}
  }
`;

export const Statement = styled.blockquote`
  ${type.meta}
  margin: 0;
  max-width: 62ch;
  color: ${({ theme }) => theme.colors.textSecondary};
  overflow-wrap: anywhere;
`;

export const RecordDetails = styled.details`
  ${type.meta}

  summary {
    display: inline-flex;
    align-items: center;
    gap: ${space[1]};
    min-height: 2.75rem;
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 500;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }

    svg {
      transition: transform ${DURATION.state}s ${ease};
    }

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.primary};
      outline-offset: 3px;
    }
  }

  &[open] summary svg {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    summary svg {
      transition: none;
    }
  }

  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: ${space[2]} ${space[5]};
    margin: ${space[2]} 0 0;
  }

  dt {
    ${type.overline}
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.6;
  }

  dd {
    margin: 0;
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
  }

  @media (max-width: ${PHONE}) {
    dl {
      grid-template-columns: minmax(0, 1fr);
      gap: ${space[1]};
    }

    dd + dt {
      margin-top: ${space[2]};
    }
  }
`;

export const LinkedList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space[2]} ${space[3]};
    ${type.meta}
  }
`;

// Studio controls under each row: edit and sign-off on the left, order and delete on the right
export const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${space[3]} ${space[4]};
  padding-top: ${space[4]};
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};

  > div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space[2]};
    min-width: 0;
  }

  /* Quiet buttons carry their own padding; pull the first group back so its text lines up
     with the milestone's title and description */
  > div:first-child {
    margin-left: -${space[3]};
  }

  @media (max-width: ${PHONE}) {
    row-gap: ${space[2]};

    > div {
      gap: 0 ${space[2]};
    }

    button {
      min-height: 2.75rem;
    }
  }
`;

export const Chevron = styled.span<{ $open: boolean }>`
  display: inline-flex;
  transition: transform ${DURATION.state}s ${ease};
  transform: rotate(${({ $open }) => ($open ? '180deg' : '0deg')});

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const EditPanel = styled.div`
  padding: ${space[5]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 22)};
  background: ${({ theme }) => tint(theme.colors.background, 45)};

  @media (max-width: ${PHONE}) {
    padding: ${space[4]};
  }
`;

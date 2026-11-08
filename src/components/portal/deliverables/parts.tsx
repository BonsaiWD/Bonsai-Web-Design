'use client';

import type { ReactNode } from 'react';
import styled from 'styled-components';
import { FiChevronRight } from 'react-icons/fi';
import { DURATION, ease, focusRing, PHONE, panelStyles, sansHeading, space, tint, type } from '@/components/portal/ui';

/* ---------- Card ---------- */

export const Card = styled.article<{ $attention?: boolean }>`
  ${panelStyles}
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  min-width: 0;
  scroll-margin-top: ${space[8]};
  border-color: ${({ $attention, theme }) => tint(theme.colors.primary, $attention ? 40 : 14)};
  transition: border-color ${DURATION.state}s ${ease};

  /* Arriving from an email or a dashboard link */
  &:target {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

export const CardHead = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space[2]} ${space[5]};

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[2]};
    flex: 1 1 18rem;
    min-width: 0;
  }

  h4 {
    overflow-wrap: anywhere;
  }
`;

// A note from one side to the other: a bronze rule and the words, line breaks kept
export const NoteBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  padding-left: ${space[4]};
  border-left: 2px solid ${({ theme }) => tint(theme.colors.primary, 40)};

  h5 {
    ${type.overline}
    ${sansHeading}
    letter-spacing: 0.05em;
  }

  p {
    ${type.body}
    max-width: 62ch;
    color: ${({ theme }) => theme.colors.text};
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
`;

export const CardActions = styled.div`
  &[hidden] {
    display: none !important;
  }

  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${space[3]} ${space[4]};
  padding-top: ${space[5]};
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};

  /* A toggle that is open stays visibly on */
  button[aria-expanded='true'] {
    background: ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  > div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space[3]};
    min-width: 0;
  }

  @media (max-width: ${PHONE}) {
    > div,
    > div > * {
      width: 100%;
    }

    button,
    a {
      width: 100%;
    }
  }
`;

// A box inside a card for a form that opens in place
export const InsetPanel = styled.div`
  padding: ${space[5]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 18)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};

  @media (max-width: ${PHONE}) {
    padding: ${space[4]};
  }
`;

/* ---------- Disclosure ---------- */

export const Disclosure = styled.details`
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};

  > summary {
    display: flex;
    align-items: center;
    gap: ${space[2]};
    min-height: 2.75rem;
    padding-top: ${space[3]};
    list-style: none;
    ${type.label}
    color: ${({ theme }) => theme.colors.text};
    ${focusRing}

    &::-webkit-details-marker {
      display: none;
    }

    svg {
      flex-shrink: 0;
      color: ${({ theme }) => theme.colors.primary};
      transition: transform ${DURATION.state}s ${ease};
    }

    span {
      ${type.meta}
      font-weight: 400;
    }
  }

  &[open] > summary svg {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    > summary svg {
      transition: none;
    }
  }
`;

export function DisclosureSummary({ children, count }: { children: ReactNode; count?: string }) {
  return (
    <summary>
      <FiChevronRight aria-hidden="true" />
      {children}
      {count && <span>{count}</span>}
    </summary>
  );
}

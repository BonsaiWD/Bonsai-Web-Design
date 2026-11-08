'use client';

import styled, { css } from 'styled-components';
import { PHONE, sansHeading, space, tint, type } from '@/components/portal/ui';

/* ---------- Tool rows ----------
   A list of things the studio can do to one item: what it does on the left, the control on
   the right. Destructive tools sit last, under their own rule. */

export const Tools = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);

  @media (min-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: ${space[10]};
  }
`;

export const Tool = styled.li<{ $danger?: boolean; $wide?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  padding: ${space[5]} 0;
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  min-width: 0;

  ${({ $wide }) =>
    $wide &&
    css`
      grid-column: 1 / -1;
    `}

  ${({ $danger, theme }) =>
    $danger &&
    css`
      grid-column: 1 / -1;
      border-top-color: ${tint(theme.colors.error, 30)};
    `}

  h4 {
    ${type.label}
    ${sansHeading}
  }

  > div:first-child {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    min-width: 0;
  }

  p {
    ${type.meta}
    max-width: 60ch;
    overflow-wrap: anywhere;
  }

  @media (max-width: ${PHONE}) {
    button,
    a[href] {
      width: 100%;
    }
  }
`;

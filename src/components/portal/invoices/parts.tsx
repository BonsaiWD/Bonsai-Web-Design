'use client';

import styled from 'styled-components';
import { space, tint, type } from '@/components/portal/ui';

/* ---------- Small shared styles ---------- */

// A hairline-ruled box inside a panel, for a record or a form that opens in place
export const Inset = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  /* A client's reference (a 64-character transaction hash) wraps inside the box */
  overflow-wrap: anywhere;
  padding: ${space[4]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 18)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};
`;

// The big figure in a summary: an amount, a count
export const Amount = styled.p<{ $size?: 'lg' | 'md' }>`
  ${type.figures}
  margin: 0;
  font-size: ${({ $size = 'lg' }) => ($size === 'lg' ? '2rem' : '1.5rem')};
  line-height: 1.15;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.text};
`;

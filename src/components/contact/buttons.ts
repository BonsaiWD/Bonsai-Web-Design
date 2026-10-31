'use client';

import { css } from 'styled-components';
import { frostedGlass } from '@/styles/frosted';

/* Buttons shared by the contact form and its thank-you */

export const focusRing = css`
  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

export const buttonText = css`
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
`;

/** The header's frosted bronze glass, as on "Plant your project" */
export const frostedButton = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 28px;
  border-radius: 0;
  cursor: pointer;
  ${buttonText}
  ${frostedGlass}
  ${focusRing}
`;

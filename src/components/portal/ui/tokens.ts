'use client';

import { css } from 'styled-components';
import { CUSTOM_CURSOR_QUERY, DUR, EASE_OUT } from '@/lib/motion';

/*
 * The portal's design tokens. The portal is a tool people read and work in, so it trades
 * the marketing site's display serif and tracked capitals for Inter at comfortable sizes
 * (owner's request: "easy to read, less serif"). Colours stay the site's: dark ground,
 * bronze accent, bone text. Only the BONSAI wordmark keeps Playfair.
 */

export const ease = `cubic-bezier(${EASE_OUT.join(', ')})`;
export const DURATION = DUR;

// A theme colour at some strength, as the footer and work index write their hairlines
export const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

// Spacing in rem, so it grows with the site's larger base size on big monitors
export const space = {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
} as const;

// Panels use the brand's large-panel radius at its smaller step; controls stay square
export const radius = { panel: '20px', round: '999px' } as const;

export const PHONE = '768px';
export const LAPTOP = '1024px';

export const focusRing = css`
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

// Payment details (wallet addresses, account and routing numbers) in a monospace face, with
// contextual alternates and ligatures off: Inter draws the x in "8x0" as a times sign, and its
// l, I and 1 look alike. Copied by hand into a wallet, every character has to read as itself.
// A long address breaks anywhere rather than run out of its box.
export const paymentDetail = css`
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-variant-ligatures: none;
  font-feature-settings: 'calt' 0, 'liga' 0;
  font-variant-numeric: tabular-nums slashed-zero;
  overflow-wrap: anywhere;
  word-break: break-all;
`;

// The portal type scale: Inter, 16px base, nothing below 13px, one uppercase style left.
// Each style resets margin, because GlobalStyle gives every heading and paragraph one;
// spacing inside the portal comes from Stack, Cluster and the other layout components.
export const type = {
    h1: css`
      margin: 0;
      font-family: ${({ theme }) => theme.fonts.main};
      font-size: 2.25rem;
      line-height: 1.15;
      font-weight: 500;
      letter-spacing: -0.02em;
      color: ${({ theme }) => theme.colors.text};

      @media (max-width: ${PHONE}) {
        font-size: 1.75rem;
        line-height: 1.2;
        letter-spacing: -0.015em;
      }
    `,
    h2: css`
      margin: 0;
      font-family: ${({ theme }) => theme.fonts.main};
      font-size: 1.375rem;
      line-height: 1.3;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: ${({ theme }) => theme.colors.text};
    `,
    h3: css`
      margin: 0;
      font-family: ${({ theme }) => theme.fonts.main};
      font-size: 1.125rem;
      line-height: 1.35;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: ${({ theme }) => theme.colors.text};
    `,
    lead: css`
      margin: 0;
      font-size: 1.125rem;
      line-height: 1.6;
      color: ${({ theme }) => theme.colors.textSecondary};
      max-width: 60ch;
    `,
    body: css`
      margin: 0;
      font-size: 1rem;
      line-height: 1.6;
      letter-spacing: 0;
    `,
    meta: css`
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.5;
      color: ${({ theme }) => theme.colors.textSecondary};
    `,
    label: css`
      margin: 0;
      font-size: 0.9375rem;
      line-height: 1.4;
      font-weight: 500;
      color: ${({ theme }) => theme.colors.text};
    `,
    // Eyebrows, table headers and <dt>: the only uppercase in the portal
    overline: css`
      margin: 0;
      font-size: 0.8125rem;
      line-height: 1.3;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: ${({ theme }) => theme.colors.primary};
    `,
    figures: css`
      font-variant-numeric: lining-nums tabular-nums;
    `,
};

// The portal is an app: people point at small targets, so the native cursor comes back
// (the marketing site's CursorGlow hides it on wide, fine-pointer screens)
// Small headings (h4, h5) in the portal's sans; the site's global rule would set them in Playfair
export const sansHeading = css`
  font-family: ${({ theme }) => theme.fonts.main};
  letter-spacing: 0;
`;

export const nativeCursor = css`
  @media ${CUSTOM_CURSOR_QUERY} {
    &,
    & *,
    & *::before,
    & *::after {
      cursor: auto !important;
    }

    & a,
    & button,
    & label,
    & select,
    & summary,
    & [role='button'],
    & input[type='checkbox'],
    & input[type='file'] {
      cursor: pointer !important;
    }

    & [aria-disabled='true'],
    & :disabled {
      cursor: not-allowed !important;
    }
  }
`;

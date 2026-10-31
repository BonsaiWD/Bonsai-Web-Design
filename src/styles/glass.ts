'use client';

import { css, type DefaultTheme } from 'styled-components';
import { theme as siteTheme } from './theme';

/*
 * Smoked forest glass (owner's request, 2026-10-30), shared by the Projects
 * panes and the contact form: a pane tinted with the forest green, over a
 * still field of soft light, keeping the site's bone ink and bronze details so
 * what sits on it stays clear and legible.
 */

/**
 * The theme for what sits on the glass: body text and the error rose a touch lighter than elsewhere,
 * to hold up on it (the site's #CF6679 drops below 4.5:1 on the lit glass; this rose holds 5:1).
 */
export const glassTheme: DefaultTheme = {
  ...siteTheme,
  colors: {
    ...siteTheme.colors,
    textSecondary: '#AEB9AF',
    error: '#DC7F8F',
  },
};

/**
 * What the glass looks through, set just behind the pane: a soft sage light and a little bronze
 * warmth. It stays still, so the pane costs nothing extra to scroll past. Override the background
 * to move the light.
 */
export const lightField = css`
  position: absolute;
  inset: -60px -24px;
  background:
    radial-gradient(38% 46% at 24% 42%, rgba(174, 196, 168, 0.32), transparent 70%),
    radial-gradient(34% 44% at 80% 66%, rgba(200, 159, 129, 0.24), transparent 72%);
  pointer-events: none;
`;

/** The pane itself */
export const glassPane = css`
  position: relative;
  border-radius: 28px;
  /* Smoked forest glass: a little light caught across its upper half, over a deep green tint */
  background:
    linear-gradient(160deg, rgba(232, 240, 228, 0.1) 0%, rgba(232, 240, 228, 0.02) 42%, transparent 60%),
    linear-gradient(160deg, rgba(34, 50, 40, 0.52) 0%, rgba(12, 18, 14, 0.62) 100%);
  -webkit-backdrop-filter: blur(3px) saturate(160%);
  backdrop-filter: blur(3px) saturate(160%);
  /* The rim catching the light: brightest top-left, a fainter echo bottom-right, and the
     faint glow inside a thick pane */
  box-shadow:
    inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.3),
    inset -1px -1px 0 rgba(255, 255, 255, 0.12),
    inset 0 0 32px rgba(232, 240, 228, 0.07),
    0 24px 60px -24px rgba(0, 0, 0, 0.7);
  color: ${({ theme }) => theme.colors.text};
  overflow: hidden;

  /* A soft sheen across the upper left, as on curved glass */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(120% 70% at 0% 0%, rgba(255, 255, 255, 0.09), transparent 55%);
    pointer-events: none;
  }

  /* For visitors who ask for less transparency, a solid pane in the same greens */
  @media (prefers-reduced-transparency: reduce) {
    background: linear-gradient(160deg, #1d2b22 0%, #111813 100%);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  @media (max-width: 768px) {
    border-radius: 20px;
  }
`;

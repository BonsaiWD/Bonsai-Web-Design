import { createGlobalStyle } from 'styled-components';
import { theme } from './theme';
import { CUSTOM_CURSOR_QUERY } from '@/lib/motion';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
  }

  /* Smooth anchor jumps only for readers who have not asked for less motion */
  @media (prefers-reduced-motion: no-preference) {
    html {
      scroll-behavior: smooth;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
  }

  body {
    background-color: ${theme.colors.background};
    color: ${theme.colors.text};
    font-family: ${theme.fonts.main};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    /* Playfair defaults to old-style figures; keep prices and numbers full height */
    font-variant-numeric: lining-nums;
    overflow-x: hidden;
    line-height: 1.6;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${theme.fonts.heading};
    color: ${theme.colors.primary};
    margin-bottom: ${theme.spacing.md};
    font-weight: 400; /* Lighter weight for elegance */
    letter-spacing: -0.02em;
  }

  p {
    color: ${theme.colors.textSecondary};
    margin-bottom: ${theme.spacing.md};
  }

  a {
    text-decoration: none;
    color: inherit;
    transition: ${theme.transitions.default};
  }

  button {
    border: none;
    outline: none;
    font-family: inherit;
  }

  /* When the browser scrolls a focused control into view (Tab, Shift+Tab), keep
     it clear of the fixed header instead of tucking it underneath. Section
     anchors (#portfolio, #contact) are not matched, so jump targets are unchanged. */
  a, button, input, select, textarea, [tabindex] {
    scroll-margin-top: 104px;
  }

  /* Hide the native cursor only where CursorGlow renders (same query string) */
  @media ${CUSTOM_CURSOR_QUERY} {
    *, *::before, *::after {
      cursor: none !important;
    }
  }

  /* Custom Selection */
  ::selection {
    background-color: ${theme.colors.gold};
    color: ${theme.colors.background};
  }

  /* Custom Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: ${theme.colors.background};
  }

  ::-webkit-scrollbar-thumb {
    background: ${theme.colors.secondary};
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${theme.colors.gold};
  }
`;

'use client';

import { createGlobalStyle } from 'styled-components';
import { tint } from '@/components/portal/ui';

/*
 * Printing (or saving as PDF) gives a plain statement: dark text on white, no portal chrome.
 * The shell is not ours to edit, so this hides every element that neither holds the invoice
 * nor sits inside it. It is mounted only on the invoice page, so other pages print as before.
 */
export const PrintStyles = createGlobalStyle`
  @media print {
    @page {
      margin: 16mm 14mm;
    }

    html,
    body {
      background: ${({ theme }) => theme.colors.white} !important;
    }

    body *:not([data-print-root]):not([data-print-root] *):not(:has([data-print-root])) {
      display: none !important;
    }

    /* The ancestors of the invoice keep their place but lose their frames and spacing */
    body *:has([data-print-root]) {
      margin: 0 !important;
      padding: 0 !important;
      min-height: 0 !important;
      max-width: none !important;
      border: 0 !important;
      background: none !important;
      box-shadow: none !important;
    }

    [data-print-root] [data-print-hide] {
      display: none !important;
    }

    [data-print-root],
    [data-print-root] * {
      color: ${({ theme }) => theme.colors.background} !important;
      background: none !important;
      box-shadow: none !important;
      border-color: ${({ theme }) => tint(theme.colors.background, 22)} !important;
    }

    /* One column: the statement, then how to pay */
    [data-print-root] [data-print-layout] {
      display: block !important;
    }

    [data-print-root] [data-print-layout] > * + * {
      margin-top: 8mm !important;
    }

    [data-print-root] section,
    [data-print-root] article {
      border-radius: 0 !important;
      padding: 0 !important;
      border: 0 !important;
    }

    /* Hairlines drawn as backgrounds would vanish with them */
    [data-print-root] hr {
      height: 0 !important;
      border-top: 1px solid ${({ theme }) => tint(theme.colors.background, 22)} !important;
    }

    [data-print-root] tr,
    [data-print-root] li {
      break-inside: avoid;
    }

    [data-print-root] [data-statement] {
      gap: 8mm !important;
    }
  }
`;

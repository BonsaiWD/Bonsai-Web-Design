import type { Metadata } from 'next';
import { Inter, Italiana, Jost, Playfair_Display } from 'next/font/google';
import StyledComponentsRegistry from '@/lib/registry';
import Providers from '@/lib/providers';

import { Analytics } from '@vercel/analytics/react';

// Self-hosted at build time; exposed as CSS variables for the styled-components theme
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-playfair',
});

// Tracked capitals: the header's links and the hero's statements (owner's choice, 2026-10-30)
const jost = Jost({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jost',
});

// Thin, tall capitals with barely-there serifs: the hero headline (owner's choice, 2026-10-30)
const italiana = Italiana({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-italiana',
});

export const metadata: Metadata = {
  title: 'Bonsai Web Design | Premium Web Design Agency',
  description: 'Crafting timeless design and meaningful content for modern brands.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${jost.variable} ${italiana.variable}`}>
      <body>
        <StyledComponentsRegistry>
          <Providers>{children}</Providers>
        </StyledComponentsRegistry>
        <Analytics />
      </body>
    </html>
  );
}

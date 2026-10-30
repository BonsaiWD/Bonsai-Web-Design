import type { Metadata } from 'next';
import { Inter, Jost, Marcellus, Playfair_Display } from 'next/font/google';
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

// Light, flared capitals with barely-there serifs: the hero headline (owner's choice, 2026-10-30)
const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-marcellus',
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
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${jost.variable} ${marcellus.variable}`}>
      <body>
        <StyledComponentsRegistry>
          <Providers>{children}</Providers>
        </StyledComponentsRegistry>
        <Analytics />
      </body>
    </html>
  );
}

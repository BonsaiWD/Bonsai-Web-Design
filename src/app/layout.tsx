import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
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
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <StyledComponentsRegistry>
          <Providers>{children}</Providers>
        </StyledComponentsRegistry>
        <Analytics />
      </body>
    </html>
  );
}

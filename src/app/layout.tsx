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
  // What Google shows for the site: the words people search ("custom website design"), with the brand's
  // "crafted with care" and the husband-and-wife team in the description (owner's wording, 2026-10-31)
  title: 'Custom Website Design | Bonsai Web Design',
  description:
    'Custom websites and redesigns, crafted with care by a husband-and-wife design team. Start fresh, or build on the site you have.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // GlobalStyle smooths anchor jumps; this tells Next to switch it off during route changes
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${playfair.variable} ${jost.variable} ${italiana.variable}`}>
      <body>
        <StyledComponentsRegistry>
          <Providers>{children}</Providers>
        </StyledComponentsRegistry>
        <Analytics />
      </body>
    </html>
  );
}

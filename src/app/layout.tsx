import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import {
  Archivo,
  Geist,
  Hanken_Grotesk,
  Inter,
  Instrument_Sans,
  Playfair_Display,
  Schibsted_Grotesk,
} from 'next/font/google';
import StyledComponentsRegistry from '@/lib/registry';
import Providers from '@/lib/providers';
import FontLab from '@/components/common/FontLab';

import { Analytics } from '@vercel/analytics/react';

// Self-hosted at build time; exposed as CSS variables for the styled-components theme.
// Body-font comparison on the prototype branch: every candidate is loaded, the
// theme reads --font-body, and FontLab switches it. Only the default preloads.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter', preload: false });
const instrumentSans = Instrument_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-instrument-sans', preload: false });
const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-geist' });
const archivo = Archivo({ subsets: ['latin'], display: 'swap', variable: '--font-archivo', axes: ['wdth'], preload: false });
const hanken = Hanken_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-hanken', preload: false });
const schibsted = Schibsted_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-schibsted', preload: false });

const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-playfair',
});

const fontVariables = [inter, instrumentSans, geist, archivo, hanken, schibsted, playfair]
  .map((font) => font.variable)
  .join(' ');

// The body font before FontLab runs (and on any build without it)
const defaultBodyFont = { '--font-body': 'var(--font-geist)' } as CSSProperties;

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
    <html lang="en" className={fontVariables} style={defaultBodyFont}>
      <body>
        <StyledComponentsRegistry>
          <Providers>
            {children}
            <FontLab />
          </Providers>
        </StyledComponentsRegistry>
        <Analytics />
      </body>
    </html>
  );
}

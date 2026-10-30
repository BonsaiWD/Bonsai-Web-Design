import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import {
  Archivo,
  EB_Garamond,
  Geist,
  Hanken_Grotesk,
  Inter,
  Instrument_Sans,
  Newsreader,
  Playfair_Display,
  Schibsted_Grotesk,
  Source_Serif_4,
  Spectral,
} from 'next/font/google';
import StyledComponentsRegistry from '@/lib/registry';
import Providers from '@/lib/providers';
import FontLab from '@/components/common/FontLab';

import { Analytics } from '@vercel/analytics/react';

// Self-hosted at build time; exposed as CSS variables for the styled-components theme.
// Body-font comparison on the prototype branch: every candidate is loaded, the
// theme reads --font-body, and FontLab switches it. Only the defaults preload.

// Serif body candidates (optical sizes follow the text size where the font has them)
const newsreader = Newsreader({ subsets: ['latin'], display: 'swap', variable: '--font-newsreader', axes: ['opsz'], style: ['normal', 'italic'] });
const sourceSerif = Source_Serif_4({ subsets: ['latin'], display: 'swap', variable: '--font-source-serif', axes: ['opsz'], style: ['normal', 'italic'], preload: false });
const spectral = Spectral({ subsets: ['latin'], display: 'swap', variable: '--font-spectral', weight: ['300', '400', '500', '600'], style: ['normal', 'italic'], preload: false });
const ebGaramond = EB_Garamond({ subsets: ['latin'], display: 'swap', variable: '--font-eb-garamond', style: ['normal', 'italic'], preload: false });

// Sans body candidates from the earlier round
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter', preload: false });
const instrumentSans = Instrument_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-instrument-sans', preload: false });
const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-geist', preload: false });
const hanken = Hanken_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-hanken', preload: false });
const schibsted = Schibsted_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-schibsted', preload: false });

// Labels, buttons and navigation (also a body candidate); the width axis allows the expanded setting
const archivo = Archivo({ subsets: ['latin'], display: 'swap', variable: '--font-archivo', axes: ['wdth'] });

const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', style: ['normal', 'italic'], variable: '--font-playfair' });

const fontVariables = [newsreader, sourceSerif, spectral, ebGaramond, inter, instrumentSans, geist, hanken, schibsted, archivo, playfair]
  .map((font) => font.variable)
  .join(' ');

// The body font before FontLab runs (and on any build without it)
const defaultBodyFont = { '--font-body': 'var(--font-newsreader)' } as CSSProperties;

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

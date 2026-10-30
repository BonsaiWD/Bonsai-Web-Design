'use client';

import styled from 'styled-components';
import { useEffect, useState, useSyncExternalStore } from 'react';

/*
 * Temporary body-font switcher for comparing typefaces on previews.
 * It renders everywhere except Vercel production, sets --font-body on <html>,
 * and remembers the choice per browser. Link to one font with ?font=<id>.
 * Remove it, and the unused fonts in layout.tsx, once a font is chosen.
 */

const FONTS = [
  { id: 'newsreader', group: 'Serif', label: 'Newsreader', variable: '--font-newsreader' },
  { id: 'source-serif', group: 'Serif', label: 'Source Serif 4', variable: '--font-source-serif' },
  { id: 'spectral', group: 'Serif', label: 'Spectral', variable: '--font-spectral' },
  { id: 'garamond', group: 'Serif', label: 'EB Garamond', variable: '--font-eb-garamond' },
  { id: 'inter', group: 'Sans', label: 'Inter', note: 'Live site', variable: '--font-inter' },
  { id: 'instrument', group: 'Sans', label: 'Instrument Sans', variable: '--font-instrument-sans' },
  { id: 'geist', group: 'Sans', label: 'Geist', variable: '--font-geist' },
  { id: 'archivo', group: 'Sans', label: 'Archivo Expanded', variable: '--font-archivo', stretch: '112%' },
  { id: 'hanken', group: 'Sans', label: 'Hanken Grotesk', variable: '--font-hanken' },
  { id: 'schibsted', group: 'Sans', label: 'Schibsted Grotesk', variable: '--font-schibsted' },
] as const;

type FontId = (typeof FONTS)[number]['id'];
const GROUPS = ['Serif', 'Sans'] as const;

const DEFAULT_FONT: FontId = 'newsreader';
// A new key, so the serif default shows first even where a sans was chosen before
const STORAGE_KEY = 'bonsai-font-lab-v2';
const ENABLED = process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production';

const Panel = styled.div`
  position: fixed;
  right: max(16px, env(safe-area-inset-right, 0px));
  bottom: max(16px, env(safe-area-inset-bottom, 0px));
  z-index: 1000;
  width: min(300px, calc(100vw - 32px));
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid rgba(200, 159, 129, 0.42);
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.label};
`;

const Head = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Title = styled.span`
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
`;

const Toggle = styled.button`
  font: inherit;
  font-size: 0.72rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: none;
  border: 0;
  padding: 4px 0;
  cursor: pointer;

  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

const GroupLabel = styled.span`
  display: block;
  margin: ${({ theme }) => theme.spacing.sm} 0 6px;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const List = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
`;

const Option = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  font-size: 0.85rem;
  text-align: left;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ $active }) => ($active ? 'rgba(200, 159, 129, 0.16)' : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? 'rgba(200, 159, 129, 0.9)' : 'rgba(200, 159, 129, 0.18)')};
  cursor: pointer;

  small {
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.textSecondary};
  }

  &:hover {
    border-color: rgba(200, 159, 129, 0.6);
  }

  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

// The chosen font lives outside React: it is page-wide state applied to <html>
let currentFont: FontId = DEFAULT_FONT;
const listeners = new Set<() => void>();

function setFont(id: FontId) {
  const font = FONTS.find((f) => f.id === id) ?? FONTS[0];
  currentFont = font.id;
  document.documentElement.style.setProperty('--font-body', `var(${font.variable})`);
  document.body.style.fontStretch = 'stretch' in font ? font.stretch : '';
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export default function FontLab() {
  const current = useSyncExternalStore(subscribe, () => currentFont, () => DEFAULT_FONT);
  const [open, setOpen] = useState(true);

  // Pick up a ?font= link first, then the last choice in this browser
  useEffect(() => {
    if (!ENABLED) return;
    const isId = (v: string | null): v is FontId => FONTS.some((f) => f.id === v);
    const fromUrl = new URLSearchParams(window.location.search).get('font');
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    setFont(isId(fromUrl) ? fromUrl : isId(saved) ? saved : DEFAULT_FONT);
  }, []);

  if (!ENABLED) return null;

  const choose = (id: FontId) => {
    setFont(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Not kept in this browser; the switch still applies
    }
  };

  return (
    <Panel role="group" aria-label="Compare body fonts">
      <Head>
        <Title>Body font</Title>
        <Toggle type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide' : 'Show'}
        </Toggle>
      </Head>
      {open &&
        GROUPS.map((group) => (
          <div key={group}>
            <GroupLabel>{group}</GroupLabel>
            <List>
              {FONTS.filter((f) => f.group === group).map((f) => (
                <Option
                  key={f.id}
                  type="button"
                  $active={current === f.id}
                  aria-pressed={current === f.id}
                  onClick={() => choose(f.id)}
                  style={{ fontFamily: `var(${f.variable})`, fontStretch: 'stretch' in f ? f.stretch : '100%' }}
                >
                  {f.label}
                  {'note' in f && <small>{f.note}</small>}
                </Option>
              ))}
            </List>
          </div>
        ))}
    </Panel>
  );
}

'use client';

import { Children, type ReactNode } from 'react';
import styled, { css } from 'styled-components';
import { LAPTOP, PHONE, radius, space, tint, type } from './tokens';

/* ---------- Text ---------- */

export const H1 = styled.h1`
  ${type.h1}
`;

export const H2 = styled.h2`
  ${type.h2}
`;

export const H3 = styled.h3`
  ${type.h3}
`;

export const Eyebrow = styled.p`
  ${type.overline}
`;

// Lead and Text hold what people type (summaries, descriptions, notes): a long URL or email
// breaks where it must instead of pushing the page sideways (spec section 3)
export const Lead = styled.p`
  ${type.lead}
  overflow-wrap: anywhere;
`;

export const Text = styled.p<{ $muted?: boolean }>`
  ${type.body}
  max-width: 65ch;
  color: ${({ $muted, theme }) => ($muted ? theme.colors.textSecondary : theme.colors.text)};
  white-space: pre-line;
  overflow-wrap: anywhere;
`;

export const Meta = styled.p`
  ${type.meta}
`;

// A span for inline meta inside other text or rows
export const MetaText = styled.span`
  ${type.meta}
`;

export const Figures = styled.span`
  ${type.figures}
`;

/* ---------- Layout ---------- */

export const Page = styled.div`
  width: 100%;
  max-width: 72rem;
  margin: 0 auto;
  padding: ${space[10]} ${space[6]} ${space[16]};

  @media (max-width: ${PHONE}) {
    padding: ${space[6]} ${space[4]} ${space[12]};
  }
`;

// Vertical rhythm: children separated by one gap
export const Stack = styled.div<{ $gap?: keyof typeof space }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $gap = 4 }) => space[$gap]};
  min-width: 0;
`;

// A row that wraps: buttons, meta items, chips
export const Cluster = styled.div<{ $gap?: keyof typeof space; $justify?: 'start' | 'between' | 'end'; $align?: 'center' | 'baseline' | 'start' }>`
  display: flex;
  flex-wrap: wrap;
  align-items: ${({ $align = 'center' }) => ($align === 'start' ? 'flex-start' : $align)};
  justify-content: ${({ $justify = 'start' }) =>
    $justify === 'between' ? 'space-between' : $justify === 'end' ? 'flex-end' : 'flex-start'};
  gap: ${({ $gap = 3 }) => space[$gap]};
  min-width: 0;
`;

// Main column with a narrower aside on laptops and up; one column below
export const Split = styled.div<{ $aside?: 'right' | 'left' }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${space[8]};
  align-items: start;

  @media (min-width: ${LAPTOP}) {
    grid-template-columns: ${({ $aside = 'right' }) =>
      $aside === 'right' ? 'minmax(0, 2fr) minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 2fr)'};
    gap: ${space[10]};
  }
`;

export const panelStyles = css`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 14)};
  border-radius: ${radius.panel};
  padding: ${space[6]};

  @media (max-width: ${PHONE}) {
    padding: ${space[5]};
  }
`;

export const Panel = styled.section`
  ${panelStyles}
  min-width: 0;
`;

// A panel whose rows run edge to edge (lists, tables); rows bring their own padding
export const ListPanel = styled.section`
  ${panelStyles}
  padding: 0;
  overflow: hidden;

  @media (max-width: ${PHONE}) {
    padding: 0;
  }
`;

// Title (and optional description) on the left, actions on the right
export const SectionHeader = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${space[3]} ${space[6]};
  margin-bottom: ${space[5]};

  & > div:first-child {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    min-width: 0;
  }
`;

// Inside a ListPanel: the header row with its own padding and hairline
export const PanelHeader = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${space[3]};
  padding: ${space[5]} ${space[6]};
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};

  @media (max-width: ${PHONE}) {
    padding: ${space[4]} ${space[5]};
  }
`;

// Rows separated by hairlines, for lists inside a ListPanel
export const Rows = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;

  & > li + li {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }
`;

export const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${space[4]};
  padding: ${space[4]} ${space[6]};
  min-width: 0;

  @media (max-width: ${PHONE}) {
    padding: ${space[4]} ${space[5]};
  }
`;

export const Divider = styled.hr`
  border: 0;
  height: 1px;
  margin: 0;
  background: ${({ theme }) => tint(theme.colors.primary, 12)};
`;

export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

/* ---------- Key/value list ---------- */

export const DataList = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin: 0;

  & > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: ${space[4]};
    padding: ${space[3]} 0;
    border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  & > div:last-child {
    border-bottom: none;
  }

  dt {
    ${type.meta}
  }

  dd {
    ${type.body}
    ${type.figures}
    margin: 0;
    color: ${({ theme }) => theme.colors.text};
    text-align: right;
    overflow-wrap: anywhere;
  }
`;

/* ---------- Meta line ----------
   Meta items separated by the bronze dot, as everywhere on the site. Each item carries its
   dot in front of it, and the row is pulled left by one dot slot inside a clipping box, so
   the item that starts a line hides its dot: a wrapped line never begins or ends on one. */

const META_SLOT = { meta: '1rem', lead: '1.75rem' } as const;

const MetaClip = styled.div`
  overflow: hidden;
  min-width: 0;
`;

const MetaRow = styled.div<{ $size: 'meta' | 'lead'; $stackOnPhone: boolean }>`
  ${({ $size }) => ($size === 'lead' ? type.lead : type.meta)}
  ${type.figures}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  row-gap: ${space[1]};
  max-width: none;
  margin-left: -${({ $size }) => META_SLOT[$size]};

  /* Each item is a flex item with ordinary inline content, so "Shared <time>" keeps its space */
  > span {
    position: relative;
    padding-left: ${({ $size }) => META_SLOT[$size]};
    min-width: 0;
    overflow-wrap: anywhere;
  }

  > span::before {
    content: '';
    position: absolute;
    left: calc(${({ $size }) => META_SLOT[$size]} / 2 - 2px);
    top: 50%;
    width: 4px;
    height: 4px;
    margin-top: -2px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
    opacity: 0.6;
  }

  /* Long items go one per line on phones, with no dots */
  ${({ $stackOnPhone }) =>
    $stackOnPhone &&
    css`
      @media (max-width: ${PHONE}) {
        flex-direction: column;
        align-items: flex-start;
        margin-left: 0;

        > span {
          padding-left: 0;
        }

        > span::before {
          display: none;
        }
      }
    `}
`;

interface MetaLineProps {
  children: ReactNode;
  // 'lead' for a summary under a page title
  size?: 'meta' | 'lead';
  stackOnPhone?: boolean;
  className?: string;
}

export function MetaLine({ children, size = 'meta', stackOnPhone = false, className }: MetaLineProps) {
  const items = Children.toArray(children).filter(Boolean);
  // Nothing to say: no empty row taking a gap in the layout
  if (items.length === 0) return null;
  return (
    <MetaClip className={className}>
      <MetaRow $size={size} $stackOnPhone={stackOnPhone}>
        {items.map((item, index) => (
          <span key={index}>{item}</span>
        ))}
      </MetaRow>
    </MetaClip>
  );
}

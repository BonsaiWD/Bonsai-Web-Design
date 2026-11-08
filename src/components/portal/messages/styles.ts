'use client';

import styled, { css } from 'styled-components';
import { DURATION, ease, PHONE, panelStyles, radius, space, Textarea, tint, type } from '@/components/portal/ui';
import type { Side } from './types';

// Small headings use the UI type; the site's global rule would set them in Playfair, in bronze
const plainHeading = css`
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.main};
  letter-spacing: 0;
`;

/* ---------- The conversation panel ---------- */

export const ThreadPanel = styled.section`
  ${panelStyles}
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0;

  @media (max-width: ${PHONE}) {
    padding: 0;
  }
`;

export const ThreadBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[8]};
  padding: ${space[6]} ${space[6]} ${space[8]};

  @media (max-width: ${PHONE}) {
    gap: ${space[6]};
    padding: ${space[5]} ${space[4]} ${space[6]};
  }
`;

export const FailedEmails = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  padding: 0 ${space[6]} ${space[6]};

  @media (max-width: ${PHONE}) {
    padding: 0 ${space[4]} ${space[5]};
  }
`;

export const EarlierNote = styled.p`
  ${type.meta}
  ${type.figures}
  text-align: center;
`;

export const Day = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  min-width: 0;
`;

// "Today", centred between two hairlines
export const DayHeading = styled.h3`
  ${plainHeading}
  ${type.meta}
  ${type.figures}
  display: flex;
  align-items: center;
  gap: ${space[4]};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSecondary};

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${({ theme }) => tint(theme.colors.primary, 14)};
  }
`;

export const MessageList = styled.ol`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  margin: 0;
  padding: 0;
  list-style: none;
`;

// Where the reader left off: a bronze rule, stronger than a day's hairline
export const NewDivider = styled.li`
  ${type.meta}
  display: flex;
  align-items: center;
  gap: ${space[3]};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};

  &::before,
  &::after {
    content: '';
    height: 1px;
    background: ${({ theme }) => tint(theme.colors.primary, 60)};
  }

  &::before {
    width: ${space[6]};
  }

  &::after {
    flex: 1;
  }
`;

/* ---------- A run of messages from one person ---------- */

export const Run = styled.li<{ $own: boolean }>`
  display: flex;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  align-items: flex-start;
  gap: ${space[3]};
  min-width: 0;
`;

export const Avatar = styled.span<{ $side: Side }>`
  ${type.figures}
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: ${radius.round};
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  user-select: none;

  /* The studio wears bronze, the client sage: two sides at a glance, with names beside them */
  ${({ $side, theme }) =>
    $side === 'studio'
      ? css`
          background: ${tint(theme.colors.primary, 18)};
          border: 1px solid ${tint(theme.colors.primary, 40)};
          color: ${theme.colors.primary};
        `
      : css`
          background: ${tint(theme.colors.accent, 32)};
          border: 1px solid ${tint(theme.colors.accent, 70)};
          color: ${theme.colors.text};
        `}

  @media (max-width: ${PHONE}) {
    width: 2rem;
    height: 2rem;
  }
`;

export const RunColumn = styled.div<{ $own: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $own }) => ($own ? 'flex-end' : 'flex-start')};
  gap: ${space[2]};
  min-width: 0;
  max-width: min(38rem, calc(100% - 3rem));

  @media (max-width: ${PHONE}) {
    max-width: calc(100% - 2.75rem);
  }
`;

export const RunHeader = styled.p<{ $own: boolean }>`
  ${type.meta}
  ${type.figures}
  display: flex;
  flex-wrap: wrap;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  align-items: baseline;
  gap: ${space[1]} ${space[3]};
  padding: 0 ${space[1]};

  strong {
    ${type.label}
    overflow-wrap: anywhere;
  }
`;

export const InternalLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${space[1]};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};

  svg {
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

type BubbleTone = 'own' | 'other' | 'internal';

export const Bubble = styled.div<{ $tone: BubbleTone; $own: boolean; $first: boolean; $pending?: boolean }>`
  position: relative;
  max-width: 100%;
  padding: ${space[3]} ${space[4]};
  border: 1px solid transparent;
  /* The first bubble of a run points at its author with one square corner */
  border-radius: ${({ $own, $first }) =>
    !$first ? radius.panel : $own ? `${radius.panel} 0 ${radius.panel} ${radius.panel}` : `0 ${radius.panel} ${radius.panel} ${radius.panel}`};
  scroll-margin-top: ${space[16]};
  opacity: ${({ $pending }) => ($pending ? 0.7 : 1)};
  transition:
    opacity ${DURATION.state}s ${ease},
    box-shadow ${DURATION.state}s ${ease};

  ${({ $tone, theme }) => {
    switch ($tone) {
      case 'own':
        return css`
          background: ${tint(theme.colors.primary, 13)};
          border-color: ${tint(theme.colors.primary, 30)};
        `;
      case 'internal':
        return css`
          background: ${tint(theme.colors.accent, 16)};
          border: 1px dashed ${tint(theme.colors.primary, 50)};
        `;
      default:
        return css`
          background: ${theme.colors.background};
          border-color: ${tint(theme.colors.primary, 16)};
        `;
    }
  }}

  /* Arriving from an email or a dashboard link */
  &:target {
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const BodyText = styled.p`
  ${type.body}
  color: ${({ theme }) => theme.colors.text};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

export const PendingNote = styled.p`
  ${type.meta}
  padding: 0 ${space[1]};
`;

/* ---------- Empty conversation ---------- */

export const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space[3]};
  padding: ${space[10]} ${space[4]};
  text-align: center;

  > span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    margin-bottom: ${space[2]};
    border: 1px solid ${({ theme }) => tint(theme.colors.primary, 35)};
    border-radius: ${radius.round};
    color: ${({ theme }) => theme.colors.primary};
    font-size: 1.25rem;
  }

  h3 {
    ${plainHeading}
    ${type.h3}
  }

  p {
    ${type.body}
    max-width: 44ch;
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

/* ---------- Composer ---------- */

export const ComposerArea = styled.div<{ $internal?: boolean }>`
  padding: ${space[5]} ${space[6]} ${space[6]};
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 14)};
  border-radius: 0 0 ${radius.panel} ${radius.panel};
  background: ${({ $internal, theme }) => ($internal ? tint(theme.colors.accent, 12) : tint(theme.colors.background, 45))};
  transition: background-color ${DURATION.state}s ${ease};

  @media (max-width: ${PHONE}) {
    padding: ${space[4]} ${space[4]} ${space[5]};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Grows with what is typed where the browser can, up to a comfortable height
export const ComposerTextarea = styled(Textarea)<{ $internal?: boolean }>`
  min-height: 6.5rem;
  max-height: 22rem;
  field-sizing: content;
  border-style: ${({ $internal }) => ($internal ? 'dashed' : 'solid')};
`;

export const ComposerBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${space[3]} ${space[5]};
  margin-top: ${space[4]};

  > div:last-child {
    display: flex;
    align-items: center;
    gap: ${space[4]};
    margin-left: auto;
  }

  @media (max-width: ${PHONE}) {
    > div:last-child {
      width: 100%;
      justify-content: space-between;
    }

    > div:last-child button {
      flex: 1 1 auto;
    }
  }
`;

export const Counter = styled.span<{ $over: boolean }>`
  ${type.meta}
  ${type.figures}
  color: ${({ $over, theme }) => ($over ? theme.colors.error : theme.colors.textSecondary)};
  font-weight: ${({ $over }) => ($over ? 600 : 400)};
  white-space: nowrap;
`;

// The shortcut only means something with a keyboard
export const KeyHint = styled.span`
  ${type.meta}
  white-space: nowrap;

  @media (hover: none), (max-width: ${PHONE}) {
    display: none;
  }

  kbd {
    ${type.figures}
    padding: 0 ${space[1]};
    border: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};
    font-family: inherit;
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.text};
  }
`;

export const ComposerMessage = styled.div`
  margin-top: ${space[3]};
`;

export const PreviewNote = styled.p`
  ${type.body}
  display: flex;
  align-items: flex-start;
  gap: ${space[3]};
  color: ${({ theme }) => theme.colors.textSecondary};

  svg {
    flex-shrink: 0;
    margin-top: 0.3em;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

/* ---------- Aside ---------- */

// One column beside the thread on laptops; below it, panels share a row where they fit
export const Aside = styled.aside`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  align-items: start;
  gap: ${space[5]};
  min-width: 0;
`;

export const Tips = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    ${type.meta}
    padding-left: ${space[4]};
    border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};
  }

  strong {
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  }
`;

export const ContactLine = styled.p`
  ${type.meta}
  overflow-wrap: anywhere;
`;

// Label above value: the values are full moments, too long to share a line with a label
export const Facts = styled.dl`
  display: flex;
  flex-direction: column;
  margin: 0;
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    padding: ${space[3]} 0;
    border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  dt {
    ${type.meta}
  }

  dd {
    ${type.body}
    ${type.figures}
    margin: 0;
    color: ${({ theme }) => theme.colors.text};
  }
`;

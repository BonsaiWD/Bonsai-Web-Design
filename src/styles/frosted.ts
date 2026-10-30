'use client';

import { css, type DefaultTheme } from 'styled-components';
import { DUR, EASE_OUT } from '@/lib/motion';

type Tone = ({ theme }: { theme: DefaultTheme }) => string;

/** A theme colour at this share of opacity. */
const tone =
  (color: 'primary' | 'text', pct: number): Tone =>
  ({ theme }) =>
    `color-mix(in srgb, ${theme.colors[color]} ${pct}%, transparent)`;

const glass = (g: { fill: Tone; edge: Tone; shine: Tone; hoverFill: Tone; hoverEdge: Tone; bare: Tone }) => css`
  background-color: ${g.fill};
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid ${g.edge};
  box-shadow:
    inset 0 1px 0 ${g.shine},
    0 8px 24px ${({ theme }) => `color-mix(in srgb, ${theme.colors.background} 55%, transparent)`};
  color: ${({ theme }) => theme.colors.text};
  transition:
    background-color ${DUR.hover}s cubic-bezier(${EASE_OUT.join(', ')}),
    border-color ${DUR.hover}s cubic-bezier(${EASE_OUT.join(', ')});

  &:hover {
    background-color: ${g.hoverFill};
    border-color: ${g.hoverEdge};
  }

  /* Without backdrop blur, a little more fill so it still reads as a surface */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    background-color: ${g.bare};
  }
`;

/*
 * Frosted glass for the "Plant your project" buttons (owner's request,
 * 2026-10-30): a faint bronze tint over whatever is behind it, blurred, with
 * a hairline bronze edge and a soft light catching the top. Bone text keeps
 * it legible (about 12:1). Brighter tint and edge on hover.
 */
export const frostedGlass = glass({
  fill: tone('primary', 12),
  edge: tone('primary', 40),
  shine: tone('text', 22),
  hoverFill: tone('primary', 22),
  hoverEdge: tone('primary', 65),
  bare: tone('primary', 20),
});

/*
 * Its quieter sibling, for a secondary action beneath it ("See the work",
 * owner, the same day): the same blur, but clear rather than tinted, with a
 * fainter bone edge that turns bronze on hover.
 */
export const clearGlass = glass({
  fill: tone('text', 4),
  edge: tone('text', 18),
  shine: tone('text', 12),
  hoverFill: tone('text', 8),
  hoverEdge: tone('primary', 50),
  bare: tone('text', 8),
});

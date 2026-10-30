'use client';

import { css } from 'styled-components';
import { DUR, EASE_OUT } from '@/lib/motion';

/*
 * Frosted glass for the "Plant your project" buttons (owner's request,
 * 2026-10-30): a faint bronze tint over whatever is behind it, blurred, with
 * a hairline bronze edge and a soft light catching the top. Bone text keeps
 * it legible (about 12:1). Brighter tint and edge on hover.
 */
export const frostedGlass = css`
  background-color: ${({ theme }) => `color-mix(in srgb, ${theme.colors.primary} 12%, transparent)`};
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid ${({ theme }) => `color-mix(in srgb, ${theme.colors.primary} 40%, transparent)`};
  box-shadow:
    inset 0 1px 0 ${({ theme }) => `color-mix(in srgb, ${theme.colors.text} 22%, transparent)`},
    0 8px 24px ${({ theme }) => `color-mix(in srgb, ${theme.colors.background} 55%, transparent)`};
  color: ${({ theme }) => theme.colors.text};
  transition:
    background-color ${DUR.hover}s cubic-bezier(${EASE_OUT.join(', ')}),
    border-color ${DUR.hover}s cubic-bezier(${EASE_OUT.join(', ')});

  &:hover {
    background-color: ${({ theme }) => `color-mix(in srgb, ${theme.colors.primary} 22%, transparent)`};
    border-color: ${({ theme }) => `color-mix(in srgb, ${theme.colors.primary} 65%, transparent)`};
  }

  /* Without backdrop blur, a little more tint so it still reads as a surface */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    background-color: ${({ theme }) => `color-mix(in srgb, ${theme.colors.primary} 20%, transparent)`};
  }
`;

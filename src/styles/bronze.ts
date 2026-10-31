'use client';

import { css, keyframes, type DefaultTheme } from 'styled-components';

/*
 * The hero's polished bronze, for text beyond the hero (the contact form's
 * title and lead). HeroSection keeps its own copy while its tuning is still
 * changing on main; fold that copy into this one once it settles.
 *
 * A word in bronze catches the light once: a bone-white glint with a bronze
 * halo travels through it from left to right and leaves it polished. The
 * glint and the polish are the text's own fill, gradients clipped to it.
 */

export const glint = keyframes`
  from { background-position: 100% 0; mask-position: 100% 0; }
  to { background-position: 0 0; mask-position: 0 0; }
`;
export const GLINT_S = 3.6;
export const GLINT_EASE = 'cubic-bezier(0.37, 0, 0.63, 1)';

/** Bronze lit toward bone, or shaded toward the page's own dark, which polished metal reflects. */
const lit = (pct: number) => ({ theme }: { theme: DefaultTheme }) =>
  `color-mix(in srgb, ${theme.colors.primary}, ${theme.colors.text} ${pct}%)`;
const shade = (pct: number) => ({ theme }: { theme: DefaultTheme }) =>
  `color-mix(in srgb, ${theme.colors.primary}, ${theme.colors.background} ${pct}%)`;

/*
 * Polished bronze lit from above, for an italic Playfair word set with 0.5em
 * padding on a 1.1 line: the ascenders reach up to 0.66em, the lowercase runs
 * from 0.93em to the baseline at 1.46em.
 */
export const polishedBronze = css`
  linear-gradient(
    180deg,
    ${shade(40)} 0.66em,
    ${lit(45)} 0.8em,
    ${lit(60)} 0.93em,
    ${lit(10)} 1.1em,
    ${shade(28)} 1.17em,
    ${shade(12)} 1.22em,
    ${lit(25)} 1.4em,
    ${shade(15)} 1.48em
  )
`;

/* The same polish for Jost capitals, one 1.8em line box tall: the capitals run from 0.55em to the baseline at 1.25em */
export const bronzeCaps = css`
  linear-gradient(
    180deg,
    ${lit(80)} 0.55em,
    ${lit(45)} 0.72em,
    ${lit(5)} 0.86em,
    ${lit(25)} 0.92em,
    ${lit(65)} 1.15em,
    ${lit(20)} 1.26em
  )
`;

/* The glint: a bone-white band trailing bronze, 2.4 times the text's width so it sweeps from just before it to just past it */
export const glintBand = css`
  linear-gradient(
      100deg,
      transparent 0 41%,
      ${({ theme }) => theme.colors.text} 48% 52%,
      ${({ theme }) => theme.colors.primary} 59% 100%
    )
    0 0 / 240% 100% no-repeat
`;

/*
 * A polished bronze word in a heading set on a 1.1 line, written
 * <em data-glow="word">word</em>. Until it catches the light it is flat bronze,
 * with the glint waiting just before it; glintOnce runs the glint through it
 * and leaves it polished. The padding gives the halo room (and the italic its
 * overhang); the negative margin takes it back out of the line. The halo is the
 * word again (data-glow), drawn only as its text-shadow and masked to the
 * glint's band. Reduced motion shows the word polished from the start.
 */
export const bronzeWord = css`
  em {
    font-style: italic;
    color: ${({ theme }) => theme.colors.primary};
  }

  @supports (background-clip: text) or (-webkit-background-clip: text) {
    em {
      position: relative;
      display: inline-block;
      padding: 0.5em 0.6em;
      margin: -0.5em -0.6em;
      background:
        ${glintBand},
        ${polishedBronze};
      background-position: 100% 0;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    em::after {
      content: attr(data-glow) / '';
      position: absolute;
      inset: 0;
      padding: inherit;
      white-space: nowrap;
      text-shadow:
        0 0 0.06em ${({ theme }) => theme.colors.text},
        0 0 0.18em ${({ theme }) => theme.colors.primary},
        0 0 0.5em ${({ theme }) => theme.colors.primary};
      mask: linear-gradient(100deg, transparent 0 41%, #000 48% 52%, transparent 59%) 100% 0 / 240% 100% no-repeat;
      pointer-events: none;
      user-select: none;
      animation: inherit;
    }

    @media (prefers-reduced-motion: reduce) {
      em {
        background-position: 0 0;
      }
    }
  }
`;

/** Runs the glint through a bronzeWord's <em> once, after a delay; reduced motion skips it. */
export const glintOnce = (delayMs: number) => css`
  @media (prefers-reduced-motion: no-preference) {
    animation: ${glint} ${GLINT_S}s ${GLINT_EASE} ${delayMs}ms both;
  }
`;

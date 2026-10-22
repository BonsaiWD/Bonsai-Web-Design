// Shared motion tokens. Import these instead of hard-coding durations and curves.
// Ranges and usage rules live in .claude/skills/bonsai-scroll-motion/SKILL.md.

export const EASE_OUT = [0.16, 1, 0.3, 1] as const; // the curve of theme.transitions.default
export const EASE_REVEAL = [0.22, 1, 0.36, 1] as const; // masked line reveals
export const DUR = { hover: 0.2, state: 0.3, reveal: 0.7, mask: 0.76, hero: 0.9 } as const; // s
export const STAGGER = { item: 0.06, word: 0.07, line: 0.09 } as const; // s
export const RISE = { word: 8, item: 16, max: 24, mask: 30 } as const; // px

/**
 * When this matches, GlobalStyle hides the native cursor and CursorGlow renders.
 * Everywhere else (touch, narrow windows, reduced motion) the native cursor shows.
 * Both read this one string so the two can never disagree.
 */
export const CUSTOM_CURSOR_QUERY =
  '(hover: hover) and (pointer: fine) and (min-width: 769px) and (prefers-reduced-motion: no-preference)';

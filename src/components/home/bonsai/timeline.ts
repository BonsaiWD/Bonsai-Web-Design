import type { BonsaiSource } from './bonsaiField';

/**
 * Where the growing bonsai plays: wide screens with a mouse, motion allowed.
 * Phones, tablets and reduced motion get a still of the finished tree, and
 * the hero text shows at once. CSS and JS both read this one string.
 */
export const BONSAI_INTRO_QUERY =
  '(prefers-reduced-motion: no-preference) and (min-width: 768px) and (hover: hover)';

/*
 * Pacing, as the owner has tuned it (2026-10-29): the whole intro 20%
 * slower, the travelling light (the growth) 30% slower again, and the
 * dissolve and text at half speed.
 */
export const INTRO_PACE = 1.2;
export const GROW_PACE = 1 / 0.7;
export const SETTLE_PACE = 2;

const growStart = 350 * INTRO_PACE;
const growLength = 3550 * INTRO_PACE * GROW_PACE;
/** A moment in the growth, as a fraction of it. */
const inGrowth = (f: number) => growStart + growLength * f;
const dissolveStart = inGrowth(0.89);
const dissolveEnd = dissolveStart + 2200 * INTRO_PACE * SETTLE_PACE;

/*
 * One clock for the whole intro, in ms. Zero is when the H1's CSS animation
 * starts (first paint), so the text never waits on JavaScript or the image:
 * if the canvas is late, it joins the timeline wherever the text already is.
 */
export const INTRO = {
  fadeIn: 700 * INTRO_PACE,
  growStart,
  growEnd: inGrowth(1),
  /** The hero text starts to settle as the tree nears its final form. */
  text: Math.round(inGrowth(0.75)),
  /** How long each line of text takes to settle. */
  textSettle: 1200 * INTRO_PACE * SETTLE_PACE,
  /** Each supporting line follows the one before by this much. */
  textStep: 100 * SETTLE_PACE,
  dissolveStart,
  dissolveEnd,
  /** After this the canvas rests and only redraws on scroll or resize. */
  end: dissolveEnd + 120,
} as const;

/**
 * The default, scroll-driven dissolve holds the hero in place for this much
 * scroll, as a fraction of the viewport height, while the tree turns to light.
 */
export const DISSOLVE_RUNWAY = 0.8;

/** Stand-in until the growth footage arrives: the juniper already on the site. */
export const BONSAI_SOURCE: BonsaiSource = {
  src: '/images/bonsai-divider-4.png',
  width: 1264,
  height: 848,
  crop: { x: 150, y: 45, w: 693, h: 783 },
  seed: { x0: 0.24, x1: 0.4, y: 0.765 },
  rim: 0.775,
  fadeBottom: [0.83, 0.97],
  rootBase: [0.33, 0.86],
};

/**
 * The tree in the pinned hero: this share of the layer's height (capped), its
 * centre this far down the layer. Shared by the canvas, the still and the
 * hero's button, which rests at the pot's rim.
 */
export const TREE = { share: 0.8, max: 780, centre: 0.47 } as const;

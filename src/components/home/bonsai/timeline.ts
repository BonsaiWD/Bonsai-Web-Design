import type { BonsaiSource } from './bonsaiField';

/**
 * Where the growing bonsai plays: wide screens with a mouse, motion allowed.
 * Phones, tablets and reduced motion get a still of the finished tree, and
 * the hero text shows at once. CSS and JS both read this one string.
 */
export const BONSAI_INTRO_QUERY =
  '(prefers-reduced-motion: no-preference) and (min-width: 768px) and (hover: hover)';

/*
 * One clock for the whole intro, in ms. Zero is when the H1's CSS animation
 * starts (first paint), so the text never waits on JavaScript or the image:
 * if the canvas is late, it joins the timeline wherever the text already is.
 */
export const INTRO = {
  fadeIn: 700,
  growStart: 350,
  growEnd: 3900,
  /** The hero text starts to settle as the tree nears its final form. */
  text: 3000,
  dissolveStart: 3500,
  dissolveEnd: 5700,
  /** After this the canvas rests and only redraws on scroll or resize. */
  end: 5800,
} as const;

/** Stand-in until the growth footage arrives: the juniper already on the site. */
export const BONSAI_SOURCE: BonsaiSource = {
  src: '/images/bonsai-divider-4.png',
  width: 1264,
  height: 848,
  crop: { x: 150, y: 45, w: 693, h: 783 },
  seed: { x0: 0.24, x1: 0.4, y: 0.765 },
  rim: 0.775,
};

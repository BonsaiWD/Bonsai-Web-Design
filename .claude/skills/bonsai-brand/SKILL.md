---
name: bonsai-brand
description: Brand and art-direction rules for the Bonsai Web Design marketing site (this repo, bonsaiwebdesign.com). Use for any change to visuals, layout, color, typography, imagery, copy, animation or scroll effects, or a hero/design variation in src/components, src/styles, src/app pages or public/images. Not for API routes, email sending or build config. In this repo it overrides frontend-design, taste-design and web-design-guidelines where they conflict. Load with bonsai-scroll-motion for animation and image-loading rules.
---

# Bonsai brand and art direction

This site is the studio's own portfolio piece. Every choice on it is a claim about the studio's taste: dark, restrained, Japanese-minimal, quiet-luxury editorial.

Restraint governs palette, type and ornament, not scroll choreography. The owner wants bold scroll-driven moments: pinned heroes, image scale and mask reveals, layered parallax depth, type that assembles on scroll. Make them big and few (one or two set-pieces per page), driven by scroll position, and calm at rest. How to build them is in `bonsai-scroll-motion`.

## Who the studio is

- Bonsai Web Design, est. 2022. Two people: David Aaron Shapiro (shown on the site as "Bonsai Web Designer"; design and development) and Jenna Shapiro (Creative Director).
- Pricing: $120/hour; custom websites from $1500 per page; custom add-ons from $250+. Write "$1500" with no comma (owner's choice).
- Hero tagline: "Crafting timeless digital legacies." ("timeless" set in Playfair italic).
- Do not change names, prices, the tagline, client lists or counts ("50+ Projects") without the owner. Never invent clients, stats, awards or testimonials, and never imply a larger agency ("our team of experts").

## Precedence

In this repo, this skill and `bonsai-scroll-motion` win over user-level skills:
- Whatever they say: Inter and Playfair Display stay, the site stays dark, `CursorGlow` stays, and animation uses the installed `framer-motion` (never add the `motion` package).
- `frontend-design`: ignore its push for bold palettes, light/dark variety, extra cursors, gradient meshes, grain and loud display faces. Its craft advice still applies inside these rules.
- `taste-design`: ignore "perpetual micro-motion", its font and cursor bans, and any palette it proposes.
- `web-design-guidelines`: use only when the owner asks for an audit. Its accessibility findings stand; its other rules yield to this skill.
- The owner's explicit instructions in the conversation beat every skill.

## Tokens (`src/styles/theme.ts`)

| Token | Value | Use |
|---|---|---|
| `colors.background` | `#0F1410` | Page ground (deep green-black) |
| `colors.surface` | `#161F19` | Raised panels |
| `colors.secondary` | `#1A261E` | Deep forest fills, scrollbar thumb |
| `colors.primary` | `#C89F81` | Bronze: the single accent. Headings, eyebrows, rules, CTAs |
| `colors.gold` | `#C89F81` | Legacy alias of primary; write `primary` in new code |
| `colors.accent` | `#5D7566` | Sage: ambient glows, large text only (3.7:1 on background, fails body text) |
| `colors.text` | `#E8E6E1` | Bone: display text, high-emphasis copy (14.9:1) |
| `colors.textSecondary` | `#9CA59E` | Body copy (7.3:1) |
| `colors.white` | `#FFFFFF` | Do not use for text or fills; use `text` |
| `colors.error` / `colors.success` | `#CF6679` / `#03DAC6` | Form states only, never decoration |
| `fonts.heading` / `fonts.main` | `var(--font-playfair), 'Playfair Display', serif` / `var(--font-inter), 'Inter', sans-serif` | See Typography |
| `breakpoints` | mobile 375, tablet 768, desktop 1024, wide 1440 (px) | Media queries, Container width |
| `spacing` | xs 4, sm 8, md 16, lg 24, xl 32, xxl 64, xxxl 128 (px) | All margins, padding, gaps |
| `transitions.default` | `all 0.4s cubic-bezier(0.16, 1, 0.3, 1)` | Legacy shorthand; new code names its properties (below) |

Rules:
- Read values from the theme: `${({ theme }) => theme.colors.primary}`. Never introduce a new hex. Existing literals (the Portfolio project gradients `#1a3a2a...`, `rgba(20, 40, 30, ...)` washes, ContactWizard's `rgba(255, 255, 255, ...)` fills) are legacy, not precedent. If the Header still uses `color: white` with `mix-blend-mode: difference`, that pairing is the one sanctioned use of white.
- Bronze at alpha is written `rgba(200, 159, 129, α)` (it is `primary`). Approved alphas:
  - `0.10–0.18`: hairline rules, row dividers, panel borders.
  - `0.25–0.6`: emphasized rules (branch line fades 0.6 to 0.25; tagline left rule and index lead-in at 0.4).
  - `0.55` or more: input borders (3:1 non-text contrast). ContactWizard's 0.15 input borders are legacy.
  - `0.06–0.10`: large washes and radial glows (FeaturedPanel corner glow, row hover sweep).
  - `0.15`: hover halo only, never the focus cue. `0.2`: heading text-shadow `0 2px 12px`, on solid-color headings only.
  - Up to `0.7` only as the glow on a dot of 8px or less.
- Any other token at alpha: ``background: ${({ theme }) => `color-mix(in srgb, ${theme.colors.accent} 18%, transparent)`};``
- Small `primary` or `textSecondary` text: opacity at least 0.75 on `background`, at least 0.85 on `surface`, `secondary` or any panel fill. RowNumber (0.6), RowDomain and RoleLabel (0.7) and the FeaturedPanel Kind/Domain (0.75 on a panel) fall short; do not copy them.
- Transitions keep the 0.4s and the easing but name properties: `transition: color 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);`
- Radii: buttons and inputs are square (`0`); large panels 28px (20px at 768px and below); dots `50%`. The 12–24px radii in About, Pricing, Services and the Portfolio plate are legacy; add no new card radii.

## Focus

GlobalStyle sets `outline: none` on every `button`, and the ContactWizard inputs do too. Every new interactive element restores focus itself. A component class beats the global element selector, so no GlobalStyle change is needed:

```ts
&:focus-visible {
  outline: 1px solid ${({ theme }) => theme.colors.primary}; /* 7.7:1 */
  outline-offset: 3px;
}
```

`MagneticButton` (the contact CTA) has no focus style today. Fix it (and add any shared `focusRing` helper in `src/styles`) in its own PR against `main`, not inside a variation.

## Typography

- **Playfair Display** (`theme.fonts.heading`): headings, index numerals, prices, pull quotes. `next/font` loads it as a variable font with real weights 400–900 only, so `font-weight: 300` in the code renders 400. Write 400 in new code, 500 at most for display, never 700+ on headlines.
- **Italic emphasis**: one word or short phrase per headline in Playfair italic. Outside `GradientText`, color it `primary`. Inside it, `color` is ignored (the parent sets `-webkit-text-fill-color: transparent`), so the word takes the gradient, as the hero's "timeless" does; for a solid bronze word there, also set `-webkit-text-fill-color: currentColor`. A full-italic title is fine for a single name (FeaturedTitle). No italic body copy.
- Section title pattern: 3rem (2.25rem at 768px and below), weight 400, `letter-spacing: 0.05em`, `primary`, wrapped in `GradientText` (the scroll-driven sage-to-bronze sweep is the only sanctioned gradient text). Never put `text-shadow` on `GradientText`: it paints over the clipped gradient (SectionTitle does this today; legacy). Hero h1: 3.5rem, 5rem from tablet, line-height 1.1. Display line-height 1.05–1.2.
- **Inter** (`theme.fonts.main`): body, UI, labels. Body 1–1.2rem, line-height 1.6–1.8, `textSecondary`, measure 420–560px. Weight 300–400; 600 only for button labels.
- Eyebrow and meta labels are uppercase with tracking (not `font-variant: small-caps`):

```ts
const Eyebrow = styled.p`
  font-size: 0.72rem;        /* 0.66–0.75rem; hero pre-title is 0.9rem / 0.2em */
  letter-spacing: 0.22em;    /* 0.3em for a section eyebrow */
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
`;
```

- Separate meta items with the 4px bronze `MetaDot`, not pipes or bullets. It renders only inside a flex parent today; when extracting it, add `display: inline-block; flex-shrink: 0; vertical-align: middle;`.
- Lining numerals are set globally in `GlobalStyle.ts` (Playfair defaults to old-style). For columns of figures write `font-variant-numeric: lining-nums tabular-nums;`; `tabular-nums` alone drops `lining-nums` and brings old-style figures back. Index numbers are zero-padded: "01", "05 Properties".
- Two families only. No mono, no third face, no `<link>` or `@import` fonts. Fonts change only in `src/app/layout.tsx`, and only with the owner.

## Layout language

- Editorial, not template: asymmetric splits (FeaturedPanel's 5fr / 7fr), numbered indices on hairline rows (the Portfolio index), rules and rows over card grids.
- Negative space is content. Do not fill quiet areas with decoration. Feature sections use `spacing.xxxl` vertical padding (`xxl` on mobile).
- Wrap content in `Container` / `Section` from `src/components/layout/Container.tsx` (max-width 1440px, 16px gutter, 24px from tablet). Only imagery goes full-bleed.
- `position: sticky` silently fails inside any ancestor with `overflow: hidden` (or `auto`/`scroll`). Before building a pinned or sticky scene, check every ancestor of the sticky element; clip with `overflow: clip` / `overflow-x: clip` instead, which clips without creating a scroll container.
- Hairlines are 1px bronze at an approved alpha. A fading lead-in rule: `linear-gradient(90deg, rgba(200, 159, 129, 0.4), transparent)`.
- Reuse the existing motifs from `src/components/home/PortfolioSection.tsx`:
  - **Enso ring** (`Enso`): open circle, stroke 1.25, `strokeDasharray="430 73"`, rotated per use; about 0.1 opacity as a watermark, up to 0.55 on small plates.
  - **Bronze branch line** (`Branch` / `BranchNode`): a 1px fading vertical line linking hollow 11px nodes that fill on hover.
  - To use them elsewhere, extract them into `src/components/common`; do not copy-paste.
- Do not invent new motifs, logos, monograms, seals or icon sets without the owner. The wordmark is the text "Bonsai" in uppercase Playfair.
- Use real `<a>` and `<button>` elements: GlobalStyle hides the native cursor on fine pointers and `CursorGlow` scales up only over those.
- Every file that uses styled-components or framer-motion starts with `'use client';`, as every existing component does.

## Imagery

- **Low-key chiaroscuro**: dark ground, one directional light, shadows that fall off into `background`. Reference: `public/images/bonsai-divider-4.png`. Anti-reference: `bonsai-divider-3.png` (bright cream room on a dark page).
- **Muted, film-graded color**: desaturated greens, warm bronze highlights. No teal-orange, HDR, neon or oversaturation.
- **One subject** per frame, art-directed crop with the subject off-center and room to breathe. Set `object-position` per breakpoint; do not let `cover` crop blindly.
- **Consistent subject**: keep species, light direction and grade the same across the page. The junipers are the series; the fern divider and the ficus close-up (`bonsai-divider-1.png`) break it.
- **Where images come from**: only files already in `public/images` or files the owner supplies. Never download images or point at remote URLs (`next.config.mjs` has no `remotePatterns`). Do not edit image files or install image tools.
- **Real photography** for anything presented as the studio, its people, workspace or client work. AI-generated images may only be atmospheric plates and must never pass as the studio or its work. Several current images look AI-generated; do not add more in that role.
- Never put a light-toned image full-bleed on a dark section. Pick a darker existing image, lay a scrim of `background` at about 70% over it (`color-mix`, in the function form above), or ask the owner for a new asset.
- No stock device mockups (floating laptops and phones), handshake/office stock or 3D device renders. Show client work as real screenshots in a hairline frame, or as type-led index rows.
- **Alt text**: informative images say what matters ("Juniper bonsai in a stoneware pot, side-lit against a dark wall"). People get name and role ("Jenna Shapiro, Creative Director"). Decorative plates and dividers get `alt=""`. Never "image of", never keyword stuffing.
- **Implementation**: content images use `next/image`, not CSS `background-image` (ParallaxDivider and StudioSection are legacy). The one above-the-fold image gets `preload` (Next 16 deprecates `priority`) or `loading="eager"` with `fetchPriority="high"`. Never combine `preload` with `priority` or `loading="lazy"`: Next throws. `priority` on the below-the-fold AboutSection headshots is legacy. `sizes` must match the rendered width (`(min-width: 1024px) 58vw, 100vw` for a 7fr column); `100vw` on a narrower image logs a dev warning. Parallax and placeholder rules live in `bonsai-scroll-motion`.

```tsx
'use client';
import Image from 'next/image';
import styled from 'styled-components';

const Frame = styled.div`
  position: relative; aspect-ratio: 3 / 2; overflow: hidden;
  img { object-fit: cover; object-position: 30% 50%; }
  @media (max-width: 768px) { img { object-position: 60% 50%; } }
`;

<Frame>
  <Image src="/images/bonsai-divider-4.png" alt="" fill sizes="100vw" />
</Frame>
```

- Several files have the wrong extension (`bonsai-divider-*.png` and `studio-background.png` are JPEGs, `headshot.jpg` is a PNG). Name new files for their real format, in descriptive kebab-case.

## Voice and copy

- Calm, specific, confident, short. Headlines under about 10 words, sentences under about 20. No exclamation marks.
- Proof over adjectives: name the thing ("One longevity brand, five sites"), give numbers, cite real clients. If the page cannot back a claim, cut it.
- "We" means two people; write that way and address the reader as "you". Use the bonsai metaphor at most once per page, since the name already carries it.
- Avoid: elevate, seamless, cutting-edge, robust, leverage, streamline, next-level, pixel-perfect, bespoke solutions, digital excellence, passionate about, unlock, game-changing, one-stop shop, "we don't just build websites", "refuse to compromise", "start your journey". Never add more. Some existing copy uses these: when you touch such a section, list a proposed rewrite in the PR description and change the copy only once the owner approves.
- Testimonial quotes are the client's own words: never edit, trim or rephrase them, even when they use words from this list.
- CTAs are a verb plus an object ("Start a project", "See the work"). Allow one filled CTA per viewport: bronze fill, `background`-colored text, Inter 600, uppercase, 0.15em tracking, square corners. The secondary action is the outlined variant or a text link with a bronze hairline underline. Never two equal buttons side by side.
- Form and error copy says what happened and how to fix it, without blaming the reader.

## Never

- Purple, neon or rainbow gradients, gradient meshes, or any color outside the tokens.
- Glassmorphism (`backdrop-filter` blur). The glass cards in ServicesSection, PricingSection and ContactWizard, and the MobileMenuOverlay blur, are legacy.
- 3D blobs, orbs, particle fields, starfields or noise/grain overlays on the UI. 3D hover tilt (Pricing, Testimonials) is legacy; add no more without the owner.
- Cursor trails, a second custom cursor, or reviving the unused `CustomCursor.tsx`. `CursorGlow` is the only cursor treatment.
- Glitch, scramble, typewriter or RGB-split text.
- Other companies' logos used as icons (ServicesSection's Figma/Next.js/React/Shopify marks are legacy). A third-party mark appears only to identify that actual thing, such as the footer payment methods.
- Perpetual looping micro-motion: floating, pulsing, breathing, marquees, auto-rotating carousels. Motion answers scroll or input, then rests. TestimonialsSection's 5-second auto-advance is legacy (it also fails WCAG 2.2.2); testimonials advance only on user input.
- Overshoot or bounce easing. A framer-motion spring overshoots when `damping < 2 * sqrt(stiffness * mass)`; CursorGlow's scale spring and the testimonial tilt do today (details in `bonsai-scroll-motion`).
- Emoji in the UI; pure white text or fills (Header's blend is the one exception).
- Styles in `src/app/globals.css` or `page.module.css`. Both are unused create-next-app leftovers.

## Design variations

- A variation changes **layout, imagery and motion** only. Never tokens (`theme.ts`), fonts (`layout.tsx`), `GlobalStyle.ts`, brand facts or claims. Keep existing copy verbatim unless the variation brief the owner approved specifies new copy; any other copy change goes in the PR description as a proposal. If a variation seems to need a token change, stop and ask the owner.
- One variation per branch. Use the branch the session or owner assigns; if you name it yourself, use `claude/hero-<slug>`, cut from `main` (or from an owner-approved groundwork branch that has not merged yet). Each push gets its own Vercel preview. Do not merge variations into each other.
- Treat `main` as production: never push to it directly. A fix every variation needs goes in its own PR against `main`; after the owner merges it, bring it into each variation with `git merge main`. Never rebase or force-push a branch that is already pushed unless the owner asks.
- Each PR states what changed and why in one line, links its Vercel preview, and lists the widths you screenshotted and reviewed. Do not commit screenshots or upload them anywhere.

## Definition of done

- [ ] Only theme tokens; no new hex; bronze alphas come from the approved list.
- [ ] Checked in a real browser at 1440, 900 and 390px, using browser tooling the session already has (do not install global tools). Test 390px with mobile emulation (touch, coarse pointer): a narrow desktop window shows no cursor at all, which is existing behavior, not a regression.
- [ ] No horizontal overflow at any width (`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), nothing clipped.
- [ ] No console errors or new warnings (hydration, `next/image`, React keys).
- [ ] Screenshots of the hero and every changed section taken at each width and actually reviewed against this skill.
- [ ] In the sections this change touches: with `prefers-reduced-motion: reduce` emulated, all content is visible, nothing is stuck at opacity 0 and no parallax runs; every interactive element shows visible focus; text contrast is at least 4.5:1 (3:1 at 24px and up). If a failure comes from shared code (GlobalStyle, Layout, providers), say so in the PR and raise it as a separate PR against `main`.
- [ ] Copy follows Voice rules; studio facts unchanged.
- [ ] `npm run lint`, `npx tsc --noEmit` and `npm run build` all pass.

## Sources

Composition, palette discipline, copy and accessibility ideas are adapted and rewritten for this dark Next.js + styled-components + framer-motion site from **Design Taste** by Mustafa (madebymustafa/design-taste, MIT License, Copyright (c) 2026 Mustafa): `japanese-minimal`, `quiet-luxury`, `editorial-minimal`, `taste-ux-copy`, `taste-accessibility`, `taste-motion`, `taste-web-performance`. Rules that conflict with this site (fixed light palettes, "no dark sections", "no parallax", vanilla-only stacks) were deliberately dropped.

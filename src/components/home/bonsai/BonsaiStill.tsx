'use client';

import Image from 'next/image';
import type { Ref } from 'react';
import styled from 'styled-components';
import { BONSAI_INTRO_QUERY, BONSAI_SOURCE, TREE } from './timeline';

/*
 * The finished tree at its resting opacity, for phones, tablets, reduced
 * motion and browsers without WebGL2. Where it shows, it is the hero's
 * largest image, so it loads eagerly. Where the intro plays it is hidden,
 * and the canvas reads this same <img> (full width on desktop, by `sizes`),
 * so the photo is downloaded once either way.
 */
const Frame = styled.div`
  position: absolute;
  left: 50%;
  top: ${TREE.centre * 100}%;
  height: min(${TREE.share * 100}%, ${TREE.max}px);
  aspect-ratio: 693 / 783;
  transform: translate(-50%, -50%);
  z-index: 1;
  pointer-events: none;
  opacity: 0.3;
  /* Soft sides, and the pot sinks into the page as on desktop */
  mask-image: radial-gradient(closest-side, black 72%, transparent),
    linear-gradient(to bottom, black 78%, transparent 96%);
  mask-composite: intersect;

  img {
    object-fit: cover;
    object-position: 23% 50%;
  }

  @media (max-width: 767px) {
    top: 50%;
    width: min(92%, 440px);
    height: auto;
  }

  @media ${BONSAI_INTRO_QUERY} {
    display: none;

    [data-bonsai='still'] & {
      display: block;
    }
  }
`;

export default function BonsaiStill({ imgRef }: { imgRef?: Ref<HTMLImageElement> }) {
  return (
    <Frame>
      <Image
        ref={imgRef}
        src={BONSAI_SOURCE.src}
        alt=""
        fill
        loading="eager"
        sizes="(max-width: 767px) 92vw, 1264px"
      />
    </Frame>
  );
}

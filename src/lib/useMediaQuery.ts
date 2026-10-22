'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query. Returns false on the server and during
 * hydration (server snapshot), then the live value, so rendered output
 * never mismatches between server and client.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/** Hydration-safe replacement for framer-motion's useReducedMotion(). */
export const useReducedMotionSafe = () => useMediaQuery('(prefers-reduced-motion: reduce)');

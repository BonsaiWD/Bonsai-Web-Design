'use client';

import { useSyncExternalStore } from 'react';
import { formatDate, formatShortDate } from '@/lib/portal-format';

/*
 * Days and times in the viewer's own time zone. The server cannot know it, so the server and
 * the first browser render both use UTC, and React re-renders with the real zone straight
 * after hydration (useSyncExternalStore's server snapshot), without a mismatch.
 */

const noSubscription = () => () => {};

export function useTimeZone(): string {
  return useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    () => 'UTC',
  );
}

// Shortcut hints name the key the reader actually has
export function useIsApple(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, kind: 'day' | 'time' | 'full'): Intl.DateTimeFormat {
  const key = `${timeZone}|${kind}`;
  let found = formatters.get(key);
  if (!found) {
    const options: Intl.DateTimeFormatOptions =
      kind === 'day'
        ? { year: 'numeric', month: '2-digit', day: '2-digit' }
        : kind === 'time'
          ? { hour: 'numeric', minute: '2-digit' }
          : { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
    // en-CA writes days as YYYY-MM-DD, which sorts and compares as a calendar day
    found = new Intl.DateTimeFormat(kind === 'day' ? 'en-CA' : 'en-US', { ...options, timeZone });
    formatters.set(key, found);
  }
  return found;
}

// "2026-11-08": the calendar day a moment falls on, where the reader is
export function dayKey(iso: string, timeZone: string): string {
  return formatter(timeZone, 'day').format(new Date(iso));
}

// "3:04 PM"
export function timeOfDay(iso: string, timeZone: string): string {
  return formatter(timeZone, 'time').format(new Date(iso));
}

// "Nov 8, 2026, 3:04 PM EST", for the tooltip and screen readers
export function fullMoment(iso: string, timeZone: string): string {
  return formatter(timeZone, 'full').format(new Date(iso));
}

function previousDay(key: string): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// "Today", "Yesterday", "Nov 8", or "Nov 8, 2025" for another year
export function dayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return 'Today';
  if (key === previousDay(todayKey)) return 'Yesterday';
  return key.slice(0, 4) === todayKey.slice(0, 4) ? formatShortDate(key) : formatDate(key);
}

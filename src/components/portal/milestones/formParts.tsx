'use client';

import { Fragment, useEffect, type ReactNode } from 'react';
import { useFormStatusState } from '../ui';

/*
 * React resets a form after each action, and a <select> resets to the option it was first
 * rendered with, not to its current defaultValue. Remounting the fields after every result
 * makes every control, selects and checkboxes included, start from useField's values: what
 * was submitted after an error, what was saved after a success.
 */
export function FreshFields({ children, saved = '' }: { children: ReactNode; saved?: string }) {
  const { state } = useFormStatusState();
  return <Fragment key={`${saved}:${state?.at ?? 0}`}>{children}</Fragment>;
}

// Tells a dialog while the action runs, so Escape cannot close it halfway
export function PendingReporter({ onChange }: { onChange: (pending: boolean) => void }) {
  const { pending } = useFormStatusState();
  useEffect(() => onChange(pending), [pending, onChange]);
  return null;
}

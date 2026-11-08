import type { VersionStatus } from '@/db/schema';
import type { StatusTone } from '../ui/feedback';
import type { Perspective, VersionView } from './types';

// A version's status as each side reads it: the client hears what it means for them, the
// studio reads the state
const LABELS: Record<VersionStatus, { client: string; studio: string; clientTone: StatusTone; studioTone: StatusTone }> = {
  in_review: { client: 'Needs your review', studio: 'With client', clientTone: 'action', studioTone: 'active' },
  changes_requested: { client: "We're making your changes", studio: 'Changes requested', clientTone: 'active', studioTone: 'alert' },
  approved: { client: 'Approved', studio: 'Approved', clientTone: 'done', studioTone: 'done' },
  delivered: { client: 'Delivered', studio: 'Delivered', clientTone: 'done', studioTone: 'done' },
  superseded: { client: 'Replaced', studio: 'Superseded', clientTone: 'muted', studioTone: 'muted' },
  withdrawn: { client: 'Withdrawn', studio: 'Withdrawn', clientTone: 'muted', studioTone: 'muted' },
};

export function versionLabel(status: VersionStatus, perspective: Perspective): { label: string; tone: StatusTone } {
  const entry = LABELS[status];
  return perspective === 'client' ? { label: entry.client, tone: entry.clientTone } : { label: entry.studio, tone: entry.studioTone };
}

// The card's headline status. A current version that was superseded means the newer one was
// withdrawn, so a new version is on its way.
export function cardStatus(current: VersionView | null, perspective: Perspective): { label: string; tone: StatusTone } {
  if (!current) return { label: 'Not shared', tone: 'muted' };
  if (current.status === 'superseded') {
    return perspective === 'client' ? { label: 'New version on the way', tone: 'active' } : { label: 'Needs a new version', tone: 'alert' };
  }
  return versionLabel(current.status, perspective);
}

export type GroupKey = 'review' | 'changes' | 'next' | 'done';

// Groups in reading order: what needs the viewer comes first
export function groupOf(current: VersionView | null): GroupKey {
  const status = current?.status;
  if (status === 'in_review') return 'review';
  if (status === 'changes_requested') return 'changes';
  if (status === 'approved' || status === 'delivered') return 'done';
  return 'next';
}

export const GROUP_ORDER: Record<Perspective, GroupKey[]> = {
  client: ['review', 'changes', 'next', 'done'],
  studio: ['changes', 'next', 'review', 'done'],
};

export const GROUP_TITLES: Record<Perspective, Record<GroupKey, string>> = {
  client: {
    review: 'Needs your review',
    changes: 'We are working on these',
    next: 'New versions on the way',
    done: 'Approved and delivered',
  },
  studio: {
    review: 'With the client',
    changes: 'Changes requested',
    next: 'Needs a new version',
    done: 'Approved and delivered',
  },
};

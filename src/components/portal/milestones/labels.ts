import type { MilestoneStatus, VersionStatus } from '@/db/schema';
import { MILESTONE_LABELS } from '../labels';
import type { StatusTone } from '../ui';

export const STATUS_OPTIONS: { value: MilestoneStatus; label: string }[] = (
  ['upcoming', 'in_progress', 'waiting_on_client', 'done'] as const
).map((value) => ({ value, label: MILESTONE_LABELS[value].studio }));

// How a linked deliverable reads on a milestone, matching the Deliverables tab's wording
export const DELIVERABLE_LABELS: Partial<Record<VersionStatus, { client: string; studio: string; tone: StatusTone }>> = {
  in_review: { client: 'Needs your review', studio: 'With client', tone: 'action' },
  changes_requested: { client: "We're making your changes", studio: 'Changes requested', tone: 'alert' },
  approved: { client: 'Approved', studio: 'Approved', tone: 'done' },
  delivered: { client: 'Delivered', studio: 'Delivered', tone: 'done' },
};

export const RECORD_METHODS = [
  { value: 'email', label: 'By email' },
  { value: 'phone', label: 'By phone' },
  { value: 'call', label: 'On a video call' },
  { value: 'in_person', label: 'In person' },
] as const;

// "01", "02": the index rows' zero-padded numbering
export const indexLabel = (position: number) => String(position).padStart(2, '0');

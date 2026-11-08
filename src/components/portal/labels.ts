import type { MilestoneStatus, ProjectStage } from '@/db/schema';
import type { StatusTone } from './ui/feedback';

// The stages a project moves through, in order; on_hold sits outside the sequence
export const STAGE_SEQUENCE: ProjectStage[] = ['discovery', 'design', 'development', 'review', 'launched'];

export const STAGE_LABELS: Record<ProjectStage, string> = {
  discovery: 'Discovery',
  design: 'Design',
  development: 'Development',
  review: 'Review',
  launched: 'Launched',
  on_hold: 'On hold',
};

export const STAGE_TONES: Record<ProjectStage, StatusTone> = {
  discovery: 'active',
  design: 'active',
  development: 'active',
  review: 'active',
  launched: 'done',
  on_hold: 'muted',
};

// Milestone status as each side reads it: the client sees "Waiting on you"
export const MILESTONE_LABELS: Record<MilestoneStatus, { client: string; studio: string; tone: StatusTone }> = {
  upcoming: { client: 'Upcoming', studio: 'Upcoming', tone: 'muted' },
  in_progress: { client: 'In progress', studio: 'In progress', tone: 'active' },
  waiting_on_client: { client: 'Waiting on you', studio: 'Waiting on client', tone: 'action' },
  done: { client: 'Done', studio: 'Done', tone: 'done' },
};

// Error codes Better Auth adds to the sign-in URL when a link from the email cannot be used
const LINK_ERRORS: Record<string, string> = {
  INVALID_TOKEN: 'That sign-in link has expired or was already used. Enter your email for a new one.',
};

export function linkErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return LINK_ERRORS[code] ?? 'We could not sign you in with that link. Enter your email for a new one.';
}

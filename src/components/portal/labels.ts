import type { MilestoneStatus, ProjectStage } from '@/db/schema';

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

export const MILESTONE_LABELS: Record<MilestoneStatus, string> = {
  upcoming: 'Upcoming',
  in_progress: 'In progress',
  waiting_on_client: 'Waiting on you',
  done: 'Done',
};

// Error codes Better Auth adds to the sign-in URL when a link from the email cannot be used
const LINK_ERRORS: Record<string, string> = {
  INVALID_TOKEN: 'That sign-in link has expired or was already used. Enter your email for a new one.',
};

export function linkErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return LINK_ERRORS[code] ?? 'We could not sign you in with that link. Enter your email for a new one.';
}

const dateFormat =new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  // Dates are stored without a time; UTC keeps server and browser on the same day
  timeZone: 'UTC',
});

// "2027-03-04" -> "Mar 4, 2027"
export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

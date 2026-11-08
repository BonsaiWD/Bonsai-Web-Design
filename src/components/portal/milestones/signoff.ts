import type { MilestoneStatus } from '@/db/schema';

/*
 * "Requires sign-off" means the milestone will need the client's initials. They are asked for
 * only once the step is waiting on them and no linked deliverable is still in review (the
 * review comes first; approving it moves the milestone on). The page, the attention items,
 * the deadlines and the sign-off action all use this one rule.
 */
export function asksForInitials(m: { requiresSignoff: boolean; signed: boolean; status: MilestoneStatus; reviewPending: boolean }): boolean {
  return m.requiresSignoff && !m.signed && m.status === 'waiting_on_client' && !m.reviewPending;
}

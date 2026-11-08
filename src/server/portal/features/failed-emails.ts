import 'server-only';
import { and, asc, eq, gte, inArray, isNotNull, like, or, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { activity, project, user } from '@/db/schema';
import { projectScope, type FeatureContext } from '../attention';
import { STUDIO_EMAIL } from '../notify';

/*
 * Emails that never arrived, so the studio can follow up. emailNote tells the studio a failed
 * email "is flagged on your dashboard", so every feature that sends one flags it here, the
 * same way:
 * - a failure is listed for 14 days;
 * - it clears once a later email about the same thing reaches the same address on that
 *   project (Email again, a reminder, a receipt);
 * - the feature drops it once it no longer matters (the item was deleted, signed, removed);
 * - the title reads "The email to <who> about <what> could not be sent" (failedEmailTitle).
 */

export const FAILED_EMAIL_DAYS = 14;

export interface FailedEmail {
  id: string;
  kind: string;
  summary: string;
  emailTo: string;
  createdAt: Date;
  projectId: string;
  projectName: string;
  // Who it was for, in the studio's words: the client's name, "the studio", or the address
  who: string;
  // What it was about, from subjectOf (usually the item's id)
  subject: string | null;
}

interface Options {
  // Prefixes of the activity kinds whose failures are flagged: the feature's FLAGGED_EMAIL_KINDS
  kinds: readonly string[];
  // What an email is about, read from its kind. A failure clears once a later email about the
  // same thing reaches the same address; null means "this kind only".
  subjectOf: (kind: string) => string | null;
  // Prefixes of further kinds whose emails also clear a failure ('' for any email at all)
  clearedBy?: readonly string[];
}

export function failedEmailTitle(who: string, about: string | null | undefined): string {
  return about ? `The email to ${who} about ${about} could not be sent` : `The email to ${who} could not be sent`;
}

export async function failedEmails(context: FeatureContext, options: Options): Promise<FailedEmail[]> {
  const prefixes = [...options.kinds, ...(options.clearedBy ?? [])];
  const rows = await getDb()
    .select({
      id: activity.id,
      kind: activity.kind,
      summary: activity.summary,
      emailTo: activity.emailTo,
      emailStatus: activity.emailStatus,
      createdAt: activity.createdAt,
      projectId: project.id,
      projectName: project.name,
      clientName: user.name,
      clientEmail: user.email,
    })
    .from(activity)
    .innerJoin(project, eq(project.id, activity.projectId))
    .innerJoin(user, eq(user.id, project.clientId))
    .where(
      and(
        projectScope(context),
        or(...prefixes.map((prefix) => like(activity.kind, `${prefix}%`))),
        isNotNull(activity.emailTo),
        inArray(activity.emailStatus, ['sent', 'failed']),
        gte(activity.createdAt, sql`now() - make_interval(days => ${FAILED_EMAIL_DAYS})`),
      ),
    )
    .orderBy(asc(activity.createdAt));

  const flagged = (kind: string) => options.kinds.some((prefix) => kind.startsWith(prefix));
  const failures: FailedEmail[] = [];
  for (const [index, row] of rows.entries()) {
    if (row.emailStatus !== 'failed' || !row.emailTo || !flagged(row.kind)) continue;
    const subject = options.subjectOf(row.kind);
    const cleared = rows.slice(index + 1).some((later) => {
      if (later.emailStatus !== 'sent' || later.emailTo !== row.emailTo || later.projectId !== row.projectId) return false;
      return subject === null ? later.kind === row.kind : options.subjectOf(later.kind) === subject;
    });
    if (cleared) continue;
    const who =
      row.emailTo === row.clientEmail ? row.clientName.trim() || row.clientEmail : row.emailTo === STUDIO_EMAIL ? 'the studio' : row.emailTo;
    failures.push({
      id: row.id,
      kind: row.kind,
      summary: row.summary,
      emailTo: row.emailTo,
      createdAt: row.createdAt,
      projectId: row.projectId,
      projectName: row.projectName,
      who,
      subject,
    });
  }
  return failures;
}

import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNull, like, lt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '@/db';
import { activity, file, project, rateLimit, user } from '@/db/schema';
import type { ProjectFileView } from '@/components/portal/files/types';
import { plural } from '@/lib/portal-format';
import { ActionError } from '../actions';
import { projectScope, type AttentionItem, type FeatureContext, type Perspective, type PortalFeature } from '../attention';
import { INLINE_TYPES, MAX_UPLOAD_BYTES } from '../storage';
import { failedEmails, failedEmailTitle } from './failed-emails';
import { countInWindow, uncountInWindow } from '../throttle';
import { FLAGGED_EMAIL_KINDS, kindItemId, kindMaker } from '../kinds';
import { summaryWithText, textFromSummary } from '../notify';

/* ---------- Activity ----------
   The file table has no column for the note an uploader writes, so it travels in the
   upload's activity summary: "<who> shared <filename>. Note: <note>". The filename never
   changes, so the note can be read back reliably. */

export const FILE_KINDS = { shared: 'file.shared', removed: 'file.removed' } as const;

export const fileKind = kindMaker(FILE_KINDS);

// `who` is null for the studio, whose summaries read "Shared <filename>" like its other entries
export function sharedSummary(who: string | null, filename: string, note: string | null): string {
  return summaryWithText(who ? `${who} shared ${filename}` : `Shared ${filename}`, 'Note', note);
}

export const fileAnchor = (fileId: string) => `file-${fileId}`;

/* ---------- Page data ---------- */

const uploader = alias(user, 'uploader');
const remover = alias(user, 'remover');

// clientId is the project's client now: after a move to another client, what the previous one
// shared is theirs, not the new client's ("From you")
export async function loadProjectFiles(
  projectId: string,
  perspective: Perspective,
  viewerId: string,
  clientId: string,
): Promise<ProjectFileView[]> {
  const db = getDb();
  const studio = perspective === 'studio';

  const [rows, shared, removals] = await Promise.all([
    db
      .select({
        id: file.id,
        filename: file.filename,
        sizeBytes: file.sizeBytes,
        contentType: file.contentType,
        createdAt: file.createdAt,
        removedAt: file.removedAt,
        uploadedBy: file.uploadedBy,
        uploaderName: sql<string>`coalesce(nullif(${uploader.name}, ''), ${uploader.email})`,
        uploaderRole: uploader.role,
      })
      .from(file)
      .innerJoin(uploader, eq(uploader.id, file.uploadedBy))
      // Removed files are gone for the client: the query never returns them
      .where(and(eq(file.projectId, projectId), eq(file.purpose, 'project_file'), studio ? undefined : isNull(file.removedAt)))
      .orderBy(desc(file.createdAt), desc(file.id)),
    db
      .select({ kind: activity.kind, summary: activity.summary })
      .from(activity)
      .where(and(eq(activity.projectId, projectId), like(activity.kind, `${FILE_KINDS.shared}:%`))),
    studio
      ? db
          .select({ kind: activity.kind, createdAt: activity.createdAt, byName: remover.name })
          .from(activity)
          .leftJoin(remover, eq(remover.id, activity.actorId))
          .where(and(eq(activity.projectId, projectId), like(activity.kind, `${FILE_KINDS.removed}:%`)))
          .orderBy(desc(activity.createdAt))
      : Promise.resolve([]),
  ]);

  const summaries = new Map<string, string>();
  for (const row of shared) {
    const id = kindItemId(row.kind);
    if (id) summaries.set(id, row.summary);
  }
  const removedBy = new Map<string, { at: string; byName: string | null }>();
  for (const row of removals) {
    const id = kindItemId(row.kind);
    if (id && !removedBy.has(id)) removedBy.set(id, { at: row.createdAt.toISOString(), byName: row.byName || null });
  }

  return rows.map((row) => {
    const summary = summaries.get(row.id);
    return {
      id: row.id,
      filename: row.filename,
      sizeBytes: row.sizeBytes,
      previewable: INLINE_TYPES.has(row.contentType),
      uploadedAt: row.createdAt.toISOString(),
      side: row.uploaderRole === 'admin' ? 'studio' : row.uploadedBy === clientId ? 'client' : 'former',
      // Which of the two of us uploaded it matters to the studio only
      uploadedByName: studio || row.uploaderRole !== 'admin' ? row.uploaderName : 'the studio',
      mine: row.uploadedBy === viewerId,
      note: summary ? textFromSummary(summary, 'Note', `hared ${row.filename}`) : null,
      ...(studio
        ? {
            removed: row.removedAt ? (removedBy.get(row.id) ?? { at: row.removedAt.toISOString(), byName: null }) : null,
          }
        : {}),
    } satisfies ProjectFileView;
  });
}

/* ---------- Double submits ----------
   storeUpload creates the file row itself, so the form's id cannot be the row's id. Instead
   each form submission claims its id once; a second submit of the same form finds the claim
   and uploads nothing. Claims only need to outlive a retry, so old ones are cleared. */

const uploadKey = (uploadId: string) => `portal:upload:${uploadId}`;
const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;

export async function claimUpload(uploadId: string): Promise<boolean> {
  const db = getDb();
  const now = Date.now();
  await db.delete(rateLimit).where(and(like(rateLimit.key, 'portal:upload:%'), lt(rateLimit.lastRequest, now - CLAIM_TTL_MS)));
  const claimed = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key: uploadKey(uploadId), count: 1, lastRequest: now })
    .onConflictDoNothing({ target: rateLimit.key })
    .returning({ id: rateLimit.id });
  return claimed.length > 0;
}

// A failed upload must not block the corrected retry from the same form
export async function releaseUpload(uploadId: string): Promise<void> {
  await getDb()
    .delete(rateLimit)
    .where(eq(rateLimit.key, uploadKey(uploadId)));
}

/* ---------- Client upload limits ----------
   How much one client can upload in a day, across the Files tab and signed contract copies,
   so a looping script or a stolen session can't fill storage. One rate_limit row per measure,
   as in auth.ts: last_request holds when the 24-hour window started. Studio uploads are not
   limited. */

export const UPLOAD_QUOTA = { files: 50, bytes: 100 * 1024 * 1024, windowMs: 24 * 60 * 60 * 1000 } as const;

const quotaKey = (measure: 'files' | 'bytes', userId: string) => `portal:upload-quota:${measure}:${userId}`;

export interface QuotaClaim {
  userId: string;
  bytes: number;
  at: number;
}

function quotaRefusal(waitMs: number): string {
  const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
  const when = minutes < 60 ? `in ${plural(minutes, 'minute')}` : `in about ${plural(Math.max(1, Math.round(minutes / 60)), 'hour')}`;
  const mb = Math.round(UPLOAD_QUOTA.bytes / (1024 * 1024));
  return `You've reached the upload limit for today (${UPLOAD_QUOTA.files} files or ${mb} MB a day). You can upload more ${when}. If it can't wait, send us a link in Messages.`;
}

// Counts an upload before it is stored, or refuses it with when the client can try again.
// Both measures move together: a refusal rolls the transaction back, so it counts nothing.
export async function claimUploadQuota(userId: string, bytes: number): Promise<QuotaClaim> {
  const now = Date.now();
  // storeUpload refuses anything over the per-file limit (and the claim is then refunded), so
  // counting at most that keeps the number a small integer
  const size = Math.min(Math.max(0, Math.ceil(bytes)), MAX_UPLOAD_BYTES);
  await getDb().transaction(async (tx) => {
    let resetAt = 0;
    const measures = [
      ['files', 1, UPLOAD_QUOTA.files],
      ['bytes', size, UPLOAD_QUOTA.bytes],
    ] as const;
    for (const [measure, amount, max] of measures) {
      const { count, windowStart } = await countInWindow(quotaKey(measure, userId), amount, UPLOAD_QUOTA.windowMs, { db: tx, now });
      if (count > max) resetAt = Math.max(resetAt, windowStart + UPLOAD_QUOTA.windowMs);
    }
    if (resetAt) throw new ActionError(quotaRefusal(resetAt - now));
  });
  return { userId, bytes: size, at: now };
}

// An upload that was refused or failed after its claim gives it back (within the same window)
export async function refundUploadQuota(claim: QuotaClaim): Promise<void> {
  await Promise.all([
    uncountInWindow(quotaKey('files', claim.userId), 1, claim.at),
    uncountInWindow(quotaKey('bytes', claim.userId), claim.bytes, claim.at),
  ]).catch((error) => console.error('[portal files] upload quota refund', error));
}

/* ---------- Upload emails ----------
   A client's uploads email the studio at most once per project every 10 minutes
   (claimRateSlot); later ones land in the activity feed and the dashboard's "new files" item. */

export const UPLOAD_EMAIL_GAP_MS = 10 * 60 * 1000;
export const uploadEmailKey = (projectId: string) => `portal:upload-email:${projectId}`;

/* ---------- Attention ---------- */

// New files from clients in the last week, one item per project
async function studioAttention(context: FeatureContext): Promise<AttentionItem[]> {
  const rows = await getDb()
    .select({
      id: file.id,
      filename: file.filename,
      createdAt: file.createdAt,
      projectId: project.id,
      projectName: project.name,
      uploaderName: sql<string>`coalesce(nullif(${uploader.name}, ''), ${uploader.email})`,
    })
    .from(file)
    .innerJoin(project, eq(project.id, file.projectId))
    .innerJoin(uploader, eq(uploader.id, file.uploadedBy))
    .where(
      and(
        eq(file.purpose, 'project_file'),
        isNull(file.removedAt),
        ne(uploader.role, 'admin'),
        gte(file.createdAt, sql`now() - interval '7 days'`),
        projectScope(context),
      ),
    )
    .orderBy(desc(file.createdAt));

  const byProject = new Map<string, typeof rows>();
  for (const row of rows) byProject.set(row.projectId, [...(byProject.get(row.projectId) ?? []), row]);

  return [...byProject.values()].map((list) => {
    const newest = list[0];
    const names = [...new Set(list.map((row) => row.uploaderName))];
    const who = names.length === 1 ? names[0] : 'Your client';
    const shown = list.slice(0, 3).map((row) => row.filename);
    return {
      key: `files-new:${newest.projectId}`,
      projectId: newest.projectId,
      projectName: newest.projectName,
      tab: 'files' as const,
      anchor: list.length === 1 ? fileAnchor(newest.id) : undefined,
      title: list.length === 1 ? `${who} shared ${newest.filename}` : `${who} shared ${list.length} files`,
      detail:
        list.length > 1 ? `${shown.join(', ')}${list.length > shown.length ? `, and ${list.length - shown.length} more` : ''}` : undefined,
      since: newest.createdAt.toISOString(),
      tone: 'info' as const,
    };
  });
}

// Failed emails about shared files, flagged as every feature flags them (failed-emails.ts).
// One about a file that has since been removed no longer matters.
async function failedEmailItems(context: FeatureContext): Promise<AttentionItem[]> {
  const emails = await failedEmails(context, { kinds: FLAGGED_EMAIL_KINDS.file, subjectOf: kindItemId });
  const ids = [...new Set(emails.map((row) => row.subject).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];
  const files = await getDb()
    .select({ id: file.id, filename: file.filename })
    .from(file)
    .where(and(inArray(file.id, ids), isNull(file.removedAt)));
  const names = new Map(files.map((row) => [row.id, row.filename]));
  const items: AttentionItem[] = [];
  for (const row of emails) {
    const filename = row.subject ? names.get(row.subject) : undefined;
    if (!row.subject || !filename) continue;
    items.push({
      key: `file-email:${row.id}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'files',
      anchor: fileAnchor(row.subject),
      title: failedEmailTitle(row.who, filename),
      detail: row.summary,
      since: row.createdAt.toISOString(),
      tone: 'alert',
    });
  }
  return items;
}

export const filesFeature: PortalFeature = {
  async attention(context) {
    if (context.perspective !== 'studio') return [];
    const [shared, failed] = await Promise.all([studioAttention(context), failedEmailItems(context)]);
    return [...shared, ...failed];
  },
  // Files carry no due dates
  deadlines: async () => [],
};

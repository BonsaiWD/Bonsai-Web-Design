import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, isNull, like, lt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '@/db';
import { activity, file, project, rateLimit, user } from '@/db/schema';
import type { ProjectFileView } from '@/components/portal/files/types';
import { plural } from '@/lib/portal-format';
import { isUuid } from '../access';
import { ActionError } from '../actions';
import { projectScope, type AttentionItem, type FeatureContext, type Perspective, type PortalFeature } from '../attention';
import { INLINE_TYPES, MAX_UPLOAD_BYTES } from '../storage';

/* ---------- Activity ----------
   The file table has no column for the note an uploader writes, so it travels in the
   upload's activity summary: "<who> shared <filename>. Note: <note>". The filename never
   changes, so the note can be read back reliably. */

export const FILE_KINDS = { shared: 'file.shared', removed: 'file.removed' } as const;

export function fileKind(event: keyof typeof FILE_KINDS, fileId: string): string {
  return `${FILE_KINDS[event]}:${fileId}`;
}

function fileIdOf(kind: string): string | null {
  const id = kind.split(':')[1];
  return isUuid(id) ? id : null;
}

const NOTE_MARKER = '. Note: ';

// `who` is null for the studio, whose summaries read "Shared <filename>" like its other entries
export function sharedSummary(who: string | null, filename: string, note: string | null): string {
  const base = who ? `${who} shared ${filename}` : `Shared ${filename}`;
  return note ? `${base}${NOTE_MARKER}${note}` : base;
}

export function noteFromSummary(summary: string, filename: string): string | null {
  const marker = `hared ${filename}${NOTE_MARKER}`;
  const at = summary.indexOf(marker);
  return at >= 0 ? summary.slice(at + marker.length) || null : null;
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
    const id = fileIdOf(row.kind);
    if (id) summaries.set(id, row.summary);
  }
  const removedBy = new Map<string, { at: string; byName: string | null }>();
  for (const row of removals) {
    const id = fileIdOf(row.kind);
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
      note: summary ? noteFromSummary(summary, row.filename) : null,
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
  const expired = now - UPLOAD_QUOTA.windowMs;
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
      const result = await tx.execute<{ count: number; last_request: string }>(sql`
        INSERT INTO rate_limit (id, key, count, last_request)
        VALUES (gen_random_uuid()::text, ${quotaKey(measure, userId)}, ${amount}::int, ${now})
        ON CONFLICT (key) DO UPDATE SET
          count = CASE WHEN rate_limit.last_request < ${expired} THEN ${amount}::int ELSE rate_limit.count + ${amount}::int END,
          last_request = CASE WHEN rate_limit.last_request < ${expired} THEN ${now} ELSE rate_limit.last_request END
        RETURNING count, last_request`);
      const row = result.rows[0];
      if (row && Number(row.count) > max) resetAt = Math.max(resetAt, Number(row.last_request) + UPLOAD_QUOTA.windowMs);
    }
    if (resetAt) throw new ActionError(quotaRefusal(resetAt - now));
  });
  return { userId, bytes: size, at: now };
}

// An upload that was refused or failed after its claim gives it back (within the same window)
export async function refundUploadQuota(claim: QuotaClaim): Promise<void> {
  await getDb()
    .execute(
      sql`UPDATE rate_limit
          SET count = greatest(count - CASE WHEN key = ${quotaKey('files', claim.userId)} THEN 1 ELSE ${claim.bytes}::int END, 0)
          WHERE key IN (${quotaKey('files', claim.userId)}, ${quotaKey('bytes', claim.userId)}) AND last_request <= ${claim.at}`,
    )
    .catch((error) => console.error('[portal files] upload quota refund', error));
}

/* ---------- Upload emails ----------
   A client's uploads email the studio at most once per project every 10 minutes; later ones
   land in the activity feed and the dashboard's "new files" item. The claim is one conditional
   upsert, so two uploads at the same moment cannot both send. */

const UPLOAD_EMAIL_GAP_MS = 10 * 60 * 1000;
const uploadEmailKey = (projectId: string) => `portal:upload-email:${projectId}`;

export async function claimUploadEmail(projectId: string): Promise<boolean> {
  const now = Date.now();
  const claimed = await getDb()
    .insert(rateLimit)
    .values({ id: randomUUID(), key: uploadEmailKey(projectId), count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: sql`${rateLimit.count} + 1`, lastRequest: now },
      setWhere: sql`${rateLimit.lastRequest} <= ${now - UPLOAD_EMAIL_GAP_MS}`,
    })
    .returning({ id: rateLimit.id });
  return claimed.length > 0;
}

// An email that did not go out should not hold back the next one
export async function releaseUploadEmail(projectId: string): Promise<void> {
  await getDb()
    .delete(rateLimit)
    .where(eq(rateLimit.key, uploadEmailKey(projectId)))
    .catch(() => undefined);
}

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

export const filesFeature: PortalFeature = {
  async attention(context) {
    return context.perspective === 'studio' ? studioAttention(context) : [];
  },
  // Files carry no due dates
  deadlines: async () => [],
};

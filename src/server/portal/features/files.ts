import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, isNull, like, lt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '@/db';
import { activity, file, project, rateLimit, user } from '@/db/schema';
import type { ProjectFileView } from '@/components/portal/files/types';
import { isUuid } from '../access';
import { projectScope, type AttentionItem, type FeatureContext, type Perspective, type PortalFeature } from '../attention';
import { INLINE_TYPES } from '../storage';

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

export async function loadProjectFiles(projectId: string, perspective: Perspective, viewerId: string): Promise<ProjectFileView[]> {
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
      side: row.uploaderRole === 'admin' ? 'studio' : 'client',
      uploadedByName: row.uploaderName,
      mine: row.uploadedBy === viewerId,
      note: summary ? noteFromSummary(summary, row.filename) : null,
      ...(studio
        ? {
            removed: row.removedAt
              ? (removedBy.get(row.id) ?? { at: row.removedAt.toISOString(), byName: null })
              : null,
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
  await getDb().delete(rateLimit).where(eq(rateLimit.key, uploadKey(uploadId)));
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
      detail: list.length > 1 ? `${shown.join(', ')}${list.length > shown.length ? `, and ${list.length - shown.length} more` : ''}` : undefined,
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

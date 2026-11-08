import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, like, ne, notExists, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '@/db';
import {
  activity,
  deliverable,
  deliverableVersion,
  file,
  milestone,
  milestoneSignoff,
  project,
  rateLimit,
  user,
  type MilestoneStatus,
  type VersionStatus,
} from '@/db/schema';
import type { DeliverableView, MilestoneOption, Perspective, VersionView } from '@/components/portal/deliverables/types';
import type { EmailContent } from '@/lib/email';
import { firstName, formatDate } from '@/lib/portal-format';
import { isUuid, type PortalProject } from '../access';
import { projectScope, type AttentionItem, type DeadlineItem, type FeatureContext, type PortalFeature } from '../attention';
import { STUDIO_EMAIL } from '../notify';
import { INLINE_TYPES } from '../storage';

type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/* ---------- Activity kinds ----------
   Activity rows carry the deliverable's id in their kind ("deliverable.shared:<id>"), so the
   page can say when the client was last emailed about a version and a failed email can link
   back to its card. `target` stays the tab name, as every feed expects. */

const KINDS = {
  shared: 'deliverable.shared',
  reminded: 'deliverable.reminded',
  approved: 'deliverable.approved',
  changes: 'deliverable.changes_requested',
  receipt: 'deliverable.receipt',
  linkFixed: 'deliverable.link_fixed',
  withdrawn: 'deliverable.withdrawn',
  edited: 'deliverable.edited',
  deleted: 'deliverable.deleted',
} as const;

export function activityKind(event: keyof typeof KINDS, deliverableId: string): string {
  return `${KINDS[event]}:${deliverableId}`;
}

function deliverableIdOf(kind: string): string | null {
  const id = kind.split(':')[1];
  return isUuid(id) ? id : null;
}

export const deliverableAnchor = (deliverableId: string) => `deliverable-${deliverableId}`;

/* ---------- Page data ---------- */

const sharer = alias(user, 'sharer');
const decider = alias(user, 'decider');

export async function loadDeliverables(
  forProject: Pick<PortalProject, 'id' | 'clientEmail'>,
  perspective: Perspective,
): Promise<DeliverableView[]> {
  const db = getDb();
  const studio = perspective === 'studio';

  const [items, rows, records, emails] = await Promise.all([
    db
      .select({
        id: deliverable.id,
        title: deliverable.title,
        description: deliverable.description,
        latestVersion: deliverable.latestVersion,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
      })
      .from(deliverable)
      .leftJoin(milestone, eq(milestone.id, deliverable.milestoneId))
      .where(eq(deliverable.projectId, forProject.id))
      .orderBy(desc(deliverable.updatedAt)),
    db
      .select({
        id: deliverableVersion.id,
        deliverableId: deliverableVersion.deliverableId,
        version: deliverableVersion.version,
        titleSnapshot: deliverableVersion.titleSnapshot,
        linkUrl: deliverableVersion.linkUrl,
        note: deliverableVersion.note,
        needsApproval: deliverableVersion.needsApproval,
        status: deliverableVersion.status,
        reviewBy: deliverableVersion.reviewBy,
        sharedAt: deliverableVersion.sharedAt,
        decidedAt: deliverableVersion.decidedAt,
        decisionSource: deliverableVersion.decisionSource,
        signedName: deliverableVersion.signedName,
        statement: deliverableVersion.statement,
        decisionNote: deliverableVersion.decisionNote,
        sharedByName: sharer.name,
        decidedByName: decider.name,
        fileId: file.id,
        filename: file.filename,
        sizeBytes: file.sizeBytes,
        contentType: file.contentType,
      })
      .from(deliverableVersion)
      .innerJoin(deliverable, eq(deliverable.id, deliverableVersion.deliverableId))
      .leftJoin(file, eq(file.id, deliverableVersion.fileId))
      .leftJoin(sharer, eq(sharer.id, deliverableVersion.sharedBy))
      .leftJoin(decider, eq(decider.id, deliverableVersion.decidedBy))
      // Withdrawn versions are the studio's business: the client's query never returns them
      .where(and(eq(deliverable.projectId, forProject.id), studio ? undefined : ne(deliverableVersion.status, 'withdrawn')))
      .orderBy(desc(deliverableVersion.version)),
    studio
      ? db
          .select({
            id: deliverableVersion.id,
            signerEmail: deliverableVersion.signerEmail,
            ipAddress: deliverableVersion.ipAddress,
            userAgent: deliverableVersion.userAgent,
          })
          .from(deliverableVersion)
          .innerJoin(deliverable, eq(deliverable.id, deliverableVersion.deliverableId))
          .where(and(eq(deliverable.projectId, forProject.id), isNotNull(deliverableVersion.decidedAt)))
      : Promise.resolve([]),
    studio
      ? db
          .select({ kind: activity.kind, emailStatus: activity.emailStatus, createdAt: activity.createdAt })
          .from(activity)
          .where(
            and(
              eq(activity.projectId, forProject.id),
              eq(activity.emailTo, forProject.clientEmail),
              or(like(activity.kind, `${KINDS.shared}:%`), like(activity.kind, `${KINDS.reminded}:%`)),
            ),
          )
          .orderBy(desc(activity.createdAt))
      : Promise.resolve([]),
  ]);

  const recordById = new Map(records.map((record) => [record.id, record]));

  function toView(row: (typeof rows)[number]): VersionView {
    const record = recordById.get(row.id);
    return {
      id: row.id,
      version: row.version,
      titleSnapshot: row.titleSnapshot,
      linkUrl: row.linkUrl,
      file:
        row.fileId && row.filename
          ? {
              id: row.fileId,
              filename: row.filename,
              sizeBytes: row.sizeBytes ?? 0,
              previewable: INLINE_TYPES.has(row.contentType ?? ''),
            }
          : null,
      note: row.note,
      needsApproval: row.needsApproval,
      status: row.status,
      reviewBy: row.reviewBy,
      sharedAt: row.sharedAt.toISOString(),
      // Which of the two of us shared it matters to the studio only
      sharedByName: studio ? row.sharedByName : null,
      decision:
        row.decidedAt && row.statement && row.decisionSource
          ? {
              at: row.decidedAt.toISOString(),
              source: row.decisionSource,
              byName: row.decidedByName,
              signedName: row.signedName,
              statement: row.statement,
              note: row.decisionNote,
              ...(studio
                ? { signerEmail: record?.signerEmail ?? null, ipAddress: record?.ipAddress ?? null, userAgent: record?.userAgent ?? null }
                : {}),
            }
          : null,
      replacedBy: null,
    };
  }

  const byDeliverable = new Map<string, VersionView[]>();
  for (const row of rows) {
    const list = byDeliverable.get(row.deliverableId) ?? [];
    list.push(toView(row));
    byDeliverable.set(row.deliverableId, list);
  }

  const views: DeliverableView[] = [];
  for (const item of items) {
    const versions = byDeliverable.get(item.id) ?? [];
    // A deliverable whose every version was withdrawn does not exist for the client
    if (!studio && versions.length === 0) continue;

    for (const version of versions) {
      if (version.status !== 'superseded') continue;
      // Sharing always takes the next number; the client is pointed at the next one they can see
      version.replacedBy = studio
        ? version.version + 1
        : (versions
            .filter((other) => other.version > version.version)
            .map((other) => other.version)
            .sort((a, b) => a - b)[0] ?? null);
    }

    const current = versions.find((version) => version.status !== 'withdrawn') ?? null;
    let earlier = versions.filter((version) => version !== current);
    if (!studio) {
      // Earlier versions are listed for the record only, so nobody reviews an old link by mistake
      earlier = earlier.map((version) => ({ ...version, linkUrl: null, file: null }));
    }

    let studioExtras: DeliverableView['studio'];
    if (studio) {
      const mine = current
        ? emails.filter((row) => deliverableIdOf(row.kind) === item.id && row.createdAt.toISOString() >= current.sharedAt)
        : [];
      const lastSent = mine.find((row) => row.emailStatus === 'sent');
      const decided = [...versions]
        .reverse()
        .find((version) => version.status === 'approved' || version.status === 'changes_requested');
      studioExtras = {
        lastEmailedAt: lastSent ? lastSent.createdAt.toISOString() : null,
        lastEmailFailed: mine[0]?.emailStatus === 'failed',
        deleteBlockedBy:
          decided && decided.decision
            ? {
                version: decided.version,
                status: decided.status as 'approved' | 'changes_requested',
                byName: decided.decision.byName,
                at: decided.decision.at,
              }
            : null,
      };
    }

    views.push({
      id: item.id,
      title: item.title,
      description: item.description,
      milestone: item.milestoneId && item.milestoneTitle ? { id: item.milestoneId, title: item.milestoneTitle } : null,
      latestVersion: item.latestVersion,
      current,
      earlier,
      lastNeedsApproval: versions[0]?.needsApproval ?? true,
      ...(studioExtras ? { studio: studioExtras } : {}),
    });
  }
  return views;
}

export async function loadMilestoneOptions(projectId: string): Promise<MilestoneOption[]> {
  return getDb()
    .select({ id: milestone.id, title: milestone.title, status: milestone.status })
    .from(milestone)
    .where(eq(milestone.projectId, projectId))
    .orderBy(asc(milestone.position), asc(milestone.createdAt));
}

/* ---------- Milestone sync ----------
   Runs inside the deliverable's transaction. An initialled milestone is part of the signed
   record, so deliverables never move it. */

type MilestoneEvent = 'shared' | 'changes' | 'approved' | 'withdrawn';

// The newest non-withdrawn version of every deliverable linked to the milestone
async function linkedCurrentVersions(tx: Tx, milestoneId: string) {
  const rows = await tx
    .select({
      deliverableId: deliverableVersion.deliverableId,
      status: deliverableVersion.status,
      needsApproval: deliverableVersion.needsApproval,
    })
    .from(deliverableVersion)
    .innerJoin(deliverable, eq(deliverable.id, deliverableVersion.deliverableId))
    .where(and(eq(deliverable.milestoneId, milestoneId), ne(deliverableVersion.status, 'withdrawn')))
    .orderBy(asc(deliverableVersion.deliverableId), desc(deliverableVersion.version));
  const current = new Map<string, { status: VersionStatus; needsApproval: boolean }>();
  for (const row of rows) if (!current.has(row.deliverableId)) current.set(row.deliverableId, row);
  return [...current.values()];
}

export async function syncMilestone(
  tx: Tx,
  projectId: string,
  milestoneId: string,
  event: MilestoneEvent,
): Promise<MilestoneStatus | null> {
  // Locked first, so two approvals landing together cannot both miss that the other is done
  const [row] = await tx
    .select({ status: milestone.status, requiresSignoff: milestone.requiresSignoff })
    .from(milestone)
    .where(and(eq(milestone.id, milestoneId), eq(milestone.projectId, projectId)))
    .for('update');
  if (!row) return null;
  const [signed] = await tx
    .select({ id: milestoneSignoff.id })
    .from(milestoneSignoff)
    .where(eq(milestoneSignoff.milestoneId, milestoneId))
    .limit(1);
  if (signed) return null;

  let next: MilestoneStatus | null = null;
  if (event === 'shared') next = 'waiting_on_client';
  else if (event === 'changes') next = 'in_progress';
  else {
    const linked = await linkedCurrentVersions(tx, milestoneId);
    if (event === 'approved') {
      const pending = linked.some((version) => version.needsApproval && version.status !== 'approved');
      // Approvals finish the milestone, unless the client still has to initial it off
      if (!pending) next = row.requiresSignoff ? 'waiting_on_client' : 'done';
    } else if (row.status === 'waiting_on_client' && !row.requiresSignoff && !linked.some((version) => version.status === 'in_review')) {
      // Nothing is left for the client to review, so the milestone is back with the studio
      next = 'in_progress';
    }
  }
  if (!next || next === row.status) return null;
  await tx.update(milestone).set({ status: next }).where(eq(milestone.id, milestoneId));
  return next;
}

/* ---------- Email throttle ----------
   At most one email to the client per version every 10 minutes. The claim is a single
   conditional upsert, so two clicks at once cannot both send. */

const EMAIL_GAP_MS = 10 * 60 * 1000;
const throttleKey = (versionId: string) => `portal:deliverable-email:${versionId}`;

export async function claimEmailSlot(versionId: string): Promise<{ ok: true } | { ok: false; waitMinutes: number }> {
  const db = getDb();
  const key = throttleKey(versionId);
  const now = Date.now();
  const claimed = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: sql`${rateLimit.count} + 1`, lastRequest: now },
      setWhere: sql`${rateLimit.lastRequest} <= ${now - EMAIL_GAP_MS}`,
    })
    .returning({ id: rateLimit.id });
  if (claimed.length) return { ok: true };
  const [row] = await db.select({ lastRequest: rateLimit.lastRequest }).from(rateLimit).where(eq(rateLimit.key, key));
  const last = row?.lastRequest ?? now;
  return { ok: false, waitMinutes: Math.max(1, Math.ceil((last + EMAIL_GAP_MS - now) / 60_000)) };
}

// An email that did not go out should not block the next try
export async function releaseEmailSlot(versionId: string): Promise<void> {
  await getDb().delete(rateLimit).where(eq(rateLimit.key, throttleKey(versionId)));
}

/* ---------- Emails ---------- */

// "2026-11-08 19:30 UTC": receipts state one unambiguous time
export function utcStamp(value: Date): string {
  return `${value.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function reviewedItem(linkUrl: string | null, filename: string | null): string {
  if (linkUrl && filename) return `${linkUrl} and the file ${filename}`;
  return linkUrl ?? filename ?? 'the shared version';
}

interface ShareEmailInput {
  projectName: string;
  clientName: string | null;
  title: string;
  version: number;
  note: string | null;
  needsApproval: boolean;
  reviewBy: string | null;
  url: string;
  reminder?: boolean;
}

export function shareEmail(input: ShareEmailInput): { subject: string; content: EmailContent } {
  const name = firstName(input.clientName);
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const what = `version ${input.version} of ${input.title}`;
  const footnotes = [`You're getting this because you're the client on ${input.projectName}.`];

  if (!input.needsApproval) {
    return {
      subject: input.reminder ? `In your portal: ${input.title}, version ${input.version}` : `Delivered: ${input.title}, version ${input.version}`,
      content: {
        heading: `${input.title} is in your portal`,
        paragraphs: [
          greeting,
          `We've delivered ${what} for ${input.projectName}. Nothing is needed from you; it's there whenever you want it.`,
        ],
        quote: input.note ?? undefined,
        action: { label: 'Open it in the portal', url: input.url },
        footnotes,
      },
    };
  }

  const by = input.reviewBy ? ` We'd love your thoughts by ${formatDate(input.reviewBy)}.` : '';
  return {
    subject: input.reminder
      ? `Reminder: ${input.title} is waiting for your review`
      : `Ready for your review: ${input.title}, version ${input.version}`,
    content: {
      heading: input.reminder ? `${input.title} is waiting for your review` : `${input.title} is ready for your review`,
      paragraphs: [
        greeting,
        input.reminder
          ? `A quick reminder that ${what} is in your portal for ${input.projectName}.${by}`
          : `We've shared ${what} for ${input.projectName}.${by}`,
        'Have a look, then approve it or tell us what to change. Both take a minute in your portal.',
      ],
      quote: input.note ?? undefined,
      action: { label: 'Review it in the portal', url: input.url },
      footnotes,
    },
  };
}

interface DecisionEmailInput {
  clientName: string;
  title: string;
  version: number;
  statement: string;
  signedName: string | null;
  signerEmail: string;
  at: Date;
  linkUrl: string | null;
  filename: string | null;
  note: string | null;
  url: string;
}

export function approvalEmails(input: DecisionEmailInput) {
  const reviewed = reviewedItem(input.linkUrl, input.filename);
  const signed = `${input.signedName ?? input.clientName} (${input.signerEmail})`;
  return {
    studio: {
      subject: `${input.clientName} approved ${input.title}, version ${input.version}`,
      content: {
        heading: `${input.clientName} approved ${input.title}`,
        paragraphs: [
          `Version ${input.version}, signed as ${signed} at ${utcStamp(input.at)}.`,
          `Statement: ${input.statement}`,
          `Reviewed: ${reviewed}`,
        ],
        quote: input.note ?? undefined,
        action: { label: 'Open it in the portal', url: input.url },
      } satisfies EmailContent,
    },
    receipt: {
      subject: `Your approval of ${input.title}, version ${input.version}`,
      content: {
        heading: `You approved version ${input.version} of ${input.title}`,
        paragraphs: [
          'This is your copy of the sign-off recorded in your portal.',
          `Statement: ${input.statement}`,
          `Signed as: ${signed}`,
          `Time: ${utcStamp(input.at)}`,
          `What you reviewed: ${reviewed}`,
        ],
        quote: input.note ?? undefined,
        action: { label: 'View it in the portal', url: input.url },
        footnotes: [`If any of this looks wrong, write to us at ${STUDIO_EMAIL}.`],
      } satisfies EmailContent,
    },
  };
}

export function changesEmails(input: DecisionEmailInput & { nextVersion: number }) {
  const reviewed = reviewedItem(input.linkUrl, input.filename);
  return {
    studio: {
      subject: `${input.clientName} asked for changes on ${input.title}`,
      content: {
        heading: `${input.clientName} asked for changes on ${input.title}`,
        paragraphs: [`Version ${input.version}, sent by ${input.signerEmail} at ${utcStamp(input.at)}.`, `Reviewed: ${reviewed}`],
        quote: input.note ?? undefined,
        action: { label: 'Open it in the portal', url: input.url },
      } satisfies EmailContent,
    },
    receipt: {
      subject: `We have your notes on ${input.title}`,
      content: {
        heading: `We have your notes on ${input.title}`,
        paragraphs: [
          `Thanks. Here is a copy of what you sent about version ${input.version}, at ${utcStamp(input.at)}.`,
          `We'll email you when version ${input.nextVersion} is ready.`,
        ],
        quote: input.note ?? undefined,
        action: { label: 'View it in the portal', url: input.url },
      } satisfies EmailContent,
    },
  };
}

export function recordedApprovalEmail(input: DecisionEmailInput & { recordedBy: string }): { subject: string; content: EmailContent } {
  return {
    subject: `We recorded your approval of ${input.title}`,
    content: {
      heading: `We recorded your approval of ${input.title}`,
      paragraphs: [
        `${input.recordedBy} recorded that you approved version ${input.version} of ${input.title} outside the portal, at ${utcStamp(input.at)}.`,
        `What was approved: ${reviewedItem(input.linkUrl, input.filename)}`,
        'Our note is below. The record is in your portal with the rest of the project.',
      ],
      quote: input.note ?? undefined,
      action: { label: 'View it in the portal', url: input.url },
      footnotes: [`If that's not right, write to us at ${STUDIO_EMAIL} and we'll sort it out.`],
    },
  };
}

/* ---------- Attention and deadlines ---------- */

// The client's open reviews: a version in review is always its deliverable's latest
async function openReviews(context: FeatureContext) {
  return getDb()
    .select({
      versionId: deliverableVersion.id,
      deliverableId: deliverable.id,
      title: deliverable.title,
      version: deliverableVersion.version,
      reviewBy: deliverableVersion.reviewBy,
      sharedAt: deliverableVersion.sharedAt,
      projectId: project.id,
      projectName: project.name,
    })
    .from(deliverableVersion)
    .innerJoin(deliverable, eq(deliverable.id, deliverableVersion.deliverableId))
    .innerJoin(project, eq(project.id, deliverable.projectId))
    .where(
      and(eq(deliverableVersion.status, 'in_review'), eq(deliverableVersion.version, deliverable.latestVersion), projectScope(context)),
    );
}

const newer = alias(deliverableVersion, 'newer');

async function studioAttention(context: FeatureContext): Promise<AttentionItem[]> {
  const db = getDb();
  const clientName = sql<string>`coalesce(nullif(${user.name}, ''), ${user.email})`;
  const [changes, approvals, emails] = await Promise.all([
    db
      .select({
        versionId: deliverableVersion.id,
        deliverableId: deliverable.id,
        title: deliverable.title,
        version: deliverableVersion.version,
        note: deliverableVersion.decisionNote,
        decidedAt: deliverableVersion.decidedAt,
        projectId: project.id,
        projectName: project.name,
        clientName,
      })
      .from(deliverableVersion)
      .innerJoin(deliverable, eq(deliverable.id, deliverableVersion.deliverableId))
      .innerJoin(project, eq(project.id, deliverable.projectId))
      .innerJoin(user, eq(user.id, project.clientId))
      .where(
        and(
          eq(deliverableVersion.status, 'changes_requested'),
          projectScope(context),
          // Only while it is still the newest version: sharing the next one answers it
          notExists(
            db
              .select({ id: newer.id })
              .from(newer)
              .where(
                and(
                  eq(newer.deliverableId, deliverableVersion.deliverableId),
                  gt(newer.version, deliverableVersion.version),
                  ne(newer.status, 'withdrawn'),
                ),
              ),
          ),
        ),
      ),
    db
      .select({
        versionId: deliverableVersion.id,
        deliverableId: deliverable.id,
        title: deliverable.title,
        version: deliverableVersion.version,
        decidedAt: deliverableVersion.decidedAt,
        projectId: project.id,
        projectName: project.name,
        clientName,
      })
      .from(deliverableVersion)
      .innerJoin(deliverable, eq(deliverable.id, deliverableVersion.deliverableId))
      .innerJoin(project, eq(project.id, deliverable.projectId))
      .innerJoin(user, eq(user.id, project.clientId))
      .where(
        and(
          eq(deliverableVersion.status, 'approved'),
          eq(deliverableVersion.decisionSource, 'client'),
          gte(deliverableVersion.decidedAt, sql`now() - interval '7 days'`),
          projectScope(context),
        ),
      ),
    db
      .select({
        id: activity.id,
        kind: activity.kind,
        summary: activity.summary,
        emailTo: activity.emailTo,
        emailStatus: activity.emailStatus,
        createdAt: activity.createdAt,
        projectId: project.id,
        projectName: project.name,
      })
      .from(activity)
      .innerJoin(project, eq(project.id, activity.projectId))
      .where(
        and(
          like(activity.kind, 'deliverable%'),
          isNotNull(activity.emailTo),
          inArray(activity.emailStatus, ['sent', 'failed']),
          gte(activity.createdAt, sql`now() - interval '14 days'`),
          projectScope(context),
        ),
      )
      .orderBy(asc(activity.createdAt)),
  ]);

  const items: AttentionItem[] = [];
  for (const row of changes) {
    items.push({
      key: `deliverable-changes:${row.versionId}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'deliverables',
      anchor: deliverableAnchor(row.deliverableId),
      title: `${row.clientName} asked for changes on ${row.title}`,
      detail: row.note ? `Version ${row.version}: ${row.note.length > 140 ? `${row.note.slice(0, 140).trimEnd()}…` : row.note}` : undefined,
      since: row.decidedAt?.toISOString() ?? null,
      tone: 'alert',
    });
  }
  for (const row of approvals) {
    items.push({
      key: `deliverable-approved:${row.versionId}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'deliverables',
      anchor: deliverableAnchor(row.deliverableId),
      title: `${row.clientName} approved ${row.title} (version ${row.version})`,
      since: row.decidedAt?.toISOString() ?? null,
      tone: 'info',
    });
  }
  // A failed email stays flagged until a later one about the same deliverable reaches that address
  for (const [index, row] of emails.entries()) {
    if (row.emailStatus !== 'failed') continue;
    const deliverableId = deliverableIdOf(row.kind);
    const resolved = emails
      .slice(index + 1)
      .some((later) => later.emailStatus === 'sent' && later.emailTo === row.emailTo && deliverableIdOf(later.kind) === deliverableId);
    if (resolved) continue;
    items.push({
      key: `deliverable-email:${row.id}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'deliverables',
      anchor: deliverableId ? deliverableAnchor(deliverableId) : undefined,
      title: `An email to ${row.emailTo} could not be sent`,
      detail: row.summary,
      since: row.createdAt.toISOString(),
      tone: 'alert',
    });
  }
  return items;
}

export const deliverablesFeature: PortalFeature = {
  async attention(context) {
    if (context.perspective === 'studio') return studioAttention(context);
    const reviews = await openReviews(context);
    return reviews.map((row) => ({
      key: `deliverable-version:${row.versionId}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'deliverables' as const,
      anchor: deliverableAnchor(row.deliverableId),
      title: `Review ${row.title} (version ${row.version})`,
      due: row.reviewBy,
      since: row.sharedAt.toISOString(),
      tone: row.reviewBy && row.reviewBy < context.today ? ('alert' as const) : ('action' as const),
    }));
  },

  async deadlines(context): Promise<DeadlineItem[]> {
    const reviews = await openReviews(context);
    return reviews
      .filter((row): row is typeof row & { reviewBy: string } => Boolean(row.reviewBy))
      .map((row) => ({
        key: `deliverable-review:${row.versionId}`,
        projectId: row.projectId,
        projectName: row.projectName,
        tab: 'deliverables' as const,
        anchor: deliverableAnchor(row.deliverableId),
        title: `Review ${row.title} (version ${row.version})`,
        date: row.reviewBy,
        kind: 'review' as const,
        owner: 'client' as const,
      }));
  },
};

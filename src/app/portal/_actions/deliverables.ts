'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, desc, eq, gt, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { deliverable, deliverableVersion, file, milestone } from '@/db/schema';
import { approvalStatement, changesStatement, studioApprovalStatement } from '@/components/portal/deliverables/copy';
import { projectHref } from '@/components/portal/tabs';
import { plural, todayIso } from '@/lib/portal-format';
import { adminActor, projectActor, type ProjectActor } from '@/server/portal/access';
import { ActionError, done, fields, parseForm, runAction, type ActionState } from '@/server/portal/actions';
import {
  activityKind,
  approvalEmails,
  changesEmails,
  claimEmailSlot,
  deliverableAnchor,
  recordedApprovalEmail,
  releaseEmailSlot,
  shareEmail,
  syncMilestone,
  type Tx,
} from '@/server/portal/features/deliverables';
import { emailNote, portalOrigin, recordActivity, STUDIO_EMAIL } from '@/server/portal/notify';
import { requestMeta } from '@/server/portal/request';
import { storeUpload } from '@/server/portal/storage';

/*
 * Every export here is an endpoint anyone can call with any arguments, so each one starts by
 * checking who is asking. Forms send ids and the person's own words; who decided and their
 * email come from the session, and every row is matched to the actor's project.
 */

const NOT_FOUND = 'This could not be found. Reload the page and try again.';

// fields.checkbox fails on an unticked box under Zod 4 (a missing key reads as "nonoptional");
// optional() before the transform lets the key be absent
const checkbox = z
  .union([z.literal('on'), z.literal('true')])
  .optional()
  .transform((value) => value !== undefined);

// Parses the form and adds checks the schema cannot express, so every problem shows at once
function parseWithChecks<S extends z.ZodType>(schema: S, formData: FormData, extra: Record<string, string>): z.infer<S> {
  const problems = Object.entries(extra);
  let parsed: z.infer<S>;
  try {
    parsed = parseForm(schema, formData);
  } catch (error) {
    if (error instanceof ActionError && problems.length) throw new ActionError(error.message, { ...extra, ...error.fieldErrors });
    throw error;
  }
  if (problems.length) throw new ActionError(problems.length === 1 ? problems[0][1] : 'Check the highlighted fields and try again.', extra);
  return parsed;
}

const optionalUuid = z.union([z.literal(''), fields.uuid]).transform((value) => value || null);

// What the client had on screen when they decided, so a link changed underneath them is caught
const shown = {
  shownLink: z
    .string()
    .max(2000)
    .transform((value) => value || null),
  shownFile: optionalUuid,
};

function refresh(projectId: string) {
  revalidatePath(projectHref(projectId), 'layout');
  revalidatePath('/portal');
}

const clientNameOf = (actor: ProjectActor) => actor.project.clientName || actor.project.clientEmail;

async function cardUrl(projectId: string, deliverableId: string) {
  return `${await portalOrigin()}${projectHref(projectId, 'deliverables', deliverableAnchor(deliverableId))}`;
}

// Finds a version inside the actor's project and locks its deliverable. The version is read
// again after the lock, so it reflects anything that committed while this request waited.
async function lockVersion(tx: Tx, projectId: string, versionId: string) {
  const [ref] = await tx
    .select({ deliverableId: deliverableVersion.deliverableId })
    .from(deliverableVersion)
    .innerJoin(deliverable, eq(deliverable.id, deliverableVersion.deliverableId))
    .where(and(eq(deliverableVersion.id, versionId), eq(deliverable.projectId, projectId)));
  if (!ref) throw new ActionError(NOT_FOUND);
  const [parent] = await tx
    .select({ title: deliverable.title, latestVersion: deliverable.latestVersion, milestoneId: deliverable.milestoneId })
    .from(deliverable)
    .where(eq(deliverable.id, ref.deliverableId))
    .for('update');
  const [version] = await tx
    .select({
      id: deliverableVersion.id,
      version: deliverableVersion.version,
      titleSnapshot: deliverableVersion.titleSnapshot,
      status: deliverableVersion.status,
      linkUrl: deliverableVersion.linkUrl,
      fileId: deliverableVersion.fileId,
      filename: file.filename,
      needsApproval: deliverableVersion.needsApproval,
      reviewBy: deliverableVersion.reviewBy,
      note: deliverableVersion.note,
      decidedBy: deliverableVersion.decidedBy,
    })
    .from(deliverableVersion)
    .leftJoin(file, eq(file.id, deliverableVersion.fileId))
    .where(eq(deliverableVersion.id, versionId));
  if (!parent || !version) throw new ActionError(NOT_FOUND);
  return { deliverableId: ref.deliverableId, ...parent, version };
}

// A delivered version stays delivered when a newer one is shared, so "current" means no newer
// version the client can see
async function hasNewerVersion(tx: Tx, deliverableId: string, version: number) {
  const [row] = await tx
    .select({ id: deliverableVersion.id })
    .from(deliverableVersion)
    .where(
      and(
        eq(deliverableVersion.deliverableId, deliverableId),
        gt(deliverableVersion.version, version),
        ne(deliverableVersion.status, 'withdrawn'),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function newestVisibleVersion(tx: Tx, deliverableId: string) {
  const [row] = await tx
    .select({ version: deliverableVersion.version })
    .from(deliverableVersion)
    .where(and(eq(deliverableVersion.deliverableId, deliverableId), ne(deliverableVersion.status, 'withdrawn')))
    .orderBy(desc(deliverableVersion.version))
    .limit(1);
  return row?.version ?? null;
}

// Why a decision found nothing to update, in words for whoever is deciding
async function explainMissedDecision(
  tx: Tx,
  locked: Awaited<ReturnType<typeof lockVersion>>,
  shownLink: string | null,
  shownFile: string | null,
): Promise<never> {
  const { version } = locked;
  if (version.status === 'superseded') {
    const newest = await newestVisibleVersion(tx, locked.deliverableId);
    throw new ActionError(
      newest && newest > version.version
        ? `Replaced by version ${newest}, please review that one.`
        : 'A newer version is on its way. We will email you when it is ready.',
    );
  }
  if (version.status === 'withdrawn') {
    throw new ActionError('The studio took this version back. We will email you when the next one is ready.');
  }
  if (version.status === 'in_review' && (version.linkUrl !== shownLink || version.fileId !== shownFile)) {
    throw new ActionError('The studio updated this link; please review it again.');
  }
  if (version.status === 'approved' || version.status === 'changes_requested') {
    throw new ActionError('This version has already been decided.');
  }
  throw new ActionError('Someone just changed this. Reload the page and try again.');
}

/* ---------- Studio: share ---------- */

const shareSchema = z.object({
  projectId: fields.uuid,
  mode: z.enum(['new', 'version']),
  // Generated once per form in the browser, so a second submit finds the first one's rows
  deliverableId: fields.uuid,
  versionId: fields.uuid,
  expectedVersion: z.coerce.number().int().min(0).max(100_000),
  linkUrl: fields.optionalHttpsUrl,
  note: fields.optionalText('the note', 4000),
  needsApproval: checkbox,
  reviewBy: fields.optionalDate,
  milestoneId: optionalUuid,
  emailClient: checkbox,
});

const newDeliverableFields = {
  title: fields.requiredText('a title', 120),
  description: fields.optionalText('the description', 1000),
};

const newShareSchema = shareSchema.extend(newDeliverableFields);

export async function shareDeliverable(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    await adminActor();
    const actor = await projectActor(formData.get('projectId'));
    const isNew = formData.get('mode') === 'new';
    const upload = formData.get('file');
    const hasFile = upload instanceof File && upload.size > 0;
    const link = formData.get('linkUrl');
    const extra: Record<string, string> =
      !hasFile && !(typeof link === 'string' && link.trim()) ? { linkUrl: 'Add a link to this version, or upload a file below.' } : {};
    const input = isNew
      ? parseWithChecks(newShareSchema, formData, extra)
      : { ...parseWithChecks(shareSchema, formData, extra), title: null, description: null };
    if (input.needsApproval && input.reviewBy && input.reviewBy < todayIso()) {
      throw new ActionError('Check the highlighted fields and try again.', { reviewBy: 'Choose today or a later date.' });
    }

    const db = getDb();
    const projectId = actor.project.id;

    // A second submit of the same form: the first one already shared it
    const [already] = await db
      .select({ version: deliverableVersion.version, title: deliverableVersion.titleSnapshot })
      .from(deliverableVersion)
      .innerJoin(deliverable, eq(deliverable.id, deliverableVersion.deliverableId))
      .where(and(eq(deliverableVersion.id, input.versionId), eq(deliverable.projectId, projectId)));
    if (already) return done(`Shared version ${already.version} of ${already.title}.`);

    // Cheap checks before the upload, so a stale form does not store a file for nothing
    const [existing] = await db
      .select({ projectId: deliverable.projectId, latestVersion: deliverable.latestVersion })
      .from(deliverable)
      .where(eq(deliverable.id, input.deliverableId));
    if (isNew) {
      if (existing) throw new ActionError('This deliverable was just shared. Reload the page to see it.');
    } else {
      if (!existing || existing.projectId !== projectId) throw new ActionError(NOT_FOUND);
      if (existing.latestVersion !== input.expectedVersion) {
        throw new ActionError(`Version ${existing.latestVersion} was just shared. Reload the page to see it.`);
      }
    }

    const stored = hasFile
      ? await storeUpload({ projectId, purpose: 'deliverable', uploadedBy: actor.user.id, upload: upload as File })
      : null;

    let shared: { version: number; title: string };
    try {
      shared = await db.transaction(async (tx) => {
        if (input.milestoneId) {
          const [linked] = await tx
            .select({ id: milestone.id })
            .from(milestone)
            .where(and(eq(milestone.id, input.milestoneId), eq(milestone.projectId, projectId)));
          if (!linked) throw new ActionError('Choose a milestone from this project.', { milestoneId: 'Choose a milestone from this project.' });
        }
        if (isNew) {
          const inserted = await tx
            .insert(deliverable)
            .values({
              id: input.deliverableId,
              projectId,
              title: input.title ?? '',
              description: input.description,
              milestoneId: input.milestoneId,
            })
            .onConflictDoNothing({ target: deliverable.id })
            .returning({ id: deliverable.id });
          if (!inserted.length) throw new ActionError('This deliverable was just shared. Reload the page to see it.');
        }

        const [row] = await tx
          .select({ title: deliverable.title, latestVersion: deliverable.latestVersion })
          .from(deliverable)
          .where(and(eq(deliverable.id, input.deliverableId), eq(deliverable.projectId, projectId)))
          .for('update');
        if (!row) throw new ActionError(NOT_FOUND);
        if (row.latestVersion !== input.expectedVersion) {
          throw new ActionError(`Version ${row.latestVersion} was just shared. Reload the page to see it.`);
        }

        const next = row.latestVersion + 1;
        // One version in review at a time: the new one replaces any still waiting
        await tx
          .update(deliverableVersion)
          .set({ status: 'superseded' })
          .where(and(eq(deliverableVersion.deliverableId, input.deliverableId), eq(deliverableVersion.status, 'in_review')));
        await tx
          .update(deliverable)
          .set({ latestVersion: next, milestoneId: input.milestoneId })
          .where(eq(deliverable.id, input.deliverableId));
        await tx.insert(deliverableVersion).values({
          id: input.versionId,
          deliverableId: input.deliverableId,
          version: next,
          titleSnapshot: row.title,
          linkUrl: input.linkUrl,
          fileId: stored?.id ?? null,
          note: input.note,
          needsApproval: input.needsApproval,
          status: input.needsApproval ? 'in_review' : 'delivered',
          reviewBy: input.needsApproval ? input.reviewBy : null,
          sharedBy: actor.user.id,
        });
        if (input.milestoneId) {
          await syncMilestone(tx, projectId, input.milestoneId, input.needsApproval ? 'shared' : 'withdrawn');
        }
        return { version: next, title: row.title };
      });
    } catch (error) {
      // Nothing points at the uploaded file now; drop its row so it cannot surface anywhere
      if (stored) await db.delete(file).where(eq(file.id, stored.id)).catch(() => undefined);
      throw error;
    }

    refresh(projectId);
    const clientName = clientNameOf(actor);
    const kind = activityKind('shared', input.deliverableId);
    // Worded as the attention items and dashboards word a version: "<title> (version N)"
    const summary = `Shared ${shared.title} (version ${shared.version})`;
    if (!input.emailClient) {
      await recordActivity({ projectId, actorId: actor.user.id, kind, summary, target: 'deliverables' });
      return done(`Shared version ${shared.version} of ${shared.title}. No email was sent.`);
    }

    // Starts the 10-minute gap before "Email again" can send another
    await claimEmailSlot(input.versionId);
    const { subject, content } = shareEmail({
      projectName: actor.project.name,
      clientName: actor.project.clientName,
      title: shared.title,
      version: shared.version,
      note: input.note,
      needsApproval: input.needsApproval,
      reviewBy: input.needsApproval ? input.reviewBy : null,
      url: await cardUrl(projectId, input.deliverableId),
    });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind,
      summary,
      target: 'deliverables',
      email: { to: actor.project.clientEmail, subject, content },
    });
    if (emailStatus !== 'sent') await releaseEmailSlot(input.versionId);
    return done(
      `Shared version ${shared.version} of ${shared.title}.${emailStatus === 'sent' ? ` We emailed ${clientName}.` : emailNote(emailStatus, clientName)}`,
    );
  });
}

/* ---------- Studio: edit, fix, withdraw, remind, record, delete ---------- */

const editSchema = z.object({
  projectId: fields.uuid,
  deliverableId: fields.uuid,
  ...newDeliverableFields,
  milestoneId: optionalUuid,
});

export async function editDeliverable(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    await adminActor();
    const actor = await projectActor(formData.get('projectId'));
    const input = parseForm(editSchema, formData);
    const projectId = actor.project.id;
    const db = getDb();
    if (input.milestoneId) {
      const [linked] = await db
        .select({ id: milestone.id })
        .from(milestone)
        .where(and(eq(milestone.id, input.milestoneId), eq(milestone.projectId, projectId)));
      if (!linked) throw new ActionError('Choose a milestone from this project.', { milestoneId: 'Choose a milestone from this project.' });
    }
    // Shared versions keep the title they were shared with; this renames the card only
    const updated = await db
      .update(deliverable)
      .set({ title: input.title, description: input.description, milestoneId: input.milestoneId })
      .where(and(eq(deliverable.id, input.deliverableId), eq(deliverable.projectId, projectId)))
      .returning({ id: deliverable.id });
    if (!updated.length) throw new ActionError(NOT_FOUND);
    refresh(projectId);
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: activityKind('edited', input.deliverableId),
      summary: `Updated the details of ${input.title}`,
      target: 'deliverables',
      visibility: 'studio',
    });
    return done(`Saved the details of ${input.title}.`);
  });
}

const versionSchema = z.object({ projectId: fields.uuid, versionId: fields.uuid });

export async function fixVersionLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    await adminActor();
    const actor = await projectActor(formData.get('projectId'));
    const input = parseForm(versionSchema.extend({ linkUrl: fields.httpsUrl }), formData);
    const projectId = actor.project.id;

    const result = await getDb().transaction(async (tx) => {
      const locked = await lockVersion(tx, projectId, input.versionId);
      const { version } = locked;
      if (version.status !== 'in_review' && version.status !== 'delivered') {
        throw new ActionError('Only the version the client has now can be fixed. Share a new version instead.');
      }
      if (await hasNewerVersion(tx, locked.deliverableId, version.version)) {
        throw new ActionError(`Version ${version.version} has been replaced. Fix the newest version instead.`);
      }
      if (version.linkUrl === input.linkUrl) return { ...locked, unchanged: true };
      await tx
        .update(deliverableVersion)
        .set({ linkUrl: input.linkUrl })
        .where(and(eq(deliverableVersion.id, version.id), inArray(deliverableVersion.status, ['in_review', 'delivered'])));
      return { ...locked, unchanged: false };
    });

    if (result.unchanged) return done('That is already the link on this version.');
    refresh(projectId);
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: activityKind('linkFixed', result.deliverableId),
      summary: `Updated the link for version ${result.version.version} of ${result.title}`,
      target: 'deliverables',
    });
    return done(`Saved the new link for version ${result.version.version}.`);
  });
}

export async function withdrawVersion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    await adminActor();
    const actor = await projectActor(formData.get('projectId'));
    const input = parseForm(versionSchema, formData);
    const projectId = actor.project.id;

    const result = await getDb().transaction(async (tx) => {
      const locked = await lockVersion(tx, projectId, input.versionId);
      const { version } = locked;
      if (version.status !== 'in_review' && version.status !== 'delivered') {
        throw new ActionError('Only a version that is waiting or delivered can be withdrawn. Decided versions stay on record.');
      }
      await tx.update(deliverableVersion).set({ status: 'withdrawn' }).where(eq(deliverableVersion.id, version.id));
      if (locked.milestoneId && version.status === 'in_review') {
        await syncMilestone(tx, projectId, locked.milestoneId, 'withdrawn');
      }
      return locked;
    });

    refresh(projectId);
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: activityKind('withdrawn', result.deliverableId),
      summary: `Withdrew version ${result.version.version} of ${result.title}`,
      target: 'deliverables',
      visibility: 'studio',
    });
    return done(`Withdrew version ${result.version.version}. ${clientNameOf(actor)} no longer sees it.`);
  });
}

export async function emailClientAgain(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    await adminActor();
    const actor = await projectActor(formData.get('projectId'));
    const input = parseForm(versionSchema, formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);

    const locked = await getDb().transaction(async (tx) => {
      const found = await lockVersion(tx, projectId, input.versionId);
      if (found.version.status !== 'in_review' && found.version.status !== 'delivered') {
        throw new ActionError(`This version is no longer waiting on ${clientName}.`);
      }
      if (await hasNewerVersion(tx, found.deliverableId, found.version.version)) {
        throw new ActionError(`Version ${found.version.version} has been replaced by a newer one.`);
      }
      return found;
    });

    const slot = await claimEmailSlot(input.versionId);
    if (!slot.ok) {
      throw new ActionError(
        `${clientName} was emailed about this version a few minutes ago. You can send another in ${plural(slot.waitMinutes, 'minute')}.`,
      );
    }
    const { version } = locked;
    const { subject, content } = shareEmail({
      projectName: actor.project.name,
      clientName: actor.project.clientName,
      title: version.titleSnapshot,
      version: version.version,
      note: version.note,
      needsApproval: version.status === 'in_review',
      reviewBy: version.reviewBy,
      url: await cardUrl(projectId, locked.deliverableId),
      reminder: true,
    });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: activityKind('reminded', locked.deliverableId),
      summary: `Emailed ${clientName} again about version ${version.version} of ${locked.title}`,
      target: 'deliverables',
      visibility: 'studio',
      email: { to: actor.project.clientEmail, subject, content },
    });
    refresh(projectId);
    if (emailStatus === 'sent') return done(`Emailed ${clientName} again.`);
    await releaseEmailSlot(input.versionId);
    if (emailStatus === 'skipped') return done(emailNote(emailStatus, clientName).trim());
    throw new ActionError(`The email to ${clientName} could not be sent. It is flagged on your dashboard; try again in a minute.`);
  });
}

export async function recordApproval(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const admin = await adminActor();
    const actor = await projectActor(formData.get('projectId'));
    const input = parseForm(versionSchema.extend({ ...shown, note: fields.requiredText('how they approved', 2000) }), formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);
    // The statement is shown to the client, who never sees a studio member's address
    const recordedBy = admin.name?.trim() || 'Bonsai Web Design';
    const meta = await requestMeta();

    const result = await getDb().transaction(async (tx) => {
      const locked = await lockVersion(tx, projectId, input.versionId);
      const { version } = locked;
      const statement = studioApprovalStatement(version.version, version.titleSnapshot, clientName, recordedBy);
      const updated = await tx
        .update(deliverableVersion)
        .set({
          status: 'approved',
          decidedBy: admin.id,
          decisionSource: 'studio',
          signedName: null,
          signerEmail: admin.email,
          statement,
          decisionNote: input.note,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        })
        .where(
          and(
            eq(deliverableVersion.id, version.id),
            eq(deliverableVersion.status, 'in_review'),
            eq(deliverableVersion.version, locked.latestVersion),
            sql`${deliverableVersion.linkUrl} is not distinct from ${input.shownLink}`,
            sql`${deliverableVersion.fileId} is not distinct from ${input.shownFile}`,
          ),
        )
        .returning({ decidedAt: deliverableVersion.decidedAt });
      if (!updated.length) await explainMissedDecision(tx, locked, input.shownLink, input.shownFile);
      if (locked.milestoneId) await syncMilestone(tx, projectId, locked.milestoneId, 'approved');
      return { ...locked, statement, decidedAt: updated[0].decidedAt ?? new Date() };
    });

    refresh(projectId);
    const { subject, content } = recordedApprovalEmail({
      clientName,
      recordedBy,
      title: result.version.titleSnapshot,
      version: result.version.version,
      statement: result.statement,
      signedName: null,
      signerEmail: admin.email,
      at: result.decidedAt,
      linkUrl: result.version.linkUrl,
      filename: result.version.filename,
      note: input.note,
      url: await cardUrl(projectId, result.deliverableId),
    });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: admin.id,
      kind: activityKind('approved', result.deliverableId),
      summary: `Recorded ${clientName}'s approval of version ${result.version.version} of ${result.title}, given outside the portal`,
      target: 'deliverables',
      email: { to: actor.project.clientEmail, subject, content },
    });
    return done(
      `Recorded the approval of version ${result.version.version}.${emailStatus === 'sent' ? ` We emailed ${clientName} a copy.` : emailNote(emailStatus, clientName)}`,
    );
  });
}

export async function deleteDeliverable(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    await adminActor();
    const actor = await projectActor(formData.get('projectId'));
    const input = parseForm(z.object({ projectId: fields.uuid, deliverableId: fields.uuid }), formData);
    const projectId = actor.project.id;

    const title = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .select({ title: deliverable.title })
        .from(deliverable)
        .where(and(eq(deliverable.id, input.deliverableId), eq(deliverable.projectId, projectId)))
        .for('update');
      if (!row) throw new ActionError(NOT_FOUND);
      const [decided] = await tx
        .select({ version: deliverableVersion.version, status: deliverableVersion.status })
        .from(deliverableVersion)
        .where(
          and(
            eq(deliverableVersion.deliverableId, input.deliverableId),
            inArray(deliverableVersion.status, ['approved', 'changes_requested']),
          ),
        )
        .orderBy(asc(deliverableVersion.version))
        .limit(1);
      if (decided) {
        throw new ActionError(
          `Can't delete: version ${decided.version} has a decision from the client. Decided versions are kept on record.`,
        );
      }
      const files = await tx
        .select({ fileId: deliverableVersion.fileId })
        .from(deliverableVersion)
        .where(and(eq(deliverableVersion.deliverableId, input.deliverableId), isNotNull(deliverableVersion.fileId)));
      await tx.delete(deliverable).where(eq(deliverable.id, input.deliverableId));
      const fileIds = files.map((entry) => entry.fileId).filter((id): id is string => Boolean(id));
      // The bytes stay in storage for the studio; the files no longer show anywhere
      if (fileIds.length) await tx.update(file).set({ removedAt: new Date() }).where(inArray(file.id, fileIds));
      return row.title;
    });

    refresh(projectId);
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: activityKind('deleted', input.deliverableId),
      summary: `Deleted ${title}`,
      target: 'deliverables',
      visibility: 'studio',
    });
    return done(`Deleted ${title}.`);
  });
}

/* ---------- Client: approve or ask for changes ---------- */

const approveSchema = z.object({
  projectId: fields.uuid,
  versionId: fields.uuid,
  ...shown,
  confirm: checkbox,
  signedName: fields
    .requiredText('your full name', 120)
    .pipe(z.string().min(2, { error: 'Enter your full name, as you would sign it.' })),
  note: fields.optionalText('the note', 2000),
});

export async function approveVersion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await projectActor(formData.get('projectId'), { clientOnly: true });
    const ticked = formData.get('confirm') === 'on';
    const input = parseWithChecks(approveSchema, formData, ticked ? {} : { confirm: 'Tick the box to confirm your approval.' });
    const projectId = actor.project.id;
    const meta = await requestMeta();

    const result = await getDb().transaction(async (tx) => {
      const locked = await lockVersion(tx, projectId, input.versionId);
      const { version } = locked;
      const statement = approvalStatement(version.version, version.titleSnapshot);
      const updated = await tx
        .update(deliverableVersion)
        .set({
          status: 'approved',
          decidedBy: actor.user.id,
          decisionSource: 'client',
          signedName: input.signedName,
          signerEmail: actor.user.email,
          statement,
          decisionNote: input.note,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        })
        .where(
          and(
            eq(deliverableVersion.id, version.id),
            eq(deliverableVersion.status, 'in_review'),
            eq(deliverableVersion.version, locked.latestVersion),
            sql`${deliverableVersion.linkUrl} is not distinct from ${input.shownLink}`,
            sql`${deliverableVersion.fileId} is not distinct from ${input.shownFile}`,
          ),
        )
        .returning({ decidedAt: deliverableVersion.decidedAt });
      if (!updated.length) {
        // A double click: the first click already recorded this exact decision
        if (version.status === 'approved' && version.decidedBy === actor.user.id) return { ...locked, statement, duplicate: true as const };
        await explainMissedDecision(tx, locked, input.shownLink, input.shownFile);
      }
      if (locked.milestoneId) await syncMilestone(tx, projectId, locked.milestoneId, 'approved');
      return { ...locked, statement, duplicate: false as const, decidedAt: updated[0].decidedAt ?? new Date() };
    });

    const thanks = `Thanks, version ${result.version.version} of ${result.version.titleSnapshot} is approved.`;
    if (result.duplicate) return done(thanks);

    refresh(projectId);
    const clientName = clientNameOf(actor);
    const emails = approvalEmails({
      clientName,
      title: result.version.titleSnapshot,
      version: result.version.version,
      statement: result.statement,
      signedName: input.signedName,
      signerEmail: actor.user.email,
      at: result.decidedAt,
      linkUrl: result.version.linkUrl,
      filename: result.version.filename,
      note: input.note,
      url: await cardUrl(projectId, result.deliverableId),
    });
    const [, receipt] = await Promise.all([
      recordActivity({
        projectId,
        actorId: actor.user.id,
        kind: activityKind('approved', result.deliverableId),
        summary: `${clientName} approved ${result.title} (version ${result.version.version})`,
        target: 'deliverables',
        email: { to: STUDIO_EMAIL, replyTo: actor.user.email, ...emails.studio },
      }),
      recordActivity({
        projectId,
        actorId: actor.user.id,
        kind: activityKind('receipt', result.deliverableId),
        summary: `Receipt emailed to ${clientName}: approval of ${result.title} (version ${result.version.version})`,
        target: 'deliverables',
        visibility: 'studio',
        email: { to: actor.user.email, ...emails.receipt },
      }),
    ]);
    return done(
      receipt.emailStatus === 'sent'
        ? `${thanks} We've emailed you a receipt.`
        : receipt.emailStatus === 'failed'
          ? `${thanks} We couldn't email your receipt just now, but your approval is saved here.`
          : thanks,
    );
  });
}

const changesSchema = z.object({
  projectId: fields.uuid,
  versionId: fields.uuid,
  ...shown,
  note: fields.requiredText('what you would like changed', 5000),
});

export async function requestChanges(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await projectActor(formData.get('projectId'), { clientOnly: true });
    const input = parseForm(changesSchema, formData);
    const projectId = actor.project.id;
    const meta = await requestMeta();

    const result = await getDb().transaction(async (tx) => {
      const locked = await lockVersion(tx, projectId, input.versionId);
      const { version } = locked;
      const statement = changesStatement(version.version, version.titleSnapshot);
      const updated = await tx
        .update(deliverableVersion)
        .set({
          status: 'changes_requested',
          decidedBy: actor.user.id,
          decisionSource: 'client',
          signerEmail: actor.user.email,
          statement,
          decisionNote: input.note,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        })
        .where(
          and(
            eq(deliverableVersion.id, version.id),
            eq(deliverableVersion.status, 'in_review'),
            eq(deliverableVersion.version, locked.latestVersion),
            sql`${deliverableVersion.linkUrl} is not distinct from ${input.shownLink}`,
            sql`${deliverableVersion.fileId} is not distinct from ${input.shownFile}`,
          ),
        )
        .returning({ decidedAt: deliverableVersion.decidedAt });
      if (!updated.length) {
        if (version.status === 'changes_requested' && version.decidedBy === actor.user.id) {
          return { ...locked, statement, duplicate: true as const };
        }
        await explainMissedDecision(tx, locked, input.shownLink, input.shownFile);
      }
      if (locked.milestoneId) await syncMilestone(tx, projectId, locked.milestoneId, 'changes');
      return { ...locked, statement, duplicate: false as const, decidedAt: updated[0].decidedAt ?? new Date() };
    });

    const nextVersion = result.latestVersion + 1;
    const thanks = `Thanks, we have your notes. We'll email you when version ${nextVersion} is ready.`;
    if (result.duplicate) return done(thanks);

    refresh(projectId);
    const clientName = clientNameOf(actor);
    const emails = changesEmails({
      clientName,
      title: result.version.titleSnapshot,
      version: result.version.version,
      nextVersion,
      statement: result.statement,
      signedName: null,
      signerEmail: actor.user.email,
      at: result.decidedAt,
      linkUrl: result.version.linkUrl,
      filename: result.version.filename,
      note: input.note,
      url: await cardUrl(projectId, result.deliverableId),
    });
    await Promise.all([
      recordActivity({
        projectId,
        actorId: actor.user.id,
        kind: activityKind('changes', result.deliverableId),
        summary: `${clientName} asked for changes on ${result.title} (version ${result.version.version})`,
        target: 'deliverables',
        email: { to: STUDIO_EMAIL, replyTo: actor.user.email, ...emails.studio },
      }),
      recordActivity({
        projectId,
        actorId: actor.user.id,
        kind: activityKind('receipt', result.deliverableId),
        summary: `Receipt emailed to ${clientName}: changes requested on ${result.title} (version ${result.version.version})`,
        target: 'deliverables',
        visibility: 'studio',
        email: { to: actor.user.email, ...emails.receipt },
      }),
    ]);
    return done(thanks);
  });
}

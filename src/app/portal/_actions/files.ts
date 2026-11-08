'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { file } from '@/db/schema';
import { projectHref } from '@/components/portal/tabs';
import { projectActor, type ProjectActor } from '@/server/portal/access';
import { ActionError, done, fields, parseForm, runAction, type ActionState } from '@/server/portal/actions';
import { claimUpload, fileAnchor, fileKind, releaseUpload, sharedSummary } from '@/server/portal/features/files';
import { emailNote, portalOrigin, recordActivity, STUDIO_EMAIL } from '@/server/portal/notify';
import { storeUpload } from '@/server/portal/storage';

/*
 * The shared files library. Either side may upload; a file can be removed from the list by
 * whoever uploaded it, or by the studio. Every export is an endpoint anyone can call, so each
 * starts by checking who is asking, and every row is matched to the actor's project.
 */

const NOT_FOUND = 'This file could not be found. Reload the page and try again.';

// fields.checkbox rejects an unticked box under Zod 4; optional() lets the key be absent
const checkbox = z
  .union([z.literal('on'), z.literal('true')])
  .optional()
  .transform((value) => value !== undefined);

function refresh(projectId: string) {
  revalidatePath(projectHref(projectId), 'layout');
  revalidatePath('/portal');
}

const clientNameOf = (actor: ProjectActor) => actor.project.clientName || actor.project.clientEmail;

const uploadSchema = z.object({
  projectId: fields.uuid,
  // Generated once per form in the browser, so a second submit uploads nothing new
  uploadId: fields.uuid,
  note: fields.optionalText('the note', 1000),
  // The studio chooses; a client's upload always tells the studio
  emailOther: checkbox,
});

export async function uploadProjectFile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await projectActor(formData.get('projectId'));
    const upload = formData.get('file');
    const chosen = upload instanceof File && upload.size > 0 ? upload : null;
    let input: z.infer<typeof uploadSchema>;
    try {
      input = parseForm(uploadSchema, formData);
    } catch (error) {
      // Report a missing file alongside any other problem
      if (error instanceof ActionError && !chosen) throw new ActionError(error.message, { file: 'Choose a file to upload.', ...error.fieldErrors });
      throw error;
    }
    if (!chosen) throw new ActionError('Choose a file to upload.', { file: 'Choose a file to upload.' });

    const projectId = actor.project.id;
    const studio = actor.isAdmin;
    const clientName = clientNameOf(actor);
    const filename = chosen.name.slice(0, 200);
    const thanks = studio ? `Shared ${filename} with ${clientName}.` : `Thanks, we have ${filename}.`;

    // A second submit of the same form: the first one is uploading it, or already has
    if (!(await claimUpload(input.uploadId))) return done(thanks);
    let stored;
    try {
      stored = await storeUpload({ projectId, purpose: 'project_file', uploadedBy: actor.user.id, upload: chosen });
    } catch (error) {
      await releaseUpload(input.uploadId);
      throw error;
    }

    refresh(projectId);
    const url = `${await portalOrigin()}${projectHref(projectId, 'files', fileAnchor(stored.id))}`;
    const who = actor.user.name || actor.user.email;
    const activity = {
      projectId,
      actorId: actor.user.id,
      kind: fileKind('shared', stored.id),
      summary: sharedSummary(studio ? null : who, stored.filename, input.note),
      target: 'files',
    };

    if (!studio) {
      await recordActivity({
        ...activity,
        email: {
          to: STUDIO_EMAIL,
          replyTo: actor.user.email,
          subject: `${clientName} shared ${stored.filename}`,
          content: {
            heading: `${clientName} shared a file`,
            paragraphs: [`${clientName} added ${stored.filename} to the files on ${actor.project.name}.`],
            quote: input.note ?? undefined,
            action: { label: 'Open the files', url },
          },
        },
      });
      return done(thanks);
    }

    if (!input.emailOther) {
      await recordActivity(activity);
      return done(`${thanks} No email was sent.`);
    }
    const first = actor.project.clientName?.trim().split(/\s+/)[0];
    const { emailStatus } = await recordActivity({
      ...activity,
      email: {
        to: actor.project.clientEmail,
        subject: `New in your portal: ${stored.filename}`,
        content: {
          heading: `We shared ${stored.filename} with you`,
          paragraphs: [first ? `Hi ${first},` : 'Hello,', `We've added ${stored.filename} to the files for ${actor.project.name}.`],
          quote: input.note ?? undefined,
          action: { label: 'Open the files', url },
          footnotes: [`You're getting this because you're the client on ${actor.project.name}.`],
        },
      },
    });
    return done(`${thanks}${emailStatus === 'sent' ? ` We emailed ${clientName}.` : emailNote(emailStatus, clientName)}`);
  });
}

const removeSchema = z.object({ projectId: fields.uuid, fileId: fields.uuid });

export async function removeProjectFile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await projectActor(formData.get('projectId'));
    const input = parseForm(removeSchema, formData);
    const projectId = actor.project.id;

    const result = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .select({ id: file.id, filename: file.filename, uploadedBy: file.uploadedBy, removedAt: file.removedAt })
        .from(file)
        // Only the shared library: deliverable and contract files belong to their records
        .where(and(eq(file.id, input.fileId), eq(file.projectId, projectId), eq(file.purpose, 'project_file')))
        .for('update');
      if (!row) throw new ActionError(NOT_FOUND);
      if (!actor.isAdmin && row.uploadedBy !== actor.user.id) {
        throw new ActionError('Only the person who uploaded a file, or the studio, can remove it.');
      }
      // A second click: it is already gone
      if (row.removedAt) return { filename: row.filename, repeat: true };
      await tx.update(file).set({ removedAt: sql`now()` }).where(eq(file.id, row.id));
      return { filename: row.filename, repeat: false };
    });

    const removed = `Removed ${result.filename}.`;
    if (result.repeat) return done(removed);
    refresh(projectId);
    const who = actor.user.name || actor.user.email;
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: fileKind('removed', input.fileId),
      summary: actor.isAdmin ? `Removed ${result.filename} from the files` : `${who} removed ${result.filename} from the files`,
      target: 'files',
    });
    return done(removed);
  });
}

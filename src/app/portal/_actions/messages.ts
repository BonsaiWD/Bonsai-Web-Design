'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { message } from '@/db/schema';
import { projectHref } from '@/components/portal/tabs';
import { firstName } from '@/lib/portal-format';
import { isUuid, projectActor } from '@/server/portal/access';
import { ActionError, done, fields, parseForm, runAction, type ActionState } from '@/server/portal/actions';
import {
  claimThreadEmail,
  clientMessageEmail,
  INTERNAL_NOTE_KIND,
  markThreadRead,
  MESSAGE_KIND,
  MESSAGE_MAX_LENGTH,
  messageAnchor,
  normalizeBody,
  releaseThreadEmail,
  studioMessageEmail,
} from '@/server/portal/features/messages';
import { emailNote, portalOrigin, recordActivity, STUDIO_EMAIL } from '@/server/portal/notify';

/*
 * Every export here is an endpoint anyone can call with any arguments, so each one starts by
 * checking who is asking. The form sends the project, a client-made id and the person's own
 * words; the author and their side of the conversation come from the session.
 */

// fields.checkbox fails on an unticked box under Zod 4 (a missing key reads as "nonoptional")
const checkbox = z
  .union([z.literal('on'), z.literal('true')])
  .optional()
  .transform((value) => value !== undefined);

const sendSchema = z.object({
  projectId: fields.uuid,
  // Generated once per message in the browser, so a double submit inserts one row
  id: fields.uuid,
  body: z
    .string({ error: 'Write a message first.' })
    .transform((value) => normalizeBody(value).trim())
    .pipe(
      z
        .string()
        .min(1, { error: 'Write a message first.' })
        .max(MESSAGE_MAX_LENGTH, { error: `Messages can be up to ${MESSAGE_MAX_LENGTH.toLocaleString('en-US')} characters. Split this one in two.` }),
    ),
  internal: checkbox,
});

function refresh(projectId: string) {
  // The layout holds the tab badges; the dashboard lists unread conversations
  revalidatePath(projectHref(projectId), 'layout');
  revalidatePath('/portal');
}

export async function sendMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await projectActor(formData.get('projectId'));
    const input = parseForm(sendSchema, formData);
    if (input.internal && !actor.isAdmin) throw new ActionError('Only the studio can add internal notes.');

    const db = getDb();
    const projectId = actor.project.id;
    const fromStudio = actor.isAdmin;

    const [inserted] = await db
      .insert(message)
      .values({ id: input.id, projectId, authorId: actor.user.id, body: input.body, internal: input.internal })
      .onConflictDoNothing({ target: message.id })
      .returning({ id: message.id });
    if (!inserted) {
      // The same form sent twice: the first submit already posted it (and sent any email)
      const [existing] = await db
        .select({ internal: message.internal })
        .from(message)
        .where(and(eq(message.id, input.id), eq(message.projectId, projectId), eq(message.authorId, actor.user.id)));
      if (!existing) throw new ActionError('This message could not be sent. Reload the page and try again.');
      return done(existing.internal ? 'Saved as an internal note.' : 'Sent.');
    }

    refresh(projectId);
    const authorName = actor.user.name.trim() || (fromStudio ? 'Bonsai Web Design' : actor.user.email);

    if (input.internal) {
      await recordActivity({
        projectId,
        actorId: actor.user.id,
        kind: INTERNAL_NOTE_KIND,
        summary: `${authorName} added an internal note`,
        target: 'messages',
        visibility: 'studio',
      });
      return done('Saved as an internal note. Only the studio can see it.');
    }

    const clientName = actor.project.clientName || actor.project.clientEmail;
    const clientFirst = firstName(actor.project.clientName) ?? clientName;
    const to = fromStudio ? actor.project.clientEmail : STUDIO_EMAIL;
    const activityBase = { projectId, actorId: actor.user.id, kind: MESSAGE_KIND, summary: `${authorName} sent a message`, target: 'messages' };

    if (!(await claimThreadEmail(projectId, to))) {
      // Emailed about this conversation a few minutes ago: the message waits in the portal
      await recordActivity(activityBase);
      return done(
        fromStudio
          ? `Sent. ${clientFirst} had an email about this conversation in the last 10 minutes, so we didn't send another.`
          : "Sent. We'll reply here and email you when we do.",
      );
    }

    const url = `${await portalOrigin()}${projectHref(projectId, 'messages', messageAnchor(inserted.id))}`;
    const email = fromStudio
      ? studioMessageEmail({ authorName, clientName: actor.project.clientName, projectName: actor.project.name, body: input.body, url })
      : clientMessageEmail({ clientName, projectName: actor.project.name, body: input.body, url });
    const { emailStatus } = await recordActivity({ ...activityBase, email: { to, ...email } });
    if (emailStatus !== 'sent') await releaseThreadEmail(projectId, to);

    if (!fromStudio) return done("Sent. We'll reply here and email you when we do.");
    return done(emailStatus === 'sent' ? `Sent. We emailed ${clientFirst}.` : `Sent.${emailNote(emailStatus, clientFirst)}`);
  });
}

// Called when the conversation is on screen. shownMessageId is the newest message the page
// showed: anything from the other side that arrived after it stays unread.
export async function markMessagesRead(projectId: unknown, shownMessageId: unknown): Promise<ActionState> {
  return runAction(null, async () => {
    const actor = await projectActor(projectId);
    const { hadUnread } = await markThreadRead({
      userId: actor.user.id,
      projectId: actor.project.id,
      readerSide: actor.isAdmin ? 'studio' : 'client',
      shownMessageId: isUuid(shownMessageId) ? shownMessageId : null,
    });
    // Nothing was new: no badge to clear, so no need to re-render the page
    if (hadUnread) refresh(actor.project.id);
    return done('');
  });
}

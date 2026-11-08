'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { file, invoice, project, projectReadState, projectStage, user, type ProjectStage } from '@/db/schema';
import { hasSignedRecords, listParts, signedRecords } from '@/components/portal/admin/records';
import { STAGE_LABELS } from '@/components/portal/labels';
import { projectHref } from '@/components/portal/tabs';
import { firstName, formatDate } from '@/lib/portal-format';
import { adminActor, studioProjectActor } from '@/server/portal/access';
import { ActionError, done, fields, lf, parseForm, runAction, type ActionState } from '@/server/portal/actions';
import { portalOrigin, recordActivity } from '@/server/portal/notify';
import { displayName, lockClient } from '@/server/portal/features/clients';
import {
  countProjectRecords,
  lockProjectForRecords,
  PROJECT_KINDS,
  projectVersion,
  removeStoredFiles,
} from '@/server/portal/features/projects';

/* ---------- Form fields ---------- */

const name = fields.requiredText('the project name', 120);
const summary = fields.optionalText('the summary', 2000).transform(lf);
const stage = z.enum(projectStage.enumValues, { error: 'Choose a stage.' });
// A typo such as year 0202 would otherwise sort to the top of every deadline list
const targetLaunch = fields.optionalDate.refine((value) => !value || (value >= '2000-01-01' && value <= '2100-12-31'), {
    error: 'Choose a date between 2000 and 2100.',
});
const clientId = z.string().trim().min(1, { error: 'Choose a client.' }).max(200);

function refresh(projectId?: string) {
    if (projectId) revalidatePath(projectHref(projectId), 'layout');
    revalidatePath('/portal');
    revalidatePath('/portal/admin/clients');
}

/* ---------- New project ---------- */

const createSchema = z.object({
    id: fields.uuid,
    clientId,
    name,
    summary,
    stage,
    targetLaunch,
    emailClient: fields.checkbox,
});

export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await adminActor();
        const input = parseForm(createSchema, formData);

        const created = await getDb().transaction(async (tx) => {
            const client = await lockClient(tx, input.clientId);
            if (!client) {
                throw new ActionError('That client could not be found. Reload the page.', { clientId: 'Choose a client from the list.' });
            }
            const inserted = await tx
                .insert(project)
                .values({
                    id: input.id,
                    clientId: client.id,
                    name: input.name,
                    summary: input.summary,
                    stage: input.stage,
                    targetLaunch: input.targetLaunch,
                })
                // The form's id makes a double submit a no-op
                .onConflictDoNothing({ target: project.id })
                .returning({ id: project.id });
            if (inserted.length) return { repeat: false as const, client };
            const [existing] = await tx
                .select({ clientId: project.clientId, name: project.name })
                .from(project)
                .where(eq(project.id, input.id));
            if (existing?.clientId === client.id && existing.name === input.name) return { repeat: true as const, client };
            throw new ActionError('This form was already used. Reload the page to start another project.');
        });

        if (!created.repeat) {
            const greeting = firstName(created.client.name);
            const url = `${await portalOrigin()}${projectHref(input.id)}`;
            await recordActivity({
                projectId: input.id,
                actorId: actor.id,
                kind: PROJECT_KINDS.created,
                summary: 'Project created',
                target: 'overview',
                email: input.emailClient
                    ? {
                          to: created.client.email,
                          subject: `New project: ${input.name}`,
                          content: {
                              heading: `New project: ${input.name}`,
                              paragraphs: [
                                  greeting ? `Hi ${greeting},` : 'Hello,',
                                  `We've set up ${input.name} in your client portal. Its milestones, what we share for review and our messages will all be there as the project moves along.`,
                                  `Sign in with ${created.client.email}; we email you a link each time.`,
                              ],
                              action: { label: 'Open the project', url },
                          },
                      }
                    : undefined,
            });
            refresh(input.id);
        }
        // A failed email shows on the new project's overview and the dashboard
        redirect(projectHref(input.id));
    });
}

/* ---------- Project details ---------- */

const detailsSchema = z.object({
    projectId: fields.uuid,
    version: z.string().min(1),
    name,
    summary,
    stage,
    targetLaunch,
});

function stageSentence(next: ProjectStage): string {
    if (next === 'on_hold') return 'Project put on hold';
    if (next === 'launched') return 'Stage moved to Launched';
    return `Stage moved to ${STAGE_LABELS[next]}`;
}

export async function updateProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await studioProjectActor(formData.get('projectId'));
        const input = parseForm(detailsSchema, formData);
        const projectId = actor.project.id;

        const before = await getDb().transaction(async (tx) => {
            const [current] = await tx
                .select({
                    name: project.name,
                    summary: project.summary,
                    stage: project.stage,
                    targetLaunch: project.targetLaunch,
                    version: projectVersion,
                })
                .from(project)
                .where(eq(project.id, projectId))
                .for('update');
            if (!current) throw new ActionError('That project could not be found.');
            if (current.version !== input.version) {
                throw new ActionError(
                    'This project changed after you opened the page. Reload to see the latest, then make your edit again.',
                );
            }
            const unchanged =
                current.name === input.name &&
                current.summary === input.summary &&
                current.stage === input.stage &&
                current.targetLaunch === input.targetLaunch;
            if (!unchanged) {
                await tx
                    .update(project)
                    .set({ name: input.name, summary: input.summary, stage: input.stage, targetLaunch: input.targetLaunch })
                    .where(eq(project.id, projectId));
            }
            return { ...current, unchanged };
        });

        if (before.unchanged) return done('Saved. Nothing had changed.');

        // The client's timeline shows what changes for them; a reworded summary needs no line
        const entries: { kind: string; summary: string }[] = [];
        if (before.stage !== input.stage) entries.push({ kind: PROJECT_KINDS.stage, summary: stageSentence(input.stage) });
        if (before.targetLaunch !== input.targetLaunch) {
            entries.push({
                kind: PROJECT_KINDS.launch,
                summary: input.targetLaunch ? `Target launch set to ${formatDate(input.targetLaunch)}` : 'Target launch date removed',
            });
        }
        if (before.name !== input.name) entries.push({ kind: PROJECT_KINDS.renamed, summary: `Project renamed to ${input.name}` });
        for (const entry of entries) {
            await recordActivity({ projectId, actorId: actor.user.id, kind: entry.kind, summary: entry.summary, target: 'overview' });
        }

        refresh(projectId);
        return done(before.stage !== input.stage ? `Saved. ${stageSentence(input.stage)}.` : 'Saved.');
    });
}

/* ---------- Move to another client ---------- */

const reassignSchema = z.object({
    projectId: fields.uuid,
    // The client the page showed, so a change made meanwhile is not silently overwritten
    currentClientId: clientId,
    clientId,
});

export async function reassignProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await studioProjectActor(formData.get('projectId'));
        const input = parseForm(reassignSchema, formData);
        const projectId = actor.project.id;

        const moved = await getDb().transaction(async (tx) => {
            const current = await lockProjectForRecords(tx, projectId);
            if (!current) throw new ActionError('That project could not be found.');
            if (current.clientId !== input.currentClientId) {
                throw new ActionError('The client on this project changed after you opened the page. Reload to see who it belongs to now.');
            }
            if (input.clientId === current.clientId) {
                throw new ActionError('Choose a different client.', { clientId: 'Choose a different client.' });
            }
            const [from] = await tx.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, current.clientId));
            const to = await lockClient(tx, input.clientId);
            if (!to) {
                throw new ActionError('That client could not be found. Reload the page.', { clientId: 'Choose a client from the list.' });
            }

            // Decisions and signatures belong to the person who made them; they cannot move
            const records = await countProjectRecords(tx, projectId);
            if (hasSignedRecords(records)) {
                throw new ActionError(
                    `This project stays with ${from ? displayName(from) : 'its client'}: it has ${listParts(signedRecords(records))}, and those records belong to the person who made them.`,
                );
            }
            await tx.update(project).set({ clientId: to.id }).where(eq(project.id, projectId));
            // The previous client's read markers mean nothing to the new one
            await tx
                .delete(projectReadState)
                .where(and(eq(projectReadState.projectId, projectId), eq(projectReadState.userId, current.clientId)));
            return { from: from ? displayName(from) : 'the previous client', to: displayName(to), name: current.name };
        });

        await recordActivity({
            projectId,
            actorId: actor.user.id,
            kind: PROJECT_KINDS.client,
            summary: `Client changed from ${moved.from} to ${moved.to}`,
            visibility: 'studio',
        });
        refresh(projectId);
        return done(`${moved.name} now belongs to ${moved.to}.`);
    });
}

/* ---------- Delete ---------- */

const deleteSchema = z.object({
    projectId: fields.uuid,
    confirmName: z.string(),
});

export async function deleteProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await studioProjectActor(formData.get('projectId'));
        const input = parseForm(deleteSchema, formData);
        const projectId = actor.project.id;

        const storageKeys = await getDb().transaction(async (tx) => {
            const current = await lockProjectForRecords(tx, projectId);
            if (!current) throw new ActionError('That project could not be found.');
            if (input.confirmName.trim() !== current.name.trim()) {
                const message = `Type the project name exactly as shown: ${current.name}`;
                throw new ActionError(message, { confirmName: message });
            }
            const records = await countProjectRecords(tx, projectId);
            if (hasSignedRecords(records)) {
                throw new ActionError(
                    `This project can't be deleted: it has ${listParts(signedRecords(records))}, and signed records are kept. Set its stage to On hold instead.`,
                );
            }
            const keys = await tx.select({ key: file.storageKey }).from(file).where(eq(file.projectId, projectId));
            // Drafts were never sent, so they go with the project
            await tx.delete(invoice).where(and(eq(invoice.projectId, projectId), eq(invoice.status, 'draft')));
            await tx.delete(project).where(eq(project.id, projectId));
            return keys.map((row) => row.key);
        });

        await removeStoredFiles(projectId, storageKeys);
        revalidatePath('/portal', 'layout');
        redirect('/portal?deleted=1');
    });
}

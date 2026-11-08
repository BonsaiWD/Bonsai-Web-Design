'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { project, rateLimit, user } from '@/db/schema';
import { firstName, plural } from '@/lib/portal-format';
import { adminActor } from '@/server/portal/access';
import { ActionError, done, fields, parseForm, runAction, type ActionState } from '@/server/portal/actions';
import { recordActivity } from '@/server/portal/notify';
import {
    claimInviteSlot,
    clientProjectNames,
    displayName,
    endAccess,
    inviteEmail,
    inviteKey,
    lockClient,
    releaseInviteSlot,
    sendStandaloneEmail,
} from '@/server/portal/features/clients';

/* ---------- Form fields ---------- */

// An unticked box sends nothing; fields.checkbox needs the key present under Zod 4, so this
// marks it optional before turning it into a boolean
const checkbox = z
    .union([z.literal('on'), z.literal('true')])
    .optional()
    .transform((value) => value !== undefined);

// User ids are UUIDs when the portal or the database makes them, but a row added by hand
// may carry any text id, so only the shape is checked here and the row is looked up
const clientId = z.string().trim().min(1, { error: 'That client could not be found. Reload the page.' }).max(200);

const name = fields.requiredText('their name', 120);
const company = fields.optionalText('the company', 120);

const NOT_FOUND = 'That client could not be found. Reload the page.';

function refresh() {
    // Names and addresses show on every project page, the dashboards and the pickers
    revalidatePath('/portal', 'layout');
}

// The Postgres error code under Drizzle's wrapper, if the error came from the database
function pgCode(error: unknown): string | undefined {
    for (let current = error, depth = 0; current && depth < 4; depth++) {
        const code = (current as { code?: unknown }).code;
        if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
        current = (current as { cause?: unknown }).cause;
    }
    return undefined;
}

const isUniqueViolation = (error: unknown) => pgCode(error) === '23505';

async function ownerOf(email: string) {
    const [row] = await getDb().select({ id: user.id, name: user.name, email: user.email }).from(user).where(eq(user.email, email));
    return row ?? null;
}

function takenError(owner: { name: string | null; email: string }): ActionError {
    const message = `That address already belongs to ${displayName(owner)}.`;
    return new ActionError(message, { email: message });
}

type InviteOutcome = 'sent' | 'failed' | 'skipped' | 'throttled';

// Sends the invite if the 10-minute slot is free. A failed or skipped send gives the slot back.
async function sendInvite(client: {
    id: string;
    name: string | null;
    email: string;
}): Promise<{ outcome: InviteOutcome; waitMinutes?: number }> {
    const slot = await claimInviteSlot(client.id);
    if (!slot.ok) return { outcome: 'throttled', waitMinutes: slot.waitMinutes };
    const { subject, content } = await inviteEmail(client, await clientProjectNames(client.id));
    const status = await sendStandaloneEmail(client.email, subject, content);
    if (status !== 'sent') await releaseInviteSlot(client.id);
    return { outcome: status };
}

function inviteSentence(outcome: InviteOutcome, email: string, waitMinutes = 10): string {
    switch (outcome) {
        case 'sent':
            return ` We sent an invite to ${email}.`;
        case 'failed':
            return ` The invite to ${email} could not be sent; try Send invite again in a moment.`;
        case 'skipped':
            return ` (Preview: no invite was sent to ${email}.)`;
        default:
            return ` An invite went to them in the last 10 minutes, so no new one was sent; you can send another in ${plural(waitMinutes, 'minute')}.`;
    }
}

/* ---------- Add a client ---------- */

const addSchema = z.object({
    id: fields.uuid,
    name,
    company,
    email: fields.email,
    sendInvite: checkbox,
});

export async function addClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        await adminActor();
        const input = parseForm(addSchema, formData);

        let repeat: boolean;
        try {
            repeat = await getDb().transaction(async (tx) => {
                const [existing] = await tx
                    .select({ id: user.id, name: user.name, email: user.email })
                    .from(user)
                    .where(eq(user.email, input.email));
                // The same form sent twice: the client it added is the one asked for
                if (existing?.id === input.id) return true;
                if (existing) throw takenError(existing);
                const inserted = await tx
                    .insert(user)
                    .values({
                        id: input.id,
                        name: input.name,
                        company: input.company,
                        email: input.email,
                        role: 'client',
                        emailVerified: false,
                    })
                    .onConflictDoNothing({ target: user.id })
                    .returning({ id: user.id });
                if (inserted.length) return false;
                const [byId] = await tx.select({ email: user.email }).from(user).where(eq(user.id, input.id));
                if (byId?.email === input.email) return true;
                throw new ActionError('This form was already used. Close it and open Add client again.');
            });
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            const owner = await ownerOf(input.email);
            // The same form landing twice at once: the first one added this client
            if (owner?.id === input.id) repeat = true;
            // Two people adding the same address at once: the second hears whose it is
            else if (owner) throw takenError(owner);
            else throw error;
        }

        const added = `Added ${input.name} (${input.email}).`;
        if (repeat) {
            // Same message as the first submit, and no second email
            const [invited] = await getDb()
                .select({ id: rateLimit.id })
                .from(rateLimit)
                .where(eq(rateLimit.key, inviteKey(input.id)));
            return done(invited ? `${added}${inviteSentence('sent', input.email)}` : added);
        }

        refresh();
        if (!input.sendInvite) return done(`${added} Send an invite when you're ready.`);
        const invite = await sendInvite({ id: input.id, name: input.name, email: input.email });
        return done(`${added}${inviteSentence(invite.outcome, input.email, invite.waitMinutes)}`);
    });
}

/* ---------- Edit name and company ---------- */

const detailsSchema = z.object({ clientId, name, company });

export async function updateClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        await adminActor();
        const input = parseForm(detailsSchema, formData);

        const changed = await getDb().transaction(async (tx) => {
            const current = await lockClient(tx, input.clientId);
            if (!current) throw new ActionError(NOT_FOUND);
            if (current.name === input.name && (current.company ?? null) === input.company) return false;
            await tx.update(user).set({ name: input.name, company: input.company }).where(eq(user.id, current.id));
            return true;
        });

        if (!changed) return done('Saved. Nothing had changed.');
        refresh();
        return done(`Saved ${input.name}.`);
    });
}

/* ---------- Change email address ---------- */

const emailSchema = z.object({ clientId, email: fields.email, sendInvite: checkbox });

export async function changeClientEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await adminActor();
        const input = parseForm(emailSchema, formData);

        let result: { name: string; previous: string; devices: number; projects: string[] };
        try {
            result = await getDb().transaction(async (tx) => {
                const current = await lockClient(tx, input.clientId);
                if (!current) throw new ActionError(NOT_FOUND);
                if (current.email === input.email) {
                    const message = `That is already ${displayName(current)}'s address.`;
                    throw new ActionError(message, { email: message });
                }
                const [taken] = await tx
                    .select({ id: user.id, name: user.name, email: user.email })
                    .from(user)
                    .where(and(eq(user.email, input.email), ne(user.id, current.id)));
                if (taken) throw takenError(taken);

                // Proving the new address happens at the next sign-in, which needs a link sent to it
                await tx.update(user).set({ email: input.email, emailVerified: false }).where(eq(user.id, current.id));
                const devices = await endAccess(tx, current.id, [current.email, input.email]);
                const projects = await tx.select({ id: project.id }).from(project).where(eq(project.clientId, current.id));
                return { name: displayName(current), previous: current.email, devices, projects: projects.map((row) => row.id) };
            });
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            const owner = await ownerOf(input.email);
            if (owner) throw takenError(owner);
            throw error;
        }

        // Signatures and approvals are tied to an address, so each project keeps a note of the change
        for (const projectId of result.projects) {
            await recordActivity({
                projectId,
                actorId: actor.id,
                kind: 'client.email_changed',
                summary: `${result.name}'s email changed from ${result.previous} to ${input.email}`,
                visibility: 'studio',
            });
        }

        refresh();
        const signedOut = result.devices ? ` They were signed out of ${plural(result.devices, 'device')}.` : '';
        let invite = '';
        if (input.sendInvite) {
            // A new address gets its invite even if the old one had one minutes ago
            await releaseInviteSlot(input.clientId);
            const sent = await sendInvite({ id: input.clientId, name: result.name, email: input.email });
            invite = inviteSentence(sent.outcome, input.email, sent.waitMinutes);
        } else {
            invite = ` Send an invite so they can sign in with it.`;
        }
        return done(`${result.name}'s address is now ${input.email}.${signedOut}${invite}`);
    });
}

/* ---------- Sign out everywhere ---------- */

const clientSchema = z.object({ clientId });

export async function signOutClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        await adminActor();
        const input = parseForm(clientSchema, formData);

        const result = await getDb().transaction(async (tx) => {
            const current = await lockClient(tx, input.clientId);
            if (!current) throw new ActionError(NOT_FOUND);
            return { name: displayName(current), devices: await endAccess(tx, current.id, [current.email]) };
        });

        refresh();
        if (result.devices === 0) return done(`${result.name} was not signed in anywhere. Any unused sign-in links were cancelled.`);
        return done(`Signed ${result.name} out of ${plural(result.devices, 'device')}.`);
    });
}

/* ---------- Send the invite again ---------- */

export async function inviteClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        await adminActor();
        const input = parseForm(clientSchema, formData);

        const [client] = await getDb()
            .select({ id: user.id, name: user.name, email: user.email })
            .from(user)
            .where(and(eq(user.id, input.clientId), eq(user.role, 'client')));
        if (!client) throw new ActionError(NOT_FOUND);

        const invite = await sendInvite(client);
        const who = firstName(client.name) ?? client.email;
        refresh();
        switch (invite.outcome) {
            case 'sent':
                return done(`Sent an invite to ${client.email}.`);
            case 'skipped':
                return done(`Preview: no invite was sent to ${client.email}.`);
            case 'failed':
                throw new ActionError(`The invite to ${client.email} could not be sent. Try again in a moment.`);
            default:
                throw new ActionError(
                    `${who} was sent an invite in the last 10 minutes. You can send another in ${plural(invite.waitMinutes ?? 10, 'minute')}.`,
                );
        }
    });
}

/* ---------- Remove a client ---------- */

export async function removeClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        await adminActor();
        const input = parseForm(clientSchema, formData);

        let removed: { name: string; email: string };
        try {
            removed = await getDb().transaction(async (tx) => {
                const current = await lockClient(tx, input.clientId);
                if (!current) throw new ActionError(NOT_FOUND);
                const who = displayName(current);
                const projects = await tx.select({ name: project.name }).from(project).where(eq(project.clientId, current.id));
                if (projects.length) {
                    throw new ActionError(
                        `Can't remove ${who}: ${projects.length === 1 ? `${projects[0].name} is` : `${plural(projects.length, 'project')} are`} still theirs. Move or delete ${projects.length === 1 ? 'it' : 'them'} first.`,
                    );
                }
                await tx.delete(user).where(and(eq(user.id, current.id), eq(user.role, 'client')));
                await tx.delete(rateLimit).where(eq(rateLimit.key, inviteKey(current.id)));
                return { name: who, email: current.email };
            });
        } catch (error) {
            // Their messages, files or decisions on a project now with another client still name them
            if (pgCode(error) === '23503') {
                throw new ActionError(
                    "Can't remove this client: their messages, files or decisions are still part of another project's record, and those keep their author.",
                );
            }
            throw error;
        }

        refresh();
        return done(`Removed ${removed.name} (${removed.email}).`);
    });
}

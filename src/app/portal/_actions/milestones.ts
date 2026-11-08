'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, asc, eq, max, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { deliverable, milestone, milestoneSignoff, milestoneStatus, project, rateLimit, user, type MilestoneStatus } from '@/db/schema';
import { projectHref } from '@/components/portal/tabs';
import { firstName, formatDate } from '@/lib/portal-format';
import { assertStillClient, projectActor, type Tx } from '@/server/portal/access';
import { ActionError, done, fields, parseForm, runAction, type ActionState } from '@/server/portal/actions';
import { emailNote, portalOrigin, recordActivity, STUDIO_EMAIL } from '@/server/portal/notify';
import { requestMeta } from '@/server/portal/request';
import {
    formatUtc,
    milestoneKind,
    milestoneVersion,
    pendingReview,
    releaseSignoffAsk,
    SIGNOFF_ASK_INTERVAL_MS,
    SIGNOFF_METHODS,
    signoffAskKey,
    signoffStatement,
    studioProjectActor,
    studioSignoffStatement,
} from '@/server/portal/features/milestones';

/* ---------- Form fields ---------- */

const title = z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, { error: 'Give the milestone a title.' }).max(200, { error: 'Keep the title under 200 characters.' }));

// Browsers send textarea line breaks as CRLF; store plain LF so text compares and renders alike
const lf = <T extends string | null>(value: T): T => (value === null ? value : (value.replace(/\r\n?/g, '\n') as T));

const description = fields.optionalText('the description', 4000).transform(lf);

const status = z.enum(milestoneStatus.enumValues, { error: 'Choose a status.' });

// A typo such as year 0202 would otherwise sort to the top of every deadline list
const dueDate = fields.optionalDate.refine((value) => !value || (value >= '2000-01-01' && value <= '2100-12-31'), {
    error: 'Choose a date between 2000 and 2100.',
});

// An unticked box sends nothing. fields.checkbox fails on the missing key under Zod 4 (its
// transform makes the key required), so this marks the key optional before transforming.
const checkbox = z
    .union([z.literal('on'), z.literal('true')])
    .optional()
    .transform((value) => value !== undefined);

const NOT_FOUND = 'That milestone could not be found. Reload the page.';

/* ---------- Helpers ---------- */

function refresh(projectId: string) {
    revalidatePath(projectHref(projectId), 'layout');
    revalidatePath('/portal');
}

async function milestoneUrl(projectId: string, milestoneId: string) {
    return `${await portalOrigin()}${projectHref(projectId, 'milestones', `milestone-${milestoneId}`)}`;
}

// Positions 1..n in the current order, without touching updated_at: a reorder is not an
// edit, so it must not make someone's open edit form look stale
async function renumber(tx: Tx, rows: { id: string; position: number }[]) {
    for (const [index, row] of rows.entries()) {
        if (row.position === index + 1) continue;
        await tx
            .update(milestone)
            .set({ position: index + 1, updatedAt: sql`${milestone.updatedAt}` })
            .where(eq(milestone.id, row.id));
    }
}

// Locks the project's milestones, so concurrent moves and deletes queue up, then reads their
// order in a separate statement. Postgres sorts a locking SELECT before it waits for the locks,
// so a request that queued behind another move would get its rows in the old order; the
// second read sees what the first committed. Locks are taken in id order, as the deliverable
// actions take theirs, so the two never wait on each other in a circle. A move only needs
// "no key update", which still lets other features insert rows pointing at a milestone; a
// delete takes the full lock, so a sign-off cannot land between check and delete.
async function lockOrder(tx: Tx, projectId: string, strength: 'update' | 'no key update') {
    await tx.select({ id: milestone.id }).from(milestone).where(eq(milestone.projectId, projectId)).orderBy(asc(milestone.id)).for(strength);
    return tx
        .select({ id: milestone.id, title: milestone.title, position: milestone.position })
        .from(milestone)
        .where(eq(milestone.projectId, projectId))
        .orderBy(asc(milestone.position), asc(milestone.createdAt));
}

function statusSummary(milestoneTitle: string, next: MilestoneStatus, clientName: string): string {
    switch (next) {
        case 'done':
            return `${milestoneTitle} is done`;
        case 'in_progress':
            return `${milestoneTitle} is in progress`;
        case 'waiting_on_client':
            return `${milestoneTitle} is waiting on ${clientName}`;
        default:
            return `${milestoneTitle} is upcoming`;
    }
}

/* ---------- Studio: add, edit, move, delete ---------- */

const addSchema = z.object({
    id: fields.uuid,
    projectId: fields.uuid,
    title,
    description,
    status,
    dueDate,
    requiresSignoff: checkbox,
});

export async function addMilestone(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await studioProjectActor(formData.get('projectId'));
        const input = parseForm(addSchema, formData);
        const projectId = actor.project.id;

        const outcome = await getDb().transaction(async (tx) => {
            // Lock the project so two adds at once cannot take the same position ("no key update"
            // leaves other features free to insert rows that point at the project meanwhile)
            await tx.select({ id: project.id }).from(project).where(eq(project.id, projectId)).for('no key update');
            const [{ last }] = await tx
                .select({ last: max(milestone.position) })
                .from(milestone)
                .where(eq(milestone.projectId, projectId));
            const inserted = await tx
                .insert(milestone)
                .values({
                    id: input.id,
                    projectId,
                    title: input.title,
                    description: input.description,
                    status: input.status,
                    dueDate: input.dueDate,
                    requiresSignoff: input.requiresSignoff,
                    position: (last ?? 0) + 1,
                })
                // The form's id makes a double submit a no-op
                .onConflictDoNothing({ target: milestone.id })
                .returning({ id: milestone.id });
            if (inserted.length > 0) return 'added' as const;
            const [existing] = await tx
                .select({ projectId: milestone.projectId })
                .from(milestone)
                .where(eq(milestone.id, input.id));
            if (existing?.projectId !== projectId) throw new ActionError('That milestone could not be saved. Reload the page and try again.');
            return 'repeat' as const;
        });

        if (outcome === 'added') {
            await recordActivity({
                projectId,
                actorId: actor.user.id,
                kind: milestoneKind('added', input.id),
                summary: `New milestone: ${input.title}`,
                target: 'milestones',
            });
            refresh(projectId);
        }
        return done(`Added ${input.title}.`);
    });
}

const updateSchema = z.object({
    id: fields.uuid,
    projectId: fields.uuid,
    version: z.string().min(1),
    title,
    description,
    status,
    dueDate,
    requiresSignoff: checkbox,
});

export async function updateMilestone(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await studioProjectActor(formData.get('projectId'));
        const input = parseForm(updateSchema, formData);
        const projectId = actor.project.id;

        const before = await getDb().transaction(async (tx) => {
            const [current] = await tx
                .select({
                    title: milestone.title,
                    description: milestone.description,
                    status: milestone.status,
                    dueDate: milestone.dueDate,
                    requiresSignoff: milestone.requiresSignoff,
                    version: milestoneVersion,
                })
                .from(milestone)
                .where(and(eq(milestone.id, input.id), eq(milestone.projectId, projectId)))
                .for('update');
            if (!current) throw new ActionError(NOT_FOUND);
            // A sign-off or a deliverable decision may have changed it since the form loaded
            if (current.version !== input.version) {
                throw new ActionError('This milestone changed after you opened it. Reload the page to see the latest, then make your edit again.');
            }
            const unchanged =
                current.title === input.title &&
                current.description === input.description &&
                current.status === input.status &&
                current.dueDate === input.dueDate &&
                current.requiresSignoff === input.requiresSignoff;
            if (!unchanged) {
                await tx
                    .update(milestone)
                    .set({
                        title: input.title,
                        description: input.description,
                        status: input.status,
                        dueDate: input.dueDate,
                        requiresSignoff: input.requiresSignoff,
                    })
                    .where(eq(milestone.id, input.id));
            }
            return { ...current, unchanged };
        });

        if (before.unchanged) return done('Saved. Nothing had changed.');

        // The client's timeline shows status and date changes; renames and wording do not need a line
        const clientName = actor.project.clientName || actor.project.clientEmail;
        if (before.status !== input.status) {
            await recordActivity({
                projectId,
                actorId: actor.user.id,
                kind: milestoneKind('status', input.id),
                summary: statusSummary(input.title, input.status, clientName),
                target: 'milestones',
            });
        }
        if (before.dueDate !== input.dueDate) {
            await recordActivity({
                projectId,
                actorId: actor.user.id,
                kind: milestoneKind('due', input.id),
                summary: input.dueDate ? `${input.title} is now due ${formatDate(input.dueDate)}` : `${input.title} no longer has a due date`,
                target: 'milestones',
            });
        }
        refresh(projectId);
        return done(`Saved ${input.title}.`);
    });
}

const moveSchema = z.object({
    id: fields.uuid,
    projectId: fields.uuid,
    direction: z.enum(['up', 'down'], { error: 'Choose a direction.' }),
});

export async function moveMilestone(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await studioProjectActor(formData.get('projectId'));
        const input = parseForm(moveSchema, formData);
        const projectId = actor.project.id;

        const result = await getDb().transaction(async (tx) => {
            const rows = await lockOrder(tx, projectId, 'no key update');
            const index = rows.findIndex((row) => row.id === input.id);
            if (index < 0) throw new ActionError(NOT_FOUND);
            const target = input.direction === 'up' ? index - 1 : index + 1;
            if (target < 0 || target >= rows.length) return { moved: false, place: index + 1, total: rows.length };
            const order = [...rows];
            [order[index], order[target]] = [order[target], order[index]];
            await renumber(tx, order);
            return { moved: true, place: target + 1, total: rows.length };
        });

        if (result.moved) refresh(projectId);
        if (!result.moved) return done(input.direction === 'up' ? 'Already first.' : 'Already last.');
        return done(`Moved to ${result.place} of ${result.total}.`);
    });
}

const deleteSchema = z.object({ id: fields.uuid, projectId: fields.uuid });

export async function deleteMilestone(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await studioProjectActor(formData.get('projectId'));
        const input = parseForm(deleteSchema, formData);
        const projectId = actor.project.id;

        const deletedTitle = await getDb().transaction(async (tx) => {
            // The delete unlinks these deliverables (ON DELETE SET NULL), which locks them.
            // Deliverable actions lock the deliverable before its milestone, so take them
            // first too; the other way round, a decision landing now could deadlock with us.
            await tx
                .select({ id: deliverable.id })
                .from(deliverable)
                .where(and(eq(deliverable.milestoneId, input.id), eq(deliverable.projectId, projectId)))
                .orderBy(asc(deliverable.id))
                .for('update');
            const rows = await lockOrder(tx, projectId, 'update');
            const row = rows.find((candidate) => candidate.id === input.id);
            if (!row) throw new ActionError(NOT_FOUND);
            const [signed] = await tx
                .select({ source: milestoneSignoff.source, signedAt: milestoneSignoff.signedAt, name: user.name, email: user.email })
                .from(milestoneSignoff)
                .innerJoin(user, eq(user.id, milestoneSignoff.signerId))
                .where(eq(milestoneSignoff.milestoneId, row.id));
            if (signed) {
                const who = signed.name || signed.email;
                const when = formatDate(signed.signedAt.toISOString());
                throw new ActionError(
                    signed.source === 'client'
                        ? `Can't delete: initialled by ${who} on ${when}. Signed records are kept.`
                        : `Can't delete: a sign-off was recorded by ${who} on ${when}. Signed records are kept.`,
                );
            }
            await tx.delete(milestone).where(and(eq(milestone.id, row.id), eq(milestone.projectId, projectId)));
            await renumber(
                tx,
                rows.filter((candidate) => candidate.id !== row.id),
            );
            return row.title;
        });

        await recordActivity({
            projectId,
            actorId: actor.user.id,
            kind: milestoneKind('deleted', input.id),
            summary: `Deleted milestone ${deletedTitle}`,
            target: 'milestones',
            visibility: 'studio',
        });
        refresh(projectId);
        return done(`Deleted ${deletedTitle}.`);
    });
}

/* ---------- Studio: ask for and record sign-offs ---------- */

const askSchema = z.object({ id: fields.uuid, projectId: fields.uuid });

export async function askForSignoff(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await studioProjectActor(formData.get('projectId'));
        const input = parseForm(askSchema, formData);
        const projectId = actor.project.id;
        const clientName = actor.project.clientName || actor.project.clientEmail;

        const clientFirst = firstName(clientName) ?? clientName;
        const row = await getDb().transaction(async (tx) => {
            const [current] = await tx
                .select({
                    id: milestone.id,
                    title: milestone.title,
                    dueDate: milestone.dueDate,
                    status: milestone.status,
                    requiresSignoff: milestone.requiresSignoff,
                })
                .from(milestone)
                .where(and(eq(milestone.id, input.id), eq(milestone.projectId, projectId)))
                .for('update');
            if (!current) throw new ActionError(NOT_FOUND);
            const [signed] = await tx
                .select({ id: milestoneSignoff.id })
                .from(milestoneSignoff)
                .where(eq(milestoneSignoff.milestoneId, current.id));
            if (signed) throw new ActionError(`${current.title} is already signed off.`);
            // The client cannot initial while a linked review is open, so an email now would
            // ask for something they cannot do yet
            const review = await pendingReview(tx, current.id);
            if (review) {
                throw new ActionError(`${clientFirst} is still reviewing ${review}. Once it's approved, ${clientFirst} is asked to initial ${current.title}.`);
            }

            // At most one request email per milestone every ten minutes, so a double click or
            // an eager reminder cannot flood the client's inbox. The previous time is kept, so
            // the claim can be given back if this email does not go out.
            const [previous] = await tx
                .select({ lastRequest: rateLimit.lastRequest })
                .from(rateLimit)
                .where(eq(rateLimit.key, signoffAskKey(current.id)));
            const now = Date.now();
            const claimed = await tx
                .insert(rateLimit)
                .values({ id: randomUUID(), key: signoffAskKey(current.id), count: 1, lastRequest: now })
                .onConflictDoUpdate({
                    target: rateLimit.key,
                    set: { count: sql`${rateLimit.count} + 1`, lastRequest: now },
                    setWhere: sql`${rateLimit.lastRequest} < ${now - SIGNOFF_ASK_INTERVAL_MS}`,
                })
                .returning({ id: rateLimit.id });
            if (claimed.length === 0) {
                throw new ActionError(`${clientFirst} was emailed about this in the last 10 minutes. Give it a little while before sending a reminder.`);
            }

            await tx
                .update(milestone)
                .set({ requiresSignoff: true, status: 'waiting_on_client' })
                .where(eq(milestone.id, current.id));
            return { ...current, claimedAt: now, previousAskAt: previous?.lastRequest ?? null };
        });

        const greeting = firstName(actor.project.clientName);
        const { emailStatus } = await recordActivity({
            projectId,
            actorId: actor.user.id,
            kind: milestoneKind('signoff_requested', row.id),
            summary: `Sign-off requested for ${row.title}`,
            target: 'milestones',
            email: {
                to: actor.project.clientEmail,
                subject: `Please initial ${row.title}`,
                content: {
                    heading: `Your sign-off is needed on ${row.title}`,
                    paragraphs: [
                        ...(greeting ? [`Hi ${greeting},`] : []),
                        `${row.title} on ${actor.project.name} is ready for your sign-off. When you're happy it's complete, add your initials in the portal and we'll move on to the next step.`,
                        ...(row.dueDate ? [`It's due ${formatDate(row.dueDate)}.`] : []),
                    ],
                    action: { label: 'Review and initial', url: await milestoneUrl(projectId, row.id) },
                    footnotes: ['Your initials and the time are recorded with your sign-off. If something needs another look, message us in the portal instead.'],
                },
            },
        });
        if (emailStatus !== 'sent') await releaseSignoffAsk(row.id, row.claimedAt, row.previousAskAt);
        refresh(projectId);
        const verb = row.requiresSignoff && row.status === 'waiting_on_client' ? 'Reminded' : 'Asked';
        return done(`${verb} ${clientName} to initial ${row.title}.${emailNote(emailStatus, clientName)}`);
    });
}

const recordSchema = z.object({
    id: fields.uuid,
    projectId: fields.uuid,
    method: z.enum(Object.keys(SIGNOFF_METHODS) as [keyof typeof SIGNOFF_METHODS, ...(keyof typeof SIGNOFF_METHODS)[]], {
        error: 'Choose how they confirmed it.',
    }),
    note: fields.requiredText('a note about what they said and when', 2000).transform(lf),
});

export async function recordSignoff(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await studioProjectActor(formData.get('projectId'));
        const input = parseForm(recordSchema, formData);
        const projectId = actor.project.id;
        const clientName = actor.project.clientName || actor.project.clientEmail;
        const recordedBy = actor.user.name || actor.user.email;
        const meta = await requestMeta();

        const record = await getDb().transaction(async (tx) => {
            const [current] = await tx
                .select({ id: milestone.id, title: milestone.title })
                .from(milestone)
                .where(and(eq(milestone.id, input.id), eq(milestone.projectId, projectId)))
                .for('update');
            if (!current) throw new ActionError(NOT_FOUND);
            const [signed] = await tx
                .select({ id: milestoneSignoff.id })
                .from(milestoneSignoff)
                .where(eq(milestoneSignoff.milestoneId, current.id));
            if (signed) throw new ActionError(`${current.title} is already signed off.`);

            const statement = studioSignoffStatement({ recordedBy, clientName, title: current.title, method: input.method });
            const [inserted] = await tx
                .insert(milestoneSignoff)
                .values({
                    milestoneId: current.id,
                    projectId,
                    source: 'studio',
                    // The record names who entered it; the statement names the client and how
                    signerId: actor.user.id,
                    signerEmail: actor.user.email,
                    initials: null,
                    statement,
                    note: input.note,
                    ipAddress: meta.ipAddress,
                    userAgent: meta.userAgent,
                })
                .returning({ signedAt: milestoneSignoff.signedAt });
            await tx.update(milestone).set({ status: 'done' }).where(eq(milestone.id, current.id));
            return { title: current.title, statement, signedAt: inserted.signedAt };
        });

        // The client gets a copy of anything recorded in their name
        const { emailStatus } = await recordActivity({
            projectId,
            actorId: actor.user.id,
            kind: milestoneKind('signoff_recorded', input.id),
            summary: `Sign-off for ${record.title} recorded by the studio (${SIGNOFF_METHODS[input.method]})`,
            target: 'milestones',
            email: {
                to: actor.project.clientEmail,
                subject: `We recorded your sign-off: ${record.title}`,
                content: {
                    heading: `${record.title} is signed off`,
                    paragraphs: [
                        `You confirmed ${record.title} ${SIGNOFF_METHODS[input.method]}, so we've recorded your sign-off in the portal.`,
                        `Record: "${record.statement}"`,
                        `Recorded: ${formatUtc(record.signedAt)}`,
                    ],
                    quote: input.note,
                    action: { label: 'View in the portal', url: await milestoneUrl(projectId, input.id) },
                    footnotes: ["If anything here isn't right, reply to this email and we'll talk it through."],
                },
            },
        });
        refresh(projectId);
        return done(`Recorded ${clientName}'s sign-off for ${record.title}.${emailNote(emailStatus, clientName)}`);
    });
}

/* ---------- Client: initial a milestone ---------- */

const signoffSchema = z.object({
    id: fields.uuid,
    projectId: fields.uuid,
    // The title the client saw in the statement; a rename since then means they review again
    shownTitle: z.string(),
    initials: z
        .string()
        .transform((value) => value.trim())
        .pipe(
            z
                .string()
                .min(1, { error: 'Enter your initials.' })
                .max(6, { error: 'Use up to 6 letters.' })
                .regex(/^\p{L}+$/u, { error: 'Use letters only, with no dots or spaces.' }),
        )
        .transform((value) => value.toLocaleUpperCase('en-US')),
    note: fields.optionalText('your note', 2000).transform(lf),
    confirm: checkbox.refine((value) => value, { error: 'Tick the box to confirm the statement.' }),
});

export async function signOffMilestone(_prev: ActionState, formData: FormData): Promise<ActionState> {
    return runAction(formData, async () => {
        const actor = await projectActor(formData.get('projectId'), { clientOnly: true });
        const input = parseForm(signoffSchema, formData);
        const projectId = actor.project.id;
        const meta = await requestMeta();

        const result = await getDb().transaction(async (tx) => {
            await assertStillClient(tx, actor);
            const [current] = await tx
                .select({ id: milestone.id, title: milestone.title, status: milestone.status, requiresSignoff: milestone.requiresSignoff })
                .from(milestone)
                .where(and(eq(milestone.id, input.id), eq(milestone.projectId, projectId)))
                .for('update');
            if (!current) throw new ActionError(NOT_FOUND);

            const existing = async () => {
                const [row] = await tx
                    .select({ signerId: milestoneSignoff.signerId, source: milestoneSignoff.source })
                    .from(milestoneSignoff)
                    .where(eq(milestoneSignoff.milestoneId, current.id));
                return row;
            };
            const already = await existing();
            // A second click on the same sign-off is the same sign-off
            if (already?.source === 'client' && already.signerId === actor.user.id) return { repeat: true as const, title: current.title };
            if (already) throw new ActionError(`${current.title} is already signed off.`);
            if (!current.requiresSignoff) throw new ActionError(`${current.title} no longer needs your sign-off. Reload the page to see the latest.`);
            // Initials are asked for once the step is waiting on the client, after any linked review
            if (current.status !== 'waiting_on_client') {
                throw new ActionError(`${current.title} isn't ready for your sign-off yet. We'll email you when it is.`);
            }
            const review = await pendingReview(tx, current.id);
            if (review) throw new ActionError(`Review ${review} first. Once you've approved it, you can initial ${current.title}.`);
            if (current.title !== input.shownTitle) {
                throw new ActionError(`This milestone was just renamed to ${current.title}. Reload the page, check it, then initial it again.`);
            }

            const statement = signoffStatement(current.title);
            const [inserted] = await tx
                .insert(milestoneSignoff)
                .values({
                    milestoneId: current.id,
                    projectId,
                    source: 'client',
                    signerId: actor.user.id,
                    signerEmail: actor.user.email,
                    initials: input.initials,
                    statement,
                    note: input.note,
                    ipAddress: meta.ipAddress,
                    userAgent: meta.userAgent,
                })
                .onConflictDoNothing({ target: milestoneSignoff.milestoneId })
                .returning({ signedAt: milestoneSignoff.signedAt });
            if (!inserted) {
                const raced = await existing();
                if (raced?.source === 'client' && raced.signerId === actor.user.id) return { repeat: true as const, title: current.title };
                throw new ActionError(`${current.title} is already signed off.`);
            }
            await tx.update(milestone).set({ status: 'done' }).where(eq(milestone.id, current.id));
            return { repeat: false as const, title: current.title, statement, signedAt: inserted.signedAt };
        });

        const thanks = `Thanks, ${result.title} is signed off.`;
        if (result.repeat) return done(thanks);

        const name = actor.user.name || actor.user.email;
        const url = await milestoneUrl(projectId, input.id);
        const facts = [
            `Milestone: ${result.title}`,
            `Statement: "${result.statement}"`,
            `Initials: ${input.initials}`,
            `Signed: ${formatUtc(result.signedAt)}`,
        ];

        await recordActivity({
            projectId,
            actorId: actor.user.id,
            kind: milestoneKind('signoff', input.id),
            summary: `${name} initialled ${result.title}`,
            target: 'milestones',
            email: {
                to: STUDIO_EMAIL,
                subject: `${name} initialled ${result.title}`,
                content: {
                    heading: `${result.title} is signed off`,
                    paragraphs: [`${name} (${actor.user.email}) initialled ${result.title} on ${actor.project.name}.`, ...facts],
                    quote: input.note ?? undefined,
                    action: { label: 'Open the milestone', url },
                },
            },
        });
        const receipt = await recordActivity({
            projectId,
            actorId: actor.user.id,
            kind: milestoneKind('signoff_receipt', input.id),
            summary: `Sign-off receipt for ${result.title} emailed to ${name}`,
            target: 'milestones',
            // The client already sees their sign-off on the timeline; this row tracks the email
            visibility: 'studio',
            email: {
                to: actor.user.email,
                subject: `Your sign-off: ${result.title}`,
                content: {
                    heading: `Thanks, ${result.title} is signed off`,
                    paragraphs: ['Here is a copy of your sign-off for your records.', ...facts],
                    quote: input.note ?? undefined,
                    action: { label: 'View in the portal', url },
                    footnotes: [`If you didn't sign this off, tell us at ${STUDIO_EMAIL}.`],
                },
            },
        });

        refresh(projectId);
        return done(receipt.emailStatus === 'failed' ? `${thanks} We couldn't email your copy, but your sign-off is saved here.` : `${thanks} We've emailed you a copy.`);
    });
}

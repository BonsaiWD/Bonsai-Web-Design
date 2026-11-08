import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNotNull, like, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '@/db';
import { activity, deliverable, deliverableVersion, milestone, milestoneSignoff, project, rateLimit, user } from '@/db/schema';
import { asksForInitials } from '@/components/portal/milestones/signoff';
import type { LinkedDeliverable, MilestoneView, SignoffRecord } from '@/components/portal/milestones/types';
import { daysBetween, firstName } from '@/lib/portal-format';
import { adminActor, isUuid, projectActor, type Tx } from '../access';
import { STUDIO_EMAIL } from '../notify';
import { projectScope, type AttentionItem, type DeadlineItem, type FeatureContext, type Perspective, type PortalFeature } from '../attention';

/* ---------- Shared by the page, the provider and the actions ---------- */

// Changes on every save (to the microsecond), so an edit made from a stale form is refused
export const milestoneVersion = sql<string>`to_char(${milestone.updatedAt} at time zone 'UTC', 'YYYYMMDDHH24MISSUS')`;

export { signoffStatement } from '@/components/portal/milestones/statement';
export { asksForInitials };

/* ---------- Activity kinds ----------
   "milestone.<event>:<milestoneId>", like the other features' kinds, so a failed email can
   link to its milestone and clear once a later email of the same kind reaches the same
   person. Rows written before used "milestone_<event>" with no id; both match 'milestone%'. */

export type MilestoneEvent = 'added' | 'status' | 'due' | 'deleted' | 'signoff_requested' | 'signoff_recorded' | 'signoff' | 'signoff_receipt';

export function milestoneKind(event: MilestoneEvent, milestoneId: string): string {
    return `milestone.${event}:${milestoneId}`;
}

function parseKind(kind: string): { event: string; milestoneId: string | null } {
    const current = /^milestone\.([a-z_]+):(.*)$/.exec(kind);
    if (current) return { event: current[1], milestoneId: isUuid(current[2]) ? current[2] : null };
    return { event: kind.replace(/^milestone_?/, ''), milestoneId: null };
}

export const SIGNOFF_METHODS = {
    email: 'by email',
    phone: 'by phone',
    call: 'on a video call',
    in_person: 'in person',
} as const;

export type SignoffMethod = keyof typeof SIGNOFF_METHODS;

// What the record says when the studio enters a sign-off the client gave elsewhere
export function studioSignoffStatement(options: { recordedBy: string; clientName: string; title: string; method: SignoffMethod }): string {
    return `${options.recordedBy} recorded that ${options.clientName} confirmed ${options.title} is complete and approved moving on, ${SIGNOFF_METHODS[options.method]}.`;
}

// One rate-limit row per milestone: when the client was last emailed a sign-off request
export function signoffAskKey(milestoneId: string): string {
    return `portal:milestone-signoff-ask:${milestoneId}`;
}

export const SIGNOFF_ASK_INTERVAL_MS = 10 * 60 * 1000;

// Gives back an ask whose email did not go out, so Remind works straight away and "Emailed
// <time>" keeps pointing at the last email that really went. Only the claim this request
// made is touched.
export async function releaseSignoffAsk(milestoneId: string, claimedAt: number, previousAt: number | null): Promise<void> {
    const mine = and(eq(rateLimit.key, signoffAskKey(milestoneId)), eq(rateLimit.lastRequest, claimedAt));
    if (previousAt === null) await getDb().delete(rateLimit).where(mine);
    else await getDb().update(rateLimit).set({ lastRequest: previousAt, count: sql`greatest(${rateLimit.count} - 1, 1)` }).where(mine);
}

// The first linked deliverable whose newest version is still in review, if any: that review
// comes before the client's initials
export async function pendingReview(tx: Tx, milestoneId: string): Promise<string | null> {
    const [row] = await tx
        .select({ title: deliverable.title })
        .from(deliverable)
        .innerJoin(
            deliverableVersion,
            and(eq(deliverableVersion.deliverableId, deliverable.id), eq(deliverableVersion.version, deliverable.latestVersion)),
        )
        .where(and(eq(deliverable.milestoneId, milestoneId), eq(deliverableVersion.status, 'in_review')))
        .orderBy(asc(deliverable.createdAt))
        .limit(1);
    return row?.title ?? null;
}

// "Nov 8, 2026, 3:04 PM UTC": emails cannot know the reader's time zone, so they say UTC
const utcMoment = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
});

export function formatUtc(value: Date): string {
    return utcMoment.format(value);
}

// Studio actions on a project: the signed-in user must be an admin, and the project must exist
export async function studioProjectActor(projectId: unknown) {
    await adminActor();
    return projectActor(projectId);
}

/* ---------- The milestones page ---------- */

const signer = alias(user, 'signer');

export async function loadMilestones(projectId: string, perspective: Perspective): Promise<MilestoneView[]> {
    const db = getDb();
    const studio = perspective === 'studio';

    const rows = await db
        .select({
            id: milestone.id,
            title: milestone.title,
            description: milestone.description,
            status: milestone.status,
            dueDate: milestone.dueDate,
            requiresSignoff: milestone.requiresSignoff,
            version: milestoneVersion,
            signoffId: milestoneSignoff.id,
            source: milestoneSignoff.source,
            initials: milestoneSignoff.initials,
            statement: milestoneSignoff.statement,
            note: milestoneSignoff.note,
            signedAt: milestoneSignoff.signedAt,
            signerEmail: milestoneSignoff.signerEmail,
            ipAddress: milestoneSignoff.ipAddress,
            userAgent: milestoneSignoff.userAgent,
            signerName: signer.name,
        })
        .from(milestone)
        .leftJoin(milestoneSignoff, eq(milestoneSignoff.milestoneId, milestone.id))
        .leftJoin(signer, eq(signer.id, milestoneSignoff.signerId))
        .where(eq(milestone.projectId, projectId))
        .orderBy(asc(milestone.position), asc(milestone.createdAt));

    if (rows.length === 0) return [];

    const [linked, asks] = await Promise.all([
        loadLinkedDeliverables(projectId),
        db
            .select({ key: rateLimit.key, lastRequest: rateLimit.lastRequest })
            .from(rateLimit)
            .where(inArray(rateLimit.key, rows.map((row) => signoffAskKey(row.id)))),
    ]);
    const askedAt = new Map(asks.map((ask) => [ask.key, new Date(ask.lastRequest).toISOString()]));

    return rows.map((row) => {
        let signoff: SignoffRecord | null = null;
        if (row.signoffId && row.source && row.statement && row.signedAt) {
            signoff = {
                id: row.signoffId,
                source: row.source,
                initials: row.initials,
                signerName: row.signerName || row.signerEmail || 'Unknown',
                statement: row.statement,
                note: row.note,
                signedAt: row.signedAt.toISOString(),
                // Where and how it was signed is evidence for the studio, not something the client needs
                ...(studio ? { signerEmail: row.signerEmail ?? '', ipAddress: row.ipAddress, userAgent: row.userAgent } : {}),
            };
        }
        return {
            id: row.id,
            title: row.title,
            description: row.description,
            status: row.status,
            dueDate: row.dueDate,
            requiresSignoff: row.requiresSignoff,
            version: row.version,
            signoff,
            linked: linked.get(row.id) ?? [],
            signoffRequestedAt: askedAt.get(signoffAskKey(row.id)) ?? null,
        };
    });
}

// Deliverables linked to each milestone with their newest shared version. Withdrawn
// versions never reach the client, so they are skipped for everyone here.
async function loadLinkedDeliverables(projectId: string): Promise<Map<string, LinkedDeliverable[]>> {
    const rows = await getDb()
        .select({
            id: deliverable.id,
            title: deliverable.title,
            milestoneId: deliverable.milestoneId,
            status: deliverableVersion.status,
            version: deliverableVersion.version,
        })
        .from(deliverable)
        .innerJoin(deliverableVersion, eq(deliverableVersion.deliverableId, deliverable.id))
        .where(and(eq(deliverable.projectId, projectId), sql`${deliverable.milestoneId} IS NOT NULL`, sql`${deliverableVersion.status} <> 'withdrawn'`))
        .orderBy(asc(deliverable.createdAt), desc(deliverableVersion.version));

    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!latest.has(row.id)) latest.set(row.id, row);

    const byMilestone = new Map<string, LinkedDeliverable[]>();
    for (const row of latest.values()) {
        // A superseded newest version means its replacement was withdrawn: nothing current to show
        if (!row.milestoneId || row.status === 'superseded') continue;
        const list = byMilestone.get(row.milestoneId) ?? [];
        list.push({ id: row.id, title: row.title, status: row.status, version: row.version });
        byMilestone.set(row.milestoneId, list);
    }
    return byMilestone;
}

/* ---------- Attention and deadlines ---------- */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function scopedMilestones(context: FeatureContext) {
    return getDb()
        .select({
            id: milestone.id,
            title: milestone.title,
            status: milestone.status,
            dueDate: milestone.dueDate,
            requiresSignoff: milestone.requiresSignoff,
            updatedAt: milestone.updatedAt,
            projectId: project.id,
            projectName: project.name,
            clientName: user.name,
            clientEmail: user.email,
            signoffId: milestoneSignoff.id,
            signoffSource: milestoneSignoff.source,
            signedAt: milestoneSignoff.signedAt,
            // A linked deliverable still in review: its card asks for that review, and the
            // milestone waits for it before asking for anything itself
            reviewTitle: sql<string | null>`(
                SELECT ${deliverable.title} FROM ${deliverable}
                JOIN ${deliverableVersion} ON ${deliverableVersion.deliverableId} = ${deliverable.id}
                    AND ${deliverableVersion.version} = ${deliverable.latestVersion}
                WHERE ${deliverable.milestoneId} = ${milestone.id} AND ${deliverableVersion.status} = 'in_review'
                ORDER BY ${deliverable.createdAt}
                LIMIT 1
            )`,
        })
        .from(milestone)
        .innerJoin(project, eq(project.id, milestone.projectId))
        .innerJoin(user, eq(user.id, project.clientId))
        .leftJoin(milestoneSignoff, eq(milestoneSignoff.milestoneId, milestone.id))
        .where(projectScope(context))
        .orderBy(asc(project.name), asc(milestone.position));
}

type ScopedMilestone = Awaited<ReturnType<typeof scopedMilestones>>[number];

const anchorOf = (id: string) => `milestone-${id}`;

const initialsDue = (row: ScopedMilestone) =>
    asksForInitials({ requiresSignoff: row.requiresSignoff, signed: Boolean(row.signoffId), status: row.status, reviewPending: row.reviewTitle !== null });

// What a milestone that is waiting on the client is waiting for, in the studio's words
function waitingDetail(row: ScopedMilestone): string {
    const client = row.clientName || row.clientEmail;
    const first = firstName(row.clientName) ?? client;
    if (row.reviewTitle) return `Waiting on ${first} to review ${row.reviewTitle}`;
    if (initialsDue(row)) return `Waiting on ${first} to initial`;
    return `Waiting on ${client}`;
}

async function attention(context: FeatureContext): Promise<AttentionItem[]> {
    const rows = await scopedMilestones(context);
    const items: AttentionItem[] = [];
    const overdue = (due: string | null) => Boolean(due && daysBetween(context.today, due) < 0);

    if (context.perspective === 'client') {
        for (const row of rows) {
            // Only steps waiting on the client ask for anything, and a linked review asks first
            // (the deliverable card covers it, so one step never asks twice)
            if (row.status !== 'waiting_on_client' || row.reviewTitle) continue;
            const base = {
                projectId: row.projectId,
                projectName: row.projectName,
                tab: 'milestones' as const,
                anchor: anchorOf(row.id),
                due: row.dueDate,
                since: row.updatedAt.toISOString(),
                tone: overdue(row.dueDate) ? ('alert' as const) : ('action' as const),
            };
            if (initialsDue(row)) {
                items.push({ ...base, key: `milestone-signoff:${row.id}`, title: `Add your initials to sign off ${row.title}` });
            } else {
                items.push({ ...base, key: `milestone-waiting:${row.id}`, title: `${row.title} is waiting on you` });
            }
        }
        return items;
    }

    const recent = new Date(Date.now() - SEVEN_DAYS_MS);
    for (const row of rows) {
        const base = { projectId: row.projectId, projectName: row.projectName, tab: 'milestones' as const, anchor: anchorOf(row.id) };
        const client = row.clientName || row.clientEmail;
        if (row.status !== 'done' && overdue(row.dueDate)) {
            const waiting = row.status === 'waiting_on_client';
            items.push({
                ...base,
                key: `milestone-overdue:${row.id}`,
                title: `${row.title} is past its due date`,
                due: row.dueDate,
                tone: 'alert',
                // A step waiting on the client is a follow-up for the studio, not its own work
                ...(waiting ? { detail: waitingDetail(row), blockedOn: 'client' as const } : {}),
            });
        }
        if (row.signoffId && row.signoffSource === 'client' && row.signedAt && row.signedAt >= recent) {
            items.push({
                ...base,
                key: `milestone-signed:${row.signoffId}`,
                title: `${client} initialled ${row.title}`,
                since: row.signedAt.toISOString(),
                tone: 'info',
            });
        }
    }

    items.push(...(await failedEmails(context, rows, recent)));
    return items;
}

/*
 * Sign-off requests and receipts that never arrived, so the studio can follow up. A failure
 * clears once a later email of the same kind about the same milestone reaches the same
 * address (rows from before kinds carried the id match on kind and address alone), and a
 * request clears once the milestone is signed off or deleted.
 */
async function failedEmails(context: FeatureContext, milestones: ScopedMilestone[], since: Date): Promise<AttentionItem[]> {
    const emails = await getDb()
        .select({
            id: activity.id,
            kind: activity.kind,
            summary: activity.summary,
            emailTo: activity.emailTo,
            emailStatus: activity.emailStatus,
            createdAt: activity.createdAt,
            projectId: project.id,
            projectName: project.name,
            clientName: user.name,
            clientEmail: user.email,
        })
        .from(activity)
        .innerJoin(project, eq(project.id, activity.projectId))
        .innerJoin(user, eq(user.id, project.clientId))
        .where(
            and(
                projectScope(context),
                like(activity.kind, 'milestone%'),
                isNotNull(activity.emailTo),
                inArray(activity.emailStatus, ['sent', 'failed']),
                gte(activity.createdAt, since),
            ),
        )
        .orderBy(asc(activity.createdAt));

    const byId = new Map(milestones.map((row) => [row.id, row]));
    const items: AttentionItem[] = [];
    for (const [index, row] of emails.entries()) {
        if (row.emailStatus !== 'failed') continue;
        const { event, milestoneId } = parseKind(row.kind);
        const resolved = emails.slice(index + 1).some((later) => {
            if (later.emailStatus !== 'sent' || later.emailTo !== row.emailTo || later.projectId !== row.projectId) return false;
            const next = parseKind(later.kind);
            return next.event === event && (milestoneId === null || next.milestoneId === milestoneId);
        });
        if (resolved) continue;
        const target = milestoneId ? byId.get(milestoneId) : undefined;
        if (event === 'signoff_requested' && milestoneId && (!target || target.signoffId)) continue;
        const who = row.emailTo === row.clientEmail ? row.clientName || row.clientEmail : row.emailTo === STUDIO_EMAIL ? 'the studio' : row.emailTo;
        items.push({
            key: `milestone-email:${row.id}`,
            projectId: row.projectId,
            projectName: row.projectName,
            tab: 'milestones',
            ...(target ? { anchor: anchorOf(target.id) } : {}),
            title: target ? `The email to ${who} about ${target.title} could not be sent` : `The email to ${who} could not be sent`,
            detail: row.summary,
            since: row.createdAt.toISOString(),
            tone: 'alert',
        });
    }
    return items;
}

async function deadlines(context: FeatureContext): Promise<DeadlineItem[]> {
    const rows = await scopedMilestones(context);
    return rows
        .filter((row) => row.status !== 'done' && row.dueDate)
        .map((row) => ({
            key: `milestone:${row.id}`,
            projectId: row.projectId,
            projectName: row.projectName,
            tab: 'milestones' as const,
            anchor: anchorOf(row.id),
            title: row.title,
            date: row.dueDate as string,
            kind: 'milestone' as const,
            // The date is the client's only while the step waits on them for something the
            // milestone itself asks (initials, or what the studio set it waiting for). While a
            // linked review is open, that review's own date is theirs and this one stays ours.
            owner: row.status === 'waiting_on_client' && !row.reviewTitle ? ('client' as const) : ('studio' as const),
        }));
}

export const milestonesFeature: PortalFeature = { attention, deadlines };

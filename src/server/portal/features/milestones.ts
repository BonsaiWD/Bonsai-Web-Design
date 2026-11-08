import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '@/db';
import { deliverable, deliverableVersion, milestone, milestoneSignoff, project, rateLimit, user } from '@/db/schema';
import { asksForInitials } from '@/components/portal/milestones/signoff';
import type { LinkedDeliverable, MilestoneView, SignoffRecord } from '@/components/portal/milestones/types';
import { daysBetween, firstName } from '@/lib/portal-format';
import { type Tx } from '../access';
import { projectScope, type AttentionItem, type DeadlineItem, type FeatureContext, type Perspective, type PortalFeature } from '../attention';
import { STUDIO_NAME } from '../notify';
import { failedEmails, failedEmailTitle } from './failed-emails';
import { kindItemId, kindMaker, parseKind } from '../kinds';

/* ---------- Shared by the page, the provider and the actions ---------- */

// Changes on every save (to the microsecond), so an edit made from a stale form is refused
export const milestoneVersion = sql<string>`to_char(${milestone.updatedAt} at time zone 'UTC', 'YYYYMMDDHH24MISSUS')`;

export { signoffStatement } from '@/components/portal/milestones/statement';
export { asksForInitials };

/* ---------- Activity kinds ----------
   "milestone.<event>:<milestoneId>", like the other features' kinds, so a failed email can
   link to its milestone and clear once a later email of the same kind reaches the same
   person. Rows written before used "milestone_<event>" with no id; both match 'milestone%'. */

const KINDS = {
    added: 'milestone.added',
    status: 'milestone.status',
    due: 'milestone.due',
    deleted: 'milestone.deleted',
    signoff_requested: 'milestone.signoff_requested',
    signoff_recorded: 'milestone.signoff_recorded',
    signoff: 'milestone.signoff',
    signoff_receipt: 'milestone.signoff_receipt',
} as const;

export const milestoneKind = kindMaker(KINDS);

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

// One rate-limit slot per milestone (claimRateSlot): when the client was last emailed a
// sign-off request
export function signoffAskKey(milestoneId: string): string {
    return `portal:milestone-signoff-ask:${milestoneId}`;
}

export const SIGNOFF_ASK_INTERVAL_MS = 10 * 60 * 1000;

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
                // The client deals with the studio, so a sign-off the studio recorded names the studio
                signerName:
                    !studio && row.source === 'studio' ? STUDIO_NAME : row.signerName?.trim() || row.signerEmail || 'Unknown',
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

// For a query over milestones: the title of the first linked deliverable whose newest
// version is still in review, or null. Every screen that asks for initials reads this.
export function linkedReviewTitle() {
    return sql<string | null>`(
        SELECT ${deliverable.title} FROM ${deliverable}
        JOIN ${deliverableVersion} ON ${deliverableVersion.deliverableId} = ${deliverable.id}
            AND ${deliverableVersion.version} = ${deliverable.latestVersion}
        WHERE ${deliverable.milestoneId} = ${milestone.id} AND ${deliverableVersion.status} = 'in_review'
        ORDER BY ${deliverable.createdAt}
        LIMIT 1
    )`;
}

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
            reviewTitle: linkedReviewTitle(),
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

    items.push(...(await failedEmailItems(context, rows)));
    return items;
}

// Sign-off requests, copies and receipts that never arrived, flagged as every feature flags
// them (failed-emails.ts). A request no longer matters once the milestone is signed off or
// deleted; rows from before kinds carried the milestone's id match on their kind alone.
async function failedEmailItems(context: FeatureContext, milestones: ScopedMilestone[]): Promise<AttentionItem[]> {
    const emails = await failedEmails(context, { kinds: ['milestone'], subjectOf: kindItemId });
    const byId = new Map(milestones.map((row) => [row.id, row]));
    const items: AttentionItem[] = [];
    for (const row of emails) {
        const { event, id: milestoneId } = parseKind(row.kind);
        const target = milestoneId ? byId.get(milestoneId) : undefined;
        if (milestoneId && !target) continue;
        if (event === 'signoff_requested' && target?.signoffId) continue;
        items.push({
            key: `milestone-email:${row.id}`,
            projectId: row.projectId,
            projectName: row.projectName,
            tab: 'milestones',
            ...(target ? { anchor: anchorOf(target.id) } : {}),
            title: failedEmailTitle(row.who, target?.title),
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

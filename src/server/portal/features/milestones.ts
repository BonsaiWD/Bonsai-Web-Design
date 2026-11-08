import 'server-only';
import { and, asc, desc, eq, gte, inArray, like, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '@/db';
import { activity, deliverable, deliverableVersion, milestone, milestoneSignoff, project, rateLimit, user } from '@/db/schema';
import type { LinkedDeliverable, MilestoneView, SignoffRecord } from '@/components/portal/milestones/types';
import { daysBetween } from '@/lib/portal-format';
import { adminActor, projectActor } from '../access';
import { projectScope, type AttentionItem, type DeadlineItem, type FeatureContext, type Perspective, type PortalFeature } from '../attention';

/* ---------- Shared by the page, the provider and the actions ---------- */

// Changes on every save (to the microsecond), so an edit made from a stale form is refused
export const milestoneVersion = sql<string>`to_char(${milestone.updatedAt} at time zone 'UTC', 'YYYYMMDDHH24MISSUS')`;

export { signoffStatement } from '@/components/portal/milestones/statement';

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
            // The deliverable card asks for that review, so the milestone need not ask too
            reviewPending: sql<boolean>`EXISTS (
                SELECT 1 FROM ${deliverable}
                JOIN ${deliverableVersion} ON ${deliverableVersion.deliverableId} = ${deliverable.id}
                    AND ${deliverableVersion.version} = ${deliverable.latestVersion}
                WHERE ${deliverable.milestoneId} = ${milestone.id} AND ${deliverableVersion.status} = 'in_review'
            )`,
        })
        .from(milestone)
        .innerJoin(project, eq(project.id, milestone.projectId))
        .innerJoin(user, eq(user.id, project.clientId))
        .leftJoin(milestoneSignoff, eq(milestoneSignoff.milestoneId, milestone.id))
        .where(projectScope(context))
        .orderBy(asc(project.name), asc(milestone.position));
}

const anchorOf = (id: string) => `milestone-${id}`;

async function attention(context: FeatureContext): Promise<AttentionItem[]> {
    const rows = await scopedMilestones(context);
    const items: AttentionItem[] = [];
    const overdue = (due: string | null) => Boolean(due && daysBetween(context.today, due) < 0);

    if (context.perspective === 'client') {
        for (const row of rows) {
            const base = { projectId: row.projectId, projectName: row.projectName, tab: 'milestones' as const, anchor: anchorOf(row.id) };
            if (row.requiresSignoff && !row.signoffId) {
                items.push({
                    ...base,
                    key: `milestone-signoff:${row.id}`,
                    title: `Initial ${row.title} to sign it off`,
                    due: row.dueDate,
                    since: row.updatedAt.toISOString(),
                    tone: overdue(row.dueDate) ? 'alert' : 'action',
                });
            } else if (row.status === 'waiting_on_client' && !row.reviewPending) {
                items.push({
                    ...base,
                    key: `milestone-waiting:${row.id}`,
                    title: `${row.title} is waiting on you`,
                    due: row.dueDate,
                    since: row.updatedAt.toISOString(),
                    tone: overdue(row.dueDate) ? 'alert' : 'action',
                });
            }
        }
        return items;
    }

    const recent = new Date(Date.now() - SEVEN_DAYS_MS);
    for (const row of rows) {
        const base = { projectId: row.projectId, projectName: row.projectName, tab: 'milestones' as const, anchor: anchorOf(row.id) };
        const client = row.clientName || row.clientEmail;
        if (row.status !== 'done' && overdue(row.dueDate)) {
            items.push({
                ...base,
                key: `milestone-overdue:${row.id}`,
                title: `${row.title} is past its due date`,
                detail: row.status === 'waiting_on_client' ? `Waiting on ${client}` : undefined,
                due: row.dueDate,
                tone: 'alert',
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

    // A sign-off request or receipt that never arrived, so the studio can follow up
    const failed = await getDb()
        .select({
            id: activity.id,
            summary: activity.summary,
            emailTo: activity.emailTo,
            createdAt: activity.createdAt,
            projectId: project.id,
            projectName: project.name,
        })
        .from(activity)
        .innerJoin(project, eq(project.id, activity.projectId))
        .where(and(projectScope(context), like(activity.kind, 'milestone%'), eq(activity.emailStatus, 'failed'), gte(activity.createdAt, recent)))
        .orderBy(desc(activity.createdAt));
    for (const row of failed) {
        items.push({
            key: `milestone-email:${row.id}`,
            projectId: row.projectId,
            projectName: row.projectName,
            tab: 'milestones',
            title: `An email to ${row.emailTo ?? 'the client'} could not be sent`,
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
            // Waiting for the client's go-ahead or initials puts the date in their hands
            owner: row.status === 'waiting_on_client' || (row.requiresSignoff && !row.signoffId) ? ('client' as const) : ('studio' as const),
        }));
}

export const milestonesFeature: PortalFeature = { attention, deadlines };

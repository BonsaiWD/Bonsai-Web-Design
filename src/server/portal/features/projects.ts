import 'server-only';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { del } from '@vercel/blob';
import { and, asc, desc, eq, gte, inArray, like, ne, notInArray, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { activity, milestone, milestoneSignoff, project, user } from '@/db/schema';
import type { ProjectRecordCounts, ProjectSettingsData } from '@/components/portal/admin/types';
import type { NextMilestoneView, ProjectCardView } from '@/components/portal/dashboard/types';
import { adminActor, projectActor } from '../access';
import { projectScope, sortAttention, type AttentionItem, type DeadlineItem, type FeatureContext, type PortalFeature } from '../attention';
import { contractsFeature } from './contracts';
import { deliverablesFeature } from './deliverables';
import { filesFeature } from './files';
import { invoicesFeature } from './invoices';
import { milestonesFeature } from './milestones';

type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/* ---------- Shared by the pages and the actions ---------- */

// Changes on every save (to the microsecond), so an edit made from a stale form is refused
export const projectVersion = sql<string>`to_char(${project.updatedAt} at time zone 'UTC', 'YYYYMMDDHH24MISSUS')`;

// Studio actions on a project: the signed-in user must be an admin, and the project must exist
export async function studioProjectActor(projectId: unknown) {
    await adminActor();
    return projectActor(projectId);
}

// Activity kinds this feature writes. The dot keeps them apart from other features' kinds
// that happen to start with "project".
export const PROJECT_KINDS = {
    created: 'project.created',
    stage: 'project.stage',
    launch: 'project.launch',
    renamed: 'project.renamed',
    client: 'project.client_changed',
} as const;

/* ---------- What a project holds ---------- */

export async function countProjectRecords(db: Db | Tx, projectId: string): Promise<ProjectRecordCounts> {
    const result = await db.execute<Record<keyof ProjectRecordCounts, string>>(sql`
        SELECT
            (SELECT count(*) FROM milestone WHERE project_id = ${projectId}) AS "milestones",
            (SELECT count(*) FROM deliverable WHERE project_id = ${projectId}) AS "deliverables",
            (SELECT count(*) FROM deliverable_version v JOIN deliverable d ON d.id = v.deliverable_id
                WHERE d.project_id = ${projectId}) AS "versions",
            (SELECT count(*) FROM deliverable_version v JOIN deliverable d ON d.id = v.deliverable_id
                WHERE d.project_id = ${projectId} AND v.status IN ('approved', 'changes_requested')) AS "decidedVersions",
            (SELECT count(*) FROM milestone_signoff WHERE project_id = ${projectId}) AS "signoffs",
            (SELECT count(*) FROM contract WHERE project_id = ${projectId}) AS "contracts",
            (SELECT count(*) FROM contract_signature WHERE project_id = ${projectId}) AS "signatures",
            (SELECT count(*) FROM file WHERE project_id = ${projectId}) AS "files",
            (SELECT count(*) FROM message WHERE project_id = ${projectId}) AS "messages",
            (SELECT count(*) FROM invoice WHERE project_id = ${projectId} AND status = 'draft') AS "draftInvoices",
            (SELECT count(*) FROM invoice WHERE project_id = ${projectId} AND status <> 'draft') AS "issuedInvoices",
            (SELECT count(*) FROM activity WHERE project_id = ${projectId}) AS "activity"
    `);
    const row = result.rows[0];
    const read = (key: keyof ProjectRecordCounts) => Number(row?.[key] ?? 0);
    return {
        milestones: read('milestones'),
        deliverables: read('deliverables'),
        versions: read('versions'),
        decidedVersions: read('decidedVersions'),
        signoffs: read('signoffs'),
        contracts: read('contracts'),
        signatures: read('signatures'),
        files: read('files'),
        messages: read('messages'),
        draftInvoices: read('draftInvoices'),
        issuedInvoices: read('issuedInvoices'),
        activity: read('activity'),
    };
}

/*
 * Locks a project for a change of client or a delete. FOR UPDATE on the project row blocks
 * new rows that reference it (a sign-off, a signature), and FOR SHARE on its deliverables and
 * invoices waits out a decision or a payment already under way, so the record count read
 * afterwards is the one the change acts on.
 */
export async function lockProjectForRecords(tx: Tx, projectId: string) {
    const [row] = await tx
        .select({ id: project.id, name: project.name, clientId: project.clientId })
        .from(project)
        .where(eq(project.id, projectId))
        .for('update');
    if (!row) return null;
    await tx.execute(sql`SELECT id FROM deliverable WHERE project_id = ${projectId} FOR SHARE`);
    await tx.execute(sql`SELECT id FROM invoice WHERE project_id = ${projectId} FOR SHARE`);
    return row;
}

export async function loadProjectSettings(projectId: string): Promise<ProjectSettingsData | null> {
    const db = getDb();
    const [row] = await db
        .select({
            id: project.id,
            name: project.name,
            summary: project.summary,
            stage: project.stage,
            targetLaunch: project.targetLaunch,
            version: projectVersion,
            clientId: user.id,
            clientName: user.name,
            clientEmail: user.email,
            clientCompany: user.company,
        })
        .from(project)
        .innerJoin(user, eq(user.id, project.clientId))
        .where(eq(project.id, projectId));
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        summary: row.summary,
        stage: row.stage,
        targetLaunch: row.targetLaunch,
        version: row.version,
        client: { id: row.clientId, name: row.clientName.trim() || row.clientEmail, email: row.clientEmail, company: row.clientCompany },
        records: await countProjectRecords(db, row.id),
    };
}

// Uploaded bytes outlive their rows unless removed. Called after a delete has committed;
// a failure here leaves orphaned bytes, never a broken project, so it is logged and skipped.
export async function removeStoredFiles(projectId: string, storageKeys: string[]): Promise<void> {
    try {
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            if (storageKeys.length) await del(storageKeys);
        } else if (process.env.NODE_ENV !== 'production') {
            // The same folder storeUpload writes to when there is no Blob store
            await rm(path.join(process.cwd(), '.data', 'uploads', 'projects', projectId), { recursive: true, force: true });
        }
    } catch (error) {
        console.error('[portal files] Could not remove stored files for a deleted project', error);
    }
}

/* ---------- Dashboards ---------- */

async function nextMilestones(projectIds: string[]): Promise<Map<string, NextMilestoneView>> {
    if (projectIds.length === 0) return new Map();
    // The first step not yet done is where each project is now
    const rows = await getDb()
        .selectDistinctOn([milestone.projectId], {
            projectId: milestone.projectId,
            id: milestone.id,
            title: milestone.title,
            description: milestone.description,
            status: milestone.status,
            dueDate: milestone.dueDate,
            requiresSignoff: milestone.requiresSignoff,
            signoffId: milestoneSignoff.id,
        })
        .from(milestone)
        .leftJoin(milestoneSignoff, eq(milestoneSignoff.milestoneId, milestone.id))
        .where(and(inArray(milestone.projectId, projectIds), ne(milestone.status, 'done')))
        .orderBy(milestone.projectId, asc(milestone.position), asc(milestone.createdAt));
    return new Map(
        rows.map((row) => [
            row.projectId,
            {
                id: row.id,
                title: row.title,
                description: row.description,
                status: row.status,
                dueDate: row.dueDate,
                requiresSignoff: row.requiresSignoff,
                signed: Boolean(row.signoffId),
            },
        ]),
    );
}

export async function loadNextMilestone(projectId: string): Promise<{ next: NextMilestoneView | null; done: number; total: number }> {
    const [counts] = await getDb()
        .select({
            total: sql<number>`count(*)::int`,
            done: sql<number>`(count(*) FILTER (WHERE ${milestone.status} = 'done'))::int`,
        })
        .from(milestone)
        .where(eq(milestone.projectId, projectId));
    const next = (await nextMilestones([projectId])).get(projectId) ?? null;
    return { next, done: counts?.done ?? 0, total: counts?.total ?? 0 };
}

const STAGE_ORDER = { discovery: 0, design: 1, development: 2, review: 3, on_hold: 4, launched: 5 } as const;

/**
 * Every project the context may see, with what the dashboards say about it. The attention
 * and deadline lists come from collectAttention/collectDeadlines, so the counts on a card
 * always match the lists beside it.
 */
export async function loadProjectCards(
    context: FeatureContext,
    lists: { attention: AttentionItem[]; deadlines: DeadlineItem[]; waitingOnClients?: AttentionItem[] },
): Promise<ProjectCardView[]> {
    const rows = await getDb()
        .select({
            id: project.id,
            name: project.name,
            stage: project.stage,
            targetLaunch: project.targetLaunch,
            clientId: user.id,
            clientName: user.name,
            clientEmail: user.email,
            clientCompany: user.company,
            total: sql<number>`count(${milestone.id})::int`,
            done: sql<number>`(count(${milestone.id}) FILTER (WHERE ${milestone.status} = 'done'))::int`,
        })
        .from(project)
        .innerJoin(user, eq(user.id, project.clientId))
        .leftJoin(milestone, eq(milestone.projectId, project.id))
        .where(projectScope(context))
        .groupBy(project.id, user.id);

    const next = await nextMilestones(rows.map((row) => row.id));
    const cards = rows.map((row): ProjectCardView => {
        const items = lists.attention.filter((item) => item.projectId === row.id && item.tone !== 'info');
        return {
            id: row.id,
            name: row.name,
            stage: row.stage,
            targetLaunch: row.targetLaunch,
            client: { id: row.clientId, name: row.clientName.trim() || row.clientEmail, company: row.clientCompany, email: row.clientEmail },
            milestones: { done: row.done, total: row.total },
            nextMilestone: next.get(row.id) ?? null,
            needs: items.length,
            alerts: items.filter((item) => item.tone === 'alert').length,
            waitingOnClient: (lists.waitingOnClients ?? []).filter((item) => item.projectId === row.id).length,
            // Deadlines arrive sorted, soonest (and so overdue) first
            nextDeadline: lists.deadlines.find((item) => item.projectId === row.id) ?? null,
        };
    });

    // Live work first, by what is due soonest; finished and paused projects after
    return cards.sort((a, b) => {
        const live = (card: ProjectCardView) => (card.stage === 'launched' || card.stage === 'on_hold' ? 1 : 0);
        if (live(a) !== live(b)) return live(a) - live(b);
        const dueA = a.nextDeadline?.date ?? '9999-12-31';
        const dueB = b.nextDeadline?.date ?? '9999-12-31';
        if (dueA !== dueB) return dueA < dueB ? -1 : 1;
        if (STAGE_ORDER[a.stage] !== STAGE_ORDER[b.stage]) return STAGE_ORDER[b.stage] - STAGE_ORDER[a.stage];
        return a.name.localeCompare(b.name);
    });
}

/*
 * What is waiting on clients, as each client sees it: the client-perspective items of every
 * provider, asked with the studio's scope. Messages are left out: unread counts belong to
 * whoever is reading, so through the studio's eyes they would describe the studio's inbox.
 * This repeats collect.ts's provider list, which has no way to ask for another perspective.
 */
const CLIENT_FACING: PortalFeature[] = [milestonesFeature, deliverablesFeature, contractsFeature, invoicesFeature, filesFeature];

export async function collectWaitingOnClients(context: FeatureContext): Promise<AttentionItem[]> {
    if (!context.viewer.isAdmin) return [];
    const asClient: FeatureContext = { ...context, perspective: 'client' };
    const lists = await Promise.all(CLIENT_FACING.map((feature) => feature.attention?.(asClient) ?? Promise.resolve([])));
    return sortAttention(lists.flat().filter((item) => item.tone !== 'info'));
}

/* ---------- Attention and deadlines ---------- */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const projectsFeature: PortalFeature = {
    // A project email (the "New project" note) that never arrived, so the studio can follow up
    async attention(context) {
        if (context.perspective !== 'studio') return [];
        const rows = await getDb()
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
            .where(
                and(
                    projectScope(context),
                    like(activity.kind, 'project.%'),
                    eq(activity.emailStatus, 'failed'),
                    gte(activity.createdAt, new Date(Date.now() - SEVEN_DAYS_MS)),
                ),
            )
            .orderBy(desc(activity.createdAt));
        return rows.map((row) => ({
            key: `project-email:${row.id}`,
            projectId: row.projectId,
            projectName: row.projectName,
            tab: 'overview' as const,
            title: `An email to ${row.emailTo ?? 'the client'} could not be sent`,
            detail: row.summary,
            since: row.createdAt.toISOString(),
            tone: 'alert' as const,
        }));
    },

    // Target launches of projects still under way; a launched or paused project has none
    async deadlines(context) {
        const rows = await getDb()
            .select({ id: project.id, name: project.name, targetLaunch: project.targetLaunch })
            .from(project)
            .where(and(projectScope(context), notInArray(project.stage, ['launched', 'on_hold']), sql`${project.targetLaunch} IS NOT NULL`));
        return rows.map((row) => ({
            key: `project-launch:${row.id}`,
            projectId: row.id,
            projectName: row.name,
            tab: 'overview' as const,
            title: 'Target launch',
            date: row.targetLaunch as string,
            kind: 'launch' as const,
            owner: 'studio' as const,
        }));
    },
};

import 'server-only';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { del } from '@vercel/blob';
import { and, asc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { milestone, milestoneSignoff, project, user } from '@/db/schema';
import type { ProjectRecordCounts, ProjectSettingsData } from '@/components/portal/admin/types';
import type { NextMilestoneView, ProjectCardView } from '@/components/portal/dashboard/types';
import { type Db, type Tx } from '../access';
import { projectScope, sortAttention, type AttentionItem, type DeadlineItem, type FeatureContext, type PortalFeature } from '../attention';
import { contractsFeature } from './contracts';
import { deliverablesFeature } from './deliverables';
import { failedEmails, failedEmailTitle } from './failed-emails';
import { filesFeature } from './files';
import { invoicesFeature } from './invoices';
import { linkedReviewTitle, milestonesFeature } from './milestones';
import { FLAGGED_EMAIL_KINDS } from '../kinds';

/* ---------- Shared by the pages and the actions ---------- */

// Changes on every save (to the microsecond), so an edit made from a stale form is refused
export const projectVersion = sql<string>`to_char(${project.updatedAt} at time zone 'UTC', 'YYYYMMDDHH24MISSUS')`;

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
            -- A copy signed outside the portal is a signature too; one the studio sent back
            -- (its file removed) is not, as on the Contracts tab
            (SELECT count(*) FROM contract_file cf JOIN contract c ON c.id = cf.contract_id JOIN file f ON f.id = cf.file_id
                WHERE c.project_id = ${projectId} AND cf.label IN ('client_signed', 'countersigned') AND f.removed_at IS NULL) AS "signedCopies",
            -- What the Files tab lists; contract and deliverable files belong to their records
            (SELECT count(*) FROM file WHERE project_id = ${projectId} AND purpose = 'project_file' AND removed_at IS NULL) AS "sharedFiles",
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
        signedCopies: read('signedCopies'),
        sharedFiles: read('sharedFiles'),
        messages: read('messages'),
        draftInvoices: read('draftInvoices'),
        issuedInvoices: read('issuedInvoices'),
        activity: read('activity'),
    };
}

/*
 * Locks a project for a change of client or a delete. FOR UPDATE on the project row blocks
 * new rows that reference it (a sign-off, a signature), and FOR SHARE on its deliverables,
 * invoices and contracts waits out a decision, a payment or a signed copy already under way,
 * so the record count read afterwards is the one the change acts on.
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
    await tx.execute(sql`SELECT id FROM contract WHERE project_id = ${projectId} FOR SHARE`);
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
            reviewTitle: linkedReviewTitle(),
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
                reviewPending: row.reviewTitle !== null,
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
            client: {
                id: row.clientId,
                name: row.clientName.trim() || row.clientEmail,
                company: row.clientCompany,
                email: row.clientEmail,
            },
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

// A studio follow-up ("Waiting on Jane to pay BWD-0002") about the same item as one on the
// client's list ("Pay invoice BWD-0002") says one thing twice: the client's list keeps it
export function withoutListedFollowUps(attention: AttentionItem[], waiting: AttentionItem[]): AttentionItem[] {
    const where = (item: AttentionItem) => (item.anchor ? `${item.projectId}/${item.tab}#${item.anchor}` : null);
    const listed = new Set(waiting.map(where).filter(Boolean));
    return attention.filter((item) => item.blockedOn !== 'client' || !listed.has(where(item)));
}

export async function collectWaitingOnClients(context: FeatureContext): Promise<AttentionItem[]> {
    if (!context.viewer.isAdmin) return [];
    const asClient: FeatureContext = { ...context, perspective: 'client' };
    const lists = await Promise.all(CLIENT_FACING.map((feature) => feature.attention?.(asClient) ?? Promise.resolve([])));
    return sortAttention(lists.flat().filter((item) => item.tone !== 'info'));
}

/* ---------- Attention and deadlines ---------- */

export const projectsFeature: PortalFeature = {
    // A project email (the "New project" note) that never arrived, flagged as every feature
    // flags them (failed-emails.ts). It said the project is in the portal, so any later email
    // that reaches the same person on that project makes up for it.
    async attention(context) {
        if (context.perspective !== 'studio') return [];
        const emails = await failedEmails(context, { kinds: FLAGGED_EMAIL_KINDS.project, clearedBy: [''], subjectOf: () => 'project' });
        return emails.map((row) => ({
            key: `project-email:${row.id}`,
            projectId: row.projectId,
            projectName: row.projectName,
            tab: 'overview' as const,
            title: failedEmailTitle(row.who, row.projectName),
            detail: row.summary,
            since: row.createdAt.toISOString(),
            tone: 'alert' as const,
        }));
    },

    // Target launches of projects still under way; a launched or paused project has none. A
    // launch milestone still to do on the same day ("Launch", "Site launch", "Go live") is the
    // same date already listed, so the target launch is left out rather than shown twice.
    // Any other milestone due that day is a different thing, and both rows stay.
    async deadlines(context) {
        // "Launch", "Site launch", "Launch day", "Go live", but not "Pre-launch review"
        // (a Postgres regular expression, matched case-insensitively)
        const launchTitle = '(^|\\s)(launch|go[ -]?live)(\\s|$)';
        const rows = await getDb()
            .select({ id: project.id, name: project.name, targetLaunch: project.targetLaunch })
            .from(project)
            .where(
                and(
                    projectScope(context),
                    notInArray(project.stage, ['launched', 'on_hold']),
                    sql`${project.targetLaunch} IS NOT NULL`,
                    sql`NOT EXISTS (SELECT 1 FROM milestone m WHERE m.project_id = ${project.id} AND m.status <> 'done' AND m.due_date = ${project.targetLaunch} AND m.title ~* ${launchTitle})`,
                ),
            );
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

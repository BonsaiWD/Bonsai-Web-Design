import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { activity, project, user } from '@/db/schema';
import type { ActivityView } from '@/components/portal/dashboard/types';
import { PROJECT_TABS, projectHref, type ProjectTab } from '@/components/portal/tabs';
import { projectScope, type FeatureContext } from '../attention';

/*
 * The activity feeds: a project's timeline on its overview, and the studio's feed across
 * every project. Rows marked visibility 'studio' and the email columns are the studio's
 * business, so the client's query neither selects nor returns them.
 */

const TABS = new Set<string>(PROJECT_TABS.map((tab) => tab.key));

// Features write a tab name ("deliverables"), optionally with an anchor ("deliverables#deliverable-<id>")
function targetHref(projectId: string, target: string | null): string | null {
    if (!target) return null;
    const [tab, anchor] = target.split('#', 2);
    if (!TABS.has(tab)) return null;
    return projectHref(projectId, tab as ProjectTab, anchor && /^[\w-]+$/.test(anchor) ? anchor : undefined);
}

export async function loadActivity(context: FeatureContext, options: { limit: number }): Promise<ActivityView[]> {
    const studio = context.perspective === 'studio';
    const base = {
        id: activity.id,
        projectId: project.id,
        projectName: project.name,
        summary: activity.summary,
        target: activity.target,
        createdAt: activity.createdAt,
        actorId: activity.actorId,
        actorName: user.name,
        actorEmail: user.email,
    };

    const rows = await getDb()
        .select(studio ? { ...base, visibility: activity.visibility, emailTo: activity.emailTo, emailStatus: activity.emailStatus } : base)
        .from(activity)
        .innerJoin(project, eq(project.id, activity.projectId))
        .leftJoin(user, eq(user.id, activity.actorId))
        .where(and(projectScope(context), studio ? undefined : eq(activity.visibility, 'everyone')))
        // The id breaks ties between rows written in the same transaction
        .orderBy(desc(activity.createdAt), desc(activity.id))
        .limit(options.limit);

    return rows.map((row) => {
        const view: ActivityView = {
            id: row.id,
            projectId: row.projectId,
            projectName: row.projectName,
            summary: row.summary,
            href: targetHref(row.projectId, row.target),
            actorName: row.actorName || row.actorEmail || null,
            actorIsViewer: row.actorId === context.viewer.user.id,
            at: row.createdAt.toISOString(),
        };
        if (studio && 'visibility' in row) {
            view.studioOnly = row.visibility === 'studio';
            view.email =
                row.emailTo && (row.emailStatus === 'failed' || row.emailStatus === 'skipped')
                    ? { to: row.emailTo, status: row.emailStatus }
                    : null;
        }
        return view;
    });
}

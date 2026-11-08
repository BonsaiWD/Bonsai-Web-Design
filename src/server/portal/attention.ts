import 'server-only';
import { and, eq, type SQL } from 'drizzle-orm';
import { project } from '@/db/schema';
import type { ProjectTab } from '@/components/portal/tabs';
import type { Viewer } from './access';

/*
 * Each feature reports what needs someone and what is due. The dashboards, the project
 * overview and the tab badges all read from here, so a feature only has to describe its
 * own items once.
 */

export type Perspective = 'client' | 'studio';

export interface FeatureContext {
    viewer: Viewer;
    // Whose eyes: an admin previewing as a client sees the client's perspective
    perspective: Perspective;
    // Limit to one project (the project pages) or all visible projects (dashboards)
    projectId?: string;
    // Today's calendar day (UTC, YYYY-MM-DD), so "overdue" means the same everywhere
    today: string;
}

export interface AttentionItem {
    // Stable and unique across features, e.g. "deliverable-version:<id>"
    key: string;
    projectId: string;
    projectName: string;
    tab: ProjectTab;
    // Element id on the tab to jump to, e.g. "deliverable-<id>"
    anchor?: string;
    // What needs doing, as a short sentence: "Review Homepage design (version 2)"
    title: string;
    detail?: string;
    // Calendar day it is due, if any
    due?: string | null;
    // When it started waiting (ISO timestamp), for "waiting 5 days" and ordering
    since?: string | null;
    tone: 'action' | 'alert' | 'info';
}

export interface DeadlineItem {
    key: string;
    projectId: string;
    projectName: string;
    tab: ProjectTab;
    anchor?: string;
    title: string;
    date: string;
    kind: 'milestone' | 'review' | 'invoice' | 'launch' | 'contract';
    // Who the deadline is for, so each side can see its own first
    owner: Perspective;
}

export interface PortalFeature {
    attention?(context: FeatureContext): Promise<AttentionItem[]>;
    deadlines?(context: FeatureContext): Promise<DeadlineItem[]>;
}

// The SQL condition limiting `project` rows to what this context may see
export function projectScope(context: FeatureContext): SQL | undefined {
    const conditions: (SQL | undefined)[] = [];
    if (!context.viewer.isAdmin) conditions.push(eq(project.clientId, context.viewer.user.id));
    if (context.projectId) conditions.push(eq(project.id, context.projectId));
    return conditions.length ? and(...conditions) : undefined;
}

export function perspectiveOf(viewer: Viewer): Perspective {
    return viewer.showStudio ? 'studio' : 'client';
}

const TONE_ORDER = { alert: 0, action: 1, info: 2 } as const;

export function sortAttention(items: AttentionItem[]): AttentionItem[] {
    return [...items].sort((a, b) => {
        if (TONE_ORDER[a.tone] !== TONE_ORDER[b.tone]) return TONE_ORDER[a.tone] - TONE_ORDER[b.tone];
        // Earliest due first, undated after dated, then longest waiting
        if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
        if (a.due && !b.due) return -1;
        if (!a.due && b.due) return 1;
        return (a.since ?? '') < (b.since ?? '') ? -1 : 1;
    });
}

export function sortDeadlines(items: DeadlineItem[]): DeadlineItem[] {
    return [...items].sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1));
}

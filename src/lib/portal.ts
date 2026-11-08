import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { milestone, project, user } from '@/db/schema';
import { getAuth } from '@/lib/auth';

// One session lookup per request, shared by the portal layout and its page
export const getPortalSession = cache(async () => {
    // Read the headers before touching auth: it marks the page as per-request, so the
    // build never tries to prerender it (and never needs the database to exist)
    const requestHeaders = await headers();
    return getAuth().api.getSession({ headers: requestHeaders });
});

export type PortalUser = NonNullable<Awaited<ReturnType<typeof getPortalSession>>>['user'];

export async function requirePortalUser(): Promise<PortalUser> {
    const session = await getPortalSession();
    if (!session) redirect('/portal/sign-in');
    return session.user;
}

export function isAdmin(portalUser: PortalUser) {
    return portalUser.role === 'admin';
}

// Admins see every project; a client only ever sees their own
function visibleTo(portalUser: PortalUser) {
    return isAdmin(portalUser) ? undefined : eq(project.clientId, portalUser.id);
}

export async function listProjects(portalUser: PortalUser) {
    return getDb()
        .select({
            id: project.id,
            name: project.name,
            stage: project.stage,
            targetLaunch: project.targetLaunch,
            clientEmail: user.email,
        })
        .from(project)
        .innerJoin(user, eq(user.id, project.clientId))
        .where(visibleTo(portalUser))
        .orderBy(desc(project.createdAt));
}

export type ProjectSummary = Awaited<ReturnType<typeof listProjects>>[number];

const projectIdSchema = z.uuid();

export async function getProject(portalUser: PortalUser, projectId: string) {
    // Anything that is not a UUID would make Postgres throw instead of finding nothing
    if (!projectIdSchema.safeParse(projectId).success) return null;

    const db = getDb();
    const [row] = await db
        .select({
            id: project.id,
            name: project.name,
            summary: project.summary,
            stage: project.stage,
            targetLaunch: project.targetLaunch,
        })
        .from(project)
        .where(and(eq(project.id, projectId), visibleTo(portalUser)))
        .limit(1);
    if (!row) return null;

    const milestones = await db
        .select({
            id: milestone.id,
            title: milestone.title,
            description: milestone.description,
            status: milestone.status,
            dueDate: milestone.dueDate,
        })
        .from(milestone)
        .where(eq(milestone.projectId, row.id))
        .orderBy(asc(milestone.position), asc(milestone.createdAt));

    return { ...row, milestones };
}

export type ProjectView = NonNullable<Awaited<ReturnType<typeof getProject>>>;

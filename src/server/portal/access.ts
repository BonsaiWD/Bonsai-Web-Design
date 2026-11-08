import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { project, user } from '@/db/schema';
import { getAuth } from '@/lib/auth';
import { ActionError } from './actions';

// One session lookup per request, shared by layouts, pages and actions
export const getPortalSession = cache(async () => {
    // Read the headers before touching auth: it marks the page as per-request, so the
    // build never tries to prerender it (and never needs the database to exist)
    const requestHeaders = await headers();
    return getAuth().api.getSession({ headers: requestHeaders });
});

export type PortalUser = NonNullable<Awaited<ReturnType<typeof getPortalSession>>>['user'];

export function isAdmin(portalUser: Pick<PortalUser, 'role'>) {
    return portalUser.role === 'admin';
}

/* ---------- Pages ---------- */

// Only paths inside the portal, so a crafted link cannot bounce anyone elsewhere after sign-in
export function safePortalPath(value: unknown): string | null {
    if (typeof value !== 'string' || !value.startsWith('/portal') || value.startsWith('//') || value.includes('\\')) return null;
    if (value.startsWith('/portal/sign-in') || value.startsWith('/portal/verify')) return null;
    return value;
}

export async function requirePortalUser(): Promise<PortalUser> {
    const session = await getPortalSession();
    if (!session) {
        const next = safePortalPath((await headers()).get('x-portal-path'));
        redirect(next && next !== '/portal' ? `/portal/sign-in?next=${encodeURIComponent(next)}` : '/portal/sign-in');
    }
    return session.user;
}

export async function requireAdminPage(): Promise<PortalUser> {
    const portalUser = await requirePortalUser();
    // A client sees the same page as a missing one
    if (!isAdmin(portalUser)) notFound();
    return portalUser;
}

// Admins can look at the portal the way their client does. The cookie only changes what is
// rendered: every action still checks the real role.
export const VIEW_COOKIE = 'portal_view';

export interface Viewer {
    user: PortalUser;
    isAdmin: boolean;
    // Studio controls and studio-only content are rendered
    showStudio: boolean;
    previewingAsClient: boolean;
}

export const getViewer = cache(async (): Promise<Viewer> => {
    const portalUser = await requirePortalUser();
    const admin = isAdmin(portalUser);
    const previewingAsClient = admin && (await cookies()).get(VIEW_COOKIE)?.value === 'client';
    return { user: portalUser, isAdmin: admin, showStudio: admin && !previewingAsClient, previewingAsClient };
});

const uuidSchema = z.uuid();

export function isUuid(value: unknown): value is string {
    return uuidSchema.safeParse(value).success;
}

async function loadProject(projectId: string, portalUser: PortalUser) {
    // Anything that is not a UUID would make Postgres throw instead of finding nothing
    if (!isUuid(projectId)) return null;
    const [row] = await getDb()
        .select({
            id: project.id,
            name: project.name,
            summary: project.summary,
            stage: project.stage,
            targetLaunch: project.targetLaunch,
            clientId: project.clientId,
            clientName: user.name,
            clientEmail: user.email,
            clientCompany: user.company,
            createdAt: project.createdAt,
        })
        .from(project)
        .innerJoin(user, eq(user.id, project.clientId))
        // Admins see every project; a client only ever sees their own
        .where(and(eq(project.id, projectId), isAdmin(portalUser) ? undefined : eq(project.clientId, portalUser.id)))
        .limit(1);
    return row ?? null;
}

export type PortalProject = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

// The project if this viewer may see it; another client's project looks like a missing one
export const getProjectForViewer = cache(async (projectId: string) => {
    const viewer = await getViewer();
    return loadProject(projectId, viewer.user);
});

export async function requireProject(projectId: string): Promise<PortalProject> {
    const found = await getProjectForViewer(projectId);
    if (!found) notFound();
    return found;
}

/* ---------- Actions ----------
   Server actions can be called directly with any arguments, so each one starts with one of
   these. They throw ActionError, which runAction turns into a message for the form. */

export async function actionUser(): Promise<PortalUser> {
    const session = await getPortalSession();
    if (!session) throw new ActionError('Your session has ended. Sign in again to continue.');
    return session.user;
}

export async function adminActor(): Promise<PortalUser> {
    const portalUser = await actionUser();
    if (!isAdmin(portalUser)) throw new ActionError('Only the studio can do that.');
    return portalUser;
}

export interface ProjectActor {
    user: PortalUser;
    project: PortalProject;
    isAdmin: boolean;
    // The signed-in user is the project's client
    isClient: boolean;
}

export async function projectActor(projectId: unknown, options: { clientOnly?: boolean } = {}): Promise<ProjectActor> {
    const portalUser = await actionUser();
    const found = typeof projectId === 'string' ? await loadProject(projectId, portalUser) : null;
    if (!found) throw new ActionError('That project could not be found.');
    const isClient = found.clientId === portalUser.id;
    // Decisions are the client's to make; the studio records ones made elsewhere separately
    if (options.clientOnly && !isClient) throw new ActionError('Only the client can do that.');
    return { user: portalUser, project: found, isAdmin: isAdmin(portalUser), isClient };
}

import type { Metadata } from 'next';
import { getPortalSession, getProjectForViewer, isAdmin } from './access';

// "Milestones · Demo website | Bonsai Web Design client portal": the project name keeps two
// open projects apart in tabs, history and bookmarks. The project lookup is cached per request.
// A page that renders the not-found screen is titled so, not after the tab it would have been.
export function projectTabMetadata(tab: string, { studioOnly = false } = {}) {
    return async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }): Promise<Metadata> {
        const { projectId } = await params;
        // No project (or another client's), or a studio-only tab opened by a client
        const [project, session] = await Promise.all([getProjectForViewer(projectId), studioOnly ? getPortalSession() : null]);
        if (!project || (studioOnly && !(session && isAdmin(session.user)))) return { title: 'Page not found' };
        return { title: `${tab} · ${project.name}` };
    };
}

// A studio-only page shows a client the not-found screen, so its title must not name the page
export function adminPageMetadata(title: string) {
    return async function generateMetadata(): Promise<Metadata> {
        const session = await getPortalSession();
        return { title: session && !isAdmin(session.user) ? 'Page not found' : title };
    };
}

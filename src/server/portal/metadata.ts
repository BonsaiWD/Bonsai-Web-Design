import type { Metadata } from 'next';
import { getProjectForViewer } from './access';

// "Milestones · Demo website | Bonsai Web Design client portal": the project name keeps two
// open projects apart in tabs, history and bookmarks. The project lookup is cached per request.
export function projectTabMetadata(tab: string) {
    return async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }): Promise<Metadata> {
        const { projectId } = await params;
        const project = await getProjectForViewer(projectId);
        return { title: project ? `${tab} · ${project.name}` : tab };
    };
}

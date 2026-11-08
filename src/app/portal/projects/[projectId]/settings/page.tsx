import { notFound } from 'next/navigation';
import ProjectSettingsView from '@/components/portal/admin/ProjectSettingsView';
import { Notice } from '@/components/portal/ui';
import { getViewer, requireProject } from '@/server/portal/access';
import { loadClientOptions } from '@/server/portal/features/clients';
import { loadProjectSettings } from '@/server/portal/features/projects';
import { projectTabMetadata } from '@/server/portal/metadata';

export const generateMetadata = projectTabMetadata('Project settings');

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireProject(projectId);
  const viewer = await getViewer();
  // Clients have no settings tab: to them it is a page that does not exist
  if (!viewer.isAdmin) notFound();
  if (viewer.previewingAsClient) {
    return (
      <Notice>
        <p>
          Project settings belong to the studio view, so your client never sees this page. Switch back to the studio view to change them.
        </p>
      </Notice>
    );
  }

  const [settings, clients] = await Promise.all([loadProjectSettings(project.id), loadClientOptions()]);
  if (!settings) notFound();
  return <ProjectSettingsView settings={settings} clients={clients} />;
}

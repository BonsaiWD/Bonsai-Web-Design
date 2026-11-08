import { notFound } from 'next/navigation';
import ProjectSettingsView from '@/components/portal/admin/ProjectSettingsView';
import StudioOnlyNotice from '@/components/portal/admin/StudioOnlyNotice';
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
  // The same notice as the other studio-only pages, with the way back; the project frame
  // above already names the project
  if (viewer.previewingAsClient) return <StudioOnlyNotice />;

  const [settings, clients] = await Promise.all([loadProjectSettings(project.id), loadClientOptions()]);
  if (!settings) notFound();
  return <ProjectSettingsView settings={settings} clients={clients} />;
}

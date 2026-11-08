import FilesView from '@/components/portal/files/FilesView';
import { getViewer, requireProject } from '@/server/portal/access';
import { featureContext } from '@/server/portal/collect';
import { loadProjectFiles } from '@/server/portal/features/files';
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES } from '@/server/portal/storage';
import { projectTabMetadata } from '@/server/portal/metadata';

export const generateMetadata = projectTabMetadata('Files');

export default async function FilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  // Another client's project looks exactly like one that does not exist
  const project = await requireProject(projectId);
  const [viewer, context] = await Promise.all([getViewer(), featureContext(project.id)]);
  // The client's copy never includes removed files
  const files = await loadProjectFiles(project.id, context.perspective, viewer.user.id);
  const studio = context.perspective === 'studio';

  return (
    <FilesView
      projectId={project.id}
      perspective={context.perspective}
      canUpload={studio || viewer.user.id === project.clientId}
      clientName={project.clientName || project.clientEmail}
      files={files}
      acceptedExtensions={ACCEPTED_EXTENSIONS}
      maxUploadBytes={MAX_UPLOAD_BYTES}
    />
  );
}

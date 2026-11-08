import type { Metadata } from 'next';
import MessagesView from '@/components/portal/messages/MessagesView';
import { getViewer, requireProject } from '@/server/portal/access';
import { featureContext } from '@/server/portal/collect';
import { loadStudioThreadInfo, loadThread, MESSAGE_MAX_LENGTH } from '@/server/portal/features/messages';
import { MAX_UPLOAD_BYTES } from '@/server/portal/storage';

export const metadata: Metadata = { title: 'Messages' };

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  // Another client's project looks exactly like one that does not exist
  const project = await requireProject(projectId);
  const [viewer, context] = await Promise.all([getViewer(), featureContext(project.id)]);
  const studio = context.perspective === 'studio';
  // While the studio previews, "new" is what is new for the client
  const readerId = studio ? viewer.user.id : project.clientId;

  // The client's thread is filtered in the query: internal notes never leave the database
  const [thread, studioInfo] = await Promise.all([
    loadThread({ projectId: project.id, perspective: context.perspective, readerId, all: query.all === '1' }),
    studio ? loadStudioThreadInfo(project) : Promise.resolve(null),
  ]);

  return (
    <MessagesView
      projectId={project.id}
      perspective={context.perspective}
      viewerId={viewer.user.id}
      clientName={project.clientName || project.clientEmail}
      clientEmail={project.clientEmail}
      clientCompany={project.clientCompany}
      now={new Date().toISOString()}
      thread={thread}
      canWrite={studio || viewer.user.id === project.clientId}
      canMarkRead={readerId === viewer.user.id}
      studio={studioInfo}
      maxLength={MESSAGE_MAX_LENGTH}
      maxUploadMb={Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}
    />
  );
}

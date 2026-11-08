import type { Metadata } from 'next';
import ContractsView from '@/components/portal/contracts/ContractsView';
import { getViewer, requireProject } from '@/server/portal/access';
import { featureContext } from '@/server/portal/collect';
import { loadContracts } from '@/server/portal/features/contracts';
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES } from '@/server/portal/storage';

export const metadata: Metadata = { title: 'Contracts' };

export default async function ContractsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  // Another client's project looks exactly like one that does not exist
  const project = await requireProject(projectId);
  const [viewer, context] = await Promise.all([getViewer(), featureContext(project.id)]);
  // The client's copy is filtered in the query: no uploader names, signer emails or email history
  const contracts = await loadContracts(project, context.perspective);

  return (
    <ContractsView
      projectId={project.id}
      perspective={context.perspective}
      canSign={viewer.user.id === project.clientId}
      clientName={project.clientName || project.clientEmail}
      contracts={contracts}
      limits={{ acceptedExtensions: ACCEPTED_EXTENSIONS, maxUploadBytes: MAX_UPLOAD_BYTES }}
    />
  );
}

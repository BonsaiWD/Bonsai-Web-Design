import type { Metadata } from 'next';
import DeliverablesView from '@/components/portal/deliverables/DeliverablesView';
import { getViewer, requireProject } from '@/server/portal/access';
import { featureContext } from '@/server/portal/collect';
import { loadDeliverables, loadMilestoneOptions } from '@/server/portal/features/deliverables';
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES } from '@/server/portal/storage';

export const metadata: Metadata = { title: 'Deliverables' };

export default async function DeliverablesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireProject(projectId);
  const [viewer, context] = await Promise.all([getViewer(), featureContext(project.id)]);
  const studio = context.perspective === 'studio';

  // The client's copy is filtered in the queries: no withdrawn versions, no studio records
  const [deliverables, milestones] = await Promise.all([
    loadDeliverables(project, context.perspective),
    studio ? loadMilestoneOptions(project.id) : Promise.resolve([]),
  ]);

  return (
    <DeliverablesView
      projectId={project.id}
      perspective={context.perspective}
      canDecide={viewer.user.id === project.clientId}
      clientName={project.clientName || project.clientEmail}
      today={context.today}
      deliverables={deliverables}
      milestones={milestones}
      acceptedExtensions={studio ? ACCEPTED_EXTENSIONS : ''}
      maxUploadMb={Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}
    />
  );
}

import type { Metadata } from 'next';
import MilestonesView from '@/components/portal/milestones/MilestonesView';
import { getViewer, requireProject } from '@/server/portal/access';
import { featureContext } from '@/server/portal/collect';
import { loadMilestones } from '@/server/portal/features/milestones';

export const metadata: Metadata = { title: 'Milestones' };

export default async function MilestonesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  // Another client's project looks exactly like one that does not exist
  const project = await requireProject(projectId);
  const [viewer, context] = await Promise.all([getViewer(), featureContext(project.id)]);
  const milestones = await loadMilestones(project.id, context.perspective);

  return (
    <MilestonesView
      projectId={project.id}
      projectName={project.name}
      clientName={project.clientName || project.clientEmail}
      today={context.today}
      milestones={milestones}
      showStudio={viewer.showStudio}
      previewingAsClient={viewer.previewingAsClient}
      isClient={project.clientId === viewer.user.id}
    />
  );
}

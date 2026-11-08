import ProjectHeader from '@/components/portal/ProjectHeader';
import type { ProjectTab } from '@/components/portal/tabs';
import { Page } from '@/components/portal/ui';
import { getViewer, requireProject } from '@/server/portal/access';
import { collectAttention } from '@/server/portal/collect';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  // Another client's project looks exactly like one that does not exist
  const project = await requireProject(projectId);
  const [viewer, attention] = await Promise.all([getViewer(), collectAttention(project.id)]);

  const badges: Partial<Record<ProjectTab, number>> = {};
  for (const item of attention) {
    if (item.tone !== 'info') badges[item.tab] = (badges[item.tab] ?? 0) + 1;
  }

  return (
    <Page>
      <ProjectHeader
        project={{
          id: project.id,
          name: project.name,
          stage: project.stage,
          targetLaunch: project.targetLaunch,
          clientName: project.clientName,
          clientEmail: project.clientEmail,
          clientCompany: project.clientCompany,
        }}
        showStudio={viewer.showStudio}
        badges={badges}
      />
      {children}
    </Page>
  );
}

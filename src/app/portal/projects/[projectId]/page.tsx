import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectDetail from '@/components/portal/ProjectDetail';
import { getProject, requirePortalUser } from '@/lib/portal';

export const metadata: Metadata = { title: 'Project' };

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const portalUser = await requirePortalUser();
  // Another client's project looks exactly like one that does not exist
  const project = await getProject(portalUser, projectId);
  if (!project) notFound();

  return <ProjectDetail project={project} />;
}

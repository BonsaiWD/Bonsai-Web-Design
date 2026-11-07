import ProjectList from '@/components/portal/ProjectList';
import { isAdmin, listProjects, requirePortalUser } from '@/lib/portal';

export default async function PortalHome() {
  const portalUser = await requirePortalUser();
  const projects = await listProjects(portalUser);
  const firstName = portalUser.name.trim().split(/\s+/)[0] || null;

  return <ProjectList firstName={firstName} isAdmin={isAdmin(portalUser)} projects={projects} />;
}

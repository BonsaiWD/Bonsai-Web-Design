import { EmptyState, Page } from '@/components/portal/ui';
import { requirePortalUser } from '@/server/portal/access';

// Placeholder until the dashboards are built
export default async function PortalHome() {
  await requirePortalUser();
  return (
    <Page>
      <EmptyState title="Dashboard">The dashboard is on its way.</EmptyState>
    </Page>
  );
}

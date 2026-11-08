import ClientsView from '@/components/portal/admin/ClientsView';
import StudioOnlyNotice from '@/components/portal/admin/StudioOnlyNotice';
import { Page } from '@/components/portal/ui';
import { getViewer, requireAdminPage } from '@/server/portal/access';
import { adminPageMetadata } from '@/server/portal/metadata';
import { loadPeople } from '@/server/portal/features/clients';

export const generateMetadata = adminPageMetadata('Clients');

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ add?: string | string[] }> }) {
  // A client sees the same page as a missing one
  await requireAdminPage();
  // Previewing as a client: this page has no client version, so no live studio controls
  if ((await getViewer()).previewingAsClient) {
    return (
      <Page>
        <StudioOnlyNotice heading="Clients" />
      </Page>
    );
  }
  const [{ clients, studio }, params] = await Promise.all([loadPeople(), searchParams]);
  return (
    <Page>
      <ClientsView clients={clients} studio={studio} openAdd={params.add === '1'} />
    </Page>
  );
}

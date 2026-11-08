import type { Metadata } from 'next';
import ClientsView from '@/components/portal/admin/ClientsView';
import { Page } from '@/components/portal/ui';
import { requireAdminPage } from '@/server/portal/access';
import { loadPeople } from '@/server/portal/features/clients';

export const metadata: Metadata = { title: 'Clients' };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ add?: string | string[] }> }) {
  // A client sees the same page as a missing one
  await requireAdminPage();
  const [{ clients, studio }, params] = await Promise.all([loadPeople(), searchParams]);
  return (
    <Page>
      <ClientsView clients={clients} studio={studio} openAdd={params.add === '1'} />
    </Page>
  );
}

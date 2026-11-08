import { randomUUID } from 'node:crypto';
import type { Metadata } from 'next';
import NewProjectView from '@/components/portal/admin/NewProjectView';
import { Page } from '@/components/portal/ui';
import { requireAdminPage } from '@/server/portal/access';
import { loadClientOptions } from '@/server/portal/features/clients';

export const metadata: Metadata = { title: 'New project' };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ client?: string | string[] }> }) {
  await requireAdminPage();
  const [clients, params] = await Promise.all([loadClientOptions(), searchParams]);
  return (
    <Page>
      <NewProjectView
        // Made per page load, so a double submit creates one project
        formId={randomUUID()}
        clients={clients}
        preselect={typeof params.client === 'string' ? params.client : null}
      />
    </Page>
  );
}

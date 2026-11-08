import type { Metadata } from 'next';
import InvoicesView from '@/components/portal/invoices/InvoicesView';
import { requireProject } from '@/server/portal/access';
import { featureContext } from '@/server/portal/collect';
import { loadEnabledPaymentMethods, loadInvoiceList } from '@/server/portal/features/invoices';

export const metadata: Metadata = { title: 'Invoices' };

export default async function InvoicesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  // Another client's project looks exactly like one that does not exist
  const project = await requireProject(projectId);
  const context = await featureContext(project.id);
  const studio = context.perspective === 'studio';

  // The client's list is filtered in the query: drafts never leave the studio
  const [invoices, methods] = await Promise.all([
    loadInvoiceList(project.id, context.perspective),
    studio ? loadEnabledPaymentMethods() : Promise.resolve([]),
  ]);

  return (
    <InvoicesView
      projectId={project.id}
      perspective={context.perspective}
      clientName={project.clientName || project.clientEmail}
      today={context.today}
      invoices={invoices}
      enabledMethods={methods.map((method) => method.method)}
    />
  );
}

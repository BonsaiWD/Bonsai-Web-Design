import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import InvoiceView from '@/components/portal/invoices/InvoiceView';
import { getProjectForViewer, getViewer, requireProject } from '@/server/portal/access';
import { featureContext } from '@/server/portal/collect';
import { loadEnabledPaymentMethods, loadInvoice } from '@/server/portal/features/invoices';
import { STUDIO_EMAIL, STUDIO_NAME } from '@/server/portal/notify';

type Params = Promise<{ projectId: string; invoiceId: string }>;

// The number names the tab, and the file when the invoice is saved as a PDF
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { projectId, invoiceId } = await params;
  const project = await getProjectForViewer(projectId);
  // The page renders the portal's not-found screen for either miss
  if (!project) return { title: 'Page not found' };
  const context = await featureContext(project.id);
  const invoice = await loadInvoice(project.id, invoiceId, context.perspective);
  return { title: invoice ? `Invoice ${invoice.number} · ${project.name}` : 'Page not found' };
}

export default async function InvoicePage({ params }: { params: Params }) {
  const { projectId, invoiceId } = await params;
  const project = await requireProject(projectId);
  const [viewer, context] = await Promise.all([getViewer(), featureContext(project.id)]);

  // Matched to this project, and drafts are left out for the client's perspective
  const [invoice, methods] = await Promise.all([loadInvoice(project.id, invoiceId, context.perspective), loadEnabledPaymentMethods()]);
  if (!invoice) notFound();

  return (
    <InvoiceView
      projectId={project.id}
      perspective={context.perspective}
      canPay={viewer.user.id === project.clientId}
      today={context.today}
      invoice={invoice}
      parties={{
        studioName: STUDIO_NAME,
        studioEmail: STUDIO_EMAIL,
        clientName: project.clientName || project.clientEmail,
        clientCompany: project.clientCompany,
        clientEmail: project.clientEmail,
      }}
      methods={methods}
    />
  );
}

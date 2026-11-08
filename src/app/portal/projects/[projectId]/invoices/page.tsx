import type { Metadata } from 'next';
import { EmptyState } from '@/components/portal/ui';

export const metadata: Metadata = { title: 'Invoices' };

// Placeholder until the Invoices feature is built
export default function Page() {
  return <EmptyState title="Invoices">This section is on its way.</EmptyState>;
}

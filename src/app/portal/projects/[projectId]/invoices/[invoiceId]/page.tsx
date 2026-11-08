import type { Metadata } from 'next';
import { EmptyState } from '@/components/portal/ui';

export const metadata: Metadata = { title: 'Invoice' };

// Placeholder until the Invoice feature is built
export default function Page() {
  return <EmptyState title="Invoice">This invoice view is on its way.</EmptyState>;
}

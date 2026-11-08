import type { Metadata } from 'next';
import { EmptyState } from '@/components/portal/ui';

export const metadata: Metadata = { title: 'Deliverables' };

// Placeholder until the Deliverables feature is built
export default function Page() {
  return <EmptyState title="Deliverables">This section is on its way.</EmptyState>;
}

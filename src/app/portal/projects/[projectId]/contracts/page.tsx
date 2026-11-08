import type { Metadata } from 'next';
import { EmptyState } from '@/components/portal/ui';

export const metadata: Metadata = { title: 'Contracts' };

// Placeholder until the Contracts feature is built
export default function Page() {
  return <EmptyState title="Contracts">This section is on its way.</EmptyState>;
}

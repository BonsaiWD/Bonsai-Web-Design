import type { Metadata } from 'next';
import { EmptyState } from '@/components/portal/ui';

export const metadata: Metadata = { title: 'Milestones' };

// Placeholder until the Milestones feature is built
export default function Page() {
  return <EmptyState title="Milestones">This section is on its way.</EmptyState>;
}

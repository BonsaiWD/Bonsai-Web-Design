import type { Metadata } from 'next';
import { EmptyState } from '@/components/portal/ui';

export const metadata: Metadata = { title: 'Messages' };

// Placeholder until the Messages feature is built
export default function Page() {
  return <EmptyState title="Messages">This section is on its way.</EmptyState>;
}

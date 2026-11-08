import type { Metadata } from 'next';
import { EmptyState } from '@/components/portal/ui';

export const metadata: Metadata = { title: 'Files' };

// Placeholder until the Files feature is built
export default function Page() {
  return <EmptyState title="Files">This section is on its way.</EmptyState>;
}

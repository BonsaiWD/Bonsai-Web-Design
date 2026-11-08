import type { Metadata } from 'next';
import { EmptyState } from '@/components/portal/ui';

export const metadata: Metadata = { title: 'Overview' };

// Placeholder until the Overview feature is built
export default function Page() {
  return <EmptyState title="Overview">The project overview is on its way.</EmptyState>;
}

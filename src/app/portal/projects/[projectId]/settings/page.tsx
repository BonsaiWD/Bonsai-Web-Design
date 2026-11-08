import type { Metadata } from 'next';
import { EmptyState } from '@/components/portal/ui';

export const metadata: Metadata = { title: 'Settings' };

// Placeholder until the Settings feature is built
export default function Page() {
  return <EmptyState title="Settings">This section is on its way.</EmptyState>;
}

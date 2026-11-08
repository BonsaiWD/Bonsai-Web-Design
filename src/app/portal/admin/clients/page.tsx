import type { Metadata } from 'next';
import { EmptyState } from '@/components/portal/ui';

export const metadata: Metadata = { title: 'Admin' };

// Placeholder until the Admin feature is built
export default function Page() {
  return <EmptyState title="Admin">This page is on its way.</EmptyState>;
}

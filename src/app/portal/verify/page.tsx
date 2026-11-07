import type { Metadata } from 'next';
import VerifyPanel from '@/components/portal/VerifyPanel';

export const metadata: Metadata = { title: 'Sign in' };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <VerifyPanel token={typeof token === 'string' && token ? token : null} />;
}

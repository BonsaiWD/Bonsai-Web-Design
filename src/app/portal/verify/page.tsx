import type { Metadata } from 'next';
import VerifyPanel from '@/components/portal/VerifyPanel';
import { safePortalPath } from '@/server/portal/access';

export const metadata: Metadata = { title: 'Sign in' };

type Params = { token?: string | string[]; next?: string | string[] };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { token, next } = await searchParams;
  return (
    <VerifyPanel
      token={typeof token === 'string' && token ? token : null}
      next={safePortalPath(typeof next === 'string' ? next : undefined)}
    />
  );
}

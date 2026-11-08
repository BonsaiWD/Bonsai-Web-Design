import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SignInForm from '@/components/portal/SignInForm';
import { linkErrorMessage } from '@/components/portal/labels';
import { LINK_LIFETIME_MINUTES } from '@/lib/auth';
import { getPortalSession, safePortalPath } from '@/server/portal/access';

export const metadata: Metadata = { title: 'Sign in' };

type Params = { error?: string | string[]; email?: string | string[]; next?: string | string[] };
const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

export default async function SignInPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const next = safePortalPath(one(params.next));
  if (await getPortalSession()) redirect(next ?? '/portal');

  // Invites link here with the client's address filled in
  const email = (one(params.email) ?? '').slice(0, 254);
  return (
    <SignInForm
      initialError={linkErrorMessage(one(params.error))}
      initialEmail={email}
      next={next}
      linkMinutes={LINK_LIFETIME_MINUTES}
    />
  );
}

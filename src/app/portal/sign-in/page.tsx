import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SignInForm from '@/components/portal/SignInForm';
import { linkErrorMessage } from '@/components/portal/labels';
import { LINK_LIFETIME_MINUTES } from '@/lib/auth';
import { getPortalSession } from '@/lib/portal';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (await getPortalSession()) redirect('/portal');

  const { error } = await searchParams;
  return (
    <SignInForm
      initialError={linkErrorMessage(typeof error === 'string' ? error : undefined)}
      linkMinutes={LINK_LIFETIME_MINUTES}
    />
  );
}

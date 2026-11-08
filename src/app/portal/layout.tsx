import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import PortalShell from '@/components/portal/PortalShell';
import { getPortalSession, isAdmin, VIEW_COOKIE } from '@/server/portal/access';

export const metadata: Metadata = {
  title: {
    default: 'Client portal | Bonsai Web Design',
    template: '%s | Bonsai Web Design client portal',
  },
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // The sign-in pages share this layout, so a missing session is normal here
  const session = await getPortalSession();
  const admin = session ? isAdmin(session.user) : false;
  const previewingAsClient = admin && (await cookies()).get(VIEW_COOKIE)?.value === 'client';
  return (
    <PortalShell email={session?.user.email ?? null} isAdmin={admin} previewingAsClient={previewingAsClient}>
      {children}
    </PortalShell>
  );
}

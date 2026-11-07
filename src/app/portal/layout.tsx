import type { Metadata } from 'next';
import PortalShell from '@/components/portal/PortalShell';
import { getPortalSession } from '@/lib/portal';

export const metadata: Metadata = {
  title: {
    default: 'Client portal | Bonsai Web Design',
    template: '%s | Bonsai Web Design client portal',
  },
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  return <PortalShell email={session?.user.email ?? null}>{children}</PortalShell>;
}

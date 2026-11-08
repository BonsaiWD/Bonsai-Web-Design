'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import styled from 'styled-components';
import { FiEye, FiLogOut } from 'react-icons/fi';
import Footer from '../layout/Footer';
import { authClient } from '@/lib/auth-client';
import { setPortalView } from '@/app/portal/_actions/view';
import { Button, focusRing, GuardedLink, nativeCursor, PHONE, space, tint, type, UnsavedChangesProvider } from './ui';

const LOGO_SUB = 0.39; // em, as in the site header's lockup
const LOGO_GAP = 0.25; // em

// Everything inside the portal: dark form controls, the native cursor, Inter headings
const Frame = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  color-scheme: dark;
  ${nativeCursor}

  & ::selection {
    background: ${({ theme }) => tint(theme.colors.primary, 35)};
  }
`;

const Bar = styled.header`
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  background: ${({ theme }) => theme.colors.background};
`;

const BarInner = styled.div`
  display: flex;
  align-items: center;
  gap: ${space[8]};
  max-width: 72rem;
  margin: 0 auto;
  padding: ${space[4]} ${space[6]};

  @media (max-width: ${PHONE}) {
    flex-wrap: wrap;
    gap: ${space[3]} ${space[4]};
    padding: ${space[3]} ${space[4]};
  }
`;

// The site's wordmark with "Client portal" where the header puts "Web Design"
const Wordmark = styled(GuardedLink)`
  flex-shrink: 0;
  display: inline-block;
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.05em;
  text-align: center;
  text-indent: 0.05em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text};
  transition: none;
  ${focusRing}

  span {
    display: block;
    margin-top: ${(LOGO_GAP / LOGO_SUB).toFixed(3)}em;
    padding-left: 0.34em;
    text-indent: 0;
    font-family: ${({ theme }) => theme.fonts.caps};
    font-size: ${LOGO_SUB}em;
    letter-spacing: 0.34em;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: ${space[1]};
  min-width: 0;

  @media (max-width: ${PHONE}) {
    order: 3;
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
`;

const NavLink = styled(GuardedLink)<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0 ${space[3]};
  font-size: 0.9375rem;
  font-weight: 500;
  white-space: nowrap;
  color: ${({ $active, theme }) => ($active ? theme.colors.text : theme.colors.textSecondary)};
  box-shadow: inset 0 -2px 0 ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  transition: color 0.2s;
  ${focusRing}

  @media (hover: hover) {
    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  }
`;

const Account = styled.div`
  display: flex;
  align-items: center;
  gap: ${space[3]};
  margin-left: auto;
  min-width: 0;
`;

const Email = styled.span`
  ${type.meta}
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 16rem;

  @media (max-width: ${PHONE}) {
    display: none;
  }
`;

const PreviewBar = styled.div`
  background: ${({ theme }) => tint(theme.colors.primary, 12)};
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};

  > div {
    ${type.body}
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${space[3]};
    max-width: 72rem;
    margin: 0 auto;
    padding: ${space[3]} ${space[6]};
    font-size: 0.9375rem;
    color: ${({ theme }) => theme.colors.text};

    @media (max-width: ${PHONE}) {
      padding: ${space[3]} ${space[4]};
    }
  }

  p {
    margin: 0;
  }

  svg {
    margin-right: ${space[2]};
    vertical-align: -0.15em;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Main = styled.main`
  flex: 1;
`;

// The shared site footer, aligned to the portal's narrower content column
const FooterAlign = styled.div`
  footer > div:first-child {
    max-width: 72rem;
    padding: 0 ${space[6]};

    @media (max-width: ${PHONE}) {
      padding: 0 ${space[4]};
    }
  }
`;

interface PortalShellProps {
  email: string | null;
  isAdmin: boolean;
  previewingAsClient: boolean;
  children: React.ReactNode;
}

const STUDIO_NAV = [
  { href: '/portal', label: 'Overview', match: (p: string) => p === '/portal' || p.startsWith('/portal/projects') },
  { href: '/portal/admin/clients', label: 'Clients', match: (p: string) => p.startsWith('/portal/admin/clients') },
  { href: '/portal/admin/settings', label: 'Settings', match: (p: string) => p.startsWith('/portal/admin/settings') },
];

const CLIENT_NAV = [{ href: '/portal', label: 'Projects', match: (p: string) => p === '/portal' || p.startsWith('/portal/projects') }];

export default function PortalShell({ email, isAdmin, previewingAsClient, children }: PortalShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const nav = isAdmin && !previewingAsClient ? STUDIO_NAV : CLIENT_NAV;

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace('/portal/sign-in');
    // The layout is shared with the sign-in page, so re-render it without the session
    router.refresh();
  }

  return (
    <UnsavedChangesProvider>
    <Frame>
      <Bar>
        <BarInner>
          <Wordmark href={email ? '/portal' : '/'} prefetch={email ? undefined : false}>
            Bonsai <span>Client portal</span>
          </Wordmark>
          {email && (
            <Nav aria-label="Portal">
              {nav.map((item) => {
                const active = item.match(pathname);
                return (
                  <NavLink key={item.href} href={item.href} $active={active} aria-current={active ? 'page' : undefined}>
                    {item.label}
                  </NavLink>
                );
              })}
            </Nav>
          )}
          {email && (
            <Account>
              {isAdmin && !previewingAsClient && (
                <form action={setPortalView}>
                  <input type="hidden" name="mode" value="client" />
                  {/* Studio-only pages have no client version: preview the client's dashboard */}
                  <input type="hidden" name="back" value={pathname.startsWith('/portal/admin') || pathname.endsWith('/settings') ? '/portal' : pathname} />
                  <Button type="submit" $variant="quiet" $size="sm">
                    <FiEye aria-hidden="true" />
                    View as client
                  </Button>
                </form>
              )}
              <Email title={email}>{email}</Email>
              <Button
                $variant="quiet"
                $size="sm"
                onClick={handleSignOut}
                aria-disabled={signingOut || undefined}
              >
                <FiLogOut aria-hidden="true" />
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Button>
            </Account>
          )}
        </BarInner>
      </Bar>
      {previewingAsClient && (
        <PreviewBar>
          <div>
            <p>
              <FiEye aria-hidden="true" />
              You are seeing the portal the way your clients do. Their actions are turned off in this view.
            </p>
            <form action={setPortalView}>
              <input type="hidden" name="mode" value="studio" />
              <input type="hidden" name="back" value={pathname} />
              <Button type="submit" $variant="secondary" $size="sm">
                Back to studio view
              </Button>
            </form>
          </div>
        </PreviewBar>
      )}
      <Main>{children}</Main>
      <FooterAlign>
        <Footer />
      </FooterAlign>
    </Frame>
    </UnsavedChangesProvider>
  );
}

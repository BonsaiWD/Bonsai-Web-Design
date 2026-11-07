'use client';

import styled from 'styled-components';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '../layout/Container';
import Footer from '../layout/Footer';
import CursorGlow from '../common/CursorGlow';
import { authClient } from '@/lib/auth-client';
import { focusRing, tint, TextButton } from './ui';

const LOGO_SUB = 0.39; // em, as in the site header's lockup
const LOGO_GAP = 0.25; // em

const Frame = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const Bar = styled.header`
  padding: ${({ theme }) => theme.spacing.lg} 0;
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
`;

const BarInner = styled(Container)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;

// The header's wordmark, with "Client portal" where the site puts "Web Design"
const Wordmark = styled.a`
  display: inline-block;
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.75rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.05em;
  text-align: center;
  text-indent: 0.05em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text};
  /* Override GlobalStyle's a { transition: all } so the focus ring appears at once */
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

const Account = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  min-width: 0;
`;

const Email = styled.span`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 768px) {
    display: none;
  }
`;

const SignOut = styled(TextButton)`
  font-size: 0.85rem;
  white-space: nowrap;
`;

const Main = styled.main`
  flex: 1;
`;

interface PortalShellProps {
  email: string | null;
  children: React.ReactNode;
}

export default function PortalShell({ email, children }: PortalShellProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace('/portal/sign-in');
    // The layout is shared with the sign-in page, so re-render it without the session
    router.refresh();
  }

  return (
    <Frame>
      <CursorGlow />
      <Bar>
        <BarInner>
          <Wordmark href="/">
            Bonsai <span>Client portal</span>
          </Wordmark>
          {email && (
            <Account>
              <Email>{email}</Email>
              <SignOut type="button" onClick={handleSignOut} disabled={signingOut}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </SignOut>
            </Account>
          )}
        </BarInner>
      </Bar>
      <Main>{children}</Main>
      <Footer />
    </Frame>
  );
}

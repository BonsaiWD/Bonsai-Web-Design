'use client';

import { Eyebrow, Lead, NarrowColumn, PageTitle, PortalPage, PrimaryLink, TextLink } from './ui';

interface VerifyPanelProps {
  token: string | null;
}

// The email links here, not to the verify endpoint, so a link scanner that opens URLs
// in advance only loads this page and leaves the one-time token unused
export default function VerifyPanel({ token }: VerifyPanelProps) {
  if (!token) {
    return (
      <PortalPage>
        <NarrowColumn>
          <Eyebrow>Client portal</Eyebrow>
          <PageTitle>
            This link is <em>incomplete</em>
          </PageTitle>
          <Lead>Request a new sign-in link, then use the button in that email.</Lead>
          <TextLink href="/portal/sign-in">Request a new link</TextLink>
        </NarrowColumn>
      </PortalPage>
    );
  }

  const verify = new URLSearchParams({
    token,
    callbackURL: '/portal',
    errorCallbackURL: '/portal/sign-in',
  });

  return (
    <PortalPage>
      <NarrowColumn>
        <Eyebrow>Client portal</Eyebrow>
        <PageTitle>
          Continue to your <em>portal</em>
        </PageTitle>
        <Lead>Use the button below to finish signing in on this device.</Lead>
        <PrimaryLink href={`/api/auth/magic-link/verify?${verify}`}>Open my portal</PrimaryLink>
      </NarrowColumn>
    </PortalPage>
  );
}

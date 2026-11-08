'use client';

import styled from 'styled-components';
import { FiArrowRight } from 'react-icons/fi';
import { ButtonAnchor, Eyebrow, H1, Lead, Stack, TextLink, space } from './ui';

const Column = styled.div`
  width: 100%;
  max-width: 30rem;
  margin: 0 auto;
  padding: ${space[16]} ${space[4]};

  @media (max-width: 768px) {
    padding-top: ${space[10]};
  }
`;

// The sign-in page, keeping where the person was heading (a path the server already checked
// with safePortalPath): Better Auth adds ?error= to it for an expired or used link, so the
// next link still opens that page
export function signInHref(next: string | null) {
  return next ? `/portal/sign-in?next=${encodeURIComponent(next)}` : '/portal/sign-in';
}

interface VerifyPanelProps {
  token: string | null;
  next: string | null;
}

// The email links here, not to the verify endpoint, so a link scanner that opens URLs
// in advance only loads this page and leaves the one-time token unused
export default function VerifyPanel({ token, next }: VerifyPanelProps) {
  // Both ways back to sign-in keep the deep link, so the next link still opens it
  const signIn = signInHref(next);
  if (!token) {
    return (
      <Column>
        <Stack $gap={5}>
          <Stack $gap={3}>
            <Eyebrow>Client portal</Eyebrow>
            <H1>This link is incomplete</H1>
            <Lead>Request a new sign-in link, then use the button in that email.</Lead>
          </Stack>
          <div>
            <TextLink href={signIn}>Request a new link</TextLink>
          </div>
        </Stack>
      </Column>
    );
  }

  const verify = new URLSearchParams({
    token,
    callbackURL: next ?? '/portal',
    errorCallbackURL: signIn,
  });

  return (
    <Column>
      <Stack $gap={6}>
        <Stack $gap={3}>
          <Eyebrow>Client portal</Eyebrow>
          <H1>Continue to your portal</H1>
          <Lead>Use the button below to finish signing in on this device.</Lead>
        </Stack>
        <div>
          <ButtonAnchor href={`/api/auth/magic-link/verify?${verify}`}>
            Open my portal
            <FiArrowRight aria-hidden="true" />
          </ButtonAnchor>
        </div>
      </Stack>
    </Column>
  );
}

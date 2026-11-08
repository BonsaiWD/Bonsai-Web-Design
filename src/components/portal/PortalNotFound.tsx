'use client';

import { Eyebrow, H1, Lead, Page, Stack, TextLink } from './ui';

export default function PortalNotFound() {
  return (
    <Page>
      <Stack $gap={5}>
        <Stack $gap={3}>
          <Eyebrow>Client portal</Eyebrow>
          <H1>We could not find that page</H1>
          <Lead>The link may be out of date, or it may belong to a different account.</Lead>
        </Stack>
        <div>
          <TextLink href="/portal">Back to the portal</TextLink>
        </div>
      </Stack>
    </Page>
  );
}

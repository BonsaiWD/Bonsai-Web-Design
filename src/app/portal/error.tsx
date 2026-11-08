'use client';

import { useEffect } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { Button, Eyebrow, H1, Lead, Meta, Page, Stack, TextAnchor, TextLink } from '@/components/portal/ui';

// Keeps the portal frame when a page or an action fails, so the client can try again in place
export default function PortalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && 'digest' in error ? String((error as { digest?: unknown }).digest ?? '') : '';

  return (
    <Page>
      <Stack $gap={6}>
        <Stack $gap={3}>
          <Eyebrow>Client portal</Eyebrow>
          <H1>This page didn&rsquo;t load</H1>
          <Lead>Something went wrong on our side. Your saved work is safe. Try again, or go back to the portal.</Lead>
        </Stack>
        <Stack $gap={4}>
          <div>
            <Button onClick={() => retry()}>
              <FiRefreshCw aria-hidden="true" />
              Try again
            </Button>
          </div>
          <div>
            <TextLink href="/portal">Back to the portal</TextLink>
          </div>
          <Meta>
            Still stuck? Email <TextAnchor href="mailto:admin@bonsaiwebdesign.com">admin@bonsaiwebdesign.com</TextAnchor>
            {digest ? ` and mention reference ${digest}.` : '.'}
          </Meta>
        </Stack>
      </Stack>
    </Page>
  );
}

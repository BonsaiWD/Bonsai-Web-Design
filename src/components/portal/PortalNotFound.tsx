'use client';

import { Eyebrow, Lead, NarrowColumn, PageTitle, PortalPage, TextLink } from './ui';

export default function PortalNotFound() {
  return (
    <PortalPage>
      <NarrowColumn>
        <Eyebrow>Client portal</Eyebrow>
        <PageTitle>
          We could not find <em>that page</em>
        </PageTitle>
        <Lead>The link may be out of date, or the project may belong to a different account.</Lead>
        <TextLink href="/portal">Back to your projects</TextLink>
      </NarrowColumn>
    </PortalPage>
  );
}

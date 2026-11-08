'use client';

import { usePathname } from 'next/navigation';
import styled from 'styled-components';
import { FiArrowRight } from 'react-icons/fi';
import { setPortalView } from '@/app/portal/_actions/view';
import { Button, ButtonLink, Cluster, Eyebrow, H1, Notice, space } from '../ui';

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  margin-bottom: ${space[8]};
`;

const Actions = styled(Cluster)`
  margin-top: ${space[2]};
`;

/*
 * What a studio-only page shows while an admin previews the portal as a client: clients never
 * see it, so instead of live studio controls under the "the way your clients do" banner it
 * explains that and offers the way back, or on to what the client does see.
 */
export default function StudioOnlyNotice({ heading }: { heading?: string }) {
  const pathname = usePathname();
  return (
    <div>
      {heading && (
        <Header>
          <Eyebrow>Studio only</Eyebrow>
          <H1>{heading}</H1>
        </Header>
      )}
      <Notice>
        <p>
          Clients never see this page, so there is nothing to preview here. Switch back to the studio view to use it, or see the
          dashboard your clients see.
        </p>
        <Actions>
          <form action={setPortalView}>
            <input type="hidden" name="mode" value="studio" />
            <input type="hidden" name="back" value={pathname} />
            <Button type="submit" $size="sm">
              Back to studio view
            </Button>
          </form>
          <ButtonLink href="/portal" $variant="quiet" $size="sm">
            Preview the client dashboard
            <FiArrowRight aria-hidden="true" />
          </ButtonLink>
        </Actions>
      </Notice>
    </div>
  );
}

'use client';

import { projectHref } from '@/components/portal/tabs';
import { plural } from '@/lib/portal-format';
import { Figures, H3, LocalTime, Meta, Panel, Stack, TextAnchor, TextLink } from '@/components/portal/ui';
import { Aside, ContactLine, Facts, Tips } from './styles';
import type { StudioThreadInfo } from './types';

export function ClientAside({ projectId, maxUploadMb }: { projectId: string; maxUploadMb: number }) {
  return (
    <Aside aria-label="About messages">
      <Panel aria-labelledby="messages-about">
        <Stack $gap={4}>
          <H3 id="messages-about">About messages</H3>
          <Tips>
            <li>
              <strong>Private to you and us.</strong> Only you and the studio can read this conversation.
            </li>
            <li>
              <strong>No need to check back.</strong> We email you when we reply, with a link straight here.
            </li>
            <li>
              <strong>Sharing files?</strong> Add them in <TextLink href={projectHref(projectId, 'files')}>Files</TextLink>, or paste a link here
              for anything over {maxUploadMb} MB.
            </li>
          </Tips>
        </Stack>
      </Panel>
    </Aside>
  );
}

interface StudioAsideProps {
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  total: number;
  info: StudioThreadInfo;
}

export function StudioAside({ clientName, clientEmail, clientCompany, total, info }: StudioAsideProps) {
  return (
    <Aside aria-label={`${clientName} and how messages work`}>
      <Panel aria-labelledby="messages-client">
        <Stack $gap={4}>
          <Stack $gap={1}>
            <H3 id="messages-client">{clientName}</H3>
            {clientCompany && <Meta>{clientCompany}</Meta>}
            <ContactLine>
              <TextAnchor href={`mailto:${clientEmail}`}>{clientEmail}</TextAnchor>
            </ContactLine>
          </Stack>
          <Facts>
            <div>
              <dt>Last opened messages</dt>
              <dd>{info.clientReadAt ? <LocalTime value={info.clientReadAt} /> : 'Not yet'}</dd>
            </div>
            <div>
              <dt>Last emailed about a message</dt>
              <dd>{info.lastEmailedClientAt ? <LocalTime value={info.lastEmailedClientAt} /> : 'Not yet'}</dd>
            </div>
          </Facts>
          <Meta>
            <Figures>
              {plural(Math.max(0, total - info.internalCount), 'message')} · {plural(info.internalCount, 'internal note')}
            </Figures>
          </Meta>
        </Stack>
      </Panel>

      <Panel aria-labelledby="messages-how">
        <Stack $gap={4}>
          <H3 id="messages-how">How messages work</H3>
          <Tips>
            <li>
              <strong>Emails:</strong> {clientName} gets one when you send a message, at most once every 10 minutes. Anything
              you add in that time waits here for them.
            </li>
            <li>
              <strong>Internal notes</strong> stay with the studio. They are never emailed or shown to {clientName}.
            </li>
            <li>
              <strong>Replies:</strong> messages from {clientName} are emailed to the studio inbox, with a link back here.
            </li>
          </Tips>
        </Stack>
      </Panel>
    </Aside>
  );
}

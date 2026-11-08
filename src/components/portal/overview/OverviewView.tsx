'use client';

import styled from 'styled-components';
import { FiMail, FiMessageSquare } from 'react-icons/fi';
import { formatDate } from '@/lib/portal-format';
import { ActivityPanel, AttentionPanel, DeadlinePanel } from '../dashboard/parts';
import type { ActivityView, AttentionItem, DeadlineItem, NextMilestoneView, Perspective } from '../dashboard/types';
import { projectHref } from '../tabs';
import {
  ButtonLink,
  DataList,
  Eyebrow,
  H2,
  H3,
  LocalTime,
  MetaText,
  Panel,
  space,
  Split,
  Stack,
  Text,
  TextAnchor,
  TextLink,
  type,
} from '../ui';
import NextMilestone from './NextMilestone';

const STUDIO_EMAIL = 'admin@bonsaiwebdesign.com';

const Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${space[6]};
  min-width: 0;
`;

const CardStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[4]};

  > div:first-child {
    display: flex;
    flex-direction: column;
    gap: ${space[2]};
  }

  h3 {
    overflow-wrap: anywhere;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${space[3]};

  > a:first-child {
    width: 100%;
  }
`;

const MailLink = styled(TextAnchor)`
  display: inline-flex;
  align-items: center;
  gap: ${space[2]};
  ${type.meta}
  font-weight: 500;
  overflow-wrap: anywhere;
`;

// Labels above values: the aside is too narrow for the usual two columns
const StackedList = styled(DataList)`
  && > div {
    flex-direction: column;
    align-items: flex-start;
    gap: ${space[1]};
  }

  && dd {
    text-align: left;
  }
`;

interface ClientContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  lastSignInAt: string | null;
}

export interface OverviewViewProps {
  projectId: string;
  perspective: Perspective;
  today: string;
  clientFirst: string;
  summary: string | null;
  startedOn: string;
  attention: AttentionItem[];
  waiting: AttentionItem[];
  deadlines: DeadlineItem[];
  activity: ActivityView[];
  milestones: { next: NextMilestoneView | null; done: number; total: number };
  client: ClientContact | null;
}

// Who to talk to: the studio for a client, the client for the studio
function ContactCard({ projectId, client }: { projectId: string; client: ClientContact | null }) {
  if (!client) {
    return (
      <Panel aria-labelledby="overview-contact">
        <CardStack>
          <div>
            <Eyebrow>Your studio</Eyebrow>
            <H3 id="overview-contact">Bonsai Web Design</H3>
          </div>
          <Text $muted>Questions, changes or anything else: write to us here or by email. It reaches both of us.</Text>
          <Actions>
            <ButtonLink href={projectHref(projectId, 'messages')} $variant="secondary" $block>
              <FiMessageSquare aria-hidden="true" />
              Message us
            </ButtonLink>
            <MailLink href={`mailto:${STUDIO_EMAIL}`}>
              <FiMail aria-hidden="true" />
              {STUDIO_EMAIL}
            </MailLink>
          </Actions>
        </CardStack>
      </Panel>
    );
  }
  return (
    <Panel aria-labelledby="overview-contact">
      <CardStack>
        <div>
          <Eyebrow>Client</Eyebrow>
          <H3 id="overview-contact">{client.name}</H3>
          {client.company && <MetaText>{client.company}</MetaText>}
        </div>
        <StackedList>
          <div>
            <dt>Email</dt>
            <dd>
              <TextAnchor href={`mailto:${client.email}`}>{client.email}</TextAnchor>
            </dd>
          </div>
          <div>
            <dt>Last signed in</dt>
            <dd>{client.lastSignInAt ? <LocalTime value={client.lastSignInAt} /> : 'Never'}</dd>
          </div>
        </StackedList>
        <TextLink href={`/portal/admin/clients#client-${client.id}`}>
          {client.lastSignInAt ? 'Manage in Clients' : 'Send an invite from Clients'}
        </TextLink>
      </CardStack>
    </Panel>
  );
}

export default function OverviewView({
  projectId,
  perspective,
  today,
  clientFirst,
  summary,
  startedOn,
  attention,
  waiting,
  deadlines,
  activity,
  milestones,
  client,
}: OverviewViewProps) {
  const studio = perspective === 'studio';
  return (
    <Split>
      <Stack $gap={8}>
        <AttentionPanel
          id="overview-attention"
          title="Needs your attention"
          items={attention}
          today={today}
          showProject={false}
          calm={
            studio
              ? { title: 'Nothing needs the studio on this project right now.' }
              : { title: "You're all caught up.", text: "We'll email you when something needs you." }
          }
        />
        {studio && (
          <AttentionPanel
            id="overview-waiting"
            title={`Waiting on ${clientFirst}`}
            items={waiting}
            today={today}
            showProject={false}
            calm={{ title: `Nothing is waiting on ${clientFirst}.` }}
            note={waiting.length ? 'What they see on their to-do list' : undefined}
          />
        )}
        <NextMilestone projectId={projectId} perspective={perspective} today={today} clientFirst={clientFirst} {...milestones} />
        <ActivityPanel
          id="overview-activity"
          title="Recent activity"
          items={activity}
          perspective={perspective}
          showProject={false}
          empty={studio ? 'Nothing has happened on this project yet.' : 'Updates on your project will appear here.'}
          note={studio ? 'Studio-only entries included' : undefined}
        />
      </Stack>

      <Aside>
        <DeadlinePanel
          id="overview-dates"
          title="Key dates"
          items={deadlines}
          today={today}
          perspective={perspective}
          showProject={false}
          limit={8}
          clientFirst={clientFirst}
          empty={studio ? 'No open dates. Give milestones a due date to see them here.' : 'Dates appear here as we plan each step.'}
        />
        <Panel aria-labelledby="overview-about">
          <CardStack>
            <H2 id="overview-about">About this project</H2>
            {summary ? (
              <Text $muted>{summary}</Text>
            ) : studio ? (
              <Text $muted>
                No summary yet. <TextLink href={`${projectHref(projectId)}/settings`}>Add one in project settings</TextLink> so{' '}
                {clientFirst} has the project in a sentence.
              </Text>
            ) : null}
            <MetaText>Started {formatDate(startedOn)}</MetaText>
          </CardStack>
        </Panel>
        <ContactCard projectId={projectId} client={client} />
      </Aside>
    </Split>
  );
}

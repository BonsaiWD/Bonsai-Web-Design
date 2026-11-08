'use client';

import styled from 'styled-components';
import { FiPlus } from 'react-icons/fi';
import { daysBetween, plural } from '@/lib/portal-format';
import {
  Button,
  DataList,
  DateText,
  EmptyState,
  Eyebrow,
  H2,
  H3,
  Meta,
  Panel,
  SectionHeader,
  space,
  Split,
  Stack,
  tint,
  type,
  useDialog,
} from '@/components/portal/ui';
import { DeliverableCard } from './DeliverableCard';
import { GROUP_ORDER, GROUP_TITLES, groupOf, type GroupKey } from './labels';
import { sansHeading, StatusLine, useAnnouncer } from './parts';
import { ShareDialog, type ShareContext } from './ShareDialog';
import type { DeliverableView, MilestoneOption, Perspective } from './types';

// One column of headings and cards as siblings, so a card keeps its state (an open form, its
// status message) when a decision moves it to another group
const CardColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[4]};
  min-width: 0;
`;

const GroupTitle = styled(Eyebrow).attrs({ as: 'h3' })`
  ${sansHeading}
  ${type.figures}
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: ${space[3]};

  &:not(:first-child) {
    margin-top: ${space[6]};
  }

  /* A hairline running out from the label, as the site's index rows do */
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, ${({ theme }) => tint(theme.colors.primary, 40)}, transparent);
  }
`;

const ViewStatus = styled(StatusLine)`
  margin-bottom: ${space[6]};
`;

const Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  min-width: 0;
`;

const Steps = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${space[5]};

  li {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: ${space[1]} ${space[3]};
  }

  li > span {
    ${type.overline}
    ${type.figures}
    grid-row: span 2;
    padding-top: 0.1rem;
  }

  strong {
    ${type.label}
  }

  p {
    ${type.meta}
  }
`;

// A name and a wait, not a single figure: label above, value under it, both left-aligned,
// and the day count kept with its unit
const StackedEntry = styled.div`
  && {
    flex-direction: column;
    align-items: flex-start;
    gap: ${space[1]};
  }

  && dd {
    text-align: left;
  }

  span {
    display: block;
    ${type.meta}
    ${type.figures}
    white-space: nowrap;
  }
`;

const Tips = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${space[3]};

  li {
    ${type.meta}
    padding-left: ${space[4]};
    border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};
  }

  strong {
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  }
`;

export interface DeliverablesViewProps {
  projectId: string;
  perspective: Perspective;
  canDecide: boolean;
  clientName: string;
  today: string;
  deliverables: DeliverableView[];
  milestones: MilestoneOption[];
  acceptedExtensions: string;
  maxUploadBytes: number;
}

function orderWithin(group: GroupKey, items: DeliverableView[]): DeliverableView[] {
  const shared = (item: DeliverableView) => item.current?.sharedAt ?? '';
  if (group === 'review') {
    // Soonest review date first, then the one waiting longest
    return [...items].sort((a, b) => {
      const dueA = a.current?.reviewBy ?? '9999';
      const dueB = b.current?.reviewBy ?? '9999';
      return dueA === dueB ? shared(a).localeCompare(shared(b)) : dueA.localeCompare(dueB);
    });
  }
  return [...items].sort((a, b) => shared(b).localeCompare(shared(a)));
}

function Summary({ deliverables, perspective, today }: { deliverables: DeliverableView[]; perspective: Perspective; today: string }) {
  const count = (group: GroupKey) => deliverables.filter((item) => groupOf(item.current) === group).length;
  const reviewing = deliverables.filter((item) => item.current?.status === 'in_review');
  const nextDue = reviewing
    .map((item) => item.current?.reviewBy)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  const approved = deliverables.filter((item) => item.current?.status === 'approved').length;
  const delivered = deliverables.filter((item) => item.current?.status === 'delivered').length;
  const oldest = [...reviewing].sort((a, b) => (a.current?.sharedAt ?? '').localeCompare(b.current?.sharedAt ?? ''))[0];

  if (perspective === 'client') {
    return (
      <Panel aria-labelledby="deliverables-summary">
        <Stack $gap={3}>
          <H3 id="deliverables-summary">At a glance</H3>
          <DataList>
            <div>
              <dt>To review</dt>
              <dd>{count('review')}</dd>
            </div>
            <div>
              <dt>We are working on</dt>
              <dd>{count('changes') + count('next')}</dd>
            </div>
            <div>
              <dt>Approved</dt>
              <dd>{approved}</dd>
            </div>
            {delivered > 0 && (
              <div>
                <dt>Delivered</dt>
                <dd>{delivered}</dd>
              </div>
            )}
            {nextDue && (
              <div>
                <dt>Next review by</dt>
                <dd>
                  <DateText value={nextDue} />
                </dd>
              </div>
            )}
          </DataList>
        </Stack>
      </Panel>
    );
  }

  const waitingDays = oldest?.current ? daysBetween(oldest.current.sharedAt.slice(0, 10), today) : 0;
  return (
    <Panel aria-labelledby="deliverables-summary">
      <Stack $gap={3}>
        <H3 id="deliverables-summary">At a glance</H3>
        <DataList>
          <div>
            <dt>Changes requested</dt>
            <dd>{count('changes')}</dd>
          </div>
          <div>
            <dt>With the client</dt>
            <dd>{count('review')}</dd>
          </div>
          <div>
            <dt>Approved</dt>
            <dd>{approved}</dd>
          </div>
          <div>
            <dt>Delivered</dt>
            <dd>{delivered}</dd>
          </div>
          {oldest && (
            <StackedEntry>
              <dt>Waiting longest</dt>
              <dd>
                {oldest.title}
                <span>{waitingDays < 1 ? 'Shared today' : `Waiting ${plural(waitingDays, 'day')}`}</span>
              </dd>
            </StackedEntry>
          )}
        </DataList>
      </Stack>
    </Panel>
  );
}

function ClientGuide() {
  return (
    <Panel aria-labelledby="deliverables-guide">
      <Stack $gap={5}>
        <H3 id="deliverables-guide">How reviews work</H3>
        <Steps>
          <li>
            <span>01</span>
            <strong>Open the link or file</strong>
            <p>Each version has its own link, so what you approve is exactly what you saw.</p>
          </li>
          <li>
            <span>02</span>
            <strong>Approve it, or tell us what to change</strong>
            <p>Your notes come straight to us, and we reply with a new version.</p>
          </li>
          <li>
            <span>03</span>
            <strong>Your sign-off is kept on record</strong>
            <p>We record your name and the time, and email you a receipt.</p>
          </li>
        </Steps>
      </Stack>
    </Panel>
  );
}

function StudioGuide({ maxUploadMb }: { maxUploadMb: number }) {
  return (
    <Panel aria-labelledby="deliverables-links">
      <Stack $gap={4}>
        <H3 id="deliverables-links">Links that hold still</H3>
        <Meta>An approval covers the exact version the client opened, so share links that will not change.</Meta>
        <Tips>
          <li>
            <strong>Vercel:</strong> the deployment URL, not the branch alias with -git- in it.
          </li>
          <li>
            <strong>Figma:</strong> a link copied from version history, with a version id.
          </li>
          <li>
            <strong>Files:</strong> PDFs and images up to {maxUploadMb} MB open right in the browser.
          </li>
        </Tips>
      </Stack>
    </Panel>
  );
}

export default function DeliverablesView(props: DeliverablesViewProps) {
  const { perspective, deliverables } = props;
  const studio = perspective === 'studio';
  const share = useDialog();
  const { statusRef, message, announce } = useAnnouncer();

  const context: ShareContext = {
    projectId: props.projectId,
    clientName: props.clientName,
    milestones: props.milestones,
    acceptedExtensions: props.acceptedExtensions,
    maxUploadBytes: props.maxUploadBytes,
  };

  const entries = GROUP_ORDER[perspective].flatMap((group) => {
    const members = orderWithin(
      group,
      deliverables.filter((item) => groupOf(item.current) === group),
    );
    if (members.length === 0) return [];
    return [
      { kind: 'heading' as const, key: `group-${group}`, group, count: members.length },
      ...members.map((item) => ({ kind: 'card' as const, key: item.id, item })),
    ];
  });

  return (
    <div>
      <SectionHeader>
        <div>
          <H2>Deliverables</H2>
          <Meta>
            {studio
              ? `Share versions for ${props.clientName} to review. Every decision is kept with who made it and when.`
              : 'Designs and builds we share for your review. Open each one, then approve it or tell us what to change.'}
          </Meta>
        </div>
        {studio && (
          <Button onClick={share.openDialog}>
            <FiPlus aria-hidden="true" />
            Share a deliverable
          </Button>
        )}
      </SectionHeader>

      <ViewStatus ref={statusRef} message={message} />

      <Split>
        <CardColumn>
          {entries.length === 0 ? (
            studio ? (
              <EmptyState
                title="Nothing shared yet"
                action={
                  <Button $variant="secondary" onClick={share.openDialog}>
                    <FiPlus aria-hidden="true" />
                    Share the first deliverable
                  </Button>
                }
              >
                Share a design, a build or a document for {props.clientName} to review. Each new version keeps its own record of who
                approved what, and when.
              </EmptyState>
            ) : (
              <EmptyState title="Nothing to review yet">
                When we share designs or builds for your feedback, they appear here with a link to open them and a way to approve or ask
                for changes. We will email you each time.
              </EmptyState>
            )
          ) : (
            entries.map((entry) =>
              entry.kind === 'heading' ? (
                <GroupTitle key={entry.key}>
                  {GROUP_TITLES[perspective][entry.group]} · {entry.count}
                </GroupTitle>
              ) : (
                <DeliverableCard
                  key={entry.key}
                  deliverable={entry.item}
                  perspective={perspective}
                  canDecide={props.canDecide}
                  today={props.today}
                  context={context}
                  onDeleted={(text) => announce(text)}
                />
              ),
            )
          )}
        </CardColumn>

        <Aside aria-label={studio ? 'Deliverables summary and tips' : 'Deliverables summary and how reviews work'}>
          {deliverables.length > 0 && <Summary deliverables={deliverables} perspective={perspective} today={props.today} />}
          {studio ? <StudioGuide maxUploadMb={Math.floor(props.maxUploadBytes / (1024 * 1024))} /> : <ClientGuide />}
        </Aside>
      </Split>

      {studio && (
        <ShareDialog
          dialog={share}
          context={context}
          deliverable={null}
          // Focus goes back to "Share a deliverable"; the message is read out where it is
          onShared={(state) => announce(state.message, false)}
        />
      )}
    </div>
  );
}

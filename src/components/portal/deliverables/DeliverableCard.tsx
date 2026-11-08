'use client';

import { useId } from 'react';
import { dueInfo } from '@/lib/portal-format';
import { DateText, DueText, H3, LocalTime, Stack, StatusBadge, Text } from '@/components/portal/ui';
import { ClientDecision } from './ClientDecision';
import { cardStatus } from './labels';
import { Card, CardHead, MetaLine, NoteBlock, StatusLine, useAnnouncer } from './parts';
import type { ShareContext } from './ShareDialog';
import { StudioControls } from './StudioControls';
import type { DeliverableView, Perspective } from './types';
import { VersionContent } from './VersionContent';
import { DecisionRecord, EarlierVersions, VersionHistory } from './VersionRecords';

interface DeliverableCardProps {
  deliverable: DeliverableView;
  perspective: Perspective;
  // The signed-in person is this project's client
  canDecide: boolean;
  today: string;
  context: ShareContext;
  onDeleted: (message: string) => void;
}

export function DeliverableCard({ deliverable, perspective, canDecide, today, context, onDeleted }: DeliverableCardProps) {
  const titleId = useId();
  const { statusRef, message, announce } = useAnnouncer();
  const studio = perspective === 'studio';
  const current = deliverable.current;
  const badge = cardStatus(current, perspective);
  const live = current && current.status !== 'superseded' ? current : null;
  const needsViewer = studio
    ? !current || current.status === 'changes_requested' || current.status === 'superseded'
    : current?.status === 'in_review';
  const due = live?.status === 'in_review' && live.reviewBy ? dueInfo(live.reviewBy, today) : null;

  return (
    <Card id={`deliverable-${deliverable.id}`} aria-labelledby={titleId} $attention={needsViewer}>
      <CardHead>
        <div>
          <MetaLine stackOnPhone>
            {current ? `Version ${current.version}` : `Version ${deliverable.latestVersion} withdrawn`}
            {current && (
              <>
                Shared <LocalTime value={current.sharedAt} />
                {studio && current.sharedByName ? ` by ${current.sharedByName}` : ''}
              </>
            )}
          </MetaLine>
          <H3 as="h4" id={titleId}>
            {deliverable.title}
          </H3>
        </div>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
      </CardHead>

      {deliverable.description && <Text $muted>{deliverable.description}</Text>}

      {!current && (
        <Text $muted>
          Nothing is shared right now: version {deliverable.latestVersion} was withdrawn. Share a new version when it is ready.
        </Text>
      )}
      {current?.status === 'superseded' && (
        <Text $muted>
          {studio
            ? `Version ${deliverable.latestVersion} was withdrawn, so ${context.clientName} sees that a new version is on the way.`
            : "We're preparing a new version of this. We'll email you when it's ready to review."}
        </Text>
      )}

      {live && (
        <Stack $gap={4}>
          <VersionContent version={live} />
          {live.note && (
            <NoteBlock>
              <h5>{live.version > 1 ? 'What changed' : studio ? 'Note to client' : 'Notes from us'}</h5>
              <p>{live.note}</p>
            </NoteBlock>
          )}
          <MetaLine>
            {due && live.reviewBy && (
              <>
                Review by <DateText value={live.reviewBy} />
              </>
            )}
            {due && due.tone !== 'later' && live.reviewBy && <DueText value={live.reviewBy} today={today} />}
            {deliverable.milestone && <>Milestone: {deliverable.milestone.title}</>}
            {studio && (live.needsApproval ? 'Asks for approval' : 'No approval needed')}
          </MetaLine>
        </Stack>
      )}

      {live && <DecisionRecord version={live} perspective={perspective} />}

      {!studio && live && (
        <ClientDecision
          projectId={context.projectId}
          version={live}
          clientName={context.clientName}
          canDecide={canDecide}
          milestoneTitle={deliverable.milestone?.title ?? null}
          nextVersion={deliverable.latestVersion + 1}
          reviewing={live.status === 'in_review'}
          announce={announce}
          statusRef={statusRef}
        />
      )}
      {studio && (
        <StudioControls deliverable={deliverable} context={context} announce={announce} statusRef={statusRef} onDeleted={onDeleted} />
      )}

      <StatusLine ref={statusRef} message={message} />

      {studio ? (
        <VersionHistory
          versions={[...(current ? [current] : []), ...deliverable.earlier].sort((a, b) => b.version - a.version)}
          currentId={current?.id ?? null}
        />
      ) : (
        <EarlierVersions versions={deliverable.earlier} />
      )}
    </Card>
  );
}

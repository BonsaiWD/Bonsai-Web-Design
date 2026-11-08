'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiArrowDown, FiArrowUp, FiCheck, FiChevronDown, FiChevronRight, FiClipboard, FiEdit2, FiSend, FiTrash2 } from 'react-icons/fi';
import { askForSignoff, deleteMilestone, moveMilestone } from '@/app/portal/_actions/milestones';
import { dueInfo } from '@/lib/portal-format';
import type { ActionState } from '@/server/portal/actions';
import { MILESTONE_LABELS } from '../labels';
import { projectHref } from '../tabs';
import {
  ActionForm,
  Button,
  ButtonLink,
  ClientOnlyNote,
  DateText,
  DueText,
  H3,
  IconButton,
  InlineConfirm,
  LocalTime,
  MetaLine,
  MetaText,
  space,
  StatusBadge,
  StatusLine,
  SubmitButton,
  TextButton,
  TextLink,
  useAnnouncer,
  useDialog,
  useFormStatusState,
  VisuallyHidden,
} from '../ui';
import EditMilestoneForm from './EditMilestoneForm';
import { DELIVERABLE_LABELS, indexLabel } from './labels';
import RecordSignoffDialog from './RecordSignoffDialog';
import SignoffDialog from './SignoffDialog';
import { asksForInitials } from './signoff';
import { signoffStatement } from './statement';
import {
  Badges,
  Body,
  Callout,
  Chevron,
  Description,
  IndexNumber,
  Item,
  ItemHeader,
  LinkedList,
  Node,
  Record,
  RecordDetails,
  RecordLine,
  Statement,
  TitleGroup,
  Toolbar,
} from './styles';
import type { MilestoneView, SignoffRecord } from './types';

const MoveForm = styled(ActionForm)`
  display: flex;
  gap: ${space[2]};
`;

// Hands each result of a small one-button form to the row, which shows it in one place
function ResultReporter({ onResult }: { onResult: (state: NonNullable<ActionState>) => void }) {
  const { state } = useFormStatusState();
  const last = useRef<number | null>(null);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });
  useEffect(() => {
    if (!state || last.current === state.at) return;
    last.current = state.at;
    onResultRef.current(state);
  }, [state]);
  return null;
}

// Reordering never disables the focused button: at either end it says so and does nothing
function MoveButton({ direction, title, atEdge, milestoneId, onPress }: {
  direction: 'up' | 'down';
  title: string;
  atEdge: boolean;
  milestoneId: string;
  onPress: (direction: 'up' | 'down') => void;
}) {
  const { pending } = useFormStatusState();
  const unavailable = atEdge || pending;
  return (
    <IconButton
      type="submit"
      name="direction"
      value={direction}
      id={`move-${direction}-${milestoneId}`}
      aria-label={`Move ${title} ${direction}`}
      aria-disabled={unavailable || undefined}
      onClick={(event) => {
        if (unavailable) {
          event.preventDefault();
          return;
        }
        onPress(direction);
      }}
    >
      {direction === 'up' ? <FiArrowUp aria-hidden="true" /> : <FiArrowDown aria-hidden="true" />}
    </IconButton>
  );
}

function SignoffRecordView({ signoff, studio, recordRef }: { signoff: SignoffRecord; studio: boolean; recordRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <Record ref={recordRef} tabIndex={-1}>
      <RecordLine>
        <FiCheck aria-hidden="true" />
        <span>
          {signoff.source === 'client' ? (
            <>
              Initialled by <strong>{signoff.initials}</strong> ({signoff.signerName}) on <LocalTime value={signoff.signedAt} />
            </>
          ) : (
            <>
              Sign-off recorded by {signoff.signerName} on <LocalTime value={signoff.signedAt} />
            </>
          )}
        </span>
      </RecordLine>
      <Statement>&ldquo;{signoff.statement}&rdquo;</Statement>
      {signoff.note && <MetaText>Note: {signoff.note}</MetaText>}
      {studio && (
        <RecordDetails>
          <summary>
            <FiChevronRight aria-hidden="true" />
            Record details
          </summary>
          <dl>
            <dt>Source</dt>
            <dd>{signoff.source === 'client' ? 'Initialled in the portal' : 'Recorded by the studio'}</dd>
            <dt>Signed in as</dt>
            <dd>{signoff.signerEmail}</dd>
            <dt>IP address</dt>
            <dd>{signoff.ipAddress || 'Not recorded'}</dd>
            <dt>Browser</dt>
            <dd>{signoff.userAgent || 'Not recorded'}</dd>
            <dt>Record</dt>
            <dd>{signoff.id}</dd>
          </dl>
        </RecordDetails>
      )}
    </Record>
  );
}

export interface MilestoneItemProps {
  milestone: MilestoneView;
  index: number;
  total: number;
  projectId: string;
  clientName: string;
  today: string;
  showStudio: boolean;
  previewingAsClient: boolean;
  isClient: boolean;
  dirty: boolean;
  onDirtyChange: (id: string, dirty: boolean) => void;
  onAnnounce: (message: string) => void;
  onDeleteSubmitted: (id: string, title: string) => void;
}

export default function MilestoneItem({
  milestone: m,
  index,
  total,
  projectId,
  clientName,
  today,
  showStudio,
  previewingAsClient,
  isClient,
  dirty,
  onDirtyChange,
  onAnnounce,
  onDeleteSubmitted,
}: MilestoneItemProps) {
  const titleId = useId();
  const editorId = useId();
  const labels = MILESTONE_LABELS[m.status];
  const done = m.status === 'done';
  const waiting = m.status === 'waiting_on_client';
  // Needs initials at some point; they are asked for only once the step waits on the client
  // and any linked review is finished
  const needsSignoff = m.requiresSignoff && !m.signoff;
  const review = m.linked.find((d) => d.status === 'in_review');
  const initialsDue = asksForInitials({ requiresSignoff: m.requiresSignoff, signed: Boolean(m.signoff), status: m.status, reviewPending: Boolean(review) });
  const canSign = isClient && !previewingAsClient;

  // The row's one status line: results land there, and take focus when their button has gone
  const { statusRef, message, error, announce } = useAnnouncer();
  const [editing, setEditing] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);
  // A new key remounts the editor, so it starts from the latest saved values and version
  const [editorKey, setEditorKey] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingAsk, setConfirmingAsk] = useState(false);
  const signDialog = useDialog();
  const recordDialog = useDialog();
  const recordRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const askButtonRef = useRef<HTMLButtonElement>(null);
  const lastMove = useRef<'up' | 'down'>('up');
  // After a sign-off lands, focus moves once to the new record so it is read out in place
  const focusRecordPending = useRef(false);
  const [focusTick, setFocusTick] = useState(0);
  const signoffId = m.signoff?.id;

  // The revalidated row (with the record) can arrive while the dialog is still open, when the
  // record behind it is inert and cannot take focus; wait until the dialog has closed
  const anyDialogOpen = signDialog.open || recordDialog.open;
  useEffect(() => {
    if (!focusRecordPending.current || !signoffId || anyDialogOpen) return;
    focusRecordPending.current = false;
    recordRef.current?.focus();
  }, [focusTick, signoffId, anyDialogOpen]);

  function focusRecordSoon() {
    focusRecordPending.current = true;
    setFocusTick((tick) => tick + 1);
  }

  const report = useCallback((state: NonNullable<ActionState>) => announce(state.message, false, !state.ok), [announce]);
  const setRowDirty = useCallback((value: boolean) => onDirtyChange(m.id, value), [onDirtyChange, m.id]);

  function openEditor() {
    setEditorMounted(true);
    // Edits only collapsed with this toggle are kept; with none, open a fresh editor, since
    // asking for or recording a sign-off may have changed the milestone since it was last open
    if (!editing && !dirty) setEditorKey((key) => key + 1);
    setEditing((open) => !open);
  }

  // "Change the due date first" opens the editor on the due date: on the next frame, once the
  // editor's own effect has put focus on its first field
  const focusDueDate = useRef(false);
  useEffect(() => {
    if (!editing || !focusDueDate.current) return;
    const frame = requestAnimationFrame(() => {
      focusDueDate.current = false;
      document.getElementById(editorId)?.querySelector<HTMLInputElement>('input[name="dueDate"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing, editorId]);

  function closeAsk() {
    setConfirmingAsk(false);
    askButtonRef.current?.focus();
  }

  function closeDelete() {
    setConfirmingDelete(false);
    deleteButtonRef.current?.focus();
  }

  const dueLabel = m.dueDate ? dueInfo(m.dueDate, today) : null;
  const statusLabel = showStudio ? labels.studio : labels.client;
  // A request has gone out before (and not failed): the next one is a reminder
  const asked = waiting && m.requiresSignoff && Boolean(m.signoffRequestedAt);
  // Asking moves the step to Waiting on client, and its date becomes the client's: a date that
  // has already passed would show them as overdue the moment the email lands
  const pastDue = Boolean(m.dueDate && m.dueDate < today);
  const askConfirms = done || (pastDue && !waiting);

  return (
    <Item id={`milestone-${m.id}`} $done={done} aria-labelledby={titleId}>
      <Node aria-hidden="true" $status={m.status} $asking={initialsDue} />
      <Body>
        <ItemHeader>
          <TitleGroup>
            <IndexNumber aria-hidden="true">{indexLabel(index + 1)}</IndexNumber>
            <H3 id={titleId}>
              <VisuallyHidden>
                Milestone {index + 1} of {total}:{' '}
              </VisuallyHidden>
              {m.title}
            </H3>
          </TitleGroup>
          <Badges>
            {dirty && <StatusBadge tone="action">Unsaved changes</StatusBadge>}
            <StatusBadge tone={labels.tone}>{statusLabel}</StatusBadge>
          </Badges>
        </ItemHeader>

        {(m.dueDate || showStudio) && (
          <MetaLine>
            {m.dueDate && dueLabel ? (
              done ? (
                // Finished ahead of time: the date has not passed, so it was not missed
                <span>
                  {m.dueDate < today ? 'Was due' : 'Due'} <DateText value={m.dueDate} />
                </span>
              ) : (
                <DueText value={m.dueDate} today={today} />
              )
            ) : (
              <span>No due date</span>
            )}
            {m.dueDate && dueLabel && !done && dueLabel.tone !== 'later' && <DateText value={m.dueDate} />}
          </MetaLine>
        )}

        {showStudio && editorMounted && (
          <EditMilestoneForm
            key={editorKey}
            id={editorId}
            hidden={!editing}
            milestone={m}
            projectId={projectId}
            clientName={clientName}
            onDirtyChange={setRowDirty}
            onSaved={(text) => {
              setEditing(false);
              announce(text, false);
              editButtonRef.current?.focus();
            }}
            onCancel={() => {
              setEditing(false);
              editButtonRef.current?.focus();
            }}
          />
        )}

        {!(showStudio && editing) && (
          <>
            {m.description && <Description>{m.description}</Description>}
            {m.linked.length > 0 && (
              <LinkedList aria-label={`Deliverables for ${m.title}`}>
                {m.linked.map((d) => {
                  const label = DELIVERABLE_LABELS[d.status];
                  return (
                    <li key={d.id}>
                      <TextLink href={projectHref(projectId, 'deliverables', `deliverable-${d.id}`)}>{d.title}</TextLink>
                      <MetaText>Version {d.version}</MetaText>
                      {label && <StatusBadge tone={label.tone}>{showStudio ? label.studio : label.client}</StatusBadge>}
                    </li>
                  );
                })}
              </LinkedList>
            )}
          </>
        )}

        {m.signoff ? (
          <SignoffRecordView signoff={m.signoff} studio={showStudio} recordRef={recordRef} />
        ) : showStudio ? (
          needsSignoff &&
          (waiting && review ? (
            <Callout $tone="quiet">
              <h4>Waiting on {clientName}&apos;s review</h4>
              <p>
                {clientName} is asked to initial this step once {review.title} is approved.
              </p>
            </Callout>
          ) : waiting ? (
            <Callout $tone="quiet">
              <h4>Waiting for {clientName}&apos;s initials</h4>
              <p>
                {m.signoffRequestedAt ? (
                  <>
                    Emailed <LocalTime value={m.signoffRequestedAt} />. {clientName} sees the request on this page.
                  </>
                ) : (
                  <>Not emailed yet. {clientName} sees the request on this page; use Ask for sign-off to email them a link.</>
                )}
              </p>
            </Callout>
          ) : done ? (
            <Callout $tone="quiet">
              <h4>Done without {clientName}&apos;s initials</h4>
              <p>If you still want them on record, Ask for sign-off moves this step back to Waiting on client and emails {clientName}.</p>
            </Callout>
          ) : (
            <Callout $tone="quiet">
              <h4>Needs {clientName}&apos;s initials when done</h4>
              <p>
                {clientName} isn&apos;t asked yet. When the work is ready, Ask for sign-off emails {clientName} and moves this step to
                Waiting on client.
              </p>
            </Callout>
          ))
        ) : waiting && review ? (
          <Callout>
            <h4>This step is waiting on you</h4>
            <p>
              {needsSignoff
                ? `Once you've approved ${review.title}, you'll be asked to initial this step.`
                : `Once you've reviewed ${review.title}, we can move this on.`}
            </p>
            <div>
              <ButtonLink href={projectHref(projectId, 'deliverables', `deliverable-${review.id}`)} $variant="secondary" $size="sm">
                Go to the review
              </ButtonLink>
            </div>
          </Callout>
        ) : initialsDue ? (
          <Callout>
            <h4>Your sign-off is needed</h4>
            <p>When you&apos;re happy {m.title} is complete, add your initials so we can move on to the next step.</p>
            <div>
              {canSign ? (
                <Button onClick={signDialog.openDialog}>Initial to sign off</Button>
              ) : (
                <ClientOnlyNote>Only {clientName} can initial this.</ClientOnlyNote>
              )}
            </div>
          </Callout>
        ) : waiting ? (
          <Callout>
            <h4>This step is waiting on you</h4>
            <p>
              If you&apos;re not sure what we need from you, <TextLink href={projectHref(projectId, 'messages')}>message us</TextLink>.
            </p>
          </Callout>
        ) : (
          needsSignoff && !done && <MetaText>We&apos;ll ask you to initial this step when it&apos;s ready.</MetaText>
        )}

        {showStudio && (
          <Toolbar>
            <div>
              <Button
                ref={editButtonRef}
                $variant="quiet"
                $size="sm"
                aria-expanded={editing}
                aria-controls={editorMounted ? editorId : undefined}
                onClick={openEditor}
              >
                <FiEdit2 aria-hidden="true" />
                Edit details
                <Chevron $open={editing} aria-hidden="true">
                  <FiChevronDown />
                </Chevron>
              </Button>
              {!m.signoff && (
                <>
                  {/* While a linked review is open the client can't initial yet, so there is
                      nothing to ask for; a finished step asks before it is reopened */}
                  {review ? null : askConfirms ? (
                    <Button
                      ref={askButtonRef}
                      $variant="quiet"
                      $size="sm"
                      aria-expanded={confirmingAsk}
                      onClick={() => setConfirmingAsk((open) => !open)}
                    >
                      <FiSend aria-hidden="true" />
                      Ask for sign-off
                    </Button>
                  ) : (
                    <ActionForm action={askForSignoff}>
                      <ResultReporter onResult={report} />
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="projectId" value={projectId} />
                      <SubmitButton variant="quiet" size="sm" pendingLabel="Sending…">
                        <FiSend aria-hidden="true" />
                        {asked ? `Remind ${clientName}` : 'Ask for sign-off'}
                      </SubmitButton>
                    </ActionForm>
                  )}
                  <Button $variant="quiet" $size="sm" onClick={recordDialog.openDialog}>
                    <FiClipboard aria-hidden="true" />
                    Record sign-off
                  </Button>
                </>
              )}
            </div>
            <div>
              <MoveForm action={moveMilestone}>
                <ResultReporter
                  onResult={(state) => {
                    onAnnounce(state.message);
                    if (!state.ok) announce(state.message, false, true);
                    // The row may have moved in the page; keep focus on the button that moved it
                    requestAnimationFrame(() => document.getElementById(`move-${lastMove.current}-${m.id}`)?.focus());
                  }}
                />
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <MoveButton direction="up" title={m.title} atEdge={index === 0} milestoneId={m.id} onPress={(d) => (lastMove.current = d)} />
                <MoveButton direction="down" title={m.title} atEdge={index === total - 1} milestoneId={m.id} onPress={(d) => (lastMove.current = d)} />
              </MoveForm>
              <Button
                ref={deleteButtonRef}
                $variant="quiet"
                $size="sm"
                aria-expanded={confirmingDelete}
                onClick={() => setConfirmingDelete((open) => !open)}
              >
                <FiTrash2 aria-hidden="true" />
                Delete
              </Button>
            </div>
          </Toolbar>
        )}

        {showStudio && confirmingAsk && (
          <InlineConfirm
            tone="primary"
            size="sm"
            question={`Ask ${clientName} to initial ${m.title}?`}
            detail={
              <>
                This emails {clientName} and moves it {done ? 'back ' : ''}to Waiting on client until it&apos;s initialled.
                {pastDue && m.dueDate && dueLabel && (
                  <>
                    {' '}
                    Its due date, <DateText value={m.dueDate} />, has passed, so {clientName} will see it as {dueLabel.label} as soon
                    as it arrives.{' '}
                    <TextButton
                      type="button"
                      onClick={() => {
                        setConfirmingAsk(false);
                        if (editing) {
                          document.getElementById(editorId)?.querySelector<HTMLInputElement>('input[name="dueDate"]')?.focus();
                        } else {
                          focusDueDate.current = true;
                          openEditor();
                        }
                      }}
                    >
                      Change the due date first
                    </TextButton>
                  </>
                )}
              </>
            }
            action={askForSignoff}
            confirmLabel={`Ask ${clientName}`}
            pendingLabel="Sending…"
            keepLabel={done ? 'Keep it done' : 'Not now'}
            onKeep={closeAsk}
            // Its button changes once the step is waiting again, so the result takes focus
            onSuccess={(state) => {
              setConfirmingAsk(false);
              announce(state.message);
            }}
            hidden={
              <>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="projectId" value={projectId} />
                {done && <input type="hidden" name="confirmReopen" value="on" />}
              </>
            }
          />
        )}

        {showStudio &&
          confirmingDelete &&
          (m.signoff ? (
            <InlineConfirm
              size="sm"
              question={
                <>
                  Can&apos;t delete:{' '}
                  {m.signoff.source === 'client'
                    ? `initialled by ${m.signoff.signerName} on `
                    : `a sign-off was recorded by ${m.signoff.signerName} on `}
                  <DateText value={m.signoff.signedAt.slice(0, 10)} />. Signed records are kept.
                </>
              }
              keepLabel="OK"
              onKeep={closeDelete}
            />
          ) : (
            <InlineConfirm
              size="sm"
              question={`Delete ${m.title}? This can't be undone.`}
              detail={
                m.linked.length > 0
                  ? `${m.linked.map((d) => d.title).join(', ')} ${m.linked.length === 1 ? 'stays' : 'stay'} in Deliverables, no longer linked to a milestone.`
                  : undefined
              }
              action={deleteMilestone}
              confirmLabel="Delete"
              pendingLabel="Deleting…"
              onKeep={closeDelete}
              onSubmit={() => onDeleteSubmitted(m.id, m.title)}
              hidden={
                <>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="projectId" value={projectId} />
                </>
              }
            />
          ))}

        <StatusLine ref={statusRef} message={message} error={error} />
      </Body>

      {/* Mounted whatever the state, so a dialog survives the re-render its own success causes */}
      {canSign && (
        <SignoffDialog
          dialog={signDialog}
          onSigned={(text) => {
            announce(text, false);
            focusRecordSoon();
          }}
          projectId={projectId}
          milestoneId={m.id}
          title={m.title}
          statement={signoffStatement(m.title)}
        />
      )}

      {showStudio && (
        <RecordSignoffDialog
          dialog={recordDialog}
          onRecorded={(text) => {
            announce(text, false);
            focusRecordSoon();
          }}
          projectId={projectId}
          milestoneId={m.id}
          title={m.title}
          clientName={clientName}
        />
      )}
    </Item>
  );
}

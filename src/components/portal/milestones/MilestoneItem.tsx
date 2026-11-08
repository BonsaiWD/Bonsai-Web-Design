'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiArrowDown, FiArrowUp, FiCheck, FiChevronDown, FiChevronRight, FiClipboard, FiEdit2, FiSend, FiTrash2 } from 'react-icons/fi';
import MetaDot from '@/components/common/MetaDot';
import { askForSignoff, deleteMilestone, moveMilestone } from '@/app/portal/_actions/milestones';
import { dueInfo, firstName } from '@/lib/portal-format';
import type { ActionState } from '@/server/portal/actions';
import { MILESTONE_LABELS } from '../labels';
import { projectHref } from '../tabs';
import {
  ActionForm,
  Button,
  ButtonLink,
  DateText,
  DueText,
  FormMessage,
  H3,
  IconButton,
  LocalTime,
  MetaText,
  StatusBadge,
  SubmitButton,
  TextLink,
  space,
  tint,
  type,
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
  InlineConfirm,
  Item,
  ItemHeader,
  LinkedList,
  MetaLine,
  Node,
  Record,
  RecordDetails,
  RecordLine,
  Statement,
  TitleGroup,
  Toolbar,
} from './styles';
import type { MilestoneView, SignoffRecord } from './types';

const RowStatus = styled.p<{ $error: boolean }>`
  ${type.meta}
  color: ${({ $error, theme }) => ($error ? theme.colors.error : theme.colors.text)};

  &:empty {
    display: none;
  }

  &:focus {
    outline: none;
  }
`;

// Asking again on a finished step is a confirmation, not a danger: bronze, not red
const AskConfirm = styled(InlineConfirm)`
  border-color: ${({ theme }) => tint(theme.colors.primary, 40)};
  background: ${({ theme }) => tint(theme.colors.primary, 6)};
`;

const MoveForm = styled(ActionForm)`
  display: flex;
  gap: ${space[2]};
`;

// Doubled class: InlineConfirm's "> div" rule would otherwise centre the lines
const ConfirmText = styled.div`
  && {
    flex-direction: column;
    align-items: flex-start;
    gap: ${space[1]};
    min-width: 0;
  }
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
  const clientFirst = firstName(clientName) ?? clientName;
  const labels = MILESTONE_LABELS[m.status];
  const done = m.status === 'done';
  const waiting = m.status === 'waiting_on_client';
  // Needs initials at some point; they are asked for only once the step waits on the client
  // and any linked review is finished
  const needsSignoff = m.requiresSignoff && !m.signoff;
  const review = m.linked.find((d) => d.status === 'in_review');
  const initialsDue = asksForInitials({ requiresSignoff: m.requiresSignoff, signed: Boolean(m.signoff), status: m.status, reviewPending: Boolean(review) });
  const canSign = isClient && !previewingAsClient;

  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);
  // A new key remounts the editor, so it starts from the latest saved values and version
  const [editorKey, setEditorKey] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingAsk, setConfirmingAsk] = useState(false);
  const [focusStatus, setFocusStatus] = useState(0);
  const [dialogBusy, setDialogBusy] = useState(false);
  const signDialog = useDialog();
  const recordDialog = useDialog();
  const recordRef = useRef<HTMLDivElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  const askButtonRef = useRef<HTMLButtonElement>(null);
  const keepAskRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
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

  useEffect(() => {
    if (confirmingDelete) keepButtonRef.current?.focus();
  }, [confirmingDelete]);

  useEffect(() => {
    if (confirmingAsk) keepAskRef.current?.focus();
  }, [confirmingAsk]);

  // After asking on a finished step its button changes, so the result takes focus instead
  useEffect(() => {
    if (focusStatus > 0) statusRef.current?.focus();
  }, [focusStatus]);

  const report = useCallback((state: NonNullable<ActionState>) => setMessage({ text: state.message, error: !state.ok }), []);
  const setRowDirty = useCallback((value: boolean) => onDirtyChange(m.id, value), [onDirtyChange, m.id]);

  function openEditor() {
    setEditorMounted(true);
    // Edits only collapsed with this toggle are kept; with none, open a fresh editor, since
    // asking for or recording a sign-off may have changed the milestone since it was last open
    if (!editing && !dirty) setEditorKey((key) => key + 1);
    setEditing((open) => !open);
  }

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
                <span>
                  Was due <DateText value={m.dueDate} />
                </span>
              ) : (
                <>
                  <DueText value={m.dueDate} today={today} />
                  {dueLabel.tone !== 'later' && (
                    <>
                      <MetaDot aria-hidden="true" />
                      <DateText value={m.dueDate} />
                    </>
                  )}
                </>
              )
            ) : (
              <span>No due date</span>
            )}
          </MetaLine>
        )}

        {showStudio && editorMounted && (
          <EditMilestoneForm
            key={editorKey}
            id={editorId}
            hidden={!editing}
            milestone={m}
            projectId={projectId}
            clientFirst={clientFirst}
            onDirtyChange={setRowDirty}
            onSaved={(text) => {
              setEditing(false);
              setMessage({ text, error: false });
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
              <h4>Waiting on {clientFirst}&apos;s review</h4>
              <p>
                {clientFirst} is asked to initial this step once {review.title} is approved.
              </p>
            </Callout>
          ) : waiting ? (
            <Callout $tone="quiet">
              <h4>Waiting for {clientFirst}&apos;s initials</h4>
              <p>
                {m.signoffRequestedAt ? (
                  <>
                    Emailed <LocalTime value={m.signoffRequestedAt} />. {clientFirst} sees the request on this page.
                  </>
                ) : (
                  <>Not emailed yet. {clientFirst} sees the request on this page; use Remind {clientFirst} to email them a link.</>
                )}
              </p>
            </Callout>
          ) : done ? (
            <Callout $tone="quiet">
              <h4>Done without {clientFirst}&apos;s initials</h4>
              <p>If you still want them on record, Ask for sign-off moves this step back to Waiting on client and emails {clientFirst}.</p>
            </Callout>
          ) : (
            <Callout $tone="quiet">
              <h4>Needs {clientFirst}&apos;s initials when done</h4>
              <p>
                {clientFirst} isn&apos;t asked yet. When the work is ready, Ask for sign-off emails {clientFirst} and moves this step to
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
                <MetaText>Only {clientName} can initial this.</MetaText>
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
                  {review ? null : done ? (
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
                        {waiting && m.requiresSignoff ? `Remind ${clientFirst}` : 'Ask for sign-off'}
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
                    if (!state.ok) setMessage({ text: state.message, error: true });
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
          <ActionForm
            action={askForSignoff}
            onSuccess={() => {
              setConfirmingAsk(false);
              setFocusStatus((value) => value + 1);
            }}
          >
            <ResultReporter onResult={report} />
            <AskConfirm>
              <ConfirmText>
                <p>
                  Ask {clientFirst} to initial {m.title}?
                </p>
                <MetaText>This emails {clientFirst} and moves it back to Waiting on client until it&apos;s initialled.</MetaText>
              </ConfirmText>
              <div>
                <SubmitButton size="sm" pendingLabel="Sending…">
                  Ask {clientFirst}
                </SubmitButton>
                <Button ref={keepAskRef} $variant="secondary" $size="sm" onClick={closeAsk}>
                  Keep it done
                </Button>
              </div>
            </AskConfirm>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="projectId" value={projectId} />
          </ActionForm>
        )}

        {showStudio && confirmingDelete && (
          m.signoff ? (
            <InlineConfirm>
              <p>
                Can&apos;t delete:{' '}
                {m.signoff.source === 'client'
                  ? `initialled by ${m.signoff.signerName} on `
                  : `a sign-off was recorded by ${m.signoff.signerName} on `}
                <DateText value={m.signoff.signedAt.slice(0, 10)} />. Signed records are kept.
              </p>
              <div>
                <Button ref={keepButtonRef} $variant="secondary" $size="sm" onClick={closeDelete}>
                  OK
                </Button>
              </div>
            </InlineConfirm>
          ) : (
            <ActionForm action={deleteMilestone} onSubmit={() => onDeleteSubmitted(m.id, m.title)}>
              <InlineConfirm>
                <ConfirmText>
                  <p>Delete {m.title}? This can&apos;t be undone.</p>
                  {m.linked.length > 0 && (
                    <MetaText>
                      {m.linked.map((d) => d.title).join(', ')} {m.linked.length === 1 ? 'stays' : 'stay'} in Deliverables, no longer linked to a milestone.
                    </MetaText>
                  )}
                  <FormMessage />
                </ConfirmText>
                <div>
                  <SubmitButton variant="danger" size="sm" pendingLabel="Deleting…">
                    Delete
                  </SubmitButton>
                  <Button ref={keepButtonRef} $variant="secondary" $size="sm" onClick={closeDelete}>
                    Keep
                  </Button>
                </div>
              </InlineConfirm>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="projectId" value={projectId} />
            </ActionForm>
          )
        )}

        <RowStatus ref={statusRef} role="status" aria-live="polite" tabIndex={-1} $error={Boolean(message?.error)}>
          {message?.text ?? ''}
        </RowStatus>
      </Body>

      {/* Mounted whatever the state, so a dialog survives the re-render its own success causes */}
      {canSign && (
        <SignoffDialog
          open={signDialog.open}
          onClose={() => {
            setDialogBusy(false);
            signDialog.closeDialog();
          }}
          onSigned={(text) => {
            setMessage({ text, error: false });
            focusRecordSoon();
            signDialog.closeDialog();
          }}
          onPendingChange={setDialogBusy}
          busy={dialogBusy}
          triggerRef={signDialog.triggerRef}
          projectId={projectId}
          milestoneId={m.id}
          title={m.title}
          statement={signoffStatement(m.title)}
        />
      )}

      {showStudio && (
        <RecordSignoffDialog
          open={recordDialog.open}
          onClose={() => {
            setDialogBusy(false);
            recordDialog.closeDialog();
          }}
          onRecorded={(text) => {
            setMessage({ text, error: false });
            focusRecordSoon();
            recordDialog.closeDialog();
          }}
          onPendingChange={setDialogBusy}
          busy={dialogBusy}
          triggerRef={recordDialog.triggerRef}
          projectId={projectId}
          milestoneId={m.id}
          title={m.title}
          clientName={clientName}
          clientFirst={clientFirst}
        />
      )}
    </Item>
  );
}

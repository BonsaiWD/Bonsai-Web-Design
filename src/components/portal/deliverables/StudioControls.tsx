'use client';

import { useId, useState, type RefObject } from 'react';
import styled from 'styled-components';
import { FiMail, FiPlus, FiSliders } from 'react-icons/fi';
import {
  deleteDeliverable,
  editDeliverable,
  emailClientAgain,
  fixVersionLink,
  recordApproval,
  withdrawVersion,
} from '@/app/portal/_actions/deliverables';
import {
  ActionForm,
  Button,
  Field,
  FormMessage,
  Input,
  LocalTime,
  PHONE,
  Select,
  space,
  SubmitButton,
  Textarea,
  tint,
  type,
  useDialog,
  useField,
  type ActionState,
} from '@/components/portal/ui';
import { linkWarning } from './copy';
import { CardActions, ConfirmAction, FormDialog, sansHeading, type Announce } from './parts';
import { ShareDialog, type ShareContext } from './ShareDialog';
import type { DeliverableView } from './types';

const LastEmailed = styled.span<{ $failed: boolean }>`
  ${type.meta}
  ${type.figures}
  color: ${({ $failed, theme }) => ($failed ? theme.colors.error : theme.colors.textSecondary)};
`;

// The action row sits inside the reminder's form, so "Email again" can be a submit button
// beside the others; the last-emailed note and the result read underneath
const RemindForm = styled(ActionForm)`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
`;

const RemindNote = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
`;

/* ---------- Manage panel ---------- */

const Tools = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 18)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};

  &[hidden] {
    display: none;
  }

  > * + * {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  }
`;

const Tool = styled.div<{ $danger?: boolean }>`
  &[hidden] {
    display: none !important;
  }

  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${space[3]} ${space[6]};
  padding: ${space[4]} ${space[5]};

  > div:first-child {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    flex: 1 1 16rem;
    min-width: 0;
  }

  h5 {
    ${type.label}
    ${sansHeading}
    color: ${({ $danger, theme }) => ($danger ? theme.colors.error : theme.colors.text)};
  }

  p {
    ${type.meta}
    max-width: 52ch;
  }

  @media (max-width: ${PHONE}) {
    padding: ${space[4]};

    > div:last-child,
    > div:last-child button {
      width: 100%;
    }
  }
`;

function FixLinkFields({ saved }: { saved: string | null }) {
  const link = useField('linkUrl', saved);
  const [warning, setWarning] = useState(() => linkWarning(link.defaultValue));
  return (
    <Field
      label="Link to this exact version"
      name="linkUrl"
      saved={saved}
      hint={warning ?? 'Use a link that will not change: a Vercel deployment URL or a Figma version link.'}
    >
      {(control) => (
        <Input
          id={control.id}
          name={control.name}
          type="url"
          inputMode="url"
          defaultValue={control.defaultValue}
          aria-describedby={control.describedBy}
          aria-invalid={control.invalid || undefined}
          onChange={(event) => setWarning(linkWarning(event.target.value))}
          autoComplete="off"
          spellCheck={false}
        />
      )}
    </Field>
  );
}

interface StudioControlsProps {
  deliverable: DeliverableView;
  context: ShareContext;
  announce: Announce;
  statusRef: RefObject<HTMLParagraphElement | null>;
  onDeleted: (message: string) => void;
}

export function StudioControls({ deliverable, context, announce, statusRef, onDeleted }: StudioControlsProps) {
  const share = useDialog();
  const fixLink = useDialog();
  const record = useDialog();
  const edit = useDialog();
  const [manageOpen, setManageOpen] = useState(false);
  const toolsId = useId();

  const current = deliverable.current;
  const open = current && (current.status === 'in_review' || current.status === 'delivered') ? current : null;
  // The version the dialogs and the withdraw step act on. It outlives `open`, so a form whose
  // action just recorded an approval or a withdrawal stays mounted and reports its result.
  const [held, setHeld] = useState(open);
  if (open && open !== held) setHeld(open);
  const target = open ?? held;
  const next = deliverable.latestVersion + 1;
  const studio = deliverable.studio;
  const clientName = context.clientName;

  // Every action lands its message in the card's status line, and focus goes with it
  const landed = (state: NonNullable<ActionState>) => announce(state.message);

  const projectField = <input type="hidden" name="projectId" value={context.projectId} />;
  const versionFields = target && (
    <>
      {projectField}
      <input type="hidden" name="versionId" value={target.id} />
    </>
  );

  // The card disappears with the deliverable, so the view announces the result
  const deleteAndReport = async (state: ActionState, formData: FormData) => {
    const result = await deleteDeliverable(state, formData);
    if (result?.ok) onDeleted(result.message);
    return result;
  };

  const row = (
    <CardActions>
      <div>
        <Button $variant="secondary" onClick={share.openDialog}>
          <FiPlus aria-hidden="true" />
          Share version {next}
        </Button>
        {open && (
          <SubmitButton variant="quiet" pendingLabel="Sending…">
            <FiMail aria-hidden="true" />
            {studio?.lastEmailedAt || studio?.lastEmailFailed ? `Email ${clientName} again` : `Email ${clientName}`}
          </SubmitButton>
        )}
      </div>
      <Button $variant="quiet" aria-expanded={manageOpen} aria-controls={toolsId} onClick={() => setManageOpen((value) => !value)}>
        <FiSliders aria-hidden="true" />
        Manage
      </Button>
    </CardActions>
  );

  return (
    <>
      {open ? (
        <RemindForm action={emailClientAgain}>
          {row}
          <RemindNote>
            <LastEmailed $failed={Boolean(studio?.lastEmailFailed)}>
              {studio?.lastEmailFailed ? (
                `The last email to ${clientName} could not be sent.`
              ) : studio?.lastEmailedAt ? (
                <>
                  {clientName} was last emailed about version {open.version} on <LocalTime value={studio.lastEmailedAt} />.
                </>
              ) : (
                `${clientName} has not been emailed about version ${open.version}.`
              )}
            </LastEmailed>
            <FormMessage />
          </RemindNote>
          {versionFields}
        </RemindForm>
      ) : (
        row
      )}

      <Tools id={toolsId} hidden={!manageOpen}>
        {open && (
          <Tool>
            <div>
              <h5>{open.linkUrl ? 'Fix the link' : 'Add a link'}</h5>
              <p>
                {open.linkUrl
                  ? `Replace a wrong or broken link on version ${open.version}. The version number and its record stay the same.`
                  : `Add a link to version ${open.version} alongside its file.`}
              </p>
            </div>
            <div>
              <Button $variant="secondary" onClick={fixLink.openDialog}>
                {open.linkUrl ? 'Fix link' : 'Add link'}
              </Button>
            </div>
          </Tool>
        )}
        {open?.status === 'in_review' && (
          <Tool>
            <div>
              <h5>Record an approval</h5>
              <p>For when {clientName} approved version {open.version} by email or on a call. You add a note saying how.</p>
            </div>
            <div>
              <Button $variant="secondary" onClick={record.openDialog}>
                Record approval
              </Button>
            </div>
          </Tool>
        )}
        <Tool>
          <div>
            <h5>Edit details</h5>
            <p>Rename it, change the description or link it to a milestone. Shared versions keep the title they were shared with.</p>
          </div>
          <div>
            <Button $variant="secondary" onClick={edit.openDialog}>
              Edit details
            </Button>
          </div>
        </Tool>
        {target && (
          <Tool $danger hidden={!open}>
            <div>
              <h5>Withdraw version {target.version}</h5>
              <p>Takes it back before {clientName} decides: a wrong link, or shared too early. They will no longer see it.</p>
            </div>
            <div>
              <ConfirmAction
                label={`Withdraw version ${target.version}`}
                question={`Withdraw version ${target.version}? ${clientName} will no longer see it.`}
                confirmLabel="Withdraw"
                pendingLabel="Withdrawing…"
                action={withdrawVersion}
                hidden={versionFields}
                onSuccess={landed}
              />
            </div>
          </Tool>
        )}
        <Tool $danger>
          <div>
            <h5>Delete {deliverable.title}</h5>
            {studio?.deleteBlockedBy ? (
              <p>
                Can&apos;t delete: version {studio.deleteBlockedBy.version} was{' '}
                {studio.deleteBlockedBy.status === 'approved' ? 'approved' : 'sent back with changes'}
                {studio.deleteBlockedBy.byName ? ` by ${studio.deleteBlockedBy.byName}` : ''} on{' '}
                <LocalTime value={studio.deleteBlockedBy.at} />. Decided versions are kept on record.
              </p>
            ) : (
              <p>Removes it and every version. Only possible while no version has a decision.</p>
            )}
          </div>
          {!studio?.deleteBlockedBy && (
            <div>
              <ConfirmAction
                label="Delete"
                question={`Delete ${deliverable.title}? This can't be undone.`}
                confirmLabel="Delete"
                pendingLabel="Deleting…"
                action={deleteAndReport}
                hidden={
                  <>
                    {projectField}
                    <input type="hidden" name="deliverableId" value={deliverable.id} />
                  </>
                }
              />
            </div>
          )}
        </Tool>
      </Tools>

      <ShareDialog dialog={share} context={context} deliverable={deliverable} onShared={landed} returnFocusTo={statusRef} />

      {target && (
        <FormDialog
          dialog={fixLink}
          title={`${target.linkUrl ? 'Fix the link on' : 'Add a link to'} version ${target.version}`}
          description={
            target.status === 'in_review'
              ? `If ${clientName} has the approval open, they will be asked to look at the new link first.`
              : 'The version number and its record stay the same.'
          }
          action={fixVersionLink}
          submitLabel="Save link"
          pendingLabel="Saving…"
          onSuccess={landed}
          returnFocusTo={statusRef}
          hidden={versionFields}
        >
          <FixLinkFields saved={target.linkUrl} />
        </FormDialog>
      )}

      {target && (
        <FormDialog
          dialog={record}
          title="Record approval received by email"
          description={`For when ${clientName} approved version ${target.version} of ${target.titleSnapshot} outside the portal. It is recorded as given to the studio, with your note, and ${clientName} gets a copy by email.`}
          action={recordApproval}
          submitLabel="Record approval"
          pendingLabel="Recording…"
          onSuccess={landed}
          returnFocusTo={statusRef}
          hidden={
            <>
              {versionFields}
              <input type="hidden" name="shownLink" value={target.linkUrl ?? ''} />
              <input type="hidden" name="shownFile" value={target.file?.id ?? ''} />
            </>
          }
        >
          <Field
            label="How did they approve?"
            name="note"
            hint={`For example: ${clientName} approved by email on Nov 8 in reply to our message. ${clientName} sees this note.`}
          >
            {(control) => (
              <Textarea
                id={control.id}
                name={control.name}
                defaultValue={control.defaultValue}
                aria-describedby={control.describedBy}
                aria-invalid={control.invalid || undefined}
                rows={4}
                maxLength={2000}
                required
              />
            )}
          </Field>
        </FormDialog>
      )}

      <FormDialog
        dialog={edit}
        title={`Edit ${deliverable.title}`}
        action={editDeliverable}
        submitLabel="Save details"
        pendingLabel="Saving…"
        onSuccess={landed}
          returnFocusTo={statusRef}
        hidden={
          <>
            {projectField}
            <input type="hidden" name="deliverableId" value={deliverable.id} />
          </>
        }
      >
        <Field label="Title" name="title" saved={deliverable.title}>
          {(control) => (
            <Input
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
              maxLength={120}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Description" name="description" optional saved={deliverable.description}>
          {(control) => (
            <Textarea
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
              rows={3}
              maxLength={1000}
            />
          )}
        </Field>
        <Field
          label="Milestone"
          name="milestoneId"
          optional
          saved={deliverable.milestone?.id ?? ''}
          hint="Approving every deliverable on a milestone completes it."
        >
          {(control) => (
            <Select
              // React does not re-apply a changed defaultValue to a select, so a failed submit remounts it
              key={control.defaultValue}
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
            >
              <option value="">No milestone</option>
              {context.milestones.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </FormDialog>
    </>
  );
}

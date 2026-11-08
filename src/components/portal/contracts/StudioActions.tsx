'use client';

import { useId, useState, type RefObject } from 'react';
import styled from 'styled-components';
import { FiMail, FiSliders, FiUpload } from 'react-icons/fi';
import {
  deleteContract,
  editContract,
  emailContractAgain,
  recordContractSignature,
  replaceContractDocument,
  uploadCountersigned,
} from '@/app/portal/_actions/contracts';
import { CardActions, ConfirmAction, FormDialog, sansHeading, type Announce } from '@/components/portal/deliverables/parts';
import {
  ActionForm,
  Button,
  Checkbox,
  Field,
  FormMessage,
  Input,
  LocalTime,
  PHONE,
  space,
  SubmitButton,
  Textarea,
  tint,
  type,
  useDialog,
  type ActionState,
} from '@/components/portal/ui';
import { FreshId } from '../files/parts';
import { UploadField } from '../files/UploadField';
import type { ContractView, UploadLimits } from './types';

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

interface StudioActionsProps {
  projectId: string;
  contract: ContractView;
  clientName: string;
  limits: UploadLimits;
  announce: Announce;
  statusRef: RefObject<HTMLParagraphElement | null>;
  // The card's latest message: when another action lands, the reminder's old result clears
  lastMessage: string;
  onDeleted: (message: string) => void;
}

const limitText = (limits: UploadLimits) => `${Math.round(limits.maxUploadBytes / (1024 * 1024))} MB`;

export function StudioActions({
  projectId,
  contract,
  clientName,
  limits,
  announce,
  statusRef,
  lastMessage,
  onDeleted,
}: StudioActionsProps) {
  const replace = useDialog();
  const record = useDialog();
  const countersign = useDialog();
  const edit = useDialog();
  const [manageOpen, setManageOpen] = useState(false);
  const toolsId = useId();

  const { status, signature } = contract;
  const awaiting = status === 'awaiting';
  const unsigned = status === 'awaiting' || status === 'reference';
  const signed = status === 'signed' || status === 'countersigned';
  const studio = contract.studio;
  const original = contract.original;

  // Every action lands its message in the card's status line, and focus goes with it
  const landed = (state: NonNullable<ActionState>) => announce(state.message);
  const projectField = <input type="hidden" name="projectId" value={projectId} />;
  const contractFields = (
    <>
      {projectField}
      <input type="hidden" name="contractId" value={contract.id} />
    </>
  );

  // The card disappears with the contract, so the view announces the result
  const deleteAndReport = async (state: ActionState, formData: FormData) => {
    const result = await deleteContract(state, formData);
    if (result?.ok) onDeleted(result.message);
    return result;
  };

  const blockedBy = signature ? (
    signature.source === 'client' ? (
      <>
        signed by {signature.byName || clientName} on <LocalTime value={signature.signedAt} />
      </>
    ) : (
      <>
        signature recorded on <LocalTime value={signature.signedAt} />
      </>
    )
  ) : contract.signedCopy ? (
    <>
      {clientName} uploaded a signed copy on <LocalTime value={contract.signedCopy.uploadedAt} />
    </>
  ) : null;

  const row = (
    <CardActions>
      <div>
        {awaiting && (
          <SubmitButton variant="quiet" pendingLabel="Sending…">
            <FiMail aria-hidden="true" />
            Email {clientName} again
          </SubmitButton>
        )}
        {status === 'signed' && (
          <Button $variant="secondary" onClick={countersign.openDialog}>
            <FiUpload aria-hidden="true" />
            Upload countersigned copy
          </Button>
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
      {awaiting ? (
        <RemindForm key={lastMessage} action={emailContractAgain}>
          {row}
          <RemindNote>
            <LastEmailed $failed={Boolean(studio?.lastEmailFailed)}>
              {studio?.lastEmailFailed ? (
                `The last email asking ${clientName} to sign could not be sent.`
              ) : studio?.lastEmailedAt ? (
                <>
                  {clientName} was last emailed about this on <LocalTime value={studio.lastEmailedAt} />.
                </>
              ) : (
                `${clientName} has not been emailed about this yet.`
              )}
            </LastEmailed>
            <FormMessage />
          </RemindNote>
          {contractFields}
        </RemindForm>
      ) : (
        row
      )}

      <Tools id={toolsId} hidden={!manageOpen}>
        {unsigned && original && (
          <Tool>
            <div>
              <h5>Replace the document</h5>
              <p>Upload a new version while nothing is signed. {clientName} sees the new one; the old file stays in the history.</p>
            </div>
            <div>
              <Button $variant="secondary" onClick={replace.openDialog}>
                Replace document
              </Button>
            </div>
          </Tool>
        )}
        {awaiting && original && (
          <Tool>
            <div>
              <h5>Record a signature</h5>
              <p>
                For when {clientName} signed outside the portal, on paper or by email. Add a note saying how, and attach their signed copy
                if you have it.
              </p>
            </div>
            <div>
              <Button $variant="secondary" onClick={record.openDialog}>
                Record signature
              </Button>
            </div>
          </Tool>
        )}
        {status === 'countersigned' && (
          <Tool>
            <div>
              <h5>Upload a newer countersigned copy</h5>
              <p>It becomes the copy {clientName} sees. Earlier ones stay in the history.</p>
            </div>
            <div>
              <Button $variant="secondary" onClick={countersign.openDialog}>
                Upload countersigned copy
              </Button>
            </div>
          </Tool>
        )}
        <Tool>
          <div>
            <h5>Edit details</h5>
            <p>
              Change the title or description.
              {signed ? ' A signature keeps the exact sentence that was signed.' : ' You can also change whether it needs a signature.'}
            </p>
          </div>
          <div>
            <Button $variant="secondary" onClick={edit.openDialog}>
              Edit details
            </Button>
          </div>
        </Tool>
        <Tool $danger>
          <div>
            <h5>Delete {contract.title}</h5>
            {blockedBy ? (
              <p>Can&apos;t delete: {blockedBy}. Signed records are kept.</p>
            ) : (
              <p>Removes it and its files from the portal. Only possible while it is unsigned.</p>
            )}
          </div>
          {!blockedBy && (
            <div>
              <ConfirmAction
                label="Delete"
                question={`Delete ${contract.title}? This can't be undone.`}
                confirmLabel="Delete"
                pendingLabel="Deleting…"
                action={deleteAndReport}
                hidden={contractFields}
              />
            </div>
          )}
        </Tool>
      </Tools>

      {original && (
        <FormDialog
          dialog={replace}
          title={`Replace the document for ${contract.title}`}
          description={`${clientName} will see the new version. ${original.filename} stays in the file history.`}
          action={replaceContractDocument}
          submitLabel="Replace document"
          pendingLabel="Uploading…"
          onSuccess={landed}
          returnFocusTo={statusRef}
          hidden={
            <>
              {contractFields}
              <input type="hidden" name="expectedFileId" value={original.id} />
              <FreshId name="contractFileId" />
            </>
          }
        >
          <UploadField
            label="New version"
            hint={`PDF opens right in the browser. Word files and images work too, up to ${limitText(limits)}.`}
            acceptedExtensions={limits.acceptedExtensions}
            maxUploadBytes={limits.maxUploadBytes}
          />
          <Field label="What changed" name="note" optional hint={`Included in the email to ${clientName}.`}>
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
          <Checkbox name="emailClient" savedChecked>
            Email {clientName} about the new version
          </Checkbox>
        </FormDialog>
      )}

      {original && (
        <FormDialog
          dialog={record}
          title="Record a signature made outside the portal"
          description={`For when ${clientName} signed ${contract.title} on paper or by email. It is recorded as entered by the studio, pinned to ${original.filename}, and ${clientName} gets a copy by email.`}
          action={recordContractSignature}
          submitLabel="Record signature"
          pendingLabel="Recording…"
          onSuccess={landed}
          returnFocusTo={statusRef}
          hidden={
            <>
              {contractFields}
              <input type="hidden" name="shownFileId" value={original.fileId} />
              <FreshId name="contractFileId" />
            </>
          }
        >
          <Field
            label="How did they sign?"
            name="note"
            hint={`For example: ${clientName} signed on paper and emailed the scan on Nov 8. ${clientName} sees this note.`}
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
          <UploadField
            label="Their signed copy"
            optional
            hint={`Attach the signed PDF or scan if you have it, up to ${limitText(limits)}.`}
            acceptedExtensions={limits.acceptedExtensions}
            maxUploadBytes={limits.maxUploadBytes}
          />
        </FormDialog>
      )}

      <FormDialog
        dialog={countersign}
        title={`Upload the countersigned copy of ${contract.title}`}
        description={`The copy signed by both sides. ${clientName} can download it from here.`}
        action={uploadCountersigned}
        submitLabel="Upload countersigned copy"
        pendingLabel="Uploading…"
        onSuccess={landed}
        returnFocusTo={statusRef}
        hidden={
          <>
            {contractFields}
            <FreshId name="contractFileId" />
          </>
        }
      >
        <UploadField
          label="Countersigned copy"
          hint={`The signed PDF, up to ${limitText(limits)}.`}
          acceptedExtensions={limits.acceptedExtensions}
          maxUploadBytes={limits.maxUploadBytes}
        />
        <Field label="Note" name="note" optional hint={`Included in the email to ${clientName}.`}>
          {(control) => (
            <Textarea
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
              rows={2}
              maxLength={1000}
            />
          )}
        </Field>
        <Checkbox name="emailClient" savedChecked>
          Email {clientName} that it is ready
        </Checkbox>
      </FormDialog>

      <FormDialog
        dialog={edit}
        title={`Edit ${contract.title}`}
        action={editContract}
        submitLabel="Save details"
        pendingLabel="Saving…"
        onSuccess={landed}
        returnFocusTo={statusRef}
        hidden={
          <>
            {contractFields}
            {!signed && <input type="hidden" name="signatureEditable" value="on" />}
          </>
        }
      >
        <Field label="Title" name="title" saved={contract.title}>
          {(control) => (
            <Input
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
              maxLength={160}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Description" name="description" optional saved={contract.description}>
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
        {!signed && (
          <Checkbox
            name="requiresSignature"
            savedChecked={contract.requiresSignature}
            hint="Turn this off for documents that are only for their records."
          >
            Ask {clientName} to sign it
          </Checkbox>
        )}
      </FormDialog>
    </>
  );
}

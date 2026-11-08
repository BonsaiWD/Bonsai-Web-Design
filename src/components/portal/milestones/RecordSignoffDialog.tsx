'use client';

import { recordSignoff } from '@/app/portal/_actions/milestones';
import { ActionForm, Button, Dialog, Field, FormActions, FormMessage, FormStack, Notice, Select, SubmitButton, Textarea } from '../ui';
import { RECORD_METHODS } from './labels';
import { FreshFields, PendingReporter } from './formParts';

interface RecordSignoffDialogProps {
  open: boolean;
  onClose: () => void;
  onRecorded: (message: string) => void;
  onPendingChange: (pending: boolean) => void;
  busy: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  projectId: string;
  milestoneId: string;
  title: string;
  clientName: string;
  clientFirst: string;
}

export default function RecordSignoffDialog({
  open,
  onClose,
  onRecorded,
  onPendingChange,
  busy,
  triggerRef,
  projectId,
  milestoneId,
  title,
  clientName,
  clientFirst,
}: RecordSignoffDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      triggerRef={triggerRef}
      title="Record sign-off given by email or phone"
      description={`For when ${clientName} approves ${title} outside the portal. The record names you and says how they confirmed.`}
    >
      <ActionForm action={recordSignoff} onSuccess={(state) => onRecorded(state.message)}>
        <PendingReporter onChange={onPendingChange} />
        <FormStack>
          <FreshFields>
            <Field label="How did they confirm?" name="method" saved="email">
              {({ id, name, describedBy, invalid, defaultValue }) => (
                <Select id={id} name={name} defaultValue={defaultValue} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
                  {RECORD_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="What they said, and when"
              name="note"
              hint={`For example: ${clientFirst} replied to our Nov 7 email saying it's good to go.`}
            >
              {({ id, name, describedBy, invalid, defaultValue }) => (
                <Textarea
                  id={id}
                  name={name}
                  defaultValue={defaultValue}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  maxLength={2000}
                  required
                />
              )}
            </Field>
            <Notice>
              <p>
                This marks {title} done and emails {clientFirst} a copy. Signed records can&apos;t be changed or deleted later.
              </p>
            </Notice>
          </FreshFields>
          <FormActions>
            <SubmitButton pendingLabel="Recording…">Record sign-off</SubmitButton>
            <Button $variant="quiet" onClick={() => !busy && onClose()}>
              Cancel
            </Button>
            <FormMessage />
          </FormActions>
        </FormStack>
        {/* After the fields: the dialog focuses the first input it finds */}
        <input type="hidden" name="id" value={milestoneId} />
        <input type="hidden" name="projectId" value={projectId} />
      </ActionForm>
    </Dialog>
  );
}

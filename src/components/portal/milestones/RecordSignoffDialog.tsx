'use client';

import { recordSignoff } from '@/app/portal/_actions/milestones';
import { Field, FormDialog, Notice, Select, Textarea, type useDialog } from '../ui';
import { RECORD_METHODS } from './labels';

interface RecordSignoffDialogProps {
  dialog: ReturnType<typeof useDialog>;
  onRecorded: (message: string) => void;
  projectId: string;
  milestoneId: string;
  title: string;
  clientName: string;
}

export default function RecordSignoffDialog({ dialog, onRecorded, projectId, milestoneId, title, clientName }: RecordSignoffDialogProps) {
  return (
    <FormDialog
      dialog={dialog}
      title="Record sign-off given by email or phone"
      description={`For when ${clientName} approves ${title} outside the portal. The record names you and says how they confirmed.`}
      action={recordSignoff}
      submitLabel="Record sign-off"
      pendingLabel="Recording…"
      onSuccess={(state) => onRecorded(state.message)}
      hidden={
        <>
          <input type="hidden" name="id" value={milestoneId} />
          <input type="hidden" name="projectId" value={projectId} />
        </>
      }
    >
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
      <Field label="What they said, and when" name="note" hint={`For example: ${clientName} replied to our Nov 7 email saying it's good to go.`}>
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
          This marks {title} done and emails {clientName} a copy. Signed records can&apos;t be changed or deleted later.
        </p>
      </Notice>
    </FormDialog>
  );
}

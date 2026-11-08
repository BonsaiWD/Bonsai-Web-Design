'use client';

import { createContract } from '@/app/portal/_actions/contracts';
import { Checkbox, Field, FormDialog, FormId, Input, Textarea, useDialog, type ActionState } from '@/components/portal/ui';
import { UploadField } from '../files/UploadField';
import type { UploadLimits } from './types';

interface AddContractDialogProps {
  dialog: ReturnType<typeof useDialog>;
  projectId: string;
  clientName: string;
  limits: UploadLimits;
  onAdded: (state: NonNullable<ActionState>) => void;
}

export function AddContractDialog({ dialog, projectId, clientName, limits, onAdded }: AddContractDialogProps) {
  const mb = Math.round(limits.maxUploadBytes / (1024 * 1024));
  return (
    <FormDialog
      dialog={dialog}
      title="Add a contract"
      description={`${clientName} can read and download it here, and sign it in the portal or upload a signed copy.`}
      action={createContract}
      submitLabel="Add contract"
      pendingLabel="Uploading…"
      onSuccess={onAdded}
      hidden={
        <>
          <input type="hidden" name="projectId" value={projectId} />
          <FormId name="contractId" />
          <FormId name="contractFileId" />
        </>
      }
    >
      <Field label="Title" name="title" hint="What the client will see, such as Website design agreement.">
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
      <Field label="Description" name="description" optional>
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
      <UploadField
        label="Document"
        hint={`A PDF is best: it opens right in the browser. Word files and images work too, up to ${mb} MB.`}
        acceptedExtensions={limits.acceptedExtensions}
        maxUploadBytes={limits.maxUploadBytes}
      />
      <Checkbox name="requiresSignature" savedChecked hint="Turn this off for documents that are only for their records, such as a brief.">
        Ask {clientName} to sign it
      </Checkbox>
      <Checkbox name="emailClient" savedChecked>
        Email {clientName} that it is ready
      </Checkbox>
    </FormDialog>
  );
}

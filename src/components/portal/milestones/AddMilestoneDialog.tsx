'use client';

import { useState } from 'react';
import { addMilestone } from '@/app/portal/_actions/milestones';
import { ActionForm, Button, Dialog, FormActions, FormMessage, FormStack, SubmitButton } from '../ui';
import { UnsavedFormGuard } from '../deliverables/parts';
import { FreshFields, PendingReporter } from './formParts';
import MilestoneFields from './MilestoneFields';

const EMPTY = { title: '', description: '', status: 'upcoming', dueDate: '', requiresSignoff: false };

interface AddMilestoneDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: (message: string) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  projectId: string;
  clientFirst: string;
  nextNumber: number;
}

// Rendered only while open, so each opening is a new form with its own id
function AddForm({ projectId, clientFirst, onAdded, onCancel, onPendingChange, busy }: {
  projectId: string;
  clientFirst: string;
  onAdded: (message: string) => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
  busy: boolean;
}) {
  // One id per form instance: a double submit inserts nothing new
  const [formId] = useState(() => crypto.randomUUID());
  return (
    <ActionForm action={addMilestone} onSuccess={(state) => onAdded(state.message)}>
      <PendingReporter onChange={onPendingChange} />
      <UnsavedFormGuard />
      <FormStack>
        <FreshFields>
          <MilestoneFields saved={EMPTY} clientFirst={clientFirst} />
        </FreshFields>
        <FormActions>
          <SubmitButton pendingLabel="Adding…">Add milestone</SubmitButton>
          <Button $variant="quiet" onClick={() => !busy && onCancel()}>
            Cancel
          </Button>
          <FormMessage />
        </FormActions>
      </FormStack>
      {/* After the fields: the dialog focuses the first input it finds */}
      <input type="hidden" name="id" value={formId} />
      <input type="hidden" name="projectId" value={projectId} />
    </ActionForm>
  );
}

export default function AddMilestoneDialog({ open, onClose, onAdded, triggerRef, projectId, clientFirst, nextNumber }: AddMilestoneDialogProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      triggerRef={triggerRef}
      title="Add a milestone"
      description={`It becomes number ${String(nextNumber).padStart(2, '0')}, at the end of the list. You can move it afterwards.`}
    >
      <AddForm projectId={projectId} clientFirst={clientFirst} onAdded={onAdded} onCancel={onClose} onPendingChange={setBusy} busy={busy} />
    </Dialog>
  );
}

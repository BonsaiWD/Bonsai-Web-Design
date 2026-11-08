'use client';

import { addMilestone } from '@/app/portal/_actions/milestones';
import { FormDialog, FormId, type useDialog } from '../ui';
import MilestoneFields from './MilestoneFields';

const EMPTY = { title: '', description: '', status: 'upcoming', dueDate: '', requiresSignoff: false };

interface AddMilestoneDialogProps {
  dialog: ReturnType<typeof useDialog>;
  onAdded: (message: string) => void;
  projectId: string;
  clientFirst: string;
  nextNumber: number;
}

export default function AddMilestoneDialog({ dialog, onAdded, projectId, clientFirst, nextNumber }: AddMilestoneDialogProps) {
  return (
    <FormDialog
      dialog={dialog}
      title="Add a milestone"
      description={`It becomes number ${String(nextNumber).padStart(2, '0')}, at the end of the list. You can move it afterwards.`}
      action={addMilestone}
      submitLabel="Add milestone"
      pendingLabel="Adding…"
      onSuccess={(state) => onAdded(state.message)}
      hidden={
        <>
          {/* A new id each opening: a double submit inserts nothing new */}
          <FormId />
          <input type="hidden" name="projectId" value={projectId} />
        </>
      }
    >
      <MilestoneFields saved={EMPTY} clientFirst={clientFirst} />
    </FormDialog>
  );
}

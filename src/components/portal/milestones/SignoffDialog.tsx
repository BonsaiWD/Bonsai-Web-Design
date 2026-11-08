'use client';

import { signOffMilestone } from '@/app/portal/_actions/milestones';
import { FormDialog, SignStatement, type useDialog } from '../ui';

interface SignoffDialogProps {
  dialog: ReturnType<typeof useDialog>;
  onSigned: (message: string) => void;
  projectId: string;
  milestoneId: string;
  title: string;
  statement: string;
}

export default function SignoffDialog({ dialog, onSigned, projectId, milestoneId, title, statement }: SignoffDialogProps) {
  return (
    <FormDialog
      dialog={dialog}
      title={`Sign off ${title}`}
      description="Your initials tell us this step is complete, so we can move on to the next one."
      action={signOffMilestone}
      submitLabel="Initial and sign off"
      pendingLabel="Signing off…"
      onSuccess={(state) => onSigned(state.message)}
      hidden={
        <>
          <input type="hidden" name="id" value={milestoneId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="shownTitle" value={title} />
        </>
      }
    >
      <SignStatement
        summary={{ lead: 'You are signing off', title }}
        statement={statement}
        signWith="initials"
        noteHint="Anything we should keep in mind for the next step."
      />
    </FormDialog>
  );
}

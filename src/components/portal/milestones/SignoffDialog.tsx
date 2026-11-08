'use client';

import styled from 'styled-components';
import { signOffMilestone } from '@/app/portal/_actions/milestones';
import {
  ActionForm,
  Button,
  Checkbox,
  Dialog,
  Field,
  FormActions,
  FormMessage,
  FormStack,
  Input,
  SubmitButton,
  Textarea,
} from '../ui';
import { FreshFields, PendingReporter } from './formParts';
import { InitialsInput, StatementBox } from './styles';

const Initials = styled(Input)`
  ${InitialsInput}
`;

const ShortTextarea = styled(Textarea)`
  min-height: 5.5rem;
`;

interface SignoffDialogProps {
  open: boolean;
  onClose: () => void;
  onSigned: (message: string) => void;
  onPendingChange: (pending: boolean) => void;
  busy: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  projectId: string;
  milestoneId: string;
  title: string;
  statement: string;
}

export default function SignoffDialog({
  open,
  onClose,
  onSigned,
  onPendingChange,
  busy,
  triggerRef,
  projectId,
  milestoneId,
  title,
  statement,
}: SignoffDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      triggerRef={triggerRef}
      title={`Sign off ${title}`}
      description="Your initials tell us this step is complete. We record them with your name and the time."
    >
      <ActionForm action={signOffMilestone} onSuccess={(state) => onSigned(state.message)}>
        <PendingReporter onChange={onPendingChange} />
        <FormStack>
          <FreshFields>
            <StatementBox>
              <Checkbox name="confirm" required>
                {statement}
              </Checkbox>
            </StatementBox>
            <Field label="Your initials" name="initials" hint="1 to 6 letters, such as JD.">
              {({ id, name, describedBy, invalid, defaultValue }) => (
                <Initials
                  id={id}
                  name={name}
                  defaultValue={defaultValue}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  maxLength={6}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                />
              )}
            </Field>
            <Field label="Note" name="note" optional hint="Anything we should keep in mind for the next step.">
              {({ id, name, describedBy, invalid, defaultValue }) => (
                <ShortTextarea
                  id={id}
                  name={name}
                  defaultValue={defaultValue}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  maxLength={2000}
                />
              )}
            </Field>
          </FreshFields>
          <FormActions>
            <SubmitButton pendingLabel="Signing off…">Initial and sign off</SubmitButton>
            <Button $variant="quiet" onClick={() => !busy && onClose()}>
              Cancel
            </Button>
            <FormMessage />
          </FormActions>
        </FormStack>
        {/* After the fields: the dialog focuses the first input it finds */}
        <input type="hidden" name="id" value={milestoneId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="shownTitle" value={title} />
      </ActionForm>
    </Dialog>
  );
}

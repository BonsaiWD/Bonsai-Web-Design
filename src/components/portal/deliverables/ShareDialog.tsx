'use client';

import { useState, type RefObject } from 'react';
import styled from 'styled-components';
import { FiAlertTriangle } from 'react-icons/fi';
import { shareDeliverable } from '@/app/portal/_actions/deliverables';
import {
  Checkbox,
  Field,
  FieldRow,
  FormDialog,
  Input,
  Select,
  space,
  Textarea,
  tint,
  type,
  useDialog,
  useField,
  type ActionState,
} from '@/components/portal/ui';
import { UploadField } from '../files/UploadField';
import { linkWarning } from './copy';
import type { DeliverableView, MilestoneOption } from './types';

const LINK_HINT =
  'Use a link that will not change: a Vercel deployment URL (not a branch alias), a Figma version link, or upload a PDF.';

// A soft warning beside the link: the studio can still share it
const Warning = styled.p`
  ${type.meta}
  display: flex;
  align-items: flex-start;
  gap: ${space[2]};
  padding: ${space[3]} ${space[4]};
  border-left: 2px solid ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => tint(theme.colors.primary, 8)};
  color: ${({ theme }) => theme.colors.text};

  svg {
    flex-shrink: 0;
    margin-top: 0.2em;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Or = styled.p`
  ${type.meta}
  display: flex;
  align-items: center;
  gap: ${space[3]};

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${({ theme }) => tint(theme.colors.primary, 14)};
  }
`;

export interface ShareContext {
  projectId: string;
  clientName: string;
  milestones: MilestoneOption[];
  acceptedExtensions: string;
  maxUploadBytes: number;
}

function ShareFields({ context, deliverable }: { context: ShareContext; deliverable: DeliverableView | null }) {
  const link = useField('linkUrl');
  const needsField = useField('needsApproval');
  const [warning, setWarning] = useState(() => linkWarning(link.defaultValue));
  const savedNeeds = deliverable ? deliverable.lastNeedsApproval : true;
  const [needsApproval, setNeedsApproval] = useState(() => needsField.defaultChecked(savedNeeds));
  const next = (deliverable?.latestVersion ?? 0) + 1;

  return (
    <>
      {!deliverable && (
        <>
          <Field label="Title" name="title" hint="What the client will see, such as Homepage design.">
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
          <Field label="Description" name="description" optional>
            {(control) => (
              <Input
                id={control.id}
                name={control.name}
                defaultValue={control.defaultValue}
                aria-describedby={control.describedBy}
                aria-invalid={control.invalid || undefined}
                maxLength={1000}
                autoComplete="off"
              />
            )}
          </Field>
        </>
      )}

      {/* A link, a file or both: neither is marked optional, the "or" between them says it */}
      <Field label="Link to this exact version" name="linkUrl" hint={LINK_HINT}>
        {(control) => (
          <Input
            id={control.id}
            name={control.name}
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={control.defaultValue}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            onChange={(event) => setWarning(linkWarning(event.target.value))}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </Field>
      {warning && (
        <Warning role="status">
          <FiAlertTriangle aria-hidden="true" />
          {warning}
        </Warning>
      )}

      <Or>or</Or>

      {/* A file over the limit is cleared as soon as it is chosen: sent, it would be refused
          before the action runs, after a long upload */}
      <UploadField
        label="Upload a file"
        name="file"
        acceptedExtensions={context.acceptedExtensions}
        maxUploadBytes={context.maxUploadBytes}
        hint={`PDF, image, Office file or ZIP, up to ${Math.floor(context.maxUploadBytes / (1024 * 1024))} MB. PDFs and images open in the browser.`}
        tooLargeAdvice="for anything larger, share a link to it above instead."
      />

      <Field label={next > 1 ? 'What changed' : 'Note for the client'} name="note" optional>
        {(control) => (
          <Textarea
            id={control.id}
            name={control.name}
            defaultValue={control.defaultValue}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            rows={3}
            maxLength={4000}
          />
        )}
      </Field>

      <Checkbox
        name="needsApproval"
        savedChecked={savedNeeds}
        onChange={(event) => setNeedsApproval(event.target.checked)}
        hint="Turn this off for files that are only for their records."
      >
        Ask {context.clientName} to approve this version
      </Checkbox>

      <FieldRow>
        <Field
          label="Milestone"
          name="milestoneId"
          optional
          saved={deliverable?.milestone?.id ?? ''}
          hint="Approving every deliverable on a milestone completes it."
        >
          {(control) => (
            <Select
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
        {/* Hidden, not removed, while approval is off: the field still submits empty */}
        <div hidden={!needsApproval}>
          <Field label="Review by" name="reviewBy" optional>
            {(control) => (
              <Input
                id={control.id}
                name={control.name}
                type="date"
                defaultValue={control.defaultValue}
                aria-describedby={control.describedBy}
                aria-invalid={control.invalid || undefined}
              />
            )}
          </Field>
        </div>
      </FieldRow>

      <Checkbox name="emailClient" savedChecked>
        Email {context.clientName} that it is ready
      </Checkbox>
    </>
  );
}

interface ShareDialogProps {
  dialog: ReturnType<typeof useDialog>;
  context: ShareContext;
  // Null to share a new deliverable
  deliverable: DeliverableView | null;
  onShared: (state: NonNullable<ActionState>) => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
}

// Mounted with the form, so every opening gets new ids; a double submit of one opening
// reuses them and the server shares nothing twice
function HiddenFields({ projectId, deliverable }: { projectId: string; deliverable: DeliverableView | null }) {
  const [ids] = useState(() => ({
    deliverableId: deliverable?.id ?? crypto.randomUUID(),
    versionId: crypto.randomUUID(),
  }));
  return (
    <>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="mode" value={deliverable ? 'version' : 'new'} />
      <input type="hidden" name="deliverableId" value={ids.deliverableId} />
      <input type="hidden" name="versionId" value={ids.versionId} />
      <input type="hidden" name="expectedVersion" value={deliverable?.latestVersion ?? 0} />
    </>
  );
}

export function ShareDialog({ dialog, context, deliverable, onShared, returnFocusTo }: ShareDialogProps) {
  const next = (deliverable?.latestVersion ?? 0) + 1;
  return (
    <FormDialog
      dialog={dialog}
      title={deliverable ? `Share version ${next} of ${deliverable.title}` : 'Share a deliverable'}
      description={
        deliverable
          ? `Version ${next} becomes the one ${context.clientName} sees. Earlier versions stay in the record.`
          : `${context.clientName} sees it here with your note, and can approve it or ask for changes.`
      }
      action={shareDeliverable}
      submitLabel={deliverable ? `Share version ${next}` : 'Share deliverable'}
      pendingLabel="Sharing…"
      onSuccess={onShared}
      returnFocusTo={returnFocusTo}
      hidden={<HiddenFields projectId={context.projectId} deliverable={deliverable} />}
    >
      <ShareFields context={context} deliverable={deliverable} />
    </FormDialog>
  );
}

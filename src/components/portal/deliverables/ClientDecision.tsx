'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import styled from 'styled-components';
import { FiCheck, FiEdit3, FiLock } from 'react-icons/fi';
import { approveVersion, requestChanges } from '@/app/portal/_actions/deliverables';
import {
  ActionForm,
  Button,
  Checkbox,
  Field,
  FormActions,
  FormMessage,
  FormStack,
  Input,
  space,
  SubmitButton,
  Textarea,
  tint,
  type,
  useDialog,
  type ActionState,
} from '@/components/portal/ui';
import { approvalStatement, formatBytes, linkHost } from './copy';
import { CardActions, FormDialog, InsetPanel, UnsavedFormGuard, type Announce } from './parts';
import type { VersionView } from './types';

// What exactly is being approved, restated inside the dialog
const Approving = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  padding: ${space[4]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 18)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};

  span {
    ${type.meta}
  }

  strong {
    ${type.label}
    ${type.figures}
    overflow-wrap: anywhere;
  }
`;

const OnlyClient = styled.p`
  ${type.meta}
  display: flex;
  align-items: center;
  gap: ${space[2]};

  svg {
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

function ShownFields({ projectId, version }: { projectId: string; version: VersionView }) {
  return (
    <>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="versionId" value={version.id} />
      {/* What was on screen: if the studio changes the link meanwhile, the decision is refused */}
      <input type="hidden" name="shownLink" value={version.linkUrl ?? ''} />
      <input type="hidden" name="shownFile" value={version.file?.id ?? ''} />
    </>
  );
}

function reviewedSummary(version: VersionView): string {
  const parts = [version.linkUrl ? linkHost(version.linkUrl) : null, version.file ? `${version.file.filename}, ${formatBytes(version.file.sizeBytes)}` : null];
  return parts.filter(Boolean).join(' and ');
}

interface ClientDecisionProps {
  projectId: string;
  version: VersionView;
  // Whose decision this is, by name, for the preview text
  clientName: string;
  // The signed-in person is the project's client; an admin previewing sees static text
  canDecide: boolean;
  milestoneTitle: string | null;
  nextVersion: number;
  // The version is waiting for the client. The forms stay mounted after a decision so their
  // result still arrives, and only the buttons go.
  reviewing: boolean;
  // The card's status line: decisions land their message there, and focus with it
  announce: Announce;
  statusRef: RefObject<HTMLParagraphElement | null>;
}

export function ClientDecision({
  projectId,
  version,
  clientName,
  canDecide,
  milestoneTitle,
  nextVersion,
  reviewing,
  announce,
  statusRef,
}: ClientDecisionProps) {
  const approve = useDialog();
  const [changesOpen, setChangesOpen] = useState(false);
  const panelId = useId();
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const changesButtonRef = useRef<HTMLButtonElement>(null);
  const statement = approvalStatement(version.version, version.titleSnapshot);

  useEffect(() => {
    if (changesOpen) notesRef.current?.focus();
  }, [changesOpen]);

  if (!canDecide) {
    if (!reviewing) return null;
    return (
      <CardActions>
        <OnlyClient>
          <FiLock aria-hidden="true" />
          Only {clientName} can approve this or ask for changes.
        </OnlyClient>
      </CardActions>
    );
  }

  // The buttons that opened the decision are gone once it lands; the message takes focus
  const decided = (state: NonNullable<ActionState>) => announce(state.message);

  return (
    <>
      <CardActions hidden={!reviewing}>
        <div>
          <Button onClick={approve.openDialog}>
            <FiCheck aria-hidden="true" />
            Approve version {version.version}
          </Button>
          <Button
            ref={changesButtonRef}
            $variant="secondary"
            aria-expanded={changesOpen}
            aria-controls={panelId}
            onClick={() => setChangesOpen((open) => !open)}
          >
            <FiEdit3 aria-hidden="true" />
            Request changes
          </Button>
        </div>
      </CardActions>

      <InsetPanel id={panelId} hidden={!changesOpen || !reviewing}>
        <ActionForm
          action={requestChanges}
          onSuccess={(state) => {
            setChangesOpen(false);
            decided(state);
          }}
        >
          {/* Cancel only collapses the notes (they are still there on reopening), so they
              stop guarding the page while hidden */}
          <UnsavedFormGuard active={changesOpen && reviewing} />
          <FormStack>
            <Field
              label="What would you like changed?"
              name="note"
              hint="Be as specific as you like: the page or section, what is not working, and what you would like instead."
            >
              {(control) => (
                <Textarea
                  ref={notesRef}
                  id={control.id}
                  name={control.name}
                  defaultValue={control.defaultValue}
                  aria-describedby={control.describedBy}
                  aria-invalid={control.invalid || undefined}
                  rows={5}
                  maxLength={5000}
                  required
                />
              )}
            </Field>
            <FormActions>
              <SubmitButton pendingLabel="Sending…">Send my notes</SubmitButton>
              <Button
                $variant="quiet"
                onClick={() => {
                  setChangesOpen(false);
                  changesButtonRef.current?.focus();
                }}
              >
                Cancel
              </Button>
              <FormMessage />
            </FormActions>
          </FormStack>
          <ShownFields projectId={projectId} version={version} />
        </ActionForm>
      </InsetPanel>

      <FormDialog
        dialog={approve}
        title={`Approve version ${version.version} of ${version.titleSnapshot}`}
        description={`Approving tells us this version is final, and we move on to ${milestoneTitle ? `the next step after ${milestoneTitle}` : 'the next step'}. If something needs changing, ask for changes instead and we'll share version ${nextVersion}.`}
        action={approveVersion}
        submitLabel={`Approve version ${version.version}`}
        pendingLabel="Approving…"
        onSuccess={decided}
        returnFocusTo={statusRef}
        hidden={<ShownFields projectId={projectId} version={version} />}
      >
        <Approving>
          <span>You are approving</span>
          <strong>
            Version {version.version} of {version.titleSnapshot}
          </strong>
          {reviewedSummary(version) && <span>{reviewedSummary(version)}</span>}
        </Approving>
        <Checkbox name="confirm" required>
          {statement}
        </Checkbox>
        <Field label="Type your full name to sign" name="signedName" hint="We record your name and the date as your sign-off.">
          {(control) => (
            <Input
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
              autoComplete="name"
              maxLength={120}
              required
            />
          )}
        </Field>
        <Field label="Note" name="note" optional>
          {(control) => (
            <Textarea
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
              rows={3}
              maxLength={2000}
            />
          )}
        </Field>
      </FormDialog>
    </>
  );
}

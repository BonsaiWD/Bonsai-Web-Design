'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { updateMilestone } from '@/app/portal/_actions/milestones';
import { ActionForm, Button, FormActions, FormMessage, FormStack, FreshFields, SubmitButton } from '../ui';
import MilestoneFields, { type MilestoneFieldValues } from './MilestoneFields';
import { EditPanel } from './styles';
import type { MilestoneView } from './types';

function savedValues(m: MilestoneView): MilestoneFieldValues {
  return {
    title: m.title,
    description: m.description ?? '',
    status: m.status,
    dueDate: m.dueDate ?? '',
    requiresSignoff: m.requiresSignoff,
  };
}

function differs(form: HTMLFormElement, saved: MilestoneFieldValues): boolean {
  const data = new FormData(form);
  // Line endings differ between the textarea (LF) and older saved text (CRLF)
  const clean = (value: string) => value.replace(/\r\n?/g, '\n').trim();
  const text = (name: string) => clean(String(data.get(name) ?? ''));
  return (
    text('title') !== clean(saved.title) ||
    text('description') !== clean(saved.description) ||
    text('status') !== saved.status ||
    text('dueDate') !== saved.dueDate ||
    (data.get('requiresSignoff') === 'on') !== saved.requiresSignoff
  );
}

// The version the edit started from. Captured once per mount of the fields, so a refresh in
// the background cannot quietly turn a stale edit into a current one.
function VersionInput({ version }: { version: string }) {
  const [base] = useState(version);
  return <input type="hidden" name="version" value={base} />;
}

// Re-checks for unsaved changes whenever the fields are remounted with new values
function DirtyCheck({ onCheck }: { onCheck: (form: HTMLFormElement) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (form) onCheck(form);
  }, [onCheck]);
  return <span ref={ref} hidden />;
}

interface EditMilestoneFormProps {
  id: string;
  hidden: boolean;
  milestone: MilestoneView;
  projectId: string;
  clientFirst: string;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (message: string) => void;
  onCancel: () => void;
}

export default function EditMilestoneForm({ id, hidden, milestone, projectId, clientFirst, onDirtyChange, onSaved, onCancel }: EditMilestoneFormProps) {
  // Bumped on save and cancel: a fresh form drops the last result and any submitted values
  const [generation, setGeneration] = useState(0);
  const [dirty, setDirty] = useState(false);
  const saved = savedValues(milestone);
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  });

  const check = useCallback(
    (form: HTMLFormElement) => {
      const next = differs(form, savedRef.current);
      setDirty(next);
      onDirtyChange(next);
    },
    [onDirtyChange],
  );

  // Moving focus into the editor when it opens, so keyboard users land on the title
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hidden) panelRef.current?.querySelector<HTMLElement>('input:not([type="hidden"])')?.focus();
  }, [hidden]);

  return (
    <EditPanel id={id} ref={panelRef} hidden={hidden}>
      {/* The row tracks edits against the saved values itself (and keeps them while collapsed) */}
      <ActionForm
        key={generation}
        guardUnsaved={false}
        action={updateMilestone}
        aria-label={`Edit ${milestone.title}`}
        onChange={(event) => check(event.currentTarget)}
        onSuccess={(state) => {
          // A fresh form starts from the values just saved, with no leftover message
          setGeneration((value) => value + 1);
          setDirty(false);
          onDirtyChange(false);
          onSaved(state.message);
        }}
      >
        <FormStack>
          <FreshFields saved={String(generation)}>
            <MilestoneFields saved={saved} clientFirst={clientFirst} />
            <VersionInput version={milestone.version} />
            <DirtyCheck onCheck={check} />
          </FreshFields>
          <FormActions>
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
            <Button
              $variant="quiet"
              onClick={() => {
                setGeneration((value) => value + 1);
                setDirty(false);
                onDirtyChange(false);
                onCancel();
              }}
            >
              {dirty ? 'Discard changes' : 'Cancel'}
            </Button>
            <FormMessage />
          </FormActions>
        </FormStack>
        <input type="hidden" name="id" value={milestone.id} />
        <input type="hidden" name="projectId" value={projectId} />
      </ActionForm>
    </EditPanel>
  );
}

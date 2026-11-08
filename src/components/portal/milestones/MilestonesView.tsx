'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiPlus } from 'react-icons/fi';
import { plural } from '@/lib/portal-format';
import { Button, EmptyState, H2, ListPanel, MetaText, PanelHeader, space, Stack, useDialog, useUnsavedChanges, VisuallyHidden } from '../ui';
import AddMilestoneDialog from './AddMilestoneDialog';
import MilestoneItem from './MilestoneItem';
import { Timeline } from './styles';
import Summary from './Summary';
import type { MilestonesPageProps } from './types';

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  min-width: 0;

  h2:focus {
    outline: none;
  }
`;

export default function MilestonesView({
  projectId,
  clientName,
  today,
  milestones,
  showStudio,
  previewingAsClient,
  isClient,
}: MilestonesPageProps) {
  const addDialog = useDialog();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Set when the empty state's button opens the add dialog: that button is gone afterwards
  const addingFirst = useRef(false);

  // Rows with edits not yet saved (open or collapsed); leaving the page with any of them,
  // by reload, tab, breadcrumb or shell link, asks first
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(() => new Set());
  const onDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((current) => {
      if (current.has(id) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  useUnsavedChanges(dirtyIds.size > 0);

  // One polite announcement for list-level changes. The count alternates a trailing space,
  // so the same words said twice ("Moved to 2 of 5.") are still read out.
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 });
  const announce = useCallback((text: string) => setAnnouncement((current) => ({ text, count: current.count + 1 })), []);

  // A deleted row unmounts with its form, so the list notices the row has gone instead
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [focusHeading, setFocusHeading] = useState(0);
  const [seen, setSeen] = useState(milestones);
  if (seen !== milestones) {
    setSeen(milestones);
    if (pendingDelete && !milestones.some((m) => m.id === pendingDelete.id)) {
      setPendingDelete(null);
      setAnnouncement((current) => ({ text: `Deleted ${pendingDelete.title}.`, count: current.count + 1 }));
      setFocusHeading((value) => value + 1);
      if (dirtyIds.has(pendingDelete.id)) {
        const next = new Set(dirtyIds);
        next.delete(pendingDelete.id);
        setDirtyIds(next);
      }
    }
  }
  useEffect(() => {
    if (focusHeading > 0) headingRef.current?.focus();
  }, [focusHeading]);

  const forClient = !showStudio;
  const doneCount = milestones.filter((m) => m.status === 'done').length;

  if (milestones.length === 0 && forClient) {
    return (
      <EmptyState title="Your milestones will appear here">
        Once we&apos;ve planned the project with you, each step from kickoff to launch shows here with its due date, so you can see what&apos;s next and
        what we need from you.
      </EmptyState>
    );
  }

  // One tree whatever the count, so the live region and the add dialog keep their place
  // (and stay open) when the first milestone arrives
  return (
    <Stack $gap={8}>
      {milestones.length > 0 && (
        <Summary projectId={projectId} milestones={milestones} today={today} forClient={forClient} clientName={clientName} />
      )}

      {milestones.length === 0 ? (
        <EmptyState
          title="Plan the project in milestones"
          action={
            <Button
              onClick={(event) => {
                addingFirst.current = true;
                addDialog.openDialog(event);
              }}
            >
              <FiPlus aria-hidden="true" />
              Add the first milestone
            </Button>
          }
        >
          Add the steps from kickoff to launch, each with a due date. {clientName} sees them here and can initial the ones you ask them to sign off.
        </EmptyState>
      ) : (
        <ListPanel aria-labelledby="milestones-heading">
          <PanelHeader>
            <HeaderText>
              <H2 id="milestones-heading" ref={headingRef} tabIndex={-1}>
                Milestones
              </H2>
              <MetaText>
                {plural(milestones.length, 'step')} from kickoff to launch, {doneCount} done
              </MetaText>
            </HeaderText>
            {showStudio && (
              <Button
                onClick={(event) => {
                  addingFirst.current = false;
                  addDialog.openDialog(event);
                }}
              >
                <FiPlus aria-hidden="true" />
                Add milestone
              </Button>
            )}
          </PanelHeader>

          <Timeline>
            {milestones.map((m, index) => (
              <MilestoneItem
                key={m.id}
                milestone={m}
                index={index}
                total={milestones.length}
                projectId={projectId}
                clientName={clientName}
                today={today}
                showStudio={showStudio}
                previewingAsClient={previewingAsClient}
                isClient={isClient}
                dirty={dirtyIds.has(m.id)}
                onDirtyChange={onDirtyChange}
                onAnnounce={announce}
                onDeleteSubmitted={(id, title) => setPendingDelete({ id, title })}
              />
            ))}
          </Timeline>
        </ListPanel>
      )}

      <VisuallyHidden role="status" aria-live="polite">
        {announcement.text}
        {announcement.count % 2 ? '\u00a0' : ''}
      </VisuallyHidden>

      {showStudio && (
        <AddMilestoneDialog
          dialog={addDialog}
          onAdded={(text) => {
            announce(text);
            // The empty state's button has gone; the new list's heading takes focus instead
            if (addingFirst.current) setFocusHeading((value) => value + 1);
            addingFirst.current = false;
          }}
          projectId={projectId}
          clientName={clientName}
          nextNumber={milestones.length + 1}
        />
      )}
    </Stack>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiTrash2 } from 'react-icons/fi';
import { removeProjectFile } from '@/app/portal/_actions/files';
import MetaDot from '@/components/common/MetaDot';
import { formatBytes } from '@/components/portal/deliverables/copy';
import {
  ActionForm,
  Button,
  FormMessage,
  IconButton,
  LocalTime,
  PHONE,
  space,
  SubmitButton,
  tint,
  type,
  type ActionState,
} from '@/components/portal/ui';
import { FileButtons, FileGlyph } from './parts';
import type { ProjectFileView } from './types';

// Name on the left, actions on the right at every width but phones, where they stack below
const Item = styled.li`
  display: flex;
  align-items: center;
  gap: ${space[3]} ${space[5]};
  padding: ${space[5]} ${space[6]};
  scroll-margin-top: ${space[8]};

  /* The removal question takes its own line */
  &[data-asking='true'] {
    flex-wrap: wrap;
  }

  /* Arriving from an email or a dashboard link */
  &:target {
    background: ${({ theme }) => tint(theme.colors.primary, 6)};
  }

  @media (max-width: ${PHONE}) {
    flex-wrap: wrap;
    padding: ${space[4]} ${space[5]};
  }
`;

const Main = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${space[4]};
  flex: 1 1 auto;
  min-width: 0;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  min-width: 0;
  padding-top: 0.1rem;

  > p:first-child {
    ${type.label}
    overflow-wrap: anywhere;
  }
`;

// Size and uploader on one line, the time on the next: the text column beside the actions is
// narrow, and this way no dot is ever left dangling at the end of a wrapped line
const FileMeta = styled.p`
  ${type.meta}
  ${type.figures}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 ${space[3]};

  > [data-break] {
    flex-basis: 100%;
  }
`;

// What the uploader wrote with it, as a quiet quotation under the name
const Note = styled.p`
  ${type.meta}
  margin-top: ${space[1]};
  padding-left: ${space[3]};
  border-left: 2px solid ${({ theme }) => tint(theme.colors.primary, 35)};
  color: ${({ theme }) => theme.colors.text};
  white-space: pre-line;
  overflow-wrap: anywhere;
  max-width: 60ch;
`;

const Actions = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: ${space[2]};

  @media (max-width: ${PHONE}) {
    width: 100%;

    > [role='group'] {
      flex: 1 1 auto;
      width: auto;
    }
  }
`;

// Quiet until hovered, and set apart from Download by a little more space
const RemoveButton = styled(IconButton)`
  margin-left: ${space[1]};
  border-color: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};

  @media (hover: hover) {
    &:hover:not([aria-disabled='true']) {
      color: ${({ theme }) => theme.colors.error};
      border-color: ${({ theme }) => tint(theme.colors.error, 45)};
      background: ${({ theme }) => tint(theme.colors.error, 8)};
    }
  }
`;

const Confirm = styled(ActionForm)`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  flex: 1 1 100%;
  padding: ${space[4]};
  border: 1px solid ${({ theme }) => tint(theme.colors.error, 35)};
  background: ${({ theme }) => tint(theme.colors.error, 6)};

  > p:first-child {
    ${type.body}
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
  }

  > div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space[3]} ${space[4]};
  }
`;

interface FileItemProps {
  projectId: string;
  item: ProjectFileView;
  // Shown under the name: who uploaded it, when the group does not already say
  byline: string | null;
  canRemove: boolean;
  removeQuestion: string;
  onRemoved: (message: string) => void;
}

export function FileItem({ projectId, item, byline, canRemove, removeQuestion, onRemoved }: FileItemProps) {
  const [asking, setAsking] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // Keep takes focus, so Enter never removes by accident; cancelling returns to Remove
  useEffect(() => {
    if (asking) keepRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [asking]);

  // The row disappears with the file, so the page announces the result
  const removeAndReport = async (state: ActionState, formData: FormData) => {
    const result = await removeProjectFile(state, formData);
    if (result?.ok) onRemoved(result.message);
    return result;
  };

  return (
    <Item id={`file-${item.id}`} data-asking={asking}>
      <Main>
        <FileGlyph filename={item.filename} />
        <Body>
          <p>{item.filename}</p>
          <FileMeta>
            <span>{formatBytes(item.sizeBytes)}</span>
            {byline && (
              <>
                <MetaDot aria-hidden="true" />
                <span>{byline}</span>
              </>
            )}
            <span data-break>
              <LocalTime value={item.uploadedAt} />
            </span>
          </FileMeta>
          {item.note && <Note>{item.note}</Note>}
        </Body>
      </Main>

      {!asking && (
        <Actions>
          <FileButtons fileId={item.id} filename={item.filename} previewable={item.previewable} />
          {canRemove && (
            <RemoveButton ref={triggerRef} aria-label={`Remove ${item.filename}`} title="Remove" onClick={() => setAsking(true)}>
              <FiTrash2 aria-hidden="true" />
            </RemoveButton>
          )}
        </Actions>
      )}

      {asking && (
        <Confirm action={removeAndReport}>
          <p>{removeQuestion}</p>
          <div>
            <SubmitButton variant="danger" pendingLabel="Removing…">
              Remove
            </SubmitButton>
            <Button
              ref={keepRef}
              $variant="quiet"
              onClick={() => {
                returnFocus.current = true;
                setAsking(false);
              }}
            >
              Keep
            </Button>
            <FormMessage />
          </div>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="fileId" value={item.id} />
        </Confirm>
      )}
    </Item>
  );
}

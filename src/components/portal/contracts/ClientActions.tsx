'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import styled from 'styled-components';
import { FiEdit3, FiLock, FiUpload } from 'react-icons/fi';
import { signContract, uploadSignedCopy } from '@/app/portal/_actions/contracts';
import { formatBytes } from '@/components/portal/deliverables/copy';
import { CardActions, FormDialog, InsetPanel, type Announce } from '@/components/portal/deliverables/parts';
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
  TextAnchor,
  tint,
  type,
  useDialog,
  VisuallyHidden,
  type ActionState,
} from '@/components/portal/ui';
import { fileHref, FreshId } from '../files/parts';
import { UploadField } from '../files/UploadField';
import { shortSha, signStatement } from './copy';
import type { ContractView, UploadLimits } from './types';

// What exactly is being signed, restated inside the dialog with a way to read it first
const Signing = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  padding: ${space[4]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 18)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};

  > span {
    ${type.meta}
    ${type.figures}
    overflow-wrap: anywhere;
  }

  strong {
    ${type.label}
    overflow-wrap: anywhere;
  }

  a {
    ${type.meta}
    align-self: flex-start;
    margin-top: ${space[1]};
  }
`;

const StatementBox = styled.div`
  padding: ${space[4]} ${space[5]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};
  background: ${({ theme }) => tint(theme.colors.primary, 5)};
  overflow-wrap: anywhere;
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

interface ClientActionsProps {
  projectId: string;
  contract: ContractView;
  clientName: string;
  // The signed-in person is the project's client; an admin previewing sees static text
  canSign: boolean;
  limits: UploadLimits;
  announce: Announce;
  statusRef: RefObject<HTMLParagraphElement | null>;
}

export function ClientActions({ projectId, contract, clientName, canSign, limits, announce, statusRef }: ClientActionsProps) {
  const sign = useDialog();
  const [uploadOpen, setUploadOpen] = useState(false);
  const panelId = useId();
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const awaiting = contract.status === 'awaiting';
  // The dialog acts on the document as it was opened, and stays mounted to report its result
  const [held, setHeld] = useState(contract.original);
  if (contract.original && contract.original !== held && !sign.open) setHeld(contract.original);
  const original = held;

  useEffect(() => {
    if (uploadOpen) panelRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.focus();
  }, [uploadOpen]);

  if (!canSign) {
    if (!awaiting) return null;
    return (
      <CardActions>
        <OnlyClient>
          <FiLock aria-hidden="true" />
          Only {clientName} can sign this or upload a signed copy.
        </OnlyClient>
      </CardActions>
    );
  }

  const landed = (state: NonNullable<ActionState>) => announce(state.message);
  const statement = original ? signStatement(contract.title, original.filename, original.sha256) : '';

  return (
    <>
      <CardActions hidden={!awaiting}>
        <div>
          {original && (
            <Button onClick={sign.openDialog}>
              <FiEdit3 aria-hidden="true" />
              Sign this contract
              <VisuallyHidden>: {contract.title}</VisuallyHidden>
            </Button>
          )}
          <Button
            ref={uploadButtonRef}
            $variant="secondary"
            aria-expanded={uploadOpen}
            aria-controls={panelId}
            onClick={() => setUploadOpen((open) => !open)}
          >
            <FiUpload aria-hidden="true" />
            Upload a signed copy
          </Button>
        </div>
      </CardActions>

      {/* The form mounts on opening, in the browser, so each opening gets its own id */}
      <InsetPanel id={panelId} ref={panelRef} hidden={!uploadOpen || !awaiting}>
        {uploadOpen && (
        <ActionForm
          action={uploadSignedCopy}
          onSuccess={(state) => {
            setUploadOpen(false);
            landed(state);
          }}
        >
          <FormStack>
            <UploadField
              label="Your signed copy"
              hint={`Signed on paper? Upload a scan or photo of the signed pages, or the signed PDF, up to ${Math.round(limits.maxUploadBytes / (1024 * 1024))} MB.`}
              acceptedExtensions={limits.acceptedExtensions}
              maxUploadBytes={limits.maxUploadBytes}
            />
            <Field label="Note" name="note" optional>
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
            <FormActions>
              <SubmitButton pendingLabel="Uploading…">Upload signed copy</SubmitButton>
              <Button
                $variant="quiet"
                onClick={() => {
                  setUploadOpen(false);
                  uploadButtonRef.current?.focus();
                }}
              >
                Cancel
              </Button>
              <FormMessage />
            </FormActions>
          </FormStack>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="contractId" value={contract.id} />
          <FreshId name="contractFileId" />
        </ActionForm>
        )}
      </InsetPanel>

      {original && (
        <FormDialog
          dialog={sign}
          title={`Sign ${contract.title}`}
          description="Read the document first. Signing here records your name, the time and the document's fingerprint, and we email you a receipt."
          action={signContract}
          submitLabel="Sign and agree"
          pendingLabel="Signing…"
          onSuccess={landed}
          returnFocusTo={statusRef}
          hidden={
            <>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="contractId" value={contract.id} />
              {/* What was on screen: if the studio replaces or renames it meanwhile, the signature is refused */}
              <input type="hidden" name="shownFileId" value={original.fileId} />
              <input type="hidden" name="shownTitle" value={contract.title} />
            </>
          }
        >
          <Signing>
            <span>You are signing</span>
            <strong>{original.filename}</strong>
            <span>
              {formatBytes(original.sizeBytes)} · SHA-256 {shortSha(original.sha256)}…
            </span>
            {original.previewable ? (
              <TextAnchor href={fileHref(original.fileId, true)} target="_blank" rel="noopener noreferrer">
                Read it in a new tab
              </TextAnchor>
            ) : (
              <TextAnchor href={fileHref(original.fileId)}>Download it to read</TextAnchor>
            )}
          </Signing>
          <StatementBox>
            <Checkbox name="confirm" required>
              {statement}
            </Checkbox>
          </StatementBox>
          <Field label="Type your full name to sign" name="signedName" hint="We record your name and the time as your signature.">
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
                rows={2}
                maxLength={2000}
              />
            )}
          </Field>
        </FormDialog>
      )}
    </>
  );
}

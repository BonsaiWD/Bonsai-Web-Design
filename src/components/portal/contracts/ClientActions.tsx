'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import styled from 'styled-components';
import { FiEdit3, FiUpload } from 'react-icons/fi';
import { signContract, uploadSignedCopy } from '@/app/portal/_actions/contracts';
import { formatBytes } from '@/components/portal/deliverables/copy';
import { CardActions, InsetPanel } from '@/components/portal/deliverables/parts';
import {
  ActionForm,
  Button,
  ClientOnlyNote,
  Field,
  FormActions,
  FormDialog,
  FormId,
  FormMessage,
  FormStack,
  LocalTime,
  MetaLine,
  Notice,
  SignStatement,
  space,
  SubmitButton,
  Text,
  TextAnchor,
  Textarea,
  type,
  useDialog,
  VisuallyHidden,
  type ActionState,
  type Announce,
} from '@/components/portal/ui';
import { fileHref } from '../files/parts';
import { UploadField } from '../files/UploadField';
import { shortSha, signStatement, wasReplaced } from './copy';
import type { ContractView, UploadLimits } from './types';

// The filename the copy should be of
const Version = styled.strong`
  ${type.label}
  ${type.figures}
  overflow-wrap: anywhere;
`;

const PanelNotice = styled.div`
  margin-bottom: ${space[5]};
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
  // The document on screen when the upload opened: a copy of a version replaced since is refused
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  // The studio replaced the document while the panel was open (the refusal refreshes the card)
  const [replacedWhileOpen, setReplacedWhileOpen] = useState(false);
  const panelId = useId();
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const awaiting = contract.status === 'awaiting';
  // The dialog acts on the document as it was opened, and stays mounted to report its result
  const [held, setHeld] = useState(contract.original);
  if (contract.original && contract.original !== held && !sign.open) setHeld(contract.original);
  const original = held;
  // The open panel follows the document now on the card, with a fresh form and a word on why
  const current = contract.original;
  if (uploadOpen && uploadFor && current && current.fileId !== uploadFor) {
    setUploadFor(current.fileId);
    setReplacedWhileOpen(true);
  }

  useEffect(() => {
    if (uploadOpen) panelRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.focus();
  }, [uploadOpen, uploadFor]);

  if (!canSign) {
    if (!awaiting) return null;
    return (
      <CardActions>
        <ClientOnlyNote>
          Only {clientName} can sign this or upload a signed copy.
        </ClientOnlyNote>
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
          {original && (
            <Button
              ref={uploadButtonRef}
              $variant="secondary"
              aria-expanded={uploadOpen}
              aria-controls={panelId}
              onClick={() => {
                setUploadFor(original.fileId);
                setReplacedWhileOpen(false);
                setUploadOpen((open) => !open);
              }}
            >
              <FiUpload aria-hidden="true" />
              Upload a signed copy
            </Button>
          )}
        </div>
      </CardActions>

      {/* The form mounts on opening, in the browser, so each opening (and each new version of
          the document) gets its own id and a clear file control */}
      <InsetPanel id={panelId} ref={panelRef} hidden={!uploadOpen || !awaiting}>
        {/* Mounted with the panel, so the notice is announced when the document changes */}
        <div role="status">
          {uploadOpen && replacedWhileOpen && current && (
            <PanelNotice>
              <Notice>
                We replaced this document with a new version, {current.filename}, since you opened this. Download it from the card, sign
                it, then upload your signed copy of the new version here.
              </Notice>
            </PanelNotice>
          )}
        </div>
        {uploadOpen && uploadFor && current && (
          <ActionForm
            key={uploadFor}
            action={uploadSignedCopy}
            onSuccess={(state) => {
              setUploadOpen(false);
              landed(state);
            }}
          >
            <FormStack>
              {!replacedWhileOpen && (
                <Text>
                  Upload your signed copy of <Version>{current.filename}</Version>
                  {wasReplaced(contract) ? (
                    <>
                      , the version we added on <LocalTime value={current.uploadedAt} />. If you printed the document before then, print
                      this version and sign it instead.
                    </>
                  ) : (
                    '.'
                  )}
                </Text>
              )}
              <UploadField
                label="Your signed copy"
                hint={`A scan or photo of the signed pages, or the signed PDF, up to ${Math.round(limits.maxUploadBytes / (1024 * 1024))} MB.`}
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
            <input type="hidden" name="shownFileId" value={uploadFor} />
            <FormId name="contractFileId" />
          </ActionForm>
        )}
      </InsetPanel>

      {original && (
        <FormDialog
          dialog={sign}
          title={`Sign ${contract.title}`}
          description="Read the document first. Your signature is kept with the document's fingerprint, so the record shows exactly what you signed."
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
          <SignStatement
            summary={{
              lead: 'You are signing',
              title: original.filename,
              details: (
                <>
                  <MetaLine>
                    {formatBytes(original.sizeBytes)}
                    {`Fingerprint ${shortSha(original.sha256)}…`}
                  </MetaLine>
                  {original.previewable ? (
                    <TextAnchor href={fileHref(original.fileId, true)} target="_blank" rel="noopener noreferrer">
                      Read it in a new tab
                    </TextAnchor>
                  ) : (
                    <TextAnchor href={fileHref(original.fileId)}>Download it to read</TextAnchor>
                  )}
                </>
              ),
            }}
            statement={statement}
            signWith="name"
          />
        </FormDialog>
      )}
    </>
  );
}

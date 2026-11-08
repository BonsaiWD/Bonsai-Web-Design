'use client';

import type { ReactNode } from 'react';
import styled from 'styled-components';
import { FiCheck, FiUpload } from 'react-icons/fi';
import { formatBytes } from '@/components/portal/deliverables/copy';
import { Disclosure, DisclosureSummary, MetaLine, NoteBlock } from '@/components/portal/deliverables/parts';
import { LocalTime, PHONE, space, TextAnchor, tint, type, VisuallyHidden } from '@/components/portal/ui';
import { fileHref } from '../files/parts';
import { fileLabel } from './copy';
import type { ContractFileView, ContractView, Perspective } from './types';

/* ---------- The signature on a contract ---------- */

const Record = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: ${space[3]} ${space[4]};
  padding: ${space[4]} ${space[5]};
  background: ${({ theme }) => tint(theme.colors.primary, 6)};

  > svg {
    margin-top: 0.2em;
    font-size: 1.125rem;
    color: ${({ theme }) => theme.colors.primary};
  }

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[3]};
    min-width: 0;
  }

  @media (max-width: ${PHONE}) {
    padding: ${space[4]};
  }
`;

const RecordLine = styled.p`
  ${type.body}
  ${type.figures}
  color: ${({ theme }) => theme.colors.text};
`;

// Label and value side by side on wide screens, stacked on phones
const RecordList = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
  gap: ${space[2]} ${space[5]};
  margin: ${space[3]} 0 0;
  padding-bottom: ${space[2]};

  dt {
    ${type.meta}
  }

  dd {
    ${type.meta}
    ${type.figures}
    margin: 0;
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  @media (max-width: ${PHONE}) {
    grid-template-columns: minmax(0, 1fr);
    gap: ${space[1]};

    dd + dt {
      margin-top: ${space[2]};
    }
  }
`;

function Entry({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '' || children === false) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function SignatureRecord({
  contract,
  perspective,
  clientName,
}: {
  contract: ContractView;
  perspective: Perspective;
  clientName: string;
}) {
  const studio = perspective === 'studio';
  const signature = contract.signature;

  // Signed on paper and uploaded, with no portal signature
  if (!signature) {
    const copy = contract.signedCopy;
    if (!copy || !contract.requiresSignature) return null;
    return (
      <Record>
        <FiUpload aria-hidden="true" />
        <div>
          <RecordLine>
            {studio ? `${clientName} uploaded a signed copy on ` : 'You uploaded a signed copy on '}
            <LocalTime value={copy.uploadedAt} />
          </RecordLine>
        </div>
      </Record>
    );
  }

  const byClient = signature.source === 'client';
  const who = signature.byName || clientName;
  return (
    <Record>
      <FiCheck aria-hidden="true" />
      <div>
        {byClient ? (
          <>
            <RecordLine>
              Signed by {studio ? who : 'you'} on <LocalTime value={signature.signedAt} />
            </RecordLine>
            <MetaLine>
              {signature.signedName && <>Signed as “{signature.signedName}”</>}
              {studio && signature.signerEmail}
            </MetaLine>
          </>
        ) : (
          <>
            <RecordLine>
              Signature recorded by {studio && signature.byName ? signature.byName : 'the studio'} on{' '}
              <LocalTime value={signature.signedAt} />
            </RecordLine>
            <MetaLine>Signed outside the portal</MetaLine>
          </>
        )}
        {signature.note && (
          <NoteBlock>
            <h5>{byClient ? (studio ? 'Their note' : 'Your note') : 'How it was signed'}</h5>
            <p>{signature.note}</p>
          </NoteBlock>
        )}
        <Disclosure>
          <DisclosureSummary>Signature record</DisclosureSummary>
          <RecordList>
            <Entry label="Statement">{signature.statement}</Entry>
            <Entry label="Signed name">{signature.signedName}</Entry>
            <Entry label="Signed">
              <LocalTime value={signature.signedAt} />
              {byClient ? ', in the portal' : ', recorded by the studio'}
            </Entry>
            <Entry label="Document">{signature.filename}</Entry>
            <Entry label="SHA-256">{signature.sha256}</Entry>
            <Entry label="Email">{signature.signerEmail}</Entry>
            <Entry label="IP address">{signature.ipAddress}</Entry>
            <Entry label="Browser">{signature.userAgent}</Entry>
          </RecordList>
        </Disclosure>
      </div>
    </Record>
  );
}

/* ---------- Every file the contract has had ---------- */

const HistoryList = styled.ol`
  list-style: none;
  margin: ${space[3]} 0 0;
  padding: 0;

  > li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: ${space[1]};
    padding: ${space[3]} 0;
  }

  > li + li {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }
`;

const HistoryTitle = styled.p`
  ${type.label}
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 ${space[2]};

  span {
    ${type.meta}
  }
`;

// The filename is the download link, tall enough to tap
const FileLink = styled(TextAnchor)`
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  ${type.meta}
  ${type.figures}
  font-weight: 500;
  color: ${({ theme }) => theme.colors.primary};
  overflow-wrap: anywhere;
`;

function uploader(entry: ContractFileView, perspective: Perspective, clientName: string): string {
  if (perspective === 'studio') return entry.uploadedByName || (entry.side === 'studio' ? 'the studio' : clientName);
  return entry.side === 'studio' ? 'the studio' : 'you';
}

function stateOf(entry: ContractFileView, contract: ContractView): string | null {
  if (entry.label !== 'original') return null;
  if (entry.current) return contract.signature?.fileId === entry.fileId ? 'Signed version' : 'Current version';
  return 'Replaced';
}

export function FileHistory({
  contract,
  perspective,
  clientName,
}: {
  contract: ContractView;
  perspective: Perspective;
  clientName: string;
}) {
  const files = contract.files;
  if (files.length === 0) return null;
  return (
    <Disclosure>
      <DisclosureSummary count={files.length === 1 ? '1 file' : `${files.length} files`}>File history</DisclosureSummary>
      <HistoryList>
        {files.map((entry) => {
          const state = stateOf(entry, contract);
          return (
            <li key={entry.id}>
              <HistoryTitle>
                {fileLabel(entry.label, perspective, contract.requiresSignature)}
                {state && <span>{state}</span>}
              </HistoryTitle>
              <FileLink href={fileHref(entry.fileId)}>
                <VisuallyHidden>Download </VisuallyHidden>
                {entry.filename}
              </FileLink>
              <MetaLine stackOnPhone>
                <>
                  Uploaded by {uploader(entry, perspective, clientName)} on <LocalTime value={entry.uploadedAt} />
                </>
                {formatBytes(entry.sizeBytes)}
              </MetaLine>
            </li>
          );
        })}
      </HistoryList>
    </Disclosure>
  );
}

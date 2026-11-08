'use client';

import styled from 'styled-components';
import MetaDot from '@/components/common/MetaDot';
import { formatBytes } from '@/components/portal/deliverables/copy';
import { LocalTime, PHONE, space, tint, type } from '@/components/portal/ui';
import { FileButtons, FileGlyph } from '../files/parts';
import { fileLabel, shortSha } from './copy';
import type { ContractFileView, ContractView, Perspective } from './types';

// The documents that matter now, one ruled row each: the agreement, then the signed copies
const Plate = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 20)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};

  > * + * {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  }
`;

const DocRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[3]} ${space[4]};
  padding: ${space[4]} ${space[5]};

  > div:first-child {
    display: flex;
    align-items: center;
    gap: ${space[4]};
    flex: 1 1 18rem;
    min-width: 0;
  }

  @media (max-width: ${PHONE}) {
    padding: ${space[4]};
  }
`;

const Kind = styled.span`
  ${type.overline}
`;

const Body = styled.span`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  min-width: 0;

  strong {
    ${type.label}
    overflow-wrap: anywhere;
  }

  small {
    ${type.meta}
    ${type.figures}
    overflow-wrap: anywhere;
  }

  /* On phones the second fact takes its own line instead of leaving a dot at a line end */
  @media (max-width: ${PHONE}) {
    small [data-break] {
      display: block;
    }

    small [data-dot] {
      display: none;
    }
  }
`;

// Inline in running meta text, so it sits on the text's midline
const Dot = styled(MetaDot)`
  margin: 0 ${space[1]};
`;

const Nowrap = styled.span`
  white-space: nowrap;
`;

// The short fingerprint, with the full one on hover; the record lists it in full
const Sha = styled.abbr`
  text-decoration: none;
  letter-spacing: 0.02em;
`;

function detail(entry: ContractFileView, perspective: Perspective) {
  const size = formatBytes(entry.sizeBytes);
  if (entry.label === 'original') {
    return (
      <>
        {size} <Dot aria-hidden="true" data-dot />{' '}
        <Nowrap data-break>
          {/* The studio reads the algorithm's name; the client, what it is for */}
          {perspective === 'studio' ? 'SHA-256' : 'Fingerprint'} <Sha title={entry.sha256}>{shortSha(entry.sha256)}…</Sha>
        </Nowrap>
      </>
    );
  }
  const who = perspective === 'studio' && entry.uploadedByName ? ` by ${entry.uploadedByName}` : '';
  return (
    <>
      {size} <Dot aria-hidden="true" data-dot />{' '}
      <span data-break>
        Added <LocalTime value={entry.uploadedAt} />
        {who}
      </span>
    </>
  );
}

export function DocumentPlate({ contract, perspective }: { contract: ContractView; perspective: Perspective }) {
  const entries = [contract.original, contract.signedCopy, contract.countersigned].filter((entry): entry is ContractFileView =>
    Boolean(entry),
  );
  if (entries.length === 0) return null;
  return (
    <Plate>
      {entries.map((entry) => (
        <DocRow key={entry.id}>
          <div>
            <FileGlyph filename={entry.filename} />
            <Body>
              <Kind>{fileLabel(entry.label, perspective, contract.requiresSignature)}</Kind>
              <strong>{entry.filename}</strong>
              <small>{detail(entry, perspective)}</small>
            </Body>
          </div>
          <FileButtons fileId={entry.fileId} filename={entry.filename} previewable={entry.previewable} />
        </DocRow>
      ))}
    </Plate>
  );
}

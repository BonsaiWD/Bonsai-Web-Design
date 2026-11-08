'use client';

import styled from 'styled-components';
import { FiCheck, FiMessageSquare } from 'react-icons/fi';
import { DateText, LocalTime, PHONE, space, StatusBadge, TextAnchor, tint, type, VisuallyHidden } from '@/components/portal/ui';
import { Disclosure, DisclosureSummary, MetaLine, NoteBlock } from './parts';
import { versionLabel } from './labels';
import { formatBytes } from './copy';
import { fileHref } from './VersionContent';
import type { Perspective, VersionView } from './types';

/* ---------- The decision on a version ---------- */

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

export function DecisionRecord({ version, perspective }: { version: VersionView; perspective: Perspective }) {
  const decision = version.decision;
  if (!decision) return null;
  const studio = perspective === 'studio';
  const who = decision.byName || 'the client';

  if (version.status === 'changes_requested') {
    return (
      <Record>
        <FiMessageSquare aria-hidden="true" />
        <div>
          <RecordLine>
            {studio ? `${who} asked for changes on ` : 'You asked for changes on '}
            <LocalTime value={decision.at} />
          </RecordLine>
          {decision.note && (
            <NoteBlock>
              <h5>{studio ? 'Their notes' : 'Your notes'}</h5>
              <p>{decision.note}</p>
            </NoteBlock>
          )}
        </div>
      </Record>
    );
  }

  return (
    <Record>
      <FiCheck aria-hidden="true" />
      <div>
        {decision.source === 'client' ? (
          <>
            <RecordLine>
              Approved by {who} on <LocalTime value={decision.at} />
            </RecordLine>
            <MetaLine>
              {decision.signedName && <>Signed as “{decision.signedName}”</>}
              {studio && decision.signerEmail}
            </MetaLine>
          </>
        ) : (
          <>
            <RecordLine>
              Approval recorded by {who} on <LocalTime value={decision.at} />
            </RecordLine>
            <MetaLine>Given outside the portal</MetaLine>
          </>
        )}
        {decision.note && (
          <NoteBlock>
            <h5>{decision.source === 'studio' ? 'How it was approved' : 'Note'}</h5>
            <p>{decision.note}</p>
          </NoteBlock>
        )}
      </div>
    </Record>
  );
}

/* ---------- Earlier versions, as the client sees them ---------- */

const VersionList = styled.ol`
  list-style: none;
  margin: ${space[3]} 0 0;
  padding: 0;

  > li {
    display: flex;
    flex-direction: column;
    gap: ${space[2]};
    padding: ${space[4]} 0;
  }

  > li + li {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }
`;

const VersionTitle = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[2]} ${space[4]};

  strong {
    ${type.label}
    ${type.figures}
  }
`;

function clientEarlierLabel(version: VersionView): string {
  if (version.status === 'superseded') return version.replacedBy ? `Replaced by version ${version.replacedBy}` : 'Replaced';
  if (version.status === 'changes_requested') return 'You asked for changes';
  return versionLabel(version.status, 'client').label;
}

export function EarlierVersions({ versions }: { versions: VersionView[] }) {
  if (versions.length === 0) return null;
  return (
    <Disclosure>
      <DisclosureSummary count={versions.length === 1 ? '1 version' : `${versions.length} versions`}>Earlier versions</DisclosureSummary>
      <VersionList>
        {versions.map((version) => (
          <li key={version.id}>
            <VersionTitle>
              <strong>Version {version.version}</strong>
              <StatusBadge tone={version.status === 'approved' || version.status === 'delivered' ? 'done' : 'muted'}>
                {clientEarlierLabel(version)}
              </StatusBadge>
            </VersionTitle>
            <MetaLine>
              <>
                Shared <LocalTime value={version.sharedAt} />
              </>
              {version.decision && version.status === 'approved' && (
                <>
                  Approved <LocalTime value={version.decision.at} />
                </>
              )}
              {version.decision && version.status === 'changes_requested' && (
                <>
                  Notes sent <LocalTime value={version.decision.at} />
                </>
              )}
            </MetaLine>
            {version.status === 'changes_requested' && version.decision?.note && (
              <NoteBlock>
                <h5>Your notes</h5>
                <p>{version.decision.note}</p>
              </NoteBlock>
            )}
          </li>
        ))}
      </VersionList>
    </Disclosure>
  );
}

/* ---------- The full record, for the studio ---------- */

// Label and value side by side on wide screens, stacked on phones; values read left to right
const RecordList = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
  gap: ${space[2]} ${space[5]};
  margin: 0;

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

function Entry({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === '' || children === false) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function VersionHistory({ versions, currentId }: { versions: VersionView[]; currentId: string | null }) {
  if (versions.length === 0) return null;
  return (
    <Disclosure>
      <DisclosureSummary count={versions.length === 1 ? '1 version' : `${versions.length} versions`}>Version history</DisclosureSummary>
      <VersionList>
        {versions.map((version) => {
          const { label, tone } = versionLabel(version.status, 'studio');
          const decision = version.decision;
          return (
            <li key={version.id}>
              <VersionTitle>
                <strong>
                  Version {version.version}
                  {version.id === currentId && <VisuallyHidden> (current)</VisuallyHidden>}
                </strong>
                <StatusBadge tone={tone}>
                  {version.status === 'superseded' && version.replacedBy ? `Superseded by version ${version.replacedBy}` : label}
                </StatusBadge>
              </VersionTitle>
              <RecordList>
                <Entry label="Shared">
                  <LocalTime value={version.sharedAt} />
                  {version.sharedByName ? ` by ${version.sharedByName}` : ''}
                </Entry>
                <Entry label="Shared as">{version.titleSnapshot}</Entry>
                <Entry label="Link">
                  {version.linkUrl && (
                    <TextAnchor href={version.linkUrl} target="_blank" rel="noopener noreferrer">
                      {version.linkUrl}
                      <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
                    </TextAnchor>
                  )}
                </Entry>
                <Entry label="File">
                  {version.file && (
                    <TextAnchor href={fileHref(version.file.id)}>
                      {version.file.filename} ({formatBytes(version.file.sizeBytes)})
                    </TextAnchor>
                  )}
                </Entry>
                <Entry label="Approval">{version.needsApproval ? 'Asked for approval' : 'No approval needed'}</Entry>
                <Entry label="Review by">{version.reviewBy && <DateText value={version.reviewBy} />}</Entry>
                <Entry label="Note to client">{version.note}</Entry>
                {decision && (
                  <>
                    <Entry label="Decided">
                      <LocalTime value={decision.at} />
                      {decision.byName ? ` by ${decision.byName}` : ''}
                      {decision.source === 'studio' ? ', recorded by the studio' : ', in the portal'}
                    </Entry>
                    <Entry label="Signed name">{decision.signedName}</Entry>
                    <Entry label="Email">{decision.signerEmail}</Entry>
                    <Entry label="Statement">{decision.statement}</Entry>
                    <Entry label={version.status === 'changes_requested' ? 'Requested changes' : 'Decision note'}>{decision.note}</Entry>
                    <Entry label="IP address">{decision.ipAddress}</Entry>
                    <Entry label="Browser">{decision.userAgent}</Entry>
                  </>
                )}
              </RecordList>
            </li>
          );
        })}
      </VersionList>
    </Disclosure>
  );
}

'use client';

import styled from 'styled-components';
import { FiPlus } from 'react-icons/fi';
import {
  Button,
  DataList,
  EmptyState,
  Eyebrow,
  H2,
  H3,
  Meta,
  Panel,
  sansHeading,
  SectionHeader,
  space,
  Split,
  Stack,
  StatusLine,
  tint,
  type,
  useAnnouncer,
  useDialog,
} from '@/components/portal/ui';
import { AddContractDialog } from './AddContractDialog';
import { ContractCard } from './ContractCard';
import { GROUP_ORDER, GROUP_TITLES } from './labels';
import type { ContractStatus, ContractView, Perspective, UploadLimits } from './types';

// One column of headings and cards as siblings, so a card keeps its state (an open form, its
// status message) when signing moves it to another group
const CardColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[4]};
  min-width: 0;
`;

const GroupTitle = styled(Eyebrow).attrs({ as: 'h3' })`
  ${sansHeading}
  ${type.figures}
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: ${space[3]};

  &:not(:first-child) {
    margin-top: ${space[6]};
  }

  /* A hairline running out from the label, as the site's index rows do */
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, ${({ theme }) => tint(theme.colors.primary, 40)}, transparent);
  }
`;

const ViewStatus = styled(StatusLine)`
  margin-bottom: ${space[6]};
`;

const Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  min-width: 0;
`;

const Steps = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${space[5]};

  li {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: ${space[1]} ${space[3]};
  }

  li > span {
    ${type.overline}
    ${type.figures}
    grid-row: span 2;
    padding-top: 0.1rem;
  }

  strong {
    ${type.label}
  }

  p {
    ${type.meta}
  }
`;

// The quiet footnote about what a portal signature is, said once per page
const Footnote = styled.p`
  ${type.meta}
  padding-top: ${space[4]};
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
`;

const Tips = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${space[3]};

  li {
    ${type.meta}
    padding-left: ${space[4]};
    border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};
  }
`;

export interface ContractsViewProps {
  projectId: string;
  perspective: Perspective;
  // The signed-in person is this project's client
  canSign: boolean;
  clientName: string;
  contracts: ContractView[];
  limits: UploadLimits;
}

function Summary({ contracts, perspective }: { contracts: ContractView[]; perspective: Perspective }) {
  const count = (status: ContractStatus) => contracts.filter((item) => item.status === status).length;
  const rows: { label: string; value: number; show: boolean }[] =
    perspective === 'client'
      ? [
          { label: 'To sign', value: count('awaiting'), show: true },
          { label: 'Signed', value: count('signed') + count('countersigned'), show: true },
          { label: 'For your records', value: count('reference'), show: count('reference') > 0 },
        ]
      : [
          { label: 'Awaiting signature', value: count('awaiting'), show: true },
          { label: 'Signed, to countersign', value: count('signed'), show: true },
          { label: 'Countersigned', value: count('countersigned'), show: true },
          { label: 'Reference documents', value: count('reference'), show: count('reference') > 0 },
        ];
  return (
    <Panel aria-labelledby="contracts-summary">
      <Stack $gap={3}>
        <H3 id="contracts-summary">At a glance</H3>
        <DataList>
          {rows
            .filter((row) => row.show)
            .map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
        </DataList>
      </Stack>
    </Panel>
  );
}

function ClientGuide() {
  return (
    <Panel aria-labelledby="contracts-guide">
      <Stack $gap={5}>
        <H3 id="contracts-guide">How signing works</H3>
        <Steps>
          <li>
            <span>01</span>
            <strong>Read the document</strong>
            <p>Preview opens it in your browser; Download keeps a copy.</p>
          </li>
          <li>
            <span>02</span>
            <strong>Sign it here</strong>
            <p>Confirm you agree and type your full name. We email you a receipt.</p>
          </li>
          <li>
            <span>03</span>
            <strong>Or sign on paper</strong>
            <p>Upload a scan or photo of the signed pages instead.</p>
          </li>
        </Steps>
        <Footnote>
          Portal signatures record the signer&apos;s name, the time and the file&apos;s fingerprint. For agreements that need a formal
          e-signature service, upload the signed PDF.
        </Footnote>
      </Stack>
    </Panel>
  );
}

function StudioGuide({ clientName, maxMb }: { clientName: string; maxMb: number }) {
  return (
    <Panel aria-labelledby="contracts-guide">
      <Stack $gap={4}>
        <H3 id="contracts-guide">How contracts work</H3>
        <Tips>
          <li>Replace a document freely until it is signed. After that it is part of the record.</li>
          <li>
            When {clientName} signs here, we keep the name they type, the time, their email and the file&apos;s SHA-256, and email you
            both.
          </li>
          <li>Signed on paper? {clientName} can upload the copy, or you can record it with a note.</li>
          <li>Files up to {maxMb} MB. A PDF opens right in the browser.</li>
        </Tips>
        <Footnote>
          Portal signatures record the signer&apos;s name, the time and the file&apos;s fingerprint. For agreements that need a formal
          e-signature service, sign there and upload the signed PDF.
        </Footnote>
      </Stack>
    </Panel>
  );
}

export default function ContractsView({ projectId, perspective, canSign, clientName, contracts, limits }: ContractsViewProps) {
  const studio = perspective === 'studio';
  const add = useDialog();
  const { statusRef, message, announce } = useAnnouncer();
  const maxMb = Math.round(limits.maxUploadBytes / (1024 * 1024));

  const entries = GROUP_ORDER.flatMap((status) => {
    const members = contracts.filter((item) => item.status === status);
    if (members.length === 0) return [];
    return [
      { kind: 'heading' as const, key: `group-${status}`, status, count: members.length },
      ...members.map((item) => ({ kind: 'card' as const, key: item.id, item })),
    ];
  });

  return (
    <div>
      <SectionHeader>
        <div>
          <H2>Contracts</H2>
          <Meta>
            {studio
              ? `Agreements for ${clientName} to sign and documents for their records. Each signature is kept with the exact file it covers.`
              : 'Agreements to sign and documents for your records. Read each one here, then sign it or upload a signed copy.'}
          </Meta>
        </div>
        {studio && (
          <Button onClick={add.openDialog}>
            <FiPlus aria-hidden="true" />
            Add a contract
          </Button>
        )}
      </SectionHeader>

      <ViewStatus ref={statusRef} message={message} />

      <Split>
        <CardColumn>
          {entries.length === 0 ? (
            studio ? (
              <EmptyState
                title="No contracts yet"
                action={
                  <Button $variant="secondary" onClick={add.openDialog}>
                    <FiPlus aria-hidden="true" />
                    Add the first contract
                  </Button>
                }
              >
                Upload an agreement for {clientName} to sign, or a document for their records. Signatures are kept with the exact file they
                cover.
              </EmptyState>
            ) : (
              <EmptyState title="No contracts yet">
                When we have an agreement for you to sign, or a document for your records, it appears here with a way to read, download and
                sign it. We will email you each time.
              </EmptyState>
            )
          ) : (
            entries.map((entry) =>
              entry.kind === 'heading' ? (
                <GroupTitle key={entry.key}>
                  {GROUP_TITLES[perspective][entry.status]} · {entry.count}
                </GroupTitle>
              ) : (
                <ContractCard
                  key={entry.key}
                  projectId={projectId}
                  contract={entry.item}
                  perspective={perspective}
                  clientName={clientName}
                  canSign={canSign}
                  limits={limits}
                  onDeleted={(text) => announce(text)}
                />
              ),
            )
          )}
        </CardColumn>

        <Aside aria-label={studio ? 'Contracts summary and notes' : 'Contracts summary and how signing works'}>
          {contracts.length > 0 && <Summary contracts={contracts} perspective={perspective} />}
          {studio ? <StudioGuide clientName={clientName} maxMb={maxMb} /> : <ClientGuide />}
        </Aside>
      </Split>

      {studio && (
        <AddContractDialog
          dialog={add}
          projectId={projectId}
          clientName={clientName}
          limits={limits}
          // Focus goes back to "Add a contract"; the message is read out where it is
          onAdded={(state) => announce(state.message, false)}
        />
      )}
    </div>
  );
}

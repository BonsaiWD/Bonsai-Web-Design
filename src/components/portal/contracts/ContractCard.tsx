'use client';

import { useId } from 'react';
import { Card, CardHead } from '@/components/portal/deliverables/parts';
import { H3, LocalTime, MetaLine, StatusBadge, StatusLine, Text, useAnnouncer } from '@/components/portal/ui';
import { ClientActions } from './ClientActions';
import { DocumentPlate } from './DocumentPlate';
import { contractLabel } from './labels';
import { FileHistory, ReturnedNotice, SignatureRecord } from './Records';
import { StudioActions } from './StudioActions';
import type { ContractView, Perspective, UploadLimits } from './types';

interface ContractCardProps {
  projectId: string;
  contract: ContractView;
  perspective: Perspective;
  clientName: string;
  canSign: boolean;
  limits: UploadLimits;
  onDeleted: (message: string) => void;
}

export function ContractCard({ projectId, contract, perspective, clientName, canSign, limits, onDeleted }: ContractCardProps) {
  const titleId = useId();
  const { statusRef, message, announce } = useAnnouncer();
  const studio = perspective === 'studio';
  const badge = contractLabel(contract.status, perspective);
  // The client's turn is a signature; the studio's is a countersignature or a failed email
  const needsViewer = studio ? contract.status === 'signed' || Boolean(contract.studio?.lastEmailFailed) : contract.status === 'awaiting';

  return (
    <Card id={`contract-${contract.id}`} aria-labelledby={titleId} $attention={needsViewer}>
      <CardHead>
        <div>
          {/* Whether it needs a signature is the badge's job */}
          <MetaLine>
            <>
              Added <LocalTime value={contract.createdAt} />
              {studio && contract.studio?.createdByName ? ` by ${contract.studio.createdByName}` : ''}
            </>
          </MetaLine>
          <H3 as="h4" id={titleId}>
            {contract.title}
          </H3>
        </div>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
      </CardHead>

      {contract.description && <Text $muted>{contract.description}</Text>}

      <DocumentPlate contract={contract} perspective={perspective} />

      <SignatureRecord contract={contract} perspective={perspective} clientName={clientName} />

      <ReturnedNotice contract={contract} perspective={perspective} clientName={clientName} />

      {studio ? (
        <StudioActions
          projectId={projectId}
          contract={contract}
          clientName={clientName}
          limits={limits}
          announce={announce}
          statusRef={statusRef}
          lastMessage={message}
          onDeleted={onDeleted}
        />
      ) : (
        <ClientActions
          projectId={projectId}
          contract={contract}
          clientName={clientName}
          canSign={canSign}
          limits={limits}
          announce={announce}
          statusRef={statusRef}
        />
      )}

      <StatusLine ref={statusRef} message={message} />

      <FileHistory contract={contract} perspective={perspective} clientName={clientName} />
    </Card>
  );
}

import type { ContractFileLabel } from '@/db/schema';
import type { ContractView } from './types';

// Sentences shared by the browser and the server. The server rebuilds each statement from the
// database at the moment of signing, so what is stored is exactly what the client confirmed.

// The short fingerprint people can compare by eye; the full hash is on the record and receipt
export function shortSha(sha256: string): string {
  return sha256.slice(0, 12);
}

// What the client ticks: "fingerprint" rather than the algorithm's name, which the record,
// the receipt and the studio's statement give in full
export function signStatement(title: string, filename: string, sha256: string): string {
  return `I have read ${title} (${filename}, fingerprint ${shortSha(sha256)}…) and agree to its terms.`;
}

export function studioSignStatement(options: {
  recordedBy: string;
  clientName: string;
  title: string;
  filename: string;
  sha256: string;
}): string {
  return `${options.recordedBy} recorded for the studio that ${options.clientName} signed ${options.title} (${options.filename}, SHA-256 ${shortSha(options.sha256)}…) outside the portal.`;
}

// What each kind of file in a contract's history is, from either side. side 'former': a client
// the project belonged to before it moved, so never the reader's own copy.
export function fileLabel(
  label: ContractFileLabel,
  perspective: 'client' | 'studio',
  requiresSignature = true,
  side: 'studio' | 'client' | 'former' = 'client',
): string {
  switch (label) {
    case 'original':
      return requiresSignature ? 'Agreement' : 'Document';
    case 'client_signed':
      if (side === 'former') return "Previous client's signed copy";
      return perspective === 'client' ? 'Your signed copy' : "Client's signed copy";
    case 'countersigned':
      return 'Countersigned copy';
    default:
      return 'Supporting file';
  }
}

// The document was replaced at least once, so a copy printed early may be of an earlier version
export function wasReplaced(contract: Pick<ContractView, 'files'>): boolean {
  return contract.files.some((entry) => entry.label === 'original' && !entry.current);
}

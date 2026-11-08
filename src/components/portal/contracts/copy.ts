import type { ContractFileLabel } from '@/db/schema';

// Sentences shared by the browser and the server. The server rebuilds each statement from the
// database at the moment of signing, so what is stored is exactly what the client confirmed.

// The short fingerprint people can compare by eye; the full hash is on the record and receipt
export function shortSha(sha256: string): string {
  return sha256.slice(0, 12);
}

export function signStatement(title: string, filename: string, sha256: string): string {
  return `I have read ${title} (${filename}, SHA-256 ${shortSha(sha256)}…) and agree to its terms.`;
}

// recordedBy: the studio member's name, or null when they have none (the client then reads the
// studio's name, never a member's address)
export function studioSignStatement(options: {
  recordedBy: string | null;
  clientName: string;
  title: string;
  filename: string;
  sha256: string;
}): string {
  const recorder = options.recordedBy ? `${options.recordedBy} recorded for the studio` : 'Bonsai Web Design recorded';
  return `${recorder} that ${options.clientName} signed ${options.title} (${options.filename}, SHA-256 ${shortSha(options.sha256)}…) outside the portal.`;
}

// What each kind of file in a contract's history is, from either side
export function fileLabel(label: ContractFileLabel, perspective: 'client' | 'studio', requiresSignature = true): string {
  switch (label) {
    case 'original':
      return requiresSignature ? 'Agreement' : 'Document';
    case 'client_signed':
      return perspective === 'client' ? 'Your signed copy' : "Client's signed copy";
    case 'countersigned':
      return 'Countersigned copy';
    default:
      return 'Supporting file';
  }
}

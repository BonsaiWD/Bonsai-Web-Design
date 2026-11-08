import type { ContractFileLabel } from '@/db/schema';

// What the contracts page passes from the server to its client components. The server builds
// these per perspective: the client's copy never carries uploader names, signer emails, IP
// addresses or the studio's email history.

export type Perspective = 'client' | 'studio';

// reference: no signature asked; awaiting: the client has not signed; signed: signed in the
// portal, recorded by the studio, or a signed copy uploaded; countersigned: the studio's copy is in
export type ContractStatus = 'reference' | 'awaiting' | 'signed' | 'countersigned';

export interface ContractFileView {
  // The contract_file row
  id: string;
  fileId: string;
  label: ContractFileLabel;
  filename: string;
  sizeBytes: number;
  sha256: string;
  // PDFs and images can open in the browser
  previewable: boolean;
  uploadedAt: string;
  // Which side uploaded it; the person's name is for the studio only
  side: 'studio' | 'client';
  uploadedByName: string | null;
  // The newest original: the document the client reads and signs
  current: boolean;
}

export interface ContractSignatureView {
  source: 'client' | 'studio';
  signedAt: string;
  // The name the client typed; empty when the studio recorded it
  signedName: string | null;
  // Who the record is in the name of: the client, or the studio member who entered it
  byName: string | null;
  statement: string;
  note: string | null;
  // The exact file the signature covers
  fileId: string;
  filename: string;
  sha256: string;
  // Studio perspective only
  signerEmail?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ContractView {
  id: string;
  title: string;
  description: string | null;
  requiresSignature: boolean;
  status: ContractStatus;
  createdAt: string;
  original: ContractFileView | null;
  // The newest copy of each kind, shown beside the original
  signedCopy: ContractFileView | null;
  countersigned: ContractFileView | null;
  signature: ContractSignatureView | null;
  // Every file, newest first
  files: ContractFileView[];
  // Studio perspective only
  studio?: {
    createdByName: string | null;
    // When the client was last asked to sign by email, and whether the newest attempt failed
    lastEmailedAt: string | null;
    lastEmailFailed: boolean;
  };
}

export interface UploadLimits {
  acceptedExtensions: string;
  maxUploadBytes: number;
}

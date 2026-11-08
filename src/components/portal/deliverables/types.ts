import type { MilestoneStatus, VersionStatus } from '@/db/schema';

// What the deliverables page passes from the server to its client components. The server
// builds these per perspective: the client's copy never carries withdrawn versions, links of
// earlier versions or the studio's record details.

export interface VersionFile {
  id: string;
  filename: string;
  sizeBytes: number;
  // PDFs and images can open in the browser
  previewable: boolean;
}

export interface VersionDecision {
  at: string;
  source: 'client' | 'studio';
  byName: string | null;
  signedName: string | null;
  statement: string;
  note: string | null;
  // Studio perspective only
  signerEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface VersionView {
  id: string;
  version: number;
  titleSnapshot: string;
  linkUrl: string | null;
  file: VersionFile | null;
  note: string | null;
  needsApproval: boolean;
  status: VersionStatus;
  reviewBy: string | null;
  sharedAt: string;
  sharedByName: string | null;
  decision: VersionDecision | null;
  // For a superseded version: the visible version that replaced it
  replacedBy: number | null;
}

export interface DeliverableView {
  id: string;
  title: string;
  description: string | null;
  milestone: { id: string; title: string } | null;
  // The highest version number handed out, withdrawn ones included
  latestVersion: number;
  // The newest version that was not withdrawn
  current: VersionView | null;
  // Every other version the viewer may see, newest first
  earlier: VersionView[];
  // Whether the newest version shared asked for approval; the share form starts from it
  lastNeedsApproval: boolean;
  // Studio perspective only
  studio?: {
    // When the client was last emailed about the current version, and whether that failed
    lastEmailedAt: string | null;
    lastEmailFailed: boolean;
    // The first decided version, which keeps the deliverable on record
    // source 'studio': the studio recorded the client's decision, and byName is who recorded it
    deleteBlockedBy: { version: number; status: 'approved' | 'changes_requested'; source: 'client' | 'studio'; byName: string | null; at: string } | null;
  };
}

export interface MilestoneOption {
  id: string;
  title: string;
  status: MilestoneStatus;
}

export type Perspective = 'client' | 'studio';

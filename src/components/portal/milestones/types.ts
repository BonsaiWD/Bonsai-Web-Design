import type { MilestoneStatus, VersionStatus } from '@/db/schema';

// Plain, serialisable shapes the milestones page passes from the server to its client
// components. Studio-only details are optional and left out of the client's payload.

export interface SignoffRecord {
  id: string;
  source: 'client' | 'studio';
  // Initials the client typed; null when the studio recorded a sign-off given elsewhere
  initials: string | null;
  // The person on the record: the client who initialled, or the studio member who recorded it
  signerName: string;
  statement: string;
  note: string | null;
  signedAt: string;
  // Studio only
  signerEmail?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface LinkedDeliverable {
  id: string;
  title: string;
  status: VersionStatus;
  version: number;
}

export interface MilestoneView {
  id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  dueDate: string | null;
  requiresSignoff: boolean;
  // Changes whenever the row is saved, so a stale edit form can be refused
  version: string;
  signoff: SignoffRecord | null;
  linked: LinkedDeliverable[];
  // When the studio last emailed a sign-off request (ISO), if it has
  signoffRequestedAt: string | null;
}

export interface MilestonesPageProps {
  projectId: string;
  projectName: string;
  clientName: string;
  today: string;
  milestones: MilestoneView[];
  showStudio: boolean;
  // An admin looking through the client's eyes: client actions render as static text
  previewingAsClient: boolean;
  // The viewer is the project's client, so client decisions are theirs to make
  isClient: boolean;
}

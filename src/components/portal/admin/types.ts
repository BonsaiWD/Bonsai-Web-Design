import type { ProjectStage } from '@/db/schema';

// What the studio's admin screens receive from the server: plain, serialisable shapes

export interface ClientView {
  id: string;
  // As saved; empty until the studio names them
  name: string;
  email: string;
  company: string | null;
  lastSignInAt: string | null;
  addedAt: string;
  projects: { id: string; name: string; stage: ProjectStage }[];
  // Sessions that have not expired: roughly, the browsers they are signed in on
  activeDevices: number;
  lastInvitedAt: string | null;
}

export interface StudioMemberView {
  id: string;
  name: string;
  email: string;
  lastSignInAt: string | null;
}

export interface ClientOption {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

// What exists on a project, for the settings tab: what deleting it removes and what keeps
// it from being deleted or handed to another client
export interface ProjectRecordCounts {
  milestones: number;
  deliverables: number;
  versions: number;
  contracts: number;
  // The Files tab's list: shared files nobody has removed
  sharedFiles: number;
  messages: number;
  draftInvoices: number;
  activity: number;
  // Records: decisions and signatures made by the client, and invoices sent to them
  decidedVersions: number;
  signoffs: number;
  signatures: number;
  // Signed and countersigned copies uploaded to contracts, not counting ones sent back
  signedCopies: number;
  issuedInvoices: number;
}

export interface ProjectSettingsData {
  id: string;
  name: string;
  summary: string | null;
  stage: ProjectStage;
  targetLaunch: string | null;
  // Changes on every save, so an edit made from a stale form is refused
  version: string;
  client: ClientOption;
  records: ProjectRecordCounts;
}

import type { MilestoneStatus, ProjectStage } from '@/db/schema';
import type { AttentionItem, DeadlineItem, Perspective } from '@/server/portal/attention';

// Plain, serialisable shapes the dashboards and the project overview receive from the
// server. Studio-only details are optional and never filled in for the client's copy.

export type { AttentionItem, DeadlineItem, Perspective };

export interface ActivityView {
  id: string;
  projectId: string;
  projectName: string;
  summary: string;
  // The tab the row points at, when it names one
  href: string | null;
  actorName: string | null;
  // The row was written by the person reading it
  actorIsViewer: boolean;
  at: string;
  // Studio perspective only
  studioOnly?: boolean;
  email?: { to: string; status: 'failed' | 'skipped' } | null;
}

export interface NextMilestoneView {
  id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  dueDate: string | null;
  requiresSignoff: boolean;
  signed: boolean;
}

export interface ProjectCardView {
  id: string;
  name: string;
  stage: ProjectStage;
  targetLaunch: string | null;
  client: { id: string; name: string; company: string | null; email: string };
  milestones: { done: number; total: number };
  nextMilestone: NextMilestoneView | null;
  // From the attention items: what needs the reader, alerts among them, and (studio) what
  // waits on the client
  needs: number;
  alerts: number;
  waitingOnClient: number;
  nextDeadline: DeadlineItem | null;
}

export interface StudioStats {
  activeProjects: number;
  totalProjects: number;
  waitingOnClients: number;
  clientsWaitedOn: number;
  waitingOnUs: number;
  overdue: number;
}

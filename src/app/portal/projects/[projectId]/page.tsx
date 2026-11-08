import OverviewView from '@/components/portal/overview/OverviewView';
import { firstName } from '@/lib/portal-format';
import { requireProject } from '@/server/portal/access';
import { collectAttention, collectDeadlines, featureContext } from '@/server/portal/collect';
import { loadActivity } from '@/server/portal/features/activity';
import { loadClientContact } from '@/server/portal/features/clients';
import { collectWaitingOnClients, loadNextMilestone, withoutListedFollowUps } from '@/server/portal/features/projects';
import { projectTabMetadata } from '@/server/portal/metadata';

export const generateMetadata = projectTabMetadata('Overview');

export default async function OverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  // Another client's project looks exactly like one that does not exist
  const project = await requireProject(projectId);
  const context = await featureContext(project.id);
  const studio = context.perspective === 'studio';

  // The client's copy leaves out studio-only activity and the client card, in the queries
  const [attention, deadlines, activity, milestones, waiting, client] = await Promise.all([
    collectAttention(project.id),
    collectDeadlines(project.id),
    loadActivity(context, { limit: 8 }),
    loadNextMilestone(project.id),
    studio ? collectWaitingOnClients(context) : Promise.resolve([]),
    studio ? loadClientContact(project.clientId) : Promise.resolve(null),
  ]);

  const clientName = project.clientName || project.clientEmail;
  return (
    <OverviewView
      projectId={project.id}
      perspective={context.perspective}
      today={context.today}
      clientFirst={firstName(clientName) ?? clientName}
      summary={project.summary}
      startedOn={project.createdAt.toISOString().slice(0, 10)}
      attention={withoutListedFollowUps(attention, waiting)}
      waiting={waiting}
      deadlines={deadlines}
      activity={activity}
      milestones={milestones}
      client={client}
    />
  );
}

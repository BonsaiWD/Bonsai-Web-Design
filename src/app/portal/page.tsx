import type { Metadata } from 'next';
import ClientDashboard from '@/components/portal/dashboard/ClientDashboard';
import StudioDashboard from '@/components/portal/dashboard/StudioDashboard';
import { Page } from '@/components/portal/ui';
import { firstName } from '@/lib/portal-format';
import { getViewer } from '@/server/portal/access';
import { collectAttention, collectDeadlines, featureContext } from '@/server/portal/collect';
import { loadActivity } from '@/server/portal/features/activity';
import { hasAnyClient } from '@/server/portal/features/clients';
import { collectWaitingOnClients, loadProjectCards } from '@/server/portal/features/projects';

// The layout's title template only reaches child segments, so this page names the brand itself
export const metadata: Metadata = { title: { absolute: 'Overview | Bonsai Web Design client portal' } };

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ deleted?: string | string[] }> }) {
  const viewer = await getViewer();
  const context = await featureContext();
  const [attention, deadlines] = await Promise.all([collectAttention(), collectDeadlines()]);

  if (context.perspective === 'studio') {
    const waiting = await collectWaitingOnClients(context);
    const [projects, activity, hasClients, params] = await Promise.all([
      loadProjectCards(context, { attention, deadlines, waitingOnClients: waiting }),
      loadActivity(context, { limit: 12 }),
      hasAnyClient(),
      searchParams,
    ]);
    const open = attention.filter((item) => item.tone !== 'info');
    return (
      <Page>
        <StudioDashboard
          today={context.today}
          stats={{
            activeProjects: projects.filter((card) => card.stage !== 'launched' && card.stage !== 'on_hold').length,
            totalProjects: projects.length,
            waitingOnClients: waiting.length,
            clientsWaitedOn: new Set(waiting.map((item) => item.projectId)).size,
            waitingOnUs: open.length,
            overdue: deadlines.filter((item) => item.date < context.today).length,
          }}
          attention={attention}
          waiting={waiting}
          deadlines={deadlines}
          projects={projects}
          activity={activity}
          hasClients={hasClients}
          deleted={params.deleted === '1'}
        />
      </Page>
    );
  }

  const projects = await loadProjectCards(context, { attention, deadlines });
  // An admin previewing sees every client's projects: greet the client when there is only one
  const single = new Set(projects.map((card) => card.client.id)).size === 1 ? projects[0].client : null;
  const greetName = viewer.isAdmin ? (single ? firstName(single.name) : null) : firstName(viewer.user.name);
  const eyebrow = viewer.isAdmin && !single ? (projects.length ? 'Preview of every client' : null) : (projects[0]?.client.company ?? null);
  return (
    <Page>
      <ClientDashboard
        firstName={greetName}
        eyebrow={eyebrow}
        today={context.today}
        attention={attention}
        deadlines={deadlines}
        projects={projects}
      />
    </Page>
  );
}

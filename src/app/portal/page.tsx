import { desc, eq } from 'drizzle-orm';
import { STAGE_LABELS, STAGE_TONES } from '@/components/portal/labels';
import { projectHref } from '@/components/portal/tabs';
import { H1, Lead, ListPanel, Page, Row, Rows, Stack, StatusBadge, TextLink } from '@/components/portal/ui';
import { getDb } from '@/db';
import { project } from '@/db/schema';
import { getViewer } from '@/server/portal/access';

// A plain project list until the dashboards are built, so every project is one click away
export default async function PortalHome() {
  const viewer = await getViewer();
  const projects = await getDb()
    .select({ id: project.id, name: project.name, stage: project.stage })
    .from(project)
    .where(viewer.isAdmin ? undefined : eq(project.clientId, viewer.user.id))
    .orderBy(desc(project.createdAt));

  return (
    <Page>
      <Stack $gap={6}>
        <Stack $gap={2}>
          <H1>Projects</H1>
          <Lead>The full dashboard is on its way. Open a project to see its milestones and deliverables.</Lead>
        </Stack>
        {projects.length > 0 ? (
          <ListPanel>
            <Rows>
              {projects.map((item) => (
                <li key={item.id}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <TextLink href={projectHref(item.id, 'milestones')}>{item.name}</TextLink>
                    <StatusBadge tone={STAGE_TONES[item.stage]}>{STAGE_LABELS[item.stage]}</StatusBadge>
                  </Row>
                </li>
              ))}
            </Rows>
          </ListPanel>
        ) : (
          <Lead>Your project appears here once we have set it up.</Lead>
        )}
      </Stack>
    </Page>
  );
}

'use client';

import Link from 'next/link';
import styled from 'styled-components';
import { firstName, plural } from '@/lib/portal-format';
import { STAGE_LABELS, STAGE_TONES } from '../labels';
import { projectHref } from '../tabs';
import { DueText, focusRing, ListPanel, MetaText, StatusBadge, space, tint, type } from '../ui';
import { PanelTitle } from './parts';
import { Table } from './table';
import type { ProjectCardView } from './types';

const ProjectLink = styled(Link)`
  ${type.label}
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.text};
  text-decoration: underline;
  text-decoration-color: ${({ theme }) => tint(theme.colors.primary, 35)};
  text-underline-offset: 0.2em;
  overflow-wrap: anywhere;
  ${focusRing}

  @media (hover: hover) {
    &:hover {
      text-decoration-color: ${({ theme }) => theme.colors.primary};
    }
  }
`;

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  min-width: 0;
`;

const Flags = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${space[1]};
`;

const Wide = styled.col<{ $width: string }>`
  width: ${({ $width }) => $width};
`;

// Every project, live work first: where it stands, what is due next and what is open
export function ProjectsTable({ projects, today }: { projects: ProjectCardView[]; today: string }) {
  return (
    <ListPanel aria-labelledby="dashboard-projects">
      <PanelTitle id="dashboard-projects" title="All projects" note={plural(projects.length, 'project')} />
      <Table role="table" aria-labelledby="dashboard-projects">
        <colgroup>
          <Wide $width="28%" />
          <Wide $width="20%" />
          <Wide $width="14%" />
          <Wide $width="22%" />
          <Wide $width="16%" />
        </colgroup>
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">
              Project
            </th>
            <th role="columnheader" scope="col">
              Client
            </th>
            <th role="columnheader" scope="col">
              Stage
            </th>
            <th role="columnheader" scope="col">
              Next deadline
            </th>
            <th role="columnheader" scope="col">
              Open items
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {projects.map((card) => {
            const client = firstName(card.client.name) ?? card.client.name;
            const studioItems = card.needs - card.alerts;
            return (
              <tr key={card.id} role="row">
                <td role="cell" data-primary="">
                  <Cell>
                    <ProjectLink href={projectHref(card.id)}>{card.name}</ProjectLink>
                    {card.milestones.total > 0 && (
                      <MetaText>
                        {card.milestones.done} of {plural(card.milestones.total, 'milestone')} done
                      </MetaText>
                    )}
                  </Cell>
                </td>
                <td role="cell" data-label="Client">
                  <Cell>
                    <span>{card.client.name}</span>
                    {card.client.company && <MetaText>{card.client.company}</MetaText>}
                  </Cell>
                </td>
                <td role="cell" data-label="Stage">
                  <span>
                    <StatusBadge tone={STAGE_TONES[card.stage]}>{STAGE_LABELS[card.stage]}</StatusBadge>
                  </span>
                </td>
                <td role="cell" data-label="Next deadline">
                  {card.nextDeadline ? (
                    <Cell>
                      <span>{card.nextDeadline.title}</span>
                      <MetaText>
                        <DueText value={card.nextDeadline.date} today={today} />
                      </MetaText>
                    </Cell>
                  ) : (
                    <MetaText>None set</MetaText>
                  )}
                </td>
                <td role="cell" data-label="Open items">
                  {card.alerts || studioItems || card.waitingOnClient ? (
                    <Flags>
                      {card.alerts > 0 && <StatusBadge tone="alert">{plural(card.alerts, 'alert')}</StatusBadge>}
                      {studioItems > 0 && <StatusBadge tone="action">{studioItems} for us</StatusBadge>}
                      {card.waitingOnClient > 0 && (
                        <StatusBadge tone="active">
                          {card.waitingOnClient} with {client}
                        </StatusBadge>
                      )}
                    </Flags>
                  ) : (
                    <MetaText>Nothing open</MetaText>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </ListPanel>
  );
}

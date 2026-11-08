'use client';

import styled from 'styled-components';
import { FiArrowRight } from 'react-icons/fi';
import { dueInfo } from '@/lib/portal-format';
import type { NextMilestoneView, Perspective } from '../dashboard/types';
import { MILESTONE_LABELS } from '../labels';
import { asksForInitials } from '../milestones/signoff';
import { projectHref } from '../tabs';
import { ButtonLink, DateText, DueText, H2, H3, MetaLine, MetaText, Panel, space, StatusBadge, Text, TextLink, tint, type } from '../ui';

const Head = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: ${space[2]} ${space[5]};
  margin-bottom: ${space[5]};

  a {
    display: inline-flex;
    align-items: center;
    gap: ${space[1]};
    ${type.meta}
    font-weight: 500;
  }
`;

const Progress = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  padding-bottom: ${space[5]};
  margin-bottom: ${space[5]};
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
`;

// One segment per milestone, so the bar reads as steps rather than a percentage
const Segments = styled.div`
  display: flex;
  gap: ${space[1]};
  max-width: 20rem;
`;

const Segment = styled.span<{ $done: boolean }>`
  flex: 1;
  height: 4px;
  background: ${({ $done, theme }) => ($done ? theme.colors.primary : tint(theme.colors.primary, 16))};
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};

  h3 {
    overflow-wrap: anywhere;
  }
`;

const TitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: ${space[2]} ${space[4]};
`;

interface NextMilestoneProps {
  projectId: string;
  perspective: Perspective;
  today: string;
  clientFirst: string;
  next: NextMilestoneView | null;
  done: number;
  total: number;
}

export default function NextMilestone({ projectId, perspective, today, clientFirst, next, done, total }: NextMilestoneProps) {
  const client = perspective === 'client';
  const href = projectHref(projectId, 'milestones', next ? `milestone-${next.id}` : undefined);
  const due = next?.dueDate ? dueInfo(next.dueDate, today) : null;

  return (
    <Panel aria-labelledby="overview-next">
      <Head>
        <H2 id="overview-next">Next milestone</H2>
        {total > 0 && (
          <TextLink href={projectHref(projectId, 'milestones')}>
            All milestones <FiArrowRight aria-hidden="true" />
          </TextLink>
        )}
      </Head>

      {total > 0 && (
        <Progress>
          <MetaText>
            {done} of {total} done
          </MetaText>
          <Segments aria-hidden="true">
            {Array.from({ length: total }, (_, index) => (
              <Segment key={index} $done={index < done} />
            ))}
          </Segments>
        </Progress>
      )}

      {next ? (
        <Body>
          <TitleRow>
            <H3>
              <TextLink href={href}>{next.title}</TextLink>
            </H3>
            <StatusBadge tone={MILESTONE_LABELS[next.status].tone}>{MILESTONE_LABELS[next.status][perspective]}</StatusBadge>
          </TitleRow>
          {next.description && <Text $muted>{next.description}</Text>}
          <MetaLine>
            {next.dueDate && <DueText value={next.dueDate} today={today} />}
            {/* "Due Mar 4, 2027" already names the day; the relative labels need it added */}
            {next.dueDate && due && due.tone !== 'later' && <DateText value={next.dueDate} />}
            {/* Initials are asked for only once the step waits on the client and no linked
                review is open, the same rule as the Milestones tab and the attention items */}
            {asksForInitials(next) && (
              <StatusBadge tone="action">{client ? 'Your sign-off is needed' : `Waiting for ${clientFirst}'s initials`}</StatusBadge>
            )}
          </MetaLine>
        </Body>
      ) : total > 0 ? (
        <Text $muted>Every milestone is done.</Text>
      ) : client ? (
        <Text $muted>We&apos;re planning the steps with you. Each one will show here with its date, so you can see what&apos;s next.</Text>
      ) : (
        <Body>
          <Text $muted>No milestones yet. Plan the steps from kickoff to launch so {clientFirst} can see what&apos;s next.</Text>
          <div>
            <ButtonLink href={projectHref(projectId, 'milestones')} $variant="secondary">
              Plan milestones
            </ButtonLink>
          </div>
        </Body>
      )}
    </Panel>
  );
}

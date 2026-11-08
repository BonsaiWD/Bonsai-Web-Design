'use client';

import Link from 'next/link';
import styled from 'styled-components';
import { FiChevronRight, FiUserPlus } from 'react-icons/fi';
import { createProject } from '@/app/portal/_actions/projects';
import {
  ActionForm,
  ButtonLink,
  Checkbox,
  EmptyState,
  Field,
  focusRing,
  FormActions,
  FormMessage,
  FormStack,
  H1,
  H2,
  LAPTOP,
  Lead,
  Panel,
  Select,
  space,
  Split,
  Stack,
  SubmitButton,
  TextLink,
  tint,
  type,
} from '../ui';
import { FreshFields, sansHeading } from './parts';
import ProjectFields from './ProjectFields';
import type { ClientOption } from './types';

const Crumbs = styled.nav`
  ${type.meta}

  ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space[1]};
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: ${space[1]};
  }

  a {
    color: ${({ theme }) => theme.colors.textSecondary};
    ${focusRing}

    @media (hover: hover) {
      &:hover {
        color: ${({ theme }) => theme.colors.text};
      }
    }
  }

  svg {
    color: ${({ theme }) => tint(theme.colors.textSecondary, 70)};
  }
`;

const Intro = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${space[4]};
`;

const Steps = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${space[5]};

  li {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: ${space[1]} ${space[3]};
  }

  li > span {
    ${type.overline}
    ${type.figures}
    grid-row: span 2;
    padding-top: 0.1rem;
  }

  h3 {
    ${type.label}
    ${sansHeading}
  }

  p {
    ${type.meta}
  }
`;

const Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};

  /* Level with the heading inside the form's panel */
  @media (min-width: ${LAPTOP}) {
    padding-top: ${space[6]};
  }
`;

const clientLabel = (client: ClientOption) => [client.name, client.company].filter(Boolean).join(' · ');

interface NewProjectViewProps {
  formId: string;
  clients: ClientOption[];
  preselect: string | null;
}

export default function NewProjectView({ formId, clients, preselect }: NewProjectViewProps) {
  const initialClient =
    preselect && clients.some((client) => client.id === preselect) ? preselect : clients.length === 1 ? clients[0].id : '';

  return (
    <Stack $gap={8}>
      <Intro>
        <Crumbs aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/portal">Overview</Link>
              <FiChevronRight aria-hidden="true" />
            </li>
            <li aria-current="page">New project</li>
          </ol>
        </Crumbs>
        <H1>New project</H1>
        <Lead>Set it up for a client, then plan its milestones. The client can see it as soon as it exists.</Lead>
      </Intro>

      {clients.length === 0 ? (
        <EmptyState
          title="Add a client first"
          action={
            <ButtonLink href="/portal/admin/clients?add=1">
              <FiUserPlus aria-hidden="true" />
              Add a client
            </ButtonLink>
          }
        >
          Every project belongs to a client, who signs in to follow it. Add them with their email address, then come back here.
        </EmptyState>
      ) : (
        <Split>
          <Panel aria-labelledby="new-project-heading">
            <Stack $gap={6}>
              <H2 id="new-project-heading">Project details</H2>
              <ActionForm action={createProject}>
                <FormStack>
                  <FreshFields>
                    <Field
                      label="Client"
                      name="clientId"
                      saved={initialClient}
                      hint={
                        <>
                          Not listed? <TextLink href="/portal/admin/clients?add=1">Add a client</TextLink> first.
                        </>
                      }
                    >
                      {(control) => (
                        <Select
                          id={control.id}
                          name={control.name}
                          defaultValue={control.defaultValue}
                          aria-describedby={control.describedBy}
                          aria-invalid={control.invalid || undefined}
                          required
                        >
                          <option value="" disabled>
                            Choose a client
                          </option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {clientLabel(client)}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <ProjectFields saved={{ name: '', summary: '', stage: 'discovery', targetLaunch: '' }} />
                    <Checkbox name="emailClient" hint="Sends “New project: <name>” with a link to it. Leave it off to set things up first.">
                      Email the client
                    </Checkbox>
                  </FreshFields>
                  <FormActions>
                    <SubmitButton pendingLabel="Creating…">Create project</SubmitButton>
                    <ButtonLink href="/portal" $variant="quiet">
                      Cancel
                    </ButtonLink>
                    <FormMessage />
                  </FormActions>
                </FormStack>
                <input type="hidden" name="id" value={formId} />
              </ActionForm>
            </Stack>
          </Panel>

          <Aside aria-labelledby="new-project-next">
            <H2 id="new-project-next">What comes next</H2>
            <Steps>
              <li>
                <span>01</span>
                <h3>Plan the milestones</h3>
                <p>
                  Each step from kickoff to launch, with a due date. Ask for the client&apos;s initials on the ones that need a sign-off.
                </p>
              </li>
              <li>
                <span>02</span>
                <h3>Share the agreement</h3>
                <p>Upload the contract for the client to read and sign in the portal.</p>
              </li>
              <li>
                <span>03</span>
                <h3>Invite the client</h3>
                <p>If they haven&apos;t signed in yet, send the invite from Clients once there is something to see.</p>
              </li>
            </Steps>
          </Aside>
        </Split>
      )}
    </Stack>
  );
}

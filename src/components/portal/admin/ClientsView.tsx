'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiChevronDown, FiPlus, FiUserPlus } from 'react-icons/fi';
import { inviteClient, removeClient, signOutClient } from '@/app/portal/_actions/clients';
import { plural } from '@/lib/portal-format';
import { PanelTitle } from '../dashboard/parts';
import { Table } from '../dashboard/table';
import { STAGE_LABELS } from '../labels';
import { projectHref } from '../tabs';
import {
  ActionForm,
  Button,
  ConfirmAction,
  DURATION,
  ease,
  EmptyState,
  Eyebrow,
  FormActions,
  FormMessage,
  H1,
  Lead,
  ListPanel,
  LocalTime,
  MetaText,
  PHONE,
  space,
  Stack,
  StatusLine,
  SubmitButton,
  TextLink,
  tint,
  type,
  useAnnouncer,
  useDialog,
  VisuallyHidden,
} from '../ui';
import { AddClientDialog, ChangeEmailDialog, EditClientDialog } from './ClientDialogs';
import { Tool, Tools } from './parts';
import type { ClientView, StudioMemberView } from './types';

const Intro = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${space[5]} ${space[8]};

  > div:first-child {
    display: flex;
    flex-direction: column;
    gap: ${space[3]};
  }

  @media (max-width: ${PHONE}) {
    > button {
      width: 100%;
    }
  }
`;

// Rows that open a tools panel; the panel row spans the table and stacks on phones
const ClientTable = styled(Table)`
  && tr[hidden] {
    display: none;
  }

  td[data-actions] {
    text-align: right;
    white-space: nowrap;
  }

  tr[data-open='true'] td {
    background: ${({ theme }) => tint(theme.colors.primary, 4)};
  }

  td[data-panel] {
    padding-top: 0;
    border-top: none !important;
    background: ${({ theme }) => tint(theme.colors.primary, 4)};
  }

  @media (max-width: ${PHONE}) {
    td[data-actions],
    td[data-panel] {
      display: block;
      text-align: left;
      padding-top: ${space[3]};
    }

    td[data-actions]::before,
    td[data-panel]::before {
      content: none;
    }

    td[data-panel] {
      padding: 0;
    }

    tr[data-open='true'],
    tr[data-panel-row] {
      background: ${({ theme }) => tint(theme.colors.primary, 4)};
    }

    tr[data-open='true'] td,
    td[data-panel] {
      background: none;
    }

    tr[data-panel-row] {
      padding-top: 0;
    }

    /* The panel row belongs to the client above it, so no rule between them */
    tbody tr[data-panel-row] {
      border-top: none;
    }
  }
`;

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  min-width: 0;
`;

const NameText = styled.span`
  ${type.label}
  font-size: 1rem;
`;

const ManageButton = styled(Button)`
  svg {
    transition: transform ${DURATION.state}s ${ease};
  }

  &[aria-expanded='true'] {
    background: ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  &[aria-expanded='true'] svg {
    transform: rotate(180deg);
  }

  @media (max-width: ${PHONE}) {
    width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    svg {
      transition: none;
    }
  }
`;

const ToolsFrame = styled.div`
  padding: ${space[2]} 0 ${space[2]};
  white-space: normal;
  text-align: left;

  @media (max-width: ${PHONE}) {
    padding: 0;
  }
`;

const ToolControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[3]};
`;

/* ---------- One client ---------- */

function InviteTool({ client }: { client: ClientView }) {
  return (
    <Tool>
      <div>
        <h4>{client.lastInvitedAt ? 'Send the invite again' : 'Send an invite'}</h4>
        <p>
          {client.lastInvitedAt ? (
            <>
              Last invited <LocalTime value={client.lastInvitedAt} />.
            </>
          ) : (
            'No invite sent yet.'
          )}{' '}
          It links to the sign-in page with {client.email} filled in.
        </p>
      </div>
      <ActionForm action={inviteClient}>
        <FormActions>
          <SubmitButton variant="secondary" pendingLabel="Sending…">
            {client.lastInvitedAt ? 'Send invite again' : 'Send invite'}
          </SubmitButton>
          <FormMessage />
        </FormActions>
        <input type="hidden" name="clientId" value={client.id} />
      </ActionForm>
    </Tool>
  );
}

function ClientRows({ client, onRemoving }: { client: ClientView; onRemoving: (client: { id: string; name: string }) => void }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const edit = useDialog();
  const email = useDialog();
  const { statusRef, message, announce } = useAnnouncer();
  const who = client.name || client.email;
  const anchor = `client-${client.id}`;

  // A link from a project's client card opens this client's tools
  useEffect(() => {
    if (window.location.hash === `#${anchor}`) {
      // The hash is only known in the browser, after hydration
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    }
  }, [anchor]);

  const hidden = <input type="hidden" name="clientId" value={client.id} />;

  return (
    <>
      <tr id={anchor} role="row" data-open={open}>
        <td role="cell" data-primary="">
          <Cell>
            <NameText>{client.name || client.email}</NameText>
            {client.company && <MetaText>{client.company}</MetaText>}
          </Cell>
        </td>
        <td role="cell" data-label="Email">
          {client.email}
        </td>
        <td role="cell" data-label="Projects">
          {client.projects.length ? (
            <Cell>
              <MetaText>{plural(client.projects.length, 'project')}</MetaText>
              {client.projects.map((item) => (
                <span key={item.id}>
                  <TextLink href={projectHref(item.id)}>{item.name}</TextLink> <MetaText>· {STAGE_LABELS[item.stage]}</MetaText>
                </span>
              ))}
            </Cell>
          ) : (
            <Cell>
              <MetaText>None yet</MetaText>
              <TextLink href={`/portal/admin/projects/new?client=${encodeURIComponent(client.id)}`}>New project</TextLink>
            </Cell>
          )}
        </td>
        <td role="cell" data-label="Signed in">
          <Cell>
            {client.lastSignInAt ? <LocalTime value={client.lastSignInAt} /> : <span>Never</span>}
            {!client.lastSignInAt && client.lastInvitedAt && (
              <MetaText>
                Invited <LocalTime value={client.lastInvitedAt} />
              </MetaText>
            )}
          </Cell>
        </td>
        <td role="cell" data-actions="">
          <ManageButton
            $variant="secondary"
            $size="sm"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`Manage ${who}`}
            onClick={() => setOpen((value) => !value)}
          >
            Manage
            <FiChevronDown aria-hidden="true" />
          </ManageButton>
        </td>
      </tr>
      <tr role="row" hidden={!open} data-panel-row="">
        <td role="cell" colSpan={5} data-panel="" id={panelId}>
          <ToolsFrame>
            <StatusLine ref={statusRef} message={message} />
            <Tools aria-label={`Manage ${who}`}>
              <Tool>
                <div>
                  <h4>Name and company</h4>
                  <p>How the studio and the emails address them.</p>
                </div>
                <ToolControls>
                  <Button $variant="secondary" onClick={edit.openDialog}>
                    Edit details
                  </Button>
                </ToolControls>
              </Tool>
              <Tool>
                <div>
                  <h4>Email address</h4>
                  <p>They sign in with {client.email}. Changing it signs them out everywhere.</p>
                </div>
                <ToolControls>
                  <Button $variant="secondary" onClick={email.openDialog}>
                    Change email
                  </Button>
                </ToolControls>
              </Tool>
              <InviteTool client={client} />
              <Tool>
                <div>
                  <h4>Signed-in devices</h4>
                  <p>
                    {client.activeDevices
                      ? `Signed in on ${plural(client.activeDevices, 'device')}. Signing out also cancels unused sign-in links.`
                      : 'Not signed in anywhere right now.'}
                  </p>
                </div>
                <ToolControls>
                  <ConfirmAction
                    label="Sign out everywhere"
                    question={`Sign ${who} out on every device? They can sign back in with a new link.`}
                    confirmLabel="Sign out"
                    pendingLabel="Signing out…"
                    tone="primary"
                    action={signOutClient}
                    hidden={hidden}
                    onSuccess={(state) => announce(state.message)}
                  />
                </ToolControls>
              </Tool>
              <Tool $danger>
                <div>
                  <h4>Remove {who}</h4>
                  {client.projects.length ? (
                    <p>
                      Can&apos;t remove:{' '}
                      {client.projects.length === 1 ? `${client.projects[0].name} is` : `${plural(client.projects.length, 'project')} are`}{' '}
                      still theirs. Move {client.projects.length === 1 ? 'it' : 'them'} to another client or delete{' '}
                      {client.projects.length === 1 ? 'it' : 'them'} in project settings first.
                    </p>
                  ) : (
                    <p>Deletes their sign-in. Only possible while they have no projects.</p>
                  )}
                </div>
                {client.projects.length === 0 && (
                  <ToolControls>
                    <ConfirmAction
                      label="Remove client"
                      question={`Remove ${who}? This can't be undone.`}
                      confirmLabel="Remove"
                      pendingLabel="Removing…"
                      action={removeClient}
                      hidden={hidden}
                      onSubmit={() => onRemoving({ id: client.id, name: who })}
                    />
                  </ToolControls>
                )}
              </Tool>
            </Tools>
          </ToolsFrame>
          <EditClientDialog dialog={edit} client={client} onDone={announce} returnFocusTo={statusRef} />
          <ChangeEmailDialog dialog={email} client={client} onDone={announce} returnFocusTo={statusRef} />
        </td>
      </tr>
    </>
  );
}

/* ---------- The page ---------- */

const PageStatus = styled(StatusLine)`
  margin-top: -${space[4]};
`;

interface ClientsViewProps {
  clients: ClientView[];
  studio: StudioMemberView[];
  openAdd: boolean;
}

export default function ClientsView({ clients, studio, openAdd }: ClientsViewProps) {
  const add = useDialog();
  const addButton = useRef<HTMLButtonElement>(null);
  const { statusRef, message, announce } = useAnnouncer();
  const { openDialog } = add;

  // A removed client's row unmounts with its form, so the list says what happened
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [seen, setSeen] = useState(clients);
  if (seen !== clients) {
    setSeen(clients);
    if (removing && !clients.some((client) => client.id === removing.id)) {
      setRemoving(null);
      announce(`Removed ${removing.name}.`);
    }
  }

  // "Add client" on the dashboard links here with ?add=1
  useEffect(() => {
    if (!openAdd) return;
    openDialog({ currentTarget: addButton.current });
    // Drop the flag, so a reload does not open the dialog again
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }, [openAdd, openDialog]);

  return (
    <Stack $gap={8}>
      <Intro>
        <div>
          <Eyebrow>Studio</Eyebrow>
          <H1>Clients</H1>
          <Lead>
            Everyone who can sign in to see their projects. They sign in with an emailed link, so there are no passwords to manage.
          </Lead>
        </div>
        <Button ref={addButton} onClick={add.openDialog}>
          <FiUserPlus aria-hidden="true" />
          Add client
        </Button>
      </Intro>

      <PageStatus ref={statusRef} message={message} />

      {clients.length === 0 ? (
        <EmptyState
          title="Add your first client"
          action={
            <Button onClick={add.openDialog}>
              <FiPlus aria-hidden="true" />
              Add client
            </Button>
          }
        >
          Add a name and email address, send the invite, then create their project. They see it as soon as they sign in.
        </EmptyState>
      ) : (
        <ListPanel aria-labelledby="clients-heading">
          <PanelTitle id="clients-heading" title="Clients" note={plural(clients.length, 'client')} />
          <ClientTable role="table" aria-labelledby="clients-heading">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">
                  Name
                </th>
                <th role="columnheader" scope="col">
                  Email
                </th>
                <th role="columnheader" scope="col">
                  Projects
                </th>
                <th role="columnheader" scope="col">
                  Signed in
                </th>
                <th role="columnheader" scope="col">
                  <VisuallyHidden>Actions</VisuallyHidden>
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {clients.map((client) => (
                <ClientRows key={client.id} client={client} onRemoving={setRemoving} />
              ))}
            </tbody>
          </ClientTable>
        </ListPanel>
      )}

      <ListPanel aria-labelledby="studio-heading">
        <PanelTitle id="studio-heading" title="Studio" note="Admins see every project. They are managed outside this page." />
        <Table role="table" aria-labelledby="studio-heading">
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col">
                Name
              </th>
              <th role="columnheader" scope="col">
                Email
              </th>
              <th role="columnheader" scope="col">
                Signed in
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {studio.map((member) => (
              <tr key={member.id} role="row">
                <td role="cell" data-primary="">
                  <NameText>{member.name}</NameText>
                </td>
                <td role="cell" data-label="Email">
                  {member.email}
                </td>
                <td role="cell" data-label="Signed in">
                  {member.lastSignInAt ? <LocalTime value={member.lastSignInAt} /> : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ListPanel>

      <AddClientDialog dialog={add} onDone={announce} returnFocusTo={statusRef} />
    </Stack>
  );
}

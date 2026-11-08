'use client';

import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { deleteProject, reassignProject, updateProject } from '@/app/portal/_actions/projects';
import { firstName } from '@/lib/portal-format';
import {
  ActionForm,
  Button,
  DataList,
  Eyebrow,
  Field,
  FormActions,
  FormMessage,
  FormStack,
  H2,
  Input,
  Meta,
  MetaText,
  Notice,
  Panel,
  PHONE,
  Select,
  space,
  Split,
  Stack,
  SubmitButton,
  Text,
  tint,
  type,
  useDialog,
  useFormStatusState,
} from '../ui';
import { FreshFields, FormDialog } from './parts';
import ProjectFields from './ProjectFields';
import { deletableParts, hasSignedRecords, listParts, signedRecords } from './records';
import type { ClientOption, ProjectSettingsData } from './types';

const SectionHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
`;

const DangerPanel = styled(Panel)`
  border-color: ${({ theme }) => tint(theme.colors.error, 35)};
`;

const ClientCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  padding: ${space[4]} ${space[5]};
  border-left: 2px solid ${({ theme }) => tint(theme.colors.primary, 40)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};

  strong {
    ${type.label}
    font-size: 1rem;
  }

  span {
    overflow-wrap: anywhere;
  }
`;

const Question = styled.p`
  ${type.body}
  color: ${({ theme }) => theme.colors.text};
  max-width: 60ch;
`;

const Removes = styled.ul`
  margin: 0;
  padding-left: ${space[5]};
  ${type.body}
  color: ${({ theme }) => theme.colors.textSecondary};

  li + li {
    margin-top: ${space[1]};
  }
`;

const Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  min-width: 0;
`;

const Actions = styled(FormActions)`
  @media (max-width: ${PHONE}) {
    > button {
      width: 100%;
    }
  }
`;

const clientLabel = (client: ClientOption) => [client.name, client.company].filter(Boolean).join(' · ');

/* ---------- Details ---------- */

function DetailsForm({ settings }: { settings: ProjectSettingsData }) {
  const clientFirst = firstName(settings.client.name) ?? settings.client.name;
  return (
    <Panel aria-labelledby="settings-details">
      <Stack $gap={6}>
        <SectionHead>
          <H2 id="settings-details">Project details</H2>
          <Meta>A change of stage or launch date shows on {clientFirst}&apos;s timeline.</Meta>
        </SectionHead>
        <ActionForm action={updateProject}>
          <FormStack>
            <FreshFields saved={settings.version}>
              <ProjectFields
                clientFirst={clientFirst}
                saved={{
                  name: settings.name,
                  summary: settings.summary ?? '',
                  stage: settings.stage,
                  targetLaunch: settings.targetLaunch ?? '',
                }}
              />
            </FreshFields>
            <Actions>
              <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
              <FormMessage />
            </Actions>
          </FormStack>
          <input type="hidden" name="projectId" value={settings.id} />
          <input type="hidden" name="version" value={settings.version} />
        </ActionForm>
      </Stack>
    </Panel>
  );
}

/* ---------- Move to another client ---------- */

function ReassignSteps({ settings, others }: { settings: ProjectSettingsData; others: ClientOption[] }) {
  const { state } = useFormStatusState();
  const fieldRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState('');
  const keepRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const [choice, setChoice] = useState<ClientOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState(state?.at);

  // A result (moved, or refused) ends the confirm step
  if (state?.at !== seen) {
    setSeen(state?.at);
    setChoice(null);
    setPicked('');
  }

  useEffect(() => {
    if (choice) keepRef.current?.focus();
  }, [choice]);

  const from = settings.client.name;
  return (
    <FormStack>
      <div hidden={Boolean(choice)}>
        <FormStack ref={fieldRef}>
          <FreshFields>
            <Field label="Move to" name="clientId" saved="" hint="Only possible while the project has no signed records.">
              {(control) => (
                <Select
                  id={control.id}
                  name={control.name}
                  defaultValue={control.defaultValue}
                  aria-describedby={[control.describedBy, error ? 'reassign-error' : null].filter(Boolean).join(' ') || undefined}
                  aria-invalid={control.invalid || Boolean(error) || undefined}
                  onChange={(event) => {
                    setPicked(event.target.value);
                    setError(null);
                  }}
                >
                  <option value="" disabled>
                    Choose a client
                  </option>
                  {others.map((client) => (
                    <option key={client.id} value={client.id}>
                      {clientLabel(client)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </FreshFields>
          {error && (
            <MetaText id="reassign-error" role="alert">
              {error}
            </MetaText>
          )}
          <Actions>
            <Button
              ref={continueRef}
              $variant="secondary"
              onClick={() => {
                const client = others.find((option) => option.id === picked);
                if (!client) {
                  setError('Choose the client to move it to.');
                  fieldRef.current?.querySelector('select')?.focus();
                  return;
                }
                setChoice(client);
              }}
            >
              Move project…
            </Button>
            {!choice && <FormMessage />}
          </Actions>
        </FormStack>
      </div>

      {choice && (
        <FormStack>
          <Question>
            Move {settings.name} from {from} to {choice.name}? {firstName(choice.name) ?? choice.name} will see everything on it, including{' '}
            {firstName(from) ?? from}&apos;s messages and files, and {firstName(from) ?? from} will no longer see it.
          </Question>
          <Actions>
            <SubmitButton variant="secondary" pendingLabel="Moving…">
              Move to {choice.name}
            </SubmitButton>
            <Button
              ref={keepRef}
              $variant="quiet"
              onClick={() => {
                setChoice(null);
                requestAnimationFrame(() => continueRef.current?.focus());
              }}
            >
              Keep with {firstName(from) ?? from}
            </Button>
            <FormMessage />
          </Actions>
        </FormStack>
      )}
    </FormStack>
  );
}

function ClientSection({ settings, clients }: { settings: ProjectSettingsData; clients: ClientOption[] }) {
  const others = clients.filter((client) => client.id !== settings.client.id);
  const signed = signedRecords(settings.records);
  return (
    <Panel aria-labelledby="settings-client">
      <Stack $gap={5}>
        <SectionHead>
          <H2 id="settings-client">Client</H2>
          <Meta>The person who signs in to follow this project and makes its decisions.</Meta>
        </SectionHead>
        <ClientCard>
          <strong>{settings.client.name}</strong>
          {settings.client.company && <MetaText>{settings.client.company}</MetaText>}
          <MetaText>{settings.client.email}</MetaText>
        </ClientCard>
        {signed.length > 0 ? (
          <Notice>
            <p>
              This project stays with {settings.client.name}: it has {listParts(signed)}. Those records belong to the person who made them,
              so the project can&apos;t move to another client.
            </p>
          </Notice>
        ) : others.length === 0 ? (
          <Meta>To move it to someone else, add them as a client first.</Meta>
        ) : (
          <ActionForm action={reassignProject}>
            <ReassignSteps settings={settings} others={others} />
            <input type="hidden" name="projectId" value={settings.id} />
            <input type="hidden" name="currentClientId" value={settings.client.id} />
          </ActionForm>
        )}
      </Stack>
    </Panel>
  );
}

/* ---------- Delete ---------- */

function DeleteSection({ settings }: { settings: ProjectSettingsData }) {
  const dialog = useDialog();
  const signed = signedRecords(settings.records);
  const parts = deletableParts(settings.records);
  return (
    <DangerPanel aria-labelledby="settings-delete">
      <Stack $gap={4}>
        <H2 id="settings-delete">Delete project</H2>
        {hasSignedRecords(settings.records) ? (
          <Text $muted>
            This project can&apos;t be deleted: it has {listParts(signed)}, which are kept on record. If the work has stopped, set its stage
            to On hold instead; it stays in the portal, out of the way.
          </Text>
        ) : (
          <>
            <Text $muted>
              Removes the project and everything in it{parts.length ? `: ${listParts(parts)}` : ''}. {settings.client.name} will no longer
              see it. This can&apos;t be undone.
            </Text>
            <Actions>
              <Button $variant="danger" onClick={dialog.openDialog}>
                Delete project…
              </Button>
            </Actions>
            <FormDialog
              dialog={dialog}
              title={`Delete ${settings.name}?`}
              description="This permanently deletes the project and everything in it."
              action={deleteProject}
              submitLabel="Delete project"
              pendingLabel="Deleting…"
              submitVariant="danger"
              onSuccess={() => undefined}
              hidden={<input type="hidden" name="projectId" value={settings.id} />}
            >
              {parts.length > 0 ? (
                <Removes aria-label="What will be deleted">
                  {parts.map((part) => (
                    <li key={part}>{part}</li>
                  ))}
                </Removes>
              ) : (
                <Text $muted>The project has nothing in it yet.</Text>
              )}
              <Field label="Type the project name to confirm" name="confirmName" hint={`Type: ${settings.name}`}>
                {(control) => (
                  <Input
                    id={control.id}
                    name={control.name}
                    defaultValue={control.defaultValue}
                    aria-describedby={control.describedBy}
                    aria-invalid={control.invalid || undefined}
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                )}
              </Field>
            </FormDialog>
          </>
        )}
      </Stack>
    </DangerPanel>
  );
}

/* ---------- The tab ---------- */

function Counts({ settings }: { settings: ProjectSettingsData }) {
  const { records } = settings;
  const rows: [string, number][] = [
    ['Milestones', records.milestones],
    ['Deliverables', records.deliverables],
    ['Shared versions', records.versions],
    ['Contracts', records.contracts],
    ['Invoices', records.draftInvoices + records.issuedInvoices],
    ['Messages', records.messages],
    ['Files', records.files],
    ['Activity entries', records.activity],
  ];
  const signed = signedRecords(records);
  return (
    <Panel aria-labelledby="settings-counts">
      <Stack $gap={4}>
        <H2 id="settings-counts">On this project</H2>
        <DataList>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </DataList>
        <Meta>
          {signed.length
            ? `Signed records: ${listParts(signed)}. They keep the project with its client and can't be deleted.`
            : 'No signed records yet, so the project can still move to another client or be deleted.'}
        </Meta>
      </Stack>
    </Panel>
  );
}

// The settings page is not one of the tabs, so it names itself
const Intro = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${space[1]} ${space[3]};
  margin: -${space[2]} 0 ${space[6]};
`;

export default function ProjectSettingsView({ settings, clients }: { settings: ProjectSettingsData; clients: ClientOption[] }) {
  return (
    <>
      <Intro>
        <Eyebrow>Project settings</Eyebrow>
        <Meta>Only the studio sees this page.</Meta>
      </Intro>
      <Split>
        <Stack $gap={8}>
          <DetailsForm settings={settings} />
          <ClientSection settings={settings} clients={clients} />
          <DeleteSection settings={settings} />
        </Stack>
        <Aside>
          <Counts settings={settings} />
        </Aside>
      </Split>
    </>
  );
}

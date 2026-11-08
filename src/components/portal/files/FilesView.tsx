'use client';

import styled from 'styled-components';
import { FiUpload } from 'react-icons/fi';
import { plural } from '@/lib/portal-format';
import { uploadProjectFile } from '@/app/portal/_actions/files';
import { formatBytes } from '@/components/portal/deliverables/copy';
import { Disclosure, DisclosureSummary } from '@/components/portal/deliverables/parts';
import { projectHref } from '@/components/portal/tabs';
import {
  Button,
  Checkbox,
  ClientOnlyNote,
  DataList,
  EmptyState,
  Field,
  FormDialog,
  FormId,
  H2,
  H3,
  ListPanel,
  LocalTime,
  Meta,
  MetaLine,
  MetaText,
  Panel,
  PanelHeader,
  PHONE,
  Rows,
  SectionHeader,
  space,
  Split,
  Stack,
  StatusLine,
  TextAnchor,
  Textarea,
  TextLink,
  tint,
  type,
  useAnnouncer,
  useDialog,
} from '@/components/portal/ui';
import { FileItem } from './FileItem';
import { fileHref } from './parts';
import type { ProjectFileView } from './types';
import { UploadField } from './UploadField';

const ViewStatus = styled(StatusLine)`
  margin-bottom: ${space[6]};
`;

const GroupHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  min-width: 0;
`;

// A calm line inside a group that has nothing in it yet
const GroupEmpty = styled.p`
  ${type.meta}
  padding: ${space[5]} ${space[6]};

  @media (max-width: ${PHONE}) {
    padding: ${space[4]} ${space[5]};
  }
`;

const Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  min-width: 0;
`;

const Kinds = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${space[4]};

  li {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    padding-left: ${space[4]};
    border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};
  }

  strong {
    ${type.label}
  }

  p {
    ${type.meta}
  }
`;

// Beside the panel's heading, so it stays short
const OnlyClient = styled(ClientOnlyNote)`
  max-width: 34ch;
`;

const RemovedList = styled.ul`
  list-style: none;
  margin: ${space[3]} 0 0;
  padding: 0;

  > li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: ${space[1]};
    padding: ${space[3]} 0;
  }

  > li + li {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  a {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    overflow-wrap: anywhere;
  }
`;

export interface FilesViewProps {
  projectId: string;
  perspective: 'client' | 'studio';
  // The client in their own portal, or the studio: an admin previewing as the client cannot
  canUpload: boolean;
  clientName: string;
  files: ProjectFileView[];
  acceptedExtensions: string;
  maxUploadBytes: number;
}

function UploadDialog({
  dialog,
  projectId,
  studio,
  clientName,
  acceptedExtensions,
  maxUploadBytes,
  onUploaded,
}: {
  dialog: ReturnType<typeof useDialog>;
  projectId: string;
  studio: boolean;
  clientName: string;
  acceptedExtensions: string;
  maxUploadBytes: number;
  onUploaded: (message: string) => void;
}) {
  const mb = Math.round(maxUploadBytes / (1024 * 1024));
  return (
    <FormDialog
      dialog={dialog}
      title={studio ? `Share a file with ${clientName}` : 'Upload a file'}
      description={
        studio
          ? `It appears in ${clientName}'s files straight away.`
          : "Photos, copy, brand files: anything we need for the project. We'll be notified."
      }
      action={uploadProjectFile}
      submitLabel="Upload"
      pendingLabel="Uploading…"
      onSuccess={(state) => onUploaded(state.message)}
      hidden={
        <>
          <input type="hidden" name="projectId" value={projectId} />
          <FormId name="uploadId" />
        </>
      }
    >
      <UploadField
        label="File"
        hint={`PDF, images, Word, Excel, PowerPoint, text or ZIP, up to ${mb} MB.`}
        acceptedExtensions={acceptedExtensions}
        maxUploadBytes={maxUploadBytes}
      />
      <Field label="Note" name="note" optional hint="Shown with the file: what it is, or where it goes.">
        {(control) => (
          <Textarea
            id={control.id}
            name={control.name}
            defaultValue={control.defaultValue}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            rows={3}
            maxLength={1000}
          />
        )}
      </Field>
      {studio && (
        <Checkbox name="emailOther" savedChecked>
          Email {clientName} that it is here
        </Checkbox>
      )}
    </FormDialog>
  );
}

export default function FilesView({
  projectId,
  perspective,
  canUpload,
  clientName,
  files,
  acceptedExtensions,
  maxUploadBytes,
}: FilesViewProps) {
  const studio = perspective === 'studio';
  const upload = useDialog();
  const { statusRef, message, announce } = useAnnouncer();
  const mb = Math.round(maxUploadBytes / (1024 * 1024));

  const listed = files.filter((item) => !item.removed);
  const removed = files.filter((item) => item.removed);
  const fromClient = listed.filter((item) => item.side === 'client');
  const fromStudio = listed.filter((item) => item.side === 'studio');
  // Shared by a client the project belonged to before it moved: theirs, not the current client's
  const fromFormer = listed.filter((item) => item.side === 'former');

  const groups = [
    {
      key: 'client',
      title: studio ? `From ${clientName}` : 'From you',
      items: fromClient,
      empty: studio
        ? `Nothing from ${clientName} yet. When they upload something, it appears here and you get an email.`
        : 'Nothing from you yet. Upload photos, copy or brand files and we will be notified.',
    },
    {
      key: 'studio',
      title: 'From the studio',
      items: fromStudio,
      empty: studio ? `Nothing shared with ${clientName} yet.` : 'Nothing from us yet. Files we share with you appear here.',
    },
    // Only on a project that moved to another client
    ...(fromFormer.length ? [{ key: 'former', title: studio ? 'From previous clients' : 'From a previous client', items: fromFormer, empty: '' }] : []),
  ];

  // Who uploaded a row, where its group does not already say: which of the two of us, for the
  // studio, or someone other than the viewer on the client's side
  const byline = (item: ProjectFileView): string | null => {
    if (item.side === 'former') return item.uploadedByName;
    if (item.side === 'studio') return studio ? item.uploadedByName : null;
    if (studio) return item.uploadedByName === clientName ? null : item.uploadedByName;
    return item.mine ? null : item.uploadedByName;
  };

  const removeQuestion = (item: ProjectFileView) =>
    studio && item.side === 'client'
      ? `Remove ${item.filename} from the files? ${clientName} will no longer see it.`
      : studio
        ? `Remove ${item.filename}? ${clientName} will no longer see it.`
        : // The studio keeps removed files (listed under Removed files, still downloadable)
          `Remove ${item.filename}? It will disappear from your files. The studio keeps a copy for the project record.`;

  const uploadButton = canUpload && (
    <Button onClick={upload.openDialog}>
      <FiUpload aria-hidden="true" />
      {studio ? 'Share a file' : 'Upload a file'}
    </Button>
  );

  return (
    <div>
      <SectionHeader>
        <div>
          <H2>Files</H2>
          <Meta>
            {studio
              ? `A shared library for this project. ${clientName} and the studio can both add files here.`
              : 'A shared library for this project. Add anything we need, and find what we send you.'}
          </Meta>
        </div>
        {canUpload ? (
          uploadButton
        ) : (
          <OnlyClient>
            Only {clientName} can upload in this view. Switch back to the studio view to share a file.
          </OnlyClient>
        )}
      </SectionHeader>

      <ViewStatus ref={statusRef} message={message} />

      <Split>
        <Stack $gap={6}>
          {listed.length === 0 ? (
            <EmptyState
              title="Nothing shared yet"
              action={
                canUpload && (
                  <Button $variant="secondary" onClick={upload.openDialog}>
                    <FiUpload aria-hidden="true" />
                    {studio ? 'Share the first file' : 'Upload the first file'}
                  </Button>
                )
              }
            >
              {studio
                ? `Share files with ${clientName} here, and find what they send you. Each upload emails the other side.`
                : `Share photos, copy, brand files and anything else we need. Files can be up to ${mb} MB each; for anything larger, send us a link in Messages.`}
            </EmptyState>
          ) : (
            groups.map((group) => (
              <ListPanel key={group.key} aria-labelledby={`files-${group.key}`}>
                <PanelHeader>
                  <GroupHeader>
                    <H3 id={`files-${group.key}`}>{group.title}</H3>
                    <MetaText>{plural(group.items.length, 'file')}</MetaText>
                  </GroupHeader>
                </PanelHeader>
                {group.items.length === 0 ? (
                  <GroupEmpty>{group.empty}</GroupEmpty>
                ) : (
                  <Rows>
                    {group.items.map((item) => (
                      <FileItem
                        key={item.id}
                        projectId={projectId}
                        item={item}
                        byline={byline(item)}
                        // The uploader or the studio; an admin previewing acts as neither
                        canRemove={canUpload && (studio || item.mine)}
                        removeQuestion={removeQuestion(item)}
                        onRemoved={(text) => announce(text)}
                      />
                    ))}
                  </Rows>
                )}
              </ListPanel>
            ))
          )}

          {studio && removed.length > 0 && (
            <Disclosure>
              <DisclosureSummary count={plural(removed.length, 'file')}>Removed files</DisclosureSummary>
              <RemovedList>
                {removed.map((item) => (
                  <li key={item.id}>
                    <TextAnchor href={fileHref(item.id)}>{item.filename}</TextAnchor>
                    <MetaLine stackOnPhone>
                      {item.removed && (
                        <>
                          Removed{item.removed.byName ? ` by ${item.removed.byName}` : ''} on <LocalTime value={item.removed.at} />
                        </>
                      )}
                      <>Uploaded by {item.uploadedByName}</>
                      {formatBytes(item.sizeBytes)}
                    </MetaLine>
                  </li>
                ))}
              </RemovedList>
            </Disclosure>
          )}
        </Stack>

        <Aside aria-label={studio ? 'Files summary' : 'What to share'}>
          {studio ? (
            <Panel aria-labelledby="files-summary">
              <Stack $gap={4}>
                <H3 id="files-summary">At a glance</H3>
                <DataList>
                  <div>
                    <dt>From {clientName}</dt>
                    <dd>{fromClient.length}</dd>
                  </div>
                  <div>
                    <dt>From the studio</dt>
                    <dd>{fromStudio.length}</dd>
                  </div>
                  {fromFormer.length > 0 && (
                    <div>
                      <dt>From previous clients</dt>
                      <dd>{fromFormer.length}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Removed</dt>
                    <dd>{removed.length}</dd>
                  </div>
                </DataList>
                <Meta>
                  Removed files disappear for {clientName} but stay downloadable for the studio. Files up to {mb} MB; for larger ones, ask
                  for a link in <TextLink href={projectHref(projectId, 'messages')}>Messages</TextLink>.
                </Meta>
              </Stack>
            </Panel>
          ) : (
            <Panel aria-labelledby="files-guide">
              <Stack $gap={5}>
                <H3 id="files-guide">What to share</H3>
                <Kinds>
                  <li>
                    <strong>Photos and images</strong>
                    <p>Your team, your space, your products. PNG, JPG, WebP or GIF.</p>
                  </li>
                  <li>
                    <strong>Copy and documents</strong>
                    <p>Page text, bios, policies. Word, PDF or plain text.</p>
                  </li>
                  <li>
                    <strong>Brand files</strong>
                    <p>Logos, colours and fonts. Put several in a ZIP.</p>
                  </li>
                  <li>
                    <strong>Anything over {mb} MB</strong>
                    <p>
                      Send us a link instead (Google Drive, Dropbox or WeTransfer) in{' '}
                      <TextLink href={projectHref(projectId, 'messages')}>Messages</TextLink>.
                    </p>
                  </li>
                </Kinds>
              </Stack>
            </Panel>
          )}
        </Aside>
      </Split>

      {canUpload && (
        <UploadDialog
          dialog={upload}
          projectId={projectId}
          studio={studio}
          clientName={clientName}
          acceptedExtensions={acceptedExtensions}
          maxUploadBytes={maxUploadBytes}
          // Focus goes back to the upload button; the message is read out where it is
          onUploaded={(text) => announce(text, false)}
        />
      )}
    </div>
  );
}

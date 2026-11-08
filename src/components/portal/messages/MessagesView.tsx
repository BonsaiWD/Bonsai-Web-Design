'use client';

import { useCallback, useEffect, useOptimistic, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { markMessagesRead, sendMessage } from '@/app/portal/_actions/messages';
import { projectHref } from '@/components/portal/tabs';
import { H2, LocalTime, Meta, Notice, SectionHeader, Split, type ActionState } from '@/components/portal/ui';
import { ClientAside, StudioAside } from './Aside';
import { Composer, ComposerPreview } from './Composer';
import { FailedEmails, ThreadPanel } from './styles';
import { Thread } from './Thread';
import type { MessagesViewProps, MessageView } from './types';

// Coming back to the tab after this long picks up replies that arrived meanwhile
const STALE_AFTER_MS = 30 * 1000;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function MessagesView(props: MessagesViewProps) {
  const { projectId, perspective, viewerId, thread, maxLength } = props;
  const studio = perspective === 'studio';
  const clientName = props.clientName;
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);

  // A sent message shows straight away and is replaced by the saved one in the same render
  const [messages, addPending] = useOptimistic(thread.messages, (current: MessageView[], pending: MessageView) =>
    current.some((m) => m.id === pending.id) ? current : [...current, pending],
  );

  // Where the reader left off, kept for the whole visit: marking the thread read re-renders
  // the page with nothing unread, and the line should not vanish under the reader
  const [divider, setDivider] = useState({ id: thread.firstUnreadId, count: thread.unreadCount });
  const [seenFirstUnread, setSeenFirstUnread] = useState(thread.firstUnreadId);
  if (thread.firstUnreadId !== seenFirstUnread) {
    setSeenFirstUnread(thread.firstUnreadId);
    if (thread.firstUnreadId && !divider.id) setDivider({ id: thread.firstUnreadId, count: thread.unreadCount });
  }

  const send = useCallback(
    async (previous: ActionState, formData: FormData): Promise<ActionState> => {
      const body = String(formData.get('body') ?? '')
        .replace(/\r\n?/g, '\n')
        .trim();
      // A message typed without an input event (rare: some autofill) still gets an id
      if (!formData.get('id')) formData.set('id', crypto.randomUUID());
      if (body && body.length <= maxLength) {
        addPending({
          id: String(formData.get('id')),
          body,
          internal: studio && formData.get('internal') === 'on',
          createdAt: new Date().toISOString(),
          authorId: viewerId,
          authorName: '',
          side: perspective,
          unread: false,
          pending: true,
        });
      }
      return sendMessage(previous, formData);
    },
    [addPending, maxLength, perspective, studio, viewerId],
  );

  // Opening the conversation records the visit (clearing the tab's badge), and so does a
  // reply from the other side turning up while it is open
  const newestId = thread.messages[thread.messages.length - 1]?.id ?? null;
  const hasUnread = thread.unreadCount > 0;
  const marked = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!props.canMarkRead) return;
    if (marked.current !== undefined && (!hasUnread || marked.current === newestId)) return;
    marked.current = newestId;
    markMessagesRead(projectId, newestId).catch(() => {
      // Offline or signed out: try again next time something changes
      marked.current = undefined;
    });
  }, [props.canMarkRead, projectId, newestId, hasUnread]);

  // The newest message and the composer are in view on arrival, unless a link points elsewhere
  useEffect(() => {
    if (window.location.hash) return;
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, []);

  // A message just sent stays in view as it lands
  const lastShown = messages[messages.length - 1];
  const lastKey = lastShown && lastShown.side === perspective ? lastShown.id : null;
  const previousKey = useRef(lastKey);
  useEffect(() => {
    if (previousKey.current === lastKey) return;
    previousKey.current = lastKey;
    if (lastKey) endRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
  }, [lastKey]);

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_MS) router.refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [router]);

  const failed = props.studio?.failedEmails ?? [];

  return (
    <div>
      <SectionHeader>
        <div>
          <H2>Messages</H2>
          <Meta>
            {studio
              ? `A private conversation with ${props.clientName}. Internal notes stay with the studio.`
              : 'A private conversation between you and the studio. Ask anything, any time.'}
          </Meta>
        </div>
      </SectionHeader>

      <Split>
        <ThreadPanel aria-label={studio ? `Conversation with ${props.clientName}` : 'Conversation with the studio'}>
          <Thread
            messages={messages}
            perspective={perspective}
            viewerId={viewerId}
            now={props.now}
            dividerId={divider.id}
            dividerCount={divider.count}
            total={thread.total}
            limited={thread.limited}
            showAllHref={`${projectHref(projectId, 'messages')}?all=1`}
            emptyText={
              studio
                ? `Start the conversation with ${clientName}. They get an email with your message and a link back here.`
                : "Write to us about anything on the project. We'll reply here and email you when we do."
            }
          />
          <div ref={endRef}>
            {/* Beside the composer, where the next message is the way to try again */}
            {failed.length > 0 && (
              <FailedEmails>
                {failed.map((item) => (
                  <Notice key={item.id} tone="alert">
                    <span>
                      An email to {item.to} about a message on <LocalTime value={item.at} /> could not be sent.{' '}
                      {/* An address that is not the client's now was corrected since, or the project moved */}
                      {item.to === props.clientEmail
                        ? `${clientName} can still read it here; your next message will email them again.`
                        : `Your next message emails ${clientName} at ${props.clientEmail}.`}
                    </span>
                  </Notice>
                ))}
              </FailedEmails>
            )}
            {props.canWrite ? (
              <Composer projectId={projectId} perspective={perspective} clientName={clientName} maxLength={maxLength} action={send} />
            ) : (
              <ComposerPreview clientName={props.clientName} />
            )}
          </div>
        </ThreadPanel>

        {props.studio ? (
          <StudioAside
            clientName={props.clientName}
            clientEmail={props.clientEmail}
            clientCompany={props.clientCompany}
            total={thread.total}
            info={props.studio}
          />
        ) : (
          <ClientAside projectId={projectId} maxUploadMb={props.maxUploadMb} />
        )}
      </Split>
    </div>
  );
}

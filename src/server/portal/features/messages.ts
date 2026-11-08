import 'server-only';
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '@/db';
import { activity, message, project, projectReadState, user } from '@/db/schema';
import type { MessageView, Perspective, Side, StudioThreadInfo, ThreadView } from '@/components/portal/messages/types';
import type { EmailContent } from '@/lib/email';
import { firstName } from '@/lib/portal-format';
import type { PortalProject } from '../access';
import { projectScope, type AttentionItem, type FeatureContext, type PortalFeature } from '../attention';
import { claimRateSlot, type RateSlot } from '../throttle';
import { STUDIO_EMAIL, STUDIO_NAME, studioSubject } from '../notify';
import { FLAGGED_EMAIL_KINDS } from '../kinds';
import { failedEmails, failedEmailTitle, reachedClient } from './failed-emails';

/* ---------- Shared by the page, the provider and the actions ---------- */

export const MESSAGE_MAX_LENGTH = 5000;

// The newest messages load by default; a project thread rarely grows past this
const THREAD_WINDOW = 200;

// Thread messages are kind 'message' (the email throttle and failed-email alerts read them);
// internal notes get their own kind so nothing that reads 'message' rows ever counts them
export const MESSAGE_KIND = 'message';
export const INTERNAL_NOTE_KIND = 'message.internal';

export const messageAnchor = (messageId: string) => `message-${messageId}`;

// Textareas submit CRLF line breaks; NUL and other control characters cannot be stored or shown
export function normalizeBody(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

const author = alias(user, 'author');

// Messages the reader on this side has not written: for the client that is the studio's
// messages minus internal notes, for the studio everything the client wrote
function fromOtherSide(readerSide: Side): SQL {
  return readerSide === 'client'
    ? (and(eq(author.role, 'admin'), eq(message.internal, false)) as SQL)
    : ne(author.role, 'admin');
}

// Internal notes are filtered here, in the query, so they can never reach a client's page
function visibleTo(perspective: Perspective): SQL | undefined {
  return perspective === 'studio' ? undefined : eq(message.internal, false);
}

function displayName(side: Side, name: string, email: string): string {
  if (name.trim()) return name.trim();
  // A studio member's address is theirs, not the client's business
  return side === 'studio' ? STUDIO_NAME : email;
}

/* ---------- The messages page ---------- */

interface ThreadOptions {
  projectId: string;
  // The project's client now: after a move to another client, the previous one's messages
  // are not the new client's own
  clientId: string;
  perspective: Perspective;
  // Whose visits decide what is unread: the viewer, or the client while the studio previews
  readerId: string;
  all: boolean;
}

export async function loadThread({ projectId, clientId, perspective, readerId, all }: ThreadOptions): Promise<ThreadView> {
  const db = getDb();
  const readerSide: Side = perspective;
  const query = db
    .select({
      id: message.id,
      body: message.body,
      internal: message.internal,
      createdAt: message.createdAt,
      authorId: message.authorId,
      authorName: author.name,
      authorEmail: author.email,
      authorRole: author.role,
      // Compared in the database, at full precision, so a message never reads as both
      afterRead: sql<boolean>`(${projectReadState.messagesReadAt} is null or ${message.createdAt} > ${projectReadState.messagesReadAt})`,
    })
    .from(message)
    .innerJoin(author, eq(author.id, message.authorId))
    .leftJoin(projectReadState, and(eq(projectReadState.projectId, message.projectId), eq(projectReadState.userId, readerId)))
    .where(and(eq(message.projectId, projectId), visibleTo(perspective)))
    .orderBy(desc(message.createdAt), desc(message.id))
    .$dynamic();
  const rows = all ? await query : await query.limit(THREAD_WINDOW + 1);

  const limited = !all && rows.length > THREAD_WINDOW;
  const window = (limited ? rows.slice(0, THREAD_WINDOW) : rows).reverse();
  let total = window.length;
  if (limited) {
    const [row] = await db
      .select({ total: count() })
      .from(message)
      .where(and(eq(message.projectId, projectId), visibleTo(perspective)));
    total = row?.total ?? window.length;
  }

  const messages: MessageView[] = window.map((row) => {
    const side: Side = row.authorRole === 'admin' ? 'studio' : 'client';
    return {
      id: row.id,
      body: row.body,
      internal: row.internal,
      createdAt: row.createdAt.toISOString(),
      authorId: row.authorId,
      authorName: displayName(side, row.authorName, row.authorEmail),
      side,
      formerClient: side === 'client' && row.authorId !== clientId,
      unread: Boolean(row.afterRead) && side !== readerSide && !row.internal,
    };
  });
  const unread = messages.filter((m) => m.unread);
  return { messages, total, limited, firstUnreadId: unread[0]?.id ?? null, unreadCount: unread.length };
}

// The studio's side panel: when the client last looked, and whether emails reached them
export async function loadStudioThreadInfo(forProject: Pick<PortalProject, 'id' | 'clientId' | 'clientEmail'>): Promise<StudioThreadInfo> {
  const db = getDb();
  const [[read], emails, [internal]] = await Promise.all([
    db
      .select({ at: projectReadState.messagesReadAt })
      .from(projectReadState)
      .where(and(eq(projectReadState.projectId, forProject.id), eq(projectReadState.userId, forProject.clientId))),
    db
      .select({ id: activity.id, emailTo: activity.emailTo, emailStatus: activity.emailStatus, createdAt: activity.createdAt })
      .from(activity)
      .where(
        and(
          eq(activity.projectId, forProject.id),
          eq(activity.kind, MESSAGE_KIND),
          isNotNull(activity.emailTo),
          inArray(activity.emailStatus, ['sent', 'failed']),
        ),
      )
      .orderBy(asc(activity.createdAt)),
    db
      .select({ total: count() })
      .from(message)
      .where(and(eq(message.projectId, forProject.id), eq(message.internal, true))),
  ]);

  const lastToClient = [...emails].reverse().find((row) => row.emailTo === forProject.clientEmail && row.emailStatus === 'sent');
  return {
    clientReadAt: read?.at.toISOString() ?? null,
    lastEmailedClientAt: lastToClient?.createdAt.toISOString() ?? null,
    failedEmails: unresolvedFailures(emails).map((row) => ({ id: row.id, to: row.emailTo ?? '', at: row.createdAt.toISOString() })),
    internalCount: internal?.total ?? 0,
  };
}

// The rule the dashboard uses (failed-emails.ts): a failed email to the client stays flagged
// until a later message email reaches the client, at whatever address they had when it went
function unresolvedFailures<T extends { emailTo: string | null; emailStatus: string | null }>(rows: T[]): T[] {
  return rows.filter(
    (row, index) => row.emailStatus === 'failed' && row.emailTo !== STUDIO_EMAIL && !rows.slice(index + 1).some(reachedClient),
  );
}

/* ---------- Read state ---------- */

interface MarkReadInput {
  userId: string;
  projectId: string;
  readerSide: Side;
  // The newest message the reader had on screen. Anything from the other side that arrived
  // after it stays unread, so a reply landing between render and this call is not lost.
  shownMessageId: string | null;
}

export async function markThreadRead({ userId, projectId, readerSide, shownMessageId }: MarkReadInput): Promise<{ hadUnread: boolean }> {
  const db = getDb();
  const unreadExists = db
    .select({ id: message.id })
    .from(message)
    .innerJoin(author, eq(author.id, message.authorId))
    .leftJoin(projectReadState, and(eq(projectReadState.projectId, message.projectId), eq(projectReadState.userId, userId)))
    .where(
      and(
        eq(message.projectId, projectId),
        fromOtherSide(readerSide),
        or(isNull(projectReadState.messagesReadAt), gt(message.createdAt, projectReadState.messagesReadAt)),
      ),
    )
    .limit(1);
  const [unread] = await unreadExists;

  const shown = db
    .select({ at: message.createdAt })
    .from(message)
    .where(
      and(
        shownMessageId ? eq(message.id, shownMessageId) : sql`false`,
        eq(message.projectId, projectId),
        readerSide === 'client' ? eq(message.internal, false) : undefined,
      ),
    );
  const firstMissed = db
    .select({ at: sql`min(${message.createdAt}) - interval '1 microsecond'` })
    .from(message)
    .innerJoin(author, eq(author.id, message.authorId))
    .where(
      and(
        eq(message.projectId, projectId),
        fromOtherSide(readerSide),
        gt(message.createdAt, sql`coalesce((${shown}), '-infinity'::timestamptz)`),
      ),
    );

  // Read up to now, or to just before the first message the reader has not been shown
  await db
    .insert(projectReadState)
    .values({ userId, projectId, messagesReadAt: sql`coalesce((${firstMissed}), now())` })
    .onConflictDoUpdate({
      target: [projectReadState.userId, projectReadState.projectId],
      set: { messagesReadAt: sql`greatest(${projectReadState.messagesReadAt}, excluded.messages_read_at)` },
    });
  return { hadUnread: Boolean(unread) };
}

/* ---------- Email throttle ----------
   At most one email per conversation and recipient every 10 minutes. The activity rows are
   the record (a sent email in the last 10 minutes skips the next one); the slot makes two
   messages sent at the same moment agree on which of them emails. */

const EMAIL_GAP_MS = 10 * 60 * 1000;
const threadEmailKey = (projectId: string, to: string) => `portal:message-email:${projectId}:${to}`;

export async function threadEmailSlot(projectId: string, to: string): Promise<RateSlot> {
  const key = threadEmailKey(projectId, to);
  const [recent] = await getDb()
    .select({ id: activity.id })
    .from(activity)
    .where(
      and(
        eq(activity.projectId, projectId),
        eq(activity.kind, MESSAGE_KIND),
        eq(activity.emailTo, to),
        eq(activity.emailStatus, 'sent'),
        gte(activity.createdAt, sql`now() - interval '10 minutes'`),
      ),
    )
    .limit(1);
  if (recent) return { ok: false, key, waitMinutes: 10 };
  return claimRateSlot(key, EMAIL_GAP_MS);
}

/* ---------- Emails ---------- */

const QUOTE_LIMIT = 2000;

function quoted(body: string): { quote: string; cut: boolean } {
  if (body.length <= QUOTE_LIMIT) return { quote: body, cut: false };
  return { quote: `${body.slice(0, QUOTE_LIMIT).trimEnd()}…`, cut: true };
}

interface ClientMessageEmailInput {
  clientName: string;
  projectName: string;
  body: string;
  url: string;
}

// To the studio, when the client writes
export function clientMessageEmail(input: ClientMessageEmailInput): { subject: string; content: EmailContent } {
  const { quote, cut } = quoted(input.body);
  return {
    subject: studioSubject(`${input.clientName} sent a message`, input.projectName),
    content: {
      heading: `${input.clientName} sent a message`,
      paragraphs: [`${input.clientName} wrote about ${input.projectName}:`],
      quote,
      action: { label: 'Reply in the portal', url: input.url },
      footnotes: [
        ...(cut ? ['The message is longer than this; the rest is in the portal.'] : []),
        'Anything else they write in the next 10 minutes is in the portal, without another email.',
      ],
    },
  };
}

interface StudioMessageEmailInput {
  authorName: string;
  clientName: string | null;
  projectName: string;
  body: string;
  url: string;
}

// To the client, when the studio writes. No reply-to: replies belong in the portal thread.
export function studioMessageEmail(input: StudioMessageEmailInput): { subject: string; content: EmailContent } {
  const { quote, cut } = quoted(input.body);
  const name = firstName(input.clientName);
  const asStudio = input.authorName === STUDIO_NAME;
  const from = asStudio ? STUDIO_NAME : `${input.authorName} at ${STUDIO_NAME}`;
  return {
    subject: `New message from ${from}`,
    content: {
      heading: `${asStudio ? 'We sent' : `${input.authorName} sent`} you a message`,
      paragraphs: [name ? `Hi ${name},` : 'Hello,', `There's a new message about ${input.projectName} in your portal:`],
      quote,
      action: { label: 'Reply in the portal', url: input.url },
      footnotes: [
        ...(cut ? ['The message is longer than this; the rest is in your portal.'] : []),
        'Reply in your portal, so the whole conversation stays in one place.',
        "If we write again in the next few minutes, you'll find it there rather than in another email.",
        `You're getting this because you're the client on ${input.projectName}.`,
      ],
    },
  };
}

/* ---------- Attention ---------- */

const client = alias(user, 'client');
const clientLabel = sql<string>`coalesce(nullif(${client.name}, ''), ${client.email})`;

async function unreadByProject(context: FeatureContext) {
  const readerSide: Side = context.perspective;
  // The client's own visits decide what is new for them, also while the studio previews
  const readerId = readerSide === 'studio' ? eq(projectReadState.userId, context.viewer.user.id) : eq(projectReadState.userId, project.clientId);
  return getDb()
    .select({
      projectId: project.id,
      projectName: project.name,
      clientName: clientLabel,
      count: sql<number>`count(*)::int`,
      oldestAt: sql<Date>`min(${message.createdAt})`.mapWith(message.createdAt),
      oldestId: sql<string>`(array_agg(${message.id} order by ${message.createdAt}, ${message.id}))[1]`,
      latestBody: sql<string>`(array_agg(${message.body} order by ${message.createdAt} desc, ${message.id} desc))[1]`,
    })
    .from(message)
    .innerJoin(project, eq(project.id, message.projectId))
    .innerJoin(author, eq(author.id, message.authorId))
    .innerJoin(client, eq(client.id, project.clientId))
    .leftJoin(projectReadState, and(eq(projectReadState.projectId, message.projectId), readerId))
    .where(
      and(
        projectScope(context),
        fromOtherSide(readerSide),
        or(isNull(projectReadState.messagesReadAt), gt(message.createdAt, projectReadState.messagesReadAt)),
      ),
    )
    .groupBy(project.id, project.name, client.name, client.email);
}

function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 140 ? `${flat.slice(0, 140).trimEnd()}…` : flat;
}

// Message emails that never arrived, flagged as every feature flags them (failed-emails.ts)
async function failedEmailItems(context: FeatureContext): Promise<AttentionItem[]> {
  const rows = await failedEmails(context, { kinds: FLAGGED_EMAIL_KINDS.message, subjectOf: () => null });
  return rows.map((row) => ({
    key: `message-email:${row.id}`,
    projectId: row.projectId,
    projectName: row.projectName,
    tab: 'messages' as const,
    title: failedEmailTitle(row.who, 'a new message'),
    detail: row.summary,
    since: row.createdAt.toISOString(),
    tone: 'alert' as const,
  }));
}

export const messagesFeature: PortalFeature = {
  async attention(context) {
    const studio = context.perspective === 'studio';
    const [unread, failed] = await Promise.all([unreadByProject(context), studio ? failedEmailItems(context) : Promise.resolve([])]);
    const items: AttentionItem[] = unread.map((row) => ({
      key: `messages-unread:${row.projectId}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'messages',
      anchor: messageAnchor(row.oldestId),
      title: studio
        ? row.count === 1
          ? `${row.clientName} sent a message`
          : `${row.clientName} sent ${row.count} messages`
        : row.count === 1
          ? '1 new message from the studio'
          : `${row.count} new messages from the studio`,
      detail: excerpt(row.latestBody),
      since: row.oldestAt.toISOString(),
      tone: 'action',
    }));
    return [...items, ...failed];
  },

  // Conversations have no due dates
  deadlines: async () => [],
};

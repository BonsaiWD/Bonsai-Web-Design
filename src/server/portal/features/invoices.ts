import 'server-only';
import { randomUUID } from 'node:crypto';
import { cache } from 'react';
import { and, asc, desc, eq, inArray, isNotNull, like, ne, or, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { activity, invoice, invoiceItem, paymentMethodSetting, project, rateLimit, user, type PaymentMethod } from '@/db/schema';
import { isOverdue, METHOD_LABELS, METHOD_ORDER } from '@/components/portal/invoices/labels';
import { lineAmountCents } from '@/components/portal/invoices/money';
import type {
  InvoiceDetail,
  InvoiceHistoryEntry,
  InvoiceLine,
  InvoiceSummary,
  PaymentMethodView,
  Perspective,
} from '@/components/portal/invoices/types';
import { projectHref } from '@/components/portal/tabs';
import type { EmailContent } from '@/lib/email';
import { firstName, formatDate, formatMoney } from '@/lib/portal-format';
import { adminActor, isUuid, projectActor } from '../access';
import { projectScope, type AttentionItem, type DeadlineItem, type FeatureContext, type PortalFeature } from '../attention';
import { portalOrigin, STUDIO_EMAIL } from '../notify';

type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const STUDIO_NAME = 'Bonsai Web Design';

/* ---------- Shared by the pages, the provider and the actions ---------- */

// Changes on every save (to the microsecond), so an edit or a send from a stale page is refused
export const invoiceVersion = sql<string>`to_char(${invoice.updatedAt} at time zone 'UTC', 'YYYYMMDDHH24MISSUS')`;

export const invoiceAnchor = (invoiceId: string) => `invoice-${invoiceId}`;

export function invoicePath(projectId: string, invoiceId: string): string {
  return `${projectHref(projectId, 'invoices')}/${invoiceId}`;
}

export async function invoiceUrl(projectId: string, invoiceId: string): Promise<string> {
  return `${await portalOrigin()}${invoicePath(projectId, invoiceId)}`;
}

// Studio actions on a project: the signed-in user must be an admin, and the project must exist
export async function studioProjectActor(projectId: unknown) {
  await adminActor();
  return projectActor(projectId);
}

/* ---------- Activity kinds ----------
   Rows carry the invoice id in their kind ("invoice.sent:<id>"), so the page can show an
   invoice's history and when its client was last emailed. `target` stays the tab name, as
   every feed expects. */

const KINDS = {
  created: 'invoice.created',
  updated: 'invoice.updated',
  deleted: 'invoice.deleted',
  sent: 'invoice.sent',
  reminded: 'invoice.reminded',
  reported: 'invoice.payment_reported',
  notReceived: 'invoice.not_received',
  paid: 'invoice.paid',
  voided: 'invoice.voided',
} as const;

export function activityKind(event: keyof typeof KINDS, invoiceId: string): string {
  return `${KINDS[event]}:${invoiceId}`;
}

// Emails that go to the client; the newest one failing is flagged for the studio
const CLIENT_EMAIL_KINDS = [KINDS.sent, KINDS.reminded, KINDS.notReceived, KINDS.paid];

/* ---------- Email throttle ----------
   One email to the client per invoice every ten minutes, so a double click or an eager
   reminder cannot flood their inbox. Kept in the rate_limit table so it holds across instances. */

export const EMAIL_INTERVAL_MS = 10 * 60 * 1000;

const emailSlotKey = (invoiceId: string) => `portal:invoice-email:${invoiceId}`;

export async function claimEmailSlot(invoiceId: string, db: Db | Tx = getDb()): Promise<boolean> {
  const now = Date.now();
  const claimed = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key: emailSlotKey(invoiceId), count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: sql`${rateLimit.count} + 1`, lastRequest: now },
      setWhere: sql`${rateLimit.lastRequest} < ${now - EMAIL_INTERVAL_MS}`,
    })
    .returning({ id: rateLimit.id });
  return claimed.length > 0;
}

// An email that did not go out should not block the next try
export async function releaseEmailSlot(invoiceId: string): Promise<void> {
  await getDb()
    .delete(rateLimit)
    .where(eq(rateLimit.key, emailSlotKey(invoiceId)))
    .catch(() => undefined);
}

/* ---------- Totals ---------- */

async function totalsFor(invoiceIds: string[]): Promise<Map<string, { totalCents: number; lineCount: number }>> {
  const totals = new Map<string, { totalCents: number; lineCount: number }>();
  if (invoiceIds.length === 0) return totals;
  const items = await getDb()
    .select({ invoiceId: invoiceItem.invoiceId, quantity: invoiceItem.quantity, unitAmountCents: invoiceItem.unitAmountCents })
    .from(invoiceItem)
    .where(inArray(invoiceItem.invoiceId, invoiceIds));
  for (const item of items) {
    const entry = totals.get(item.invoiceId) ?? { totalCents: 0, lineCount: 0 };
    entry.totalCents += lineAmountCents(Number(item.quantity), item.unitAmountCents);
    entry.lineCount += 1;
    totals.set(item.invoiceId, entry);
  }
  return totals;
}

/* ---------- Page data ---------- */

const summaryColumns = {
  id: invoice.id,
  number: invoice.number,
  title: invoice.title,
  status: invoice.status,
  issuedOn: invoice.issuedOn,
  dueOn: invoice.dueOn,
  paidOn: invoice.paidOn,
  reportedAt: invoice.reportedAt,
};

export async function loadInvoiceList(projectId: string, perspective: Perspective): Promise<InvoiceSummary[]> {
  const rows = await getDb()
    .select(summaryColumns)
    .from(invoice)
    // Drafts are the studio's working copies: the client's query never returns them
    .where(and(eq(invoice.projectId, projectId), perspective === 'studio' ? undefined : ne(invoice.status, 'draft')))
    .orderBy(desc(invoice.createdAt), desc(invoice.number));
  const totals = await totalsFor(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    reportedAt: row.reportedAt?.toISOString() ?? null,
    totalCents: totals.get(row.id)?.totalCents ?? 0,
    lineCount: totals.get(row.id)?.lineCount ?? 0,
  }));
}

// Cached per request: generateMetadata and the page read the same invoice
export const loadInvoice = cache(async (projectId: string, invoiceId: string, perspective: Perspective): Promise<InvoiceDetail | null> => {
  if (!isUuid(invoiceId)) return null;
  const db = getDb();
  const studio = perspective === 'studio';

  const [row] = await db
    .select({
      ...summaryColumns,
      notes: invoice.notes,
      reportedMethod: invoice.reportedMethod,
      reportedReference: invoice.reportedReference,
      paidMethod: invoice.paidMethod,
      paidReference: invoice.paidReference,
      createdAt: invoice.createdAt,
      createdByName: user.name,
      version: invoiceVersion,
    })
    .from(invoice)
    .leftJoin(user, eq(user.id, invoice.createdBy))
    .where(and(eq(invoice.id, invoiceId), eq(invoice.projectId, projectId), studio ? undefined : ne(invoice.status, 'draft')))
    .limit(1);
  if (!row) return null;

  const items = await db
    .select({ id: invoiceItem.id, description: invoiceItem.description, quantity: invoiceItem.quantity, unitAmountCents: invoiceItem.unitAmountCents })
    .from(invoiceItem)
    .where(eq(invoiceItem.invoiceId, row.id))
    .orderBy(asc(invoiceItem.position), asc(invoiceItem.id));
  const lines: InvoiceLine[] = items.map((item) => {
    const quantity = Number(item.quantity);
    return { ...item, quantity, amountCents: lineAmountCents(quantity, item.unitAmountCents) };
  });
  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);

  const detail: InvoiceDetail = {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    issuedOn: row.issuedOn,
    dueOn: row.dueOn,
    paidOn: row.paidOn,
    reportedAt: row.reportedAt?.toISOString() ?? null,
    totalCents,
    subtotalCents: totalCents,
    lineCount: lines.length,
    notes: row.notes,
    lines,
    reported:
      row.status === 'payment_reported' && row.reportedMethod && row.reportedAt
        ? { method: row.reportedMethod, reference: row.reportedReference, at: row.reportedAt.toISOString() }
        : null,
    paid: row.status === 'paid' && row.paidOn && row.paidMethod ? { on: row.paidOn, method: row.paidMethod, reference: row.paidReference } : null,
  };
  if (!studio) return detail;

  const [history, [slot]] = await Promise.all([
    db
      .select({ id: activity.id, kind: activity.kind, summary: activity.summary, at: activity.createdAt, emailTo: activity.emailTo, emailStatus: activity.emailStatus })
      .from(activity)
      .where(and(eq(activity.projectId, projectId), like(activity.kind, `invoice.%:${row.id}`)))
      .orderBy(desc(activity.createdAt)),
    db.select({ lastRequest: rateLimit.lastRequest }).from(rateLimit).where(eq(rateLimit.key, emailSlotKey(row.id))),
  ]);
  const lastClientEmail = history.find((entry) => entry.emailTo && CLIENT_EMAIL_KINDS.some((kind) => entry.kind.startsWith(`${kind}:`)));
  const nextEmail = slot ? slot.lastRequest + EMAIL_INTERVAL_MS : 0;

  detail.studio = {
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdByName,
    lastEmailedAt: lastClientEmail?.at.toISOString() ?? null,
    lastEmailFailed: lastClientEmail?.emailStatus === 'failed',
    nextEmailAt: nextEmail > Date.now() ? new Date(nextEmail).toISOString() : null,
    history: history.map(
      (entry): InvoiceHistoryEntry => ({
        id: entry.id,
        summary: entry.summary,
        at: entry.at.toISOString(),
        emailTo: entry.emailTo,
        emailStatus: entry.emailStatus,
      }),
    ),
  };
  return detail;
});

function inMethodOrder<T extends { method: PaymentMethod }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method));
}

// The ways to pay shown on invoices: only methods the studio turned on and filled in
export async function loadEnabledPaymentMethods(): Promise<PaymentMethodView[]> {
  const rows = await getDb()
    .select({ method: paymentMethodSetting.method, enabled: paymentMethodSetting.enabled, instructions: paymentMethodSetting.instructions })
    .from(paymentMethodSetting)
    .where(and(eq(paymentMethodSetting.enabled, true), ne(paymentMethodSetting.instructions, '')));
  return inMethodOrder(rows);
}

export const settingsVersion = sql<string>`coalesce(to_char(max(${paymentMethodSetting.updatedAt}) at time zone 'UTC', 'YYYYMMDDHH24MISSUS'), '')`;

// Every method for the settings page, with a version so a save over someone else's is refused
export async function loadPaymentSettings(): Promise<{ methods: PaymentMethodView[]; version: string }> {
  const db = getDb();
  const [rows, [{ version }]] = await Promise.all([
    db
      .select({ method: paymentMethodSetting.method, enabled: paymentMethodSetting.enabled, instructions: paymentMethodSetting.instructions })
      .from(paymentMethodSetting),
    db.select({ version: settingsVersion }).from(paymentMethodSetting),
  ]);
  // The migration seeds all six; fill any that are missing so the page always lists the owner's set
  const byMethod = new Map(rows.map((row) => [row.method, row]));
  const methods = METHOD_ORDER.map((method) => byMethod.get(method) ?? { method, enabled: false, instructions: '' });
  return { methods, version };
}

/* ---------- Emails ---------- */

// "Nov 8, 2026, 3:04 PM UTC": emails cannot know the reader's time zone, so they say UTC
const utcMoment = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

export function formatUtc(value: Date): string {
  return utcMoment.format(value);
}

interface InvoiceFacts {
  number: string;
  title: string;
  totalCents: number;
  dueOn: string | null;
  projectName: string;
  clientName: string | null;
  url: string;
}

type Email = { subject: string; content: EmailContent };

const greeting = (clientName: string | null) => {
  const first = firstName(clientName);
  return first ? [`Hi ${first},`] : [];
};

export function sentEmail(facts: InvoiceFacts): Email {
  return {
    subject: `Invoice ${facts.number} from ${STUDIO_NAME}`,
    content: {
      heading: `Invoice ${facts.number}: ${formatMoney(facts.totalCents)}`,
      paragraphs: [
        ...greeting(facts.clientName),
        `Here is invoice ${facts.number} for ${facts.title} on ${facts.projectName}.`,
        `Amount due: ${formatMoney(facts.totalCents)}`,
        ...(facts.dueOn ? [`Due: ${formatDate(facts.dueOn)}`] : []),
        "The portal has the line items and how to pay. Once you've sent the payment, tell us there and we'll confirm when it arrives.",
      ],
      action: { label: 'View and pay the invoice', url: facts.url },
      footnotes: ['Questions about this invoice? Message us in the portal and we will help.'],
    },
  };
}

export function reminderEmail(facts: InvoiceFacts, today: string): Email {
  const overdue = Boolean(facts.dueOn && facts.dueOn < today);
  return {
    subject: overdue ? `Invoice ${facts.number} is past due` : `Reminder: invoice ${facts.number}`,
    content: {
      heading: overdue ? `Invoice ${facts.number} is past due` : `A reminder about invoice ${facts.number}`,
      paragraphs: [
        ...greeting(facts.clientName),
        overdue && facts.dueOn
          ? `Invoice ${facts.number} for ${facts.title} was due ${formatDate(facts.dueOn)}, and we haven't received the payment yet.`
          : `This is a reminder about invoice ${facts.number} for ${facts.title}${facts.dueOn ? `, due ${formatDate(facts.dueOn)}` : ''}.`,
        `Amount due: ${formatMoney(facts.totalCents)}`,
        "If you've already paid, thank you: tell us in the portal and we'll match it up.",
      ],
      action: { label: 'View and pay the invoice', url: facts.url },
    },
  };
}

export function paymentReportedEmail(facts: InvoiceFacts & { reporter: string; reporterEmail: string; method: PaymentMethod; reference: string | null; at: Date }): Email {
  return {
    subject: `${facts.reporter} reported a payment on ${facts.number}`,
    content: {
      heading: `Payment reported on ${facts.number}`,
      paragraphs: [
        `${facts.reporter} (${facts.reporterEmail}) says they have paid ${facts.number} for ${facts.title} on ${facts.projectName}.`,
        `Amount: ${formatMoney(facts.totalCents)}`,
        `Method: ${METHOD_LABELS[facts.method]}`,
        `Reference: ${facts.reference ?? 'none given'}`,
        `Reported: ${formatUtc(facts.at)}`,
        'Check that it has arrived, then mark the invoice paid in the portal to send their receipt.',
      ],
      action: { label: 'Open the invoice', url: facts.url },
    },
  };
}

export function receiptEmail(facts: InvoiceFacts & { paidOn: string; method: PaymentMethod; reference: string | null }): Email {
  return {
    subject: `Receipt for invoice ${facts.number}`,
    content: {
      heading: `Thank you, ${facts.number} is paid`,
      paragraphs: [
        ...greeting(facts.clientName),
        `We've received your payment for invoice ${facts.number}. Here is your receipt.`,
        `Invoice: ${facts.number}, ${facts.title}`,
        `Amount paid: ${formatMoney(facts.totalCents)}`,
        `Paid on: ${formatDate(facts.paidOn)}`,
        `Method: ${METHOD_LABELS[facts.method]}`,
        ...(facts.reference ? [`Reference: ${facts.reference}`] : []),
      ],
      action: { label: 'View the receipt', url: facts.url },
      footnotes: ['You can print or save the invoice as a PDF from the portal at any time.'],
    },
  };
}

export function notReceivedEmail(facts: InvoiceFacts & { note: string }): Email {
  return {
    subject: `About your payment for invoice ${facts.number}`,
    content: {
      heading: `We haven't received the payment for ${facts.number} yet`,
      paragraphs: [
        ...greeting(facts.clientName),
        `Thanks for telling us you paid invoice ${facts.number}. We haven't seen it arrive yet, so the invoice is open again. Here's our note:`,
      ],
      quote: facts.note,
      action: { label: 'View the invoice', url: facts.url },
      footnotes: ['If you think this is a mistake, reply in the portal and we will look into it with you.'],
    },
  };
}

/* ---------- Attention and deadlines ---------- */

// The open invoices each context can see, with totals. Cached per request: the attention
// items and the deadlines read the same rows.
const scopedOpenInvoices = cache(async (context: FeatureContext) => {
  const rows = await getDb()
    .select({
      id: invoice.id,
      number: invoice.number,
      title: invoice.title,
      status: invoice.status,
      issuedOn: invoice.issuedOn,
      dueOn: invoice.dueOn,
      reportedAt: invoice.reportedAt,
      reportedMethod: invoice.reportedMethod,
      projectId: project.id,
      projectName: project.name,
      clientName: user.name,
      clientEmail: user.email,
    })
    .from(invoice)
    .innerJoin(project, eq(project.id, invoice.projectId))
    .innerJoin(user, eq(user.id, project.clientId))
    .where(and(projectScope(context), inArray(invoice.status, ['sent', 'payment_reported'])))
    .orderBy(asc(invoice.dueOn), asc(invoice.number));
  const totals = await totalsFor(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, totalCents: totals.get(row.id)?.totalCents ?? 0 }));
});

async function attention(context: FeatureContext): Promise<AttentionItem[]> {
  const rows = await scopedOpenInvoices(context);
  const items: AttentionItem[] = [];
  const base = (row: (typeof rows)[number]) => ({
    projectId: row.projectId,
    projectName: row.projectName,
    tab: 'invoices' as const,
    anchor: invoiceAnchor(row.id),
  });

  if (context.perspective === 'client') {
    for (const row of rows) {
      if (row.status !== 'sent') continue;
      items.push({
        ...base(row),
        key: `invoice-due:${row.id}`,
        title: `Pay invoice ${row.number} (${formatMoney(row.totalCents)})`,
        detail: row.title,
        due: row.dueOn,
        since: row.issuedOn ? `${row.issuedOn}T00:00:00.000Z` : null,
        tone: isOverdue(row.status, row.dueOn, context.today) ? 'alert' : 'action',
      });
    }
    return items;
  }

  for (const row of rows) {
    const client = row.clientName || row.clientEmail;
    if (row.status === 'payment_reported') {
      items.push({
        ...base(row),
        key: `invoice-reported:${row.id}`,
        title: `${client} reported a payment on ${row.number}`,
        detail: `${formatMoney(row.totalCents)}${row.reportedMethod ? ` by ${METHOD_LABELS[row.reportedMethod]}` : ''}. Confirm it arrived, then mark it paid.`,
        since: row.reportedAt?.toISOString() ?? null,
        tone: 'action',
      });
    } else if (isOverdue(row.status, row.dueOn, context.today)) {
      items.push({
        ...base(row),
        key: `invoice-overdue:${row.id}`,
        title: `${row.number} is overdue`,
        detail: `${client} · ${formatMoney(row.totalCents)}`,
        due: row.dueOn,
        tone: 'alert',
      });
    }
  }

  // The newest email to the client about each invoice; if it failed, the client may not know
  const invoiceIdOfKind = sql<string>`split_part(${activity.kind}, ':', 2)`;
  const newestEmails = await getDb()
    .selectDistinctOn([invoiceIdOfKind], {
      id: activity.id,
      emailStatus: activity.emailStatus,
      emailTo: activity.emailTo,
      summary: activity.summary,
      createdAt: activity.createdAt,
      invoiceId: invoice.id,
      number: invoice.number,
      status: invoice.status,
      projectId: project.id,
      projectName: project.name,
    })
    .from(activity)
    .innerJoin(invoice, and(sql`${invoice.id}::text = ${invoiceIdOfKind}`, eq(invoice.projectId, activity.projectId)))
    .innerJoin(project, eq(project.id, invoice.projectId))
    .where(
      and(
        projectScope(context),
        isNotNull(activity.emailTo),
        or(...CLIENT_EMAIL_KINDS.map((kind) => like(activity.kind, `${kind}:%`))),
      ),
    )
    .orderBy(invoiceIdOfKind, desc(activity.createdAt));
  for (const row of newestEmails) {
    if (row.emailStatus !== 'failed' || row.status === 'void') continue;
    items.push({
      key: `invoice-email:${row.id}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'invoices',
      anchor: invoiceAnchor(row.invoiceId),
      title: `The email about ${row.number} to ${row.emailTo} could not be sent`,
      detail: row.summary,
      since: row.createdAt.toISOString(),
      tone: 'alert',
    });
  }
  return items;
}

async function deadlines(context: FeatureContext): Promise<DeadlineItem[]> {
  const rows = await scopedOpenInvoices(context);
  return rows
    .filter((row) => row.status === 'sent' && row.dueOn)
    .map((row) => ({
      key: `invoice:${row.id}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'invoices' as const,
      anchor: invoiceAnchor(row.id),
      title: `Invoice ${row.number} (${formatMoney(row.totalCents)})`,
      date: row.dueOn as string,
      kind: 'invoice' as const,
      // Paying is the client's step; once they report it, the date is no longer theirs to meet
      owner: 'client' as const,
    }));
}

export const invoicesFeature: PortalFeature = { attention, deadlines };


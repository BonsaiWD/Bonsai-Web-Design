'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { invoice, invoiceItem, paymentMethod, type InvoiceStatus } from '@/db/schema';
import { METHOD_LABELS } from '@/components/portal/invoices/labels';
import { invoiceTotalCents, MAX_LINES, parseDollars, parseQuantity } from '@/components/portal/invoices/money';
import { projectHref } from '@/components/portal/tabs';
import { firstName, formatDate, formatMoney, todayIso } from '@/lib/portal-format';
import { assertStillClient, projectActor, studioProjectActor, type ProjectActor, type Tx } from '@/server/portal/access';
import { ActionError, done, fields, lf, parseForm, runAction, type ActionState } from '@/server/portal/actions';
import {
  invoiceKind,
  EMAIL_INTERVAL_MS,
  invoiceEmailKey,
  invoicePath,
  invoiceUrl,
  invoiceVersion,
  loadEnabledPaymentMethods,
  loadNotReceived,
  notReceivedEmail,
  notReceivedSummary,
  paymentReportedEmail,
  receiptEmail,
  reminderEmail,
  sentEmail,
} from '@/server/portal/features/invoices';
import { emailedSummary, emailNote, receiptSummary, recordActivity, STUDIO_EMAIL } from '@/server/portal/notify';
import { claimRateSlot, forceRateSlot, releaseRateSlot } from '@/server/portal/throttle';

/*
 * Every export here is an endpoint anyone can call with any arguments, so each one starts by
 * checking who is asking. Forms send ids and the person's own words; who acted comes from the
 * session, and every invoice is matched to the actor's project before anything is read or written.
 */

const NOT_FOUND = 'That invoice could not be found. Reload the page.';
const CHECK = 'Check the highlighted fields and try again.';

/* ---------- Form fields ---------- */

const title = fields.requiredText('a title', 200);
const notes = fields.optionalText('the notes', 4000).transform(lf);

// A typo such as year 0202 would otherwise sort to the top of every deadline list
const inRange = (value: string | null) => !value || (value >= '2000-01-01' && value <= '2100-12-31');
const optionalDay = fields.optionalDate.refine(inRange, { error: 'Choose a date between 2000 and 2100.' });

const method = z.enum(paymentMethod.enumValues, { error: 'Choose how it was paid.' });
const reference = fields.optionalText('the reference', 200);

const ids = { invoiceId: fields.uuid, projectId: fields.uuid };

/* ---------- Helpers ---------- */

function refresh(projectId: string) {
  // The layout carries the tab badges; /portal holds the dashboards
  revalidatePath(projectHref(projectId), 'layout');
  revalidatePath('/portal');
}

const clientNameOf = (actor: ProjectActor) => actor.project.clientName || actor.project.clientEmail;

// Locks the invoice inside the actor's project, so concurrent sends, edits and payments queue up
async function lockInvoice(tx: Tx, projectId: string, invoiceId: string) {
  const [row] = await tx
    .select({
      id: invoice.id,
      number: invoice.number,
      title: invoice.title,
      status: invoice.status,
      issuedOn: invoice.issuedOn,
      dueOn: invoice.dueOn,
      reportedMethod: invoice.reportedMethod,
      reportedReference: invoice.reportedReference,
      version: invoiceVersion,
    })
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.projectId, projectId)))
    .for('update');
  if (!row) throw new ActionError(NOT_FOUND);
  return row;
}

async function totalOf(db: Tx | ReturnType<typeof getDb>, invoiceId: string) {
  const lines = await db
    .select({ quantity: invoiceItem.quantity, unitAmountCents: invoiceItem.unitAmountCents })
    .from(invoiceItem)
    .where(eq(invoiceItem.invoiceId, invoiceId));
  return { totalCents: invoiceTotalCents(lines.map((line) => ({ ...line, quantity: Number(line.quantity) }))), lineCount: lines.length };
}

async function facts(actor: ProjectActor, row: { id: string; number: string; title: string; dueOn: string | null }, totalCents: number) {
  return {
    number: row.number,
    title: row.title,
    totalCents,
    dueOn: row.dueOn,
    projectName: actor.project.name,
    clientName: actor.project.clientName,
    url: await invoiceUrl(actor.project.id, row.id),
  };
}

// Why an action cannot run on an invoice in its current state, in words for the studio
function wrongState(row: { number: string; status: InvoiceStatus }, wanted: string): never {
  const reasons: Record<InvoiceStatus, string> = {
    draft: `${row.number} is still a draft. Send it to the client first.`,
    sent: `${row.number} has been sent, so it can no longer be ${wanted}.`,
    payment_reported: `The client has reported a payment on ${row.number}. Mark it paid, or choose Not received if it didn't arrive.`,
    paid: `${row.number} is paid, so it can no longer be ${wanted}.`,
    void: `${row.number} is void, so it can no longer be ${wanted}.`,
  };
  throw new ActionError(reasons[row.status]);
}

/* ---------- Line items ----------
   Each editor row has its own field names ("item.<key>.quantity"), so the values of every row
   come back after an error. Rows arrive in the order they appear on the page. */

const ITEM_FIELD = /^item\.([A-Za-z0-9_-]{1,40})\.(description|quantity|unitPrice)$/;

interface ParsedLine {
  description: string;
  quantity: number;
  unitAmountCents: number;
}

function parseLines(formData: FormData): { lines: ParsedLine[]; errors: Record<string, string> } {
  const rows = new Map<string, { description: string; quantity: string; unitPrice: string }>();
  for (const [key, value] of formData.entries()) {
    const match = ITEM_FIELD.exec(key);
    if (!match || typeof value !== 'string') continue;
    const row = rows.get(match[1]) ?? { description: '', quantity: '', unitPrice: '' };
    row[match[2] as 'description' | 'quantity' | 'unitPrice'] = value;
    rows.set(match[1], row);
  }

  const lines: ParsedLine[] = [];
  const errors: Record<string, string> = {};
  for (const [key, row] of rows) {
    const description = row.description.replace(/\s+/g, ' ').trim();
    // A row with no description and no price is a spare (its quantity starts at 1), not a mistake
    if (!description && !row.unitPrice.trim()) continue;
    const name = (field: string) => `item.${key}.${field}`;
    if (!description) errors[name('description')] = 'Describe this line.';
    else if (description.length > 300) errors[name('description')] = 'Keep the description under 300 characters.';
    const quantity = parseQuantity(row.quantity);
    if (!quantity.ok) errors[name('quantity')] = quantity.error;
    const price = parseDollars(row.unitPrice);
    if (!price.ok) errors[name('unitPrice')] = price.error;
    if (description && quantity.ok && price.ok) lines.push({ description, quantity: quantity.value, unitAmountCents: price.value });
  }
  if (rows.size > MAX_LINES) errors.form = `An invoice can have up to ${MAX_LINES} lines.`;
  return { lines, errors };
}

// The invoice fields and its lines, with every problem reported at once
function parseInvoiceForm<S extends z.ZodType<{ issuedOn: string | null; dueOn: string | null }>>(schema: S, formData: FormData) {
  const { lines, errors } = parseLines(formData);
  let input: z.infer<S>;
  try {
    input = parseForm(schema, formData);
  } catch (error) {
    if (error instanceof ActionError && Object.keys(errors).length) throw new ActionError(CHECK, { ...errors, ...error.fieldErrors });
    throw error;
  }
  if (input.issuedOn && input.dueOn && input.dueOn < input.issuedOn) errors.dueOn = 'Choose a due date on or after the issue date.';
  if (errors.form) throw new ActionError(errors.form, errors);
  if (Object.keys(errors).length) throw new ActionError(CHECK, errors);
  return { input, lines };
}

/* ---------- Studio: create, edit, delete drafts ---------- */

const createSchema = z.object({ id: fields.uuid, projectId: fields.uuid, title, issuedOn: optionalDay, dueOn: optionalDay, notes });

export async function createInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioProjectActor(formData.get('projectId'));
    const { input, lines } = parseInvoiceForm(createSchema, formData);
    const projectId = actor.project.id;
    const db = getDb();

    // A second submit of the same form lands on the invoice the first one made. Checked before
    // the insert, because a conflicting insert would still use up an invoice number.
    const [existing] = await db.select({ projectId: invoice.projectId }).from(invoice).where(eq(invoice.id, input.id));
    if (existing) {
      if (existing.projectId !== projectId) throw new ActionError('That invoice could not be saved. Reload the page and try again.');
      redirect(invoicePath(projectId, input.id));
    }

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(invoice)
        .values({
          id: input.id,
          projectId,
          title: input.title,
          issuedOn: input.issuedOn,
          dueOn: input.dueOn,
          notes: input.notes,
          createdBy: actor.user.id,
        })
        .onConflictDoNothing({ target: invoice.id })
        .returning({ number: invoice.number });
      if (!row) return null;
      if (lines.length) {
        await tx.insert(invoiceItem).values(lines.map((line, index) => ({ invoiceId: input.id, ...line, position: index + 1 })));
      }
      return row;
    });

    if (created) {
      await recordActivity({
        projectId,
        actorId: actor.user.id,
        kind: invoiceKind('created', input.id),
        summary: `Drafted invoice ${created.number}: ${input.title}`,
        target: 'invoices',
        visibility: 'studio',
      });
      refresh(projectId);
    }
    // The draft's own page is where it is checked and sent
    redirect(invoicePath(projectId, input.id));
  });
}

const updateSchema = z.object({ ...ids, version: z.string().min(1), title, issuedOn: optionalDay, dueOn: optionalDay, notes });

export async function updateInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioProjectActor(formData.get('projectId'));
    const { input, lines } = parseInvoiceForm(updateSchema, formData);
    const projectId = actor.project.id;

    const number = await getDb().transaction(async (tx) => {
      const row = await lockInvoice(tx, projectId, input.invoiceId);
      if (row.status !== 'draft') wrongState(row, 'edited');
      if (row.version !== input.version) {
        throw new ActionError('This draft changed after you opened it. Reload the page to see the latest, then make your edit again.');
      }
      await tx
        .update(invoice)
        .set({ title: input.title, issuedOn: input.issuedOn, dueOn: input.dueOn, notes: input.notes })
        .where(eq(invoice.id, row.id));
      // Drafts are rewritten whole: the lines on screen become the lines on file
      await tx.delete(invoiceItem).where(eq(invoiceItem.invoiceId, row.id));
      if (lines.length) {
        await tx.insert(invoiceItem).values(lines.map((line, index) => ({ invoiceId: row.id, ...line, position: index + 1 })));
      }
      return row.number;
    });

    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: invoiceKind('updated', input.invoiceId),
      summary: `Edited draft ${number}`,
      target: 'invoices',
      visibility: 'studio',
    });
    refresh(projectId);
    return done(`Saved ${number}.`);
  });
}

export async function deleteInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioProjectActor(formData.get('projectId'));
    const input = parseForm(z.object(ids), formData);
    const projectId = actor.project.id;

    const row = await getDb().transaction(async (tx) => {
      const current = await lockInvoice(tx, projectId, input.invoiceId);
      // Anything the client has seen stays on file; a sent invoice is voided instead
      if (current.status !== 'draft') {
        throw new ActionError(
          current.status === 'sent'
            ? `${current.number} has been sent, so it stays on file. Void it instead.`
            : `${current.number} has been sent, so it stays on file.`,
        );
      }
      await tx.delete(invoice).where(and(eq(invoice.id, current.id), eq(invoice.projectId, projectId)));
      return current;
    });

    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: invoiceKind('deleted', input.invoiceId),
      summary: `Deleted draft ${row.number}: ${row.title}`,
      target: 'invoices',
      visibility: 'studio',
    });
    refresh(projectId);
    // The list says what happened: the draft's own page, where the button was, is gone
    redirect(`${projectHref(projectId, 'invoices')}?deleted=${encodeURIComponent(row.number)}`);
  });
}

/* ---------- Studio: send, remind ---------- */

const sendSchema = z.object({ ...ids, version: z.string().min(1) });

export async function sendInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioProjectActor(formData.get('projectId'));
    const input = parseForm(sendSchema, formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);

    const result = await getDb().transaction(async (tx) => {
      const row = await lockInvoice(tx, projectId, input.invoiceId);
      // A second click on Send: the first one already sent it
      if (row.status === 'sent' || row.status === 'payment_reported') return { already: true as const, row, totalCents: 0 };
      if (row.status !== 'draft') wrongState(row, 'sent');
      if (row.version !== input.version) {
        throw new ActionError('This draft changed after you opened it. Reload the page and check it before sending.');
      }
      const { totalCents, lineCount } = await totalOf(tx, row.id);
      const missing = [
        !row.issuedOn && 'an issue date',
        !row.dueOn && 'a due date',
        lineCount === 0 && 'at least one line item',
      ].filter(Boolean) as string[];
      if (missing.length) {
        const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
        throw new ActionError(`Before sending, edit the draft to add ${list}.`);
      }
      if (totalCents <= 0) throw new ActionError('The total must be more than $0.00 before the invoice can be sent.');
      await tx.update(invoice).set({ status: 'sent' }).where(and(eq(invoice.id, row.id), eq(invoice.status, 'draft')));
      return { already: false as const, row, totalCents };
    });

    if (result.already) return done(`${result.row.number} has already been sent to ${clientName}.`);
    refresh(projectId);

    const { row, totalCents } = result;
    // Starts the 10-minute gap before "Email again" can send another
    const slot = await claimRateSlot(invoiceEmailKey(row.id), EMAIL_INTERVAL_MS);
    const { subject, content } = sentEmail(await facts(actor, row, totalCents));
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: invoiceKind('sent', row.id),
      summary: `Invoice ${row.number} sent: ${formatMoney(totalCents)}${row.dueOn ? `, due ${formatDate(row.dueOn)}` : ''}`,
      target: 'invoices',
      email: { to: actor.project.clientEmail, subject, content },
    });
    if (emailStatus !== 'sent') await releaseRateSlot(slot);
    return done(
      `Sent ${row.number} to ${clientName}.${emailStatus === 'sent' ? ` We emailed ${actor.project.clientEmail} a link to it.` : emailNote(emailStatus, clientName, invoiceKind('sent', row.id))}`,
    );
  });
}

export async function emailInvoiceAgain(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioProjectActor(formData.get('projectId'));
    const input = parseForm(z.object(ids), formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);
    const db = getDb();

    const [row] = await db
      .select({
        id: invoice.id,
        number: invoice.number,
        title: invoice.title,
        status: invoice.status,
        dueOn: invoice.dueOn,
        paidOn: invoice.paidOn,
        paidMethod: invoice.paidMethod,
        paidReference: invoice.paidReference,
      })
      .from(invoice)
      .where(and(eq(invoice.id, input.invoiceId), eq(invoice.projectId, projectId)));
    if (!row) throw new ActionError(NOT_FOUND);
    // A sent invoice gets a reminder; a paid one gets its receipt again
    if (row.status !== 'sent' && row.status !== 'paid') {
      throw new ActionError(
        row.status === 'payment_reported'
          ? `${firstName(clientName) ?? clientName} has reported paying ${row.number}. Mark it paid to send the receipt.`
          : `${row.number} is ${row.status === 'draft' ? 'still a draft' : 'void'}, so there is nothing to email.`,
      );
    }
    const slot = await claimRateSlot(invoiceEmailKey(row.id), EMAIL_INTERVAL_MS);
    if (!slot.ok) {
      throw new ActionError(`${firstName(clientName) ?? clientName} was emailed about ${row.number} in the last 10 minutes. Give it a little while before sending another.`);
    }

    const { totalCents } = await totalOf(db, row.id);
    const base = await facts(actor, row, totalCents);
    const receipt = row.status === 'paid' && row.paidOn && row.paidMethod ? { paidOn: row.paidOn, method: row.paidMethod } : null;
    // A reminder after "Not received yet" repeats the studio's note, in case that email never arrived
    const { subject, content } = receipt
      ? receiptEmail({ ...base, ...receipt, reference: row.paidReference })
      : reminderEmail(base, todayIso(), await loadNotReceived(projectId, row));
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: invoiceKind('reminded', row.id),
      summary: receipt
        ? receiptSummary(clientName, `payment of ${row.number} (again)`)
        : emailedSummary(`${clientName} a reminder about ${row.number}`),
      target: 'invoices',
      visibility: 'studio',
      email: { to: actor.project.clientEmail, subject, content },
    });
    if (emailStatus !== 'sent') await releaseRateSlot(slot);
    refresh(projectId);
    if (emailStatus === 'sent') return done(receipt ? `Emailed the receipt to ${clientName} again.` : `Emailed ${clientName} a reminder about ${row.number}.`);
    return done(`Nothing was sent.${emailNote(emailStatus, clientName, invoiceKind('reminded', row.id))}`);
  });
}

/* ---------- Studio: payments ---------- */

const paidSchema = z.object({
  ...ids,
  paidOn: fields.requiredDate
    .refine((value) => value >= '2000-01-01', { error: 'Choose a date after 2000.' })
    // A day of slack for time zones ahead of UTC
    .refine((value) => value <= new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), {
      error: 'Choose today or an earlier date.',
    }),
  method,
  reference,
});

export async function markInvoicePaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioProjectActor(formData.get('projectId'));
    const input = parseForm(paidSchema, formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);

    const result = await getDb().transaction(async (tx) => {
      const row = await lockInvoice(tx, projectId, input.invoiceId);
      if (row.status === 'paid') return { already: true as const, row, totalCents: 0 };
      if (row.status !== 'sent' && row.status !== 'payment_reported') wrongState(row, 'marked paid');
      await tx
        .update(invoice)
        .set({ status: 'paid', paidOn: input.paidOn, paidMethod: input.method, paidReference: input.reference })
        .where(eq(invoice.id, row.id));
      const { totalCents } = await totalOf(tx, row.id);
      return { already: false as const, row, totalCents };
    });

    if (result.already) return done(`${result.row.number} is already marked paid.`);
    refresh(projectId);

    const { row, totalCents } = result;
    // A receipt always goes out, and it starts the gap before another email
    const slot = await forceRateSlot(invoiceEmailKey(row.id));
    const { subject, content } = receiptEmail({ ...(await facts(actor, row, totalCents)), paidOn: input.paidOn, method: input.method, reference: input.reference });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: invoiceKind('paid', row.id),
      summary: `${row.number} paid: ${formatMoney(totalCents)} by ${METHOD_LABELS[input.method]}`,
      target: 'invoices',
      email: { to: actor.project.clientEmail, subject, content },
    });
    // A receipt that did not go out must not hold up "Email the receipt again"
    if (emailStatus !== 'sent') await releaseRateSlot(slot);
    return done(
      `Marked ${row.number} paid.${emailStatus === 'sent' ? ` We emailed ${clientName} a receipt.` : emailNote(emailStatus, clientName, invoiceKind('paid', row.id))}`,
    );
  });
}

export async function markPaymentNotReceived(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioProjectActor(formData.get('projectId'));
    const input = parseForm(z.object({ ...ids, note: fields.requiredText('a note for the client', 2000).transform(lf) }), formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);

    const result = await getDb().transaction(async (tx) => {
      const row = await lockInvoice(tx, projectId, input.invoiceId);
      if (row.status !== 'payment_reported') {
        throw new ActionError(row.status === 'sent' ? `${row.number} is already open again.` : `There is no reported payment on ${row.number} to reopen.`);
      }
      // Back to unpaid, so the client sees how to pay again and can report a new payment
      await tx
        .update(invoice)
        .set({ status: 'sent', reportedMethod: null, reportedReference: null, reportedAt: null })
        .where(eq(invoice.id, row.id));
      const { totalCents } = await totalOf(tx, row.id);
      return { row, totalCents };
    });

    refresh(projectId);
    const { row, totalCents } = result;
    // The note always goes out, and it starts the gap before another email
    const slot = await forceRateSlot(invoiceEmailKey(row.id));
    const { subject, content } = notReceivedEmail({ ...(await facts(actor, row, totalCents)), note: input.note });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: invoiceKind('notReceived', row.id),
      // The note is kept here, so the client's invoice page shows it whether or not the email arrives
      summary: notReceivedSummary(row.number, { method: row.reportedMethod, reference: row.reportedReference }, input.note),
      target: 'invoices',
      email: { to: actor.project.clientEmail, subject, content },
    });
    if (emailStatus !== 'sent') await releaseRateSlot(slot);
    return done(`Reopened ${row.number}.${emailStatus === 'sent' ? ` We emailed ${clientName} your note.` : emailNote(emailStatus, clientName, invoiceKind('notReceived', row.id))}`);
  });
}

export async function voidInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioProjectActor(formData.get('projectId'));
    const input = parseForm(z.object(ids), formData);
    const projectId = actor.project.id;

    const result = await getDb().transaction(async (tx) => {
      const row = await lockInvoice(tx, projectId, input.invoiceId);
      if (row.status === 'void') return { already: true as const, row };
      // Only an invoice the client has but has not paid: a draft is deleted instead, and a
      // reported payment is settled first (paid, or not received)
      if (row.status === 'draft') throw new ActionError(`${row.number} is a draft. Delete it instead.`);
      if (row.status !== 'sent') wrongState(row, 'voided');
      await tx.update(invoice).set({ status: 'void' }).where(and(eq(invoice.id, row.id), eq(invoice.status, 'sent')));
      return { already: false as const, row };
    });

    if (result.already) return done(`${result.row.number} is already void.`);
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: invoiceKind('voided', result.row.id),
      summary: `Invoice ${result.row.number} was cancelled`,
      target: 'invoices',
    });
    refresh(projectId);
    return done(`Voided ${result.row.number}. ${clientNameOf(actor)} sees it as cancelled.`);
  });
}

/* ---------- Client: report a payment ---------- */

const reportSchema = z.object({ ...ids, method: z.enum(paymentMethod.enumValues, { error: 'Choose how you paid.' }), reference });

export async function reportPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    // Only the project's own client says they have paid; the studio confirms with Mark paid
    const actor = await projectActor(formData.get('projectId'), { clientOnly: true });
    const input = parseForm(reportSchema, formData);
    // Only a way the invoice offers. With none set up, the details went out separately, so the
    // form offers all six and so does this check.
    const offered = await loadEnabledPaymentMethods();
    if (offered.length > 0 && !offered.some((entry) => entry.method === input.method)) {
      throw new ActionError('Choose how you paid.', { method: 'Choose how you paid.' });
    }
    const projectId = actor.project.id;
    const thanks = "Thanks. We'll confirm when your payment arrives and email you a receipt.";

    const result = await getDb().transaction(async (tx) => {
      // First, before the invoice lock: the project may have moved to another client since
      await assertStillClient(tx, actor);
      const row = await lockInvoice(tx, projectId, input.invoiceId);
      // Drafts are invisible to clients, so one looks like a missing invoice
      if (row.status === 'draft') throw new ActionError(NOT_FOUND);
      // A second click on the same report
      if (row.status === 'payment_reported') return { repeat: true as const };
      if (row.status === 'paid') throw new ActionError("We've already received the payment for this invoice. Thank you.");
      if (row.status === 'void') throw new ActionError("This invoice was cancelled, so there's nothing to pay.");
      const [updated] = await tx
        .update(invoice)
        .set({ status: 'payment_reported', reportedMethod: input.method, reportedReference: input.reference, reportedAt: sql`now()` })
        .where(and(eq(invoice.id, row.id), eq(invoice.status, 'sent')))
        .returning({ reportedAt: invoice.reportedAt });
      const { totalCents } = await totalOf(tx, row.id);
      return { repeat: false as const, row, totalCents, reportedAt: updated?.reportedAt ?? new Date() };
    });

    if (result.repeat) return done(thanks);
    refresh(projectId);

    const name = actor.user.name || actor.user.email;
    const { subject, content } = paymentReportedEmail({
      ...(await facts(actor, result.row, result.totalCents)),
      reporter: name,
      reporterEmail: actor.user.email,
      method: input.method,
      reference: input.reference,
      at: result.reportedAt,
    });
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: invoiceKind('reported', result.row.id),
      // The words of the studio's attention item and email: "<client> reported a payment on BWD-0003"
      summary: `${name} reported a payment on ${result.row.number} by ${METHOD_LABELS[input.method]}`,
      target: 'invoices',
      email: { to: STUDIO_EMAIL, subject, content },
    });
    return done(thanks);
  });
}

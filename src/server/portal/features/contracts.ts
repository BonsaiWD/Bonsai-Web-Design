import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, like, ne, notExists, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '@/db';
import { activity, contract, contractFile, contractSignature, file, project, rateLimit, user } from '@/db/schema';
import type {
  ContractFileView,
  ContractSignatureView,
  ContractStatus,
  ContractView,
  Perspective,
} from '@/components/portal/contracts/types';
import type { EmailContent } from '@/lib/email';
import { firstName } from '@/lib/portal-format';
import { isUuid, type PortalProject, type Tx } from '../access';
import { projectScope, type AttentionItem, type FeatureContext, type PortalFeature } from '../attention';
import { STUDIO_EMAIL } from '../notify';
import { INLINE_TYPES } from '../storage';

type Db = ReturnType<typeof getDb>;

/* ---------- Activity kinds ----------
   Rows carry the contract's id in their kind ("contract.added:<id>"), so the page can say when
   the client was last asked to sign and a failed email can link back to its card. `target`
   stays the tab name, as every feed expects. */

const KINDS = {
  added: 'contract.added',
  replaced: 'contract.replaced',
  reminded: 'contract.reminded',
  signed: 'contract.signed',
  receipt: 'contract.receipt',
  signedCopy: 'contract.signed_copy',
  countersigned: 'contract.countersigned',
  recorded: 'contract.recorded',
  edited: 'contract.edited',
  deleted: 'contract.deleted',
  // "contract.copy_returned:<contractId>:<contractFileId>": the studio sent a signed copy back
  returned: 'contract.copy_returned',
} as const;

// The emails that ask the client to sign (a sent-back copy asks again); a failure here is
// worth flagging to the studio
const ASKING = [KINDS.added, KINDS.replaced, KINDS.reminded, KINDS.returned];

export function contractKind(event: keyof typeof KINDS, contractId: string): string {
  return `${KINDS[event]}:${contractId}`;
}

function contractIdOf(kind: string): string | null {
  const id = kind.split(':')[1];
  return isUuid(id) ? id : null;
}

export const contractAnchor = (contractId: string) => `contract-${contractId}`;

/* A signed copy the studio sends back keeps its rows: its file is marked removed, so it no
   longer downloads for the client or counts as a signature anywhere, and the studio's history
   still shows it. The reason travels in the activity summary, as the schema has no column. */

const REASON_MARKER = '. Reason: ';

export function returnedSummary(title: string, reason: string): string {
  return `Sent back the signed copy of ${title}${REASON_MARKER}${reason}`;
}

function reasonFromSummary(summary: string): string | null {
  const at = summary.indexOf(REASON_MARKER);
  return at >= 0 ? summary.slice(at + REASON_MARKER.length) || null : null;
}

export function contractStatus(input: {
  requiresSignature: boolean;
  signed: boolean;
  signedCopy: boolean;
  countersigned: boolean;
}): ContractStatus {
  if (!input.requiresSignature && !input.signed) return 'reference';
  if (!input.signed && !input.signedCopy) return 'awaiting';
  return input.countersigned ? 'countersigned' : 'signed';
}

/* ---------- Page data ---------- */

const creator = alias(user, 'creator');
const uploader = alias(user, 'uploader');
const signer = alias(user, 'signer');
const returner = alias(user, 'returner');

export async function loadContracts(
  forProject: Pick<PortalProject, 'id' | 'clientEmail'>,
  perspective: Perspective,
): Promise<ContractView[]> {
  const db = getDb();
  const studio = perspective === 'studio';

  const [items, fileRows, signatures, emails] = await Promise.all([
    db
      .select({
        id: contract.id,
        title: contract.title,
        description: contract.description,
        requiresSignature: contract.requiresSignature,
        createdAt: contract.createdAt,
        createdByName: creator.name,
      })
      .from(contract)
      .leftJoin(creator, eq(creator.id, contract.createdBy))
      .where(eq(contract.projectId, forProject.id))
      .orderBy(desc(contract.createdAt)),
    db
      .select({
        id: contractFile.id,
        contractId: contractFile.contractId,
        label: contractFile.label,
        createdAt: contractFile.createdAt,
        fileId: file.id,
        filename: file.filename,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256,
        contentType: file.contentType,
        uploaderName: uploader.name,
        uploaderRole: uploader.role,
        removedAt: file.removedAt,
      })
      .from(contractFile)
      .innerJoin(contract, eq(contract.id, contractFile.contractId))
      .innerJoin(file, eq(file.id, contractFile.fileId))
      .leftJoin(uploader, eq(uploader.id, contractFile.uploadedBy))
      .where(eq(contract.projectId, forProject.id))
      .orderBy(desc(contractFile.createdAt), desc(contractFile.id)),
    db
      .select({
        contractId: contractSignature.contractId,
        source: contractSignature.source,
        signedAt: contractSignature.signedAt,
        signedName: contractSignature.signedName,
        statement: contractSignature.statement,
        note: contractSignature.note,
        fileId: contractSignature.fileId,
        fileSha256: contractSignature.fileSha256,
        signerEmail: contractSignature.signerEmail,
        ipAddress: contractSignature.ipAddress,
        userAgent: contractSignature.userAgent,
        signerName: signer.name,
        filename: file.filename,
      })
      .from(contractSignature)
      .leftJoin(signer, eq(signer.id, contractSignature.signerId))
      .leftJoin(file, eq(file.id, contractSignature.fileId))
      .where(eq(contractSignature.projectId, forProject.id)),
    // Who was asked to sign, and whether it reached them: the studio's business only
    studio
      ? db
          .select({ kind: activity.kind, emailStatus: activity.emailStatus, createdAt: activity.createdAt })
          .from(activity)
          .where(
            and(
              eq(activity.projectId, forProject.id),
              eq(activity.emailTo, forProject.clientEmail),
              inArray(activity.emailStatus, ['sent', 'failed']),
              or(...ASKING.map((kind) => like(activity.kind, `${kind}:%`))),
            ),
          )
          .orderBy(desc(activity.createdAt))
      : Promise.resolve([]),
  ]);
  // Why the studio sent a signed copy back: the client was emailed it, so both sides see it
  const returnRows = fileRows.some((row) => row.removedAt)
    ? await db
        .select({ kind: activity.kind, summary: activity.summary, createdAt: activity.createdAt, byName: returner.name })
        .from(activity)
        .leftJoin(returner, eq(returner.id, activity.actorId))
        .where(and(eq(activity.projectId, forProject.id), like(activity.kind, `${KINDS.returned}:%`)))
    : [];
  const returns = new Map(
    returnRows.map((row) => [
      row.kind.split(':')[2],
      { at: row.createdAt.toISOString(), reason: reasonFromSummary(row.summary), byName: studio ? row.byName || null : null },
    ]),
  );

  const filesByContract = new Map<string, ContractFileView[]>();
  const returnedByContract = new Map<string, NonNullable<ContractView['returnedCopy']>>();
  for (const row of fileRows) {
    const returned = row.removedAt ? (returns.get(row.id) ?? { at: row.removedAt.toISOString(), reason: null, byName: null }) : null;
    // Rows arrive newest first, so the first one sent back is the latest
    if (returned && row.label === 'client_signed' && !returnedByContract.has(row.contractId)) {
      returnedByContract.set(row.contractId, { filename: row.filename, uploadedAt: row.createdAt.toISOString(), ...returned });
    }
    // The client can no longer download a copy that was sent back; the notice tells them why
    if (returned && !studio) continue;
    const list = filesByContract.get(row.contractId) ?? [];
    list.push({
      id: row.id,
      fileId: row.fileId,
      label: row.label,
      filename: row.filename,
      sizeBytes: row.sizeBytes,
      sha256: row.sha256,
      previewable: INLINE_TYPES.has(row.contentType),
      uploadedAt: row.createdAt.toISOString(),
      side: row.uploaderRole === 'admin' ? 'studio' : 'client',
      // Which of the two of us uploaded it matters to the studio only
      uploadedByName: studio ? row.uploaderName || null : null,
      current: false,
      ...(studio ? { returned } : {}),
    });
    filesByContract.set(row.contractId, list);
  }
  const signatureByContract = new Map(signatures.map((row) => [row.contractId, row]));

  return items.map((item): ContractView => {
    // Newest first, so the first of each label is the current one
    const files = filesByContract.get(item.id) ?? [];
    const original = files.find((entry) => entry.label === 'original') ?? null;
    if (original) original.current = true;
    // A copy the studio sent back is history, not a signature
    const signedCopy = files.find((entry) => entry.label === 'client_signed' && !entry.returned) ?? null;
    const countersigned = files.find((entry) => entry.label === 'countersigned') ?? null;
    const row = signatureByContract.get(item.id);

    const signature: ContractSignatureView | null = row
      ? {
          source: row.source,
          signedAt: row.signedAt.toISOString(),
          signedName: row.signedName,
          // A studio-recorded signature names the studio member to the studio only
          byName: row.source === 'client' || studio ? row.signerName || null : null,
          statement: row.statement,
          note: row.note,
          fileId: row.fileId,
          filename: row.filename ?? 'the document',
          sha256: row.fileSha256,
          ...(studio ? { signerEmail: row.signerEmail, ipAddress: row.ipAddress, userAgent: row.userAgent } : {}),
        }
      : null;

    let studioExtras: ContractView['studio'];
    if (studio) {
      const mine = emails.filter((entry) => contractIdOf(entry.kind) === item.id);
      const lastSent = mine.find((entry) => entry.emailStatus === 'sent');
      studioExtras = {
        createdByName: item.createdByName || null,
        lastEmailedAt: lastSent ? lastSent.createdAt.toISOString() : null,
        lastEmailFailed: mine[0]?.emailStatus === 'failed',
      };
    }

    const status = contractStatus({
      requiresSignature: item.requiresSignature,
      signed: Boolean(row),
      signedCopy: Boolean(signedCopy),
      countersigned: Boolean(countersigned),
    });
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      requiresSignature: item.requiresSignature,
      status,
      // Only while it waits for a signature again: once signed, the history has it
      returnedCopy: status === 'awaiting' ? (returnedByContract.get(item.id) ?? null) : null,
      createdAt: item.createdAt.toISOString(),
      original,
      signedCopy,
      countersigned,
      signature,
      files,
      ...(studioExtras ? { studio: studioExtras } : {}),
    };
  });
}

/* ---------- Inside a transaction ---------- */

// Locks the contract (inside the actor's project) and reads its state after the lock, so it
// reflects anything that committed while this request waited
export async function lockContract(tx: Tx, projectId: string, contractId: string) {
  // The project row first: a delete or a change of client takes it before its contracts, so
  // the two wait in turn instead of deadlocking
  await tx.execute(sql`SELECT id FROM project WHERE id = ${projectId} FOR KEY SHARE`);
  const [row] = await tx
    .select({
      id: contract.id,
      title: contract.title,
      description: contract.description,
      requiresSignature: contract.requiresSignature,
    })
    .from(contract)
    .where(and(eq(contract.id, contractId), eq(contract.projectId, projectId)))
    .for('update');
  if (!row) return null;

  // One connection runs a transaction, so these go one after another
  const original = await currentOriginal(tx, row.id);
  const [signature] = await tx
    .select({ source: contractSignature.source, signerId: contractSignature.signerId, signedAt: contractSignature.signedAt })
    .from(contractSignature)
    .where(eq(contractSignature.contractId, row.id));
  // A signed copy the studio sent back no longer counts
  const labels = await tx
    .selectDistinct({ label: contractFile.label })
    .from(contractFile)
    .innerJoin(file, eq(file.id, contractFile.fileId))
    .where(and(eq(contractFile.contractId, row.id), isNull(file.removedAt)));
  const has = (label: string) => labels.some((entry) => entry.label === label);
  const status = contractStatus({
    requiresSignature: row.requiresSignature,
    signed: Boolean(signature),
    signedCopy: has('client_signed'),
    countersigned: has('countersigned'),
  });
  return { ...row, original, signature: signature ?? null, status, hasSignedCopy: has('client_signed') };
}

export type LockedContract = NonNullable<Awaited<ReturnType<typeof lockContract>>>;

// The newest original is the document the client reads and signs
export async function currentOriginal(tx: Tx | Db, contractId: string) {
  const [row] = await tx
    .select({
      contractFileId: contractFile.id,
      fileId: file.id,
      filename: file.filename,
      sha256: file.sha256,
    })
    .from(contractFile)
    .innerJoin(file, eq(file.id, contractFile.fileId))
    .where(and(eq(contractFile.contractId, contractId), eq(contractFile.label, 'original')))
    .orderBy(desc(contractFile.createdAt), desc(contractFile.id))
    .limit(1);
  return row ?? null;
}

/* ---------- Email throttle ----------
   At most one "please sign" email per contract every 10 minutes. The claim is a single
   conditional upsert, so two clicks at once cannot both send. */

const EMAIL_GAP_MS = 10 * 60 * 1000;
const throttleKey = (contractId: string) => `portal:contract-email:${contractId}`;

export async function claimEmailSlot(contractId: string): Promise<{ ok: true } | { ok: false; waitMinutes: number }> {
  const db = getDb();
  const key = throttleKey(contractId);
  const now = Date.now();
  const claimed = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: sql`${rateLimit.count} + 1`, lastRequest: now },
      setWhere: sql`${rateLimit.lastRequest} <= ${now - EMAIL_GAP_MS}`,
    })
    .returning({ id: rateLimit.id });
  if (claimed.length) return { ok: true };
  const [row] = await db.select({ lastRequest: rateLimit.lastRequest }).from(rateLimit).where(eq(rateLimit.key, key));
  const last = row?.lastRequest ?? now;
  return { ok: false, waitMinutes: Math.max(1, Math.ceil((last + EMAIL_GAP_MS - now) / 60_000)) };
}

// An email that did not go out should not block the next try
export async function releaseEmailSlot(contractId: string): Promise<void> {
  await getDb()
    .delete(rateLimit)
    .where(eq(rateLimit.key, throttleKey(contractId)));
}

// Whether an email asking this client to sign the contract ever reached them, so the next one
// is worded as a reminder only when it is one
export async function askedByEmail(projectId: string, contractId: string, to: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: activity.id })
    .from(activity)
    .where(
      and(
        eq(activity.projectId, projectId),
        eq(activity.emailTo, to),
        eq(activity.emailStatus, 'sent'),
        or(...ASKING.map((kind) => like(activity.kind, `${kind}:${contractId}%`))),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/* ---------- Emails ---------- */

// "2026-11-08 19:30 UTC": receipts state one unambiguous time
export function utcStamp(value: Date): string {
  return `${value.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

const greeting = (clientName: string | null) => {
  const name = firstName(clientName);
  return name ? `Hi ${name},` : 'Hello,';
};

interface AskEmailInput {
  projectName: string;
  clientName: string | null;
  title: string;
  requiresSignature: boolean;
  note?: string | null;
  url: string;
  kind: 'added' | 'replaced' | 'reminder';
}

// Telling the client a document is in their portal, and whether we need their signature
export function askEmail(input: AskEmailInput): { subject: string; content: EmailContent } {
  const footnotes = [`You're getting this because you're the client on ${input.projectName}.`];
  if (!input.requiresSignature) {
    return {
      subject: input.kind === 'replaced' ? `Updated: ${input.title}` : `For your records: ${input.title}`,
      content: {
        heading: input.kind === 'replaced' ? `We updated ${input.title}` : `${input.title} is in your portal`,
        paragraphs: [
          greeting(input.clientName),
          input.kind === 'replaced'
            ? `We've replaced ${input.title} for ${input.projectName} with a new version. Nothing is needed from you.`
            : `We've added ${input.title} to your portal for ${input.projectName}. It's there for your records; nothing is needed from you.`,
        ],
        quote: input.note ?? undefined,
        action: { label: 'Open it in the portal', url: input.url },
        footnotes,
      },
    };
  }
  const subject =
    input.kind === 'reminder'
      ? `Reminder: ${input.title} is waiting for your signature`
      : input.kind === 'replaced'
        ? `Updated for your signature: ${input.title}`
        : `Ready for your signature: ${input.title}`;
  const opening =
    input.kind === 'reminder'
      ? `A quick reminder that ${input.title} for ${input.projectName} is in your portal, waiting for your signature.`
      : input.kind === 'replaced'
        ? `We've replaced ${input.title} for ${input.projectName} with a new version. Please read the new one before you sign.`
        : `We've added ${input.title} to your portal for ${input.projectName}.`;
  return {
    subject,
    content: {
      heading:
        input.kind === 'reminder'
          ? `${input.title} is waiting for your signature`
          : input.kind === 'replaced'
            ? `A new version of ${input.title} is ready for your signature`
            : `${input.title} is ready for your signature`,
      paragraphs: [
        greeting(input.clientName),
        opening,
        'Read it, then sign it in the portal: it takes a minute. If you would rather sign on paper, you can upload a signed copy there instead.',
      ],
      quote: input.note ?? undefined,
      action: { label: 'Read and sign it', url: input.url },
      footnotes,
    },
  };
}

interface SignedEmailInput {
  clientName: string;
  title: string;
  filename: string;
  sha256: string;
  signedName: string;
  signerEmail: string;
  statement: string;
  at: Date;
  note: string | null;
  url: string;
}

export function signedEmails(input: SignedEmailInput) {
  const facts = [
    `Document: ${input.filename}`,
    `SHA-256: ${input.sha256}`,
    `Signed as: ${input.signedName} (${input.signerEmail})`,
    `Time: ${utcStamp(input.at)}`,
    `Statement: ${input.statement}`,
  ];
  return {
    studio: {
      subject: `${input.clientName} signed ${input.title}`,
      content: {
        heading: `${input.clientName} signed ${input.title}`,
        paragraphs: [`${input.clientName} signed ${input.title} in the portal.`, ...facts],
        quote: input.note ?? undefined,
        action: { label: 'Open it in the portal', url: input.url },
      } satisfies EmailContent,
    },
    receipt: {
      subject: `Your signature: ${input.title}`,
      content: {
        heading: `You signed ${input.title}`,
        paragraphs: ['This is your copy of the signature recorded in your portal.', ...facts],
        quote: input.note ?? undefined,
        action: { label: 'View it in the portal', url: input.url },
        footnotes: [
          'The SHA-256 is the fingerprint of the exact file you signed: any change to the file would change it.',
          `If you didn't sign this, write to us at ${STUDIO_EMAIL}.`,
        ],
      } satisfies EmailContent,
    },
  };
}

export function recordedSignatureEmail(input: {
  clientName: string | null;
  recordedBy: string;
  title: string;
  filename: string;
  sha256: string;
  at: Date;
  note: string;
  attached: string | null;
  url: string;
}): { subject: string; content: EmailContent } {
  return {
    subject: `We recorded your signature on ${input.title}`,
    content: {
      heading: `We recorded your signature on ${input.title}`,
      paragraphs: [
        greeting(input.clientName),
        `${input.recordedBy} recorded that you signed ${input.title} outside the portal, at ${utcStamp(input.at)}.`,
        `Document: ${input.filename} (SHA-256 ${input.sha256})`,
        ...(input.attached ? [`Your signed copy, ${input.attached}, is in the portal with it.`] : []),
        'Our note is below.',
      ],
      quote: input.note,
      action: { label: 'View it in the portal', url: input.url },
      footnotes: [`If that's not right, write to us at ${STUDIO_EMAIL} and we'll sort it out.`],
    },
  };
}

export function signedCopyEmail(input: {
  clientName: string;
  title: string;
  filename: string;
  sha256: string;
  // The document in the portal when they uploaded it: the server can't read a scan, so the
  // studio compares the two before countersigning
  original: { filename: string; sha256: string };
  note: string | null;
  url: string;
}): { subject: string; content: EmailContent } {
  return {
    subject: `${input.clientName} uploaded a signed copy of ${input.title}`,
    content: {
      heading: `${input.clientName} uploaded a signed copy of ${input.title}`,
      paragraphs: [
        `File: ${input.filename}`,
        `SHA-256: ${input.sha256}`,
        `Check it is a signed copy of ${input.original.filename} (SHA-256 ${input.original.sha256.slice(0, 12)}…), the version in the portal when they uploaded it.`,
        "Then upload the countersigned copy. If it isn't right, send it back from the contract with a note, and they can sign again.",
      ],
      quote: input.note ?? undefined,
      action: { label: 'Open it in the portal', url: input.url },
    },
  };
}

// To the client, when the studio sends their signed copy back
export function returnedCopyEmail(input: {
  projectName: string;
  clientName: string | null;
  title: string;
  filename: string;
  reason: string;
  url: string;
}): { subject: string; content: EmailContent } {
  return {
    subject: `We couldn't use your signed copy of ${input.title}`,
    content: {
      heading: `We couldn't use your signed copy of ${input.title}`,
      paragraphs: [
        greeting(input.clientName),
        `Thanks for uploading ${input.filename}. We can't use it as the signed copy of ${input.title}; our note is below.`,
        `${input.title} is waiting for your signature again. You can sign it in the portal, or upload a new signed copy there.`,
      ],
      quote: input.reason,
      action: { label: 'Sign it in the portal', url: input.url },
      footnotes: [`You're getting this because you're the client on ${input.projectName}.`],
    },
  };
}

export function countersignedEmail(input: {
  projectName: string;
  clientName: string | null;
  title: string;
  filename: string;
  note: string | null;
  url: string;
}): { subject: string; content: EmailContent } {
  return {
    subject: `Countersigned: ${input.title}`,
    content: {
      heading: `${input.title} is signed by both of us`,
      paragraphs: [
        greeting(input.clientName),
        `We've countersigned ${input.title} for ${input.projectName}. The countersigned copy, ${input.filename}, is in your portal for your records.`,
      ],
      quote: input.note ?? undefined,
      action: { label: 'Download it in the portal', url: input.url },
      footnotes: [`You're getting this because you're the client on ${input.projectName}.`],
    },
  };
}

/* ---------- Attention ---------- */

const clientName = sql<string>`coalesce(nullif(${user.name}, ''), ${user.email})`;

// Contracts the client still has to sign: no signature and no signed copy
async function awaitingContracts(context: FeatureContext) {
  const db = getDb();
  return db
    .select({
      id: contract.id,
      title: contract.title,
      createdAt: contract.createdAt,
      projectId: project.id,
      projectName: project.name,
      clientName,
    })
    .from(contract)
    .innerJoin(project, eq(project.id, contract.projectId))
    .innerJoin(user, eq(user.id, project.clientId))
    .where(
      and(
        eq(contract.requiresSignature, true),
        notExists(db.select({ id: contractSignature.id }).from(contractSignature).where(eq(contractSignature.contractId, contract.id))),
        notExists(
          db
            .select({ id: contractFile.id })
            .from(contractFile)
            .innerJoin(file, eq(file.id, contractFile.fileId))
            .where(and(eq(contractFile.contractId, contract.id), eq(contractFile.label, 'client_signed'), isNull(file.removedAt))),
        ),
        projectScope(context),
      ),
    )
    .orderBy(asc(contract.createdAt));
}

async function studioAttention(context: FeatureContext): Promise<AttentionItem[]> {
  const db = getDb();
  const [signed, copies, emails, awaiting] = await Promise.all([
    db
      .select({
        contractId: contract.id,
        title: contract.title,
        signedAt: contractSignature.signedAt,
        projectId: project.id,
        projectName: project.name,
        clientName,
      })
      .from(contractSignature)
      .innerJoin(contract, eq(contract.id, contractSignature.contractId))
      .innerJoin(project, eq(project.id, contract.projectId))
      .innerJoin(user, eq(user.id, project.clientId))
      .where(
        and(eq(contractSignature.source, 'client'), gte(contractSignature.signedAt, sql`now() - interval '7 days'`), projectScope(context)),
      ),
    db
      .select({
        id: contractFile.id,
        contractId: contract.id,
        title: contract.title,
        createdAt: contractFile.createdAt,
        projectId: project.id,
        projectName: project.name,
        uploaderName: sql<string>`coalesce(nullif(${uploader.name}, ''), ${uploader.email})`,
      })
      .from(contractFile)
      .innerJoin(contract, eq(contract.id, contractFile.contractId))
      .innerJoin(file, eq(file.id, contractFile.fileId))
      .innerJoin(project, eq(project.id, contract.projectId))
      .innerJoin(uploader, eq(uploader.id, contractFile.uploadedBy))
      .where(
        and(
          eq(contractFile.label, 'client_signed'),
          // Sent back: no longer news
          isNull(file.removedAt),
          // A copy the studio attached to a recorded signature is not news to the studio
          ne(uploader.role, 'admin'),
          gte(contractFile.createdAt, sql`now() - interval '7 days'`),
          projectScope(context),
        ),
      ),
    db
      .select({
        id: activity.id,
        kind: activity.kind,
        emailTo: activity.emailTo,
        emailStatus: activity.emailStatus,
        createdAt: activity.createdAt,
      })
      .from(activity)
      .innerJoin(project, eq(project.id, activity.projectId))
      .where(
        and(
          or(...ASKING.map((kind) => like(activity.kind, `${kind}:%`))),
          isNotNull(activity.emailTo),
          inArray(activity.emailStatus, ['sent', 'failed']),
          gte(activity.createdAt, sql`now() - interval '14 days'`),
          projectScope(context),
        ),
      )
      .orderBy(asc(activity.createdAt)),
    awaitingContracts(context),
  ]);

  const items: AttentionItem[] = [];
  for (const row of signed) {
    items.push({
      key: `contract-signed:${row.contractId}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'contracts',
      anchor: contractAnchor(row.contractId),
      title: `${row.clientName} signed ${row.title}`,
      since: row.signedAt.toISOString(),
      tone: 'info',
    });
  }
  for (const row of copies) {
    items.push({
      key: `contract-signed-copy:${row.id}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'contracts',
      anchor: contractAnchor(row.contractId),
      title: `${row.uploaderName} uploaded a signed copy of ${row.title}`,
      since: row.createdAt.toISOString(),
      tone: 'info',
    });
  }

  // A failed "please sign" email stays flagged while the contract still waits, until a later
  // one about the same contract reaches that address ("Email again" on the card)
  const waiting = new Map(awaiting.map((row) => [row.id, row]));
  for (const [index, row] of emails.entries()) {
    if (row.emailStatus !== 'failed') continue;
    const contractId = contractIdOf(row.kind);
    const open = contractId ? waiting.get(contractId) : undefined;
    if (!open) continue;
    const resolved = emails
      .slice(index + 1)
      .some((later) => later.emailStatus === 'sent' && later.emailTo === row.emailTo && contractIdOf(later.kind) === contractId);
    if (resolved) continue;
    items.push({
      key: `contract-email:${row.id}`,
      projectId: open.projectId,
      projectName: open.projectName,
      tab: 'contracts',
      anchor: contractAnchor(open.id),
      title: `The email asking ${open.clientName} to sign ${open.title} could not be sent`,
      detail: `Sent to ${row.emailTo}. Use "Email again" on the contract to retry.`,
      since: row.createdAt.toISOString(),
      tone: 'alert',
    });
  }
  return items;
}

export const contractsFeature: PortalFeature = {
  async attention(context) {
    if (context.perspective === 'studio') return studioAttention(context);
    const awaiting = await awaitingContracts(context);
    return awaiting.map((row) => ({
      key: `contract-sign:${row.id}`,
      projectId: row.projectId,
      projectName: row.projectName,
      tab: 'contracts' as const,
      anchor: contractAnchor(row.id),
      title: `Sign ${row.title}`,
      since: row.createdAt.toISOString(),
      tone: 'action' as const,
    }));
  },
  // Contracts carry no due dates
  deadlines: async () => [],
};

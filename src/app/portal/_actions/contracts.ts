'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { contract, contractFile, contractSignature, file, rateLimit, user } from '@/db/schema';
import { signStatement, studioSignStatement } from '@/components/portal/contracts/copy';
import { projectHref } from '@/components/portal/tabs';
import { plural } from '@/lib/portal-format';
import { adminActor, assertStillClient, projectActor, type ProjectActor, type Tx } from '@/server/portal/access';
import { ActionError, done, fields, parseForm, runAction, type ActionState } from '@/server/portal/actions';
import {
  askedByEmail,
  askEmail,
  claimEmailSlot,
  contractAnchor,
  contractKind,
  countersignedEmail,
  lockContract,
  recordedSignatureEmail,
  releaseEmailSlot,
  returnedCopyEmail,
  returnedKind,
  returnedNoteSummary,
  signedCopyEmail,
  signedEmails,
  type LockedContract,
} from '@/server/portal/features/contracts';
import { claimUploadQuota, refundUploadQuota } from '@/server/portal/features/files';
import { emailNote, portalOrigin, recordActivity, STUDIO_EMAIL, STUDIO_NAME } from '@/server/portal/notify';
import { requestMeta } from '@/server/portal/request';
import { storeUpload } from '@/server/portal/storage';

/*
 * Every export here is an endpoint anyone can call with any arguments, so each one starts by
 * checking who is asking. Forms send ids and the person's own words; who signed and their
 * email come from the session, and every row is matched to the actor's project.
 */

const NOT_FOUND = 'This contract could not be found. Reload the page and try again.';

// fields.checkbox rejects an unticked box under Zod 4 (a missing key reads as "nonoptional");
// optional() before the transform lets the key be absent
const checkbox = z
  .union([z.literal('on'), z.literal('true')])
  .optional()
  .transform((value) => value !== undefined);

// Parses the form and adds checks the schema cannot express, so every problem shows at once
function parseWithChecks<S extends z.ZodType>(schema: S, formData: FormData, extra: Record<string, string>): z.infer<S> {
  const problems = Object.entries(extra);
  let parsed: z.infer<S>;
  try {
    parsed = parseForm(schema, formData);
  } catch (error) {
    if (error instanceof ActionError && problems.length) throw new ActionError(error.message, { ...extra, ...error.fieldErrors });
    throw error;
  }
  if (problems.length) throw new ActionError(problems.length === 1 ? problems[0][1] : 'Check the highlighted fields and try again.', extra);
  return parsed;
}

function chosenFile(formData: FormData): File | null {
  const upload = formData.get('file');
  return upload instanceof File && upload.size > 0 ? upload : null;
}

function refresh(projectId: string) {
  revalidatePath(projectHref(projectId), 'layout');
  revalidatePath('/portal');
}

const clientNameOf = (actor: ProjectActor) => actor.project.clientName || actor.project.clientEmail;
const isSigned = (locked: LockedContract) => locked.status === 'signed' || locked.status === 'countersigned';

async function contractUrl(projectId: string, contractId: string) {
  return `${await portalOrigin()}${projectHref(projectId, 'contracts', contractAnchor(contractId))}`;
}

async function studioActor(projectId: unknown) {
  await adminActor();
  return projectActor(projectId);
}

// Locks the contract inside the actor's project, or fails as if it did not exist
async function lockOrFail(tx: Tx, projectId: string, contractId: string): Promise<LockedContract> {
  const locked = await lockContract(tx, projectId, contractId);
  if (!locked) throw new ActionError(NOT_FOUND);
  return locked;
}

// Reads the contract's state without holding the lock, for checks before an upload
function peek(projectId: string, contractId: string) {
  return getDb().transaction((tx) => lockOrFail(tx, projectId, contractId));
}

// A contract file row created by an earlier submit of the same form
async function existingContractFile(projectId: string, contractFileId: string) {
  const [row] = await getDb()
    .select({ id: contractFile.id, title: contract.title })
    .from(contractFile)
    .innerJoin(contract, eq(contract.id, contractFile.contractId))
    .where(and(eq(contractFile.id, contractFileId), eq(contract.projectId, projectId)));
  return row ?? null;
}

type Stored = { id: string; filename: string; sha256: string };

/**
 * Stores the upload (if any), then runs the write in one transaction. If the write fails or
 * turns out to repeat an earlier submit, the new file row is dropped, so no record points at it.
 */
async function withUpload<T extends { duplicate: boolean }>(
  actor: ProjectActor,
  upload: File | null,
  write: (tx: Tx, stored: Stored | null) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const stored = upload ? await storeUpload({ projectId: actor.project.id, purpose: 'contract', uploadedBy: actor.user.id, upload }) : null;
  const drop = async () => {
    if (stored)
      await db
        .delete(file)
        .where(eq(file.id, stored.id))
        .catch(() => undefined);
  };
  let result: T;
  try {
    result = await db.transaction((tx) => write(tx, stored));
  } catch (error) {
    await drop();
    throw error;
  }
  if (result.duplicate) await drop();
  return result;
}

function signedReason(locked: LockedContract, clientName: string): string {
  return locked.signature ? `${locked.title} is signed` : `${clientName} uploaded a signed copy of ${locked.title}`;
}

const SIGNED_KEPT = 'Signed records are kept; add a new contract instead.';

/* ---------- Studio: add a contract ---------- */

const contractFields = {
  title: fields.requiredText('a title', 160),
  description: fields.optionalText('the description', 1000),
};

const createSchema = z.object({
  projectId: fields.uuid,
  // Generated once per form in the browser, so a second submit finds the first one's rows
  contractId: fields.uuid,
  contractFileId: fields.uuid,
  ...contractFields,
  requiresSignature: checkbox,
  emailClient: checkbox,
});

export async function createContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioActor(formData.get('projectId'));
    const upload = chosenFile(formData);
    const input = parseWithChecks(createSchema, formData, upload ? {} : { file: 'Choose the document to upload.' });
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);
    const added = (title: string, requiresSignature: boolean) =>
      requiresSignature ? `Added ${title} for ${clientName} to sign.` : `Added ${title} for ${clientName}'s records.`;

    // A second submit of the same form: the first one already added it
    const [already] = await getDb()
      .select({ projectId: contract.projectId, title: contract.title, requiresSignature: contract.requiresSignature })
      .from(contract)
      .where(eq(contract.id, input.contractId));
    if (already) {
      if (already.projectId !== projectId) throw new ActionError(NOT_FOUND);
      return done(added(already.title, already.requiresSignature));
    }

    const result = await withUpload(actor, upload, async (tx, stored) => {
      const inserted = await tx
        .insert(contract)
        .values({
          id: input.contractId,
          projectId,
          title: input.title,
          description: input.description,
          requiresSignature: input.requiresSignature,
          createdBy: actor.user.id,
        })
        .onConflictDoNothing({ target: contract.id })
        .returning({ id: contract.id });
      if (!inserted.length || !stored) return { duplicate: true };
      await tx.insert(contractFile).values({
        id: input.contractFileId,
        contractId: input.contractId,
        fileId: stored.id,
        label: 'original',
        uploadedBy: actor.user.id,
      });
      return { duplicate: false };
    });
    if (result.duplicate) return done(added(input.title, input.requiresSignature));

    refresh(projectId);
    const kind = contractKind('added', input.contractId);
    const summary = input.requiresSignature ? `Added ${input.title} for signature` : `Added ${input.title}`;
    if (!input.emailClient) {
      await recordActivity({ projectId, actorId: actor.user.id, kind, summary, target: 'contracts' });
      return done(`${added(input.title, input.requiresSignature)} No email was sent.`);
    }

    // Starts the 10-minute gap before "Email again" can send another
    if (input.requiresSignature) await claimEmailSlot(input.contractId);
    const { subject, content } = askEmail({
      projectName: actor.project.name,
      clientName: actor.project.clientName,
      title: input.title,
      requiresSignature: input.requiresSignature,
      url: await contractUrl(projectId, input.contractId),
      kind: 'added',
    });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind,
      summary,
      target: 'contracts',
      email: { to: actor.project.clientEmail, subject, content },
    });
    if (emailStatus !== 'sent' && input.requiresSignature) await releaseEmailSlot(input.contractId);
    return done(
      `${added(input.title, input.requiresSignature)}${emailStatus === 'sent' ? ` We emailed ${clientName}.` : emailNote(emailStatus, clientName)}`,
    );
  });
}

/* ---------- Studio: replace the document while unsigned ---------- */

const replaceSchema = z.object({
  projectId: fields.uuid,
  contractId: fields.uuid,
  contractFileId: fields.uuid,
  // The original the studio had on screen, so two replacements at once cannot both land
  expectedFileId: fields.uuid,
  note: fields.optionalText('the note', 1000),
  emailClient: checkbox,
});

export async function replaceContractDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioActor(formData.get('projectId'));
    const upload = chosenFile(formData);
    const input = parseWithChecks(replaceSchema, formData, upload ? {} : { file: 'Choose the new version of the document.' });
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);

    const repeat = await existingContractFile(projectId, input.contractFileId);
    if (repeat) return done(`Replaced the document for ${repeat.title}.`);

    // Before the upload, so a stale form does not store a file for nothing
    const before = await peek(projectId, input.contractId);
    if (isSigned(before)) throw new ActionError(`Can't replace: ${signedReason(before, clientName)}. ${SIGNED_KEPT}`);

    const result = await withUpload(actor, upload, async (tx, stored) => {
      const locked = await lockOrFail(tx, projectId, input.contractId);
      if (isSigned(locked)) throw new ActionError(`Can't replace: ${signedReason(locked, clientName)}. ${SIGNED_KEPT}`);
      if (locked.original?.contractFileId !== input.expectedFileId) {
        throw new ActionError('The document was just replaced. Reload the page to see the new one.');
      }
      const inserted = stored
        ? await tx
            .insert(contractFile)
            .values({ id: input.contractFileId, contractId: locked.id, fileId: stored.id, label: 'original', uploadedBy: actor.user.id })
            .onConflictDoNothing({ target: contractFile.id })
            .returning({ id: contractFile.id })
        : [];
      return { duplicate: inserted.length === 0, title: locked.title, requiresSignature: locked.requiresSignature };
    });
    const replaced = `Replaced the document for ${result.title}.`;
    if (result.duplicate) return done(replaced);

    refresh(projectId);
    const kind = contractKind('replaced', input.contractId);
    const summary = `Replaced the document for ${result.title}`;
    if (!input.emailClient) {
      await recordActivity({ projectId, actorId: actor.user.id, kind, summary, target: 'contracts' });
      return done(`${replaced} No email was sent.`);
    }
    if (result.requiresSignature) await claimEmailSlot(input.contractId);
    const { subject, content } = askEmail({
      projectName: actor.project.name,
      clientName: actor.project.clientName,
      title: result.title,
      requiresSignature: result.requiresSignature,
      note: input.note,
      url: await contractUrl(projectId, input.contractId),
      kind: 'replaced',
    });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind,
      summary,
      target: 'contracts',
      email: { to: actor.project.clientEmail, subject, content },
    });
    if (emailStatus !== 'sent' && result.requiresSignature) await releaseEmailSlot(input.contractId);
    return done(`${replaced}${emailStatus === 'sent' ? ` We emailed ${clientName}.` : emailNote(emailStatus, clientName)}`);
  });
}

/* ---------- Studio: countersigned copy ---------- */

const countersignSchema = z.object({
  projectId: fields.uuid,
  contractId: fields.uuid,
  contractFileId: fields.uuid,
  note: fields.optionalText('the note', 1000),
  emailClient: checkbox,
});

export async function uploadCountersigned(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioActor(formData.get('projectId'));
    const upload = chosenFile(formData);
    const input = parseWithChecks(countersignSchema, formData, upload ? {} : { file: 'Choose the countersigned copy.' });
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);
    const notYet = (title: string) => `${title} is not signed yet. Upload the countersigned copy once ${clientName} has signed.`;

    const repeat = await existingContractFile(projectId, input.contractFileId);
    if (repeat) return done(`Added the countersigned copy of ${repeat.title}.`);
    const before = await peek(projectId, input.contractId);
    if (!isSigned(before)) throw new ActionError(notYet(before.title));

    const result = await withUpload(actor, upload, async (tx, stored) => {
      const locked = await lockOrFail(tx, projectId, input.contractId);
      if (!isSigned(locked)) throw new ActionError(notYet(locked.title));
      const inserted = stored
        ? await tx
            .insert(contractFile)
            .values({
              id: input.contractFileId,
              contractId: locked.id,
              fileId: stored.id,
              label: 'countersigned',
              uploadedBy: actor.user.id,
            })
            .onConflictDoNothing({ target: contractFile.id })
            .returning({ id: contractFile.id })
        : [];
      return { duplicate: inserted.length === 0, title: locked.title, filename: stored?.filename ?? '' };
    });
    const added = `Added the countersigned copy of ${result.title}.`;
    if (result.duplicate) return done(added);

    refresh(projectId);
    const kind = contractKind('countersigned', input.contractId);
    const summary = `Added the countersigned copy of ${result.title}`;
    if (!input.emailClient) {
      await recordActivity({ projectId, actorId: actor.user.id, kind, summary, target: 'contracts' });
      return done(`${added} No email was sent.`);
    }
    const { subject, content } = countersignedEmail({
      projectName: actor.project.name,
      clientName: actor.project.clientName,
      title: result.title,
      filename: result.filename,
      note: input.note,
      url: await contractUrl(projectId, input.contractId),
    });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind,
      summary,
      target: 'contracts',
      email: { to: actor.project.clientEmail, subject, content },
    });
    return done(`${added}${emailStatus === 'sent' ? ` We emailed ${clientName}.` : emailNote(emailStatus, clientName)}`);
  });
}

/* ---------- Studio: edit details ---------- */

const editSchema = z.object({
  projectId: fields.uuid,
  contractId: fields.uuid,
  ...contractFields,
  requiresSignature: checkbox,
  // The signature box is only on the form while nothing is signed
  signatureEditable: checkbox,
});

export async function editContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioActor(formData.get('projectId'));
    const input = parseForm(editSchema, formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);

    const title = await getDb().transaction(async (tx) => {
      const locked = await lockOrFail(tx, projectId, input.contractId);
      const changesSignature = input.signatureEditable && input.requiresSignature !== locked.requiresSignature;
      if (changesSignature && (isSigned(locked) || locked.signature)) {
        throw new ActionError(`${signedReason(locked, clientName)}, so whether it needs a signature can no longer change.`);
      }
      await tx
        .update(contract)
        .set({
          title: input.title,
          description: input.description,
          ...(changesSignature ? { requiresSignature: input.requiresSignature } : {}),
        })
        .where(eq(contract.id, locked.id));
      return input.title;
    });

    refresh(projectId);
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: contractKind('edited', input.contractId),
      summary: `Updated the details of ${title}`,
      target: 'contracts',
      visibility: 'studio',
    });
    return done(`Saved the details of ${title}.`);
  });
}

/* ---------- Studio: email the client again ---------- */

const contractSchema = z.object({ projectId: fields.uuid, contractId: fields.uuid });

export async function emailContractAgain(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioActor(formData.get('projectId'));
    const input = parseForm(contractSchema, formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);

    const locked = await peek(projectId, input.contractId);
    if (locked.status !== 'awaiting') {
      throw new ActionError(
        locked.status === 'reference' ? `${locked.title} doesn't ask for a signature.` : `${signedReason(locked, clientName)} already.`,
      );
    }
    const slot = await claimEmailSlot(input.contractId);
    if (!slot.ok) {
      throw new ActionError(
        `${clientName} was emailed about this a few minutes ago. You can send another in ${plural(slot.waitMinutes, 'minute')}.`,
      );
    }
    // Added without an email, or every earlier one failed: this is the first they hear of it
    const again = await askedByEmail(projectId, input.contractId, actor.project.clientEmail);
    const { subject, content } = askEmail({
      projectName: actor.project.name,
      clientName: actor.project.clientName,
      title: locked.title,
      requiresSignature: true,
      url: await contractUrl(projectId, input.contractId),
      kind: again ? 'reminder' : 'added',
    });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: contractKind('reminded', input.contractId),
      summary: `Emailed ${clientName}${again ? ' again' : ''} about signing ${locked.title}`,
      target: 'contracts',
      visibility: 'studio',
      email: { to: actor.project.clientEmail, subject, content },
    });
    refresh(projectId);
    if (emailStatus === 'sent') return done(`Emailed ${clientName}${again ? ' again' : ''}.`);
    await releaseEmailSlot(input.contractId);
    if (emailStatus === 'skipped') return done(emailNote(emailStatus, clientName).trim());
    throw new ActionError(`The email to ${clientName} could not be sent. It is flagged on your dashboard; try again in a minute.`);
  });
}

/* ---------- Studio: record a signature made outside the portal ---------- */

const recordSchema = z.object({
  projectId: fields.uuid,
  contractId: fields.uuid,
  contractFileId: fields.uuid,
  // The document the studio had on screen: the record pins that exact file
  shownFileId: fields.uuid,
  note: fields.requiredText('how they signed', 2000),
});

export async function recordContractSignature(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioActor(formData.get('projectId'));
    const input = parseForm(recordSchema, formData);
    const upload = chosenFile(formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);
    // The statement and the receipt are the client's to read: no name means the studio's, not an address
    const recordedBy = actor.user.name?.trim() || null;
    const meta = await requestMeta();
    const recorded = (title: string) => `Recorded ${clientName}'s signature on ${title}.`;

    const before = await peek(projectId, input.contractId);
    if (before.signature) {
      if (before.signature.source === 'studio' && before.signature.signerId === actor.user.id) return done(recorded(before.title));
      throw new ActionError(`${before.title} is already signed.`);
    }

    const result = await withUpload(actor, upload, async (tx, stored) => {
      const locked = await lockOrFail(tx, projectId, input.contractId);
      if (locked.signature) {
        // A second submit of the same form
        if (locked.signature.source === 'studio' && locked.signature.signerId === actor.user.id) {
          return { duplicate: true as const, title: locked.title };
        }
        throw new ActionError(`${locked.title} is already signed.`);
      }
      if (!locked.requiresSignature) {
        throw new ActionError(`${locked.title} doesn't ask for a signature. Edit its details to ask for one first.`);
      }
      const original = locked.original;
      if (!original || original.fileId !== input.shownFileId) {
        throw new ActionError('The document was just replaced. Reload the page and check the new one first.');
      }
      const statement = studioSignStatement({
        recordedBy,
        clientName,
        title: locked.title,
        filename: original.filename,
        sha256: original.sha256,
      });
      const [inserted] = await tx
        .insert(contractSignature)
        .values({
          contractId: locked.id,
          projectId,
          fileId: original.fileId,
          fileSha256: original.sha256,
          source: 'studio',
          // The record names who entered it; the statement names the client
          signerId: actor.user.id,
          signerEmail: actor.user.email,
          signedName: null,
          statement,
          note: input.note,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        })
        .returning({ signedAt: contractSignature.signedAt });
      if (stored) {
        await tx
          .insert(contractFile)
          .values({
            id: input.contractFileId,
            contractId: locked.id,
            fileId: stored.id,
            label: 'client_signed',
            uploadedBy: actor.user.id,
          });
      }
      return {
        duplicate: false as const,
        title: locked.title,
        filename: original.filename,
        sha256: original.sha256,
        signedAt: inserted.signedAt,
        attached: stored?.filename ?? null,
      };
    });
    if (result.duplicate) return done(recorded(result.title));

    refresh(projectId);
    const { subject, content } = recordedSignatureEmail({
      clientName: actor.project.clientName,
      recordedBy: recordedBy ?? STUDIO_NAME,
      title: result.title,
      filename: result.filename,
      sha256: result.sha256,
      at: result.signedAt,
      note: input.note,
      attached: result.attached,
      url: await contractUrl(projectId, input.contractId),
    });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: contractKind('recorded', input.contractId),
      summary: `Recorded ${clientName}'s signature on ${result.title}, given outside the portal`,
      target: 'contracts',
      email: { to: actor.project.clientEmail, subject, content },
    });
    return done(
      `${recorded(result.title)}${emailStatus === 'sent' ? ` We emailed ${clientName} a copy.` : emailNote(emailStatus, clientName)}`,
    );
  });
}

/* ---------- Studio: delete while unsigned ---------- */

export async function deleteContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioActor(formData.get('projectId'));
    const input = parseForm(contractSchema, formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);

    const title = await getDb().transaction(async (tx) => {
      const locked = await lockOrFail(tx, projectId, input.contractId);
      if (locked.signature || locked.hasSignedCopy) {
        throw new ActionError(`Can't delete: ${signedReason(locked, clientName)}. Signed records are kept.`);
      }
      const files = await tx.select({ fileId: contractFile.fileId }).from(contractFile).where(eq(contractFile.contractId, locked.id));
      await tx.delete(contract).where(eq(contract.id, locked.id));
      // The bytes stay in storage for the studio; the files no longer download for the client
      const fileIds = files.map((entry) => entry.fileId);
      if (fileIds.length) await tx.update(file).set({ removedAt: new Date() }).where(inArray(file.id, fileIds));
      await tx.delete(rateLimit).where(eq(rateLimit.key, `portal:contract-email:${locked.id}`));
      return locked.title;
    });

    refresh(projectId);
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: contractKind('deleted', input.contractId),
      summary: `Deleted ${title}`,
      target: 'contracts',
      visibility: 'studio',
    });
    return done(`Deleted ${title}.`);
  });
}

/* ---------- Client: sign in the portal ---------- */

const signSchema = z.object({
  projectId: fields.uuid,
  contractId: fields.uuid,
  // What the client had on screen: if the document or its title changed, the signature is refused
  shownFileId: fields.uuid,
  shownTitle: z.string().max(400),
  confirm: checkbox,
  signedName: fields.requiredText('your full name', 120).pipe(z.string().min(2, { error: 'Enter your full name, as you would sign it.' })),
  note: fields.optionalText('the note', 2000),
});

export async function signContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await projectActor(formData.get('projectId'), { clientOnly: true });
    const ticked = formData.get('confirm') === 'on';
    const input = parseWithChecks(signSchema, formData, ticked ? {} : { confirm: 'Tick the box to confirm you agree.' });
    const projectId = actor.project.id;
    const meta = await requestMeta();

    const result = await getDb().transaction(async (tx) => {
      // Before any other lock: the project may have moved to another client since projectActor
      await assertStillClient(tx, actor);
      const locked = await lockOrFail(tx, projectId, input.contractId);
      // A double click: the first click already signed it
      const mine = (signature: { source: string; signerId: string } | null) =>
        signature?.source === 'client' && signature.signerId === actor.user.id;
      if (mine(locked.signature)) return { duplicate: true as const, title: locked.title };
      if (locked.signature) throw new ActionError(`${locked.title} is already signed.`);
      if (!locked.requiresSignature) {
        throw new ActionError(`${locked.title} no longer needs your signature. Reload the page to see the latest.`);
      }
      if (locked.hasSignedCopy) throw new ActionError(`${locked.title} is already signed: you uploaded a signed copy.`);
      const original = locked.original;
      if (!original) throw new ActionError('This contract has no document to sign yet. Reload the page.');
      if (original.fileId !== input.shownFileId) {
        throw new ActionError('We just replaced this document with a new version. Reload the page, read the new one, then sign it.');
      }
      if (locked.title !== input.shownTitle) {
        throw new ActionError(`This contract was just renamed to ${locked.title}. Reload the page, check it, then sign again.`);
      }

      const statement = signStatement(locked.title, original.filename, original.sha256);
      const [inserted] = await tx
        .insert(contractSignature)
        .values({
          contractId: locked.id,
          projectId,
          fileId: original.fileId,
          fileSha256: original.sha256,
          source: 'client',
          signerId: actor.user.id,
          signerEmail: actor.user.email,
          signedName: input.signedName,
          statement,
          note: input.note,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        })
        .onConflictDoNothing({ target: contractSignature.contractId })
        .returning({ signedAt: contractSignature.signedAt });
      if (!inserted) {
        const [raced] = await tx
          .select({ source: contractSignature.source, signerId: contractSignature.signerId })
          .from(contractSignature)
          .where(eq(contractSignature.contractId, locked.id));
        if (mine(raced ?? null)) return { duplicate: true as const, title: locked.title };
        throw new ActionError(`${locked.title} is already signed.`);
      }
      return {
        duplicate: false as const,
        title: locked.title,
        statement,
        filename: original.filename,
        sha256: original.sha256,
        signedAt: inserted.signedAt,
      };
    });

    const thanks = `Thanks, ${result.title} is signed.`;
    if (result.duplicate) return done(thanks);

    refresh(projectId);
    const clientName = clientNameOf(actor);
    const emails = signedEmails({
      clientName,
      title: result.title,
      filename: result.filename,
      sha256: result.sha256,
      signedName: input.signedName,
      signerEmail: actor.user.email,
      statement: result.statement,
      at: result.signedAt,
      note: input.note,
      url: await contractUrl(projectId, input.contractId),
    });
    const [, receipt] = await Promise.all([
      recordActivity({
        projectId,
        actorId: actor.user.id,
        kind: contractKind('signed', input.contractId),
        summary: `${clientName} signed ${result.title}`,
        target: 'contracts',
        email: { to: STUDIO_EMAIL, replyTo: actor.user.email, ...emails.studio },
      }),
      recordActivity({
        projectId,
        actorId: actor.user.id,
        kind: contractKind('receipt', input.contractId),
        summary: `Receipt emailed to ${clientName}: signature on ${result.title}`,
        target: 'contracts',
        visibility: 'studio',
        email: { to: actor.user.email, ...emails.receipt },
      }),
    ]);
    return done(
      receipt.emailStatus === 'sent'
        ? `${thanks} We've emailed you a receipt.`
        : receipt.emailStatus === 'failed'
          ? `${thanks} We couldn't email your receipt just now, but your signature is saved here.`
          : thanks,
    );
  });
}

/* ---------- Client: upload a copy signed elsewhere ---------- */

const signedCopySchema = z.object({
  projectId: fields.uuid,
  contractId: fields.uuid,
  contractFileId: fields.uuid,
  // The document the client had on screen: a copy of a version the studio has since replaced
  // is refused, as a portal signature would be
  shownFileId: fields.uuid,
  note: fields.optionalText('the note', 1000),
});

export async function uploadSignedCopy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await projectActor(formData.get('projectId'), { clientOnly: true });
    const upload = chosenFile(formData);
    const input = parseWithChecks(signedCopySchema, formData, upload ? {} : { file: 'Choose your signed copy.' });
    const projectId = actor.project.id;
    const thanks = (title: string) => `Thanks, we have your signed copy of ${title}.`;
    // One signed copy at a time: another can follow once the studio sends this one back, so
    // each copy (and its email to the studio) waits on a person in between
    const refuse = (locked: LockedContract) => {
      if (!locked.requiresSignature) throw new ActionError(`${locked.title} doesn't need your signature.`);
      if (locked.status === 'countersigned') throw new ActionError(`${locked.title} is already signed by both of us.`);
      if (locked.signature) throw new ActionError(`${locked.title} is already signed.`);
      if (locked.hasSignedCopy) {
        throw new ActionError(
          `You've already uploaded a signed copy of ${locked.title}. If it's the wrong file, tell us in Messages and we'll send it back so you can upload another.`,
        );
      }
      if (!locked.original || locked.original.fileId !== input.shownFileId) {
        // The client's card still shows the old version: refresh it, so the new one is there to download
        refresh(projectId);
        throw new ActionError(
          'We replaced this document since you opened it. The new version is on this page now: download it, sign that one, then upload it.',
        );
      }
    };

    const repeat = await existingContractFile(projectId, input.contractFileId);
    if (repeat) return done(thanks(repeat.title));
    refuse(await peek(projectId, input.contractId));

    // Counted before the bytes are stored, and given back if nothing comes of the upload
    const quota = upload ? await claimUploadQuota(actor.user.id, upload.size) : null;
    type Original = { filename: string; sha256: string; uploadedAt: Date; replaced: boolean };
    let result: { duplicate: boolean; title: string; filename: string; sha256: string; original: Original | null };
    try {
      result = await withUpload(actor, upload, async (tx, stored) => {
        // Before any other lock: the project may have moved to another client since projectActor
        await assertStillClient(tx, actor);
        const locked = await lockOrFail(tx, projectId, input.contractId);
        // A double submit that waited for the first one's lock
        const [already] = await tx
          .select({ id: contractFile.id })
          .from(contractFile)
          .where(and(eq(contractFile.id, input.contractFileId), eq(contractFile.contractId, locked.id)));
        if (already) return { duplicate: true, title: locked.title, filename: '', sha256: '', original: null };
        refuse(locked);
        const inserted = stored
          ? await tx
              .insert(contractFile)
              .values({
                id: input.contractFileId,
                contractId: locked.id,
                fileId: stored.id,
                label: 'client_signed',
                uploadedBy: actor.user.id,
              })
              .onConflictDoNothing({ target: contractFile.id })
              .returning({ id: contractFile.id })
          : [];
        return {
          duplicate: inserted.length === 0,
          title: locked.title,
          filename: stored?.filename ?? '',
          sha256: stored?.sha256 ?? '',
          // Which version the copy is of, and whether an earlier one came before it
          original: locked.original
            ? {
                filename: locked.original.filename,
                sha256: locked.original.sha256,
                uploadedAt: locked.original.uploadedAt,
                replaced: locked.original.replaced,
              }
            : null,
        };
      });
    } catch (error) {
      if (quota) await refundUploadQuota(quota);
      throw error;
    }
    if (result.duplicate || !result.original) {
      if (quota) await refundUploadQuota(quota);
      return done(thanks(result.title));
    }

    refresh(projectId);
    const clientName = clientNameOf(actor);
    const { subject, content } = signedCopyEmail({
      clientName,
      title: result.title,
      filename: result.filename,
      sha256: result.sha256,
      original: result.original,
      note: input.note,
      url: await contractUrl(projectId, input.contractId),
    });
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: contractKind('signedCopy', input.contractId),
      summary: `${clientName} uploaded a signed copy of ${result.title}`,
      target: 'contracts',
      email: { to: STUDIO_EMAIL, replyTo: actor.user.email, subject, content },
    });
    return done(`${thanks(result.title)} We'll check it and add our countersigned copy here.`);
  });
}

/* ---------- Studio: send back a signed copy that isn't right ---------- */

const returnSchema = z.object({
  projectId: fields.uuid,
  contractId: fields.uuid,
  // The client_signed contract_file row on screen
  contractFileId: fields.uuid,
  reason: fields.requiredText("what's wrong with it", 1000),
});

export async function returnSignedCopy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, async () => {
    const actor = await studioActor(formData.get('projectId'));
    const input = parseForm(returnSchema, formData);
    const projectId = actor.project.id;
    const clientName = clientNameOf(actor);
    const sentBack = (title: string) => `Sent back the signed copy. ${title} is waiting for ${clientName}'s signature again.`;

    const result = await getDb().transaction(async (tx) => {
      const locked = await lockOrFail(tx, projectId, input.contractId);
      const [copy] = await tx
        .select({
          fileId: file.id,
          filename: file.filename,
          removedAt: file.removedAt,
          label: contractFile.label,
          uploaderRole: user.role,
        })
        .from(contractFile)
        .innerJoin(file, eq(file.id, contractFile.fileId))
        .innerJoin(user, eq(user.id, contractFile.uploadedBy))
        .where(and(eq(contractFile.id, input.contractFileId), eq(contractFile.contractId, locked.id)))
        .for('update', { of: file });
      if (!copy || copy.label !== 'client_signed') throw new ActionError('That signed copy could not be found. Reload the page.');
      // A second click: it is already back with them
      if (copy.removedAt) return { repeat: true as const, title: locked.title };
      // A copy the studio attached to a recorded signature belongs to that record
      if (locked.signature || copy.uploaderRole === 'admin') {
        throw new ActionError(`${locked.title} has a signature on record, so its signed copy is kept.`);
      }
      if (locked.status === 'countersigned') {
        throw new ActionError(`You've added the countersigned copy of ${locked.title}, so the signed copies are kept.`);
      }
      // Kept for the record, hidden from the client, and no longer a signature
      await tx
        .update(file)
        .set({ removedAt: sql`now()` })
        .where(eq(file.id, copy.fileId));
      return { repeat: false as const, title: locked.title, filename: copy.filename };
    });
    if (result.repeat) return done(sentBack(result.title));

    refresh(projectId);
    const { subject, content } = returnedCopyEmail({
      projectName: actor.project.name,
      clientName: actor.project.clientName,
      title: result.title,
      filename: result.filename,
      reason: input.reason,
      url: await contractUrl(projectId, input.contractId),
    });
    // The change, for every timeline; the note, by email to the client and on the studio's
    // record only, so it never shows in the timeline a later client of the project reads
    await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: returnedKind('returned', input.contractId, input.contractFileId),
      summary: `Sent back the signed copy of ${result.title}`,
      target: 'contracts',
    });
    const { emailStatus } = await recordActivity({
      projectId,
      actorId: actor.user.id,
      kind: returnedKind('returnedNote', input.contractId, input.contractFileId),
      summary: returnedNoteSummary(clientName, result.title, input.reason),
      target: 'contracts',
      visibility: 'studio',
      email: { to: actor.project.clientEmail, subject, content },
    });
    return done(
      `${sentBack(result.title)}${emailStatus === 'sent' ? ` We emailed ${clientName} your note.` : emailNote(emailStatus, clientName)}`,
    );
  });
}

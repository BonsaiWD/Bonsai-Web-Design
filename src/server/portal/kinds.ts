import 'server-only';
import { isUuid } from './access';

/*
 * Activity kinds read "<feature>.<event>:<id>", such as "contract.signed:<contractId>" (a
 * contract's sent-back copy adds ":<contractFileId>"). The id lets a page show an item's
 * history, a failed email link back to its item, and a later email about the same item clear
 * that failure. Each feature lists its events and builds its kinds with kindMaker.
 *
 * Kinds with no item (project.*, message) have no id. Milestone rows written before ids were
 * added read "milestone_<event>"; parseKind still reads them.
 */

export function kindMaker<const K extends Record<string, string>>(kinds: K) {
  return (event: keyof K, id: string, ...more: string[]): string => [kinds[event], id, ...more].join(':');
}

export interface ParsedKind {
  feature: string;
  event: string;
  // The item's id, when the kind carries a valid one
  id: string | null;
  // Anything after the id
  more: string[];
}

export function parseKind(kind: string): ParsedKind {
  const [head, id, ...more] = kind.split(':');
  const dot = head.indexOf('.');
  const legacy = dot < 0 ? /^(milestone)_(.+)$/.exec(head) : null;
  return {
    feature: dot >= 0 ? head.slice(0, dot) : (legacy?.[1] ?? head),
    event: dot >= 0 ? head.slice(dot + 1) : (legacy?.[2] ?? ''),
    id: id && isUuid(id) ? id : null,
    more,
  };
}

// The item a kind is about, for failedEmails' subjectOf and for grouping rows by item
export function kindItemId(kind: string): string | null {
  return parseKind(kind).id;
}

/*
 * The kinds whose failed emails the studio's dashboard flags (failedEmails), by prefix. Every
 * feature that sends email lists its kinds here and flags through failedEmails, and emailNote
 * only says "flagged on your dashboard" for a kind listed here.
 */
export const FLAGGED_EMAIL_KINDS = {
  contract: ['contract.'],
  deliverable: ['deliverable'],
  file: ['file.'],
  milestone: ['milestone'],
  project: ['project.'],
  message: ['message'],
  // Emails to the client; a reported payment is already on the dashboard as its own item
  invoice: ['invoice.sent:', 'invoice.reminded:', 'invoice.not_received:', 'invoice.paid:'],
} as const satisfies Record<string, readonly string[]>;

export function isFlaggedEmailKind(kind: string): boolean {
  return Object.values(FLAGGED_EMAIL_KINDS).some((prefixes) => prefixes.some((prefix) => kind.startsWith(prefix)));
}

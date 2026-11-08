import { plural } from '@/lib/portal-format';
import type { ProjectRecordCounts } from './types';

// Shared by the settings page and its actions, so the explanation on the page and the
// refusal from the server always name the same records

export function signedRecords(records: ProjectRecordCounts): string[] {
  const parts: string[] = [];
  if (records.decidedVersions) parts.push(plural(records.decidedVersions, 'deliverable decision'));
  if (records.signoffs) parts.push(plural(records.signoffs, 'milestone sign-off'));
  if (records.signatures) parts.push(plural(records.signatures, 'contract signature'));
  if (records.issuedInvoices) parts.push(plural(records.issuedInvoices, 'sent invoice'));
  return parts;
}

export function hasSignedRecords(records: ProjectRecordCounts): boolean {
  return signedRecords(records).length > 0;
}

// "a, b and c"
export function listParts(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// What a delete removes, in the order the project is built
export function deletableParts(records: ProjectRecordCounts): string[] {
  const parts: string[] = [];
  if (records.milestones) parts.push(plural(records.milestones, 'milestone'));
  if (records.deliverables) {
    parts.push(`${plural(records.deliverables, 'deliverable')} (${plural(records.versions, 'version')})`);
  }
  if (records.contracts) parts.push(plural(records.contracts, 'contract'));
  if (records.draftInvoices) parts.push(plural(records.draftInvoices, 'draft invoice'));
  if (records.messages) parts.push(plural(records.messages, 'message'));
  if (records.files) parts.push(plural(records.files, 'uploaded file'));
  if (records.activity) parts.push(plural(records.activity, 'activity entry', 'activity entries'));
  return parts;
}

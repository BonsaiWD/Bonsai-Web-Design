import type { StatusTone } from '../ui/feedback';
import type { ContractStatus, Perspective } from './types';

// The client hears what it means for them; the studio reads the state
const LABELS: Record<ContractStatus, { client: string; studio: string; clientTone: StatusTone; studioTone: StatusTone }> = {
  awaiting: { client: 'Awaiting your signature', studio: 'Awaiting signature', clientTone: 'action', studioTone: 'active' },
  signed: { client: 'Signed', studio: 'Signed', clientTone: 'done', studioTone: 'done' },
  countersigned: { client: 'Countersigned', studio: 'Countersigned', clientTone: 'done', studioTone: 'done' },
  reference: { client: 'For your records', studio: 'No signature needed', clientTone: 'muted', studioTone: 'muted' },
};

export function contractLabel(status: ContractStatus, perspective: Perspective): { label: string; tone: StatusTone } {
  const entry = LABELS[status];
  return perspective === 'client' ? { label: entry.client, tone: entry.clientTone } : { label: entry.studio, tone: entry.studioTone };
}

// Groups in reading order: what needs someone comes first
export const GROUP_ORDER: ContractStatus[] = ['awaiting', 'signed', 'countersigned', 'reference'];

export const GROUP_TITLES: Record<Perspective, Record<ContractStatus, string>> = {
  client: {
    awaiting: 'Needs your signature',
    signed: 'Signed',
    countersigned: 'Signed by both of us',
    reference: 'For your records',
  },
  studio: {
    awaiting: 'Awaiting signature',
    signed: 'Signed, not yet countersigned',
    countersigned: 'Countersigned',
    reference: 'Reference documents',
  },
};

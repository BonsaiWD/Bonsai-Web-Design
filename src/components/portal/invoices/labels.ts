import type { InvoiceStatus, PaymentMethod } from '@/db/schema';
import type { StatusTone } from '../ui/feedback';
import type { Perspective } from './types';

// The owner's list, in the order clients see it
export const METHOD_ORDER: PaymentMethod[] = ['bitcoin', 'monero', 'litecoin', 'zelle', 'ach', 'venmo'];

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  bitcoin: 'Bitcoin',
  monero: 'Monero',
  litecoin: 'Litecoin',
  zelle: 'Zelle',
  ach: 'ACH bank transfer',
  venmo: 'Venmo',
};

// What the studio enters on the settings page, and what a copy button copies when a line has no label
export const METHOD_DETAILS: Record<PaymentMethod, { asks: string; noun: string; crypto: boolean }> = {
  bitcoin: { asks: 'Your Bitcoin wallet address', noun: 'Bitcoin address', crypto: true },
  monero: { asks: 'Your Monero wallet address', noun: 'Monero address', crypto: true },
  litecoin: { asks: 'Your Litecoin wallet address', noun: 'Litecoin address', crypto: true },
  zelle: { asks: 'The email or phone number your Zelle account uses', noun: 'Zelle email or phone', crypto: false },
  ach: { asks: 'Account name, bank, routing number and account number', noun: 'bank detail', crypto: false },
  venmo: { asks: 'Your Venmo handle', noun: 'Venmo handle', crypto: false },
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (METHOD_ORDER as string[]).includes(value);
}

export interface PaymentDetail {
  label: string | null;
  value: string;
}

// One detail per line. "Routing number: 021000021" shows the label and copies only the number;
// a line without a label (a wallet address) copies whole. A URL's "https:" is not a label.
export function paymentDetails(instructions: string): PaymentDetail[] {
  return instructions
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^([^:]{1,40}):\s+(\S.*)$/.exec(line);
      return match ? { label: match[1].trim(), value: match[2].trim() } : { label: null, value: line };
    });
}

/* ---------- Status ---------- */

// The client reads what it means for them; the studio reads the state
export function invoiceStatus(status: InvoiceStatus, perspective: Perspective, overdue: boolean): { label: string; tone: StatusTone } {
  const client = perspective === 'client';
  switch (status) {
    case 'draft':
      return { label: 'Draft', tone: 'muted' };
    case 'sent':
      if (overdue) return { label: 'Overdue', tone: 'alert' };
      return client ? { label: 'To pay', tone: 'action' } : { label: 'Sent', tone: 'active' };
    case 'payment_reported':
      return client ? { label: 'Confirming your payment', tone: 'active' } : { label: 'Payment reported', tone: 'action' };
    case 'paid':
      return { label: 'Paid', tone: 'done' };
    case 'void':
      return client ? { label: 'Cancelled', tone: 'muted' } : { label: 'Void', tone: 'muted' };
  }
}

export function isOverdue(status: InvoiceStatus, dueOn: string | null, today: string): boolean {
  return status === 'sent' && Boolean(dueOn && dueOn < today);
}

// Open invoices still ask something of someone; closed ones are the record
export function isOpen(status: InvoiceStatus): boolean {
  return status === 'draft' || status === 'sent' || status === 'payment_reported';
}

export function listMethods(methods: PaymentMethod[]): string {
  const labels = methods.map((method) => METHOD_LABELS[method]);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

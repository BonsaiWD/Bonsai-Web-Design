import type { InvoiceStatus, PaymentMethod } from '@/db/schema';

// What the invoice pages pass from the server to their client components. The server builds
// these per perspective: the client's copy never carries drafts or the studio's record details.

export type Perspective = 'client' | 'studio';

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

// The studio marked a reported payment "Not received yet", and the invoice is open again
export interface NotReceivedView {
  at: string;
  // When the client reported it
  reportedAt: string | null;
  // As the client gave them: the method's label and their reference
  method: string | null;
  reference: string | null;
  // The studio's note to the client
  note: string | null;
}

// One row of the invoice list
export interface InvoiceSummary {
  id: string;
  number: string;
  title: string;
  status: InvoiceStatus;
  issuedOn: string | null;
  dueOn: string | null;
  totalCents: number;
  paidOn: string | null;
  reportedAt: string | null;
  lineCount: number;
}

export interface InvoiceHistoryEntry {
  id: string;
  summary: string;
  at: string;
  emailTo: string | null;
  emailStatus: 'sent' | 'failed' | 'skipped' | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  notes: string | null;
  lines: InvoiceLine[];
  subtotalCents: number;
  // What the client said they sent, while the studio checks it arrived
  reported: { method: PaymentMethod; reference: string | null; at: string } | null;
  paid: { on: string; method: PaymentMethod; reference: string | null } | null;
  // Open again after a reported payment did not arrive
  notReceived: NotReceivedView | null;
  // Studio perspective only
  studio?: {
    // Changes on every save, so an edit or a send from a stale page is refused
    version: string;
    createdAt: string;
    createdByName: string | null;
    // The newest email to the client about this invoice
    lastEmailedAt: string | null;
    lastEmailFailed: boolean;
    // When "Email again" can next send (ISO), or null when it can send now
    nextEmailAt: string | null;
    history: InvoiceHistoryEntry[];
  };
}

export interface PaymentMethodView {
  method: PaymentMethod;
  enabled: boolean;
  instructions: string;
}

// Who the invoice is from and to, as printed on the statement
export interface InvoiceParties {
  studioName: string;
  studioEmail: string;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string;
}

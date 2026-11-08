'use client';

import { useId, type RefObject } from 'react';
import styled from 'styled-components';
import { reportPayment } from '@/app/portal/_actions/invoices';
import { NoteBlock } from '@/components/portal/deliverables/parts';
import { dueInfo, formatMoney } from '@/lib/portal-format';
import {
  Button,
  ClientOnlyNote,
  DateText,
  Divider,
  DueText,
  Eyebrow,
  Field,
  FormDialog,
  Input,
  LocalTime,
  Meta,
  MetaLine,
  Panel,
  Select,
  Stack,
  StatusBadge,
  Text,
  type,
  useDialog,
  type Announce,
} from '@/components/portal/ui';
import { HowToPay } from './HowToPay';
import { invoiceStatus, isOverdue, METHOD_LABELS, METHOD_ORDER } from './labels';
import { Amount, Inset } from './parts';
import type { InvoiceDetail, NotReceivedView, PaymentMethodView } from './types';

const RecordText = styled.p`
  ${type.body}
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
`;

function MethodField({ methods }: { methods: PaymentMethodView[] }) {
  // With no methods set up, the client paid with details sent separately: any of the six fits
  const options = methods.length ? methods.map((method) => method.method) : METHOD_ORDER;
  return (
    <Field label="How did you pay?" name="method" saved={options.length === 1 ? options[0] : ''}>
      {(control) => (
        <Select
          id={control.id}
          name={control.name}
          defaultValue={control.defaultValue}
          aria-invalid={control.invalid || undefined}
          aria-describedby={control.describedBy}
        >
          <option value="" disabled>
            Choose one
          </option>
          {options.map((method) => (
            <option key={method} value={method}>
              {METHOD_LABELS[method]}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

// The client reported a payment, and the studio has not seen it arrive: why it is open again
function NotReceived({ record }: { record: NotReceivedView }) {
  const how = record.method ? ` (${record.method}${record.reference ? `, ${record.reference}` : ''})` : '';
  return (
    <Inset>
      <RecordText>
        We haven&apos;t received the payment you reported
        {record.reportedAt ? (
          <>
            {' '}
            on <LocalTime value={record.reportedAt} />
          </>
        ) : null}
        {how}, so this invoice is open again.
      </RecordText>
      {record.note && (
        <NoteBlock>
          <h5>Our note</h5>
          <p>{record.note}</p>
        </NoteBlock>
      )}
      <Meta>
        Reopened <LocalTime value={record.at} />. Once you&apos;ve checked, pay as below and tell us again, or message us if it&apos;s already gone.
      </Meta>
    </Inset>
  );
}

interface ClientPaymentProps {
  projectId: string;
  invoice: InvoiceDetail;
  today: string;
  methods: PaymentMethodView[];
  // The signed-in person is the project's client; an admin previewing sees static text
  canPay: boolean;
  clientName: string;
  announce: Announce;
  statusRef: RefObject<HTMLParagraphElement | null>;
}

export function ClientPayment({ projectId, invoice, today, methods, canPay, clientName, announce, statusRef }: ClientPaymentProps) {
  const headingId = useId();
  const report = useDialog();
  const overdue = isOverdue(invoice.status, invoice.dueOn, today);
  const money = formatMoney(invoice.totalCents);
  const heading =
    invoice.status === 'sent' ? 'Amount due' : invoice.status === 'paid' ? 'Paid' : invoice.status === 'void' ? 'Cancelled' : 'Amount';

  return (
    <>
      <Panel aria-labelledby={headingId}>
        <Stack $gap={6}>
          <Stack $gap={2}>
            <Eyebrow id={headingId}>{heading}</Eyebrow>
            <Amount>{money}</Amount>
            {invoice.status === 'sent' && invoice.dueOn && (
              <MetaLine>
                <>
                  Due <DateText value={invoice.dueOn} />
                </>
                {/* "Due in 3 days" or "2 days overdue"; a date further out is already said */}
                {dueInfo(invoice.dueOn, today).tone !== 'later' && <DueText value={invoice.dueOn} today={today} />}
              </MetaLine>
            )}
            {invoice.status === 'payment_reported' && (
              <div>
                <StatusBadge tone={invoiceStatus(invoice.status, 'client', overdue).tone}>Confirming your payment</StatusBadge>
              </div>
            )}
          </Stack>

          {invoice.status === 'sent' && (
            <>
              {invoice.notReceived && <NotReceived record={invoice.notReceived} />}
              <Divider />
              <HowToPay methods={methods} invoiceNumber={invoice.number} />
              <Stack $gap={3} data-print-hide>
                <Divider />
                {canPay ? (
                  <>
                    <Button $block onClick={report.openDialog}>
                      I&apos;ve sent payment
                    </Button>
                    <Meta>Tell us once you&apos;ve paid. We&apos;ll confirm when it arrives and email you a receipt.</Meta>
                  </>
                ) : (
                  <ClientOnlyNote>
                    Only {clientName} can tell us about a payment.
                  </ClientOnlyNote>
                )}
              </Stack>
            </>
          )}

          {invoice.reported && (
            <Inset>
              <RecordText>
                You told us you paid by {METHOD_LABELS[invoice.reported.method]} on <LocalTime value={invoice.reported.at} />.
              </RecordText>
              {invoice.reported.reference && <Meta>Reference: {invoice.reported.reference}</Meta>}
              <Meta>We&apos;ll email you a receipt once it arrives. If something isn&apos;t right, message us.</Meta>
            </Inset>
          )}

          {invoice.paid && (
            <Stack $gap={2}>
              <RecordText>
                Thank you. We received your payment by {METHOD_LABELS[invoice.paid.method]} on <DateText value={invoice.paid.on} />.
              </RecordText>
              {invoice.paid.reference && <Meta>Reference: {invoice.paid.reference}</Meta>}
              <Meta data-print-hide>You can print this invoice or save it as a PDF for your records.</Meta>
            </Stack>
          )}

          {invoice.status === 'void' && <Text $muted>This invoice was cancelled, so there&apos;s nothing to pay. If you have a question about it, message us.</Text>}
        </Stack>
      </Panel>

      {canPay && (
        <FormDialog
          dialog={report}
          title="Tell us you've sent payment"
          description={`For ${invoice.number}, ${money}. We'll check it has arrived, then email you a receipt.`}
          action={reportPayment}
          submitLabel="Send to the studio"
          pendingLabel="Sending…"
          onSuccess={(state) => announce(state.message)}
          returnFocusTo={statusRef}
          hidden={
            <>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="invoiceId" value={invoice.id} />
            </>
          }
        >
          <MethodField methods={methods} />
          <Field
            label="Reference or transaction ID"
            name="reference"
            optional
            hint="A transaction hash, Zelle confirmation or bank reference helps us match it quickly."
          >
            {(control) => (
              <Input
                id={control.id}
                name={control.name}
                defaultValue={control.defaultValue}
                aria-invalid={control.invalid || undefined}
                aria-describedby={control.describedBy}
                autoComplete="off"
                maxLength={200}
              />
            )}
          </Field>
        </FormDialog>
      )}
    </>
  );
}

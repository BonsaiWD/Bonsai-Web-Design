'use client';

import { useId, type RefObject } from 'react';
import styled from 'styled-components';
import { FiAlertCircle, FiEdit3, FiMail, FiSend } from 'react-icons/fi';
import {
  deleteInvoice,
  emailInvoiceAgain,
  markInvoicePaid,
  markPaymentNotReceived,
  sendInvoice,
  voidInvoice,
} from '@/app/portal/_actions/invoices';
import { firstName, formatMoney } from '@/lib/portal-format';
import {
  ActionForm,
  Button,
  ConfirmAction,
  DataList,
  DateText,
  DueText,
  Eyebrow,
  Field,
  FieldRow,
  FormDialog,
  FormMessage,
  H3,
  Input,
  LocalTime,
  Meta,
  MetaLine,
  Notice,
  Panel,
  sansHeading,
  Select,
  space,
  Stack,
  StatusBadge,
  SubmitButton,
  Text,
  Textarea,
  tint,
  type,
  useDialog,
  type Announce,
} from '@/components/portal/ui';
import { invoiceStatus, isOverdue, METHOD_LABELS, METHOD_ORDER } from './labels';
import { Amount, Inset } from './parts';
import type { InvoiceDetail } from './types';

const RecordTitle = styled.p`
  ${type.label}
`;

const EmailNote = styled.p<{ $failed: boolean }>`
  ${type.meta}
  ${type.figures}
  display: flex;
  align-items: flex-start;
  gap: ${space[2]};
  color: ${({ $failed, theme }) => ($failed ? theme.colors.error : theme.colors.textSecondary)};

  svg {
    flex-shrink: 0;
    margin-top: 0.2em;
  }
`;

// Destructive actions sit apart from the primary ones, under their own hairline
const DangerZone = styled.div`
  &[hidden] {
    display: none;
  }

  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  padding-top: ${space[5]};
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};

  p {
    ${type.meta}
  }
`;

const History = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;

  li {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    padding: ${space[3]} 0 ${space[3]} ${space[4]};
    border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};
    position: relative;
  }

  /* A small bronze node on the line, as the milestone branch does */
  li::before {
    content: '';
    position: absolute;
    left: -4px;
    top: calc(${space[3]} + 0.45em);
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
  }

  p {
    ${type.body}
    font-size: 0.9375rem;
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
  }

  h4 {
    ${sansHeading}
  }
`;

const EmailFlag = styled.span<{ $failed: boolean }>`
  color: ${({ $failed, theme }) => ($failed ? theme.colors.error : theme.colors.textSecondary)};
`;

function LastEmailed({ invoice, clientName }: { invoice: InvoiceDetail; clientName: string }) {
  const studio = invoice.studio;
  if (!studio?.lastEmailedAt) return null;
  if (studio.lastEmailFailed) {
    return (
      <EmailNote $failed role="alert">
        <FiAlertCircle aria-hidden="true" />
        <span>
          The last email to {clientName} could not be sent (<LocalTime value={studio.lastEmailedAt} />). Try emailing again.
        </span>
      </EmailNote>
    );
  }
  return (
    <EmailNote $failed={false}>
      <FiMail aria-hidden="true" />
      <span>
        Last emailed <LocalTime value={studio.lastEmailedAt} />
      </span>
    </EmailNote>
  );
}

function EmailAgain({ projectId, invoice, label }: { projectId: string; invoice: InvoiceDetail; label: string }) {
  return (
    <ActionForm action={emailInvoiceAgain}>
      <Stack $gap={2}>
        <SubmitButton variant="secondary" pendingLabel="Sending…" block>
          {label}
        </SubmitButton>
        <FormMessage />
      </Stack>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="invoiceId" value={invoice.id} />
    </ActionForm>
  );
}

function Ids({ projectId, invoice, withVersion = false }: { projectId: string; invoice: InvoiceDetail; withVersion?: boolean }) {
  return (
    <>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="invoiceId" value={invoice.id} />
      {withVersion && <input type="hidden" name="version" value={invoice.studio?.version ?? ''} />}
    </>
  );
}

// What still has to be filled in before a draft can go out
function missingForSend(invoice: InvoiceDetail): string[] {
  return [
    !invoice.issuedOn && 'an issue date',
    !invoice.dueOn && 'a due date',
    invoice.lines.length === 0 && 'at least one line item',
    invoice.lines.length > 0 && invoice.totalCents <= 0 && 'a total above $0.00',
  ].filter(Boolean) as string[];
}

function sentence(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

interface StudioInvoicePanelProps {
  projectId: string;
  invoice: InvoiceDetail;
  today: string;
  clientName: string;
  clientEmail: string;
  methodsShown: number;
  onEdit: () => void;
  editButtonRef: RefObject<HTMLButtonElement | null>;
  announce: Announce;
  statusRef: RefObject<HTMLParagraphElement | null>;
}

export function StudioInvoicePanel({
  projectId,
  invoice,
  today,
  clientName,
  clientEmail,
  methodsShown,
  onEdit,
  editButtonRef,
  announce,
  statusRef,
}: StudioInvoicePanelProps) {
  const headingId = useId();
  const historyId = useId();
  const send = useDialog();
  const paid = useDialog();
  const notReceived = useDialog();
  const client = firstName(clientName) ?? clientName;
  const overdue = isOverdue(invoice.status, invoice.dueOn, today);
  const badge = invoiceStatus(invoice.status, 'studio', overdue);
  const money = formatMoney(invoice.totalCents);
  const missing = invoice.status === 'draft' ? missingForSend(invoice) : [];
  const dueLater = invoice.status === 'draft' && invoice.dueOn && invoice.dueOn < today;
  const done = (state: { message: string }) => announce(state.message);

  return (
    <>
      <Panel aria-labelledby={headingId} data-print-hide>
        <Stack $gap={5}>
          <Stack $gap={2}>
            <Eyebrow id={headingId}>{invoice.status === 'paid' ? 'Paid' : 'Total'}</Eyebrow>
            <Amount>{money}</Amount>
            <MetaLine>
              <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
              {invoice.status === 'sent' && invoice.dueOn && <DueText value={invoice.dueOn} today={today} />}
            </MetaLine>
          </Stack>

          {invoice.status === 'draft' && (
            <>
              {missing.length > 0 ? (
                <Notice>Before you can send it, edit the draft to add {sentence(missing)}.</Notice>
              ) : (
                <Meta>
                  Only the studio can see this draft. Sending it emails {client} a link to this invoice.
                </Meta>
              )}
              <Stack $gap={3}>
                <Button
                  $block
                  aria-disabled={missing.length > 0 || undefined}
                  onClick={(event) => {
                    if (missing.length === 0) send.openDialog(event);
                  }}
                >
                  <FiSend aria-hidden="true" />
                  Send to {client}
                </Button>
                <Button ref={editButtonRef} $block $variant="secondary" onClick={onEdit}>
                  <FiEdit3 aria-hidden="true" />
                  Edit draft
                </Button>
              </Stack>
              <DangerZone>
                <ConfirmAction
                  block
                  label="Delete draft"
                  question={`Delete draft ${invoice.number}? This can't be undone.`}
                  confirmLabel="Delete draft"
                  pendingLabel="Deleting…"
                  action={deleteInvoice}
                  hidden={<Ids projectId={projectId} invoice={invoice} />}
                />
              </DangerZone>
            </>
          )}

          {invoice.status === 'sent' && (
            <>
              <LastEmailed invoice={invoice} clientName={client} />
              <Stack $gap={3}>
                <Button $block onClick={paid.openDialog}>
                  Mark paid
                </Button>
                <EmailAgain projectId={projectId} invoice={invoice} label={overdue ? `Remind ${client} it's overdue` : `Email ${client} again`} />
              </Stack>
            </>
          )}

          {/* Still mounted (hidden) once the invoice is void, so the confirm's result arrives */}
          {(invoice.status === 'sent' || invoice.status === 'void') && (
            <DangerZone hidden={invoice.status !== 'sent'}>
              <ConfirmAction
                block
                label="Void invoice"
                question={`Void ${invoice.number}? ${client} will see it as cancelled, and it can't be reopened.`}
                confirmLabel="Void invoice"
                pendingLabel="Voiding…"
                action={voidInvoice}
                onSuccess={done}
                hidden={<Ids projectId={projectId} invoice={invoice} />}
              />
            </DangerZone>
          )}

          {invoice.reported && (
            <>
              <Inset>
                <RecordTitle>{clientName} reported a payment</RecordTitle>
                <MetaLine>
                  {METHOD_LABELS[invoice.reported.method]}
                  {invoice.reported.reference ? `Reference ${invoice.reported.reference}` : 'No reference given'}
                </MetaLine>
                <Meta>
                  <LocalTime value={invoice.reported.at} />
                </Meta>
              </Inset>
              <Meta>Check it has arrived, then mark it paid to send {client} a receipt.</Meta>
              <Stack $gap={3}>
                <Button $block onClick={paid.openDialog}>
                  Mark paid
                </Button>
                <Button $block $variant="secondary" onClick={notReceived.openDialog}>
                  Not received yet
                </Button>
              </Stack>
            </>
          )}

          {invoice.paid && (
            <>
              <Inset>
                <RecordTitle>
                  Paid <DateText value={invoice.paid.on} /> by {METHOD_LABELS[invoice.paid.method]}
                </RecordTitle>
                {invoice.paid.reference && <Meta>Reference {invoice.paid.reference}</Meta>}
              </Inset>
              <LastEmailed invoice={invoice} clientName={client} />
              <EmailAgain projectId={projectId} invoice={invoice} label="Email the receipt again" />
            </>
          )}

          {invoice.status === 'void' && <Text $muted>Void. {client} sees this invoice as cancelled, with nothing to pay.</Text>}
        </Stack>
      </Panel>

      {invoice.studio && invoice.studio.history.length > 0 && (
        <Panel aria-labelledby={historyId} data-print-hide>
          <Stack $gap={4}>
            <H3 id={historyId}>History</H3>
            <History>
              {invoice.studio.history.map((entry) => (
                <li key={entry.id}>
                  <p>{entry.summary}</p>
                  <MetaLine>
                    <LocalTime value={entry.at} />
                    {entry.emailStatus === 'sent' && <EmailFlag $failed={false}>Emailed {entry.emailTo}</EmailFlag>}
                    {entry.emailStatus === 'failed' && <EmailFlag $failed>Email to {entry.emailTo} failed</EmailFlag>}
                    {entry.emailStatus === 'skipped' && <EmailFlag $failed={false}>Preview: not emailed</EmailFlag>}
                  </MetaLine>
                </li>
              ))}
            </History>
          </Stack>
        </Panel>
      )}

      {/* Dialogs stay mounted when the status changes, so their result still arrives */}
      <FormDialog
        dialog={send}
        title={`Send ${invoice.number} to ${clientName}?`}
        description={`We'll email ${clientEmail} a link to this invoice. It can't be edited once it's sent.`}
        action={sendInvoice}
        submitLabel="Send invoice"
        pendingLabel="Sending…"
        onSuccess={done}
        returnFocusTo={statusRef}
        hidden={<Ids projectId={projectId} invoice={invoice} withVersion />}
      >
        <DataList>
          <div>
            <dt>Amount</dt>
            <dd>{money}</dd>
          </div>
          {invoice.dueOn && (
            <div>
              <dt>Due</dt>
              <dd>
                <DateText value={invoice.dueOn} />
              </dd>
            </div>
          )}
          <div>
            <dt>To</dt>
            <dd>{clientEmail}</dd>
          </div>
        </DataList>
        {dueLater && <Notice tone="alert">The due date has already passed, so {client} will see it as overdue.</Notice>}
        {methodsShown === 0 && (
          <Notice>No payment methods are turned on, so the invoice says you&apos;ll send payment details separately.</Notice>
        )}
      </FormDialog>

      <FormDialog
        dialog={paid}
        title={`Mark ${invoice.number} paid`}
        description={`Records the payment and emails ${client} a receipt.`}
        action={markInvoicePaid}
        submitLabel="Mark paid"
        pendingLabel="Saving…"
        onSuccess={done}
        returnFocusTo={statusRef}
        hidden={<Ids projectId={projectId} invoice={invoice} />}
      >
        <FieldRow>
          <Field label="Paid on" name="paidOn" saved={invoice.reported ? invoice.reported.at.slice(0, 10) : today}>
            {(control) => (
              <Input
                type="date"
                id={control.id}
                name={control.name}
                defaultValue={control.defaultValue}
                aria-invalid={control.invalid || undefined}
                aria-describedby={control.describedBy}
              />
            )}
          </Field>
          <Field label="How it was paid" name="method" saved={invoice.reported?.method ?? ''}>
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
                {METHOD_ORDER.map((method) => (
                  <option key={method} value={method}>
                    {METHOD_LABELS[method]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FieldRow>
        <Field label="Reference" name="reference" optional saved={invoice.reported?.reference ?? ''} hint="A transaction ID or confirmation number, for your records and the receipt.">
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

      <FormDialog
        dialog={notReceived}
        title="Payment not arrived yet?"
        description={`${invoice.number} goes back to unpaid, and we email ${client} your note so they can check.`}
        action={markPaymentNotReceived}
        submitLabel={`Reopen and email ${client}`}
        pendingLabel="Sending…"
        onSuccess={done}
        returnFocusTo={statusRef}
        hidden={<Ids projectId={projectId} invoice={invoice} />}
      >
        <Field label={`Note to ${client}`} name="note" hint="Say what you checked, such as the account it should have reached or the reference.">
          {(control) => (
            <Textarea
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-invalid={control.invalid || undefined}
              aria-describedby={control.describedBy}
              rows={4}
            />
          )}
        </Field>
      </FormDialog>
    </>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiPlus } from 'react-icons/fi';
import type { PaymentMethod } from '@/db/schema';
import { firstName, formatMoney, plural } from '@/lib/portal-format';
import { projectHref } from '@/components/portal/tabs';
import {
  Button,
  DateText,
  DueText,
  EmptyState,
  focusRing,
  H2,
  H3,
  ListPanel,
  Meta,
  MetaText,
  Notice,
  Panel,
  PanelHeader,
  PHONE,
  SectionHeader,
  space,
  Stack,
  StatusBadge,
  TextLink,
  tint,
  type,
} from '@/components/portal/ui';
import { InvoiceEditor } from './InvoiceEditor';
import { invoiceStatus, isOpen, isOverdue, listMethods } from './labels';
import type { InvoiceSummary, Perspective } from './types';

/* ---------- Summary ---------- */

const Stats = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: ${space[5]} ${space[6]};
  margin: 0;

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    min-width: 0;
  }

  dt {
    ${type.overline}
  }

  dd {
    ${type.figures}
    margin: 0;
    font-size: 1.5rem;
    line-height: 1.2;
    font-weight: 500;
    letter-spacing: -0.015em;
    color: ${({ theme }) => theme.colors.text};
  }

  dd + dd {
    ${type.meta}
    font-weight: 400;
    letter-spacing: 0;
  }

  @media (max-width: ${PHONE}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    dd {
      font-size: 1.25rem;
    }
  }
`;

/* ---------- Table ---------- */

// Fixed columns, so the open and closed tables line up one above the other
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  ${type.figures}

  th.when {
    width: 24%;
  }

  th.amount {
    width: 9rem;
  }

  th.status {
    width: 15rem;
  }

  th {
    ${type.overline}
    padding: ${space[3]} ${space[6]};
    text-align: left;
    border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  }

  td {
    padding: ${space[4]} ${space[6]};
    vertical-align: middle;
    border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  tbody tr {
    scroll-margin-top: ${space[8]};
    transition: background-color 0.2s;
  }

  @media (hover: hover) {
    tbody tr:hover {
      background: ${({ theme }) => tint(theme.colors.primary, 5)};
    }
  }

  /* Arriving from a dashboard link or an email */
  tbody tr:target {
    background: ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  .amount {
    text-align: right;
    white-space: nowrap;
  }

  td.amount {
    ${type.body}
    color: ${({ theme }) => theme.colors.text};
  }

  .status {
    white-space: nowrap;
  }

  .when {
    ${type.meta}
    white-space: nowrap;
  }

  @media (max-width: ${PHONE}) {
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }

    tr {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: ${space[2]} ${space[4]};
      padding: ${space[4]} ${space[5]};
      border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
    }

    tbody tr:last-child {
      border-bottom: 0;
    }

    td {
      padding: 0;
      border: 0 !important;
    }

    /* Name and status on top, when and how much underneath */
    td.invoice {
      grid-column: 1;
      grid-row: 1;
    }

    td.status {
      grid-column: 2;
      grid-row: 1;
      justify-self: end;
      white-space: normal;
      text-align: right;
    }

    td.when {
      grid-column: 1;
      grid-row: 2;
      white-space: normal;
    }

    td.amount {
      grid-column: 2;
      grid-row: 2;
      font-weight: 600;
    }
  }
`;

const InvoiceLink = styled(Link)`
  display: inline-flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  text-decoration: none;
  ${focusRing}

  span {
    ${type.meta}
    ${type.figures}
  }

  strong {
    ${type.label}
    overflow-wrap: anywhere;
    text-decoration: underline;
    text-decoration-color: ${({ theme }) => tint(theme.colors.primary, 0)};
    text-underline-offset: 0.2em;
    transition: text-decoration-color 0.2s;
  }

  @media (hover: hover) {
    &:hover strong {
      text-decoration-color: ${({ theme }) => theme.colors.primary};
    }
  }
`;

const CountText = styled(MetaText)`
  ${type.figures}
`;

/* ---------- Ordering ---------- */

const RANK = { client: { sent: 0, payment_reported: 1 }, studio: { payment_reported: 0, sent: 1, draft: 2 } } as const;

// What needs someone first; among those, the soonest due
function orderOpen(items: InvoiceSummary[], perspective: Perspective, today: string): InvoiceSummary[] {
  const rank = (item: InvoiceSummary) => {
    const table = RANK[perspective] as Record<string, number>;
    const base = table[item.status] ?? 3;
    return isOverdue(item.status, item.dueOn, today) ? -1 : base;
  };
  return [...items].sort((a, b) => rank(a) - rank(b) || (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999') || b.number.localeCompare(a.number));
}

function orderClosed(items: InvoiceSummary[]): InvoiceSummary[] {
  return [...items].sort((a, b) => b.number.localeCompare(a.number));
}

function WhenCell({ item, today }: { item: InvoiceSummary; today: string }) {
  if (item.status === 'paid' && item.paidOn) {
    return (
      <>
        Paid <DateText value={item.paidOn} />
      </>
    );
  }
  if (item.status === 'void') return <>Cancelled</>;
  if (item.status === 'payment_reported') return <>Payment being checked</>;
  if (!item.dueOn) return <>No due date yet</>;
  if (item.status === 'draft') {
    return (
      <>
        Due <DateText value={item.dueOn} />
      </>
    );
  }
  return <DueText value={item.dueOn} today={today} />;
}

function InvoiceTable({
  title,
  items,
  projectId,
  perspective,
  today,
}: {
  title: string;
  items: InvoiceSummary[];
  projectId: string;
  perspective: Perspective;
  today: string;
}) {
  const headingId = useId();
  return (
    <ListPanel aria-labelledby={headingId}>
      <PanelHeader>
        <H3 id={headingId}>{title}</H3>
        <CountText>{plural(items.length, 'invoice')}</CountText>
      </PanelHeader>
      <Table role="table" aria-labelledby={headingId}>
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">
              Invoice
            </th>
            <th role="columnheader" scope="col" className="when">
              Due
            </th>
            <th role="columnheader" scope="col" className="amount">
              Amount
            </th>
            <th role="columnheader" scope="col" className="status">
              Status
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {items.map((item) => {
            const badge = invoiceStatus(item.status, perspective, isOverdue(item.status, item.dueOn, today));
            return (
              <tr role="row" key={item.id} id={`invoice-${item.id}`}>
                <td role="cell" className="invoice">
                  <InvoiceLink href={`${projectHref(projectId, 'invoices')}/${item.id}`}>
                    <span>{item.number}</span>
                    <strong>{item.title}</strong>
                  </InvoiceLink>
                </td>
                <td role="cell" className="when">
                  <WhenCell item={item} today={today} />
                </td>
                <td role="cell" className="amount">
                  {formatMoney(item.totalCents)}
                </td>
                <td role="cell" className="status">
                  <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </ListPanel>
  );
}

function Summary({ invoices, perspective, today }: { invoices: InvoiceSummary[]; perspective: Perspective; today: string }) {
  const sum = (items: InvoiceSummary[]) => items.reduce((total, item) => total + item.totalCents, 0);
  const sent = invoices.filter((item) => item.status === 'sent');
  const reported = invoices.filter((item) => item.status === 'payment_reported');
  const paid = invoices.filter((item) => item.status === 'paid');
  const overdue = sent.filter((item) => isOverdue(item.status, item.dueOn, today));
  const nextDue = sent
    .map((item) => item.dueOn)
    .filter((value): value is string => Boolean(value))
    .sort()[0];

  if (perspective === 'client') {
    return (
      <Panel aria-label="Invoices at a glance">
        <Stats>
          <div>
            <dt>To pay</dt>
            <dd>{formatMoney(sum(sent))}</dd>
            <dd>{sent.length ? plural(sent.length, 'invoice') : 'Nothing to pay right now'}</dd>
          </div>
          <div>
            <dt>Next due</dt>
            <dd>{nextDue ? <DateText value={nextDue} /> : 'None'}</dd>
            <dd>{nextDue ? <DueText value={nextDue} today={today} /> : 'No due dates coming up'}</dd>
          </div>
          {reported.length > 0 && (
            <div>
              <dt>Being confirmed</dt>
              <dd>{formatMoney(sum(reported))}</dd>
              <dd>Payments you told us about</dd>
            </div>
          )}
          <div>
            <dt>Paid</dt>
            <dd>{formatMoney(sum(paid))}</dd>
            <dd>{plural(paid.length, 'invoice')}</dd>
          </div>
        </Stats>
      </Panel>
    );
  }

  return (
    <Panel aria-label="Invoices at a glance">
      <Stats>
        <div>
          <dt>Outstanding</dt>
          <dd>{formatMoney(sum(sent) + sum(reported))}</dd>
          <dd>{plural(sent.length + reported.length, 'open invoice')}</dd>
        </div>
        <div>
          <dt>Overdue</dt>
          <dd>{formatMoney(sum(overdue))}</dd>
          <dd>{overdue.length ? plural(overdue.length, 'invoice') : 'Nothing overdue'}</dd>
        </div>
        <div>
          <dt>To confirm</dt>
          <dd>{reported.length}</dd>
          <dd>{reported.length ? 'Payments reported by the client' : 'No payments reported'}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{formatMoney(sum(paid))}</dd>
          <dd>{plural(paid.length, 'invoice')}</dd>
        </div>
      </Stats>
    </Panel>
  );
}

export interface InvoicesViewProps {
  projectId: string;
  perspective: Perspective;
  clientName: string;
  today: string;
  invoices: InvoiceSummary[];
  // Studio only: the methods clients see on invoices
  enabledMethods: PaymentMethod[];
}

export default function InvoicesView({ projectId, perspective, clientName, today, invoices, enabledMethods }: InvoicesViewProps) {
  const studio = perspective === 'studio';
  const client = firstName(clientName) ?? clientName;
  const [creating, setCreating] = useState(false);
  const newButton = useRef<HTMLButtonElement>(null);
  const editorPanel = useRef<HTMLElement>(null);
  const editorHeadingId = useId();
  const returnFocus = useRef(false);

  useEffect(() => {
    if (creating) editorPanel.current?.querySelector<HTMLInputElement>('input:not([type="hidden"])')?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      newButton.current?.focus();
    }
  }, [creating]);

  const open = orderOpen(
    invoices.filter((item) => isOpen(item.status)),
    perspective,
    today,
  );
  const closed = orderClosed(invoices.filter((item) => !isOpen(item.status)));
  const startNew = (
    <Button ref={newButton} onClick={() => setCreating(true)}>
      <FiPlus aria-hidden="true" />
      New invoice
    </Button>
  );

  return (
    <div>
      <SectionHeader>
        <div>
          <H2>Invoices</H2>
          <Meta>
            {studio
              ? `Draft, send and track invoices for ${clientName}. Drafts stay with the studio until you send them.`
              : 'Every invoice for this project, with how to pay. Open one to see the details or save a copy.'}
          </Meta>
        </div>
        {studio && !creating && invoices.length > 0 && startNew}
      </SectionHeader>

      <Stack $gap={8}>
        {studio && creating && (
          <Panel ref={editorPanel} aria-labelledby={editorHeadingId}>
            <Stack $gap={6}>
              <Stack $gap={1}>
                <H3 id={editorHeadingId}>New invoice for {clientName}</H3>
                <Meta>It gets the next invoice number when you save it.</Meta>
              </Stack>
              <InvoiceEditor
                mode="create"
                projectId={projectId}
                clientName={clientName}
                today={today}
                saved={null}
                labelledBy={editorHeadingId}
                onCancel={() => {
                  returnFocus.current = true;
                  setCreating(false);
                }}
              />
            </Stack>
          </Panel>
        )}

        {studio && enabledMethods.length === 0 && (
          <Notice>
            <p>
              No payment methods are turned on yet, so invoices tell {client} that you&apos;ll send payment details separately.{' '}
              <TextLink href="/portal/admin/settings">Set up payment methods</TextLink>
            </p>
          </Notice>
        )}

        {invoices.length > 0 && <Summary invoices={invoices} perspective={perspective} today={today} />}

        {invoices.length === 0 ? (
          studio ? (
            !creating && (
              <EmptyState title="No invoices yet" action={startNew}>
                Create an invoice for {client}: add the lines, check the draft, then send it. {client} gets an email with a link, sees how
                to pay{enabledMethods.length ? ` (${listMethods(enabledMethods)})` : ''}, and can tell you once they&apos;ve paid.
              </EmptyState>
            )
          ) : (
            <EmptyState title="No invoices yet">
              When we send you an invoice, it appears here with the amount, the due date and how to pay. We&apos;ll email you a link
              too.
            </EmptyState>
          )
        ) : (
          <>
            {open.length > 0 && <InvoiceTable title="Open" items={open} projectId={projectId} perspective={perspective} today={today} />}
            {closed.length > 0 && (
              <InvoiceTable
                title={studio ? 'Paid and void' : 'Paid and cancelled'}
                items={closed}
                projectId={projectId}
                perspective={perspective}
                today={today}
              />
            )}
          </>
        )}
      </Stack>
    </div>
  );
}

'use client';

import { useId } from 'react';
import styled from 'styled-components';
import { formatMoney } from '@/lib/portal-format';
import { DateText, Eyebrow, H2, panelStyles, PHONE, sansHeading, space, StatusBadge, tint, type } from '@/components/portal/ui';
import { invoiceStatus, isOverdue, METHOD_LABELS } from './labels';
import { formatQuantity } from './money';
import type { InvoiceDetail, InvoiceParties, Perspective } from './types';

/*
 * The invoice as a document: who it is from and to, the dates, the lines and the total. It
 * reads like a statement on screen and prints as one (see PrintStyles).
 */

const Paper = styled.article`
  ${panelStyles}
  display: flex;
  flex-direction: column;
  gap: ${space[8]};
  min-width: 0;
  padding: ${space[10]};
  scroll-margin-top: ${space[8]};

  @media (max-width: ${PHONE}) {
    gap: ${space[6]};
    padding: ${space[5]};
  }
`;

const Top = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space[3]} ${space[6]};

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[2]};
    min-width: 0;
  }

  h2 {
    ${type.figures}
    font-size: 1.75rem;
    letter-spacing: -0.015em;
  }
`;

const InvoiceTitle = styled.p`
  ${type.lead}
  overflow-wrap: anywhere;
`;

// Billed to, from and dates side by side on wide screens
const Parties = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) max-content;
  gap: ${space[6]};
  margin: 0;
  padding: ${space[6]} 0;
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 14)};
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 14)};

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[2]};
    min-width: 0;
  }

  dt {
    ${type.overline}
  }

  dd {
    ${type.meta}
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    overflow-wrap: anywhere;

    strong {
      ${type.label}
    }
  }

  @media (max-width: ${PHONE}) {
    grid-template-columns: minmax(0, 1fr);
    gap: ${space[5]};
    padding: ${space[5]} 0;
  }
`;

const Dates = styled.div`
  display: grid !important;
  grid-template-columns: auto minmax(0, 1fr);
  align-content: start;
  gap: ${space[2]} ${space[4]} !important;

  dt {
    ${type.meta}
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    color: ${({ theme }) => theme.colors.textSecondary};
  }

  dd {
    ${type.figures}
    color: ${({ theme }) => theme.colors.text};
  }
`;

/* Explicit table roles keep the semantics when phones restyle the rows as blocks */
const Lines = styled.table`
  width: 100%;
  border-collapse: collapse;
  ${type.figures}

  th {
    ${type.overline}
    padding: 0 0 ${space[3]};
    text-align: left;
    border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};
  }

  td {
    ${type.body}
    padding: ${space[4]} 0;
    vertical-align: top;
    color: ${({ theme }) => theme.colors.text};
    border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  th + th,
  td + td {
    padding-left: ${space[6]};
  }

  .number {
    text-align: right;
    white-space: nowrap;
  }

  .description {
    width: 100%;
    overflow-wrap: anywhere;
  }

  [data-phone] {
    display: none;
  }

  .empty {
    ${type.meta}
    text-align: left;
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
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: ${space[1]} ${space[2]};
      padding: ${space[4]} 0;
      border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
    }

    td {
      padding: 0 !important;
      border: 0;
    }

    td.description {
      flex-basis: 100%;
      font-weight: 500;
    }

    td.quantity,
    td.unit {
      ${type.meta}
      text-align: left;
    }

    td.amount {
      margin-left: auto;
      font-weight: 600;
    }

    [data-phone] {
      display: inline;
    }
  }
`;

const Totals = styled.dl`
  ${type.figures}
  align-self: flex-end;
  width: min(100%, 22rem);
  margin: 0;
  display: flex;
  flex-direction: column;

  > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: ${space[6]};
    padding: ${space[2]} 0;
  }

  dt {
    ${type.meta}
  }

  dd {
    ${type.body}
    margin: 0;
    color: ${({ theme }) => theme.colors.text};
    text-align: right;
  }

  .total {
    margin-top: ${space[2]};
    padding-top: ${space[4]};
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};

    dt {
      ${type.label}
    }

    dd {
      font-size: 1.375rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
  }
`;

const Notes = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  padding-left: ${space[4]};
  border-left: 2px solid ${({ theme }) => tint(theme.colors.primary, 40)};

  h3 {
    ${type.overline}
    ${sansHeading}
    letter-spacing: 0.05em;
  }

  p {
    ${type.body}
    max-width: 62ch;
    color: ${({ theme }) => theme.colors.text};
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
`;

const Missing = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// Long addresses wrap after the @ rather than mid-word
function EmailText({ value }: { value: string }) {
  const at = value.indexOf('@');
  if (at < 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, at + 1)}
      <wbr />
      {value.slice(at + 1)}
    </>
  );
}

interface StatementProps {
  invoice: InvoiceDetail;
  parties: InvoiceParties;
  perspective: Perspective;
  today: string;
}

export function Statement({ invoice, parties, perspective, today }: StatementProps) {
  const headingId = useId();
  const badge = invoiceStatus(invoice.status, perspective, isOverdue(invoice.status, invoice.dueOn, today));

  return (
    <Paper id={`invoice-${invoice.id}`} aria-labelledby={headingId} data-statement>
      <Top>
        <div>
          <Eyebrow>{parties.studioName}</Eyebrow>
          <H2 id={headingId}>Invoice {invoice.number}</H2>
          <InvoiceTitle>{invoice.title}</InvoiceTitle>
        </div>
        <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
      </Top>

      <Parties>
        <div>
          <dt>Billed to</dt>
          <dd>
            <strong>{parties.clientName}</strong>
            {parties.clientCompany && <span>{parties.clientCompany}</span>}
            <span>
              <EmailText value={parties.clientEmail} />
            </span>
          </dd>
        </div>
        <div>
          <dt>From</dt>
          <dd>
            <strong>{parties.studioName}</strong>
            <span>
              <EmailText value={parties.studioEmail} />
            </span>
          </dd>
        </div>
        <Dates>
          <dt>Issued</dt>
          <dd>{invoice.issuedOn ? <DateText value={invoice.issuedOn} /> : <Missing>Not set yet</Missing>}</dd>
          <dt>Due</dt>
          <dd>{invoice.dueOn ? <DateText value={invoice.dueOn} /> : <Missing>Not set yet</Missing>}</dd>
        </Dates>
      </Parties>

      <Lines role="table" aria-label={`Line items on ${invoice.number}`}>
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">
              Description
            </th>
            <th role="columnheader" scope="col" className="number">
              Qty
            </th>
            <th role="columnheader" scope="col" className="number">
              Unit price
            </th>
            <th role="columnheader" scope="col" className="number">
              Amount
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {invoice.lines.length === 0 ? (
            <tr role="row">
              <td role="cell" colSpan={4} className="empty">
                No line items yet. Edit the draft to add them.
              </td>
            </tr>
          ) : (
            invoice.lines.map((line) => (
              <tr role="row" key={line.id}>
                <td role="cell" className="description">
                  {line.description}
                </td>
                <td role="cell" className="number quantity">
                  {formatQuantity(line.quantity)}
                </td>
                <td role="cell" className="number unit">
                  <span data-phone aria-hidden="true">
                    ×{' '}
                  </span>
                  {formatMoney(line.unitAmountCents)}
                </td>
                <td role="cell" className="number amount">
                  {formatMoney(line.amountCents)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Lines>

      <Totals aria-label="Totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatMoney(invoice.subtotalCents)}</dd>
        </div>
        <div className="total">
          <dt>Total (USD)</dt>
          <dd>{formatMoney(invoice.totalCents)}</dd>
        </div>
        {invoice.paid && (
          <div>
            <dt>
              Paid <DateText value={invoice.paid.on} />, {METHOD_LABELS[invoice.paid.method]}
            </dt>
            <dd>−{formatMoney(invoice.totalCents)}</dd>
          </div>
        )}
        {invoice.paid && (
          <div>
            <dt>Amount due</dt>
            <dd>{formatMoney(0)}</dd>
          </div>
        )}
      </Totals>

      {invoice.notes && (
        <Notes>
          <h3>Notes</h3>
          <p>{invoice.notes}</p>
        </Notes>
      )}
    </Paper>
  );
}

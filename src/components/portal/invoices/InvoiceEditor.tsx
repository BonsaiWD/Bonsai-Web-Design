'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiPlus, FiX } from 'react-icons/fi';
import { createInvoice, updateInvoice } from '@/app/portal/_actions/invoices';
import { firstName, formatMoney } from '@/lib/portal-format';
import {
  ActionForm,
  Button,
  Field,
  FieldRow,
  FormActions,
  FormMessage,
  FormStack,
  IconButton,
  Input,
  Meta,
  PHONE,
  space,
  SubmitButton,
  Textarea,
  tint,
  type,
  useField,
  useUnsavedChanges,
  VisuallyHidden,
  type ActionState,
} from '@/components/portal/ui';
import { centsToInput, lineAmountCents, MAX_LINES, parseDollars, parseQuantity } from './money';
import { sansHeading } from './parts';
import type { InvoiceDetail } from './types';

/* ---------- Layout ---------- */

const Lines = styled.fieldset`
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${space[3]};

  > legend {
    ${type.label}
    ${sansHeading}
    padding: 0;
    margin-bottom: ${space[3]};
  }
`;

const columns = `minmax(0, 1fr) 5.5rem 8.5rem 7.5rem 2.75rem`;

const ColumnHeads = styled.div`
  display: grid;
  grid-template-columns: ${columns};
  gap: ${space[4]};
  padding-bottom: ${space[2]};
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 20)};

  span {
    ${type.overline}
  }

  .number {
    text-align: right;
  }

  @media (max-width: ${PHONE}) {
    display: none;
  }
`;

const LineList = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${space[2]};

  @media (max-width: ${PHONE}) {
    gap: ${space[3]};
  }
`;

const LineRow = styled.li`
  display: grid;
  grid-template-columns: ${columns};
  gap: ${space[2]} ${space[4]};
  align-items: start;

  @media (max-width: ${PHONE}) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: ${space[3]} ${space[4]};
    padding: ${space[4]};
    border: 1px solid ${({ theme }) => tint(theme.colors.primary, 18)};
    background: ${({ theme }) => tint(theme.colors.background, 55)};

    > .description {
      grid-column: 1 / -1;
    }
  }
`;

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  min-width: 0;

  /* Column heads label the cells on wide screens; phones show each label */
  label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  input.number {
    text-align: right;
  }

  p {
    ${type.meta}
    color: ${({ theme }) => theme.colors.error};
  }

  @media (max-width: ${PHONE}) {
    label {
      position: static;
      width: auto;
      height: auto;
      overflow: visible;
      clip: auto;
      white-space: normal;
      ${type.label}
    }

    input.number {
      text-align: left;
    }
  }
`;

const LineAmount = styled.div`
  ${type.body}
  ${type.figures}
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 2.75rem;
  color: ${({ theme }) => theme.colors.text};
  white-space: nowrap;

  &[data-empty='true'] {
    color: ${({ theme }) => theme.colors.textSecondary};
  }

  @media (max-width: ${PHONE}) {
    justify-content: flex-start;
    font-weight: 600;
  }
`;

const RemoveCell = styled.div`
  display: flex;
  justify-content: flex-end;

  @media (max-width: ${PHONE}) {
    align-items: center;
  }
`;

const LinesFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space[4]} ${space[6]};
  padding-top: ${space[4]};
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 20)};
`;

const LiveTotals = styled.dl`
  ${type.figures}
  margin: 0 0 0 auto;
  min-width: min(100%, 16rem);

  > div {
    display: flex;
    justify-content: space-between;
    gap: ${space[6]};
    padding: ${space[1]} 0;
  }

  dt {
    ${type.meta}
  }

  dd {
    margin: 0;
    color: ${({ theme }) => theme.colors.text};
  }

  .total dt {
    ${type.label}
  }

  .total dd {
    font-size: 1.25rem;
    font-weight: 600;
  }
`;

/* ---------- Rows ---------- */

interface Row {
  key: string;
  // Live copies of what is typed, for the amounts and totals
  quantity: string;
  unitPrice: string;
  saved: { description: string; quantity: string; unitPrice: string };
}

function rowAmount(row: Pick<Row, 'quantity' | 'unitPrice'>): number | null {
  const quantity = parseQuantity(row.quantity);
  const price = parseDollars(row.unitPrice);
  return quantity.ok && price.ok ? lineAmountCents(quantity.value, price.value) : null;
}

interface LineInputProps {
  name: string;
  label: string;
  line: number;
  saved: string;
  className?: string;
  inputClass?: string;
  inputMode?: 'decimal' | 'text';
  placeholder?: string;
  inputRef?: (element: HTMLInputElement | null) => void;
  onValue?: (value: string) => void;
}

function LineInput({ name, label, line, saved, className, inputClass, inputMode, placeholder, inputRef, onValue }: LineInputProps) {
  const id = useId();
  const { error, defaultValue } = useField(name, saved);
  return (
    <Cell className={className}>
      <label htmlFor={id}>
        {label}
        <VisuallyHidden>, line {line}</VisuallyHidden>
      </label>
      <Input
        ref={inputRef}
        id={id}
        name={name}
        defaultValue={defaultValue}
        className={inputClass}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onValue?.(event.currentTarget.value)}
      />
      {error && <p id={`${id}-error`}>{error}</p>}
    </Cell>
  );
}

/* ---------- Editor ---------- */

// Keys for rows added in the browser; saved rows use their item id
let rowCounter = 0;
const nextKey = () => `new-${++rowCounter}`;

function blankRow(): Row {
  return { key: nextKey(), quantity: '1', unitPrice: '', saved: { description: '', quantity: '1', unitPrice: '' } };
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

interface InvoiceEditorProps {
  mode: 'create' | 'edit';
  projectId: string;
  clientName: string;
  today: string;
  saved: InvoiceDetail | null;
  onCancel: () => void;
  onSaved?: (state: NonNullable<ActionState>) => void;
  labelledBy?: string;
}

export function InvoiceEditor({ mode, projectId, clientName, today, saved, onCancel, onSaved, labelledBy }: InvoiceEditorProps) {
  // One id per form instance: a double submit lands on the invoice the first one made
  const [formId] = useState(() => crypto.randomUUID());
  const [rows, setRows] = useState<Row[]>(() => {
    if (saved?.lines.length) {
      return saved.lines.map((line) => {
        const values = { description: line.description, quantity: String(line.quantity), unitPrice: centsToInput(line.unitAmountCents) };
        return { key: line.id, quantity: values.quantity, unitPrice: values.unitPrice, saved: values };
      });
    }
    return [blankRow()];
  });
  const [dirty, setDirty] = useState(false);
  const descriptionInputs = useRef(new Map<string, HTMLInputElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<string | 'add' | null>(null);

  // Leaving with unsaved lines asks first: a reload, the tabs, the shell's or the list's links
  useUnsavedChanges(dirty);

  // After adding or removing a line, focus lands somewhere sensible rather than on the page
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    if (target === 'add') addButton.current?.focus();
    else descriptionInputs.current.get(target)?.focus();
  }, [rows]);

  const update = (key: string, patch: Partial<Pick<Row, 'quantity' | 'unitPrice'>>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const addRow = () => {
    if (rows.length >= MAX_LINES) return;
    const row = blankRow();
    focusNext.current = row.key;
    setRows((current) => [...current, row]);
    setDirty(true);
  };

  const removeRow = (index: number) => {
    const remaining = rows.filter((_, i) => i !== index);
    focusNext.current = remaining[index]?.key ?? remaining[index - 1]?.key ?? 'add';
    setRows(remaining);
    setDirty(true);
  };

  const amounts = rows.map(rowAmount);
  const total = amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  const atLimit = rows.length >= MAX_LINES;
  const client = firstName(clientName) ?? clientName;

  return (
    <ActionForm
      action={mode === 'create' ? createInvoice : updateInvoice}
      aria-labelledby={labelledBy}
      onChange={() => setDirty(true)}
      onSuccess={(state) => {
        setDirty(false);
        onSaved?.(state);
      }}
    >
      <FormStack>
        <Field label="Title" name="title" saved={saved?.title ?? ''} hint="What the invoice is for, such as Design deposit or Development, part one.">
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
        <FieldRow>
          <Field label="Issue date" name="issuedOn" saved={saved ? saved.issuedOn : today}>
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
          <Field label="Due date" name="dueOn" saved={saved ? saved.dueOn : addDays(today, 14)} hint="Both dates are needed before you send it.">
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
        </FieldRow>

        <Lines>
          <legend>Line items</legend>
          {rows.length > 0 && (
            <ColumnHeads aria-hidden="true">
              <span>Description</span>
              <span className="number">Qty</span>
              <span className="number">Unit price</span>
              <span className="number">Amount</span>
              <span />
            </ColumnHeads>
          )}
          {rows.length === 0 ? (
            <Meta>No lines yet. Add one for each piece of work or fee.</Meta>
          ) : (
            <LineList>
              {rows.map((row, index) => (
                <LineRow key={row.key}>
                  <LineInput
                    className="description"
                    name={`item.${row.key}.description`}
                    label="Description"
                    line={index + 1}
                    saved={row.saved.description}
                    placeholder={index === 0 ? 'Homepage design' : undefined}
                    inputRef={(element) => {
                      if (element) descriptionInputs.current.set(row.key, element);
                      else descriptionInputs.current.delete(row.key);
                    }}
                  />
                  <LineInput
                    name={`item.${row.key}.quantity`}
                    label="Qty"
                    line={index + 1}
                    saved={row.saved.quantity}
                    inputClass="number"
                    inputMode="decimal"
                    onValue={(value) => update(row.key, { quantity: value })}
                  />
                  <LineInput
                    name={`item.${row.key}.unitPrice`}
                    label="Unit price ($)"
                    line={index + 1}
                    saved={row.saved.unitPrice}
                    inputClass="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    onValue={(value) => update(row.key, { unitPrice: value })}
                  />
                  <LineAmount data-empty={amounts[index] === null}>
                    <VisuallyHidden>Amount, line {index + 1}: </VisuallyHidden>
                    {amounts[index] === null ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <VisuallyHidden>not worked out yet</VisuallyHidden>
                      </>
                    ) : (
                      formatMoney(amounts[index] as number)
                    )}
                  </LineAmount>
                  <RemoveCell>
                    <IconButton aria-label={`Remove line ${index + 1}`} onClick={() => removeRow(index)}>
                      <FiX aria-hidden="true" />
                    </IconButton>
                  </RemoveCell>
                </LineRow>
              ))}
            </LineList>
          )}
          <LinesFooter>
            <div>
              <Button
                ref={addButton}
                $variant="secondary"
                $size="sm"
                aria-disabled={atLimit || undefined}
                onClick={addRow}
              >
                <FiPlus aria-hidden="true" />
                Add a line
              </Button>
              {atLimit && <Meta>An invoice can have up to {MAX_LINES} lines.</Meta>}
            </div>
            <LiveTotals aria-label="Totals so far">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatMoney(total)}</dd>
              </div>
              <div className="total">
                <dt>Total</dt>
                <dd>{formatMoney(total)}</dd>
              </div>
            </LiveTotals>
          </LinesFooter>
          <Meta>Use a negative price for a discount. Amounts are in US dollars.</Meta>
        </Lines>

        <Field
          label={`Notes for ${client}`}
          name="notes"
          optional
          saved={saved?.notes ?? ''}
          hint="Payment terms, a thank-you, or anything else to know. Shown on the invoice."
        >
          {(control) => (
            <Textarea
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-invalid={control.invalid || undefined}
              aria-describedby={control.describedBy}
              rows={3}
            />
          )}
        </Field>

        <FormActions>
          <SubmitButton pendingLabel="Saving…">{mode === 'create' ? 'Save draft' : 'Save changes'}</SubmitButton>
          <Button $variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
          <FormMessage />
        </FormActions>
        {mode === 'create' && <Meta>Nothing is sent yet. You can check the draft, then send it to {client}.</Meta>}
      </FormStack>

      <input type="hidden" name="projectId" value={projectId} />
      {mode === 'create' ? (
        <input type="hidden" name="id" value={formId} />
      ) : (
        <>
          <input type="hidden" name="invoiceId" value={saved?.id ?? ''} />
          <input type="hidden" name="version" value={saved?.studio?.version ?? ''} />
        </>
      )}
    </ActionForm>
  );
}

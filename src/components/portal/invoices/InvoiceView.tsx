'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiArrowLeft, FiPrinter } from 'react-icons/fi';
import { projectHref } from '@/components/portal/tabs';
import { Button, H3, LAPTOP, Meta, Panel, PHONE, space, Split, Stack, TextLink } from '@/components/portal/ui';
import { ClientPayment } from './ClientPayment';
import { InvoiceEditor } from './InvoiceEditor';
import { listMethods } from './labels';
import { StatusLine, useAnnouncer } from './parts';
import { PrintStyles } from './PrintStyles';
import { Statement } from './Statement';
import { StudioInvoicePanel } from './StudioInvoicePanel';
import type { InvoiceDetail, InvoiceParties, PaymentMethodView, Perspective } from './types';

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${space[3]} ${space[6]};
  margin-bottom: ${space[6]};

  a {
    display: inline-flex;
    align-items: center;
    gap: ${space[2]};
    min-height: 2.75rem;
  }
`;

const ViewStatus = styled(StatusLine)`
  margin-bottom: ${space[6]};
`;

const Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  min-width: 0;

  /* Below the statement on tablets: panels side by side, a lone panel at full width */
  @media (min-width: ${PHONE}) and (max-width: calc(${LAPTOP} - 0.02px)) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
    align-items: start;
  }

  @media (max-width: ${PHONE}) {
    gap: ${space[4]};
  }
`;

interface InvoiceViewProps {
  projectId: string;
  perspective: Perspective;
  canPay: boolean;
  today: string;
  invoice: InvoiceDetail;
  parties: InvoiceParties;
  methods: PaymentMethodView[];
}

export default function InvoiceView({ projectId, perspective, canPay, today, invoice, parties, methods }: InvoiceViewProps) {
  const studio = perspective === 'studio';
  const { statusRef, message, announce } = useAnnouncer();
  const [editing, setEditing] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const editorHeadingId = useId();
  const payHeadingId = useId();
  const editorPanel = useRef<HTMLElement>(null);

  // A draft that has just been sent cannot be edited any more
  const canEdit = studio && invoice.status === 'draft';
  if (editing && !canEdit) setEditing(false);

  useEffect(() => {
    if (editing) editorPanel.current?.querySelector<HTMLInputElement>('input:not([type="hidden"])')?.focus();
  }, [editing]);

  const closeEditor = (saved?: string) => {
    setEditing(false);
    if (saved) announce(saved, false);
    // The button is back once the statement returns
    requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  return (
    <div data-print-root>
      <PrintStyles />
      <Toolbar data-print-hide>
        <TextLink href={projectHref(projectId, 'invoices')}>
          <FiArrowLeft aria-hidden="true" />
          All invoices
        </TextLink>
        <Button $variant="quiet" $size="sm" onClick={() => window.print()}>
          <FiPrinter aria-hidden="true" />
          Print or save as PDF
        </Button>
      </Toolbar>

      <ViewStatus ref={statusRef} message={message} />

      <Split data-print-layout>
        {editing ? (
          <Panel ref={editorPanel} aria-labelledby={editorHeadingId} data-print-hide>
            <Stack $gap={6}>
              <Stack $gap={1}>
                <H3 id={editorHeadingId}>Edit draft {invoice.number}</H3>
                <Meta>Changes are only seen by the studio until you send it.</Meta>
              </Stack>
              <InvoiceEditor
                mode="edit"
                projectId={projectId}
                clientName={parties.clientName}
                today={today}
                saved={invoice}
                labelledBy={editorHeadingId}
                onCancel={() => closeEditor()}
                onSaved={(state) => closeEditor(state.message)}
              />
            </Stack>
          </Panel>
        ) : (
          <Statement invoice={invoice} parties={parties} perspective={perspective} today={today} />
        )}

        <Aside aria-label={studio ? 'Invoice status and studio actions' : 'Paying this invoice'}>
          {studio ? (
            <>
              <StudioInvoicePanel
                projectId={projectId}
                invoice={invoice}
                today={today}
                clientName={parties.clientName}
                clientEmail={parties.clientEmail}
                methodsShown={methods.length}
                onEdit={() => setEditing(true)}
                editButtonRef={editButtonRef}
                announce={announce}
                statusRef={statusRef}
              />
              {invoice.status !== 'paid' && invoice.status !== 'void' && (
                <Panel aria-labelledby={payHeadingId} data-print-hide>
                  <Stack $gap={2}>
                    <H3 id={payHeadingId}>How to pay</H3>
                    <Meta>
                      {methods.length
                        ? `${parties.clientName} sees ${methods.length === 1 ? 'one way' : `${methods.length} ways`} to pay: ${listMethods(methods.map((method) => method.method))}, each with a Copy button.`
                        : `No methods are turned on, so ${parties.clientName} is told you'll send payment details separately.`}{' '}
                      <TextLink href="/portal/admin/settings">Edit payment settings</TextLink>
                    </Meta>
                  </Stack>
                </Panel>
              )}
            </>
          ) : (
            <ClientPayment
              projectId={projectId}
              invoice={invoice}
              today={today}
              methods={methods}
              canPay={canPay}
              clientName={parties.clientName}
              announce={announce}
              statusRef={statusRef}
            />
          )}
        </Aside>
      </Split>
    </div>
  );
}

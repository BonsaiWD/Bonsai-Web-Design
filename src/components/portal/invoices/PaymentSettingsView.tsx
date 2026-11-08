'use client';

import { useId, useState } from 'react';
import styled from 'styled-components';
import type { PaymentMethod } from '@/db/schema';
import { savePaymentSettings } from '@/app/portal/_actions/settings';
import { plural } from '@/lib/portal-format';
import {
  ActionForm,
  Checkbox,
  Eyebrow,
  Field,
  FormMessage,
  H1,
  H2,
  H3,
  Lead,
  ListPanel,
  Meta,
  MetaText,
  Panel,
  PanelHeader,
  PHONE,
  Rows,
  sansHeading,
  space,
  Split,
  Stack,
  SubmitButton,
  Textarea,
  tint,
  type,
  useUnsavedChanges,
  VisuallyHidden,
} from '@/components/portal/ui';
import { HowToPay } from './HowToPay';
import { METHOD_DETAILS, METHOD_LABELS } from './labels';
import type { PaymentMethodView } from './types';

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  margin-bottom: ${space[8]};
`;

const MethodRow = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${space[4]};
  padding: ${space[6]};

  @media (max-width: ${PHONE}) {
    padding: ${space[5]};
  }
`;

const MethodHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space[3]} ${space[6]};

  > div:first-child {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    min-width: 0;
  }

  h3 {
    ${sansHeading}
    letter-spacing: -0.01em;
  }
`;

const Shown = styled.span<{ $on: boolean }>`
  ${type.meta}
  color: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.textSecondary)};
`;

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[3]} ${space[5]};
  padding: ${space[5]} ${space[6]};
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};

  @media (max-width: ${PHONE}) {
    padding: ${space[4]} ${space[5]};

    > button {
      width: 100%;
    }
  }
`;

// Two or four lines fit these details; the default box is sized for longer notes
const DetailsInput = styled(Textarea)`
  min-height: 0;
`;

const Unsaved = styled.span`
  ${type.meta}
  color: ${({ theme }) => theme.colors.primary};
`;

const Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  min-width: 0;
`;

const Tips = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${space[3]};

  li {
    ${type.meta}
    padding-left: ${space[4]};
    border-left: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};
  }

  strong {
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  }
`;

// Shows the format with labels, never a made-up address or handle
const PLACEHOLDERS: Record<PaymentMethod, string> = {
  bitcoin: 'Paste your Bitcoin wallet address',
  monero: 'Paste your Monero wallet address',
  litecoin: 'Paste your Litecoin wallet address',
  zelle: 'Email or phone: …\nName on the account: …',
  ach: 'Account name: …\nBank: …\nRouting number: …\nAccount number: …',
  venmo: 'Venmo handle: @…',
};

type Draft = Record<PaymentMethod, { enabled: boolean; instructions: string }>;

const draftOf = (methods: PaymentMethodView[]) =>
  Object.fromEntries(methods.map((method) => [method.method, { enabled: method.enabled, instructions: method.instructions }])) as Draft;

export default function PaymentSettingsView({ methods, version }: { methods: PaymentMethodView[]; version: string }) {
  const listHeadingId = useId();
  const previewHeadingId = useId();
  // A live copy of the form, for the preview and the unsaved marker
  const [draft, setDraft] = useState(() => draftOf(methods));
  const [seen, setSeen] = useState(methods);
  if (seen !== methods) {
    setSeen(methods);
    setDraft(draftOf(methods));
  }
  const dirty = methods.some((method) => draft[method.method].enabled !== method.enabled || draft[method.method].instructions.trim() !== method.instructions);

  // Leaving with unsaved details asks first: a reload, the shell's links or the tabs
  useUnsavedChanges(dirty);

  const set = (method: PaymentMethod, patch: Partial<Draft[PaymentMethod]>) =>
    setDraft((current) => ({ ...current, [method]: { ...current[method], ...patch } }));

  const preview: PaymentMethodView[] = methods
    .map((method) => ({ method: method.method, ...draft[method.method], instructions: draft[method.method].instructions.trim() }))
    .filter((method) => method.enabled && method.instructions);
  const savedShown = methods.filter((method) => method.enabled).length;

  return (
    <div>
      <Header>
        <Eyebrow>Studio settings</Eyebrow>
        <H1>Payment settings</H1>
        <Lead>
          Choose how clients can pay. The methods you turn on appear under How to pay on every invoice you send, with a Copy button for each
          address, number or labelled detail.
        </Lead>
      </Header>

      <Split>
        {/* The view compares the draft with the saved settings itself */}
        <ActionForm action={savePaymentSettings} aria-labelledby={listHeadingId} guardUnsaved={false}>
          <ListPanel aria-labelledby={listHeadingId}>
            <PanelHeader>
              <H2 id={listHeadingId}>How clients can pay</H2>
              <MetaText>{savedShown ? `${plural(savedShown, 'method')} shown on invoices` : 'None shown on invoices yet'}</MetaText>
            </PanelHeader>
            <Rows>
              {methods.map((method) => {
                const label = METHOD_LABELS[method.method];
                const on = draft[method.method].enabled;
                return (
                  <MethodRow key={method.method}>
                    <MethodHead>
                      <div>
                        <H3>{label}</H3>
                        <Meta>{METHOD_DETAILS[method.method].asks}</Meta>
                      </div>
                      <Checkbox
                        name={`enabled.${method.method}`}
                        savedChecked={method.enabled}
                        onChange={(event) => set(method.method, { enabled: event.currentTarget.checked })}
                      >
                        Show on invoices
                        <VisuallyHidden> ({label})</VisuallyHidden>
                      </Checkbox>
                    </MethodHead>
                    <Field
                      label={
                        <>
                          Details clients see
                          <VisuallyHidden> for {label}</VisuallyHidden>
                        </>
                      }
                      name={`instructions.${method.method}`}
                      saved={method.instructions}
                      hint={
                        <Shown $on={on}>
                          {on ? (method.enabled ? 'Shown on invoices.' : 'Shown on invoices once you save.') : 'Not shown to clients.'} One detail per
                          line.
                        </Shown>
                      }
                    >
                      {(control) => (
                        <DetailsInput
                          id={control.id}
                          name={control.name}
                          defaultValue={control.defaultValue}
                          aria-invalid={control.invalid || undefined}
                          aria-describedby={control.describedBy}
                          placeholder={PLACEHOLDERS[method.method]}
                          rows={method.method === 'ach' ? 4 : 2}
                          maxLength={1000}
                          spellCheck={false}
                          autoComplete="off"
                          onChange={(event) => set(method.method, { instructions: event.currentTarget.value })}
                        />
                      )}
                    </Field>
                  </MethodRow>
                );
              })}
            </Rows>
            <Footer>
              <SubmitButton pendingLabel="Saving…">Save payment settings</SubmitButton>
              {dirty && <Unsaved>Unsaved changes</Unsaved>}
              <FormMessage />
            </Footer>
          </ListPanel>
          <input type="hidden" name="version" value={version} />
        </ActionForm>

        <Aside aria-label="Preview and tips">
          <Panel aria-labelledby={previewHeadingId}>
            <Stack $gap={4}>
              <Stack $gap={1}>
                <Eyebrow id={previewHeadingId}>Preview</Eyebrow>
                <Meta>What clients see on a sent invoice, as you type.</Meta>
              </Stack>
              <HowToPay methods={preview} invoiceNumber="the invoice number" />
            </Stack>
          </Panel>
          <Panel aria-label="Writing payment details">
            <Stack $gap={4}>
              <H3 as="h2">Writing payment details</H3>
              <Tips>
                <li>
                  <strong>One detail per line.</strong> Each line gets its own Copy button, so clients can paste an account name, a
                  number or an address as it is. A line written as a sentence is shown as written.
                </li>
                <li>
                  <strong>Label a line</strong> with a colon, such as &ldquo;Routing number: …&rdquo;, and clients copy just the number.
                </li>
                <li>
                  <strong>Wallet addresses</strong> also get a QR code. Check every character: a payment sent to a wrong address can&apos;t be
                  recovered.
                </li>
              </Tips>
            </Stack>
          </Panel>
        </Aside>
      </Split>
    </div>
  );
}

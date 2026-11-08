'use client';

import { Children, Fragment, forwardRef, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import styled, { css } from 'styled-components';
import { FiCheck, FiChevronRight } from 'react-icons/fi';
import MetaDot from '@/components/common/MetaDot';
import {
  ActionForm,
  Button,
  Dialog,
  DURATION,
  ease,
  focusRing,
  FormActions,
  FormMessage,
  FormStack,
  PHONE,
  panelStyles,
  space,
  SubmitButton,
  tint,
  type,
  useDialog,
  useFormStatusState,
  useUnsavedChanges,
  type ActionState,
  type FormAction,
} from '@/components/portal/ui';

// Small headings use the UI type styles; the site's global rule would set them in Playfair
export const sansHeading = css`
  font-family: ${({ theme }) => theme.fonts.main};
  letter-spacing: 0;
`;

/* ---------- Card ---------- */

export const Card = styled.article<{ $attention?: boolean }>`
  ${panelStyles}
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
  min-width: 0;
  scroll-margin-top: ${space[8]};
  border-color: ${({ $attention, theme }) => tint(theme.colors.primary, $attention ? 40 : 14)};
  transition: border-color ${DURATION.state}s ${ease};

  /* Arriving from an email or a dashboard link */
  &:target {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

export const CardHead = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space[2]} ${space[5]};

  > div {
    display: flex;
    flex-direction: column;
    gap: ${space[2]};
    flex: 1 1 18rem;
    min-width: 0;
  }

  h4 {
    overflow-wrap: anywhere;
  }
`;

// Meta items separated by the bronze dot, as everywhere on the site
const MetaRow = styled.div<{ $stackOnPhone?: boolean }>`
  ${type.meta}
  ${type.figures}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[1]} ${space[3]};
  min-width: 0;

  /* Long items wrap one per line on phones, where a dot would be left dangling */
  ${({ $stackOnPhone }) =>
    $stackOnPhone &&
    css`
      @media (max-width: ${PHONE}) {
        flex-direction: column;
        align-items: flex-start;
        gap: 0;

        > [data-dot] {
          display: none;
        }
      }
    `}
`;

export function MetaLine({ children, stackOnPhone }: { children: ReactNode; stackOnPhone?: boolean }) {
  const items = Children.toArray(children).filter(Boolean);
  // Nothing to say: no empty row taking a gap in the layout
  if (items.length === 0) return null;
  return (
    <MetaRow $stackOnPhone={stackOnPhone}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <MetaDot aria-hidden="true" data-dot />}
          <span>{item}</span>
        </Fragment>
      ))}
    </MetaRow>
  );
}

// A note from one side to the other: a bronze rule and the words, line breaks kept
export const NoteBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  padding-left: ${space[4]};
  border-left: 2px solid ${({ theme }) => tint(theme.colors.primary, 40)};

  h5 {
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

export const CardActions = styled.div`
  &[hidden] {
    display: none !important;
  }

  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${space[3]} ${space[4]};
  padding-top: ${space[5]};
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};

  /* A toggle that is open stays visibly on */
  button[aria-expanded='true'] {
    background: ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  > div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space[3]};
    min-width: 0;
  }

  @media (max-width: ${PHONE}) {
    > div,
    > div > * {
      width: 100%;
    }

    button,
    a {
      width: 100%;
    }
  }
`;

// A box inside a card for a form that opens in place
export const InsetPanel = styled.div`
  padding: ${space[5]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 18)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};

  @media (max-width: ${PHONE}) {
    padding: ${space[4]};
  }
`;

/* ---------- Status line ---------- */

const StatusText = styled.p`
  ${type.meta}
  display: flex;
  align-items: flex-start;
  gap: ${space[2]};
  color: ${({ theme }) => theme.colors.text};

  &:focus {
    outline: none;
  }

  /* Out of the layout while empty, so it adds no gap, but still in the page to announce */
  &[data-empty='true'] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  svg {
    flex-shrink: 0;
    margin-top: 0.2em;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// Always rendered, so a screen reader hears each new message. Dialogs that close on success
// move focus here, since the button that opened them may be gone.
export const StatusLine = forwardRef<HTMLParagraphElement, { message: string; className?: string }>(function StatusLine(
  { message, className },
  ref,
) {
  return (
    <StatusText ref={ref} className={className} role="status" aria-live="polite" tabIndex={-1} data-empty={!message}>
      {message && <FiCheck aria-hidden="true" />}
      {message}
    </StatusText>
  );
});

// A status line and the function that fills it. Focus moves in an effect, after React has
// committed: by then a card that changed group has been moved, and focus stays on it.
export function useAnnouncer() {
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState({ message: '', focus: false, at: 0 });
  useEffect(() => {
    if (status.focus) statusRef.current?.focus();
  }, [status]);
  const announce = useCallback((message: string, focus = true) => setStatus({ message, focus, at: Date.now() }), []);
  return { statusRef, message: status.message, announce };
}

export type Announce = (message: string, focus?: boolean) => void;

/* ---------- Disclosure ---------- */

export const Disclosure = styled.details`
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};

  > summary {
    display: flex;
    align-items: center;
    gap: ${space[2]};
    min-height: 2.75rem;
    padding-top: ${space[3]};
    list-style: none;
    ${type.label}
    color: ${({ theme }) => theme.colors.text};
    ${focusRing}

    &::-webkit-details-marker {
      display: none;
    }

    svg {
      flex-shrink: 0;
      color: ${({ theme }) => theme.colors.primary};
      transition: transform ${DURATION.state}s ${ease};
    }

    span {
      ${type.meta}
      font-weight: 400;
    }
  }

  &[open] > summary svg {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    > summary svg {
      transition: none;
    }
  }
`;

export function DisclosureSummary({ children, count }: { children: ReactNode; count?: string }) {
  return (
    <summary>
      <FiChevronRight aria-hidden="true" />
      {children}
      {count && <span>{count}</span>}
    </summary>
  );
}

/* ---------- Unsaved edits ---------- */

/*
 * Put inside an ActionForm: once something is typed or chosen in the form, leaving the page
 * (a tab, a portal link, a reload) asks first, until the form succeeds or unmounts (a dialog
 * closing). After a failed submit the form still holds unsaved text, so it stays guarded.
 * `active` lets a form that is only collapsed, not discarded, stop guarding while hidden.
 */
export function UnsavedFormGuard({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [touched, setTouched] = useState(false);
  const { state } = useFormStatusState();
  const [seenAt, setSeenAt] = useState(state?.at);
  if (state?.at !== seenAt) {
    setSeenAt(state?.at);
    if (state?.ok) setTouched(false);
  }
  useUnsavedChanges(touched && active);

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const onEdit = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (target && target.type !== 'hidden') setTouched(true);
    };
    form.addEventListener('input', onEdit);
    form.addEventListener('change', onEdit);
    return () => {
      form.removeEventListener('input', onEdit);
      form.removeEventListener('change', onEdit);
    };
  }, []);

  return <span ref={ref} hidden />;
}

/* ---------- Forms in dialogs ---------- */

// Tells the dialog while its form is submitting, so Escape cannot close it mid-way
function ReportPending({ onChange }: { onChange: (pending: boolean) => void }) {
  const { pending } = useFormStatusState();
  useEffect(() => {
    onChange(pending);
  }, [pending, onChange]);
  return null;
}

interface FormDialogProps {
  dialog: ReturnType<typeof useDialog>;
  title: ReactNode;
  description?: ReactNode;
  action: FormAction;
  submitLabel: ReactNode;
  pendingLabel: string;
  submitVariant?: 'primary' | 'secondary' | 'danger';
  onSuccess: (state: NonNullable<ActionState>) => void;
  children: ReactNode;
  // Hidden inputs go after the fields, so the dialog's first focus lands on a real control
  hidden: ReactNode;
  // Where focus goes after success, when the button that opened the dialog may be gone
  returnFocusTo?: RefObject<HTMLElement | null>;
}

export function FormDialog({
  dialog,
  title,
  description,
  action,
  submitLabel,
  pendingLabel,
  submitVariant,
  onSuccess,
  children,
  hidden,
  returnFocusTo,
}: FormDialogProps) {
  const [busy, setBusy] = useState(false);
  // Focus returns to the opening button on cancel, and to returnFocusTo after success
  const focusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (dialog.open) focusRef.current = dialog.triggerRef.current;
  }, [dialog.open, dialog.triggerRef]);

  return (
    <Dialog open={dialog.open} onClose={dialog.closeDialog} title={title} description={description} busy={busy} triggerRef={focusRef}>
      <ActionForm
        action={action}
        onSuccess={(state) => {
          if (returnFocusTo?.current) focusRef.current = returnFocusTo.current;
          onSuccess(state);
          setBusy(false);
          dialog.closeDialog();
        }}
      >
        <ReportPending onChange={setBusy} />
        <UnsavedFormGuard />
        <FormStack>
          {children}
          <FormActions>
            <SubmitButton pendingLabel={pendingLabel} variant={submitVariant}>
              {submitLabel}
            </SubmitButton>
            <Button $variant="quiet" onClick={() => !busy && dialog.closeDialog()}>
              Cancel
            </Button>
            <FormMessage />
          </FormActions>
        </FormStack>
        {hidden}
      </ActionForm>
    </Dialog>
  );
}

/* ---------- Two-step destructive action ---------- */

const ConfirmBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};

  > p {
    ${type.body}
    color: ${({ theme }) => theme.colors.text};
  }
`;

interface ConfirmActionProps {
  label: string;
  question: string;
  confirmLabel: string;
  pendingLabel: string;
  action: FormAction;
  hidden: ReactNode;
  onSuccess?: (state: NonNullable<ActionState>) => void;
}

// "Delete X? This can't be undone." with Keep focused, so Enter never deletes by accident
export function ConfirmAction({ label, question, confirmLabel, pendingLabel, action, hidden, onSuccess }: ConfirmActionProps) {
  const [asking, setAsking] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (asking) keepRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [asking]);

  if (!asking) {
    return (
      <Button ref={triggerRef} $variant="danger" onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <ActionForm
      action={action}
      onSuccess={(state) => {
        setAsking(false);
        onSuccess?.(state);
      }}
    >
      <ConfirmBox>
        <p>{question}</p>
        <FormActions>
          <SubmitButton variant="danger" pendingLabel={pendingLabel}>
            {confirmLabel}
          </SubmitButton>
          <Button
            ref={keepRef}
            $variant="quiet"
            onClick={() => {
              returnFocus.current = true;
              setAsking(false);
            }}
          >
            Keep
          </Button>
          <FormMessage />
        </FormActions>
      </ConfirmBox>
      {hidden}
    </ActionForm>
  );
}

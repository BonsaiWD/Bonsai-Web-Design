'use client';

import { forwardRef, Fragment, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import styled, { css } from 'styled-components';
import { FiCheck } from 'react-icons/fi';
import {
  ActionForm,
  Button,
  Dialog,
  FormActions,
  FormMessage,
  FormStack,
  PHONE,
  space,
  SubmitButton,
  tint,
  type,
  useDialog,
  useFormStatusState,
  type ActionState,
  type FormAction,
} from '@/components/portal/ui';

// Small headings use the portal's sans; the site's global rule would set h4/h5 in Playfair
export const sansHeading = css`
  font-family: ${({ theme }) => theme.fonts.main};
  letter-spacing: 0;
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

// A status line and the function that fills it; focus moves after React has committed
export function useAnnouncer() {
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState({ message: '', focus: false, at: 0 });
  useEffect(() => {
    if (status.focus) statusRef.current?.focus();
  }, [status]);
  const announce = useCallback((message: string, focus = true) => setStatus({ message, focus, at: Date.now() }), []);
  return { statusRef, message: status.message, announce };
}

/* ---------- Forms ---------- */

/*
 * React resets a form after each action, and a <select> resets to the option it was first
 * rendered with. Remounting the fields after every result makes every control start from
 * useField's values: what was submitted after an error, what was saved after a success.
 */
export function FreshFields({ children, saved = '' }: { children: ReactNode; saved?: string }) {
  const { state } = useFormStatusState();
  return <Fragment key={`${saved}:${state?.at ?? 0}`}>{children}</Fragment>;
}

// Tells a dialog while its form is submitting, so Escape cannot close it halfway
export function PendingReporter({ onChange }: { onChange: (pending: boolean) => void }) {
  const { pending } = useFormStatusState();
  useEffect(() => onChange(pending), [pending, onChange]);
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
  // The fields: remounted after every result, and mounted afresh each time the dialog opens
  children: ReactNode;
  // Hidden inputs go after the fields, so the dialog's first focus lands on a real control.
  // They are not remounted after a result, so a per-form id survives a failed submit.
  hidden?: ReactNode;
  // Where focus goes after success, when the button that opened the dialog may be gone
  returnFocusTo?: RefObject<HTMLElement | null>;
}

// A dialog holding one form: it closes on success and hands focus back
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
        <PendingReporter onChange={setBusy} />
        <FormStack>
          <FreshFields>{children}</FreshFields>
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
  label: ReactNode;
  question: string;
  confirmLabel: string;
  pendingLabel: string;
  action: FormAction;
  hidden: ReactNode;
  onSuccess?: (state: NonNullable<ActionState>) => void;
  variant?: 'danger' | 'secondary';
}

// "Remove X? This can't be undone." with Keep focused, so Enter never confirms by accident
export function ConfirmAction({
  label,
  question,
  confirmLabel,
  pendingLabel,
  action,
  hidden,
  onSuccess,
  variant = 'danger',
}: ConfirmActionProps) {
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
      <Button ref={triggerRef} $variant={variant} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <ActionForm
      action={action}
      onSuccess={(state) => {
        returnFocus.current = false;
        setAsking(false);
        onSuccess?.(state);
      }}
    >
      <ConfirmBox>
        <p>{question}</p>
        <FormActions>
          <SubmitButton variant={variant} pendingLabel={pendingLabel}>
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

/* ---------- Tool rows ----------
   A list of things the studio can do to one item: what it does on the left, the control on
   the right. Destructive tools sit last, under their own rule. */

export const Tools = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);

  @media (min-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: ${space[10]};
  }
`;

export const Tool = styled.li<{ $danger?: boolean; $wide?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${space[3]};
  padding: ${space[5]} 0;
  border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  min-width: 0;

  ${({ $wide }) =>
    $wide &&
    css`
      grid-column: 1 / -1;
    `}

  ${({ $danger, theme }) =>
    $danger &&
    css`
      grid-column: 1 / -1;
      border-top-color: ${tint(theme.colors.error, 30)};
    `}

  h4 {
    ${type.label}
    ${sansHeading}
  }

  > div:first-child {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    min-width: 0;
  }

  p {
    ${type.meta}
    max-width: 60ch;
    overflow-wrap: anywhere;
  }

  @media (max-width: ${PHONE}) {
    button,
    a[href] {
      width: 100%;
    }
  }
`;

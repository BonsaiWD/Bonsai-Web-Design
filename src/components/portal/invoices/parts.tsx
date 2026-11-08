'use client';

import { Children, Fragment, forwardRef, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import styled, { css } from 'styled-components';
import { FiCheck } from 'react-icons/fi';
import MetaDot from '@/components/common/MetaDot';
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

// Small headings use the UI type styles; the site's global rule would set them in Playfair
export const sansHeading = css`
  font-family: ${({ theme }) => theme.fonts.main};
  letter-spacing: 0;
`;

/* ---------- Meta line ---------- */

const MetaRow = styled.div`
  ${type.meta}
  ${type.figures}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[1]} ${space[3]};
  min-width: 0;
`;

// Meta items separated by the bronze dot, as everywhere on the site
export function MetaLine({ children, className }: { children: ReactNode; className?: string }) {
  const items = Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <MetaRow className={className}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <MetaDot aria-hidden="true" />}
          <span>{item}</span>
        </Fragment>
      ))}
    </MetaRow>
  );
}

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

// Focus moves in an effect, after React has committed the change the message describes
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

/* ---------- Forms ---------- */

// Tells a dialog while its form is submitting, so Escape cannot close it halfway
export function PendingReporter({ onChange }: { onChange: (pending: boolean) => void }) {
  const { pending } = useFormStatusState();
  useEffect(() => onChange(pending), [pending, onChange]);
  return null;
}

/*
 * React resets a form after each action, and a <select> resets to the option it was first
 * rendered with, not to its current defaultValue. Remounting the fields after every result
 * makes every control start from useField's values: what was submitted after an error.
 */
export function FreshFields({ children }: { children: ReactNode }) {
  const { state } = useFormStatusState();
  return <Fragment key={state?.at ?? 0}>{children}</Fragment>;
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

  @media (max-width: ${PHONE}) {
    button {
      width: 100%;
    }
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
  block?: boolean;
}

// "Delete X? This can't be undone." with Keep focused, so Enter never deletes by accident
export function ConfirmAction({ label, question, confirmLabel, pendingLabel, action, hidden, onSuccess, block }: ConfirmActionProps) {
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
      <Button ref={triggerRef} $variant="danger" $block={block} onClick={() => setAsking(true)}>
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

/* ---------- Small shared styles ---------- */

// A hairline-ruled box inside a panel, for a record or a form that opens in place
export const Inset = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  padding: ${space[4]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 18)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};
`;

// The big figure in a summary: an amount, a count
export const Amount = styled.p<{ $size?: 'lg' | 'md' }>`
  ${type.figures}
  margin: 0;
  font-size: ${({ $size = 'lg' }) => ($size === 'lg' ? '2rem' : '1.5rem')};
  line-height: 1.15;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.text};
`;

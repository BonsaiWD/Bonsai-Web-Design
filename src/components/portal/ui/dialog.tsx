'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import styled from 'styled-components';
import { FiX } from 'react-icons/fi';
import { Button, type ButtonVariant } from './buttons';
import { ActionForm, FormActions, FormMessage, FormStack, FreshFields, PendingReporter, SubmitButton, type ActionState, type FormAction } from './forms';
import { PHONE, focusRing, radius, space, tint, TOUCH, TOUCH_TARGET, type } from './tokens';

/*
 * A native <dialog> opened with showModal(): the browser traps focus, makes the page behind
 * it inert and closes it on Escape. Render it in place (no portal), at a level that stays
 * mounted after the action succeeds, and let useDialog return focus to the trigger.
 */

export function useDialog() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const openDialog = useCallback((event?: { currentTarget: EventTarget | null }) => {
    triggerRef.current = (event?.currentTarget as HTMLElement | null) ?? (document.activeElement as HTMLElement | null);
    setOpen(true);
  }, []);
  const closeDialog = useCallback(() => setOpen(false), []);
  return { open, openDialog, closeDialog, triggerRef };
}

/*
 * A value as it was when a dialog opened, held while the dialog stays open. The dialog acts on
 * what the person saw (the server refuses it if that has changed), and a dialog whose own
 * success removes the value stays mounted to report the result.
 */
export function useHeldWhileOpen<T>(value: T, open: boolean): T {
  const [held, setHeld] = useState(value);
  if (!open && held !== value) setHeld(value);
  return open ? held : value;
}

const Shell = styled.dialog`
  width: min(36rem, calc(100vw - 2rem));
  max-height: min(100dvh - 2rem, 48rem);
  margin: auto;
  padding: 0;
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 22)};
  border-radius: ${radius.panel};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  overflow: auto;
  overscroll-behavior: contain;

  &::backdrop {
    background: ${({ theme }) => tint(theme.colors.background, 78)};
    backdrop-filter: none;
  }

  @media (max-width: ${PHONE}) {
    width: 100vw;
    max-width: none;
    max-height: 100dvh;
    margin: auto 0 0;
    border-radius: ${radius.panel} ${radius.panel} 0 0;
  }
`;

const Header = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${space[4]};
  padding: ${space[6]} ${space[6]} 0;

  h2 {
    ${type.h3}
    font-size: 1.25rem;
  }

  p {
    ${type.meta}
    margin-top: ${space[2]};
    font-size: 0.9375rem;
  }
`;

const Close = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  margin: -${space[2]} -${space[2]} 0 0;
  padding: 0;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 1.25rem;
  ${focusRing}

  /* A full-size target on phones and touch screens */
  @media ${TOUCH} {
    width: ${TOUCH_TARGET};
    height: ${TOUCH_TARGET};
  }

  @media (hover: hover) {
    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  }
`;

const Body = styled.div`
  padding: ${space[5]} ${space[6]} ${space[6]};
`;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  // While an action runs, Escape and the close button do nothing
  busy?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function Dialog({ open, onClose, title, description, children, busy = false, triggerRef }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start on the first form control rather than the close button
      dialog.querySelector<HTMLElement>('input, textarea, select')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      triggerRef?.current?.focus();
    }
  }, [open, triggerRef]);

  return (
    <Shell
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {open && (
        <>
          <Header>
            <div>
              <h2 id={titleId}>{title}</h2>
              {description && <p id={descriptionId}>{description}</p>}
            </div>
            <Close type="button" aria-label="Close" onClick={() => !busy && onClose()}>
              <FiX aria-hidden="true" />
            </Close>
          </Header>
          <Body>{children}</Body>
        </>
      )}
    </Shell>
  );
}

/* ---------- A dialog holding one form ---------- */

interface FormDialogProps {
  dialog: ReturnType<typeof useDialog>;
  title: ReactNode;
  description?: ReactNode;
  action: FormAction;
  submitLabel: ReactNode;
  pendingLabel: string;
  submitVariant?: Exclude<ButtonVariant, 'quiet'>;
  onSuccess?: (state: NonNullable<ActionState>) => void;
  // The fields: remounted after every result (FreshFields), and mounted afresh each opening
  children: ReactNode;
  // Hidden inputs go after the fields, so the dialog's first focus lands on a real control.
  // They are not remounted after a result, so a per-opening FormId survives a failed submit.
  hidden?: ReactNode;
  // Where focus goes after success, when the button that opened the dialog may be gone
  returnFocusTo?: RefObject<HTMLElement | null>;
}

// Closes on success and hands focus back; what is typed is guarded until then (ActionForm)
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
          onSuccess?.(state);
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

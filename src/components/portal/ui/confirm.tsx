'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { Button, type ButtonSize } from './buttons';
import { ActionForm, FormMessage, SubmitButton, type ActionState, type FormAction } from './forms';
import { PHONE, space, tint, type } from './tokens';

/*
 * The portal's two-step confirm: "Delete X? This can't be undone." [Delete] [Keep]. It opens
 * in place of (or under) the button that asked, and focus lands on the safe choice, so Enter
 * never confirms by accident. `tone` says what kind of step it is: 'danger' for something
 * that removes or ends, 'primary' for a confirmation that only needs a second look.
 */

export type ConfirmTone = 'danger' | 'primary';

const Box = styled.div<{ $tone: ConfirmTone; $block: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${space[3]} ${space[4]};
  padding: ${space[4]} ${space[5]};
  border: 1px solid ${({ $tone, theme }) => tint($tone === 'danger' ? theme.colors.error : theme.colors.primary, $tone === 'danger' ? 45 : 40)};
  background: ${({ $tone, theme }) => tint($tone === 'danger' ? theme.colors.error : theme.colors.primary, 6)};

  > div:first-child {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    flex: 1 1 16rem;
    min-width: 0;
  }

  > div:last-child {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space[3]};
    ${({ $block }) => ($block ? 'width: 100%;' : '')}
  }

  ${({ $block }) => ($block ? '> div:last-child button { width: 100%; }' : '')}

  @media (max-width: ${PHONE}) {
    padding: ${space[4]};

    > div:last-child {
      width: 100%;
    }

    > div:last-child button {
      width: 100%;
      min-height: 2.75rem;
    }
  }
`;

const Question = styled.p`
  ${type.body}
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
`;

const Detail = styled.p`
  ${type.meta}
  overflow-wrap: anywhere;
`;

interface InlineConfirmProps {
  question: ReactNode;
  // A second, quieter line: what else happens
  detail?: ReactNode;
  tone?: ConfirmTone;
  // Left out for a refusal that only needs acknowledging ("Can't delete: …" [OK])
  action?: FormAction;
  confirmLabel?: ReactNode;
  pendingLabel?: string;
  keepLabel?: ReactNode;
  onKeep: () => void;
  hidden?: ReactNode;
  onSuccess?: (state: NonNullable<ActionState>) => void;
  // For a confirm that removes its own row: the row unmounts with the result, so the list
  // notices the row has gone instead
  onSubmit?: () => void;
  size?: ButtonSize;
  // Full-width buttons, for a narrow column
  block?: boolean;
}

export function InlineConfirm({
  question,
  detail,
  tone = 'danger',
  action,
  confirmLabel,
  pendingLabel = 'Working…',
  keepLabel = 'Keep',
  onKeep,
  hidden,
  onSuccess,
  onSubmit,
  size,
  block = false,
}: InlineConfirmProps) {
  const keepRef = useRef<HTMLButtonElement>(null);
  // Mounted when the question is asked: the safe choice takes focus
  useEffect(() => {
    keepRef.current?.focus();
  }, []);

  const keep = (
    <Button ref={keepRef} $variant="secondary" $size={size} onClick={onKeep}>
      {keepLabel}
    </Button>
  );

  if (!action) {
    return (
      <Box $tone={tone} $block={block}>
        <div>
          <Question>{question}</Question>
          {detail && <Detail>{detail}</Detail>}
        </div>
        <div>{keep}</div>
      </Box>
    );
  }

  return (
    <ActionForm action={action} onSubmit={onSubmit} onSuccess={onSuccess}>
      <Box $tone={tone} $block={block}>
        <div>
          <Question>{question}</Question>
          {detail && <Detail>{detail}</Detail>}
          <FormMessage />
        </div>
        <div>
          <SubmitButton variant={tone === 'danger' ? 'danger' : 'primary'} size={size} pendingLabel={pendingLabel}>
            {confirmLabel}
          </SubmitButton>
          {keep}
        </div>
      </Box>
      {hidden}
    </ActionForm>
  );
}

interface ConfirmActionProps extends Omit<InlineConfirmProps, 'onKeep' | 'action' | 'confirmLabel' | 'pendingLabel'> {
  // The button that asks
  label: ReactNode;
  action: FormAction;
  confirmLabel: ReactNode;
  pendingLabel: string;
}

// A button that turns into the confirm in place, and back on Keep (with focus on it again)
export function ConfirmAction({ label, tone = 'danger', block, size, onSuccess, ...confirm }: ConfirmActionProps) {
  const [asking, setAsking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (asking || !returnFocus.current) return;
    returnFocus.current = false;
    triggerRef.current?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <Button ref={triggerRef} $variant={tone === 'danger' ? 'danger' : 'secondary'} $size={size} $block={block} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <InlineConfirm
      {...confirm}
      tone={tone}
      block={block}
      size={size}
      onKeep={() => {
        returnFocus.current = true;
        setAsking(false);
      }}
      onSuccess={(state) => {
        setAsking(false);
        onSuccess?.(state);
      }}
    />
  );
}

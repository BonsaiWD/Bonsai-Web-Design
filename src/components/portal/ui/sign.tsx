'use client';

import type { ReactNode } from 'react';
import styled from 'styled-components';
import { Checkbox, Field, Input, Textarea } from './forms';
import { space, tint, type } from './tokens';

/*
 * The fields of every client signing dialog (a milestone sign-off, a deliverable approval, a
 * contract signature), in one order and one wording: what is being signed, the statement
 * they tick, their name or initials, and an optional note. The statement is stored verbatim
 * by the server, so each feature passes its own.
 */

// The one sentence about the record, the same in every signing dialog
export const SIGN_HINT = 'We record your name and the time, and email you a receipt.';

// What exactly is being signed, restated inside the dialog
const Plate = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  padding: ${space[4]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 18)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};

  > span {
    ${type.meta}
  }

  strong {
    ${type.label}
    ${type.figures}
    overflow-wrap: anywhere;
  }

  a {
    ${type.meta}
    align-self: flex-start;
    margin-top: ${space[1]};
  }
`;

// Framed sentence the client ticks, so the statement is read before it is agreed to
const StatementBox = styled.div`
  padding: ${space[4]} ${space[5]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 30)};
  background: ${({ theme }) => tint(theme.colors.primary, 5)};
  overflow-wrap: anywhere;
`;

const Initials = styled(Input)`
  max-width: 9rem;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const Note = styled(Textarea)`
  min-height: 5.5rem;
`;

interface SignStatementProps {
  // The plate: "You are approving" + what, with any details (size, a link to read it)
  summary?: { lead: string; title: ReactNode; details?: ReactNode };
  statement: string;
  signWith: 'name' | 'initials';
  noteHint?: string;
}

export function SignStatement({ summary, statement, signWith, noteHint }: SignStatementProps) {
  return (
    <>
      {summary && (
        <Plate>
          <span>{summary.lead}</span>
          <strong>{summary.title}</strong>
          {summary.details}
        </Plate>
      )}
      <StatementBox>
        <Checkbox name="confirm" required>
          {statement}
        </Checkbox>
      </StatementBox>
      {signWith === 'initials' ? (
        <Field label="Your initials" name="initials" hint={`1 to 6 letters, such as JD. ${SIGN_HINT}`}>
          {(control) => (
            <Initials
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          )}
        </Field>
      ) : (
        <Field label="Type your full name to sign" name="signedName" hint={SIGN_HINT}>
          {(control) => (
            <Input
              id={control.id}
              name={control.name}
              defaultValue={control.defaultValue}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid || undefined}
              autoComplete="name"
              maxLength={120}
              required
            />
          )}
        </Field>
      )}
      <Field label="Note" name="note" optional hint={noteHint}>
        {(control) => (
          <Note
            id={control.id}
            name={control.name}
            defaultValue={control.defaultValue}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            maxLength={2000}
          />
        )}
      </Field>
    </>
  );
}

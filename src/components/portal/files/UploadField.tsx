'use client';

import { useId, useState } from 'react';
import styled from 'styled-components';
import { FiAlertCircle } from 'react-icons/fi';
import { formatBytes } from '@/components/portal/deliverables/copy';
import { Field, FileInput, space, type, useFormStatusState } from '@/components/portal/ui';

const TooLarge = styled.p`
  ${type.meta}
  display: flex;
  align-items: flex-start;
  gap: ${space[2]};
  margin-top: ${space[2]};
  color: ${({ theme }) => theme.colors.error};

  svg {
    flex-shrink: 0;
    margin-top: 0.2em;
  }
`;

interface UploadFieldProps {
  label: string;
  hint: string;
  acceptedExtensions: string;
  maxUploadBytes: number;
  name?: string;
  optional?: boolean;
  // What to do instead with a file over the limit
  tooLargeAdvice?: string;
}

/*
 * The file control every upload form shares. A file over the limit is cleared as soon as it
 * is chosen, so it never travels to the server (which would refuse it after a long wait), and
 * after a failed submit the hint says to choose the file again: browsers clear file inputs
 * whenever a form is reset.
 */
export function UploadField({
  label,
  hint,
  acceptedExtensions,
  maxUploadBytes,
  name = 'file',
  optional,
  tooLargeAdvice = 'for anything larger, share a link in Messages instead.',
}: UploadFieldProps) {
  const { state } = useFormStatusState();
  const [chosen, setChosen] = useState<{ name: string; at: number | null } | null>(null);
  const [tooLarge, setTooLarge] = useState<{ name: string; size: number } | null>(null);
  const warningId = useId();
  const cleared = Boolean(chosen && state && !state.ok && state.at !== chosen.at);
  const limit = `${Math.round(maxUploadBytes / (1024 * 1024))} MB`;

  return (
    <div>
      <Field
        label={label}
        name={name}
        optional={optional}
        hint={cleared && chosen ? `Choose ${chosen.name} again: files are cleared when the form needs a correction.` : hint}
      >
        {(control) => (
          <FileInput
            id={control.id}
            name={control.name}
            accept={acceptedExtensions}
            aria-describedby={[tooLarge ? warningId : null, control.describedBy].filter(Boolean).join(' ') || undefined}
            aria-invalid={control.invalid || Boolean(tooLarge) || undefined}
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (picked && picked.size > maxUploadBytes) {
                event.target.value = '';
                setTooLarge({ name: picked.name, size: picked.size });
                setChosen(null);
                return;
              }
              setTooLarge(null);
              // Remember which result this choice came after, so the hint shows only once it is cleared
              setChosen(picked ? { name: picked.name, at: state?.at ?? null } : null);
            }}
          />
        )}
      </Field>
      {tooLarge && (
        <TooLarge id={warningId} role="alert">
          <FiAlertCircle aria-hidden="true" />
          {tooLarge.name} is {formatBytes(tooLarge.size)}. Files can be up to {limit}: {tooLargeAdvice}
        </TooLarge>
      )}
    </div>
  );
}

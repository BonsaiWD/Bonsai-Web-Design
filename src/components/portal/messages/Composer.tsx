'use client';

import { useId, useRef, useState, type RefObject } from 'react';
import styled from 'styled-components';
import { FiLock, FiSend } from 'react-icons/fi';
import { ActionForm, Checkbox, Field, FormMessage, space, SubmitButton, useFormStatusState, type FormAction } from '@/components/portal/ui';
import { ComposerArea, ComposerBar, ComposerTextarea, Counter, KeyHint, PreviewNote } from './styles';
import { useIsApple } from './time';
import type { Perspective } from './types';

const Status = styled(FormMessage)`
  margin-top: ${space[3]};
`;

// The counter appears once a message gets long, well before the limit
const COUNTER_FROM = 500;

const countOf = (value: string) => value.replace(/\r\n?/g, '\n').trim().length;

interface FieldsProps {
  studio: boolean;
  internal: boolean;
  onInternalChange: (internal: boolean) => void;
  clientName: string;
  maxLength: number;
  length: number;
  onTyped: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

// Inside the form, so the shortcut can see whether a send is already on its way
function ComposerFields({ studio, internal, onInternalChange, clientName, maxLength, length, onTyped, textareaRef }: FieldsProps) {
  const { pending } = useFormStatusState();
  const apple = useIsApple();
  const hintId = useId();
  const label = studio ? (internal ? 'Internal note' : `Message to ${clientName}`) : 'Message to the studio';
  const placeholder = studio
    ? internal
      ? 'A note for the studio only'
      : `Write to ${clientName}`
    : 'Ask a question, share feedback or paste a link';

  return (
    <>
      <Field label={label} name="body">
        {(control) => (
          <ComposerTextarea
            ref={textareaRef}
            id={control.id}
            name={control.name}
            aria-describedby={[control.describedBy, hintId].filter(Boolean).join(' ')}
            aria-invalid={control.invalid || undefined}
            defaultValue={control.defaultValue}
            placeholder={placeholder}
            rows={3}
            $internal={internal}
            onInput={(event) => onTyped(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (!pending) event.currentTarget.form?.requestSubmit();
            }}
          />
        )}
      </Field>

      <ComposerBar>
        {studio ? (
          <Checkbox name="internal" savedChecked={internal} onChange={(event) => onInternalChange(event.currentTarget.checked)}>
            Internal note (only the studio sees this)
          </Checkbox>
        ) : (
          <span />
        )}
        <div>
          <KeyHint id={hintId}>
            <kbd>{apple ? '⌘' : 'Ctrl'}</kbd> + <kbd>Enter</kbd> to {internal ? 'save' : 'send'}
          </KeyHint>
          {length > maxLength - COUNTER_FROM && (
            <Counter $over={length > maxLength}>
              {length.toLocaleString('en-US')} / {maxLength.toLocaleString('en-US')}
            </Counter>
          )}
          <SubmitButton pendingLabel={internal ? 'Saving…' : 'Sending…'}>
            {internal ? <FiLock aria-hidden="true" /> : <FiSend aria-hidden="true" />}
            {internal ? 'Save note' : 'Send'}
          </SubmitButton>
        </div>
      </ComposerBar>
      <Status />
    </>
  );
}

interface ComposerProps {
  projectId: string;
  perspective: Perspective;
  clientName: string;
  maxLength: number;
  action: FormAction;
}

export function Composer({ projectId, perspective, clientName, maxLength, action }: ComposerProps) {
  const studio = perspective === 'studio';
  // One id per message, made when typing starts: a double submit reuses it and posts once
  const [id, setId] = useState<string | null>(null);
  // Stays on after a note is saved, so a run of notes never slips out to the client
  const [internal, setInternal] = useState(false);
  const [length, setLength] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <ComposerArea $internal={internal}>
      <ActionForm
        action={action}
        aria-label={studio ? `Write to ${clientName}` : 'Write to the studio'}
        onSuccess={() => {
          setId(null);
          setLength(0);
          const textarea = textareaRef.current;
          // Ready for the next message, wherever the send came from
          if (textarea?.form?.contains(document.activeElement)) textarea.focus({ preventScroll: true });
        }}
      >
        <ComposerFields
          studio={studio}
          internal={internal}
          onInternalChange={setInternal}
          clientName={clientName}
          maxLength={maxLength}
          length={length}
          onTyped={(value) => {
            if (!id) setId(crypto.randomUUID());
            setLength(countOf(value));
          }}
          textareaRef={textareaRef}
        />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="id" value={id ?? ''} />
      </ActionForm>
    </ComposerArea>
  );
}

export function ComposerPreview({ clientName }: { clientName: string }) {
  return (
    <ComposerArea>
      <PreviewNote>
        <FiLock aria-hidden="true" />
        Only {clientName} can write here. You&apos;re previewing the client&apos;s view; switch back to the studio view to reply.
      </PreviewNote>
    </ComposerArea>
  );
}

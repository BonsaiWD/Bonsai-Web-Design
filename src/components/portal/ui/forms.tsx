'use client';

import {
  createContext,
  Fragment,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { unstable_isUnrecognizedActionError, unstable_rethrow } from 'next/navigation';
import styled, { css } from 'styled-components';
import { FiCheck, FiChevronDown } from 'react-icons/fi';
import type { ActionState } from '@/server/portal/actions';
import { Button, type ButtonSize, type ButtonVariant } from './buttons';
import { DURATION, ease, focusRing, space, tint, type } from './tokens';
import { useFormEdits, useUnsavedChanges } from './unsaved';

export type { ActionState };
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

// A result as the form sees it: on failure, also the names of the files that were sent, since
// browsers clear file inputs when the form resets and the person has to choose them again
export type FormState = (NonNullable<ActionState> & { files?: Record<string, string> }) | null;

/*
 * The form contract. A server action returns { ok, message, fieldErrors, values }. React
 * resets a form before each action, so every control takes its defaultValue from the
 * submitted values on failure (nothing typed is lost) and from the saved value otherwise.
 * After a failure, focus moves to the first invalid field, or to the message.
 */

interface FormContextValue {
  state: FormState;
  pending: boolean;
}

const FormContext = createContext<FormContextValue>({ state: null, pending: false });

export function useFormStatusState() {
  return useContext(FormContext);
}

// The error and the value to show for a named field
export function useField(name: string, saved?: string | null) {
  const { state } = useContext(FormContext);
  const submitted = state && !state.ok ? state.values?.[name] : undefined;
  return {
    error: state?.fieldErrors?.[name],
    defaultValue: submitted ?? saved ?? '',
    // For checkboxes: what was submitted wins over what is saved
    defaultChecked: (savedChecked: boolean) => (state && !state.ok && state.values ? state.values[name] === 'on' : savedChecked),
  };
}

interface ActionFormProps extends Omit<ComponentPropsWithoutRef<'form'>, 'action' | 'children'> {
  action: FormAction;
  children: ReactNode;
  // Called once per successful run, e.g. to close a dialog
  onSuccess?: (state: NonNullable<ActionState>) => void;
  // While something typed is still there, leaving the page asks first (until a success or
  // unmount). Off for a form that is only hidden, not discarded, and for views that track
  // edits against the saved values themselves.
  guardUnsaved?: boolean;
}

// What was typed, so the form can put it back after a request that never reached the action
function typedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('$ACTION') && typeof value === 'string') values[key] = value;
  }
  return values;
}

function sentFiles(formData: FormData): Record<string, string> | undefined {
  const files: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File && value.size > 0) files[key] = value.name;
  }
  return Object.keys(files).length ? files : undefined;
}

export function ActionForm({ action, children, onSuccess, guardUnsaved = true, ...formProps }: ActionFormProps) {
  // A request can fail before the action runs: a dropped connection, a body over the upload
  // limit, or a new deploy that no longer knows this action. Without this the whole page
  // would be replaced by an error and everything typed would be lost.
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (previous, formData) => {
    const files = sentFiles(formData);
    try {
      const result = await action(previous, formData);
      return result && !result.ok && files ? { ...result, files } : result;
    } catch (error) {
      // redirect() and notFound() from an action arrive as errors; let Next handle them
      unstable_rethrow(error);
      return {
        ok: false,
        message: unstable_isUnrecognizedActionError(error)
          ? 'The portal was just updated. Copy anything you typed, reload the page and try again.'
          : "We couldn't reach the server. Check your connection and try again. If you attached a file, it may be over 4 MB.",
        values: typedValues(formData),
        files,
        at: Date.now(),
      };
    }
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const lastHandled = useRef<number | null>(null);
  const onSuccessRef = useRef(onSuccess);

  // A success saved what was typed. A failure keeps it unsaved: the fields start again from
  // what was sent, so they no longer differ from their defaults, and the hold carries it.
  const [edited, setEdited] = useFormEdits(formRef);
  const [heldAfterFailure, setHeldAfterFailure] = useState(false);
  const [resultAt, setResultAt] = useState(state?.at);
  if (state?.at !== resultAt) {
    setResultAt(state?.at);
    if (state?.ok) {
      setEdited(false);
      setHeldAfterFailure(false);
    } else if (state && edited) {
      setHeldAfterFailure(true);
    }
  }
  useUnsavedChanges((edited || heldAfterFailure) && guardUnsaved);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (!state || lastHandled.current === state.at) return;
    lastHandled.current = state.at;
    if (state.ok) {
      onSuccessRef.current?.(state);
      return;
    }
    const form = formRef.current;
    const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (invalid ?? form?.querySelector<HTMLElement>('[data-form-message]'))?.focus();
  }, [state]);

  return (
    <FormContext.Provider value={{ state, pending }}>
      <form ref={formRef} action={formAction} noValidate {...formProps}>
        {children}
      </form>
    </FormContext.Provider>
  );
}

/*
 * React resets a form after each action, and a <select> resets to the option it was first
 * rendered with, not to its current defaultValue. Remounting the fields after every result
 * makes every control start from useField's values: what was submitted after an error, what
 * was saved after a success. `saved` remounts them too when the saved values change.
 */
export function FreshFields({ children, saved = '' }: { children: ReactNode; saved?: string }) {
  const { state } = useContext(FormContext);
  return <Fragment key={`${saved}:${state?.at ?? 0}`}>{children}</Fragment>;
}

// Tells a dialog while its form is submitting, so Escape cannot close it halfway
export function PendingReporter({ onChange }: { onChange: (pending: boolean) => void }) {
  const { pending } = useContext(FormContext);
  useEffect(() => onChange(pending), [pending, onChange]);
  return null;
}

// One id per form instance, made in the browser when the form mounts (each dialog opening): a
// second submit of the same form is recognised by the server and adds nothing twice
export function FormId({ name = 'id' }: { name?: string }) {
  const [id] = useState(() => crypto.randomUUID());
  return <input type="hidden" name={name} value={id} />;
}

/* ---------- Status message ---------- */

const MessageText = styled.p<{ $tone: 'ok' | 'error' }>`
  ${type.meta}
  display: flex;
  align-items: flex-start;
  gap: ${space[2]};
  color: ${({ $tone, theme }) => ($tone === 'error' ? theme.colors.error : theme.colors.text)};

  &:empty {
    display: none;
  }

  svg {
    flex-shrink: 0;
    margin-top: 0.2em;
    color: ${({ theme }) => theme.colors.primary};
  }

  &:focus {
    outline: none;
  }
`;

// Always in the DOM, so screen readers announce each new result
export function FormMessage({ className }: { className?: string }) {
  const { state } = useContext(FormContext);
  return (
    <MessageText
      className={className}
      role="status"
      aria-live="polite"
      tabIndex={-1}
      data-form-message
      $tone={state && !state.ok ? 'error' : 'ok'}
    >
      {state?.ok && <FiCheck aria-hidden="true" />}
      {state?.message ?? ''}
    </MessageText>
  );
}

/* ---------- Submit ---------- */

interface SubmitButtonProps {
  children: ReactNode;
  pendingLabel: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  name?: string;
  value?: string;
}

// While pending the label changes and the button stays at full contrast (aria-disabled)
export function SubmitButton({ children, pendingLabel, variant, size, block, name, value }: SubmitButtonProps) {
  const { pending } = useContext(FormContext);
  return (
    <Button
      type="submit"
      name={name}
      value={value}
      $variant={variant}
      $size={size}
      $block={block}
      aria-disabled={pending || undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

/* ---------- Fields ---------- */

const FieldWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[2]};
  min-width: 0;
`;

const LabelText = styled.label`
  ${type.label}
`;

const Optional = styled.span`
  ${type.meta}
  font-weight: 400;
  margin-left: ${space[2]};
`;

const Hint = styled.p`
  ${type.meta}
`;

const ErrorText = styled.p`
  ${type.meta}
  color: ${({ theme }) => theme.colors.error};
`;

interface FieldProps {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  optional?: boolean;
  children: (control: { id: string; name: string; describedBy?: string; invalid: boolean; defaultValue: string }) => ReactNode;
  saved?: string | null;
}

// Label, control, hint and error, wired together for assistive technology
export function Field({ label, name, hint, optional, children, saved }: FieldProps) {
  const id = useId();
  const { error, defaultValue } = useField(name, saved);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <FieldWrap>
      <LabelText htmlFor={id}>
        {label}
        {optional && <Optional>Optional</Optional>}
      </LabelText>
      {children({ id, name, describedBy, invalid: Boolean(error), defaultValue })}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
      {hint && <Hint id={hintId}>{hint}</Hint>}
    </FieldWrap>
  );
}

// One bronze hairline, as on the contact form: full bronze and doubled while focused
const lineControl = css`
  width: 100%;
  min-height: 2.75rem;
  padding: ${space[2]} 0;
  border: 0;
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 60)};
  border-radius: 0;
  background: transparent;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.text};
  transition:
    border-color ${DURATION.state}s ${ease},
    box-shadow ${DURATION.state}s ${ease};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 1;
  }

  &[aria-invalid='true'] {
    border-bottom-color: ${({ theme }) => theme.colors.error};
  }

  /* The transparent outline only shows in forced-colours mode, so focus still shows there */
  &:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    border-bottom-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 1px 0 ${({ theme }) => theme.colors.primary};
  }

  /* Keyboard focus also tints the field, so it stands out from its neighbours */
  &:focus-visible {
    background: ${({ theme }) => tint(theme.colors.primary, 9)};
    box-shadow: 0 2px 0 ${({ theme }) => theme.colors.primary};
  }

  &:-webkit-autofill,
  &:-webkit-autofill:hover,
  &:-webkit-autofill:focus {
    -webkit-text-fill-color: ${({ theme }) => theme.colors.text};
    caret-color: ${({ theme }) => theme.colors.text};
    transition: background-color 0s 600000s;
  }
`;

export const Input = styled.input`
  ${lineControl}
  ${type.figures}
`;

// Multi-line notes get a box: long text reads better inside edges
export const Textarea = styled.textarea`
  width: 100%;
  min-height: 7.5rem;
  padding: ${space[3]};
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 45)};
  border-radius: 0;
  background: ${({ theme }) => tint(theme.colors.background, 60)};
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 1rem;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.text};
  resize: vertical;
  transition: border-color ${DURATION.state}s ${ease};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 1;
  }

  &[aria-invalid='true'] {
    border-color: ${({ theme }) => theme.colors.error};
  }

  &:focus {
    outline: 2px solid transparent;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: inset 0 0 0 1px ${({ theme }) => theme.colors.primary};
  }

  &:focus-visible {
    background: ${({ theme }) => tint(theme.colors.primary, 7)};
  }
`;

const SelectWrap = styled.div`
  position: relative;

  svg {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    color: ${({ theme }) => theme.colors.primary};
    pointer-events: none;
  }
`;

const NativeSelect = styled.select`
  ${lineControl}
  appearance: none;
  padding-right: ${space[6]};

  option {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;

export function Select(props: ComponentPropsWithoutRef<'select'>) {
  return (
    <SelectWrap>
      <NativeSelect {...props} />
      <FiChevronDown aria-hidden="true" />
    </SelectWrap>
  );
}

const CheckLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: ${space[3]};
  ${type.body}
  color: ${({ theme }) => theme.colors.text};

  input {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    margin: 0.15rem 0 0;
    accent-color: ${({ theme }) => theme.colors.primary};
    ${focusRing}
  }

  small {
    display: block;
    ${type.meta}
  }
`;

interface CheckboxProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'children'> {
  name: string;
  children: ReactNode;
  hint?: ReactNode;
  savedChecked?: boolean;
}

// The whole sentence is the click target; the error is linked to the box, which takes focus
export function Checkbox({ name, children, hint, savedChecked = false, 'aria-describedby': describedBy, ...inputProps }: CheckboxProps) {
  const id = useId();
  const { error, defaultChecked } = useField(name);
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <CheckLabel>
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked(savedChecked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, describedBy].filter(Boolean).join(' ') || undefined}
          {...inputProps}
        />
        <span>
          {children}
          {hint && <small>{hint}</small>}
        </span>
      </CheckLabel>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
}

// The native file input, its button styled like the portal's secondary button
export const FileInput = styled.input.attrs({ type: 'file' })`
  width: 100%;
  padding: ${space[3]};
  border: 1px dashed ${({ theme }) => tint(theme.colors.primary, 45)};
  background: ${({ theme }) => tint(theme.colors.background, 60)};
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.9375rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  ${focusRing}

  &[aria-invalid='true'] {
    border-color: ${({ theme }) => theme.colors.error};
  }

  &::file-selector-button {
    margin-right: ${space[4]};
    min-height: 2.25rem;
    padding: 0 ${space[4]};
    border: 1px solid ${({ theme }) => tint(theme.colors.primary, 55)};
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    font-family: ${({ theme }) => theme.fonts.main};
    font-size: 0.875rem;
    font-weight: 600;
  }
`;

// Groups related fields; on wide screens two fields can sit side by side
export const FieldRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${space[5]};

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${space[5]};
`;

export const FormActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[3]} ${space[4]};
`;

'use client';

import { addClient, changeClientEmail, updateClient } from '@/app/portal/_actions/clients';
import { Checkbox, Field, FieldRow, Input, Notice, useDialog } from '@/components/portal/ui';
import FormId from './FormId';
import { FormDialog } from './parts';
import type { ClientView } from './types';

type DialogState = ReturnType<typeof useDialog>;

function NameFields({ saved }: { saved?: { name: string; company: string | null } }) {
  return (
    <FieldRow>
      <Field label="Name" name="name" saved={saved?.name ?? ''} hint="As you'd greet them in an email.">
        {(control) => (
          <Input
            id={control.id}
            name={control.name}
            defaultValue={control.defaultValue}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            maxLength={120}
            autoComplete="off"
            required
          />
        )}
      </Field>
      <Field label="Company" name="company" optional saved={saved?.company ?? ''}>
        {(control) => (
          <Input
            id={control.id}
            name={control.name}
            defaultValue={control.defaultValue}
            aria-describedby={control.describedBy}
            aria-invalid={control.invalid || undefined}
            maxLength={120}
            autoComplete="off"
          />
        )}
      </Field>
    </FieldRow>
  );
}

function EmailField({ saved, hint }: { saved?: string; hint: string }) {
  return (
    <Field label="Email address" name="email" saved={saved ?? ''} hint={hint}>
      {(control) => (
        <Input
          id={control.id}
          name={control.name}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={control.defaultValue}
          aria-describedby={control.describedBy}
          aria-invalid={control.invalid || undefined}
          maxLength={254}
          autoComplete="off"
          required
        />
      )}
    </Field>
  );
}

interface DialogProps {
  dialog: DialogState;
  onDone: (message: string) => void;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}

export function AddClientDialog({ dialog, onDone, returnFocusTo }: DialogProps) {
  return (
    <FormDialog
      dialog={dialog}
      title="Add a client"
      description="They sign in with this email address; there is no password. You can create their project once they're added."
      action={addClient}
      submitLabel="Add client"
      pendingLabel="Adding…"
      onSuccess={(state) => onDone(state.message)}
      returnFocusTo={returnFocusTo}
      hidden={<FormId />}
    >
      <NameFields />
      <EmailField hint="We store it in lowercase, as sign-in expects." />
      <Checkbox name="sendInvite" savedChecked hint="“Your client portal is ready”, with a button that signs them in.">
        Send an invite now
      </Checkbox>
    </FormDialog>
  );
}

export function EditClientDialog({ dialog, onDone, returnFocusTo, client }: DialogProps & { client: ClientView }) {
  return (
    <FormDialog
      dialog={dialog}
      title={`Edit ${client.name || client.email}`}
      action={updateClient}
      submitLabel="Save details"
      pendingLabel="Saving…"
      onSuccess={(state) => onDone(state.message)}
      returnFocusTo={returnFocusTo}
      hidden={<input type="hidden" name="clientId" value={client.id} />}
    >
      <NameFields saved={client} />
    </FormDialog>
  );
}

export function ChangeEmailDialog({ dialog, onDone, returnFocusTo, client }: DialogProps & { client: ClientView }) {
  const who = client.name || client.email;
  return (
    <FormDialog
      dialog={dialog}
      title={`Change ${who}'s email address`}
      action={changeClientEmail}
      submitLabel="Change address"
      pendingLabel="Changing…"
      onSuccess={(state) => onDone(state.message)}
      returnFocusTo={returnFocusTo}
      hidden={<input type="hidden" name="clientId" value={client.id} />}
    >
      <Notice>
        <p>
          They&apos;ll be signed out everywhere, and any sign-in link already sent to {client.email} stops working. From now on they sign in
          with the new address.
        </p>
      </Notice>
      <EmailField hint={`Currently ${client.email}.`} />
      <Checkbox name="sendInvite" savedChecked hint="So they know which address to use.">
        Send an invite to the new address
      </Checkbox>
    </FormDialog>
  );
}

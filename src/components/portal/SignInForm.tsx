'use client';

import styled from 'styled-components';
import { useState } from 'react';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { DUR } from '@/lib/motion';
import {
  caps,
  ease,
  Eyebrow,
  Lead,
  NarrowColumn,
  Note,
  PageTitle,
  PortalPage,
  PrimaryButton,
  STUDIO_EMAIL,
  TextButton,
  TextLink,
  tint,
} from './ui';

// The contact form's field line strength, which holds 3:1 against the ground
const FIELD_LINE = 60;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const Label = styled.label`
  ${caps}
  display: block;
  margin-bottom: 2px;
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  color: ${({ theme }) => theme.colors.primary};
`;

// One bronze hairline, as in the contact form: rose while there is something to fix,
// full bronze and doubled while it has focus
const Input = styled.input`
  width: 100%;
  padding: 0.625rem 0 0.75rem;
  border: 0;
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, FIELD_LINE)};
  border-radius: 0;
  background: transparent;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 1.05rem;
  color: ${({ theme }) => theme.colors.text};
  transition:
    border-color ${DUR.state}s ${ease},
    box-shadow ${DUR.state}s ${ease};

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 1;
  }

  &[aria-invalid='true'] {
    border-bottom-color: ${({ theme }) => theme.colors.error};
  }

  /* The transparent outline is invisible normally, but forced colours paint it, so focus still shows there */
  &:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    border-bottom-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 1px 0 ${({ theme }) => theme.colors.primary};
  }

  /* Autofilled fields keep the ink on the dark ground instead of the browser's opaque fill */
  &:-webkit-autofill,
  &:-webkit-autofill:hover,
  &:-webkit-autofill:focus {
    -webkit-text-fill-color: ${({ theme }) => theme.colors.text};
    caret-color: ${({ theme }) => theme.colors.text};
    transition:
      border-color ${DUR.state}s ${ease},
      box-shadow ${DUR.state}s ${ease},
      background-color 0s 600000s;
  }
`;

const Message = styled.p`
  font-size: 0.85rem;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.error};
  margin: 0;
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
`;

const emailSchema = z.email();

interface SignInFormProps {
  initialError: string | null;
  linkMinutes: number;
}

export default function SignInForm({ initialError, linkMinutes }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!emailSchema.safeParse(address).success) {
      setError('Enter the email address we have on file for you, such as name@company.com.');
      return;
    }

    setSending(true);
    setError(null);
    const { error: sendError } = await authClient.signIn.magicLink({
      email: address,
      callbackURL: '/portal',
      errorCallbackURL: '/portal/sign-in',
    });
    setSending(false);

    if (sendError) {
      setError(
        sendError.status === 429
          ? 'Too many sign-in requests. Wait a minute, then try again.'
          : `We could not send a link just now. Try again, or email ${STUDIO_EMAIL}.`,
      );
      return;
    }
    setSentTo(address);
  }

  if (sentTo) {
    return (
      <PortalPage>
        <NarrowColumn>
          <Eyebrow>Client portal</Eyebrow>
          <PageTitle>
            Check your <em>email</em>
          </PageTitle>
          <Lead>
            If {sentTo} belongs to a client account, a sign-in link is on its way. It works once and
            expires in {linkMinutes} minutes.
          </Lead>
          <Actions>
            <TextButton
              type="button"
              onClick={() => {
                setSentTo(null);
                setEmail('');
              }}
            >
              Use a different email
            </TextButton>
            <Note>
              Nothing after a few minutes? Check your spam folder, or email{' '}
              <TextLink href={`mailto:${STUDIO_EMAIL}`}>{STUDIO_EMAIL}</TextLink>.
            </Note>
          </Actions>
        </NarrowColumn>
      </PortalPage>
    );
  }

  return (
    <PortalPage>
      <NarrowColumn>
        <Eyebrow>Client portal</Eyebrow>
        <PageTitle>
          Sign in with your <em>email</em>
        </PageTitle>
        <Lead>We will email you a sign-in link. There is no password to remember.</Lead>
        <Form onSubmit={handleSubmit} noValidate>
          <div>
            <Label htmlFor="portal-email">Email address</Label>
            <Input
              id="portal-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'portal-email-error' : undefined}
            />
          </div>
          {error && (
            <Message id="portal-email-error" role="alert">
              {error}
            </Message>
          )}
          <Actions>
            <PrimaryButton type="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Email me a link'}
            </PrimaryButton>
          </Actions>
        </Form>
        <Note>
          New to Bonsai? <TextLink href="/#contact">Start a project</TextLink> and we will set up your
          portal.
        </Note>
      </NarrowColumn>
    </PortalPage>
  );
}

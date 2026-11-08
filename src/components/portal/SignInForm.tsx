'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiMail } from 'react-icons/fi';
import { authClient } from '@/lib/auth-client';
import { Button, Eyebrow, H1, Input, Lead, Meta, Notice, Stack, TextAnchor, TextButton, TextLink, space, type } from './ui';
import { signInHref } from './VerifyPanel';

const STUDIO_EMAIL = 'admin@bonsaiwebdesign.com';

const Column = styled.div`
  width: 100%;
  max-width: 30rem;
  margin: 0 auto;
  padding: ${space[16]} ${space[4]} ${space[16]};

  @media (max-width: 768px) {
    padding-top: ${space[10]};
  }
`;

const Label = styled.label`
  ${type.label}
`;

const ErrorText = styled.p`
  ${type.meta}
  color: ${({ theme }) => theme.colors.error};
`;

// Takes focus when the confirmation replaces the form; the heading itself shows where focus is
const SentHeading = styled(H1)`
  &:focus {
    outline: none;
  }
`;

// A light check (the server is the real gate); zod here would add ~30 KB to the sign-in page
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SignInFormProps {
  initialError: string | null;
  initialEmail: string;
  next: string | null;
  linkMinutes: number;
}

export default function SignInForm({ initialError, initialEmail, next, linkMinutes }: SignInFormProps) {
  const id = useId();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(initialError);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  // Set when the person asks for the form back, so focus goes to the address field
  const backToFormRef = useRef(false);

  // The form and the confirmation replace each other, taking the focused control with them:
  // move focus to the new view's heading, or back to the address, so it is not lost to the page
  useEffect(() => {
    if (sentTo) {
      sentHeadingRef.current?.focus();
    } else if (backToFormRef.current) {
      backToFormRef.current = false;
      emailRef.current?.focus();
    }
  }, [sentTo]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address) || address.length > 254) {
      setError('Enter the email address we have on file for you, such as name@company.com.');
      return;
    }

    setSending(true);
    setError(null);
    const { error: sendError } = await authClient.signIn.magicLink({
      email: address,
      callbackURL: next ?? '/portal',
      // An expired or used link comes back here with ?error= added; next survives it
      errorCallbackURL: signInHref(next),
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
      <Column>
        <Stack $gap={6}>
          <Stack $gap={3}>
            <Eyebrow>Client portal</Eyebrow>
            <SentHeading ref={sentHeadingRef} tabIndex={-1} aria-describedby={`${id}-sent`}>
              Check your email
            </SentHeading>
            <Lead id={`${id}-sent`}>
              If {sentTo} belongs to a client account, a sign-in link is on its way. It works once and expires in{' '}
              {linkMinutes} minutes.
            </Lead>
          </Stack>
          <Stack $gap={3}>
            <div>
              <TextButton
                onClick={() => {
                  backToFormRef.current = true;
                  setSentTo(null);
                  setEmail('');
                }}
              >
                Use a different email
              </TextButton>
            </div>
            <Meta>
              Nothing after a few minutes? Check your spam folder, or email{' '}
              <TextAnchor href={`mailto:${STUDIO_EMAIL}`}>{STUDIO_EMAIL}</TextAnchor>.
            </Meta>
          </Stack>
        </Stack>
      </Column>
    );
  }

  return (
    <Column>
      <Stack $gap={8}>
        <Stack $gap={3}>
          <Eyebrow>Client portal</Eyebrow>
          <H1>Sign in with your email</H1>
          <Lead>We will email you a sign-in link. There is no password to remember.</Lead>
        </Stack>
        <form onSubmit={handleSubmit} noValidate>
          <Stack $gap={5}>
            <Stack $gap={2}>
              <Label htmlFor={`${id}-email`}>Email address</Label>
              <Input
                ref={emailRef}
                id={`${id}-email`}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
              />
              {error && (
                <ErrorText id={`${id}-error`} role="alert">
                  {error}
                </ErrorText>
              )}
            </Stack>
            <div>
              <Button type="submit" aria-disabled={sending || undefined}>
                <FiMail aria-hidden="true" />
                {sending ? 'Sending…' : 'Email me a link'}
              </Button>
            </div>
          </Stack>
        </form>
        <Notice>
          <p>
            New to Bonsai? <TextLink href="/#contact">Start a project</TextLink> and we will set up your portal.
          </p>
        </Notice>
      </Stack>
    </Column>
  );
}

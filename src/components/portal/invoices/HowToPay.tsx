'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { QRCodeSVG } from 'qrcode.react';
import { FiCheck, FiChevronRight, FiCopy } from 'react-icons/fi';
import {
  Button,
  DURATION,
  ease,
  focusRing,
  H3,
  Meta,
  space,
  Stack,
  Text,
  tint,
  type,
  VisuallyHidden,
} from '@/components/portal/ui';
import { METHOD_DETAILS, METHOD_LABELS, paymentDetails, type PaymentDetail } from './labels';
import { sansHeading } from './parts';
import type { PaymentMethodView } from './types';

const Methods = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${space[5]};

  > li + li {
    padding-top: ${space[5]};
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  }

  h4 {
    ${type.label}
    ${sansHeading}
  }
`;

const Details = styled.ul`
  list-style: none;
  margin: ${space[3]} 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${space[3]};

  > li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${space[3]};
    min-width: 0;
  }

  > li > div {
    display: flex;
    flex-direction: column;
    gap: ${space[1]};
    min-width: 0;
  }
`;

const DetailLabel = styled.span`
  ${type.meta}
`;

// Addresses and account numbers: tabular, slashed zeros, and selectable in one go
const DetailValue = styled.span`
  ${type.body}
  font-variant-numeric: tabular-nums slashed-zero;
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
  word-break: break-word;
  user-select: all;
`;

// A sentence such as "We send bank details with your invoice": read, not copied
const Prose = styled.span`
  ${type.body}
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
`;

const CopyButton = styled(Button)`
  flex-shrink: 0;

  @media (pointer: coarse) {
    min-height: 2.75rem;
  }
`;

const QrDisclosure = styled.details`
  margin-top: ${space[3]};

  > summary {
    display: inline-flex;
    align-items: center;
    gap: ${space[2]};
    min-height: 2.75rem;
    list-style: none;
    ${type.meta}
    font-weight: 500;
    color: ${({ theme }) => theme.colors.primary};
    ${focusRing}

    &::-webkit-details-marker {
      display: none;
    }

    svg {
      transition: transform ${DURATION.state}s ${ease};
    }
  }

  &[open] > summary svg {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    > summary svg {
      transition: none;
    }
  }
`;

const QrFrame = styled.div`
  display: inline-flex;
  margin-top: ${space[2]};
  padding: ${space[2]};
  background: ${({ theme }) => theme.colors.text};

  svg {
    display: block;
    width: 10rem;
    height: 10rem;
  }
`;

// Copies with the Clipboard API, falling back to a hidden selection where it is unavailable
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Permission denied or an insecure page: try the older way below
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

/*
 * Worth a Copy button: a "Label: value" line, or a value that is one token (an address, an
 * email, a handle, an account number) or a number grouped with spaces (a phone or routing
 * number). Anything else is an instruction in words.
 */
function isCopyable(detail: PaymentDetail): boolean {
  if (detail.label) return true;
  return /^\S+$/.test(detail.value) || (/\d/.test(detail.value) && /^[\d\s+().-]+$/.test(detail.value));
}

function Detail({ detail, noun, onResult }: { detail: PaymentDetail; noun: string; onResult: (text: string) => void }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const what = detail.label ? detail.label.toLocaleLowerCase('en-US') : noun;

  if (!isCopyable(detail)) {
    return (
      <li>
        <Prose>{detail.value}</Prose>
      </li>
    );
  }

  return (
    <li>
      <div>
        {detail.label && <DetailLabel>{detail.label}</DetailLabel>}
        <DetailValue>{detail.value}</DetailValue>
      </div>
      <CopyButton
        $variant="secondary"
        $size="sm"
        data-print-hide
        onClick={async () => {
          const ok = await copyText(detail.value);
          onResult(ok ? `Copied the ${what}.` : `Couldn't copy the ${what}. Select it and copy it instead.`);
          if (!ok) return;
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy'}
        <VisuallyHidden> {what}</VisuallyHidden>
      </CopyButton>
    </li>
  );
}

// The detail a wallet scans: the line labelled as an address, else the first line
function walletAddress(details: PaymentDetail[]): string | null {
  const address = details.find((detail) => !detail.label || /address|wallet/i.test(detail.label)) ?? details[0];
  return address?.value ?? null;
}

function QrCode({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <QrDisclosure data-print-hide>
      <summary>
        <FiChevronRight aria-hidden="true" />
        Show a QR code for the {label} address
      </summary>
      <QrFrame>
        {/* Dark modules on bone: the contrast every wallet's scanner expects */}
        <QRCodeSVG value={value} size={160} marginSize={1} bgColor={theme.colors.text} fgColor={theme.colors.background} title={`QR code for the ${label} address`} />
      </QrFrame>
    </QrDisclosure>
  );
}

interface HowToPayProps {
  methods: PaymentMethodView[];
  // Shown as the reference to include, so the studio can match the payment
  invoiceNumber?: string;
  // Studio previews say whose view this is
  note?: React.ReactNode;
}

export function HowToPay({ methods, invoiceNumber, note }: HowToPayProps) {
  const headingId = useId();
  // The same words twice still get read: the key alternates a trailing space
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 });

  return (
    <Stack as="section" $gap={4} aria-labelledby={headingId}>
      <Stack $gap={2}>
        <H3 id={headingId}>How to pay</H3>
        {note}
        {methods.length > 0 && invoiceNumber && <Meta>Please include {invoiceNumber} with your payment, so we can match it.</Meta>}
      </Stack>
      {methods.length === 0 ? (
        <Text $muted>We&apos;ll send payment details with your invoice.</Text>
      ) : (
        <Methods>
          {methods.map((method) => {
            const details = paymentDetails(method.instructions);
            const info = METHOD_DETAILS[method.method];
            const address = info.crypto ? walletAddress(details) : null;
            return (
              <li key={method.method}>
                <h4>{METHOD_LABELS[method.method]}</h4>
                <Details>
                  {details.map((detail, index) => (
                    <Detail
                      key={`${index}:${detail.value}`}
                      detail={detail}
                      noun={info.noun}
                      onResult={(text) => setAnnouncement((current) => ({ text, count: current.count + 1 }))}
                    />
                  ))}
                </Details>
                {address && <QrCode value={address} label={METHOD_LABELS[method.method]} />}
              </li>
            );
          })}
        </Methods>
      )}
      <VisuallyHidden role="status" aria-live="polite">
        {announcement.text}
        {announcement.count % 2 ? ' ' : ''}
      </VisuallyHidden>
    </Stack>
  );
}

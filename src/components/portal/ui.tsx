'use client';

import styled, { css } from 'styled-components';
import { Container } from '../layout/Container';
import { DUR, EASE_OUT } from '@/lib/motion';

export const ease = `cubic-bezier(${EASE_OUT.join(', ')})`;

// A theme colour at some strength, as the footer and work index write their hairlines
export const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

export const STUDIO_EMAIL = 'admin@bonsaiwebdesign.com';

export const focusRing = css`
  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

// Tracked capitals in Jost, as on the header, footer and contact form
export const caps = css`
  font-family: ${({ theme }) => theme.fonts.caps};
  font-weight: 400;
  text-transform: uppercase;
`;

export const PortalPage = styled(Container)`
  padding-top: ${({ theme }) => theme.spacing.xxl};
  padding-bottom: ${({ theme }) => theme.spacing.xxxl};

  @media (max-width: 768px) {
    padding-bottom: ${({ theme }) => theme.spacing.xxl};
  }
`;

// Single-column pages: sign-in and the link confirmation
export const NarrowColumn = styled.div`
  max-width: 32.5rem;
  padding-top: ${({ theme }) => theme.spacing.xl};

  @media (min-width: 768px) {
    padding-top: ${({ theme }) => theme.spacing.xxl};
  }
`;

export const Eyebrow = styled.p`
  ${caps}
  font-size: 0.72rem;
  letter-spacing: 0.3em;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

export const PageTitle = styled.h1`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 3rem;
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: 0.01em;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  em {
    font-style: italic;
    color: ${({ theme }) => theme.colors.primary};
  }

  @media (max-width: 768px) {
    font-size: 2.25rem;
  }
`;

export const Lead = styled.p`
  max-width: 32.5rem;
  font-size: 1.05rem;
  line-height: 1.7;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

// Capitals followed by a fading bronze rule
export const RuleHeading = styled.h2`
  ${caps}
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.md};

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, ${({ theme }) => tint(theme.colors.primary, 40)}, transparent);
  }
`;

const filledButton = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0 1.75rem;
  border: none;
  border-radius: 0;
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.background};
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color ${DUR.hover}s ${ease},
    color ${DUR.hover}s ${ease};

  @media (hover: hover) {
    &:hover {
      background-color: ${({ theme }) => theme.colors.text};
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  ${focusRing}
`;

export const PrimaryButton = styled.button`
  ${filledButton}
`;

export const PrimaryLink = styled.a`
  ${filledButton}
`;

const textAction = css`
  padding: 0;
  border: none;
  background: none;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.95rem;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: underline;
  text-decoration-color: ${({ theme }) => tint(theme.colors.primary, 40)};
  text-decoration-thickness: 1px;
  text-underline-offset: 0.25rem;
  cursor: pointer;
  transition: text-decoration-color ${DUR.state}s ${ease};

  @media (hover: hover) {
    &:hover {
      text-decoration-color: ${({ theme }) => theme.colors.primary};
    }
  }

  ${focusRing}
`;

export const TextButton = styled.button`
  ${textAction}
`;

export const TextLink = styled.a`
  ${textAction}
`;

export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

export const Note = styled.p`
  font-size: 0.9rem;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

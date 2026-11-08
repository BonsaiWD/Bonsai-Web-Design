'use client';

import Link from 'next/link';
import styled, { css } from 'styled-components';
import { DURATION, ease, focusRing, space, tint } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'md' | 'sm';

interface ButtonStyleProps {
  $variant?: ButtonVariant;
  $size?: ButtonSize;
  $block?: boolean;
}

// Sentence case at 15px: inside the portal this replaces the site's uppercase CTA style
const buttonStyles = css<ButtonStyleProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${space[2]};
  width: ${({ $block }) => ($block ? '100%' : 'auto')};
  min-height: ${({ $size }) => ($size === 'sm' ? '2.25rem' : '2.75rem')};
  padding: 0 ${({ $size }) => ($size === 'sm' ? space[3] : space[5])};
  border: 1px solid transparent;
  border-radius: 0;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: ${({ $size }) => ($size === 'sm' ? '0.875rem' : '0.9375rem')};
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.2;
  text-decoration: none;
  white-space: nowrap;
  transition:
    background-color ${DURATION.hover}s ${ease},
    border-color ${DURATION.hover}s ${ease},
    color ${DURATION.hover}s ${ease};
  ${focusRing}

  svg {
    flex-shrink: 0;
    font-size: 1.1em;
  }

  ${({ $variant = 'primary', theme }) => {
    switch ($variant) {
      case 'secondary':
        return css`
          background: transparent;
          border-color: ${tint(theme.colors.primary, 55)};
          color: ${theme.colors.primary};
          @media (hover: hover) {
            &:hover:not([aria-disabled='true']) {
              background: ${tint(theme.colors.primary, 10)};
              border-color: ${theme.colors.primary};
            }
          }
        `;
      case 'quiet':
        return css`
          background: transparent;
          color: ${theme.colors.text};
          @media (hover: hover) {
            &:hover:not([aria-disabled='true']) {
              background: ${tint(theme.colors.primary, 8)};
            }
          }
        `;
      case 'danger':
        return css`
          background: transparent;
          border-color: ${tint(theme.colors.error, 55)};
          color: ${theme.colors.error};
          @media (hover: hover) {
            &:hover:not([aria-disabled='true']) {
              background: ${tint(theme.colors.error, 10)};
              border-color: ${theme.colors.error};
            }
          }
        `;
      default:
        return css`
          background: ${theme.colors.primary};
          color: ${theme.colors.background};
          @media (hover: hover) {
            &:hover:not([aria-disabled='true']) {
              background: color-mix(in srgb, ${theme.colors.primary} 82%, ${theme.colors.text});
            }
          }
        `;
    }
  }}

  /* Pending or unavailable: the label says why, at full contrast */
  &[aria-disabled='true'] {
    background-image: repeating-linear-gradient(
      -45deg,
      transparent 0 6px,
      ${({ theme }) => tint(theme.colors.background, 14)} 6px 12px
    );
  }
`;

export const Button = styled.button.attrs<ButtonStyleProps>((props) => ({
  type: props.type ?? 'button',
}))<ButtonStyleProps>`
  ${buttonStyles}
`;

// A link that looks like a button (navigation, downloads)
export const ButtonLink = styled(Link)<ButtonStyleProps>`
  ${buttonStyles}
`;

// For downloads and external links that should not go through the Next router
export const ButtonAnchor = styled.a<ButtonStyleProps>`
  ${buttonStyles}
`;

// A square 44px icon button; always give it an aria-label
export const IconButton = styled.button.attrs((props) => ({ type: props.type ?? 'button' }))`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 25)};
  background: transparent;
  color: ${({ theme }) => theme.colors.text};
  font-size: 1.125rem;
  transition:
    background-color ${DURATION.hover}s ${ease},
    border-color ${DURATION.hover}s ${ease};
  ${focusRing}

  @media (hover: hover) {
    &:hover:not([aria-disabled='true']) {
      background: ${({ theme }) => tint(theme.colors.primary, 8)};
      border-color: ${({ theme }) => tint(theme.colors.primary, 55)};
    }
  }

  &[aria-disabled='true'] {
    opacity: 0.45;
  }
`;

const textAction = css`
  display: inline;
  padding: 0;
  border: none;
  background: none;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: inherit;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: underline;
  text-decoration-color: ${({ theme }) => tint(theme.colors.primary, 45)};
  text-decoration-thickness: 1px;
  text-underline-offset: 0.2em;
  transition: text-decoration-color ${DURATION.state}s ${ease};
  ${focusRing}

  @media (hover: hover) {
    &:hover {
      text-decoration-color: ${({ theme }) => theme.colors.primary};
    }
  }
`;

export const TextButton = styled.button.attrs((props) => ({ type: props.type ?? 'button' }))`
  ${textAction}
`;

export const TextLink = styled(Link)`
  ${textAction}
`;

export const TextAnchor = styled.a`
  ${textAction}
`;

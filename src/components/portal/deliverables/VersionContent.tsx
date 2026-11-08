'use client';

import styled from 'styled-components';
import { FiArrowUpRight, FiDownload, FiExternalLink, FiEye, FiFileText } from 'react-icons/fi';
import { ButtonAnchor, DURATION, ease, focusRing, PHONE, space, tint, type, VisuallyHidden } from '@/components/portal/ui';
import { formatBytes, linkHost, linkLabel } from './copy';
import type { VersionView } from './types';

const Plate = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 20)};
  background: ${({ theme }) => tint(theme.colors.background, 55)};

  > * + * {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  }
`;

const Icon = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, 25)};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 1.125rem;
`;

const Body = styled.span`
  display: flex;
  flex-direction: column;
  gap: ${space[1]};
  flex: 1 1 auto;
  min-width: 0;

  strong {
    ${type.label}
    overflow-wrap: anywhere;
  }

  small {
    ${type.meta}
    ${type.figures}
    overflow-wrap: anywhere;
  }
`;

// The whole row is the link: a large target, with where it goes written underneath
const LinkRow = styled.a`
  display: flex;
  align-items: center;
  gap: ${space[4]};
  padding: ${space[4]} ${space[5]};
  color: ${({ theme }) => theme.colors.text};
  text-decoration: none;
  transition: background-color ${DURATION.hover}s ${ease};
  ${focusRing}

  &:focus-visible {
    outline-offset: -2px;
  }

  > svg {
    flex-shrink: 0;
    font-size: 1.25rem;
    color: ${({ theme }) => theme.colors.primary};
    transition: transform ${DURATION.hover}s ${ease};
  }

  @media (hover: hover) {
    &:hover {
      background: ${({ theme }) => tint(theme.colors.primary, 8)};
    }

    &:hover > svg {
      transform: translate(2px, -2px);
    }
  }

  @media (max-width: ${PHONE}) {
    padding: ${space[4]};
  }

  @media (prefers-reduced-motion: reduce) {
    > svg {
      transition: none;
    }
  }
`;

const FileRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space[3]} ${space[4]};
  padding: ${space[4]} ${space[5]};

  > div:first-child {
    display: flex;
    align-items: center;
    gap: ${space[4]};
    flex: 1 1 16rem;
    min-width: 0;
  }

  > [role='group'] {
    display: flex;
    flex-wrap: wrap;
    gap: ${space[2]};
  }

  @media (max-width: ${PHONE}) {
    padding: ${space[4]};

    > [role='group'] {
      width: 100%;
    }

    > [role='group'] a {
      flex: 1 1 0;
    }
  }
`;

export const fileHref = (fileId: string, inline = false) => `/api/portal/files/${fileId}${inline ? '?inline=1' : ''}`;

// What this version is: its link, its file, or both
export function VersionContent({ version }: { version: Pick<VersionView, 'version' | 'linkUrl' | 'file'> }) {
  if (!version.linkUrl && !version.file) return null;
  return (
    <Plate>
      {version.linkUrl && (
        <LinkRow href={version.linkUrl} target="_blank" rel="noopener noreferrer">
          <Icon aria-hidden="true">
            <FiExternalLink />
          </Icon>
          <Body>
            <strong>
              {linkLabel(version.linkUrl)}
              <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
            </strong>
            <small>
              Version {version.version} on {linkHost(version.linkUrl)}
            </small>
          </Body>
          <FiArrowUpRight aria-hidden="true" />
        </LinkRow>
      )}
      {version.file && (
        <FileRow>
          <div>
            <Icon aria-hidden="true">
              <FiFileText />
            </Icon>
            <Body>
              <strong>{version.file.filename}</strong>
              <small>{formatBytes(version.file.sizeBytes)}</small>
            </Body>
          </div>
          <div role="group" aria-label={`${version.file.filename}`}>
            {version.file.previewable && (
              <ButtonAnchor href={fileHref(version.file.id, true)} target="_blank" rel="noopener noreferrer" $variant="quiet">
                <FiEye aria-hidden="true" />
                Preview
                <VisuallyHidden> {version.file.filename} (opens in a new tab)</VisuallyHidden>
              </ButtonAnchor>
            )}
            <ButtonAnchor href={fileHref(version.file.id)} $variant="secondary">
              <FiDownload aria-hidden="true" />
              Download
              <VisuallyHidden> {version.file.filename}</VisuallyHidden>
            </ButtonAnchor>
          </div>
        </FileRow>
      )}
    </Plate>
  );
}

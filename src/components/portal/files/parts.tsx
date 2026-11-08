'use client';

import { useState } from 'react';
import styled from 'styled-components';
import { FiArchive, FiDownload, FiEye, FiFileText, FiImage } from 'react-icons/fi';
import { ButtonAnchor, PHONE, space, tint, VisuallyHidden } from '@/components/portal/ui';

// A new id each time a form mounts (each dialog opening), so a second submit of the same
// opening is recognised by the server and adds nothing twice
export function FreshId({ name }: { name: string }) {
  const [id] = useState(() => crypto.randomUUID());
  return <input type="hidden" name={name} value={id} />;
}

// Downloads go through the authorising route; ?inline=1 opens PDFs and images in the browser
export const fileHref = (fileId: string, inline = false) => `/api/portal/files/${fileId}${inline ? '?inline=1' : ''}`;

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

// A square bronze-ruled tile with an icon for the kind of file
export const GlyphTile = styled.span`
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

export function FileGlyph({ filename }: { filename: string }) {
  const extension = extensionOf(filename);
  return (
    <GlyphTile aria-hidden="true">{IMAGE.has(extension) ? <FiImage /> : extension === 'zip' ? <FiArchive /> : <FiFileText />}</GlyphTile>
  );
}

const Group = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${space[2]};

  @media (max-width: ${PHONE}) {
    flex-wrap: nowrap;
    width: 100%;

    > a {
      flex: 1 1 0;
    }
  }
`;

// Preview (for PDFs and images, in a new tab) and Download, named for the file they act on
export function FileButtons({ fileId, filename, previewable }: { fileId: string; filename: string; previewable: boolean }) {
  return (
    <Group role="group" aria-label={filename}>
      {previewable && (
        <ButtonAnchor href={fileHref(fileId, true)} target="_blank" rel="noopener noreferrer" $variant="quiet">
          <FiEye aria-hidden="true" />
          Preview
          <VisuallyHidden> {filename} (opens in a new tab)</VisuallyHidden>
        </ButtonAnchor>
      )}
      <ButtonAnchor href={fileHref(fileId)} $variant="secondary">
        <FiDownload aria-hidden="true" />
        Download
        <VisuallyHidden> {filename}</VisuallyHidden>
      </ButtonAnchor>
    </Group>
  );
}

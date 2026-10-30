'use client';

import styled from 'styled-components';

/* ---------- Enso ring: the shared visual motif ---------- */

const EnsoSvg = styled.svg`
  display: block;
  color: ${({ theme }) => theme.colors.primary};
  overflow: visible;
`;

export default function Enso({ rotate = 0, className }: { rotate?: number; className?: string }) {
  return (
    <EnsoSvg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <circle
        cx="100"
        cy="100"
        r="80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeDasharray="430 73"
        transform={`rotate(${rotate} 100 100)`}
      />
    </EnsoSvg>
  );
}

'use client';

import styled from 'styled-components';

// Separates meta items; inline-block so it also renders outside a flex parent
const MetaDot = styled.span`
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  width: 0.25rem;
  height: 0.25rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  opacity: 0.6;
`;

export default MetaDot;

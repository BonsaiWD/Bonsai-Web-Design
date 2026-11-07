'use client';

import styled from 'styled-components';

// Hollow node on the bronze branch line; parents fill it on hover or to mark a state
const BranchNode = styled.span`
  position: relative;
  z-index: 1;
  width: 0.6875rem;
  height: 0.6875rem;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.background};
  transition: ${({ theme }) => theme.transitions.default};
`;

export default BranchNode;

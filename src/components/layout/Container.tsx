'use client';

import styled from 'styled-components';

export const Container = styled.div`
  width: 100%;
  /* The wide breakpoint (1440px) at the base size, growing with it on large monitors */
  max-width: 90rem;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing.md};

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;

export const Section = styled.section`
  padding: ${({ theme }) => theme.spacing.xxl} 0;
  position: relative;
  overflow: clip;
`;

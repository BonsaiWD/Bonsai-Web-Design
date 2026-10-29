'use client';

import styled from 'styled-components';
import { Container } from './Container';
import { SiBitcoin, SiMonero, SiLitecoin, SiVenmo, SiZelle } from 'react-icons/si';
import { BsBank } from 'react-icons/bs';

const FooterWrapper = styled.footer`
  background-color: ${({ theme }) => theme.colors.secondary};
  color: ${({ theme }) => theme.colors.background};
  padding: ${({ theme }) => theme.spacing.xxl} 0;
`;

const FooterContent = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.xl};

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    /* minmax(0, 1fr): a plain 1fr track will not shrink below its content, so the
       unwrappable payment-icon row pushed the page wider than 768–786px viewports */
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const FooterColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const FooterTitle = styled.h3`
  color: ${({ theme }) => theme.colors.gold};
  font-size: 1.2rem;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const FooterLink = styled.a`
  color: rgba(255, 255, 255, 0.8);
  transition: color 0.3s ease;
  position: relative;
  display: inline-block;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 100%;
    height: 2px;
    background: ${({ theme }) => theme.colors.gold};
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  &:hover {
    color: ${({ theme }) => theme.colors.gold};
    
    &::after {
      transform: scaleX(1);
    }
  }
`;

const PaymentIcons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.sm};
  font-size: 1.8rem; // Increased base size
  color: rgba(255, 255, 255, 0.6);
  align-items: center; // Ensure vertical alignment
`;

const Copyright = styled.div`
  margin-top: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.9rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: ${({ theme }) => theme.spacing.lg};
`;

export default function Footer() {
  return (
    <FooterWrapper>
      <Container>
        <FooterContent>
          <FooterColumn>
            <FooterTitle>Bonsai Web Design</FooterTitle>
            <p style={{ color: 'rgba(255,255,255,0.8)' }}>
              Crafting timeless design and meaningful content for modern brands.
            </p>
          </FooterColumn>
          <FooterColumn>
            <FooterTitle>Contact</FooterTitle>
            <FooterLink href="mailto:admin@bonsaiwebdesign.com">
              admin@bonsaiwebdesign.com
            </FooterLink>
          </FooterColumn>
          <FooterColumn>
            <FooterTitle>Accepted Payments</FooterTitle>
            <PaymentIcons>
              <SiBitcoin title="Bitcoin" />
              <SiMonero title="Monero" />
              <SiLitecoin title="Litecoin" />
              <SiZelle title="Zelle" style={{ fontSize: '2rem' }} />
              <BsBank title="ACH Bank Transfer" style={{ fontSize: '1.8rem' }} />
              <SiVenmo title="Venmo" style={{ fontSize: '2.4rem' }} /> {/* Increased size for visibility */}
            </PaymentIcons>
          </FooterColumn>
        </FooterContent>
        <Copyright>
          &copy; {new Date().getFullYear()} Bonsai Web Design. All rights reserved.
        </Copyright>
      </Container>
    </FooterWrapper>
  );
}

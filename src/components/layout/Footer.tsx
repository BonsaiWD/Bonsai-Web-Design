'use client';

import styled, { css } from 'styled-components';
import type { IconType } from 'react-icons';
import { Container } from './Container';
import { SiBitcoin, SiMonero, SiLitecoin, SiVenmo, SiZelle } from 'react-icons/si';
import { BsBank } from 'react-icons/bs';
import { DUR, EASE_OUT } from '@/lib/motion';

/*
 * The footer, refined to match the hero (owner's request, 2026-10-30): it sits
 * on the page's own dark ground rather than a lighter slab, set apart by a
 * bronze hairline that fades out at both ends, like the one under the hero's
 * button, with a faint bronze light falling from it. The name is the header's
 * wordmark, the labels are tracked Jost capitals in bronze, as in the contact
 * form, and the payment marks stay quiet.
 */

const ease = `cubic-bezier(${EASE_OUT.join(', ')})`;

// A theme colour at some strength, for hairlines that follow whichever palette is in use
const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

// A bronze hairline that fades out at both ends, at a given strength (%)
const hairline = (strength: number) => css`
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    ${({ theme }) => tint(theme.colors.primary, strength)} 20% 80%,
    transparent
  );
`;

const focusRing = css`
  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

const FooterWrapper = styled.footer`
  position: relative;
  padding: 88px 0 48px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background:
    radial-gradient(50% 160px at 50% 0, rgba(200, 159, 129, 0.08), transparent),
    ${({ theme }) => theme.colors.background};

  /* The hairline across its top, the one strong line that sets the footer apart */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    ${hairline(45)}
  }

  @media (max-width: 768px) {
    padding: 64px 0 40px;
  }
`;

// Centred on phones; three columns from tablets up
const FooterContent = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  text-align: center;

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    /* minmax(0, 1fr): a plain 1fr track will not shrink below its content, so the
       unwrappable payment-icon row pushed the page wider than 768–786px viewports */
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 48px;
    text-align: left;
  }
`;

// The header's wordmark, with "Web Design" set under it in small tracked capitals
const Wordmark = styled.p`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.6rem;
  line-height: 1;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 18px;

  span {
    display: block;
    margin-top: 8px;
    font-family: ${({ theme }) => theme.fonts.caps};
    font-size: 0.66rem;
    letter-spacing: 0.34em;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Tagline = styled.p`
  max-width: 30ch;
  line-height: 1.7;
  margin: 0 auto;

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    margin: 0;
  }
`;

const Label = styled.h2`
  font-family: ${({ theme }) => theme.fonts.caps};
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 16px;
`;

// The address in the ink, with a bronze hairline that draws across under it on hover
const MailLink = styled.a`
  position: relative;
  display: inline-block;
  padding-bottom: 4px;
  color: ${({ theme }) => theme.colors.text};
  transition: color ${DUR.hover}s ${ease};

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: ${({ theme }) => theme.colors.primary};
    transform: scaleX(0);
    transform-origin: left;
    transition: transform ${DUR.state}s ${ease};
  }

  /* Touch screens keep :hover after a tap, so only devices that can hover get it */
  @media (hover: hover) {
    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }

    &:hover::after {
      transform: scaleX(1);
    }
  }

  ${focusRing}
`;

// The marks, evened out by eye: the wordmark and the letterform are drawn smaller in their boxes
const PAYMENTS: { name: string; Icon: IconType; scale: number }[] = [
  { name: 'Bitcoin', Icon: SiBitcoin, scale: 1 },
  { name: 'Monero', Icon: SiMonero, scale: 1 },
  { name: 'Litecoin', Icon: SiLitecoin, scale: 1 },
  { name: 'Zelle', Icon: SiZelle, scale: 1.1 },
  { name: 'ACH Bank Transfer', Icon: BsBank, scale: 0.95 },
  { name: 'Venmo', Icon: SiVenmo, scale: 1.35 },
];

const Payments = styled.ul`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 14px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 1.5rem;
  color: ${({ theme }) => tint(theme.colors.text, 55)};

  li {
    display: flex;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    justify-content: flex-start;
  }
`;

const Bottom = styled.div`
  margin-top: 64px;

  /* A quieter divider than the footer's top edge, in the range of the site's other row dividers */
  &::before {
    content: '';
    display: block;
    margin-bottom: 24px;
    ${hairline(18)}
  }

  @media (max-width: 768px) {
    margin-top: 48px;
  }
`;

const Copyright = styled.p`
  margin: 0;
  text-align: center;
  text-wrap: balance;
  font-family: ${({ theme }) => theme.fonts.caps};
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${({ theme }) => tint(theme.colors.textSecondary, 80)};
`;

export default function Footer() {
  return (
    <FooterWrapper>
      <Container>
        <FooterContent>
          <div>
            <Wordmark>
              Bonsai <span>Web Design</span>
            </Wordmark>
            <Tagline>Crafting timeless design and meaningful content for modern brands.</Tagline>
          </div>
          <div>
            <Label>Contact</Label>
            <MailLink href="mailto:admin@bonsaiwebdesign.com">admin@bonsaiwebdesign.com</MailLink>
          </div>
          <div>
            <Label>Accepted Payments</Label>
            <Payments aria-label="Accepted payments">
              {PAYMENTS.map(({ name, Icon, scale }) => (
                <li key={name}>
                  <Icon role="img" title={name} size={`${scale}em`} />
                </li>
              ))}
            </Payments>
          </div>
        </FooterContent>
        <Bottom>
          <Copyright>&copy; {new Date().getFullYear()} Bonsai Web Design. All rights reserved.</Copyright>
        </Bottom>
      </Container>
    </FooterWrapper>
  );
}

'use client';

import styled, { css } from 'styled-components';
import { Container } from './Container';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { DUR, EASE_OUT } from '@/lib/motion';
import { frostedGlass } from '@/styles/frosted';

const EASE = `cubic-bezier(${EASE_OUT.join(', ')})`;

const focusRing = css`
  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

const HeaderWrapper = styled.header<{ $hidden: boolean; $scrolled: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  /* Above the mobile menu overlay, so the logo and close button stay visible */
  z-index: 1002;
  padding: ${({ theme }) => theme.spacing.lg} 0;
  transform: translateY(${({ $hidden }) => ($hidden ? '-100%' : '0')});
  background-color: ${({ $scrolled, theme }) =>
    $scrolled ? `color-mix(in srgb, ${theme.colors.background} 86%, transparent)` : 'transparent'};
  border-bottom: 1px solid ${({ $scrolled }) => ($scrolled ? 'rgba(200, 159, 129, 0.12)' : 'transparent')};
  transition:
    transform 0.3s ease-in-out,
    background-color ${DUR.state}s ${EASE},
    border-color ${DUR.state}s ${EASE};

  @media (prefers-reduced-motion: reduce) {
    transition:
      background-color ${DUR.state}s ${EASE},
      border-color ${DUR.state}s ${EASE};
  }

  /* Never keep the bar off-screen while a keyboard user is focused inside it */
  &:has(:focus-visible) {
    transform: none;
  }
`;

const Nav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Logo = styled(Link)`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.colors.text};
  text-transform: uppercase;
  line-height: 1;
  position: relative;
  /* A lockup: the two lines centred on each other, each indented by the letter-spacing that trails it */
  display: inline-block;
  text-align: center;
  text-indent: 0.05em;
  /* Override GlobalStyle's a { transition: all } so the focus ring appears at once */
  transition: none;
  ${focusRing}

  /* "Web Design" set under the wordmark in small tracked bronze capitals, as in the footer (owner, 2026-10-31).
     Letter-spacing also trails the last letter, so the indent gives it back and the line sits centred. */
  span {
    display: block;
    margin-top: 6px;
    padding-left: 0.34em;
    text-indent: 0;
    font-family: ${({ theme }) => theme.fonts.caps};
    font-size: 0.58rem;
    letter-spacing: 0.34em;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const NavLinks = styled.div`
  display: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    display: flex;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.desktop}) {
    gap: ${({ theme }) => theme.spacing.xl};
  }
`;

const NavLink = styled(Link)<{ $wideOnly?: boolean }>`
  font-family: ${({ theme }) => theme.fonts.caps};
  font-size: 0.9rem;
  font-weight: 300;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  position: relative;
  transition: color ${DUR.state}s ${EASE};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    width: 100%;
    height: 1px;
    background-color: ${({ theme }) => theme.colors.primary};
    transform: scaleX(0);
    transition: transform ${DUR.state}s ${EASE};
  }

  &:hover::after {
    transform: scaleX(1);
  }

  ${focusRing}

  /* Between tablet and desktop the CTA covers #contact, which makes room for it */
  ${({ $wideOnly, theme }) =>
    $wideOnly &&
    css`
      display: none;

      @media (min-width: ${theme.breakpoints.desktop}) {
        display: inline;
      }
    `}
`;

const HeaderCta = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  margin-left: ${({ theme }) => theme.spacing.sm};
  border-radius: 0;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  ${frostedGlass}

  ${focusRing}

  @media (min-width: ${({ theme }) => theme.breakpoints.desktop}) {
    padding: 0 20px;
    margin-left: 0;
  }
`;

const MobileMenuButton = styled.button`
  display: block;
  color: ${({ theme }) => theme.colors.text};
  font-size: 1.5rem;
  background: none;
  position: relative;
  cursor: pointer;
  ${focusRing}

  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    display: none;
  }
`;

const MobileMenuOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    180deg,
    rgba(16, 32, 24, 0.98) 0%,
    rgba(20, 40, 30, 0.98) 50%,
    rgba(16, 32, 24, 0.98) 100%
  );
  backdrop-filter: blur(10px);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xl};
`;

const MobileNavLink = styled(motion.a)`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 2rem;
  font-weight: 300;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  ${focusRing}
`;

const MobileCta = styled(motion.a)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 ${({ theme }) => theme.spacing.xl};
  border-radius: 0;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  ${frostedGlass}

  ${focusRing}
`;

const navItems = [
  { href: '#portfolio', label: 'Projects', delay: 0.05 },
  { href: '#about', label: 'About', delay: 0.1 },
  { href: '#services', label: 'Services', delay: 0.15 },
  { href: '#pricing', label: 'Pricing', delay: 0.175 },
  { href: '#contact', label: 'Contact', delay: 0.25 },
];

const CTA = { href: '#contact', label: 'Plant your project', delay: 0.3 };

export default function Header() {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  // Scroll position below which the viewport still counts as "inside the hero".
  // The header never hides there, so a pinned hero runway keeps its CTA visible.
  const heroLimit = useRef(0);
  const measureHero = useCallback(() => {
    const hero = document.getElementById('hero');
    heroLimit.current = hero ? hero.offsetTop + hero.offsetHeight - window.innerHeight * 0.5 : 0;
  }, []);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    measureHero();
    const previous = scrollY.getPrevious() ?? 0;
    const inHero = latest < heroLimit.current;
    setScrolled(latest > 24);
    setHidden(!inHero && latest > previous && latest > 150);
  });

  useEffect(() => {
    const onResize = () => {
      measureHero();
      if (window.scrollY < heroLimit.current) setHidden(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measureHero]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // While the full-screen menu is open, the page behind it is inert (out of the
  // tab order and hidden from assistive tech), and Escape closes the menu and
  // returns focus to the menu button.
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const behind = Array.from(document.querySelectorAll<HTMLElement>('main, footer'));
    behind.forEach((el) => {
      el.inert = true;
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMobileMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      behind.forEach((el) => {
        el.inert = false;
      });
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen]);

  // Keyboard focus must never sit under the bar. When Tab or Shift+Tab lands on
  // a control that is technically in view but covered by the header, the
  // browser does not scroll, so nudge the page until the control clears it.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let frame = 0;
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement) || !target.matches(':focus-visible')) return;
      cancelAnimationFrame(frame);
      // Measure after the browser's own focus scroll has run
      frame = requestAnimationFrame(() => {
        const header = headerRef.current;
        if (!header || header.contains(target)) return;
        const bar = header.getBoundingClientRect();
        if (bar.bottom <= 0) return; // the bar is slid out of view
        const box = target.getBoundingClientRect();
        const gap = 16;
        if (box.top < bar.bottom + gap && box.bottom > 0) {
          window.scrollBy({ top: box.top - bar.bottom - gap, behavior: 'instant' });
        }
      });
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      cancelAnimationFrame(frame);
    };
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleMobileNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMobileMenuOpen(false);
    // Smooth scroll to section (instant when the reader prefers reduced motion)
    const element = document.querySelector(href);
    if (element) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  return (
    <>
      <HeaderWrapper ref={headerRef} $hidden={hidden} $scrolled={scrolled}>
        <Container>
          <Nav>
            <Logo href="/">
              Bonsai <span>Web Design</span>
            </Logo>
            <NavLinks>
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} $wideOnly={item.href === CTA.href}>
                  {item.label}
                </NavLink>
              ))}
              <HeaderCta href={CTA.href}>{CTA.label}</HeaderCta>
            </NavLinks>
            <MobileMenuButton
              ref={menuButtonRef}
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
              onClick={toggleMobileMenu}
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </MobileMenuButton>
          </Nav>
        </Container>
      </HeaderWrapper>

      <AnimatePresence>
        {mobileMenuOpen && (
          <MobileMenuOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setMobileMenuOpen(false)}
          >
            {navItems.map((item) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, delay: item.delay }}
              >
                <MobileNavLink href={item.href} onClick={(e) => handleMobileNavClick(e, item.href)}>
                  {item.label}
                </MobileNavLink>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, delay: CTA.delay }}
            >
              <MobileCta href={CTA.href} onClick={(e) => handleMobileNavClick(e, CTA.href)}>
                {CTA.label}
              </MobileCta>
            </motion.div>
          </MobileMenuOverlay>
        )}
      </AnimatePresence>
    </>
  );
}

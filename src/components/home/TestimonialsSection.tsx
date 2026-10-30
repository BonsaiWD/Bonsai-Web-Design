'use client';

import styled from 'styled-components';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Section, Container } from '../layout/Container';
import GradientText from '../common/GradientText';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';

const testimonials = [
  {
    id: 1,
    name: 'Nick Jabbour',
    role: 'Founder, RxChat.com',
    content:
      "Not a day goes by where I don't feel grateful to be working with David. He is not only thorough and skilled, but takes pride in his work and applies himself consistently to the challenges at hand. As an individual, he demonstrates kindness and integrity — and these qualities spill into his professional life as well. For lack of a better term, David is truly a ‘gem’ to know and work with.",
    rating: 5,
  },
  {
    id: 2,
    name: 'Tony',
    role: 'Founder, Palm Breeze Real Estate',
    content:
      'David elevated our online presence with clean, human-centered design across our website, blog and weekly newsletter. The results were both positive and impactful.',
    rating: 5,
  },
  {
    id: 3,
    name: 'Cherie Woodworth',
    role: 'Manager, Weatherford Ranches',
    content:
      'Seamless communication and a thoughtful approach to content. Couldn’t have asked for a better partner!',
    rating: 5,
  },
];

const TestimonialsWrapper = styled(Section)`
  background: linear-gradient(
    180deg,
    rgba(20, 40, 30, 0.3) 0%,
    rgba(16, 32, 24, 0.35) 50%,
    rgba(20, 40, 30, 0.3) 100%
  );
  color: ${({ theme }) => theme.colors.text};
  text-align: center;
  border-top: 1px solid rgba(93, 117, 102, 0.15);
  border-bottom: 1px solid rgba(93, 117, 102, 0.15);
`;

const Carousel = styled.div``;

const CarouselContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  position: relative;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 768px) {
    height: 600px;
  }
`;

const TestimonialCard = styled(motion.div)`
  position: absolute;
  width: 100%;
  padding: ${({ theme }) => theme.spacing.xl};
  perspective: 1000px;

  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

const TestimonialContent = styled(motion.div)`
  transform-style: preserve-3d;
  will-change: transform;
`;

const Quote = styled.p`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.8rem;
  line-height: 1.6;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  font-style: italic;
  color: ${({ theme }) => theme.colors.text};
  font-weight: 300;

  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const Author = styled.div`
  margin-top: ${({ theme }) => theme.spacing.md};
`;

const Name = styled.h4`
  color: ${({ theme }) => theme.colors.gold};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const Role = styled.p`
  font-family: ${({ theme }) => theme.fonts.label};
  font-stretch: 112%;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

const Stars = styled.div`
  color: ${({ theme }) => theme.colors.gold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  font-size: 1.2rem;
`;

const Controls = styled.div`
  /* Above the absolutely positioned card, which overflows the 400px stage on the long first quote */
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

/* Hollow bronze ring that fills when current, like the portfolio BranchNode.
   The 0.7 ring is 4.3:1 on the background (WCAG 1.4.11 needs 3:1), and the
   state reads from fill as well as color. */
const Dot = styled.button<{ $active: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(200, 159, 129, 0.7);
  background-color: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  cursor: pointer;
  transition: background-color 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 3px;
  }
`;

const SectionTitle = styled.h2`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 3rem;
  font-weight: 300;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  letter-spacing: 0.05em;
  text-shadow: 0 2px 8px rgba(200, 159, 129, 0.15);

  @media (max-width: 768px) {
    font-size: 2.25rem;
  }
`;

export default function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  // Announce slide changes only when the reader picked one; autoplay stays silent
  const [announce, setAnnounce] = useState(false);
  const reduce = useReducedMotionSafe();
  const cardRef = useRef<HTMLDivElement>(null);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springConfig = { stiffness: 100, damping: 15 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  // Auto-advance pauses while the carousel is hovered or holds keyboard focus,
  // and is off entirely for readers who prefer reduced motion. Only
  // :focus-visible focus counts, so clicking a dot with the mouse does not
  // leave it paused once the pointer moves away. Every change of slide
  // restarts the 5s wait.
  const paused = hovered || focusWithin;
  useEffect(() => {
    if (reduce || paused) return;
    const timer = setTimeout(() => {
      setAnnounce(false);
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearTimeout(timer);
  }, [reduce, paused, currentIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || reduce) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rotateXValue = ((e.clientY - centerY) / rect.height) * -10;
    const rotateYValue = ((e.clientX - centerX) / rect.width) * 10;

    rotateX.set(rotateXValue);
    rotateY.set(rotateYValue);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <TestimonialsWrapper>
      <Container>
        <SectionTitle><GradientText>Client Stories</GradientText></SectionTitle>
        <Carousel
          onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
          onFocus={(e) => {
            if (e.target.matches(':focus-visible')) setFocusWithin(true);
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
          }}
        >
          <CarouselContainer
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            aria-live={announce ? 'polite' : 'off'}
          >
            <AnimatePresence mode="wait">
              <TestimonialCard
                key={currentIndex}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5 }}
              >
                <TestimonialContent
                  style={{
                    rotateX: reduce ? 0 : springRotateX,
                    rotateY: reduce ? 0 : springRotateY,
                  }}
                >
                  <Stars role="img" aria-label={`Rated ${testimonials[currentIndex].rating} out of 5`}>
                    {'★'.repeat(testimonials[currentIndex].rating)}
                  </Stars>
                  <Quote>&quot;{testimonials[currentIndex].content}&quot;</Quote>
                  <Author>
                    <Name>{testimonials[currentIndex].name}</Name>
                    <Role>{testimonials[currentIndex].role}</Role>
                  </Author>
                </TestimonialContent>
              </TestimonialCard>
            </AnimatePresence>
          </CarouselContainer>
          <Controls role="group" aria-label="Choose a testimonial">
            {testimonials.map((_, index) => (
              <Dot
                key={index}
                type="button"
                $active={index === currentIndex}
                aria-current={index === currentIndex ? 'true' : undefined}
                onClick={() => {
                  setAnnounce(true);
                  setCurrentIndex(index);
                }}
                aria-label={`Show testimonial ${index + 1} of ${testimonials.length}`}
              />
            ))}
          </Controls>
        </Carousel>
      </Container>
    </TestimonialsWrapper>
  );
}

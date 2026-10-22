'use client';

import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCheckmarkCircleOutline } from 'react-icons/io5';

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  /* Above the fixed header (1002) and the mobile menu overlay (1001) */
  z-index: 1003;
  padding: ${({ theme }) => theme.spacing.md};
`;

const ModalContainer = styled(motion.div)`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.gold};
  padding: ${({ theme }) => theme.spacing.xl};
  max-width: 500px;
  width: 100%;
  text-align: center;
  position: relative;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
`;

const IconWrapper = styled.div`
  color: ${({ theme }) => theme.colors.gold};
  font-size: 4rem;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  display: flex;
  justify-content: center;
`;

const Title = styled.h3`
  color: ${({ theme }) => theme.colors.gold};
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 2rem;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const Message = styled.p`
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  line-height: 1.6;
  font-size: 1.1rem;
`;

const Button = styled.button`
  background: ${({ theme }) => theme.colors.gold};
  color: ${({ theme }) => theme.colors.background};
  border: none;
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.xl}`};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
  }
`;

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SuccessModal({ isOpen, onClose }: SuccessModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <Overlay
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <ModalContainer
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <IconWrapper>
                            <IoCheckmarkCircleOutline />
                        </IconWrapper>
                        <Title>Message Sent</Title>
                        <Message>
                            Thank you for reaching out. We have received your inquiry and will get back to you shortly.
                        </Message>
                        <Button onClick={onClose}>Close</Button>
                    </ModalContainer>
                </Overlay>
            )}
        </AnimatePresence>
    );
}

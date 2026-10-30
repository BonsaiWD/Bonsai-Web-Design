'use client';

import styled from 'styled-components';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Section, Container } from '../layout/Container';
import SuccessModal from './SuccessModal';
import MagneticButton from '../common/MagneticButton';

// Validation Schemas
// The max lengths mirror src/app/api/send/route.ts, so an over-long field is
// caught here with a specific message instead of failing on the server.
const step1Schema = z.object({
    name: z.string().min(2, 'Name is required').max(120, 'Please keep your name under 120 characters'),
    email: z.string().email('Invalid email address').max(254, 'That email address is too long'),
    company: z.string().max(200, 'Please keep this under 200 characters').optional(),
});

const step2Schema = z.object({
    projectType: z.string().min(1, 'Please select a project type'),
    budget: z.string().min(1, 'Please select a budget range'),
});

const step3Schema = z.object({
    description: z
        .string()
        .min(10, 'Please tell us more about your project')
        .max(20000, 'Please keep this under 20,000 characters'),
    timeline: z.string().max(200, 'Please keep this under 200 characters').optional(),
});

type FormData = z.infer<typeof step1Schema> & z.infer<typeof step2Schema> & z.infer<typeof step3Schema>;

const WizardWrapper = styled(Section)`
  background: linear-gradient(
    180deg,
    rgba(16, 32, 24, 0.35) 0%,
    rgba(20, 40, 30, 0.25) 50%,
    rgba(16, 32, 24, 0.35) 100%
  );
  min-height: 100vh;
  display: flex;
  align-items: center;
  position: relative;
  
  /* Subtle background pattern for depth */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(circle at 1px 1px, rgba(93, 117, 102, 0.04) 1px, transparent 0);
    background-size: 40px 40px;
    pointer-events: none;
  }
`;

const FormContainer = styled(Container)`
  max-width: 800px;
  position: relative;
  z-index: 1;
`;

const FormCard = styled.div`
  background: rgba(26, 38, 30, 0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(200, 159, 129, 0.1);
  padding: ${({ theme }) => theme.spacing.xxl};
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  
  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.spacing.xl};
  }
`;

const ProgressBar = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, 
      rgba(200, 159, 129, 0.2) 0%,
      rgba(200, 159, 129, 0.1) 50%,
      rgba(200, 159, 129, 0.2) 100%
    );
    z-index: 0;
    transform: translateY(-50%);
  }
`;

const ProgressStep = styled.div<{ $active: boolean; $completed: boolean }>`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: ${({ $active, $completed, theme }) =>
        $active || $completed ? theme.colors.gold : theme.colors.surface};
  border: 2px solid ${({ $active, theme }) =>
        $active ? theme.colors.gold : 'rgba(200, 159, 129, 0.3)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ $active, $completed, theme }) =>
        $active || $completed ? theme.colors.background : theme.colors.gold};
  font-weight: 600;
  font-size: 1.1rem;
  position: relative;
  z-index: 1;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: ${({ $active, $completed }) =>
        $active || $completed ? '0 4px 12px rgba(200, 159, 129, 0.3)' : 'none'};
  transform: ${({ $active }) => $active ? 'scale(1.1)' : 'scale(1)'};
  
  &::before {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: ${({ $active, theme }) =>
        $active ? `radial-gradient(circle, ${theme.colors.gold}20 0%, transparent 70%)` : 'transparent'};
  }
`;

const FormTitle = styled.h2`
  text-align: center;
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 3.5rem;
  font-weight: 300;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.primary};
  letter-spacing: 0.05em;
  text-shadow: 0 2px 12px rgba(200, 159, 129, 0.2);
  
  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const InputGroup = styled.div.attrs({
    suppressHydrationWarning: true,
})`
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  /* Allow hydration mismatches from browser extensions (e.g., LastPass) */
  & * {
    /* This selector helps ensure nested elements inherit the suppression */
  }
`;

const Label = styled.label`
  font-family: ${({ theme }) => theme.fonts.label};
  font-stretch: 112%;
  display: block;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.text};
  font-weight: 500;
  font-size: 0.95rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  opacity: 0.9;
`;

const Input = styled.input.attrs({
    'data-lpignore': 'true',
    'data-form-type': 'other',
    autoComplete: 'off',
    suppressHydrationWarning: true,
})`
  width: 100%;
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  border: 1px solid rgba(200, 159, 129, 0.15);
  border-radius: 0;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.02);
  color: ${({ theme }) => theme.colors.text};
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.gold};
    background: rgba(255, 255, 255, 0.05);
    box-shadow: 0 0 0 3px rgba(200, 159, 129, 0.1),
                0 4px 12px rgba(200, 159, 129, 0.15);
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.5;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  border: 1px solid rgba(200, 159, 129, 0.15);
  border-radius: 0;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 1rem;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  appearance: none;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%23C89F81' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  padding-right: 3rem;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.gold};
    background-color: rgba(255, 255, 255, 0.05);
    box-shadow: 0 0 0 3px rgba(200, 159, 129, 0.1),
                0 4px 12px rgba(200, 159, 129, 0.15);
  }
`;

const TextArea = styled.textarea.attrs({
    'data-lpignore': 'true',
    'data-form-type': 'other',
    suppressHydrationWarning: true,
})`
  width: 100%;
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  border: 1px solid rgba(200, 159, 129, 0.15);
  border-radius: 0;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.02);
  color: ${({ theme }) => theme.colors.text};
  min-height: 150px;
  resize: vertical;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.gold};
    background: rgba(255, 255, 255, 0.05);
    box-shadow: 0 0 0 3px rgba(200, 159, 129, 0.1),
                0 4px 12px rgba(200, 159, 129, 0.15);
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.5;
  }
`;

const ErrorMessage = styled.span`
  color: ${({ theme }) => theme.colors.error};
  font-size: 0.875rem;
  margin-top: 4px;
  display: block;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  font-family: ${({ theme }) => theme.fonts.label};
  font-stretch: 112%;
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.xxl}`};
  background-color: ${({ $variant, theme }) =>
        $variant === 'secondary' ? 'transparent' : theme.colors.gold};
  color: ${({ $variant, theme }) =>
        $variant === 'secondary' ? theme.colors.gold : theme.colors.background};
  border: ${({ $variant, theme }) =>
        $variant === 'secondary' ? `2px solid ${theme.colors.gold}` : 'none'};
  border-radius: 0;
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    transform: translate(-50%, -50%);
    transition: width 0.6s, height 0.6s;
  }

  &:hover::before {
    width: 300px;
    height: 300px;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ $variant }) =>
        $variant !== 'secondary'
            ? `0 8px 24px rgba(200, 159, 129, 0.3)`
            : '0 4px 12px rgba(200, 159, 129, 0.2)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    
    &:hover {
      box-shadow: none;
    }
  }
`;

export default function ContactWizard() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<Partial<FormData>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        trigger,
        getValues,
    } = useForm<FormData>({
        resolver: zodResolver(
            step === 1 ? step1Schema : step === 2 ? step2Schema : step3Schema
        ) as any, // eslint-disable-line
        defaultValues: {
            name: '',
            email: '',
            company: '',
            projectType: '',
            budget: '',
            description: '',
            timeline: '',
            ...formData,
        },
        mode: 'onChange',
        shouldUnregister: false,
    });

    const onNext = async () => {
        const isValid = await trigger();
        if (isValid) {
            // Keep the state updated with values from the current step
            // so we can submit everything correctly at the end.
            const currentValues = getValues();
            setFormData((prev) => ({ ...prev, ...currentValues }));
            setStep((prev) => prev + 1);
        }
    };

    const onPrev = () => {
        setStep((prev) => prev - 1);
    };

    const onSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Get all values directly from the form hook to ensure we have
            // the absolute latest data from all steps
            const finalData = getValues();
            const response = await fetch('/api/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(finalData),
            });

            if (response.ok) {
                setShowSuccessModal(true);
                // Optional: Reset form or redirect
            } else {
                throw new Error('Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Something went wrong. Please try again later.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <WizardWrapper id="contact">
            <FormContainer>
                <FormCard>
                    <FormTitle>Start Your Journey</FormTitle>

                    <ProgressBar>
                        {[1, 2, 3].map((s) => (
                            <ProgressStep key={s} $active={step === s} $completed={step > s}>
                                {s}
                            </ProgressStep>
                        ))}
                    </ProgressBar>

                    <form onSubmit={handleSubmit(onSubmit)}>
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <InputGroup>
                                        <Label>Name</Label>
                                        <Input {...register('name')} placeholder="John Doe" />
                                        {errors.name && <ErrorMessage>{errors.name.message}</ErrorMessage>}
                                    </InputGroup>
                                    <InputGroup>
                                        <Label>Email</Label>
                                        <Input {...register('email')} placeholder="john@example.com" />
                                        {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
                                    </InputGroup>
                                    <InputGroup>
                                        <Label>Company (Optional)</Label>
                                        <Input {...register('company')} placeholder="Your Company Ltd." />
                                        {errors.company && <ErrorMessage>{errors.company.message}</ErrorMessage>}
                                    </InputGroup>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <InputGroup>
                                        <Label>Project Type</Label>
                                        <Select {...register('projectType')}>
                                            <option value="">Select a type...</option>
                                            <option value="website">Website Design & Dev</option>
                                            <option value="ecommerce">E-Commerce</option>
                                            <option value="webapp">Web Application</option>
                                            <option value="branding">Branding & Identity</option>
                                        </Select>
                                        {errors.projectType && (
                                            <ErrorMessage>{errors.projectType.message}</ErrorMessage>
                                        )}
                                    </InputGroup>
                                    <InputGroup>
                                        <Label>Budget Range</Label>
                                        <Select {...register('budget')}>
                                            <option value="">Select a range...</option>
                                            <option value="5k-10k">$5,000 - $10,000</option>
                                            <option value="10k-25k">$10,000 - $25,000</option>
                                            <option value="25k-50k">$25,000 - $50,000</option>
                                            <option value="50k+">$50,000+</option>
                                        </Select>
                                        {errors.budget && <ErrorMessage>{errors.budget.message}</ErrorMessage>}
                                    </InputGroup>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <InputGroup>
                                        <Label>Project Details</Label>
                                        <TextArea
                                            {...register('description')}
                                            placeholder="Tell us about your goals, requirements, and vision..."
                                        />
                                        {errors.description && (
                                            <ErrorMessage>{errors.description.message}</ErrorMessage>
                                        )}
                                    </InputGroup>
                                    <InputGroup>
                                        <Label>Timeline (Optional)</Label>
                                        <Input {...register('timeline')} placeholder="e.g. 3 months" />
                                        {errors.timeline && <ErrorMessage>{errors.timeline.message}</ErrorMessage>}
                                    </InputGroup>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <ButtonGroup>
                            {step > 1 && (
                                <Button type="button" $variant="secondary" onClick={onPrev}>
                                    Back
                                </Button>
                            )}
                            {step < 3 ? (
                                <MagneticButton type="button" onClick={onNext} strength={0.2}>
                                    <Button as="div" style={{ marginLeft: 'auto' }}>
                                        Next Step
                                    </Button>
                                </MagneticButton>
                            ) : (
                                <MagneticButton type="submit" disabled={isSubmitting} strength={0.2}>
                                    <Button as="div" style={{ marginLeft: 'auto' }} disabled={isSubmitting}>
                                        {isSubmitting ? 'Sending...' : 'Submit Request'}
                                    </Button>
                                </MagneticButton>
                            )}
                        </ButtonGroup>
                    </form>
                </FormCard>
            </FormContainer>
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={() => {
                    setShowSuccessModal(false);
                    setStep(1);
                    setFormData({});
                    // Ideally reset the react-hook-form too, but this is a good start
                    window.location.reload(); // Simple way to reset everything for now
                }}
            />
        </WizardWrapper>
    );
}


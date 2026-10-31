'use client';

import styled, { css, keyframes, ThemeProvider } from 'styled-components';
import { Fragment, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Section, Container } from '../layout/Container';
import SuccessModal from './SuccessModal';
import { PLANTED_EVENT, ROOT_END_ATTR, ROOT_GLINT_MS, ROOT_TIP_AT } from '../home/RootStage';
import { DUR, EASE_OUT } from '@/lib/motion';
import { useReducedMotionSafe } from '@/lib/useMediaQuery';
import { glassPane, glassTheme, lightField } from '@/styles/glass';
import { theme as siteTheme } from '@/styles/theme';
import { bronzeCaps, bronzeWord, GLINT_EASE, glintOnce } from '@/styles/bronze';
import { buttonText, focusRing, frostedButton } from './buttons';

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

/*
 * The contact form, dressed like the hero (owner's request, 2026-10-30): on the
 * same smoked glass as Projects, titled like the hero's own button with the
 * polished bronze of "timeless", fields as bronze hairlines and the header's
 * frosted bronze button. The scroll-drawn root runs down into it (RootStage),
 * and its last fan of traces is the form's steps: each pad fills as its step is
 * done. When a project is sent, a glint runs down the root into the fan, every
 * pad fills, and then the thank-you opens.
 */

const ease = `cubic-bezier(${EASE_OUT.join(', ')})`;

// A theme colour at some strength, for hairlines that follow whichever palette is in use
const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

// When a project is sent: the root's glint reaches the steps, the fan catches the light, the pads
// fill, and the thank-you opens. The fan's lead, 85% of the root's glint, is tuned by eye for a
// clean hand-off.
const FAN_GLINT_AT = Math.round(ROOT_GLINT_MS * 0.85);
const FAN_GLINT_MS = 700;
const PADS_FILL_AT = FAN_GLINT_AT + 500;
const THANKS_AT = FAN_GLINT_AT + FAN_GLINT_MS + 450;

// Its content sits at the top rather than centred, so the place where the root ends stays put as
// the steps change height; the room above is the root's way down from the via
const WizardWrapper = styled(Section)`
  background: linear-gradient(
    180deg,
    rgba(16, 32, 24, 0.35) 0%,
    rgba(20, 40, 30, 0.25) 50%,
    rgba(16, 32, 24, 0.35) 100%
  );
  padding: 168px 0 ${({ theme }) => theme.spacing.xxxl};
  position: relative;

  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.spacing.xxl} 0;
  }
`;

const FormContainer = styled(Container)`
  max-width: 800px;
  position: relative;
  z-index: 1;
`;

/* ---------- The root's last fan: the steps ---------- */

const STEP_NAMES = ['You', 'Your project', 'Details'];

// The fan, in a 360 × 54 box: the root comes in at the top centre and splits at 45° into three
// traces, each ending in a pad, at 10%, 50% and 90% across
const FAN_W = 360;
const PAD_X = [36, 180, 324];
const PAD_Y = 48;
const TRUNK = 'M180 0 L180 12';
const BRANCHES = [
    'M180 12 L166 26 L50 26 L36 40 L36 43.5',
    'M180 12 L180 43.5',
    'M180 12 L194 26 L310 26 L324 40 L324 43.5',
];

const Steps = styled.div`
  position: relative;
  width: min(${FAN_W}px, 100%);
  margin: 0 auto ${({ theme }) => theme.spacing.lg};
`;

const FanSvg = styled.svg`
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  color: ${({ theme }) => theme.colors.primary};
`;

// The fan draws in as the scroll-drawn root's tip reaches it; reduced motion shows it drawn
const drawIn = (delay: number) => css`
  @media (prefers-reduced-motion: no-preference) {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    transition:
      stroke-dashoffset 0.6s ${ease} ${delay}s,
      stroke-opacity ${DUR.state}s ${ease};

    ${Steps}[data-drawn='true'] & {
      stroke-dashoffset: 0;
    }
  }
`;

const trace = css`
  fill: none;
  stroke: currentColor;
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

// The root itself, as bright as it is above the form
const Trunk = styled.path`
  ${trace}
  stroke-opacity: 0.5;
  ${drawIn(0)}
`;

// A branch is lit once its step is reached
const Branch = styled.path`
  ${trace}
  stroke-opacity: 0.3;
  transition: stroke-opacity ${DUR.state}s ${ease};

  &[data-lit='true'] {
    stroke-opacity: 0.75;
  }

  ${drawIn(0.2)}
`;

const branchGlint = keyframes`
  from { stroke-dashoffset: 0.24; opacity: 1; }
  to { stroke-dashoffset: -1; opacity: 1; }
`;

// The bone-white glint that runs out along each branch when a project is sent
const BranchGlint = styled.path`
  fill: none;
  stroke: ${({ theme }) => theme.colors.text};
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-dasharray: 0.2 1.4;
  opacity: 0;

  @media (prefers-reduced-motion: no-preference) {
    ${Steps}[data-planted='true'] & {
      animation: ${branchGlint} ${FAN_GLINT_MS}ms ${GLINT_EASE} ${FAN_GLINT_AT}ms both;
    }
  }

`;

// A soft light around the step in hand, like the glow at the root's tip; every pad glows once planted
const PadHalo = styled.circle`
  fill: url(#contact-pad-halo);
  opacity: 0;
  transition: opacity ${DUR.state}s ${ease};

  &[data-on='true'] {
    opacity: 1;
  }

  ${Steps}[data-planted='true'] & {
    opacity: 1;
    transition-delay: ${PADS_FILL_AT}ms;
  }
`;

// A pad: an open ring ahead, a bright ring for the step in hand, filled once done
const Pad = styled.circle`
  fill: ${({ theme }) => theme.colors.background};
  stroke: currentColor;
  stroke-width: 1.25;
  stroke-opacity: 0.4;
  transition:
    fill ${DUR.state}s ${ease},
    stroke-opacity ${DUR.state}s ${ease};

  &[data-state='current'] {
    stroke-opacity: 1;
  }

  &[data-state='done'] {
    fill: currentColor;
    stroke-opacity: 1;
  }

  ${Steps}[data-planted='true'] & {
    transition-delay: ${PADS_FILL_AT}ms;
  }
`;

// Each pad with its halo, appearing once the traces have reached them
const PadGroup = styled.g`
  @media (prefers-reduced-motion: no-preference) {
    transition: opacity 0.4s ${ease} 0.7s;

    ${Steps}:not([data-drawn='true']) & {
      opacity: 0;
    }
  }
`;

const StepNames = styled.ol`
  position: relative;
  height: 1.2rem;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
`;

// Tracked capitals, centred under each pad (the indent gives back the trailing letter-spacing)
const StepName = styled.li`
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  padding-left: 0.2em;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.caps};
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: color ${DUR.state}s ${ease};

  &[data-state='current'] {
    color: ${({ theme }) => theme.colors.text};
  }

  &[data-state='done'] {
    color: ${({ theme }) => theme.colors.primary};
  }

  /* Once planted, each name turns bronze with its pad, not before */
  ${Steps}[data-planted='true'] & {
    transition-delay: ${PADS_FILL_AT}ms;
  }
`;

function RootSteps({ step, planted }: { step: number; planted: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    // The fan draws in as the scroll-drawn root's tip, ROOT_TIP_AT down the viewport, arrives
    const drawn = useInView(ref, { once: true, margin: `0px 0px ${-Math.round((1 - ROOT_TIP_AT) * 100)}% 0px` });
    const state = (i: number) => (planted || step > i + 1 ? 'done' : step === i + 1 ? 'current' : 'next');

    return (
        <Steps ref={ref} {...{ [ROOT_END_ATTR]: '' }} data-drawn={drawn} data-planted={planted}>
            <FanSvg viewBox={`0 0 ${FAN_W} 54`} aria-hidden="true">
                <defs>
                    <radialGradient id="contact-pad-halo">
                        <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                    </radialGradient>
                </defs>
                <Trunk d={TRUNK} pathLength={1} />
                {BRANCHES.map((d, i) => (
                    <Fragment key={d}>
                        <Branch d={d} pathLength={1} data-lit={planted || step > i} />
                        <BranchGlint d={d} pathLength={1} />
                    </Fragment>
                ))}
                {PAD_X.map((x, i) => (
                    <PadGroup key={x}>
                        <PadHalo cx={x} cy={PAD_Y} r={13} data-on={!planted && step === i + 1} />
                        <Pad cx={x} cy={PAD_Y} r={4.5} data-state={state(i)} />
                    </PadGroup>
                ))}
            </FanSvg>
            <StepNames aria-label="Progress">
                {STEP_NAMES.map((name, i) => (
                    <StepName
                        key={name}
                        style={{ left: `${(PAD_X[i] / FAN_W) * 100}%` }}
                        data-state={state(i)}
                        aria-current={step === i + 1 ? 'step' : undefined}
                    >
                        {name}
                    </StepName>
                ))}
            </StepNames>
        </Steps>
    );
}

/* ---------- The form, on glass ---------- */

const CardStage = styled.div`
  position: relative;
`;

// The light behind the form: bronze warmth under the title, below where the root comes in, and sage
// low on the left. Both fade out well inside the field, so no edge shows around the card.
const CardLight = styled.div`
  ${lightField}
  background:
    radial-gradient(34% 26% at 50% 22%, rgba(200, 159, 129, 0.26), transparent 70%),
    radial-gradient(30% 32% at 28% 68%, rgba(174, 196, 168, 0.26), transparent 70%);
`;

const FormCard = styled.div`
  ${glassPane}
  padding: 56px;

  @media (max-width: 768px) {
    padding: 36px 20px 32px;
  }
`;

// Titled like the hero's button, with "project" in the polished bronze of "timeless" (bronzeWord),
// which catches the light once as the title scrolls into view
const FormTitle = styled.h2`
  text-align: center;
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 3.25rem;
  font-weight: 400;
  line-height: 1.1;
  color: ${({ theme }) => theme.colors.text};
  text-wrap: balance;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  ${bronzeWord}

  &[data-seen='true'] em {
    ${glintOnce(200)}
  }

  @media (max-width: 768px) {
    font-size: 2.4rem;
  }
`;

// One line of bronze capitals under the title, polished like the hero's subtext
const FormLead = styled.p`
  text-align: center;
  font-family: ${({ theme }) => theme.fonts.caps};
  font-size: 0.9rem;
  font-weight: 300;
  line-height: 1.8;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 40px;

  @supports (background-clip: text) or (-webkit-background-clip: text) {
    background: ${bronzeCaps} 0 0 / 100% 1.8em repeat-y;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
`;

// Room for the tallest step (the details), so the card and its button stay put from step to step
const StepFields = styled.div`
  min-height: 260px;
`;

// Each step is a group whose legend names it for screen readers, read out as focus moves into it
const StepGroup = styled.fieldset`
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
`;

const VisuallyHidden = styled.legend`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

const Field = styled.div.attrs({
    // Allow hydration mismatches from browser extensions (e.g., LastPass)
    suppressHydrationWarning: true,
})`
  margin-bottom: 28px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 2px;
  font-family: ${({ theme }) => theme.fonts.caps};
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.primary};
`;

// The strength of a field's line: the hairline under the hero's button, which holds 3:1 on the glass
const FIELD_LINE = 60;

// A field is one bronze hairline at the hero button's strength: rose while there's something to fix,
// and full bronze and doubled while it has focus
const hairline = css`
  width: 100%;
  padding: 10px 0 12px;
  border: 0;
  border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, FIELD_LINE)};
  border-radius: 0;
  background: transparent;
  font-family: ${({ theme }) => theme.fonts.main};
  font-size: 1.05rem;
  color: ${({ theme }) => theme.colors.text};
  transition:
    border-color ${DUR.state}s ${ease},
    box-shadow ${DUR.state}s ${ease};

  /* The site's dimmer sage, opaque: legible on the glass (5:1) yet clearly not a typed value */
  &::placeholder {
    color: ${siteTheme.colors.textSecondary};
    opacity: 1;
  }

  &[aria-invalid='true'] {
    border-bottom-color: ${({ theme }) => theme.colors.error};
  }

  /* The transparent outline is invisible normally, but forced colours paint it, so focus still shows there */
  &:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    border-bottom-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 1px 0 ${({ theme }) => theme.colors.primary};
  }

  /* Autofilled fields keep the ink on glass instead of the browser's opaque fill */
  &:-webkit-autofill,
  &:-webkit-autofill:hover,
  &:-webkit-autofill:focus {
    -webkit-text-fill-color: ${({ theme }) => theme.colors.text};
    caret-color: ${({ theme }) => theme.colors.text};
    transition:
      border-color ${DUR.state}s ${ease},
      box-shadow ${DUR.state}s ${ease},
      background-color 0s 600000s;
  }
`;

// Autocomplete is off unless a field says what it holds (name, email, organization), so browsers
// can still fill those
const Input = styled.input.attrs((p) => ({
    'data-lpignore': 'true',
    'data-form-type': 'other',
    autoComplete: p.autoComplete ?? 'off',
    suppressHydrationWarning: true,
}))`
  ${hairline}
`;

const Select = styled.select`
  ${hairline}
  appearance: none;
  cursor: pointer;
  padding-right: 28px;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%23C89F81' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 4px center;

  /* The open list, where the browser lets it be styled */
  option {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;

// Several lines need a frame to write in: the same bronze line, all the way round
const TextArea = styled.textarea.attrs({
    'data-lpignore': 'true',
    'data-form-type': 'other',
    suppressHydrationWarning: true,
})`
  ${hairline}
  min-height: 132px;
  margin-top: 8px;
  padding: 12px 14px;
  border: 1px solid ${({ theme }) => tint(theme.colors.primary, FIELD_LINE)};
  line-height: 1.6;
  resize: vertical;

  &[aria-invalid='true'] {
    border-color: ${({ theme }) => theme.colors.error};
  }

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 1px ${({ theme }) => theme.colors.primary};
  }
`;

const ErrorMessage = styled.span`
  display: block;
  margin-top: 6px;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.error};
`;

const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: 40px;
`;

const NextButton = styled.button`
  ${frostedButton}
  margin-left: auto;

  &:disabled {
    cursor: progress;
    opacity: 0.7;
  }

  &[data-planted='true'] {
    cursor: default;
  }
`;

// Back: a line of text on a bronze hairline, like the hero's button
const BackButton = styled.button`
  position: relative;
  min-height: 48px;
  padding: 0 4px;
  background: none;
  border: 0;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: color ${DUR.hover}s ${ease};
  ${buttonText}

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 10px;
    height: 1px;
    background: linear-gradient(90deg, transparent, ${({ theme }) => tint(theme.colors.primary, 60)} 25% 75%, transparent);
    pointer-events: none;
  }

  /* Touch screens keep :hover after a tap, so only devices that can hover get it */
  @media (hover: hover) {
    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  }

  ${focusRing}
`;

// Steps slide in from the right and out to the left; exits run about 30% faster than entrances
const stepMotion = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20, transition: { duration: DUR.state * 0.7, ease: EASE_OUT } },
    transition: { duration: DUR.state, ease: EASE_OUT },
};

// The step names, as the legends read them, and each step's first field, which takes focus on arrival
const STEP_LEGENDS = ['Step 1 of 3: You', 'Step 2 of 3: Your project', 'Step 3 of 3: Details'];
const FIRST_FIELD = ['name', 'projectType', 'description'] as const;

export default function ContactWizard() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<Partial<FormData>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [planted, setPlanted] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    // The step whose first field should take focus once it mounts; set only by Next and Back, so
    // the page's first load never moves focus
    const [focusOnArrival, setFocusOnArrival] = useState<number | null>(null);
    const reduce = useReducedMotionSafe();
    const titleRef = useRef<HTMLHeadingElement>(null);
    const titleSeen = useInView(titleRef, { once: true, amount: 0.8 });

    // Once planted, the thank-you opens after the glint has run down the root and through the steps,
    // or at once if the steps are scrolled out of view, since its own mark shows them planted
    useEffect(() => {
        if (!planted) return;
        const pads = document.querySelector(`[${ROOT_END_ATTR}]`)?.getBoundingClientRect();
        const padsSeen = !!pads && pads.top + PAD_Y > 0 && pads.top + PAD_Y < window.innerHeight;
        const timer = window.setTimeout(() => setShowSuccessModal(true), reduce || !padsSeen ? 0 : THANKS_AT);
        return () => window.clearTimeout(timer);
    }, [planted, reduce]);

    const {
        register,
        handleSubmit,
        formState: { errors },
        trigger,
        getValues,
        setFocus,
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

    const goTo = (to: number) => {
        setFocusOnArrival(to);
        setStep(to);
    };

    // preventDefault comes first: validation resolves in microtasks within the click, and the button
    // must not become a submit button before the browser acts on it. An invalid step focuses its
    // first problem field, which reads out the error.
    const onNext = async (e: React.MouseEvent) => {
        e.preventDefault();
        const isValid = await trigger(undefined, { shouldFocus: true });
        if (isValid) {
            // Keep the state updated with values from the current step
            // so we can submit everything correctly at the end.
            const currentValues = getValues();
            setFormData((prev) => ({ ...prev, ...currentValues }));
            goTo(step + 1);
        }
    };

    const onPrev = () => {
        goTo(step - 1);
    };

    // On a step's arrival after Next or Back, focus its first field (its group's legend names the step)
    const arrive = (n: number) => (el: HTMLDivElement | null) => {
        if (el && focusOnArrival === n) {
            setFocusOnArrival(null);
            setFocus(FIRST_FIELD[n - 1]);
        }
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
                // Planted: a glint runs down the root into the steps and every pad fills
                setPlanted(true);
                window.dispatchEvent(new Event(PLANTED_EVENT));
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

    // Ties a field to its label and, when there is one, its error
    const field = (name: keyof FormData) => ({
        id: `contact-${name}`,
        'aria-invalid': errors[name] ? true : undefined,
        'aria-describedby': errors[name] ? `contact-${name}-error` : undefined,
        ...register(name),
    });
    const error = (name: keyof FormData) =>
        errors[name] && <ErrorMessage id={`contact-${name}-error`}>{errors[name]?.message}</ErrorMessage>;

    return (
        <WizardWrapper id="contact">
            <FormContainer>
                <RootSteps step={step} planted={planted} />

                <ThemeProvider theme={glassTheme}>
                    <CardStage>
                        <CardLight aria-hidden="true" />
                        <FormCard>
                            <FormTitle ref={titleRef} data-seen={titleSeen}>
                                Plant your <em data-glow="project">project</em>
                            </FormTitle>
                            <FormLead>Tell us what you&rsquo;d like to grow</FormLead>

                            <form onSubmit={handleSubmit(onSubmit)}>
                                <StepFields>
                                    <AnimatePresence mode="wait">
                                        {step === 1 && (
                                            <motion.div key="step1" ref={arrive(1)} {...stepMotion}>
                                                <StepGroup>
                                                    <VisuallyHidden>{STEP_LEGENDS[0]}</VisuallyHidden>
                                                    <Field>
                                                        <Label htmlFor="contact-name">Name</Label>
                                                        <Input {...field('name')} autoComplete="name" placeholder="John Doe" />
                                                        {error('name')}
                                                    </Field>
                                                    <Field>
                                                        <Label htmlFor="contact-email">Email</Label>
                                                        <Input
                                                            {...field('email')}
                                                            type="email"
                                                            autoComplete="email"
                                                            spellCheck={false}
                                                            placeholder="john@example.com"
                                                        />
                                                        {error('email')}
                                                    </Field>
                                                    <Field>
                                                        <Label htmlFor="contact-company">Company (Optional)</Label>
                                                        <Input {...field('company')} autoComplete="organization" placeholder="Your Company Ltd." />
                                                        {error('company')}
                                                    </Field>
                                                </StepGroup>
                                            </motion.div>
                                        )}

                                        {step === 2 && (
                                            <motion.div key="step2" ref={arrive(2)} {...stepMotion}>
                                                <StepGroup>
                                                    <VisuallyHidden>{STEP_LEGENDS[1]}</VisuallyHidden>
                                                    <Field>
                                                        <Label htmlFor="contact-projectType">Project Type</Label>
                                                        <Select {...field('projectType')}>
                                                            <option value="">Select a type...</option>
                                                            <option value="website">Website Design & Dev</option>
                                                            <option value="ecommerce">E-Commerce</option>
                                                            <option value="webapp">Web Application</option>
                                                            <option value="branding">Branding & Identity</option>
                                                        </Select>
                                                        {error('projectType')}
                                                    </Field>
                                                    <Field>
                                                        <Label htmlFor="contact-budget">Budget Range</Label>
                                                        <Select {...field('budget')}>
                                                            <option value="">Select a range...</option>
                                                            <option value="5k-10k">$5,000 - $10,000</option>
                                                            <option value="10k-25k">$10,000 - $25,000</option>
                                                            <option value="25k-50k">$25,000 - $50,000</option>
                                                            <option value="50k+">$50,000+</option>
                                                        </Select>
                                                        {error('budget')}
                                                    </Field>
                                                </StepGroup>
                                            </motion.div>
                                        )}

                                        {step === 3 && (
                                            <motion.div key="step3" ref={arrive(3)} {...stepMotion}>
                                                <StepGroup>
                                                    <VisuallyHidden>{STEP_LEGENDS[2]}</VisuallyHidden>
                                                    <Field>
                                                        <Label htmlFor="contact-description">Project Details</Label>
                                                        <TextArea
                                                            {...field('description')}
                                                            placeholder="Tell us about your goals, requirements, and vision..."
                                                        />
                                                        {error('description')}
                                                    </Field>
                                                    <Field>
                                                        <Label htmlFor="contact-timeline">Timeline (Optional)</Label>
                                                        <Input {...field('timeline')} placeholder="e.g. 3 months" />
                                                        {error('timeline')}
                                                    </Field>
                                                </StepGroup>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </StepFields>

                                <ButtonGroup>
                                    {step > 1 && !planted && (
                                        <BackButton type="button" onClick={onPrev}>
                                            Back
                                        </BackButton>
                                    )}
                                    {/* Keyed apart, so React never turns the clicked Next button into a submit button */}
                                    {step < 3 ? (
                                        <NextButton key="next" type="button" onClick={onNext}>
                                            Next Step
                                        </NextButton>
                                    ) : (
                                        <NextButton
                                            key="send"
                                            type="submit"
                                            disabled={isSubmitting || planted}
                                            data-planted={planted}
                                        >
                                            {isSubmitting ? 'Sending...' : planted ? 'Sent' : 'Send Request'}
                                        </NextButton>
                                    )}
                                </ButtonGroup>
                            </form>
                        </FormCard>
                    </CardStage>
                </ThemeProvider>
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

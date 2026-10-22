'use client';

import { motion, useInView, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface AnimatedCounterProps {
    from?: number;
    to: number;
    suffix?: string;
    className?: string;
}

export default function AnimatedCounter({
    from = 0,
    to,
    suffix = '',
    className,
}: AnimatedCounterProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const isInView = useInView(ref, { once: true, margin: '-100px' });

    const motionValue = useSpring(from, {
        stiffness: 50,
        damping: 30,
        restDelta: 0.5,
    });

    const rounded = useTransform(motionValue, (latest) => Math.round(latest));

    useEffect(() => {
        if (isInView) {
            motionValue.set(to);
        }
    }, [isInView, to, motionValue]);

    return (
        <motion.span ref={ref} className={className}>
            <motion.span>{rounded}</motion.span>
            {suffix}
        </motion.span>
    );
}

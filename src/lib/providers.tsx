'use client';

import { ThemeProvider } from 'styled-components';
import { MotionConfig } from 'framer-motion';
import { theme } from '@/styles/theme';
import { GlobalStyle } from '@/styles/GlobalStyle';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider theme={theme}>
            <MotionConfig reducedMotion="user">
                <GlobalStyle />
                {children}
            </MotionConfig>
        </ThemeProvider>
    );
}

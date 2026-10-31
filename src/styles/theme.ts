export const theme = {
    colors: {
        background: '#0F1410', // Deep Organic Black/Green
        primary: '#C89F81', // Muted Bronze/Copper
        secondary: '#1A261E', // Dark Forest Green
        accent: '#5D7566', // Sage/Eucalyptus
        surface: '#161F19', // Dark Green Surface
        text: '#E8E6E1', // Warm Off-white/Bone
        textSecondary: '#9CA59E', // Muted Sage Gray
        gold: '#C89F81', // Mapped to Primary (Bronze) for compatibility
        white: '#FFFFFF',
        error: '#CF6679',
        success: '#03DAC6',
    },
    fonts: {
        main: "var(--font-inter), 'Inter', sans-serif",
        heading: "var(--font-playfair), 'Playfair Display', serif",
        // Tracked capitals: the header's links and the hero's statements (owner's choice, 2026-10-30)
        caps: "var(--font-jost), 'Jost', sans-serif",
        // The hero headline's thin capitals (owner's choice, 2026-10-30)
        display: "var(--font-italiana), 'Italiana', serif",
    },
    breakpoints: {
        mobile: '375px',
        tablet: '768px',
        desktop: '1024px',
        wide: '1440px',
    },
    spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '64px',
        xxxl: '128px',
    },
    transitions: {
        default: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    },
};

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
    // In rem, so spacing grows with the base size on large monitors (4px to 128px at 16px)
    spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        xxl: '4rem',
        xxxl: '8rem',
    },
    transitions: {
        default: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    },
};

/**
 * Theme definitions for the MathLab site.
 *
 * Each theme is a flat map of CSS custom properties that gets applied to the
 * document root by the ThemeProvider. Add a new object here and it automatically
 * shows up on the Themes page and in the navbar switcher — no other wiring needed.
 */

export const THEMES = {
    midnight: {
        name: 'Midnight',
        blurb: 'Dark slate with a warm orange glow.',
        swatch: ['#0f1420', '#ff7a1a', '#22d3ee'],
        vars: {
            '--bg': '#0b0f18',
            '--bg-2': '#0f1420',
            '--surface': '#161c2b',
            '--surface-2': '#1e2637',
            '--border': '#2a3448',
            '--text': '#eef2fb',
            '--text-muted': '#94a3b8',
            '--accent': '#ff7a1a',
            '--accent-2': '#22d3ee',
            '--on-accent': '#0b0f18',
            '--grid': '#243049',
            '--axis': '#5c6b86',
            '--danger': '#ff5470',
            '--success': '#3ddc84',
            '--shadow': '0 12px 40px rgba(0,0,0,0.45)',
            '--hero-glow': 'radial-gradient(60% 80% at 70% 20%, rgba(255,122,26,0.20), transparent 60%), radial-gradient(50% 70% at 20% 80%, rgba(34,211,238,0.16), transparent 60%)'
        }
    },
    aurora: {
        name: 'Aurora',
        blurb: 'Deep space violet and teal.',
        swatch: ['#12102a', '#a78bfa', '#2dd4bf'],
        vars: {
            '--bg': '#0c0a1f',
            '--bg-2': '#12102a',
            '--surface': '#1a1740',
            '--surface-2': '#241f52',
            '--border': '#332c66',
            '--text': '#f2effd',
            '--text-muted': '#a99fd4',
            '--accent': '#a78bfa',
            '--accent-2': '#2dd4bf',
            '--on-accent': '#12102a',
            '--grid': '#2c2658',
            '--axis': '#6d63a8',
            '--danger': '#fb7185',
            '--success': '#34d399',
            '--shadow': '0 12px 40px rgba(0,0,0,0.5)',
            '--hero-glow': 'radial-gradient(60% 80% at 75% 15%, rgba(167,139,250,0.25), transparent 60%), radial-gradient(50% 70% at 15% 85%, rgba(45,212,191,0.18), transparent 60%)'
        }
    },
    paper: {
        name: 'Paper',
        blurb: 'Bright classroom white and blue.',
        swatch: ['#ffffff', '#2563eb', '#0ea5e9'],
        vars: {
            '--bg': '#f4f6fb',
            '--bg-2': '#ffffff',
            '--surface': '#ffffff',
            '--surface-2': '#eef2f9',
            '--border': '#d7deea',
            '--text': '#0f1b2d',
            '--text-muted': '#5b6b82',
            '--accent': '#2563eb',
            '--accent-2': '#0ea5e9',
            '--on-accent': '#ffffff',
            '--grid': '#dbe3ef',
            '--axis': '#94a3b8',
            '--danger': '#dc2626',
            '--success': '#16a34a',
            '--shadow': '0 10px 30px rgba(37,99,235,0.12)',
            '--hero-glow': 'radial-gradient(60% 80% at 75% 15%, rgba(37,99,235,0.12), transparent 60%), radial-gradient(50% 70% at 15% 85%, rgba(14,165,233,0.10), transparent 60%)'
        }
    },
    sunset: {
        name: 'Sunset',
        blurb: 'Warm coral, amber and pink.',
        swatch: ['#1f1020', '#fb7185', '#fbbf24'],
        vars: {
            '--bg': '#180b18',
            '--bg-2': '#1f1020',
            '--surface': '#2a1430',
            '--surface-2': '#371a3f',
            '--border': '#4a2452',
            '--text': '#fdeef6',
            '--text-muted': '#d9a7c4',
            '--accent': '#fb7185',
            '--accent-2': '#fbbf24',
            '--on-accent': '#1f1020',
            '--grid': '#3d2044',
            '--axis': '#8a5a86',
            '--danger': '#ff5470',
            '--success': '#4ade80',
            '--shadow': '0 12px 40px rgba(0,0,0,0.45)',
            '--hero-glow': 'radial-gradient(60% 80% at 75% 15%, rgba(251,113,133,0.24), transparent 60%), radial-gradient(50% 70% at 15% 85%, rgba(251,191,36,0.18), transparent 60%)'
        }
    },
    forest: {
        name: 'Forest',
        blurb: 'Calm pine green and lime.',
        swatch: ['#0c1811', '#4ade80', '#a3e635'],
        vars: {
            '--bg': '#081109',
            '--bg-2': '#0c1811',
            '--surface': '#122117',
            '--surface-2': '#1a2e20',
            '--border': '#254230',
            '--text': '#eafaf0',
            '--text-muted': '#8fb59b',
            '--accent': '#4ade80',
            '--accent-2': '#a3e635',
            '--on-accent': '#081109',
            '--grid': '#1e3a29',
            '--axis': '#4f7a5e',
            '--danger': '#f87171',
            '--success': '#22c55e',
            '--shadow': '0 12px 40px rgba(0,0,0,0.45)',
            '--hero-glow': 'radial-gradient(60% 80% at 75% 15%, rgba(74,222,128,0.20), transparent 60%), radial-gradient(50% 70% at 15% 85%, rgba(163,230,53,0.16), transparent 60%)'
        }
    },
    contrast: {
        name: 'High Contrast',
        blurb: 'Maximum-contrast black and yellow.',
        swatch: ['#000000', '#ffe600', '#ffffff'],
        vars: {
            '--bg': '#000000',
            '--bg-2': '#000000',
            '--surface': '#0a0a0a',
            '--surface-2': '#141414',
            '--border': '#ffe600',
            '--text': '#ffffff',
            '--text-muted': '#d4d4d4',
            '--accent': '#ffe600',
            '--accent-2': '#ffffff',
            '--on-accent': '#000000',
            '--grid': '#333333',
            '--axis': '#ffffff',
            '--danger': '#ff4d4d',
            '--success': '#00e676',
            '--shadow': '0 0 0 2px #ffe600',
            '--hero-glow': 'none'
        }
    }
}

export const DEFAULT_THEME = 'midnight'
export const THEME_ORDER = ['midnight', 'aurora', 'paper', 'sunset', 'forest', 'contrast']

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { THEMES, DEFAULT_THEME, THEME_ORDER } from './themes'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'mathlab-theme'

const getInitialTheme = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved && THEMES[saved]) return saved
    } catch {
        /* localStorage unavailable (private mode) — fall through to default */
    }
    return DEFAULT_THEME
}

/**
 * Applies a theme's CSS custom properties to the document root and tags the
 * root with the theme key so component CSS can react to specific themes.
 */
const applyTheme = (key) => {
    const theme = THEMES[key] || THEMES[DEFAULT_THEME]
    const root = document.documentElement
    Object.entries(theme.vars).forEach(([prop, value]) => {
        root.style.setProperty(prop, value)
    })
    root.setAttribute('data-theme', key)
}

export const ThemeProvider = ({ children }) => {
    const [themeKey, setThemeKey] = useState(getInitialTheme)

    useEffect(() => {
        applyTheme(themeKey)
        try {
            localStorage.setItem(STORAGE_KEY, themeKey)
        } catch {
            /* ignore persistence failure */
        }
    }, [themeKey])

    const setTheme = useCallback((key) => {
        if (THEMES[key]) setThemeKey(key)
    }, [])

    const cycleTheme = useCallback(() => {
        setThemeKey(prev => {
            const idx = THEME_ORDER.indexOf(prev)
            return THEME_ORDER[(idx + 1) % THEME_ORDER.length]
        })
    }, [])

    return (
        <ThemeContext.Provider value={{ themeKey, theme: THEMES[themeKey], setTheme, cycleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useThemeContext = () => {
    const ctx = useContext(ThemeContext)
    if (!ctx) throw new Error('useThemeContext must be used within a ThemeProvider')
    return ctx
}

import { useThemeContext } from '../theme/ThemeContext'
import { THEMES, THEME_ORDER } from '../theme/themes'

const ThemesPage = () => {
    const { themeKey, setTheme } = useThemeContext()

    return (
        <div className="page">
            <div className="page-head">
                <h1>Themes</h1>
                <p>Pick a look for the whole site. Your choice is saved and applies everywhere instantly.</p>
            </div>

            <div className="theme-grid">
                {THEME_ORDER.map(key => {
                    const theme = THEMES[key]
                    const active = key === themeKey
                    return (
                        <button
                            key={key}
                            className={`theme-card ${active ? 'active' : ''}`}
                            onClick={() => setTheme(key)}
                            aria-pressed={active}
                        >
                            <div className="theme-preview">
                                {theme.swatch.map((color, i) => (
                                    <span key={i} style={{ background: color }} />
                                ))}
                            </div>
                            <div className="theme-meta">
                                <h3>
                                    {theme.name}
                                    {active && <span className="check">✓</span>}
                                </h3>
                                <p>{theme.blurb}</p>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default ThemesPage

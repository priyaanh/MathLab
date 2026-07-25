import { NavLink, useNavigate } from 'react-router-dom'
import { useThemeContext } from '../theme/ThemeContext'

const LINKS = [
    { to: '/scientific', label: 'Calculator' },
    { to: '/graph', label: 'Grapher' },
    { to: '/lines', label: 'Lines' },
    { to: '/shapes', label: 'Shapes' },
    { to: '/transformations', label: 'Transformations' },
    { to: '/inequalities', label: 'Inequalities' },
    { to: '/guide', label: 'Guide' }
]

const NavBar = () => {
    const { theme, cycleTheme } = useThemeContext()
    const navigate = useNavigate()

    return (
        <nav className="navbar">
            <NavLink to="/" className="brand">
                <span className="brand-mark">∑</span>
                <span>MathLab</span>
            </NavLink>

            <div className="nav-links">
                {LINKS.map(link => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => (isActive ? 'active' : '')}
                    >
                        {link.label}
                    </NavLink>
                ))}
            </div>

            <div className="theme-quick">
                <button onClick={cycleTheme} title="Quick-switch theme">
                    <span className="theme-dot" />
                    {theme.name}
                </button>
                <button onClick={() => navigate('/themes')} title="All themes" aria-label="Open themes page">
                    🎨
                </button>
            </div>
        </nav>
    )
}

export default NavBar

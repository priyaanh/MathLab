import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useThemeContext } from '../theme/ThemeContext'

// Default order. Users can drag links to reorder; their choice is remembered.
const LINKS = [
    { to: '/scientific', label: 'Calculator' },
    { to: '/exercises', label: 'Exercises' },
    { to: '/practice', label: 'Personalized Practice' },
    { to: '/quiz', label: 'Quiz' },
    { to: '/graph', label: 'Grapher' },
    { to: '/solve', label: 'Solver' },
    { to: '/derivative', label: 'Derivatives' },
    { to: '/complex', label: 'Complex' },
    { to: '/lines', label: 'Lines' },
    { to: '/shapes', label: 'Shapes' },
    { to: '/triangle', label: 'Triangle' },
    { to: '/transformations', label: 'Transformations' },
    { to: '/inequalities', label: 'Inequalities' },
    { to: '/units', label: 'Units' },
    { to: '/statistics', label: 'Stats' },
    { to: '/distribution', label: 'Distributions' },
    { to: '/matrix', label: 'Matrix' },
    { to: '/bases', label: 'Bases' },
    { to: '/constants', label: 'Constants' },
    { to: '/guide', label: 'Guide' }
]

const ORDER_KEY = 'mathlab-nav-order'

// Load the saved order, tolerating links added/removed since it was saved.
const loadOrder = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null')
        if (!Array.isArray(saved)) return LINKS
        const byTo = new Map(LINKS.map(l => [l.to, l]))
        const ordered = saved.map(to => byTo.get(to)).filter(Boolean)
        const seen = new Set(saved)
        for (const l of LINKS) if (!seen.has(l.to)) ordered.push(l)   // append new links
        return ordered.length ? ordered : LINKS
    } catch {
        return LINKS
    }
}

const saveOrder = (links) => {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(links.map(l => l.to))) } catch { /* ignore */ }
}

const NavBar = () => {
    const { theme, cycleTheme } = useThemeContext()
    const navigate = useNavigate()
    const location = useLocation()

    const [links, setLinks] = useState(loadOrder)
    const [open, setOpen] = useState(false)
    const [dragging, setDragging] = useState(null)
    const fromRef = useRef(null)
    const menuRef = useRef(null)

    // Close the menu on outside click or Escape.
    useEffect(() => {
        if (!open) return
        const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const current = links.find(l => l.to === location.pathname)
    const currentLabel = current ? current.label : 'Menu'

    const onDragStart = (i) => (e) => {
        fromRef.current = i
        setDragging(i)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', links[i].to)
    }

    // Live-reorder as the dragged link passes over its neighbours.
    const onDragEnter = (i) => () => {
        const from = fromRef.current
        if (from === null || from === i) return
        setLinks(prev => {
            const next = [...prev]
            const [moved] = next.splice(from, 1)
            next.splice(i, 0, moved)
            return next
        })
        fromRef.current = i
        setDragging(i)
    }

    const onDragEnd = () => {
        fromRef.current = null
        setDragging(null)
        setLinks(prev => { saveOrder(prev); return prev })
    }

    const resetOrder = () => {
        setLinks(LINKS)
        saveOrder(LINKS)
    }

    return (
        <nav className="navbar">
            <NavLink to="/" className="brand">
                <span className="brand-mark">∑</span>
                <span>MathLab</span>
            </NavLink>

            <div className="nav-menu" ref={menuRef}>
                <button
                    type="button"
                    className={`nav-menu-btn${open ? ' open' : ''}`}
                    onClick={() => setOpen(o => !o)}
                    aria-haspopup="true"
                    aria-expanded={open}
                >
                    <span className="nav-menu-icon" aria-hidden="true">☰</span>
                    <span className="nav-menu-label">{currentLabel}</span>
                    <span className="nav-menu-caret" aria-hidden="true">▾</span>
                </button>

                {open && (
                    <div className="nav-dropdown" role="menu">
                        <div className="nav-dropdown-head">
                            <span>Pages</span>
                            <button type="button" className="nav-reset" onClick={resetOrder} title="Reset order">↺ Reset</button>
                        </div>
                        {links.map((link, i) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                role="menuitem"
                                draggable
                                onClick={() => setOpen(false)}
                                onDragStart={onDragStart(i)}
                                onDragEnter={onDragEnter(i)}
                                onDragOver={(e) => e.preventDefault()}
                                onDragEnd={onDragEnd}
                                onDrop={(e) => e.preventDefault()}
                                title="Drag to reorder"
                                className={({ isActive }) =>
                                    `nav-dropdown-item${isActive ? ' active' : ''}${dragging === i ? ' dragging' : ''}`
                                }
                            >
                                <span className="nav-grip" aria-hidden="true">⋮⋮</span>
                                {link.label}
                            </NavLink>
                        ))}
                    </div>
                )}
            </div>

            <div className="theme-quick">
                <NavLink
                    to="/profile"
                    className={({ isActive }) => `nav-icon-btn${isActive ? ' active' : ''}`}
                    title="Your profile"
                    aria-label="Your profile"
                >
                    👤
                </NavLink>
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

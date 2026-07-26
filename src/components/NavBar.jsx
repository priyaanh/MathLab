import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { useThemeContext } from '../theme/ThemeContext'

// Default order. Users can drag links to reorder; their choice is remembered.
const LINKS = [
    { to: '/scientific', label: 'Calculator' },
    { to: '/exercises', label: 'Exercises' },
    { to: '/graph', label: 'Grapher' },
    { to: '/solve', label: 'Solver' },
    { to: '/derivative', label: 'Derivatives' },
    { to: '/lines', label: 'Lines' },
    { to: '/shapes', label: 'Shapes' },
    { to: '/triangle', label: 'Triangle' },
    { to: '/transformations', label: 'Transformations' },
    { to: '/inequalities', label: 'Inequalities' },
    { to: '/units', label: 'Units' },
    { to: '/statistics', label: 'Stats' },
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

    const [links, setLinks] = useState(loadOrder)
    const [dragging, setDragging] = useState(null)
    const fromRef = useRef(null)

    const onDragStart = (i) => (e) => {
        fromRef.current = i
        setDragging(i)
        e.dataTransfer.effectAllowed = 'move'
        // Firefox requires data to be set for the drag to begin.
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

            <div className="nav-links" role="list">
                {links.map((link, i) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        role="listitem"
                        draggable
                        onDragStart={onDragStart(i)}
                        onDragEnter={onDragEnter(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={onDragEnd}
                        onDrop={(e) => e.preventDefault()}
                        title="Drag to reorder"
                        className={({ isActive }) =>
                            `${isActive ? 'active' : ''}${dragging === i ? ' dragging' : ''}`
                        }
                    >
                        {link.label}
                    </NavLink>
                ))}
            </div>

            <div className="theme-quick">
                <button onClick={resetOrder} title="Reset tab order" aria-label="Reset tab order">↺</button>
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

import { Suspense, lazy, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import NavBar from './NavBar'
import MathKeypad from './MathKeypad'
import ErrorBoundary from './ErrorBoundary'

// The secret dino game is a popup overlay — lazy so its code only ships when opened.
const DinoGame = lazy(() => import('../pages/DinoGame'))

// Per-route document titles — better browser tabs, history entries and SEO.
const TITLES = {
    '/': 'MathLab — your all-in-one math lab',
    '/exercises': 'Exercises · MathLab',
    '/practice': 'Personalized Practice · MathLab',
    '/profile': 'Profile · MathLab',
    '/scientific': 'Scientific Calculator · MathLab',
    '/graph': 'Function Grapher · MathLab',
    '/lines': 'Lines & Segments · MathLab',
    '/shapes': 'Shapes · MathLab',
    '/transformations': 'Transformations · MathLab',
    '/inequalities': 'Inequalities · MathLab',
    '/units': 'Unit Converter · MathLab',
    '/bases': 'Base Converter · MathLab',
    '/constants': 'Constants · MathLab',
    '/fractions': 'Fractions · MathLab',
    '/sequences': 'Sequences & Series · MathLab',
    '/numbertheory': 'Number Theory · MathLab',
    '/probability': 'Probability · MathLab',
    '/statistics': 'Statistics · MathLab',
    '/solve': 'Equation Solver · MathLab',
    '/derivative': 'Derivative Calculator · MathLab',
    '/triangle': 'Triangle Solver · MathLab',
    '/matrix': 'Matrix Calculator · MathLab',
    '/themes': 'Themes · MathLab',
    '/guide': 'Guide · MathLab'
}

const titleFor = (pathname) => {
    const key = pathname.replace(/\/+$/, '') || '/'
    if (TITLES[key]) return TITLES[key]
    if (key.startsWith('/exercises')) return 'Exercises · MathLab'
    if (key.startsWith('/learn/')) return 'Learn · MathLab'
    return 'MathLab'
}

const PageLoading = () => (
    <div className="page-loading" role="status" aria-live="polite">
        <span className="page-spinner" aria-hidden="true" />
        <span>Loading…</span>
    </div>
)

const Layout = () => {
    const { pathname } = useLocation()
    const [dinoOpen, setDinoOpen] = useState(false)
    useEffect(() => { document.title = titleFor(pathname) }, [pathname])

    return (
        <div className="site">
            <a className="skip-link" href="#main">Skip to content</a>
            <NavBar />
            <main id="main">
                <ErrorBoundary resetKey={pathname}>
                    <Suspense fallback={<PageLoading />}>
                        <Outlet />
                    </Suspense>
                </ErrorBoundary>
            </main>
            <footer className="footer">
                MathLab · built with React · a stylish home for calculators &amp; graphing tools
                <button
                    type="button"
                    className="dino-secret"
                    title="?"
                    aria-label="Secret game"
                    onClick={() => setDinoOpen(true)}
                >
                    🦕
                </button>
            </footer>
            <MathKeypad />
            {dinoOpen && (
                <Suspense fallback={null}>
                    <DinoGame onClose={() => setDinoOpen(false)} />
                </Suspense>
            )}
        </div>
    )
}

export default Layout

import { Suspense, lazy, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import NavBar from './NavBar'
import MathKeypad from './MathKeypad'
import ErrorBoundary from './ErrorBoundary'

// Footer popups — lazy so their code only ships when opened.
const DinoGame = lazy(() => import('../pages/DinoGame'))
const Game2048 = lazy(() => import('../pages/Game2048'))
const WebFrame = lazy(() => import('../pages/WebFrame'))

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
    const [secretGame, setSecretGame] = useState(null) // 'dino' | '2048' | null
    useEffect(() => { document.title = titleFor(pathname) }, [pathname])
    const closeGame = () => setSecretGame(null)

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
                <button
                    type="button"
                    className="dino-secret is-left"
                    title="?"
                    aria-label="Web viewer"
                    onClick={() => setSecretGame('web')}
                >
                    🌐
                </button>
                MathLab · built with React · a stylish home for calculators &amp; graphing tools
                <button
                    type="button"
                    className="dino-secret"
                    title="?"
                    aria-label="Secret game"
                    onClick={() => setSecretGame('dino')}
                >
                    🦕
                </button>
                <button
                    type="button"
                    className="dino-secret"
                    title="?"
                    aria-label="Another secret game"
                    onClick={() => setSecretGame('2048')}
                >
                    🔢
                </button>
            </footer>
            <MathKeypad />
            {secretGame && (
                <Suspense fallback={null}>
                    {secretGame === 'dino' && <DinoGame onClose={closeGame} />}
                    {secretGame === '2048' && <Game2048 onClose={closeGame} />}
                    {secretGame === 'web' && <WebFrame onClose={closeGame} />}
                </Suspense>
            )}
        </div>
    )
}

export default Layout

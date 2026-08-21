import { Suspense, lazy, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import NavBar from './NavBar'
import MathKeypad from './MathKeypad'
import ErrorBoundary from './ErrorBoundary'
import useSecretCode from '../hooks/useSecretCode'

/*
 * Footer popups — lazy so their code only ships when opened.
 *
 * The retry matters: React.lazy calls its factory once and caches the result,
 * rejection included. A single failed chunk fetch therefore breaks the overlay
 * for the rest of the page's life — reopening replays the same rejected promise.
 * Retrying inside the factory absorbs a transient miss (a dev server restarting,
 * a dropped connection, a deploy landing while the tab sat open). Anything worse
 * needs a fresh document, which is what the boundary offers.
 */
const lazyPanel = (load) => lazy(() => load().catch(() => load()))

const DinoGame = lazyPanel(() => import('../pages/DinoGame'))
const Game2048 = lazyPanel(() => import('../pages/Game2048'))
const WebFrame = lazyPanel(() => import('../pages/WebFrame'))

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

/*
 * The way in. Nothing in the UI hints these exist — type the word anywhere that
 * isn't a text field and the panel opens. Colossal Cave's magic words, because
 * they are memorable and nobody types them by accident.
 *
 *   xyzzy  → Dino Run        plugh → 2048        plover → the web viewer
 */
const SECRET_CODES = {
    xyzzy: 'dino',
    plugh: '2048',
    plover: 'web'
}

const Layout = () => {
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const [secretGame, setSecretGame] = useState(null) // 'dino' | '2048' | 'web' | null
    useEffect(() => { document.title = titleFor(pathname) }, [pathname])
    const closeGame = () => setSecretGame(null)
    // Lumen hands an expression to a full-page tool (e.g. "plot sin(x)"): leave
    // the viewer and open that route.
    const openApp = (to) => { setSecretGame(null); navigate(to) }

    // Typing a word toggles its panel — the same word closes it again, so there
    // is a way back out that does not depend on finding the × button.
    useSecretCode(SECRET_CODES, (id) => setSecretGame(cur => (cur === id ? null : id)))

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
            {/* Faint footer buttons open the three panels; the typed words in
                SECRET_CODES still work as a second way in. */}
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
            {/*
              * Overlays get their own boundary. They render outside <main>, so without
              * one an error in here escapes to the root and unmounts the entire site to
              * a blank page. resetKey clears it when a different overlay is opened.
              */}
            {secretGame && (
                <ErrorBoundary resetKey={secretGame} onReset={closeGame}>
                    <Suspense fallback={null}>
                        {secretGame === 'dino' && <DinoGame onClose={closeGame} />}
                        {secretGame === '2048' && <Game2048 onClose={closeGame} />}
                        {secretGame === 'web' && <WebFrame onClose={closeGame} onOpenApp={openApp} />}
                    </Suspense>
                </ErrorBoundary>
            )}
        </div>
    )
}

export default Layout

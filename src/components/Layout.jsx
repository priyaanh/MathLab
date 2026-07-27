import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import NavBar from './NavBar'
import MathKeypad from './MathKeypad'

// Per-route document titles — better browser tabs, history entries and SEO.
const TITLES = {
    '/': 'MathLab — your all-in-one math lab',
    '/exercises': 'Exercises · MathLab',
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
    useEffect(() => { document.title = titleFor(pathname) }, [pathname])

    return (
        <div className="site">
            <NavBar />
            <Suspense fallback={<PageLoading />}>
                <Outlet />
            </Suspense>
            <footer className="footer">
                MathLab · built with React · a stylish home for calculators &amp; graphing tools
            </footer>
            <MathKeypad />
        </div>
    )
}

export default Layout

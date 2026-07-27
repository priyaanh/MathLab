import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { buildVocab, suggest } from '../utils/search'
import { LEVELS, LEVEL_ORDER } from '../data/curriculum'

/**
 * Guide / documentation page — explains every tool on the site and how it
 * works under the hood. Content is data-driven so it's easy to extend as
 * new tools are added.
 */
// Grouped so related tools sit together; the render walks GROUP_ORDER.
const GROUP_ORDER = [
    'Getting around',
    'Practice',
    'Calculate & solve',
    'Graph & geometry',
    'Convert & reference',
    'Personalize'
]

const SECTIONS = [
    {
        group: 'Getting around',
        icon: '🧭',
        title: 'Getting around',
        what: 'Small conveniences that work on every page.',
        how: [
            'The top bar is a pull-down menu — open it to jump to any tool; it shows the page you\'re currently on.',
            'Drag to rearrange: reorder the menu tabs and the home-page tool cards into whatever order suits you — your layout is remembered.',
            'On any graph, drag to pan and scroll to zoom — or click the canvas and use the arrow keys to pan, + / − to zoom, and Home to reset.',
            'No keyboard? Focus any math or number field and an on-screen keypad pops up so you can tap in digits, x, symbols like √ and ^, and functions.',
            'Your theme, layout and exercise progress are saved in your browser; the Profile page lets you back them up.'
        ]
    },
    {
        group: 'Practice',
        icon: '🎯',
        title: 'Exercises',
        to: '/exercises',
        what: 'Guided practice from early math through college, with a never-ending supply of fresh, auto-generated problems and instant checking.',
        how: [
            'Browse skills by grade band — Early Math, Elementary, Pre-Algebra, Algebra, Geometry, Precalculus, Calculus and Statistics (118 skills and growing).',
            'Every problem is generated on the fly, so you never run out and can\'t memorize answers.',
            'Build a streak as you answer; five correct in a row masters a skill. A wrong answer shows a full worked explanation.',
            'Progress saves automatically and is summarized on your Profile page.'
        ]
    },
    {
        group: 'Calculate & solve',
        icon: '🧮',
        title: 'Scientific Calculator',
        to: '/scientific',
        what: 'A full calculator with two modes — Normal for everyday arithmetic and Scientific for trig, logarithms, powers, factorials, constants and memory.',
        how: [
            'Type or click to build an expression; the top line shows the full expression and the big line shows the current value.',
            'It evaluates using real order of operations (PEMDAS), so 2 + 3 × 4 = 14, and supports parentheses.',
            'Trigonometry uses degrees, so sin(90) = 1. Results are cleaned of floating-point noise (0.1 + 0.2 shows 0.3).',
            'Memory keys (MC, MR, M+, M−, MS) and copy/paste are available in Scientific mode. Everything is keyboard-accessible.'
        ]
    },
    {
        group: 'Calculate & solve',
        icon: '🟰',
        title: 'Equation Solver',
        to: '/solve',
        what: 'Solves equations you type — linear, quadratic, 2×2 systems, and now square roots and any higher power — with step-by-step working.',
        how: [
            'Type the whole equation (pasting works): 2x + 3 = 7, x^2 − 5x + 6 = 0, or x^5 − x = 2. No "=" means "= 0".',
            'Linear and quadratic equations are solved exactly, showing every algebra step and the discriminant.',
            'Square roots (sqrt( ) or √), cubes and higher powers are solved numerically — it scans for every real root and refines each one.',
            'Switch to System 2×2 for two linear equations in x and y, and copy any answer with one click.'
        ]
    },
    {
        group: 'Calculate & solve',
        icon: '∂',
        title: 'Derivative Calculator',
        to: '/derivative',
        what: 'Differentiates f(x) symbolically, names the rules it used, evaluates the slope at a point, and draws the tangent line.',
        how: [
            'Type a function — powers, trig, ln, e^x, sqrt, products and quotients are all understood.',
            'See the simplified derivative plus the exact rules applied (power, product, quotient, chain…).',
            'Enter a point to get f(x), the slope f′(x) and the tangent-line equation.',
            'The graph shows the function and its tangent together, and long working wraps neatly inside the panel.'
        ]
    },
    {
        group: 'Calculate & solve',
        icon: '𝑖',
        title: 'Complex Numbers',
        to: '/complex',
        what: 'Arithmetic on complex numbers a + bi, with modulus, argument, polar form, conjugate and an Argand diagram.',
        how: [
            'Type each number as a + bi — e.g. 3+4i, -2-i, 5, or 2i — and pick + − × ÷.',
            'See the result in both rectangular (a + bi) and polar (r ∠ θ°) form.',
            'For each number you get its modulus |z|, argument, polar form and conjugate.',
            'The Argand diagram draws z₁, z₂ and the result as vectors from the origin — pan, zoom and save it as a PNG.'
        ]
    },
    {
        group: 'Calculate & solve',
        icon: '△',
        title: 'Triangle Solver',
        to: '/triangle',
        what: 'Solves any triangle from a valid mix of sides and angles using the laws of sines and cosines, drawn to scale.',
        how: [
            'Enter what you know (SSS, SAS, ASA, AAS…) and it finds the remaining sides and angles.',
            'Uses the law of cosines and law of sines, and reports the area and perimeter.',
            'The triangle is drawn to scale so you can sanity-check the answer at a glance.'
        ]
    },
    {
        group: 'Calculate & solve',
        icon: '📊',
        title: 'Statistics',
        to: '/statistics',
        what: 'Paste a data set for the full summary — averages, spread and a histogram.',
        how: [
            'Paste numbers separated by spaces, commas or new lines.',
            'Get mean, median, mode, range, quartiles, variance and standard deviation.',
            'A histogram shows the shape of your data.'
        ]
    },
    {
        group: 'Calculate & solve',
        icon: '🔔',
        title: 'Distribution Plotter',
        to: '/distribution',
        what: 'Plot Normal, Binomial and Poisson distributions, read their mean and spread, and query a probability.',
        how: [
            'Pick a distribution and set its parameters (μ/σ, n/p, or λ).',
            'The chart shows the bell curve (Normal) or the probability bars (Binomial, Poisson).',
            'Read the mean, variance and standard deviation; enter a query to get P(X ≤ x) — the shaded tail — or P(X = k).',
            'Save the chart as a PNG.'
        ]
    },
    {
        group: 'Calculate & solve',
        icon: '▦',
        title: 'Matrix Calculator',
        to: '/matrix',
        what: 'Add, multiply, transpose, invert and find determinants and rank.',
        how: [
            'Set the dimensions and type in the entries.',
            'Operations include add/subtract, multiply, transpose, determinant, inverse and rank.',
            'Results update as you edit.'
        ]
    },
    {
        group: 'Graph & geometry',
        icon: '📈',
        title: 'Function Grapher',
        to: '/graph',
        what: 'Plots one or more functions of x, with analysis tools for zeros, intersections, tracing and value tables.',
        how: [
            'Add functions like sin(x), x^2, or 2x + 1 — implicit multiplication (2x) is understood.',
            'Toggle Zeros to mark x-intercepts, Intersect to mark where curves cross, and Table for a list of (x, y) values.',
            'Turn on Trace and hover the graph to read exact coordinates. Zoom and pan to move around — or click the graph and use the arrow keys.',
            'It always renders sharply on high-resolution screens.'
        ]
    },
    {
        group: 'Graph & geometry',
        icon: '📏',
        title: 'Lines & Segments',
        to: '/lines',
        what: 'Draws lines and segments and reports their slope, length, midpoint and equation.',
        how: [
            'Enter a line three ways: from two points, from slope & intercept, or by typing an equation like y = 2x + 3.',
            'In equation mode it finds the slope and intercept by sampling the line at x = 0 and x = 1.',
            'Segments also show their length (distance formula) and midpoint (average of the endpoints).',
            'Hover any result to see a step-by-step explanation of how it was calculated.'
        ]
    },
    {
        group: 'Graph & geometry',
        icon: '⬡',
        title: 'Shapes',
        to: '/shapes',
        what: 'Draws circles, rectangles and regular polygons on the coordinate plane and computes their area and perimeter.',
        how: [
            'Pick a shape, set its center and size, then Add it. For polygons, type the name (pentagon, hexagon…) — a typo gets a "did you mean?" suggestion.',
            'Circle area is shown in exact π form (e.g. 16π) alongside the decimal; polygons use the shoelace formula.',
            'Add several shapes and click one in the list to select it and read its measurements.',
            'Drag the ringed handles on the selected shape to reshape it right on the canvas — move a circle, resize a rectangle corner, or pull a polygon vertex.'
        ]
    },
    {
        group: 'Graph & geometry',
        icon: '🔄',
        title: 'Transformations',
        to: '/transformations',
        what: 'Applies geometric transformations to a shape and shows the original (pre-image) and result (image) together.',
        how: [
            'Pick a starting shape (triangle, L-shape or arrow — chosen to make rotations and reflections obvious).',
            'Stack transformations in order: translate by (x, y), dilate about the origin, rotate, or reflect over the x-axis, y-axis or line y = x.',
            'The dashed faded shape is always the original; the solid shape is the cumulative result of your steps.',
            'Remove any single step or clear them all to compare.'
        ]
    },
    {
        group: 'Graph & geometry',
        icon: '≤',
        title: 'Inequalities',
        to: '/inequalities',
        what: 'Shades the region defined by an inequality such as y < 2x + 1, and shows where multiple regions overlap.',
        how: [
            'Choose an operator (<, ≤, >, ≥) and type the right-hand side as a function of x.',
            'A solid boundary means the line is included (≤ or ≥); a dashed boundary means it is excluded (< or >).',
            'Overlapping regions shade darker, so intersections of several inequalities are easy to see.'
        ]
    },
    {
        group: 'Convert & reference',
        icon: '📐',
        title: 'Unit Converter',
        to: '/units',
        what: 'Convert length, mass, temperature, area, volume, speed, time, data and angle.',
        how: [
            'Pick a category, type a value, and read every equivalent unit at once.',
            'Temperature uses proper offset conversions (°C ↔ °F ↔ K), not just scaling.'
        ]
    },
    {
        group: 'Convert & reference',
        icon: '💻',
        title: 'Base Converter',
        to: '/bases',
        what: 'Convert between binary, octal, decimal, hex and any base, plus bitwise operations.',
        how: [
            'Type a number in any base and see it in all the others at once.',
            'Do bitwise AND, OR, XOR and shifts for programming work.'
        ]
    },
    {
        group: 'Convert & reference',
        icon: '🔬',
        title: 'Constants Library',
        to: '/constants',
        what: 'Search math, physics and astronomical constants and copy their values.',
        how: [
            'Search by name or symbol (π, c, Avogadro…).',
            'Copy a precise value to paste into any other tool.'
        ]
    },
    {
        group: 'Personalize',
        icon: '👤',
        title: 'Profile',
        to: '/profile',
        what: 'Your local identity and a safety net so you never lose your progress.',
        how: [
            'Set a display name and see your practice stats and per-topic mastery.',
            'Export a backup file of your progress and preferences, then import it on a new browser or after clearing site data.',
            'Everything stays on your device — the backup file is the portable copy. No account, no server (so nothing to hack).'
        ]
    },
    {
        group: 'Personalize',
        icon: '🎨',
        title: 'Themes',
        to: '/themes',
        what: 'Six built-in looks for the whole site — dark, light and a high-contrast option.',
        how: [
            'Every color comes from a set of CSS variables, so switching a theme re-skins everything at once, including the calculator.',
            'Your choice is saved in your browser and restored on your next visit.',
            'Use the swatch button in the navbar to quick-cycle themes, or open the Themes page to pick one directly.'
        ]
    }
]

// Vocabulary of meaningful words drawn from every section, used to suggest a
// correction when a search finds nothing.
const VOCAB = buildVocab(SECTIONS.map(s => `${s.title} ${s.what} ${s.how.join(' ')}`))

const GuidePage = () => {
    const [query, setQuery] = useState('')

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return SECTIONS
        return SECTIONS.filter(s =>
            (s.title + ' ' + s.what + ' ' + s.how.join(' ')).toLowerCase().includes(q)
        )
    }, [query])

    const suggestion = useMemo(
        () => (filtered.length === 0 ? suggest(query, VOCAB) : null),
        [filtered.length, query]
    )

    return (
        <div className="page">
            <div className="page-head">
                <h1>Guide</h1>
                <p>What every tool does and how it works under the hood. New tools will be documented here as they are added.</p>
            </div>

            <div className="tool-search" style={{ padding: 0, marginBottom: '1.4rem' }}>
                <div className="tool-search-box" style={{ marginLeft: 0 }}>
                    <span className="search-icon" aria-hidden="true">🔍</span>
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search the guide…  (try “trace”, “midpoint”, “theme”)"
                        aria-label="Search the guide"
                    />
                    {query && (
                        <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
                    )}
                </div>
            </div>

            {filtered.length === 0 ? (
                <p className="no-results">
                    Nothing in the guide matches “{query}”.
                    {suggestion && (
                        <>
                            {' '}Did you mean{' '}
                            <button type="button" className="did-you-mean" onClick={() => setQuery(suggestion)}>
                                {suggestion}
                            </button>
                            ?
                        </>
                    )}
                </p>
            ) : (
                GROUP_ORDER.map(group => {
                    const inGroup = filtered.filter(s => s.group === group)
                    if (!inGroup.length) return null
                    return (
                        <div key={group} className="guide-group">
                            <h2 className="guide-group-title">{group}</h2>
                            <div className="guide-list">
                                {inGroup.map(section => (
                                    <section key={section.title} className="panel guide-section">
                                        <div className="guide-section-head">
                                            <span className="guide-icon">{section.icon}</span>
                                            <div>
                                                <h2>{section.title}</h2>
                                                <p className="guide-what">{section.what}</p>
                                            </div>
                                            {section.to && <Link to={section.to} className="btn ghost guide-open">Open →</Link>}
                                        </div>
                                        <ul className="guide-how">
                                            {section.how.map((step, i) => <li key={i}>{step}</li>)}
                                        </ul>
                                    </section>
                                ))}
                            </div>
                        </div>
                    )
                })
            )}

            <div className="page-head roadmap-head">
                <h1>Math by grade level</h1>
                <p>From counting all the way to college calculus — here’s the whole journey. <strong>MathLab’s tools cover the useful, hands‑on parts of this path right through college.</strong> Open any stage for a deep explanation of every topic and the tools that help.</p>
            </div>

            <ol className="roadmap">
                {LEVEL_ORDER.map((slug, i) => {
                    const level = LEVELS[slug]
                    return (
                        <li key={slug} className="roadmap-level">
                            <div className="roadmap-marker" aria-hidden="true">
                                <span className="roadmap-icon">{level.icon}</span>
                            </div>
                            <div className="roadmap-body">
                                <div className="roadmap-title">
                                    <span className="roadmap-stage">Stage {i + 1}</span>
                                    <h2><Link to={`/learn/${slug}`} className="roadmap-link">{level.level}</Link></h2>
                                    <span className="level-grades">{level.grades}</span>
                                    <Link to={`/learn/${slug}`} className="btn ghost roadmap-open">Explore →</Link>
                                </div>
                                <div className="topic-grid">
                                    {level.topics.map(t => (
                                        <Link key={t.name} to={`/learn/${slug}`} className="topic-card">
                                            <span className="topic-name">{t.name}</span>
                                            <span className="topic-note">{t.note}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}

export default GuidePage

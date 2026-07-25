import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { buildVocab, suggest } from '../utils/search'
import { LEVELS, LEVEL_ORDER } from '../data/curriculum'

/**
 * Guide / documentation page — explains every tool on the site and how it
 * works under the hood. Content is data-driven so it's easy to extend as
 * new tools are added.
 */
const SECTIONS = [
    {
        icon: '🧮',
        title: 'Scientific Calculator',
        to: '/scientific',
        what: 'A full calculator with two modes — Normal for everyday arithmetic and Scientific for trig, logarithms, powers, factorials, constants and memory.',
        how: [
            'Type or click to build an expression; the top line shows the full expression and the big line shows the current value.',
            'It evaluates using real order of operations (PEMDAS), so 2 + 3 × 4 = 14, and supports parentheses.',
            'Trigonometry uses degrees, so sin(90) = 1. Results are cleaned of floating-point noise (0.1 + 0.2 shows 0.3).',
            'Memory keys (MC, MR, M+, M−, MS) and copy/paste keys are available in Scientific mode. Everything is keyboard-accessible.'
        ]
    },
    {
        icon: '📈',
        title: 'Function Grapher',
        to: '/graph',
        what: 'Plots one or more functions of x, with analysis tools for zeros, intersections, tracing and value tables.',
        how: [
            'Add functions like sin(x), x^2, or 2x + 1 — implicit multiplication (2x) is understood.',
            'Toggle Zeros to mark x-intercepts, Intersect to mark where curves cross, and Table for a list of (x, y) values.',
            'Turn on Trace and hover the graph to read exact coordinates. Use zoom/pan to move around.',
            'The Size buttons (Small/Medium/Large) control how big the graph is, and it always renders sharply on high-resolution screens.'
        ]
    },
    {
        icon: '📏',
        title: 'Lines & Segments',
        to: '/lines',
        what: 'Draws lines and segments and reports their slope, length, midpoint and equation.',
        how: [
            'Enter a line three ways: from two points, from slope & intercept, or by typing an equation like y = 2x + 3.',
            'For the equation mode it finds the slope and intercept by sampling the line at x = 0 and x = 1.',
            'Segments also show their length (distance formula) and midpoint (average of the endpoints).',
            'Hover any result to see a step-by-step explanation of how it was calculated.'
        ]
    },
    {
        icon: '⬡',
        title: 'Shapes',
        to: '/shapes',
        what: 'Draws circles, rectangles and regular polygons on the coordinate plane, computes their area and perimeter, and transforms them.',
        how: [
            'Pick a shape, set its center and size, then Add it. For polygons, type the name (pentagon, hexagon…) — a typo gets a "did you mean?" suggestion.',
            'Circle area uses πr² and circumference 2πr; polygons use the shoelace formula for area and sum of side lengths for perimeter.',
            'Add several shapes at once and click one in the list to select it and see its measurements.',
            'Drag the ringed handles on the selected shape right on the canvas to reshape it — move a circle, resize a rectangle corner, or pull a polygon vertex — instead of typing coordinates.',
            'Transform the selected shape: translate (move by x, y), dilate (scale about the origin by a factor) and reflect over the x- or y-axis.'
        ]
    },
    {
        icon: '🔄',
        title: 'Transformations',
        to: '/transformations',
        what: 'Applies geometric transformations to a shape and shows the original (pre-image) and result (image) together.',
        how: [
            'Pick a starting shape (triangle, L-shape or arrow — chosen to make rotations and reflections obvious).',
            'Stack transformations in order: translate by (x, y), dilate about the origin, rotate about the origin, or reflect over the x-axis, y-axis or the line y = x.',
            'The dashed faded shape is always the original; the solid shape is the cumulative result of your steps.',
            'Remove any single step or clear them all to compare.'
        ]
    },
    {
        icon: '≤',
        title: 'Inequalities',
        to: '/inequalities',
        what: 'Shades the region defined by an inequality such as y < 2x + 1, and shows where multiple regions overlap.',
        how: [
            'Choose an operator (<, ≤, >, ≥) and type the right-hand side as a function of x.',
            'The tool samples the boundary across the view and fills the region above or below it.',
            'A solid boundary means the line is included (≤ or ≥); a dashed boundary means it is excluded (< or >).',
            'Overlapping regions shade darker, so intersections of several inequalities are easy to see.'
        ]
    },
    {
        icon: '🎨',
        title: 'Themes',
        to: '/themes',
        what: 'Six built-in looks for the whole site — dark, light and a high-contrast option.',
        how: [
            'Every color on the site comes from a set of CSS variables, so switching a theme re-skins everything at once, including the calculator.',
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
                <div className="guide-list">
                    {filtered.map(section => (
                <section key={section.to} className="panel guide-section">
                    <div className="guide-section-head">
                        <span className="guide-icon">{section.icon}</span>
                        <div>
                            <h2>{section.title}</h2>
                            <p className="guide-what">{section.what}</p>
                        </div>
                        <Link to={section.to} className="btn ghost guide-open">Open →</Link>
                    </div>
                            <ul className="guide-how">
                                {section.how.map((step, i) => <li key={i}>{step}</li>)}
                            </ul>
                        </section>
                    ))}
                </div>
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

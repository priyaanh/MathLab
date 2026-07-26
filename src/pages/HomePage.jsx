import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { buildVocab, suggest } from '../utils/search'

const TOOLS = [
    { to: '/scientific', icon: '🧮', title: 'Scientific Calculator', desc: 'Trig, logs, memory, powers and full expression editing with keyboard support.', keywords: 'calculator arithmetic trig sin cos tan log memory powers factorial' },
    { to: '/exercises', icon: '🎯', title: 'Exercises', desc: 'Khan-style practice from early math to college — fresh problems, instant checks, mastery streaks.', keywords: 'exercises practice problems quiz drill test mastery skills learn khan grade school algebra calculus' },
    { to: '/graph', icon: '📈', title: 'Function Grapher', desc: 'Plot y = f(x): multiple curves, zeros, intersections, trace and value tables.', keywords: 'graph plot function curve zeros roots intersection trace table' },
    { to: '/lines', icon: '📏', title: 'Lines & Segments', desc: 'Plot lines and segments from equations or points. See slope, length, midpoint.', keywords: 'line segment slope intercept midpoint length distance equation' },
    { to: '/shapes', icon: '⬡', title: 'Shapes', desc: 'Draw circles and polygons. Instantly compute area and perimeter.', keywords: 'shape circle rectangle polygon area perimeter geometry' },
    { to: '/transformations', icon: '🔄', title: 'Transformations', desc: 'Translate, dilate, rotate and reflect a shape. See pre-image vs image.', keywords: 'transform transformations translate dilate rotate reflect reflection image preimage geometry' },
    { to: '/inequalities', icon: '≤', title: 'Inequalities', desc: 'Shade regions like y < 2x + 1 and combine multiple constraints.', keywords: 'inequality region shade greater less than constraint' },
    { to: '/solve', icon: '🟰', title: 'Equation Solver', desc: 'Solve linear, quadratic and 2×2 systems with full step-by-step working.', keywords: 'solve equation linear quadratic system roots discriminant steps algebra' },
    { to: '/derivative', icon: '∂', title: 'Derivative Calculator', desc: 'Differentiate f(x) symbolically, see the rules used, and view the tangent line.', keywords: 'derivative differentiate calculus slope tangent rate of change power product quotient chain rule' },
    { to: '/triangle', icon: '△', title: 'Triangle Solver', desc: 'Solve any triangle from sides/angles — law of sines & cosines, area, drawn to scale.', keywords: 'triangle solver trigonometry law of sines cosines angle side area perimeter SSS SAS ASA' },
    { to: '/units', icon: '📐', title: 'Unit Converter', desc: 'Convert length, mass, temperature, area, volume, speed, time, data and angle.', keywords: 'unit convert conversion length mass temperature area volume speed time data angle metric imperial' },
    { to: '/statistics', icon: '📊', title: 'Statistics', desc: 'Paste data for mean, median, mode, quartiles, std dev and a histogram.', keywords: 'statistics mean median mode range variance standard deviation quartile histogram data' },
    { to: '/matrix', icon: '▦', title: 'Matrix Calculator', desc: 'Add, multiply, transpose, invert and find determinants and rank.', keywords: 'matrix matrices determinant inverse transpose multiply rank linear algebra' },
    { to: '/bases', icon: '💻', title: 'Base Converter', desc: 'Convert between binary, octal, decimal, hex and any base, plus bitwise ops.', keywords: 'base binary octal decimal hexadecimal hex bitwise convert number programmer and or xor' },
    { to: '/constants', icon: '🔬', title: 'Constants Library', desc: 'Search math, physics and astronomical constants and copy their values.', keywords: 'constants pi e phi speed of light planck avogadro gravity physics math reference' },
    { to: '/themes', icon: '🎨', title: 'Themes', desc: 'Six built-in looks — dark, light and high-contrast. Switch anytime.', keywords: 'theme dark light color contrast appearance style' },
    { to: '/guide', icon: '📖', title: 'Guide', desc: 'Learn what every tool does and how it works under the hood.', keywords: 'guide help docs documentation how to explanation' }
]

const VOCAB = buildVocab(TOOLS.map(t => `${t.title} ${t.desc} ${t.keywords}`))

const HomePage = () => {
    const [query, setQuery] = useState('')

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return TOOLS
        return TOOLS.filter(t =>
            (t.title + ' ' + t.desc + ' ' + t.keywords).toLowerCase().includes(q)
        )
    }, [query])

    const suggestion = useMemo(
        () => (filtered.length === 0 ? suggest(query, VOCAB) : null),
        [filtered.length, query]
    )

    return (
        <div>
            <header className="hero">
                <h1>Your all-in-one <span className="grad">math lab</span></h1>
                <p>A stylish home for calculating, graphing and exploring geometry — with tools that stay useful all the way from grade school to college.</p>
                <div className="hero-cta">
                    <Link to="/exercises" className="btn primary btn-xl">🎯 Start practicing</Link>
                    <Link to="/scientific" className="btn ghost">Open Calculator</Link>
                    <Link to="/guide" className="btn ghost">See the math roadmap</Link>
                </div>
            </header>

            <div className="tool-search">
                <div className="tool-search-box">
                    <span className="search-icon" aria-hidden="true">🔍</span>
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tools…  (try “slope”, “area”, “graph”)"
                        aria-label="Search tools"
                    />
                    {query && (
                        <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
                    )}
                </div>
            </div>

            {filtered.length > 0 ? (
                <section className="card-grid">
                    {filtered.map(tool => (
                        <Link key={tool.to} to={tool.to} className="tool-card">
                            <span className="icon">{tool.icon}</span>
                            <h3>{tool.title}</h3>
                            <p>{tool.desc}</p>
                            <span className="go">Open →</span>
                        </Link>
                    ))}
                </section>
            ) : (
                <p className="no-results">
                    No tools match “{query}”.
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
            )}
        </div>
    )
}

export default HomePage

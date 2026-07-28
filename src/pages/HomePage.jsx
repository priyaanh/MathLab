import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { buildVocab, suggest } from '../utils/search'
import HomeDashboard from '../components/HomeDashboard'

const TOOLS = [
    { to: '/scientific', icon: '🧮', title: 'Scientific Calculator', desc: 'Trig, logs, memory, powers and full expression editing with keyboard support.', keywords: 'calculator arithmetic trig sin cos tan log memory powers factorial' },
    { to: '/exercises', icon: '🎯', title: 'Exercises', desc: 'Guided practice from early math to college — fresh problems, instant checks, mastery streaks.', keywords: 'exercises practice problems quiz drill test mastery skills learn grade school algebra calculus' },
    { to: '/quiz', icon: '📝', title: 'Quiz', desc: 'A scored, timed-feel run of fresh problems by topic — see your score and review misses.', keywords: 'quiz test scored exam questions review challenge practice mixed topics' },
    { to: '/graph', icon: '📈', title: 'Function Grapher', desc: 'Plot y = f(x): multiple curves, zeros, intersections, trace and value tables.', keywords: 'graph plot function curve zeros roots intersection trace table' },
    { to: '/lines', icon: '📏', title: 'Lines & Segments', desc: 'Plot lines and segments from equations or points. See slope, length, midpoint.', keywords: 'line segment slope intercept midpoint length distance equation' },
    { to: '/shapes', icon: '⬡', title: 'Shapes', desc: 'Draw circles and polygons. Instantly compute area and perimeter.', keywords: 'shape circle rectangle polygon area perimeter geometry' },
    { to: '/transformations', icon: '🔄', title: 'Transformations', desc: 'Translate, dilate, rotate and reflect a shape. See pre-image vs image.', keywords: 'transform transformations translate dilate rotate reflect reflection image preimage geometry' },
    { to: '/inequalities', icon: '≤', title: 'Inequalities', desc: 'Shade regions like y < 2x + 1 and combine multiple constraints.', keywords: 'inequality region shade greater less than constraint' },
    { to: '/solve', icon: '🟰', title: 'Equation Solver', desc: 'Solve linear, quadratic and 2×2 systems with full step-by-step working.', keywords: 'solve equation linear quadratic system roots discriminant steps algebra' },
    { to: '/derivative', icon: '∂', title: 'Derivative Calculator', desc: 'Differentiate f(x) symbolically, see the rules used, and view the tangent line.', keywords: 'derivative differentiate calculus slope tangent rate of change power product quotient chain rule' },
    { to: '/complex', icon: '𝑖', title: 'Complex Numbers', desc: 'Add, multiply and divide a + bi; get modulus, argument, polar form and an Argand diagram.', keywords: 'complex number imaginary i argand modulus argument polar conjugate real' },
    { to: '/fractions', icon: '½', title: 'Fractions', desc: 'Add, subtract, multiply and divide fractions with steps, mixed numbers and decimals.', keywords: 'fraction fractions add subtract multiply divide simplify reduce mixed number decimal numerator denominator' },
    { to: '/sequences', icon: '∑', title: 'Sequences & Series', desc: 'Arithmetic and geometric sequences: nth term, partial and infinite sums, term lists.', keywords: 'sequence series arithmetic geometric nth term sum partial infinite common difference ratio progression' },
    { to: '/numbertheory', icon: '#️⃣', title: 'Number Theory', desc: 'Prime factorization, divisors, GCD & LCM, prime sieve and perfect-square checks.', keywords: 'number theory prime factorization factors divisors gcd lcm greatest common divisor least common multiple sieve composite' },
    { to: '/probability', icon: '🎲', title: 'Probability', desc: 'Factorials, permutations, combinations, simple probability and binomial distributions.', keywords: 'probability combinatorics permutation combination factorial nPr nCr binomial chance odds counting' },
    { to: '/triangle', icon: '△', title: 'Triangle Solver', desc: 'Solve any triangle from sides/angles — law of sines & cosines, area, drawn to scale.', keywords: 'triangle solver trigonometry law of sines cosines angle side area perimeter SSS SAS ASA' },
    { to: '/units', icon: '📐', title: 'Unit Converter', desc: 'Convert length, mass, temperature, area, volume, speed, time, data and angle.', keywords: 'unit convert conversion length mass temperature area volume speed time data angle metric imperial' },
    { to: '/statistics', icon: '📊', title: 'Statistics', desc: 'Paste data for mean, median, mode, quartiles, std dev and a histogram.', keywords: 'statistics mean median mode range variance standard deviation quartile histogram data' },
    { to: '/distribution', icon: '🔔', title: 'Distribution Plotter', desc: 'Plot Normal, Binomial and Poisson distributions with mean, spread and probability queries.', keywords: 'distribution normal binomial poisson probability pdf pmf bell curve mean variance gaussian' },
    { to: '/matrix', icon: '▦', title: 'Matrix Calculator', desc: 'Add, multiply, transpose, invert and find determinants and rank.', keywords: 'matrix matrices determinant inverse transpose multiply rank linear algebra' },
    { to: '/bases', icon: '💻', title: 'Base Converter', desc: 'Convert between binary, octal, decimal, hex and any base, plus bitwise ops.', keywords: 'base binary octal decimal hexadecimal hex bitwise convert number programmer and or xor' },
    { to: '/constants', icon: '🔬', title: 'Constants Library', desc: 'Search math, physics and astronomical constants and copy their values.', keywords: 'constants pi e phi speed of light planck avogadro gravity physics math reference' },
    { to: '/themes', icon: '🎨', title: 'Themes', desc: 'Six built-in looks — dark, light and high-contrast. Switch anytime.', keywords: 'theme dark light color contrast appearance style' },
    { to: '/guide', icon: '📖', title: 'Guide', desc: 'Learn what every tool does and how it works under the hood.', keywords: 'guide help docs documentation how to explanation' }
]

const VOCAB = buildVocab(TOOLS.map(t => `${t.title} ${t.desc} ${t.keywords}`))

// Users can drag the tool cards into any order; the choice is remembered.
const TOOL_ORDER_KEY = 'mathlab-tool-order'

const loadToolOrder = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(TOOL_ORDER_KEY) || 'null')
        if (!Array.isArray(saved)) return TOOLS
        const byTo = new Map(TOOLS.map(t => [t.to, t]))
        const ordered = saved.map(to => byTo.get(to)).filter(Boolean)
        const seen = new Set(saved)
        for (const t of TOOLS) if (!seen.has(t.to)) ordered.push(t)   // append new tools
        return ordered.length ? ordered : TOOLS
    } catch {
        return TOOLS
    }
}

const saveToolOrder = (tools) => {
    try { localStorage.setItem(TOOL_ORDER_KEY, JSON.stringify(tools.map(t => t.to))) } catch { /* ignore */ }
}

const HomePage = () => {
    const [query, setQuery] = useState('')
    const [tools, setTools] = useState(loadToolOrder)
    const [dragging, setDragging] = useState(null)
    const fromRef = useRef(null)

    const q = query.trim().toLowerCase()
    const canReorder = q === ''

    const filtered = useMemo(() => {
        if (!q) return tools
        return tools.filter(t =>
            (t.title + ' ' + t.desc + ' ' + t.keywords).toLowerCase().includes(q)
        )
    }, [q, tools])

    // --- drag-to-reorder (only when not filtering) ---------------------
    const onDragStart = (i) => (e) => {
        fromRef.current = i
        setDragging(i)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', tools[i].to)
    }

    const onDragEnter = (i) => () => {
        const from = fromRef.current
        if (from === null || from === i) return
        setTools(prev => {
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
        setTools(prev => { saveToolOrder(prev); return prev })
    }

    const resetOrder = () => {
        setTools(TOOLS)
        saveToolOrder(TOOLS)
    }

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
                    <Link to="/exercises" className="btn primary btn-xl"><span className="btn-ico" aria-hidden="true">🎯</span> Start practicing</Link>
                    <Link to="/scientific" className="btn ghost">Open Calculator</Link>
                    <Link to="/guide" className="btn ghost">See the math roadmap</Link>
                </div>
            </header>

            <HomeDashboard />

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
                {canReorder && (
                    <div className="tool-reorder-hint">
                        <span>Drag the cards to arrange your tools</span>
                        <button type="button" className="did-you-mean" onClick={resetOrder}>↺ Reset order</button>
                    </div>
                )}
            </div>

            {filtered.length > 0 ? (
                <section className="card-grid">
                    {filtered.map(tool => {
                        const i = tools.indexOf(tool)
                        return (
                            <Link
                                key={tool.to}
                                to={tool.to}
                                className={`tool-card${dragging === i ? ' dragging' : ''}`}
                                draggable={canReorder}
                                onDragStart={canReorder ? onDragStart(i) : undefined}
                                onDragEnter={canReorder ? onDragEnter(i) : undefined}
                                onDragOver={canReorder ? (e) => e.preventDefault() : undefined}
                                onDragEnd={canReorder ? onDragEnd : undefined}
                                onDrop={canReorder ? (e) => e.preventDefault() : undefined}
                            >
                                <span className="icon">{tool.icon}</span>
                                <h3>{tool.title}</h3>
                                <p>{tool.desc}</p>
                                <span className="go">Open →</span>
                            </Link>
                        )
                    })}
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

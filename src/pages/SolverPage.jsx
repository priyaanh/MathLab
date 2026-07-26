import { useState, useMemo } from 'react'

/**
 * Equation Solver — linear, quadratic and 2x2 systems, with step-by-step
 * working. The user types equations directly (copy/paste friendly) instead of
 * filling in coefficient boxes. Self-contained; styling via site classes + vars.
 */

// Trim float noise for display.
const fmt = (n) => {
    if (!Number.isFinite(n)) return '—'
    return String(parseFloat(n.toPrecision(10)))
}

// Signed term helper e.g. "- 3" / "+ 3" for readable equations.
const signed = (n) => (n < 0 ? `- ${fmt(Math.abs(n))}` : `+ ${fmt(n)}`)

// ---- Equation parsing --------------------------------------------------
// Parse one side of an equation into coefficients { x2, x, y, c }.
// Accepts implicit multiplication (2x), * · ×, ^ powers, ² superscripts,
// unicode minus, and blank -> 0.
function parseSide(side, vars) {
    let s = String(side)
        .replace(/\s+/g, '')
        .replace(/−/g, '-')   // unicode minus
        .replace(/²/g, '^2')  // ² superscript
        .replace(/[·×*]/g, '')     // drop explicit multiplication signs
        .toLowerCase()

    const acc = { x2: 0, x: 0, y: 0, c: 0 }
    if (s === '') return acc
    if (s[0] !== '+' && s[0] !== '-') s = '+' + s

    const terms = s.match(/[+-][^+-]*/g) || []
    for (const t of terms) {
        const sign = t[0] === '-' ? -1 : 1
        const body = t.slice(1)
        if (body === '') continue
        const m = body.match(/^(\d*\.?\d*)([a-z])?(?:\^(\d+))?$/)
        if (!m) throw new Error(`Couldn't read "${t}".`)
        const [, numStr, v, powStr] = m
        let coef = numStr === '' ? 1 : parseFloat(numStr)
        if (Number.isNaN(coef)) throw new Error(`Couldn't read the number in "${t}".`)
        coef *= sign
        if (!v) { acc.c += coef; continue }
        if (!vars.includes(v)) throw new Error(`Unexpected variable "${v}". Use ${vars.join(', ')}.`)
        const p = powStr ? parseInt(powStr, 10) : 1
        if (v === 'x') {
            if (p === 1) acc.x += coef
            else if (p === 2) acc.x2 += coef
            else throw new Error(`Powers above 2 aren't supported (got x^${p}).`)
        } else {
            if (p !== 1) throw new Error(`Only linear ${v} is supported (got ${v}^${p}).`)
            acc.y += coef
        }
    }
    return acc
}

// Parse a full "lhs = rhs" equation into net coefficients (lhs − rhs = 0).
// Missing "=" is treated as "= 0".
function parseEquation(input, vars) {
    const raw = String(input).trim()
    if (raw === '') throw new Error('Enter an equation.')
    const sides = raw.split('=')
    if (sides.length > 2) throw new Error('Use at most one "=" sign.')
    const lhs = parseSide(sides[0], vars)
    const rhs = sides.length === 2 ? parseSide(sides[1], vars) : { x2: 0, x: 0, y: 0, c: 0 }
    return { x2: lhs.x2 - rhs.x2, x: lhs.x - rhs.x, y: lhs.y - rhs.y, c: lhs.c - rhs.c }
}

const MODES = [
    { key: 'single', label: 'Single equation' },
    { key: 'system', label: 'System 2×2' }
]

const EXAMPLES = {
    single: ['2x + 3 = 7', 'x^2 - 5x + 6 = 0', '3x + 2 = 5x - 4', 'x² = 9'],
    system: [['x + y = 2', 'x - y = 0'], ['2x + 3y = 12', 'x - y = 1']]
}

const SolverPage = () => {
    const [mode, setMode] = useState('single')
    const [eq, setEq] = useState('x^2 - 5x + 6 = 0')
    const [eq1, setEq1] = useState('x + y = 2')
    const [eq2, setEq2] = useState('x - y = 0')
    const [copied, setCopied] = useState(false)

    const result = useMemo(() => {
        try {
            if (mode === 'single') {
                const p = parseEquation(eq, ['x'])
                if (p.y !== 0) throw new Error('Use only x here. Switch to "System 2×2" for x and y.')
                if (p.x2 !== 0) return solveQuadratic(p.x2, p.x, p.c)
                return solveLinear(p.x, p.c)
            }
            const p1 = parseEquation(eq1, ['x', 'y'])
            const p2 = parseEquation(eq2, ['x', 'y'])
            if (p1.x2 !== 0 || p2.x2 !== 0) throw new Error('The system solver handles linear equations only (no x²).')
            return solveSystem(p1, p2)
        } catch (e) {
            return { error: e.message, title: 'Result', ok: false, steps: [], answer: '', extra: [] }
        }
    }, [mode, eq, eq1, eq2])

    const copyAnswer = () => {
        if (!result.answer) return
        navigator.clipboard?.writeText(result.answer).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
        }).catch(() => {})
    }

    return (
        <div className="page">
            <div className="page-head">
                <h1>Equation Solver</h1>
                <p>Type an equation and get the answer with full step-by-step working. Paste is welcome.</p>
            </div>

            <div className="seg-control">
                {MODES.map((m) => (
                    <button
                        key={m.key}
                        className={mode === m.key ? 'active' : ''}
                        onClick={() => setMode(m.key)}
                        aria-pressed={mode === m.key}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Equation</h2>

                    {mode === 'single' ? (
                        <>
                            <div className="hint">
                                Type an equation in <code>x</code> — linear or quadratic. You can use
                                {' '}<code>^</code> for powers (e.g. <code>x^2</code>). No <code>=</code> means <code>= 0</code>.
                            </div>
                            <input
                                className="eq-input"
                                type="text"
                                value={eq}
                                onChange={(e) => setEq(e.target.value)}
                                placeholder="e.g.  x^2 - 5x + 6 = 0"
                                spellCheck={false}
                                autoComplete="off"
                                aria-label="Equation in x"
                            />
                            <div className="eq-examples">
                                {EXAMPLES.single.map((ex) => (
                                    <button key={ex} type="button" className="eq-chip" onClick={() => setEq(ex)}>{ex}</button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="hint">Type two linear equations in <code>x</code> and <code>y</code>.</div>
                            <input
                                className="eq-input"
                                type="text"
                                value={eq1}
                                onChange={(e) => setEq1(e.target.value)}
                                placeholder="e.g.  x + y = 2"
                                spellCheck={false}
                                autoComplete="off"
                                aria-label="First equation"
                            />
                            <input
                                className="eq-input"
                                type="text"
                                value={eq2}
                                onChange={(e) => setEq2(e.target.value)}
                                placeholder="e.g.  x - y = 0"
                                spellCheck={false}
                                autoComplete="off"
                                aria-label="Second equation"
                                style={{ marginTop: '0.5rem' }}
                            />
                            <div className="eq-examples">
                                {EXAMPLES.system.map((pair, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className="eq-chip"
                                        onClick={() => { setEq1(pair[0]); setEq2(pair[1]) }}
                                    >
                                        {pair[0]}, {pair[1]}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {result.error && (
                        <div className="hint" style={{ color: 'var(--danger)', marginTop: '0.6rem' }}>
                            {result.error}
                        </div>
                    )}
                </div>

                <div className="panel">
                    <h2>{result.title}</h2>

                    {result.error ? (
                        <p style={{ color: 'var(--text-muted)' }}>Fix the equation to see the solution.</p>
                    ) : (
                        <>
                            <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                {result.steps.map((s, i) => (
                                    <li key={i} style={{ color: 'var(--text)', lineHeight: 1.5 }}>{s}</li>
                                ))}
                            </ol>

                            <div
                                style={{
                                    marginTop: '1rem',
                                    padding: '0.9rem 1rem',
                                    borderRadius: '12px',
                                    border: `1px solid ${result.ok ? 'var(--success)' : 'var(--border)'}`,
                                    background: 'var(--surface-2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '1rem'
                                }}
                                aria-live="polite"
                            >
                                <span style={{
                                    color: result.ok ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: 700,
                                    fontSize: '1.05rem'
                                }}>
                                    {result.answer}
                                </span>
                                {result.answer && (
                                    <button type="button" className="eq-chip" onClick={copyAnswer}>
                                        {copied ? 'Copied ✓' : 'Copy'}
                                    </button>
                                )}
                            </div>

                            {result.extra && result.extra.length > 0 && (
                                <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {result.extra.map((x, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.9rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{x.k}</span>
                                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{x.v}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

// ---- Solvers -----------------------------------------------------------
// All solvers take numeric coefficients from the parsed equation (lhs − rhs = 0).

function solveLinear(a, b) {
    const steps = [`Rearrange to standard form: ${fmt(a)}x ${signed(b)} = 0`]

    if (a === 0) {
        if (b === 0) {
            return {
                title: 'Linear result', ok: false,
                steps: [...steps, 'The x term vanished and 0 = 0, which is always true.'],
                answer: 'Infinitely many solutions (any x).', extra: []
            }
        }
        return {
            title: 'Linear result', ok: false,
            steps: [...steps, `The x term vanished and ${fmt(b)} = 0, which is never true.`],
            answer: 'No solution.', extra: []
        }
    }

    const x = -b / a
    return {
        title: 'Linear result', ok: true,
        steps: [
            ...steps,
            `Subtract ${fmt(b)} from both sides: ${fmt(a)}x = ${fmt(-b)}`,
            `Divide both sides by ${fmt(a)}: x = ${fmt(-b)} / ${fmt(a)}`,
            `x = ${fmt(x)}`
        ],
        answer: `x = ${fmt(x)}`,
        extra: []
    }
}

function solveQuadratic(a, b, c) {
    // Degenerate: not actually quadratic -> fall back to linear bx + c = 0.
    if (a === 0) {
        const lin = solveLinear(b, c)
        return {
            ...lin,
            title: 'Quadratic result',
            steps: ['a = 0, so this is not quadratic. Solving bx + c = 0 instead.', ...lin.steps]
        }
    }

    const disc = b * b - 4 * a * c
    const vx = -b / (2 * a)
    const vy = a * vx * vx + b * vx + c
    const sum = -b / a
    const prod = c / a
    const steps = [
        `Standard form: ${fmt(a)}x² ${signed(b)}x ${signed(c)} = 0`,
        `Discriminant Δ = b² − 4ac = (${fmt(b)})² − 4(${fmt(a)})(${fmt(c)}) = ${fmt(disc)}`
    ]

    let answer, ok
    if (disc > 0) {
        const r = Math.sqrt(disc)
        const x1 = (-b + r) / (2 * a)
        const x2 = (-b - r) / (2 * a)
        steps.push(`Δ > 0 → two distinct real roots.`)
        steps.push(`x = (−b ± √Δ) / 2a = (${fmt(-b)} ± ${fmt(r)}) / ${fmt(2 * a)}`)
        steps.push(`x₁ = ${fmt(x1)},  x₂ = ${fmt(x2)}`)
        answer = `x₁ = ${fmt(x1)},  x₂ = ${fmt(x2)}`
        ok = true
    } else if (disc === 0) {
        const x1 = -b / (2 * a)
        steps.push(`Δ = 0 → one repeated real root.`)
        steps.push(`x = −b / 2a = ${fmt(-b)} / ${fmt(2 * a)}`)
        steps.push(`x = ${fmt(x1)}`)
        answer = `x = ${fmt(x1)} (double root)`
        ok = true
    } else {
        const re = -b / (2 * a)
        const im = Math.sqrt(-disc) / (2 * a)
        steps.push(`Δ < 0 → no real roots; two complex conjugate roots.`)
        steps.push(`x = (−b ± √Δ) / 2a with √Δ = ${fmt(Math.sqrt(-disc))}i`)
        steps.push(`x = ${fmt(re)} ± ${fmt(Math.abs(im))}i`)
        answer = `x = ${fmt(re)} ± ${fmt(Math.abs(im))}i`
        ok = false
    }

    return {
        title: 'Quadratic result', ok, steps, answer,
        extra: [
            { k: 'Vertex', v: `(${fmt(vx)}, ${fmt(vy)})` },
            { k: 'Axis of symmetry', v: `x = ${fmt(vx)}` },
            { k: 'Sum of roots (−b/a)', v: fmt(sum) },
            { k: 'Product of roots (c/a)', v: fmt(prod) }
        ]
    }
}

function solveSystem(p1, p2) {
    // Each parsed equation is (x·p.x + y·p.y + p.c = 0) → a·x + b·y = c.
    const A1 = p1.x, B1 = p1.y, C1 = -p1.c
    const A2 = p2.x, B2 = p2.y, C2 = -p2.c

    const D = A1 * B2 - A2 * B1
    const Dx = C1 * B2 - C2 * B1
    const Dy = A1 * C2 - A2 * C1
    const steps = [
        `System: ${fmt(A1)}x ${signed(B1)}y = ${fmt(C1)};  ${fmt(A2)}x ${signed(B2)}y = ${fmt(C2)}`,
        `D = a₁b₂ − a₂b₁ = (${fmt(A1)})(${fmt(B2)}) − (${fmt(A2)})(${fmt(B1)}) = ${fmt(D)}`
    ]

    if (D === 0) {
        if (Dx === 0 && Dy === 0) {
            return {
                title: 'System result', ok: false,
                steps: [...steps, 'D = 0 and Dx = Dy = 0 → equations are dependent (same line).'],
                answer: 'Infinitely many solutions (dependent system).', extra: []
            }
        }
        return {
            title: 'System result', ok: false,
            steps: [...steps, `D = 0 but Dx = ${fmt(Dx)}, Dy = ${fmt(Dy)} → lines are parallel.`],
            answer: 'No solution (inconsistent system).', extra: []
        }
    }

    const x = Dx / D
    const y = Dy / D
    return {
        title: 'System result', ok: true,
        steps: [
            ...steps,
            `Dx = c₁b₂ − c₂b₁ = ${fmt(Dx)}`,
            `Dy = a₁c₂ − a₂c₁ = ${fmt(Dy)}`,
            `x = Dx / D = ${fmt(Dx)} / ${fmt(D)} = ${fmt(x)}`,
            `y = Dy / D = ${fmt(Dy)} / ${fmt(D)} = ${fmt(y)}`
        ],
        answer: `x = ${fmt(x)},  y = ${fmt(y)}`,
        extra: []
    }
}

export default SolverPage

import { useState, useMemo } from 'react'
import { parseEquation, solveLinear, solveQuadratic, solveSystem, solveGeneral } from '../utils/equation'

/**
 * Equation Solver — linear, quadratic and 2x2 systems, with step-by-step
 * working. The user types equations directly (copy/paste friendly) instead of
 * filling in coefficient boxes. Parsing/solving logic lives in utils/equation.
 */

const MODES = [
    { key: 'single', label: 'Single equation' },
    { key: 'system', label: 'System 2×2' }
]

const EXAMPLES = {
    single: ['2x + 3 = 7', 'x^2 - 5x + 6 = 0', 'x^3 - 4x = 0', 'x^5 - x = 2', 'sqrt(x) = 3', 'x^2 = 2'],
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
                // Exact path for clean linear/quadratic (nice step-by-step);
                // otherwise fall back to the general numeric solver, which
                // handles square roots, cubes, and any higher power.
                try {
                    const p = parseEquation(eq, ['x'])
                    if (p.y !== 0) throw new Error('Use only x here. Switch to "System 2×2" for x and y.')
                    if (p.x2 !== 0) return solveQuadratic(p.x2, p.x, p.c)
                    return solveLinear(p.x, p.c)
                } catch (exactErr) {
                    if (/Use only x/.test(exactErr.message)) throw exactErr
                    return solveGeneral(eq)
                }
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
                                Type an equation in <code>x</code>. Use <code>^</code> for any power
                                (<code>x^2</code>, <code>x^5</code>) and <code>sqrt( )</code> or <code>√</code> for roots.
                                Higher-degree and root equations are solved numerically. No <code>=</code> means <code>= 0</code>.
                            </div>
                            <input
                                className="eq-input"
                                data-keypad="full"
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
                                data-keypad="full"
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
                                data-keypad="full"
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

export default SolverPage

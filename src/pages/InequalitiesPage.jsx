import { useState, useRef, useEffect, useCallback } from 'react'
import { makeView, drawGrid, prepareHiDPICanvas } from '../utils/plane'
import { validateFunction, getYAtX } from '../utils/graphUtils'
import { useThemeContext } from '../theme/ThemeContext'

const COLORS = ['#ff7a1a', '#22d3ee', '#a78bfa', '#4ade80', '#fb7185', '#fbbf24']
const VIEW = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }
const W = 680
const H = 480

const OPERATORS = ['<', '≤', '>', '≥']
const PRESETS = [
    { op: '<', expr: '2x + 1' },
    { op: '≥', expr: 'x^2 - 3' },
    { op: '<', expr: 'sin(x) + 2' }
]

let uid = 0

const InequalitiesPage = () => {
    const { themeKey } = useThemeContext()
    const canvasRef = useRef(null)

    const [op, setOp] = useState('<')
    const [expr, setExpr] = useState('2x + 1')
    const [error, setError] = useState('')
    const [items, setItems] = useState([
        { id: ++uid, op: '<', expr: '2x + 1', color: COLORS[0] }
    ])

    const addItem = useCallback(() => {
        const check = validateFunction(expr)
        if (!check.valid) {
            setError(check.error || 'Invalid expression')
            return
        }
        setError('')
        const color = COLORS[items.length % COLORS.length]
        setItems(prev => [...prev, { id: ++uid, op, expr, color }])
    }, [expr, op, items.length])

    const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = prepareHiDPICanvas(canvas, W, H)
        const v = makeView(W, H, VIEW)
        drawGrid(ctx, v)

        items.forEach(item => {
            const isAbove = item.op === '>' || item.op === '≥'
            const strict = item.op === '<' || item.op === '>'

            // Shade the region column by column.
            ctx.fillStyle = item.color + '2e' // ~18% alpha
            for (let px = 0; px <= W; px++) {
                const gx = v.fromX(px)
                const y = getYAtX(item.expr, gx)
                if (isNaN(y)) continue
                const boundaryPy = v.toY(y)
                if (isAbove) {
                    ctx.fillRect(px, 0, 1, Math.max(0, boundaryPy))
                } else {
                    ctx.fillRect(px, boundaryPy, 1, Math.max(0, H - boundaryPy))
                }
            }

            // Boundary curve (dashed if strict)
            ctx.strokeStyle = item.color
            ctx.lineWidth = 2.5
            ctx.setLineDash(strict ? [7, 5] : [])
            ctx.beginPath()
            let started = false
            for (let px = 0; px <= W; px++) {
                const gx = v.fromX(px)
                const y = getYAtX(item.expr, gx)
                if (isNaN(y)) { started = false; continue }
                const py = v.toY(y)
                if (!started) { ctx.moveTo(px, py); started = true }
                else ctx.lineTo(px, py)
            }
            ctx.stroke()
            ctx.setLineDash([])
        })
    }, [items, themeKey])

    return (
        <div className="page">
            <div className="page-head">
                <h1>Inequalities</h1>
                <p>Shade regions such as <code>y &lt; 2x + 1</code>. Add several to see where they overlap — solid boundaries include the line, dashed exclude it.</p>
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Add inequality</h2>

                    <div className="seg-control">
                        {OPERATORS.map(o => (
                            <button key={o} className={op === o ? 'active' : ''} onClick={() => setOp(o)}>y {o}</button>
                        ))}
                    </div>

                    <label className="field">
                        f(x)
                        <input
                            type="text"
                            value={expr}
                            onChange={(e) => setExpr(e.target.value)}
                            placeholder="e.g. 2x + 1, x^2 - 3, sin(x)"
                            onKeyDown={(e) => e.key === 'Enter' && addItem()}
                        />
                    </label>

                    {error && <div className="hint" style={{ color: 'var(--danger)' }}>{error}</div>}

                    <div className="row" style={{ marginTop: '0.6rem' }}>
                        {PRESETS.map((p, i) => (
                            <button key={i} className="btn ghost" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                                onClick={() => { setOp(p.op); setExpr(p.expr); setError('') }}>
                                y {p.op} {p.expr}
                            </button>
                        ))}
                    </div>

                    <button className="btn primary" style={{ marginTop: '0.9rem', width: '100%' }} onClick={addItem}>+ Add region</button>

                    <div className="item-list">
                        {items.map(item => (
                            <div key={item.id} className="item">
                                <span className="swatch" style={{ background: item.color }} />
                                <span className="grow">y {item.op} {item.expr}</span>
                                <button onClick={() => removeItem(item.id)} title="Remove">×</button>
                            </div>
                        ))}
                    </div>

                    <div className="hint">Supported: sin, cos, tan, log, ln, sqrt, abs, exp, x^n, pi, e</div>
                </div>

                <div className="canvas-frame">
                    <canvas ref={canvasRef} width={W} height={H} aria-label="Inequality regions plot" />
                </div>
            </div>
        </div>
    )
}

export default InequalitiesPage

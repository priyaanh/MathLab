import { useState, useRef, useEffect, useCallback } from 'react'
import { makeView, drawGrid, prepareHiDPICanvas } from '../utils/plane'
import { getYAtX } from '../utils/graphUtils'
import { useThemeContext } from '../theme/ThemeContext'
import { usePlaneView, bindWheelZoom, useKeyboardPan } from '../hooks/usePlaneView'
import PlaneControls from '../components/PlaneControls'

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
    const { view, pan, zoom, zoomAt, reset, canZoomIn, canZoomOut } = usePlaneView(VIEW)
    useKeyboardPan(canvasRef, view, { pan, zoomAt, reset })

    const [items, setItems] = useState([
        { id: ++uid, op: '<', expr: '2x + 1', color: COLORS[0] }
    ])

    // Add an empty region the user then fills in — no pre-generated expression.
    const addItem = useCallback(() => {
        setItems(prev => [...prev, { id: ++uid, op: '<', expr: '', color: COLORS[prev.length % COLORS.length] }])
    }, [])

    // Quick-add a worked example from the preset buttons.
    const addPreset = useCallback((p) => {
        setItems(prev => [...prev, { id: ++uid, op: p.op, expr: p.expr, color: COLORS[prev.length % COLORS.length] }])
    }, [])

    // Edit a region in place (operator or boundary expression).
    const updateItem = useCallback((id, patch) => {
        setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)))
    }, [])

    const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = prepareHiDPICanvas(canvas, W, H)
        const v = makeView(W, H, view)
        drawGrid(ctx, v)

        items.forEach(item => {
            if (!item.expr || !item.expr.trim()) return
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
    }, [items, themeKey, view])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        return bindWheelZoom(canvas, (e) => {
            const rect = canvas.getBoundingClientRect()
            const v = makeView(W, H, view)
            const px = ((e.clientX - rect.left) / rect.width) * W
            const py = ((e.clientY - rect.top) / rect.height) * H
            return { gx: v.fromX(px), gy: v.fromY(py) }
        }, zoomAt)
    }, [view, zoomAt])

    return (
        <div className="page">
            <div className="page-head">
                <h1>Inequalities</h1>
                <p>Shade regions such as <code>y &lt; 2x + 1</code>. Add several to see where they overlap — solid boundaries include the line, dashed exclude it.</p>
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Inequalities</h2>
                    <p className="hint" style={{ marginTop: 0 }}>Add a region, then type its boundary and pick a direction. Empty rows are ignored.</p>

                    <div className="item-list">
                        {items.map(item => (
                            <div key={item.id} className="ineq-row">
                                <span className="swatch" style={{ background: item.color }} />
                                <span className="ineq-y">y</span>
                                <select
                                    value={item.op}
                                    onChange={(e) => updateItem(item.id, { op: e.target.value })}
                                    aria-label="Inequality direction"
                                >
                                    {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <input
                                    type="text"
                                    className="ineq-expr"
                                    value={item.expr}
                                    onChange={(e) => updateItem(item.id, { expr: e.target.value })}
                                    placeholder="f(x), e.g. 2x + 1"
                                    aria-label="Boundary function"
                                />
                                <button className="ineq-remove" onClick={() => removeItem(item.id)} title="Remove region" aria-label="Remove region">×</button>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <div className="hint">No regions yet — add one below.</div>
                        )}
                    </div>

                    <button className="btn primary" style={{ marginTop: '0.9rem', width: '100%' }} onClick={addItem}>+ Add region</button>

                    <div className="row" style={{ marginTop: '0.6rem', flexWrap: 'wrap' }}>
                        <span className="hint" style={{ width: '100%', margin: 0 }}>Quick add an example:</span>
                        {PRESETS.map((p, i) => (
                            <button key={i} className="btn ghost" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                                onClick={() => addPreset(p)}>
                                y {p.op} {p.expr}
                            </button>
                        ))}
                    </div>

                    <div className="hint">Supported: sin, cos, tan, log, ln, sqrt, abs, exp, x^n, pi, e</div>
                </div>

                <div className="canvas-frame">
                    <canvas ref={canvasRef} width={W} height={H} aria-label="Inequality regions plot" />
                </div>
                <PlaneControls onZoomIn={() => zoom(1.5)} onZoomOut={() => zoom(0.67)} onPan={pan} onReset={reset} canZoomIn={canZoomIn} canZoomOut={canZoomOut} showFit={false} />
            </div>
        </div>
    )
}

export default InequalitiesPage

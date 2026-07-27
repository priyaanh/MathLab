import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { makeView, drawGrid, drawPoint, cssVar, prepareHiDPICanvas } from '../utils/plane'
import { slope, distance, midpoint, lineEquation } from '../utils/geometry'
import { evaluateFunction, validateFunction } from '../utils/graphUtils'
import { useThemeContext } from '../theme/ThemeContext'
import { usePlaneView, bindWheelZoom, useKeyboardPan, useDragPan } from '../hooks/usePlaneView'
import PlaneControls from '../components/PlaneControls'

const COLORS = ['#ff7a1a', '#22d3ee', '#a78bfa', '#4ade80', '#fb7185', '#fbbf24']
const VIEW = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }
const W = 680
const H = 480

let uid = 0

/**
 * A stat card that reveals a step-by-step explanation of how the value was
 * computed when hovered or focused.
 */
const Stat = ({ label, value, explain, small }) => (
    <div className="stat has-explain" tabIndex={0}>
        <div className="label">
            {label}
            {explain && <span className="explain-icon" aria-hidden="true">ⓘ</span>}
        </div>
        <div className="value" style={small ? { fontSize: '0.95rem' } : undefined}>{value}</div>
        {explain && (
            <div className="explain-pop" role="tooltip">
                <strong>How the calculator got this</strong>
                <span>{explain}</span>
            </div>
        )}
    </div>
)

const LinesPage = () => {
    const { themeKey } = useThemeContext()
    const canvasRef = useRef(null)
    const { view, pan, zoom, zoomAt, reset, fitTo, canZoomIn, canZoomOut } = usePlaneView(VIEW)
    useKeyboardPan(canvasRef, view, { pan, zoomAt, reset })
    useDragPan(canvasRef, view, pan, W, H)

    const [method, setMethod] = useState('points') // 'points' | 'slope' | 'equation'
    const [type, setType] = useState('line')        // 'line' | 'segment'
    const [form, setForm] = useState({ x1: -4, y1: -2, x2: 4, y2: 3, m: 1, b: 0 })
    const [eqText, setEqText] = useState('y = 2x + 3')
    const [eqError, setEqError] = useState('')
    const [items, setItems] = useState([
        { id: ++uid, type: 'segment', x1: -4, y1: -2, x2: 4, y2: 3, color: COLORS[0] }
    ])
    const [selectedId, setSelectedId] = useState(items[0].id)

    const set = (key) => (e) => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) }))

    const addItem = useCallback(() => {
        let pts
        if (method === 'slope') {
            const { m, b } = form
            pts = { x1: 0, y1: b, x2: 1, y2: m + b, type: 'line' }
        } else if (method === 'equation') {
            // Accept "y = 2x + 3", "y=-x", or just "2x + 3". Derive slope and
            // intercept by sampling the right-hand side: b = f(0), m = f(1) - f(0).
            const rhs = eqText.replace(/^\s*y\s*=/i, '').trim()
            if (!validateFunction(rhs).valid) {
                setEqError('Enter a linear equation like  y = 2x + 3')
                return
            }
            const b = evaluateFunction(rhs, 0)
            const m = evaluateFunction(rhs, 1) - b
            if (!Number.isFinite(m) || !Number.isFinite(b)) {
                setEqError('Could not read a line from that equation')
                return
            }
            setEqError('')
            pts = { x1: 0, y1: b, x2: 1, y2: m + b, type: 'line' }
        } else {
            pts = { x1: form.x1, y1: form.y1, x2: form.x2, y2: form.y2, type }
        }
        const color = COLORS[items.length % COLORS.length]
        const item = { id: ++uid, color, ...pts }
        setItems(prev => [...prev, item])
        setSelectedId(item.id)
    }, [method, type, form, eqText, items.length])

    const removeItem = (id) => {
        setItems(prev => prev.filter(i => i.id !== id))
    }

    const selected = items.find(i => i.id === selectedId) || items[0]

    const stats = useMemo(() => {
        if (!selected) return null
        const { x1, y1, x2, y2 } = selected
        const m = slope(x1, y1, x2, y2)
        const mid = midpoint(x1, y1, x2, y2)
        const vertical = x2 === x1
        const r = (n) => Math.round(n * 10000) / 10000
        const dx = x2 - x1
        const dy = y2 - y1
        const bIntercept = vertical ? null : r(y1 - (dy / dx) * x1)

        return {
            equation: lineEquation(x1, y1, x2, y2),
            slope: m === Infinity ? 'undefined' : m,
            length: distance(x1, y1, x2, y2),
            mid,
            explain: {
                equation: vertical
                    ? `The two points share the same x-value (${x1}), so this is a vertical line. Its equation is simply x = ${x1}.`
                    : `Start from the slope m = ${r(dy / dx)}. Then the y-intercept is b = y₁ − m·x₁ = ${y1} − (${r(dy / dx)})(${x1}) = ${bIntercept}. Putting them together gives y = m·x + b.`,
                slope: vertical
                    ? `Slope = rise ÷ run = (y₂ − y₁) / (x₂ − x₁) = ${dy} / 0. Dividing by zero is undefined, so a vertical line has no slope.`
                    : `Slope = rise ÷ run = (y₂ − y₁) / (x₂ − x₁) = (${y2} − ${y1}) / (${x2} − ${x1}) = ${r(dy)} / ${r(dx)} = ${r(dy / dx)}.`,
                length: `Length uses the distance formula: √((x₂ − x₁)² + (y₂ − y₁)²) = √((${dx})² + (${dy})²) = √(${r(dx * dx)} + ${r(dy * dy)}) = √${r(dx * dx + dy * dy)} = ${r(Math.hypot(dx, dy))}.`,
                mid: `Midpoint is the average of the endpoints: ((x₁ + x₂)/2, (y₁ + y₂)/2) = ((${x1} + ${x2})/2, (${y1} + ${y2})/2) = (${mid.x}, ${mid.y}).`
            }
        }
    }, [selected])

    // Draw whenever items / theme change
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = prepareHiDPICanvas(canvas, W, H)
        const v = makeView(W, H, view)
        drawGrid(ctx, v)

        items.forEach(item => {
            const { x1, y1, x2, y2, color, type: t } = item
            ctx.strokeStyle = color
            ctx.lineWidth = item.id === selectedId ? 3.5 : 2.5
            ctx.beginPath()

            if (t === 'segment') {
                ctx.moveTo(v.toX(x1), v.toY(y1))
                ctx.lineTo(v.toX(x2), v.toY(y2))
                ctx.stroke()
                drawPoint(ctx, v, x1, y1, color)
                drawPoint(ctx, v, x2, y2, color)
                const mid = midpoint(x1, y1, x2, y2)
                drawPoint(ctx, v, mid.x, mid.y, cssVar('--text', '#fff'), 'M')
            } else {
                // Extend the line across the whole viewport
                if (x2 === x1) {
                    ctx.moveTo(v.toX(x1), 0)
                    ctx.lineTo(v.toX(x1), H)
                } else {
                    const m = (y2 - y1) / (x2 - x1)
                    const b = y1 - m * x1
                    ctx.moveTo(v.toX(view.xMin), v.toY(m * view.xMin + b))
                    ctx.lineTo(v.toX(view.xMax), v.toY(m * view.xMax + b))
                }
                ctx.stroke()
            }
        })
    }, [items, selectedId, themeKey, view])

    // Wheel-zoom toward the cursor
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

    const handleFit = useCallback(() => {
        const xs = [], ys = []
        items.forEach(it => { xs.push(it.x1, it.x2); ys.push(it.y1, it.y2) })
        if (!xs.length) { reset(); return }
        fitTo(
            { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
            { width: W, height: H }
        )
    }, [items, fitTo, reset])

    return (
        <div className="page">
            <div className="page-head">
                <h1>Lines &amp; Segments</h1>
                <p>Add lines and segments from two points or slope-intercept form, then read off slope, length and midpoint.</p>
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Add a line</h2>

                    <div className="seg-control">
                        <button className={method === 'points' ? 'active' : ''} onClick={() => setMethod('points')}>Two points</button>
                        <button className={method === 'slope' ? 'active' : ''} onClick={() => setMethod('slope')}>Slope &amp; intercept</button>
                        <button className={method === 'equation' ? 'active' : ''} onClick={() => setMethod('equation')}>Equation</button>
                    </div>

                    {method === 'equation' ? (
                        <>
                            <label className="field">
                                Equation
                                <input
                                    type="text"
                                    data-keypad="full"
                                    value={eqText}
                                    onChange={(e) => setEqText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addItem()}
                                    placeholder="y = 2x + 3"
                                />
                            </label>
                            {eqError && <div className="hint" style={{ color: 'var(--danger)' }}>{eqError}</div>}
                            <div className="hint">Type it however you like: <code>y = 2x + 3</code>, <code>y = -x</code>, or just <code>0.5x - 1</code>.</div>
                        </>
                    ) : method === 'points' ? (
                        <>
                            <div className="seg-control">
                                <button className={type === 'line' ? 'active' : ''} onClick={() => setType('line')}>Line</button>
                                <button className={type === 'segment' ? 'active' : ''} onClick={() => setType('segment')}>Segment</button>
                            </div>
                            <div className="row">
                                <label className="field">x₁<input type="number" value={form.x1} onChange={set('x1')} /></label>
                                <label className="field">y₁<input type="number" value={form.y1} onChange={set('y1')} /></label>
                            </div>
                            <div className="row" style={{ marginTop: '0.6rem' }}>
                                <label className="field">x₂<input type="number" value={form.x2} onChange={set('x2')} /></label>
                                <label className="field">y₂<input type="number" value={form.y2} onChange={set('y2')} /></label>
                            </div>
                        </>
                    ) : (
                        <div className="row">
                            <label className="field">slope m<input type="number" value={form.m} onChange={set('m')} /></label>
                            <label className="field">intercept b<input type="number" value={form.b} onChange={set('b')} /></label>
                        </div>
                    )}

                    <button className="btn primary" style={{ marginTop: '0.9rem', width: '100%' }} onClick={addItem}>+ Add</button>

                    <div className="item-list">
                        {items.map((item, i) => (
                            <div
                                key={item.id}
                                className="item"
                                onClick={() => setSelectedId(item.id)}
                                style={{ cursor: 'pointer', outline: item.id === selectedId ? `2px solid ${item.color}` : 'none' }}
                            >
                                <span className="swatch" style={{ background: item.color }} />
                                <span className="grow">{item.type === 'segment' ? 'Segment' : 'Line'} {i + 1}: {lineEquation(item.x1, item.y1, item.x2, item.y2)}</span>
                                <button onClick={(e) => { e.stopPropagation(); removeItem(item.id) }} title="Remove">×</button>
                            </div>
                        ))}
                    </div>

                    {stats && (
                        <>
                            <div className="hint" style={{ marginBottom: '0.4rem' }}>Hover a result to see how it was calculated.</div>
                            <div className="stat-grid">
                                <Stat label="Equation" value={stats.equation} explain={stats.explain.equation} small />
                                <Stat label="Slope" value={stats.slope} explain={stats.explain.slope} />
                                {selected.type === 'segment' && <Stat label="Length" value={stats.length} explain={stats.explain.length} />}
                                {selected.type === 'segment' && <Stat label="Midpoint" value={`(${stats.mid.x}, ${stats.mid.y})`} explain={stats.explain.mid} small />}
                            </div>
                        </>
                    )}
                </div>

                <div className="canvas-frame">
                    <canvas ref={canvasRef} width={W} height={H} aria-label="Lines and segments plot" />
                </div>
                <PlaneControls
                    onZoomIn={() => zoom(1.5)}
                    onZoomOut={() => zoom(0.67)}
                    onPan={pan}
                    onFit={handleFit}
                    onReset={reset}
                    canZoomIn={canZoomIn}
                    canZoomOut={canZoomOut}
                />
            </div>
        </div>
    )
}

export default LinesPage

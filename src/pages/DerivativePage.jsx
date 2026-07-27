import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { makeView, drawGrid, drawPoint, prepareHiDPICanvas, cssVar } from '../utils/plane'
import { useThemeContext } from '../theme/ThemeContext'
import { usePlaneView, bindWheelZoom, useKeyboardPan, useDragPan } from '../hooks/usePlaneView'
import PlaneControls from '../components/PlaneControls'
import { differentiate, evalAst } from '../utils/calculus'

const VIEW = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 }
const W = 680
const H = 440

const EXAMPLES = ['x^2', 'x^3 - 3x', 'sin(x)', 'x*sin(x)', 'e^x', 'ln(x)', 'sqrt(x)', '1/(x^2 + 1)', 'x^2*cos(x)']

// Trim floating noise for display.
const fmt = (v) => {
    if (!Number.isFinite(v)) return '—'
    return String(parseFloat(v.toPrecision(6)))
}

// Sample an AST across a pixel range, returning finite (px, value) pairs and
// the min/max value seen (for auto-fit).
const sampleY = (ast, v, xName) => {
    const pts = []
    let lo = Infinity
    let hi = -Infinity
    for (let px = 0; px <= W; px++) {
        const x = v.fromX(px)
        const y = evalAst(ast, x, xName)
        if (Number.isFinite(y)) {
            pts.push([px, y])
            if (y < lo) lo = y
            if (y > hi) hi = y
        } else {
            pts.push(null)
        }
    }
    return { pts, lo, hi }
}

// Stroke a sampled curve, breaking the path across gaps and steep jumps
// (so vertical asymptotes don't get connected).
const strokeCurve = (ctx, v, pts, color, dash = []) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.setLineDash(dash)
    ctx.beginPath()
    let drawing = false
    let prevY = null
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        if (!p) { drawing = false; prevY = null; continue }
        const py = v.toY(p[1])
        if (py < -H * 4 || py > H * 5) { drawing = false; prevY = null; continue }
        if (!drawing || (prevY !== null && Math.abs(py - prevY) > H)) {
            ctx.moveTo(p[0], py)
            drawing = true
        } else {
            ctx.lineTo(p[0], py)
        }
        prevY = py
    }
    ctx.stroke()
    ctx.setLineDash([])
}

/**
 * Derivative Calculator — symbolic differentiation with the rules shown, a
 * point evaluation, and the function drawn together with its tangent line.
 */
const DerivativePage = () => {
    const { themeKey } = useThemeContext()
    const canvasRef = useRef(null)
    const { view, pan, zoom, zoomAt, reset, fitTo, canZoomIn, canZoomOut } = usePlaneView(VIEW)
    useKeyboardPan(canvasRef, view, { pan, zoomAt, reset })
    useDragPan(canvasRef, view, pan, W, H)

    const [input, setInput] = useState('x^2*cos(x)')
    const [at, setAt] = useState('1')

    // Differentiate (memoized). Any parse/differentiation error is captured.
    const result = useMemo(() => {
        const expr = input.trim()
        if (!expr) return { empty: true }
        try {
            return differentiate(expr, 'x')
        } catch (e) {
            return { error: e.message || 'Could not parse that expression.' }
        }
    }, [input])

    const point = parseFloat(at)
    const hasPoint = Number.isFinite(point)

    // Values at the evaluation point (for the tangent line + readout).
    const atValues = useMemo(() => {
        if (result.error || result.empty || !hasPoint) return null
        const y0 = evalAst(result.f, point, 'x')
        const slope = evalAst(result.derivative, point, 'x')
        if (!Number.isFinite(y0) || !Number.isFinite(slope)) return { undefinedHere: true }
        return { y0, slope }
    }, [result, point, hasPoint])

    // --- draw f(x) and its tangent line -----------------------------------
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = prepareHiDPICanvas(canvas, W, H)
        const v = makeView(W, H, view)
        drawGrid(ctx, v)
        if (result.error || result.empty) return

        const { pts } = sampleY(result.f, v, 'x')
        strokeCurve(ctx, v, pts, cssVar('--accent', '#ff7a1a'))

        if (atValues && !atValues.undefinedHere) {
            const { y0, slope } = atValues
            const tangent = { t: 'add', a: { t: 'num', v: y0 }, b: { t: 'mul', a: { t: 'num', v: slope }, b: { t: 'sub', a: { t: 'var', name: 'x' }, b: { t: 'num', v: point } } } }
            const tan = sampleY(tangent, v, 'x')
            strokeCurve(ctx, v, tan.pts, cssVar('--accent-2', '#22d3ee'), [7, 5])
            drawPoint(ctx, v, point, y0, cssVar('--accent-2', '#22d3ee'), `(${fmt(point)}, ${fmt(y0)})`)
        }
    }, [result, atValues, point, view, themeKey])

    // Wheel-zoom toward the cursor.
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

    // Fit y to the curve over the current x-window.
    const handleFit = useCallback(() => {
        if (result.error || result.empty) { reset(); return }
        const v = makeView(W, H, view)
        const { lo, hi } = sampleY(result.f, v, 'x')
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) { reset(); return }
        fitTo({ minX: view.xMin, maxX: view.xMax, minY: lo, maxY: hi }, { width: W, height: H })
    }, [result, view, fitTo, reset])

    return (
        <div className="page">
            <div className="page-head">
                <h1>Derivative Calculator</h1>
                <p>Differentiate a function symbolically, see which rules apply, evaluate the slope at a point, and view the tangent line on the graph. Trig is in radians.</p>
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Function</h2>
                    <label className="field">
                        f(x) =
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="e.g. x^2*cos(x), sin(x^2), e^x"
                            aria-label="Function to differentiate"
                            autoComplete="off"
                            spellCheck="false"
                        />
                    </label>

                    <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
                        {EXAMPLES.map(ex => (
                            <button key={ex} className="btn ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setInput(ex)}>{ex}</button>
                        ))}
                    </div>

                    {result.error && (
                        <div className="hint" style={{ color: 'var(--danger)', marginTop: '0.7rem' }}>{result.error}</div>
                    )}

                    {!result.error && !result.empty && (
                        <>
                            <div className="deriv-result" style={{ marginTop: '1rem' }}>
                                <div className="deriv-label">Derivative</div>
                                <div className="deriv-expr">f′(x) = {result.derivativeStr}</div>
                            </div>

                            {result.rules.length > 0 && (
                                <div style={{ marginTop: '0.9rem' }}>
                                    <div className="deriv-label">Rules used</div>
                                    <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                                        {result.rules.map(r => (
                                            <span key={r} className="rule-chip">{r}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="deriv-steps" style={{ marginTop: '0.9rem' }}>
                                <div className="deriv-label">How it's computed</div>
                                <ol>
                                    <li><span className="mono">f(x) = {result.fStr}</span></li>
                                    <li>Apply the rules → <span className="mono">{result.rawStr}</span></li>
                                    <li>Simplify → <span className="mono">f′(x) = {result.derivativeStr}</span></li>
                                </ol>
                            </div>

                            <h2 style={{ marginTop: '1.4rem' }}>Evaluate at a point</h2>
                            <label className="field">
                                x =
                                <input
                                    type="number"
                                    value={at}
                                    onChange={(e) => setAt(e.target.value)}
                                    step="0.5"
                                    aria-label="Point at which to evaluate"
                                />
                            </label>
                            {atValues && !atValues.undefinedHere && (
                                <div className="stat-grid" style={{ marginTop: '0.6rem' }}>
                                    <div className="stat"><div className="label">f({fmt(point)})</div><div className="value">{fmt(atValues.y0)}</div></div>
                                    <div className="stat"><div className="label">f′({fmt(point)}) — slope</div><div className="value">{fmt(atValues.slope)}</div></div>
                                    <div className="stat"><div className="label">Tangent line</div><div className="value" style={{ fontSize: '0.9rem' }}>y = {fmt(atValues.slope)}(x − {fmt(point)}) + {fmt(atValues.y0)}</div></div>
                                </div>
                            )}
                            {atValues && atValues.undefinedHere && (
                                <div className="hint" style={{ marginTop: '0.5rem' }}>f is undefined at x = {fmt(point)}.</div>
                            )}
                        </>
                    )}

                    <div className="hint" style={{ marginTop: '1rem' }}>Supported: + − × ÷ ^, sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, ln, log, log2, sqrt, exp, abs, pi, e. Use * or juxtaposition (2x, 3(x+1)).</div>
                </div>

                <div>
                    <div className="canvas-frame">
                        <canvas ref={canvasRef} width={W} height={H} aria-label="Function and tangent line plot" />
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
                    <div className="graph-legend" style={{ marginTop: '0.6rem' }}>
                        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--accent)' }} /> f(x)</span>
                        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--accent-2)' }} /> tangent at x = {hasPoint ? fmt(point) : '—'}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DerivativePage

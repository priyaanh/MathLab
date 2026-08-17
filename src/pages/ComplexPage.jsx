import { useState, useMemo, useRef, useEffect } from 'react'
import { makeView, drawGrid, prepareHiDPICanvas, exportCanvasPng } from '../utils/plane'
import { usePlaneView, bindWheelZoom, useKeyboardPan, useDragPan } from '../hooks/usePlaneView'
import { useThemeContext } from '../theme/ThemeContext'
import PlaneControls from '../components/PlaneControls'
import { parseComplex, OPS, cFormat as fmtComplex, cModulus as modulus, cArgDeg as argDeg } from '../utils/complex'

/**
 * Complex Number Calculator — arithmetic on a + bi, modulus / argument / polar
 * form / conjugate, and an Argand (complex-plane) diagram showing each number
 * as a vector from the origin.
 */

const W = 560
const H = 440
const VIEW = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 }

const fmt = (n) => (!Number.isFinite(n) ? '—' : String(parseFloat(n.toPrecision(6))))

const Detail = ({ label, z, color }) => (
    <div className="cx-detail">
        <div className="cx-detail-head">
            <span className="swatch" style={{ background: color }} />
            {label} = <strong>{fmtComplex(z)}</strong>
        </div>
        <div className="cx-detail-rows">
            <span>|z| = {fmt(modulus(z))}</span>
            <span>arg = {fmt(argDeg(z))}°</span>
            <span>polar = {fmt(modulus(z))} ∠ {fmt(argDeg(z))}°</span>
            <span>conj = {fmtComplex({ re: z.re, im: -z.im })}</span>
        </div>
    </div>
)

const COLORS = { z1: '#ff7a1a', z2: '#22d3ee', result: '#4ade80' }

const ComplexPage = () => {
    const { themeKey } = useThemeContext()
    const canvasRef = useRef(null)
    const { view, pan, zoom, zoomAt, reset, fitTo, canZoomIn, canZoomOut } = usePlaneView(VIEW)
    useKeyboardPan(canvasRef, view, { pan, zoomAt, reset })
    useDragPan(canvasRef, view, pan, W, H, { zoomAt })

    const [z1s, setZ1s] = useState('3+4i')
    const [z2s, setZ2s] = useState('1-2i')
    const [op, setOp] = useState('+')

    const result = useMemo(() => {
        try {
            const z1 = parseComplex(z1s)
            const z2 = parseComplex(z2s)
            const value = OPS[op](z1, z2)
            return { z1, z2, value }
        } catch (e) {
            return { error: e.message }
        }
    }, [z1s, z2s, op])

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

    // Draw the Argand diagram.
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = prepareHiDPICanvas(canvas, W, H)
        const v = makeView(W, H, view)
        drawGrid(ctx, v)
        if (result.error) return

        const arrow = (z, color, label) => {
            const x0 = v.toX(0), y0 = v.toY(0)
            const x1 = v.toX(z.re), y1 = v.toY(z.im)
            ctx.strokeStyle = color
            ctx.fillStyle = color
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.moveTo(x0, y0)
            ctx.lineTo(x1, y1)
            ctx.stroke()
            // Arrowhead
            const ang = Math.atan2(y1 - y0, x1 - x0)
            const h = 9
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x1 - h * Math.cos(ang - 0.4), y1 - h * Math.sin(ang - 0.4))
            ctx.lineTo(x1 - h * Math.cos(ang + 0.4), y1 - h * Math.sin(ang + 0.4))
            ctx.closePath()
            ctx.fill()
            // Label
            ctx.font = '600 13px system-ui, sans-serif'
            ctx.fillText(label, x1 + 8, y1 - 6)
        }

        arrow(result.z1, COLORS.z1, 'z₁')
        arrow(result.z2, COLORS.z2, 'z₂')
        arrow(result.value, COLORS.result, 'result')
    }, [result, view, themeKey])

    const fitToNumbers = () => {
        if (result.error) { reset(); return }
        const xs = [0, result.z1.re, result.z2.re, result.value.re]
        const ys = [0, result.z1.im, result.z2.im, result.value.im]
        fitTo({ minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }, { width: W, height: H })
    }

    return (
        <div className="page">
            <div className="page-head">
                <h1>Complex Number Calculator</h1>
                <p>Do arithmetic on complex numbers, read their modulus, argument, polar form and conjugate, and see them on the Argand plane.</p>
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Numbers</h2>
                    <label className="field">
                        z₁
                        <input type="text" data-keypad="full" value={z1s} onChange={(e) => setZ1s(e.target.value)} placeholder="e.g. 3 + 4i" spellCheck={false} autoComplete="off" />
                    </label>

                    <div className="cx-ops">
                        {Object.keys(OPS).map(o => (
                            <button key={o} className={o === op ? 'active' : ''} onClick={() => setOp(o)} aria-pressed={o === op}>{o}</button>
                        ))}
                    </div>

                    <label className="field">
                        z₂
                        <input type="text" data-keypad="full" value={z2s} onChange={(e) => setZ2s(e.target.value)} placeholder="e.g. 1 − 2i" spellCheck={false} autoComplete="off" />
                    </label>

                    {result.error ? (
                        <div className="hint" style={{ color: 'var(--danger)', marginTop: '0.8rem' }}>{result.error}</div>
                    ) : (
                        <>
                            <div className="cx-result">
                                <div className="cx-result-label">z₁ {op} z₂</div>
                                <div className="cx-result-value">{fmtComplex(result.value)}</div>
                                <div className="cx-result-polar">= {fmt(modulus(result.value))} ∠ {fmt(argDeg(result.value))}°</div>
                            </div>
                            <div className="cx-details">
                                <Detail label="z₁" z={result.z1} color={COLORS.z1} />
                                <Detail label="z₂" z={result.z2} color={COLORS.z2} />
                                <Detail label="result" z={result.value} color={COLORS.result} />
                            </div>
                        </>
                    )}

                    <div className="hint" style={{ marginTop: '0.8rem' }}>Type numbers like <code>3+4i</code>, <code>-2-i</code>, <code>5</code> or <code>2i</code>.</div>
                </div>

                <div>
                    <div className="canvas-frame">
                        <canvas ref={canvasRef} width={W} height={H} aria-label="Argand diagram of the complex numbers" />
                    </div>
                    <PlaneControls
                        onZoomIn={() => zoom(1.5)}
                        onZoomOut={() => zoom(0.67)}
                        onPan={pan}
                        onFit={fitToNumbers}
                        onReset={reset}
                        canZoomIn={canZoomIn}
                        canZoomOut={canZoomOut}
                        onSavePng={() => exportCanvasPng(canvasRef.current, 'mathlab-complex.png')}
                    />
                </div>
            </div>
        </div>
    )
}

export default ComplexPage

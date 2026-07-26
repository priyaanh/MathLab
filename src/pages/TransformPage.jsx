import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { makeView, drawGrid, drawPoint, prepareHiDPICanvas, cssVar } from '../utils/plane'
import { usePlaneView, bindWheelZoom, useKeyboardPan } from '../hooks/usePlaneView'
import PlaneControls from '../components/PlaneControls'
import { useThemeContext } from '../theme/ThemeContext'

const VIEW = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }
const W = 680
const H = 480

// Asymmetric pre-image shapes so rotations and reflections are actually visible.
const PRESETS = {
    triangle: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 1, y: 4 }],
    Lshape: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 5 }, { x: 1, y: 5 }],
    arrow: [{ x: 1, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 1 }, { x: 6, y: 3 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 1, y: 4 }]
}
const PRESET_LABELS = { triangle: 'Triangle', Lshape: 'L-shape', arrow: 'Arrow' }

// Apply a single transformation step to a point.
const applyStep = (p, step) => {
    switch (step.type) {
        case 'translate':
            return { x: p.x + step.dx, y: p.y + step.dy }
        case 'dilate':
            return { x: p.x * step.k, y: p.y * step.k }
        case 'rotate': {
            const a = (step.deg * Math.PI) / 180
            return {
                x: p.x * Math.cos(a) - p.y * Math.sin(a),
                y: p.x * Math.sin(a) + p.y * Math.cos(a)
            }
        }
        case 'reflect':
            if (step.axis === 'x') return { x: p.x, y: -p.y }
            if (step.axis === 'y') return { x: -p.x, y: p.y }
            return { x: p.y, y: p.x } // y = x
        default:
            return p
    }
}

const describe = (s) => {
    if (s.type === 'translate') return `Translate by (${s.dx}, ${s.dy})`
    if (s.type === 'dilate') return `Dilate ×${s.k} about origin`
    if (s.type === 'rotate') return `Rotate ${s.deg}° about origin`
    return `Reflect over ${s.axis === 'x' ? 'x-axis' : s.axis === 'y' ? 'y-axis' : 'y = x'}`
}

let stepId = 0

const TransformPage = () => {
    const { themeKey } = useThemeContext()
    const canvasRef = useRef(null)
    const { view, pan, zoom, zoomAt, reset, fitTo, canZoomIn, canZoomOut } = usePlaneView(VIEW)
    useKeyboardPan(canvasRef, view, { pan, zoomAt, reset })

    const [preset, setPreset] = useState('triangle')
    const [steps, setSteps] = useState([])

    // Builder state
    const [type, setType] = useState('translate')
    const [tx, setTx] = useState(3)
    const [ty, setTy] = useState(2)
    const [k, setK] = useState(1.5)
    const [deg, setDeg] = useState(90)
    const [axis, setAxis] = useState('x')

    const addStep = useCallback(() => {
        let step
        if (type === 'translate') step = { type, dx: tx, dy: ty }
        else if (type === 'dilate') step = { type, k }
        else if (type === 'rotate') step = { type, deg }
        else step = { type, axis }
        setSteps(prev => [...prev, { id: ++stepId, ...step }])
    }, [type, tx, ty, k, deg, axis])

    const removeStep = (id) => setSteps(prev => prev.filter(s => s.id !== id))
    const clearSteps = () => setSteps([])

    const preImage = PRESETS[preset]
    const image = useMemo(
        () => preImage.map(p => steps.reduce(applyStep, p)),
        [preImage, steps]
    )

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = prepareHiDPICanvas(canvas, W, H)
        const v = makeView(W, H, view)
        drawGrid(ctx, v)

        const drawPoly = (pts, { stroke, fill, dash }) => {
            ctx.setLineDash(dash || [])
            ctx.beginPath()
            pts.forEach((p, i) => {
                const x = v.toX(p.x), y = v.toY(p.y)
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
            })
            ctx.closePath()
            if (fill) { ctx.fillStyle = fill; ctx.fill() }
            ctx.strokeStyle = stroke
            ctx.lineWidth = 2.5
            ctx.stroke()
            ctx.setLineDash([])
        }

        const accent = cssVar('--accent', '#ff7a1a')
        const muted = cssVar('--text-muted', '#94a3b8')

        // Pre-image (dashed, muted) then image (solid, accent) on top.
        drawPoly(preImage, { stroke: muted, dash: [6, 5] })
        drawPoly(image, { stroke: accent, fill: accent + '33' })
        image.forEach(p => drawPoint(ctx, v, p.x, p.y, accent))
    }, [preImage, image, themeKey, view])

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
        const pts = [...(preImage || []), ...(image || [])]
        if (!pts.length) { reset(); return }
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
        fitTo({ minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }, { width: W, height: H })
    }, [preImage, image, fitTo, reset])

    return (
        <div className="page">
            <div className="page-head">
                <h1>Transformations</h1>
                <p>Pick a shape, then stack transformations on it — translate, dilate, rotate and reflect. The faded dashed shape is the original (pre-image); the solid shape is the result (image).</p>
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Shape</h2>
                    <div className="seg-control">
                        {Object.keys(PRESETS).map(key => (
                            <button key={key} className={preset === key ? 'active' : ''} onClick={() => setPreset(key)}>
                                {PRESET_LABELS[key]}
                            </button>
                        ))}
                    </div>

                    <h2 style={{ marginTop: '0.6rem' }}>Add a transformation</h2>
                    <div className="seg-control">
                        <button className={type === 'translate' ? 'active' : ''} onClick={() => setType('translate')}>Translate</button>
                        <button className={type === 'dilate' ? 'active' : ''} onClick={() => setType('dilate')}>Dilate</button>
                        <button className={type === 'rotate' ? 'active' : ''} onClick={() => setType('rotate')}>Rotate</button>
                        <button className={type === 'reflect' ? 'active' : ''} onClick={() => setType('reflect')}>Reflect</button>
                    </div>

                    {type === 'translate' && (
                        <div className="row">
                            <label className="field">by x<input type="number" value={tx} onChange={(e) => setTx(parseFloat(e.target.value) || 0)} /></label>
                            <label className="field">by y<input type="number" value={ty} onChange={(e) => setTy(parseFloat(e.target.value) || 0)} /></label>
                        </div>
                    )}
                    {type === 'dilate' && (
                        <div className="row">
                            <label className="field">factor k (about origin)<input type="number" step="0.1" value={k} onChange={(e) => setK(parseFloat(e.target.value) || 1)} /></label>
                        </div>
                    )}
                    {type === 'rotate' && (
                        <div className="row">
                            <label className="field">degrees (about origin)<input type="number" value={deg} onChange={(e) => setDeg(parseFloat(e.target.value) || 0)} /></label>
                        </div>
                    )}
                    {type === 'reflect' && (
                        <div className="seg-control">
                            <button className={axis === 'x' ? 'active' : ''} onClick={() => setAxis('x')}>x-axis</button>
                            <button className={axis === 'y' ? 'active' : ''} onClick={() => setAxis('y')}>y-axis</button>
                            <button className={axis === 'yx' ? 'active' : ''} onClick={() => setAxis('yx')}>y = x</button>
                        </div>
                    )}

                    <button className="btn primary" style={{ marginTop: '0.9rem', width: '100%' }} onClick={addStep}>+ Add step</button>

                    <div className="item-list">
                        {steps.length === 0 && <div className="hint">No transformations yet — the image matches the original.</div>}
                        {steps.map((s, i) => (
                            <div key={s.id} className="item">
                                <span className="swatch" style={{ background: 'var(--accent)', borderRadius: '50%', width: 18, textAlign: 'center', fontSize: '0.7rem', color: 'var(--on-accent)', fontWeight: 700 }}>{i + 1}</span>
                                <span className="grow">{describe(s)}</span>
                                <button onClick={() => removeStep(s.id)} title="Remove">×</button>
                            </div>
                        ))}
                    </div>

                    {steps.length > 0 && (
                        <button className="btn ghost" style={{ width: '100%' }} onClick={clearSteps}>Clear all</button>
                    )}
                </div>

                <div className="canvas-frame">
                    <canvas ref={canvasRef} width={W} height={H} aria-label="Shape transformation plot" style={{ aspectRatio: `${W} / ${H}` }} />
                </div>
                <PlaneControls onZoomIn={() => zoom(1.5)} onZoomOut={() => zoom(0.67)} onPan={pan} onFit={handleFit} onReset={reset} canZoomIn={canZoomIn} canZoomOut={canZoomOut} />
            </div>
        </div>
    )
}

export default TransformPage

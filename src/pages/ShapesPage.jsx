import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { makeView, drawGrid, drawPoint, prepareHiDPICanvas, cssVar , exportCanvasPng } from '../utils/plane'
import {
    circleArea, circleAreaPi, circleCircumference,
    polygonArea, polygonPerimeter, regularPolygonPoints
} from '../utils/geometry'
import { useThemeContext } from '../theme/ThemeContext'
import { suggest } from '../utils/search'
import { usePlaneView, bindWheelZoom, useKeyboardPan } from '../hooks/usePlaneView'
import PlaneControls from '../components/PlaneControls'

const COLORS = ['#ff7a1a', '#22d3ee', '#a78bfa', '#4ade80', '#fb7185', '#fbbf24']
const VIEW = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }
const W = 680
const H = 480

// Polygon names the user can type, mapped to their side counts.
const POLYGONS = {
    triangle: 3,
    quadrilateral: 4,
    square: 4,
    pentagon: 5,
    hexagon: 6,
    heptagon: 7,
    octagon: 8,
    nonagon: 9,
    decagon: 10,
    hendecagon: 11,
    dodecagon: 12
}
const POLYGON_NAMES = Object.keys(POLYGONS)

let uid = 0

const rectCorners = (s) => {
    const { cx, cy, w, h } = s
    return [
        { x: cx - w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy + h / 2 },
        { x: cx - w / 2, y: cy + h / 2 }
    ]
}

// Convert a shape spec into polygon vertices (circle handled separately).
// Polygons keep an editable `points` list once created so their vertices can
// be dragged into any (possibly irregular) shape.
const shapePoints = (s) => {
    if (s.kind === 'rect') return rectCorners(s)
    if (s.kind === 'polygon') return s.points || regularPolygonPoints(s.cx, s.cy, s.r, s.n)
    return []
}

// Round to a tidy grid so dragged coordinates stay clean.
const snap = (n) => Math.round(n * 2) / 2

// Is graph point (x, y) inside shape s? Used to click-select on the canvas.
const pointInShape = (s, x, y) => {
    if (s.kind === 'circle') return Math.hypot(x - s.cx, y - s.cy) <= s.r
    const pts = shapePoints(s)
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const { x: xi, y: yi } = pts[i]
        const { x: xj, y: yj } = pts[j]
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside
        }
    }
    return inside
}

// Draggable handles for a shape, in graph coordinates.
const getHandles = (s) => {
    if (s.kind === 'circle') {
        return [
            { role: 'center', x: s.cx, y: s.cy },
            { role: 'radius', x: s.cx + s.r, y: s.cy }
        ]
    }
    if (s.kind === 'rect') {
        return rectCorners(s).map((p, i) => ({ role: 'corner', index: i, ...p }))
    }
    return shapePoints(s).map((p, i) => ({ role: 'vertex', index: i, ...p }))
}

const ShapesPage = () => {
    const { themeKey } = useThemeContext()
    const canvasRef = useRef(null)
    const { view, pan, zoom, zoomAt, reset, fitTo, canZoomIn, canZoomOut } = usePlaneView(VIEW)
    useKeyboardPan(canvasRef, view, { pan, zoomAt, reset })

    const [kind, setKind] = useState('circle')
    const [form, setForm] = useState({ cx: 0, cy: 0, r: 4, w: 6, h: 4, polyName: 'pentagon' })
    const [shapes, setShapes] = useState([{ id: ++uid, kind: 'circle', cx: 0, cy: 0, r: 4, color: COLORS[0] }])
    const [selectedId, setSelectedId] = useState(shapes[0].id)
    const [polyError, setPolyError] = useState('')
    const [polySuggestion, setPolySuggestion] = useState('')

    const set = (key) => (e) => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) }))

    const addShape = useCallback(() => {
        const color = COLORS[shapes.length % COLORS.length]
        const base = { id: ++uid, kind, color }
        let shape
        if (kind === 'circle') {
            shape = { ...base, cx: form.cx, cy: form.cy, r: Math.abs(form.r) }
        } else if (kind === 'rect') {
            shape = { ...base, cx: form.cx, cy: form.cy, w: Math.abs(form.w), h: Math.abs(form.h) }
        } else {
            // Polygon: look the typed name up; on a miss, offer a correction.
            const name = form.polyName.trim().toLowerCase()
            const sides = POLYGONS[name]
            if (!sides) {
                setPolySuggestion(suggest(name, POLYGON_NAMES) || '')
                setPolyError(name ? `“${form.polyName}” isn't a polygon I know.` : 'Type a polygon name.')
                return
            }
            setPolyError('')
            setPolySuggestion('')
            const r = Math.abs(form.r)
            shape = { ...base, cx: form.cx, cy: form.cy, r, n: sides, name, points: regularPolygonPoints(form.cx, form.cy, r, sides) }
        }
        setShapes(prev => [...prev, shape])
        setSelectedId(shape.id)
    }, [kind, form, shapes.length])

    const applySuggestion = () => {
        setForm(f => ({ ...f, polyName: polySuggestion }))
        setPolyError('')
        setPolySuggestion('')
    }

    // Update the selected shape via a mapper — used by the canvas drag handles.
    // (Explicit translate/dilate/reflect controls live on the Transformations page.)
    const updateSelected = useCallback((mapper) => {
        setShapes(prev => prev.map(s => (s.id === selectedId ? mapper(s) : s)))
    }, [selectedId])

    const selected = shapes.find(s => s.id === selectedId) || shapes[0]

    // --- Drag handles directly on the canvas ---------------------------
    const dragRef = useRef(null)
    const panRef = useRef(null)

    // Update a shape from a handle being dragged to graph point (gx, gy).
    const applyHandleDrag = (s, role, index, gx, gy) => {
        const x = snap(gx)
        const y = snap(gy)
        if (s.kind === 'circle') {
            if (role === 'center') return { ...s, cx: x, cy: y }
            return { ...s, r: Math.max(0.5, snap(Math.hypot(x - s.cx, y - s.cy))) }
        }
        if (s.kind === 'rect') {
            // Keep it a rectangle: anchor the opposite corner.
            const opp = rectCorners(s)[(index + 2) % 4]
            return {
                ...s,
                cx: (x + opp.x) / 2,
                cy: (y + opp.y) / 2,
                w: Math.max(0.5, Math.abs(x - opp.x)),
                h: Math.max(0.5, Math.abs(y - opp.y))
            }
        }
        // Polygon: move just this vertex (shape can become irregular).
        return { ...s, points: shapePoints(s).map((p, i) => (i === index ? { x, y } : p)) }
    }

    const pointerGraph = useCallback((e) => {
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        const px = ((e.clientX - rect.left) / rect.width) * W
        const py = ((e.clientY - rect.top) / rect.height) * H
        const v = makeView(W, H, view)
        return { px, py, gx: v.fromX(px), gy: v.fromY(py), v }
    }, [view])

    const handleMouseDown = useCallback((e) => {
        const { px, py, gx, gy, v } = pointerGraph(e)

        // 1) Grab a handle of the currently selected shape, if we hit one.
        if (selected) {
            let hit = null
            let best = 14 * 14 // hit radius (logical px), squared
            for (const hnd of getHandles(selected)) {
                const d2 = (v.toX(hnd.x) - px) ** 2 + (v.toY(hnd.y) - py) ** 2
                if (d2 < best) { best = d2; hit = hnd }
            }
            if (hit) { dragRef.current = { role: hit.role, index: hit.index }; return }
        }

        // 2) Click-select the top-most shape under the cursor (doesn't stop panning).
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (pointInShape(shapes[i], gx, gy)) { setSelectedId(shapes[i].id); break }
        }

        // 3) Empty space (or a shape body) starts a view pan.
        panRef.current = { x: e.clientX, y: e.clientY }
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = 'grabbing'
    }, [selected, shapes, pointerGraph])

    const handleMouseMove = useCallback((e) => {
        if (dragRef.current) {
            const { gx, gy } = pointerGraph(e)
            const { role, index } = dragRef.current
            updateSelected(s => applyHandleDrag(s, role, index, gx, gy))
            return
        }
        if (panRef.current) {
            const canvas = canvasRef.current
            const rect = canvas.getBoundingClientRect()
            const dxPx = ((e.clientX - panRef.current.x) / rect.width) * W
            const dyPx = ((e.clientY - panRef.current.y) / rect.height) * H
            panRef.current = { x: e.clientX, y: e.clientY }
            pan(-(dxPx / W) * (view.xMax - view.xMin), (dyPx / H) * (view.yMax - view.yMin))
        }
    }, [pointerGraph, updateSelected, pan, view])

    const endDrag = useCallback(() => {
        dragRef.current = null
        panRef.current = null
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = 'crosshair'
    }, [])

    // Fit the view to every shape's extents (circles by their bounding box,
    // polygons/rectangles by their vertices).
    const handleFit = useCallback(() => {
        const xs = [], ys = []
        shapes.forEach(s => {
            if (s.kind === 'circle') {
                xs.push(s.cx - s.r, s.cx + s.r)
                ys.push(s.cy - s.r, s.cy + s.r)
            } else {
                shapePoints(s).forEach(p => { xs.push(p.x); ys.push(p.y) })
            }
        })
        if (!xs.length) { reset(); return }
        fitTo(
            { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
            { width: W, height: H }
        )
    }, [shapes, fitTo, reset])

    const removeShape = (id) => setShapes(prev => prev.filter(s => s.id !== id))

    const stats = useMemo(() => {
        if (!selected) return null
        if (selected.kind === 'circle') {
            return {
                area: circleAreaPi(selected.r),
                perimeter: circleCircumference(selected.r),
                extra: `radius ${selected.r} · ≈ ${circleArea(selected.r)}`
            }
        }
        const pts = shapePoints(selected)
        return { area: polygonArea(pts), perimeter: polygonPerimeter(pts), extra: `${pts.length} sides` }
    }, [selected])

    const label = (s, i) => {
        if (s.kind === 'circle') return `Circle ${i + 1} (r=${s.r})`
        if (s.kind === 'rect') return `Rectangle ${i + 1} (${s.w}×${s.h})`
        const pretty = s.name ? s.name[0].toUpperCase() + s.name.slice(1) : `${s.n}-gon`
        return `${pretty} ${i + 1} (${s.n} sides)`
    }

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = prepareHiDPICanvas(canvas, W, H)
        const v = makeView(W, H, view)
        drawGrid(ctx, v)

        shapes.forEach(s => {
            const sel = s.id === selectedId
            ctx.strokeStyle = s.color
            ctx.lineWidth = sel ? 3 : 2
            ctx.fillStyle = s.color + (sel ? '40' : '22') // translucent fill

            if (s.kind === 'circle') {
                // Radius in pixels (x-scale); assumes square-ish view.
                const rPx = (s.r / (view.xMax - view.xMin)) * W
                ctx.beginPath()
                ctx.arc(v.toX(s.cx), v.toY(s.cy), rPx, 0, 2 * Math.PI)
                ctx.fill()
                ctx.stroke()
                drawPoint(ctx, v, s.cx, s.cy, s.color)
            } else {
                const pts = shapePoints(s)
                ctx.beginPath()
                pts.forEach((p, idx) => {
                    const px = v.toX(p.x), py = v.toY(p.y)
                    if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
                })
                ctx.closePath()
                ctx.fill()
                ctx.stroke()
            }
        })

        // Draggable handles for the selected shape.
        if (selected) {
            getHandles(selected).forEach(h => {
                const hx = v.toX(h.x), hy = v.toY(h.y)
                ctx.beginPath()
                ctx.arc(hx, hy, 6, 0, 2 * Math.PI)
                ctx.fillStyle = cssVar('--bg-2', '#0f1420')
                ctx.fill()
                ctx.lineWidth = 2.5
                ctx.strokeStyle = selected.color
                ctx.stroke()
            })
        }
    }, [shapes, selectedId, selected, themeKey, view])

    // Wheel-zoom toward the cursor. Non-passive listener via bindWheelZoom.
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
                <h1>Shapes</h1>
                <p>Draw circles, rectangles and regular polygons on the plane, and read their area and perimeter.</p>
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Add a shape</h2>

                    <div className="seg-control">
                        <button className={kind === 'circle' ? 'active' : ''} onClick={() => setKind('circle')}>Circle</button>
                        <button className={kind === 'rect' ? 'active' : ''} onClick={() => setKind('rect')}>Rectangle</button>
                        <button className={kind === 'polygon' ? 'active' : ''} onClick={() => setKind('polygon')}>Polygon</button>
                    </div>

                    <div className="row">
                        <label className="field">center x<input type="number" value={form.cx} onChange={set('cx')} /></label>
                        <label className="field">center y<input type="number" value={form.cy} onChange={set('cy')} /></label>
                    </div>

                    <div className="row" style={{ marginTop: '0.6rem' }}>
                        {kind === 'circle' && <label className="field">radius<input type="number" value={form.r} onChange={set('r')} /></label>}
                        {kind === 'rect' && <>
                            <label className="field">width<input type="number" value={form.w} onChange={set('w')} /></label>
                            <label className="field">height<input type="number" value={form.h} onChange={set('h')} /></label>
                        </>}
                        {kind === 'polygon' && <>
                            <label className="field">radius<input type="number" value={form.r} onChange={set('r')} /></label>
                            <label className="field">shape name
                                <input
                                    type="text"
                                    value={form.polyName}
                                    onChange={(e) => setForm(f => ({ ...f, polyName: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && addShape()}
                                    placeholder="pentagon, hexagon…"
                                />
                            </label>
                        </>}
                    </div>

                    {kind === 'polygon' && polyError && (
                        <div className="hint" style={{ color: 'var(--danger)' }}>
                            {polyError}
                            {polySuggestion && (
                                <>
                                    {' '}Did you mean{' '}
                                    <button type="button" className="did-you-mean" onClick={applySuggestion}>
                                        {polySuggestion}
                                    </button>
                                    ?
                                </>
                            )}
                        </div>
                    )}

                    {kind === 'polygon' && !polyError && (
                        <div className="hint">Try: triangle, square, pentagon, hexagon, heptagon, octagon, nonagon, decagon, dodecagon.</div>
                    )}

                    <button className="btn primary" style={{ marginTop: '0.9rem', width: '100%' }} onClick={addShape}>+ Add</button>

                    <div className="item-list">
                        {shapes.map((s, i) => (
                            <div
                                key={s.id}
                                className="item"
                                onClick={() => setSelectedId(s.id)}
                                style={{ cursor: 'pointer', outline: s.id === selectedId ? `2px solid ${s.color}` : 'none' }}
                            >
                                <span className="swatch" style={{ background: s.color }} />
                                <span className="grow">{label(s, i)}</span>
                                <button onClick={(e) => { e.stopPropagation(); removeShape(s.id) }} title="Remove">×</button>
                            </div>
                        ))}
                    </div>

                    {stats && (
                        <div className="stat-grid">
                            <div className="stat"><div className="label">Area</div><div className="value">{stats.area}</div></div>
                            <div className="stat"><div className="label">{selected.kind === 'circle' ? 'Circumference' : 'Perimeter'}</div><div className="value">{stats.perimeter}</div></div>
                            <div className="stat"><div className="label">Detail</div><div className="value" style={{ fontSize: '0.95rem' }}>{stats.extra}</div></div>
                        </div>
                    )}
                </div>

                <div className="canvas-frame">
                    <canvas
                        ref={canvasRef}
                        width={W}
                        height={H}
                        aria-label="Shapes plot — drag the handles to reshape"
                        style={{ cursor: 'crosshair', touchAction: 'none' }}
                        onPointerDown={handleMouseDown}
                        onPointerMove={handleMouseMove}
                        onPointerUp={endDrag}
                        onPointerLeave={endDrag}
                    />
                    <p className="hint">Tip: drag the ringed handles to reshape the selected shape. Drag empty space to pan, scroll to zoom.</p>
                </div>

                <PlaneControls
                    onZoomIn={() => zoom(1.5)}
                    onZoomOut={() => zoom(0.67)}
                    onPan={pan}
                    onFit={handleFit}
                    onReset={reset}
                    canZoomIn={canZoomIn}
                    canZoomOut={canZoomOut}
                    onSavePng={() => exportCanvasPng(canvasRef.current, 'mathlab-shapes.png')}
                />
            </div>
        </div>
    )
}

export default ShapesPage

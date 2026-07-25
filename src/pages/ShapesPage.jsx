import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { makeView, drawGrid, drawPoint, prepareHiDPICanvas, cssVar } from '../utils/plane'
import {
    circleArea, circleCircumference,
    polygonArea, polygonPerimeter, regularPolygonPoints
} from '../utils/geometry'
import { useThemeContext } from '../theme/ThemeContext'
import { suggest } from '../utils/search'

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

    // --- Transformations (act on the selected shape) --------------------
    const [tx, setTx] = useState(2)
    const [ty, setTy] = useState(0)
    const [dilateK, setDilateK] = useState(2)

    const updateSelected = useCallback((mapper) => {
        setShapes(prev => prev.map(s => (s.id === selectedId ? mapper(s) : s)))
    }, [selectedId])

    // Apply a point-mapping transform to a shape's center and (if it has one)
    // its editable vertex list, so polygons transform correctly too.
    const mapPoints = (s, fn) => (s.points ? { points: s.points.map(fn) } : {})

    const translate = () => updateSelected(s => ({
        ...s, cx: s.cx + tx, cy: s.cy + ty,
        ...mapPoints(s, p => ({ x: p.x + tx, y: p.y + ty }))
    }))

    const dilate = () => updateSelected(s => ({
        ...s,
        cx: s.cx * dilateK,
        cy: s.cy * dilateK,
        ...(s.r != null ? { r: Math.abs(s.r * dilateK) } : {}),
        ...(s.w != null ? { w: Math.abs(s.w * dilateK) } : {}),
        ...(s.h != null ? { h: Math.abs(s.h * dilateK) } : {}),
        ...mapPoints(s, p => ({ x: p.x * dilateK, y: p.y * dilateK }))
    }))

    const reflect = (axis) => updateSelected(s => (axis === 'x'
        ? { ...s, cy: -s.cy, ...mapPoints(s, p => ({ x: p.x, y: -p.y })) }
        : { ...s, cx: -s.cx, ...mapPoints(s, p => ({ x: -p.x, y: p.y })) }
    ))

    const selected = shapes.find(s => s.id === selectedId) || shapes[0]

    // --- Drag handles directly on the canvas ---------------------------
    const dragRef = useRef(null)

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
        const v = makeView(W, H, VIEW)
        return { px, py, gx: v.fromX(px), gy: v.fromY(py), v }
    }, [])

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

        // 2) Otherwise, click-select the top-most shape under the cursor.
        for (let i = shapes.length - 1; i >= 0; i--) {
            if (pointInShape(shapes[i], gx, gy)) { setSelectedId(shapes[i].id); return }
        }
    }, [selected, shapes, pointerGraph])

    const handleMouseMove = useCallback((e) => {
        if (!dragRef.current) return
        const { gx, gy } = pointerGraph(e)
        const { role, index } = dragRef.current
        updateSelected(s => applyHandleDrag(s, role, index, gx, gy))
    }, [pointerGraph, updateSelected])

    const endDrag = useCallback(() => { dragRef.current = null }, [])

    const removeShape = (id) => setShapes(prev => prev.filter(s => s.id !== id))

    const stats = useMemo(() => {
        if (!selected) return null
        if (selected.kind === 'circle') {
            return { area: circleArea(selected.r), perimeter: circleCircumference(selected.r), extra: `radius ${selected.r}` }
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
        const v = makeView(W, H, VIEW)
        drawGrid(ctx, v)

        shapes.forEach(s => {
            const sel = s.id === selectedId
            ctx.strokeStyle = s.color
            ctx.lineWidth = sel ? 3 : 2
            ctx.fillStyle = s.color + (sel ? '40' : '22') // translucent fill

            if (s.kind === 'circle') {
                // Radius in pixels (x-scale); assumes square-ish view.
                const rPx = (s.r / (VIEW.xMax - VIEW.xMin)) * W
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
    }, [shapes, selectedId, selected, themeKey])

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

                    {selected && (
                        <div className="transform-box">
                            <h3>Transform selected shape</h3>

                            <div className="transform-group">
                                <span className="transform-label">Translate</span>
                                <div className="row">
                                    <label className="field">by x<input type="number" value={tx} onChange={(e) => setTx(parseFloat(e.target.value) || 0)} /></label>
                                    <label className="field">by y<input type="number" value={ty} onChange={(e) => setTy(parseFloat(e.target.value) || 0)} /></label>
                                    <button className="btn" onClick={translate}>Move</button>
                                </div>
                            </div>

                            <div className="transform-group">
                                <span className="transform-label">Dilate <em>(about origin)</em></span>
                                <div className="row">
                                    <label className="field">factor k<input type="number" step="0.1" value={dilateK} onChange={(e) => setDilateK(parseFloat(e.target.value) || 1)} /></label>
                                    <button className="btn" onClick={dilate}>Scale</button>
                                </div>
                            </div>

                            <div className="transform-group">
                                <span className="transform-label">Reflect</span>
                                <div className="row">
                                    <button className="btn" onClick={() => reflect('x')}>Over x-axis</button>
                                    <button className="btn" onClick={() => reflect('y')}>Over y-axis</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="canvas-frame">
                    <canvas
                        ref={canvasRef}
                        width={W}
                        height={H}
                        aria-label="Shapes plot — drag the handles to reshape"
                        style={{ cursor: 'crosshair' }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={endDrag}
                        onMouseLeave={endDrag}
                    />
                    <p className="hint">Tip: drag the ringed handles on the selected shape to reshape it — no typing needed.</p>
                </div>
            </div>
        </div>
    )
}

export default ShapesPage

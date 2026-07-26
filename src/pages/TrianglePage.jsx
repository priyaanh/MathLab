import { useState, useMemo, useRef, useEffect } from 'react'
import { useThemeContext } from '../theme/ThemeContext'

// ---- Trig helpers (angles in DEGREES) ---------------------------------
const D2R = Math.PI / 180
const R2D = 180 / Math.PI
const sinD = (d) => Math.sin(d * D2R)
const cosD = (d) => Math.cos(d * D2R)
const asinD = (x) => Math.asin(x) * R2D
const acosD = (x) => Math.acos(x) * R2D
const clamp1 = (x) => Math.max(-1, Math.min(1, x))

// Trim a number for display; never show NaN/Infinity.
const fmt = (n) => (Number.isFinite(n) ? parseFloat(n.toPrecision(6)) : '—')
const fmtDeg = (n) => (Number.isFinite(n) ? `${parseFloat(n.toPrecision(6))}°` : '—')

// Parse a text field into a positive number, or null when empty/invalid.
const parseVal = (str, isAngle) => {
    const t = String(str).trim()
    if (t === '') return null
    const v = Number(t)
    if (!Number.isFinite(v) || v <= 0) return null
    if (isAngle && v >= 180) return null
    return v
}

// Angles of a triangle from its three sides (law of cosines).
const anglesFromSides = (a, b, c) => {
    const A = acosD(clamp1((b * b + c * c - a * a) / (2 * b * c)))
    const B = acosD(clamp1((a * a + c * c - b * b) / (2 * a * c)))
    const C = 180 - A - B
    return { A, B, C }
}

const validTriangle = (a, b, c) => a + b > c && a + c > b && b + c > a

// Add perimeter, area, classifications and altitudes to a solved triangle.
const decorate = (s) => {
    const { a, b, c, A, B, C } = s
    const perimeter = a + b + c
    const area = 0.5 * a * b * sinD(C)
    const maxAng = Math.max(A, B, C)
    const angleType = Math.abs(maxAng - 90) < 0.5 ? 'right' : maxAng > 90 ? 'obtuse' : 'acute'
    const eq = (x, y) => Math.abs(x - y) <= 1e-4 * Math.max(1, Math.abs(x), Math.abs(y))
    const sideType = eq(a, b) && eq(b, c)
        ? 'equilateral'
        : eq(a, b) || eq(b, c) || eq(a, c)
            ? 'isosceles'
            : 'scalene'
    const heights = { a: (2 * area) / a, b: (2 * area) / b, c: (2 * area) / c }
    return { a, b, c, A, B, C, perimeter, area, angleType, sideType, heights }
}

// ---- The solver -------------------------------------------------------
// Returns { solutions: [...], caseName, note? } or { error }.
const solveTriangle = (vals) => {
    const sideKeys = ['a', 'b', 'c'].filter((k) => vals[k] != null)
    const angleKeys = ['A', 'B', 'C'].filter((k) => vals[k] != null)
    const nS = sideKeys.length
    const nA = angleKeys.length
    const n = nS + nA

    if (n < 3) {
        return { error: 'Enter at least 3 values (including at least one side) to solve the triangle.' }
    }
    if (nS === 0) {
        return { error: 'You need at least one side length — angles alone fix the shape but not the size.' }
    }
    // Reject any pair/triple of angles that can't coexist.
    if (nA >= 2) {
        const sumKnown = angleKeys.reduce((t, k) => t + vals[k], 0)
        if (sumKnown >= 180) {
            return { error: 'The angles you entered add up to 180° or more, so no triangle exists.' }
        }
        if (nA === 3 && Math.abs(sumKnown - 180) > 1e-6) {
            return { error: 'The three angles must sum to exactly 180°.' }
        }
    }

    let result

    // --- SSS: three sides ---
    if (nS === 3) {
        const { a, b, c } = vals
        if (!validTriangle(a, b, c)) {
            return { error: 'Those side lengths violate the triangle inequality — the two shorter sides must sum to more than the longest side.' }
        }
        result = { solutions: [{ a, b, c, ...anglesFromSides(a, b, c) }], caseName: 'SSS · three sides' }

    // --- AAS / ASA: two (or three) angles + a side ---
    } else if (nA >= 2) {
        const ang = { A: vals.A, B: vals.B, C: vals.C }
        const missing = ['A', 'B', 'C'].find((k) => ang[k] == null)
        if (missing) ang[missing] = 180 - (['A', 'B', 'C'].reduce((t, k) => t + (ang[k] || 0), 0))
        if (ang.A <= 0 || ang.B <= 0 || ang.C <= 0) {
            return { error: 'The implied third angle is not positive — check your angles.' }
        }
        const sKey = sideKeys[0]
        const oppAngle = ang[sKey.toUpperCase()]
        const ratio = vals[sKey] / sinD(oppAngle)
        const sides = { a: ratio * sinD(ang.A), b: ratio * sinD(ang.B), c: ratio * sinD(ang.C) }
        result = { solutions: [{ ...sides, A: ang.A, B: ang.B, C: ang.C }], caseName: 'ASA / AAS · two angles + a side' }

    // --- Two sides + one angle: SAS or the ambiguous SSA ---
    } else {
        const knownAngle = angleKeys[0]              // e.g. 'B'
        const missingSide = ['a', 'b', 'c'].find((k) => vals[k] == null)   // the unknown side
        const includedAngle = missingSide.toUpperCase()   // angle opposite the unknown side

        if (knownAngle === includedAngle) {
            // SAS — the angle sits between the two known sides.
            const [s1, s2] = sideKeys
            const theta = vals[knownAngle]
            const z = Math.sqrt(vals[s1] ** 2 + vals[s2] ** 2 - 2 * vals[s1] * vals[s2] * cosD(theta))
            const sides = { [s1]: vals[s1], [s2]: vals[s2], [missingSide]: z }
            const angs = anglesFromSides(sides.a, sides.b, sides.c)
            result = { solutions: [{ ...sides, ...angs }], caseName: 'SAS · two sides + included angle' }
        } else {
            // SSA — the ambiguous case.
            const aLower = knownAngle.toLowerCase()       // side opposite the known angle
            const otherSide = sideKeys.find((k) => k !== aLower)  // the other known side
            const thirdSide = missingSide                 // unknown side
            const alpha = vals[knownAngle]
            const x = vals[aLower]                         // opposite alpha
            const y = vals[otherSide]                      // opposite beta
            const sinBeta = (y * sinD(alpha)) / x

            if (sinBeta > 1 + 1e-9) {
                return {
                    error: `No triangle fits these values (SSA): side ${aLower}=${fmt(x)} is too short for angle ${knownAngle}=${fmt(alpha)}° opposite side ${otherSide}=${fmt(y)}.`,
                    caseName: 'SSA · ambiguous case'
                }
            }

            const beta1 = asinD(clamp1(sinBeta))
            const candidates = [beta1]
            const beta2 = 180 - beta1
            if (beta2 > 0.0001 && Math.abs(beta2 - beta1) > 0.0001 && alpha + beta2 < 180) {
                candidates.push(beta2)
            }

            const solutions = []
            for (const beta of candidates) {
                if (alpha + beta >= 180) continue
                const gamma = 180 - alpha - beta
                if (gamma <= 0) continue
                const z = (x * sinD(gamma)) / sinD(alpha)
                const sol = {}
                sol[aLower] = x
                sol[knownAngle] = alpha
                sol[otherSide] = y
                sol[otherSide.toUpperCase()] = beta
                sol[thirdSide] = z
                sol[thirdSide.toUpperCase()] = gamma
                solutions.push(sol)
            }
            if (solutions.length === 0) {
                return { error: 'No valid triangle exists for these SSA values.', caseName: 'SSA · ambiguous case' }
            }
            result = {
                solutions,
                caseName: 'SSA · ambiguous case',
                note: solutions.length === 2
                    ? 'Two distinct triangles satisfy these values — both are shown below.'
                    : 'Exactly one triangle satisfies these values.'
            }
        }
    }

    // Soft consistency check when the user supplied more than the minimum.
    if (n > 3 && result.solutions) {
        const provided = [...sideKeys, ...angleKeys]
        const matches = (sol) => provided.every((k) => {
            const isAngle = k === k.toUpperCase()
            const diff = Math.abs(sol[k] - vals[k])
            return isAngle ? diff < 0.05 : diff <= 1e-3 * Math.max(1, Math.abs(vals[k]))
        })
        if (!result.solutions.some(matches)) {
            result.note = (result.note ? result.note + ' ' : '') +
                'Heads up: your inputs are over-determined and don’t perfectly agree — showing the closest triangle.'
        }
    }

    return result
}

// ---- Presets ----------------------------------------------------------
const PRESETS = [
    { label: '3-4-5 right', vals: { a: '3', b: '4', c: '5', A: '', B: '', C: '' } },
    { label: 'SAS example', vals: { a: '', b: '7', c: '5', A: '45', B: '', C: '' } },
    { label: 'Ambiguous (SSA)', vals: { a: '7', b: '10', c: '', A: '30', B: '', C: '' } },
    { label: 'ASA example', vals: { a: '', b: '', c: '6', A: '40', B: '60', C: '' } }
]

const EMPTY = { a: '', b: '', c: '', A: '', B: '', C: '' }
const SIDE_KEYS = ['a', 'b', 'c']
const ANGLE_KEYS = ['A', 'B', 'C']

const TrianglePage = () => {
    const { themeKey } = useThemeContext()
    const canvasRef = useRef(null)
    const [inputs, setInputs] = useState(EMPTY)
    const [activeIdx, setActiveIdx] = useState(0)

    const setField = (key) => (e) => setInputs((f) => ({ ...f, [key]: e.target.value }))

    // Numeric view of the inputs, then the solved result.
    const parsed = useMemo(() => ({
        a: parseVal(inputs.a, false),
        b: parseVal(inputs.b, false),
        c: parseVal(inputs.c, false),
        A: parseVal(inputs.A, true),
        B: parseVal(inputs.B, true),
        C: parseVal(inputs.C, true)
    }), [inputs])

    const result = useMemo(() => solveTriangle(parsed), [parsed])

    // Reset the active-solution toggle whenever the result changes.
    useEffect(() => { setActiveIdx(0) }, [result])

    const solutions = result.solutions ? result.solutions.map(decorate) : null
    const idx = solutions ? Math.min(activeIdx, solutions.length - 1) : 0
    const active = solutions ? solutions[idx] : null

    // ---- Draw the active triangle to scale on the canvas --------------
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const CW = 620
        const CH = 460
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.round(CW * dpr)
        canvas.height = Math.round(CH * dpr)
        const ctx = canvas.getContext('2d')
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const cs = getComputedStyle(document.documentElement)
        const col = (name, fb) => (cs.getPropertyValue(name).trim() || fb)
        const bg = col('--bg-2', '#0f1420')
        const accent = col('--accent', '#ff7a1a')
        const text = col('--text', '#f5f7fa')
        const muted = col('--text-muted', '#9aa4b2')

        ctx.fillStyle = bg
        ctx.fillRect(0, 0, CW, CH)

        if (!active) {
            ctx.fillStyle = muted
            ctx.font = '15px system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(result.error || 'Enter values to see the triangle.', CW / 2, CH / 2)
            return
        }

        // Place vertices in math coordinates (y up).
        const A = { x: 0, y: 0 }
        const B = { x: active.c, y: 0 }
        const C = { x: active.b * cosD(active.A), y: active.b * sinD(active.A) }
        const pts = [A, B, C]
        const xs = pts.map((p) => p.x)
        const ys = pts.map((p) => p.y)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        const pad = 56
        const scale = Math.min(
            (CW - 2 * pad) / (maxX - minX || 1),
            (CH - 2 * pad) / (maxY - minY || 1)
        )
        const offX = (CW - (maxX - minX) * scale) / 2
        const offY = (CH - (maxY - minY) * scale) / 2
        const sx = (p) => offX + (p.x - minX) * scale
        const sy = (p) => CH - offY - (p.y - minY) * scale  // flip y so it draws upright
        const S = { A: { x: sx(A), y: sy(A) }, B: { x: sx(B), y: sy(B) }, C: { x: sx(C), y: sy(C) } }
        const cen = { x: (S.A.x + S.B.x + S.C.x) / 3, y: (S.A.y + S.B.y + S.C.y) / 3 }
        const outward = (p, dist) => {
            const dx = p.x - cen.x
            const dy = p.y - cen.y
            const m = Math.hypot(dx, dy) || 1
            return { x: p.x + (dx / m) * dist, y: p.y + (dy / m) * dist }
        }

        // Filled body.
        ctx.beginPath()
        ctx.moveTo(S.A.x, S.A.y)
        ctx.lineTo(S.B.x, S.B.y)
        ctx.lineTo(S.C.x, S.C.y)
        ctx.closePath()
        ctx.globalAlpha = 0.16
        ctx.fillStyle = accent
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.lineWidth = 2.5
        ctx.lineJoin = 'round'
        ctx.strokeStyle = accent
        ctx.stroke()

        // Vertex dots.
        for (const k of ['A', 'B', 'C']) {
            ctx.beginPath()
            ctx.arc(S[k].x, S[k].y, 4, 0, 2 * Math.PI)
            ctx.fillStyle = accent
            ctx.fill()
        }

        // Side-length labels at each edge midpoint (AB=c, BC=a, CA=b).
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '13px system-ui, sans-serif'
        const edges = [
            { p: S.A, q: S.B, key: 'c' },
            { p: S.B, q: S.C, key: 'a' },
            { p: S.C, q: S.A, key: 'b' }
        ]
        for (const e of edges) {
            const mid = { x: (e.p.x + e.q.x) / 2, y: (e.p.y + e.q.y) / 2 }
            const pos = outward(mid, 16)
            ctx.fillStyle = muted
            ctx.fillText(`${e.key} = ${fmt(active[e.key])}`, pos.x, pos.y)
        }

        // Vertex letters (outward) and angle measures (inward).
        for (const k of ['A', 'B', 'C']) {
            const outPos = outward(S[k], 22)
            ctx.font = '700 16px system-ui, sans-serif'
            ctx.fillStyle = accent
            ctx.fillText(k, outPos.x, outPos.y)

            const inDx = cen.x - S[k].x
            const inDy = cen.y - S[k].y
            const m = Math.hypot(inDx, inDy) || 1
            const inPos = { x: S[k].x + (inDx / m) * 34, y: S[k].y + (inDy / m) * 34 }
            ctx.font = '12px system-ui, sans-serif'
            ctx.fillStyle = text
            ctx.fillText(fmtDeg(active[k]), inPos.x, inPos.y)
        }
    }, [active, result.error, themeKey])

    const applyPreset = (p) => setInputs({ ...EMPTY, ...p.vals })
    const clearAll = () => setInputs(EMPTY)

    return (
        <div className="page">
            <div className="page-head">
                <h1>Triangle Solver</h1>
                <p>Enter any valid combination of at least three parts (including one side) — sides a, b, c and angles A, B, C, where angle A is opposite side a. It detects the case (SSS, SAS, ASA/AAS or the ambiguous SSA) and solves the whole triangle.</p>
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Known parts</h2>

                    <div className="row">
                        {SIDE_KEYS.map((k) => (
                            <label className="field" key={k}>
                                side {k}
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="any"
                                    value={inputs[k]}
                                    onChange={setField(k)}
                                    placeholder="—"
                                    aria-label={`side ${k}`}
                                />
                            </label>
                        ))}
                    </div>

                    <div className="row" style={{ marginTop: '0.6rem' }}>
                        {ANGLE_KEYS.map((k) => (
                            <label className="field" key={k}>
                                angle {k} (°)
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    max="180"
                                    step="any"
                                    value={inputs[k]}
                                    onChange={setField(k)}
                                    placeholder="—"
                                    aria-label={`angle ${k} in degrees`}
                                />
                            </label>
                        ))}
                    </div>

                    <div className="hint" style={{ marginTop: '0.7rem' }}>
                        Angle A is opposite side a, B opposite b, C opposite c. Leave unknown parts blank.
                    </div>

                    <h2 style={{ marginTop: '1.1rem' }}>Examples</h2>
                    <div className="row">
                        {PRESETS.map((p) => (
                            <button key={p.label} className="btn ghost" onClick={() => applyPreset(p)}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <button className="btn" style={{ marginTop: '0.7rem', width: '100%' }} onClick={clearAll}>
                        Clear
                    </button>
                </div>

                <div className="canvas-frame">
                    <canvas
                        ref={canvasRef}
                        width={620}
                        height={460}
                        aria-label="Scale drawing of the solved triangle with labelled vertices, sides and angles"
                    />

                    {result.error && (
                        <div className="hint" style={{ color: 'var(--danger)', marginTop: '0.4rem' }}>
                            {result.error}
                        </div>
                    )}

                    {solutions && (
                        <div style={{ marginTop: '0.6rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <strong style={{ color: 'var(--accent)' }}>{result.caseName}</strong>
                                {solutions.length > 1 && (
                                    <div className="seg-control">
                                        {solutions.map((_, i) => (
                                            <button
                                                key={i}
                                                className={i === idx ? 'active' : ''}
                                                onClick={() => setActiveIdx(i)}
                                            >
                                                Solution {i + 1}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {result.note && (
                                <div className="hint" style={{ marginTop: '0.4rem' }}>{result.note}</div>
                            )}

                            {active && (
                                <>
                                    <div className="stat-grid" style={{ marginTop: '0.8rem' }}>
                                        <div className="stat"><div className="label">Side a</div><div className="value">{fmt(active.a)}</div></div>
                                        <div className="stat"><div className="label">Side b</div><div className="value">{fmt(active.b)}</div></div>
                                        <div className="stat"><div className="label">Side c</div><div className="value">{fmt(active.c)}</div></div>
                                        <div className="stat"><div className="label">Angle A</div><div className="value">{fmtDeg(active.A)}</div></div>
                                        <div className="stat"><div className="label">Angle B</div><div className="value">{fmtDeg(active.B)}</div></div>
                                        <div className="stat"><div className="label">Angle C</div><div className="value">{fmtDeg(active.C)}</div></div>
                                    </div>

                                    <div className="stat-grid" style={{ marginTop: '0.6rem' }}>
                                        <div className="stat"><div className="label">Perimeter</div><div className="value">{fmt(active.perimeter)}</div></div>
                                        <div className="stat"><div className="label">Area</div><div className="value">{fmt(active.area)}</div></div>
                                        <div className="stat"><div className="label">By angles</div><div className="value" style={{ fontSize: '0.95rem', textTransform: 'capitalize' }}>{active.angleType}</div></div>
                                        <div className="stat"><div className="label">By sides</div><div className="value" style={{ fontSize: '0.95rem', textTransform: 'capitalize' }}>{active.sideType}</div></div>
                                    </div>

                                    <div className="stat-grid" style={{ marginTop: '0.6rem' }}>
                                        <div className="stat"><div className="label">Height to a</div><div className="value">{fmt(active.heights.a)}</div></div>
                                        <div className="stat"><div className="label">Height to b</div><div className="value">{fmt(active.heights.b)}</div></div>
                                        <div className="stat"><div className="label">Height to c</div><div className="value">{fmt(active.heights.c)}</div></div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default TrianglePage

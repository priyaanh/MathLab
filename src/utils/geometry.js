/**
 * Pure geometry calculations for the Lines and Shapes tools.
 */

const round = (n, d = 4) => {
    if (!Number.isFinite(n)) return n
    const f = Math.pow(10, d)
    return Math.round(n * f) / f
}

// --- Lines & segments ---------------------------------------------------

export const slope = (x1, y1, x2, y2) => {
    if (x2 === x1) return Infinity // vertical line
    return round((y2 - y1) / (x2 - x1))
}

export const distance = (x1, y1, x2, y2) =>
    round(Math.hypot(x2 - x1, y2 - y1))

export const midpoint = (x1, y1, x2, y2) => ({
    x: round((x1 + x2) / 2),
    y: round((y1 + y2) / 2)
})

// Slope-intercept string for a line through two points.
export const lineEquation = (x1, y1, x2, y2) => {
    if (x2 === x1) return `x = ${round(x1)}`
    const m = (y2 - y1) / (x2 - x1)
    const b = y1 - m * x1
    const mStr = round(m)
    const bStr = round(Math.abs(b))
    if (b === 0) return `y = ${mStr}x`
    return `y = ${mStr}x ${b < 0 ? '−' : '+'} ${bStr}`
}

// --- Shapes -------------------------------------------------------------

// Shoelace formula for polygon area (absolute value).
export const polygonArea = (points) => {
    let area = 0
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length
        area += points[i].x * points[j].y - points[j].x * points[i].y
    }
    return round(Math.abs(area) / 2)
}

export const polygonPerimeter = (points) => {
    let p = 0
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length
        p += Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y)
    }
    return round(p)
}

export const circleArea = (r) => round(Math.PI * r * r)
export const circleCircumference = (r) => round(2 * Math.PI * r)

// Vertices of a regular n-gon centered at (cx, cy) with circumradius r.
export const regularPolygonPoints = (cx, cy, r, n, rotation = -Math.PI / 2) => {
    const pts = []
    for (let i = 0; i < n; i++) {
        const a = rotation + (i * 2 * Math.PI) / n
        pts.push({ x: round(cx + r * Math.cos(a)), y: round(cy + r * Math.sin(a)) })
    }
    return pts
}

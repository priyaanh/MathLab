/**
 * Shared 2D coordinate-plane helpers used by the geometry tools
 * (lines, shapes, inequalities). Keeps canvas transforms and grid drawing
 * in one place so every tool looks and behaves the same.
 */

// Read a CSS custom property off the document root (theme-aware colors).
export const cssVar = (name, fallback) => {
    if (typeof window === 'undefined') return fallback
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
}

/**
 * Download a plot canvas as a PNG. The plot is drawn on a transparent backing
 * store, so composite it onto the theme background first — otherwise the export
 * is transparent (shows as white/checkerboard in image viewers).
 */
export const exportCanvasPng = (canvas, filename = 'mathlab-graph.png') => {
    if (!canvas) return
    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const ctx = out.getContext('2d')
    ctx.fillStyle = cssVar('--bg-2', '#0f1420')
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(canvas, 0, 0)
    const a = document.createElement('a')
    a.href = out.toDataURL('image/png')
    a.download = filename
    a.click()
}

/**
 * Size a canvas's backing store to its real on-screen size × devicePixelRatio,
 * then scale the drawing context so code can keep drawing in a fixed "logical"
 * coordinate space (0..logicalW, 0..logicalH). This is what keeps grid lines and
 * axis labels crisp instead of blurring when CSS stretches the element.
 * Returns the 2D context, transform already applied.
 */
export const prepareHiDPICanvas = (canvas, logicalW, logicalH) => {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
    const rect = canvas.getBoundingClientRect()
    const cssW = rect.width || logicalW
    const cssH = rect.height || logicalH
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    // Map logical space onto the full (device-pixel) backing store.
    ctx.setTransform(canvas.width / logicalW, 0, 0, canvas.height / logicalH, 0, 0)
    return ctx
}

/**
 * Build a transform object mapping graph coordinates <-> canvas pixels.
 */
export const makeView = (width, height, view) => {
    const { xMin, xMax, yMin, yMax } = view
    const toX = (x) => ((x - xMin) / (xMax - xMin)) * width
    const toY = (y) => height - ((y - yMin) / (yMax - yMin)) * height
    const fromX = (px) => xMin + (px / width) * (xMax - xMin)
    const fromY = (py) => yMin + ((height - py) / height) * (yMax - yMin)
    return { toX, toY, fromX, fromY, width, height, ...view }
}

// Choose a "nice" grid spacing so ~10 lines are visible across the range.
const niceStep = (range) => {
    const rough = range / 10
    const pow = Math.pow(10, Math.floor(Math.log10(rough)))
    const norm = rough / pow
    const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
    return step * pow
}

/**
 * Draw a themed grid, axes and numeric ticks. Returns the grid step used.
 */
export const drawGrid = (ctx, v) => {
    const { width, height, xMin, xMax, yMin, yMax, toX, toY } = v

    ctx.fillStyle = cssVar('--bg-2', '#0f1420')
    ctx.fillRect(0, 0, width, height)

    const step = niceStep(Math.max(xMax - xMin, yMax - yMin))
    const grid = cssVar('--grid', '#243049')
    const axis = cssVar('--axis', '#5c6b86')
    const muted = cssVar('--text-muted', '#94a3b8')

    ctx.lineWidth = 1
    ctx.strokeStyle = grid
    ctx.font = '10px system-ui, sans-serif'
    ctx.fillStyle = muted

    // Vertical grid lines + x tick labels
    for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
        const px = toX(x)
        ctx.beginPath()
        ctx.moveTo(px, 0)
        ctx.lineTo(px, height)
        ctx.stroke()
        if (Math.abs(x) > 1e-9) {
            ctx.fillText(formatTick(x), px + 2, toY(0) - 3)
        }
    }

    // Horizontal grid lines + y tick labels
    for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
        const py = toY(y)
        ctx.beginPath()
        ctx.moveTo(0, py)
        ctx.lineTo(width, py)
        ctx.stroke()
        if (Math.abs(y) > 1e-9) {
            ctx.fillText(formatTick(y), toX(0) + 4, py - 2)
        }
    }

    // Axes
    ctx.strokeStyle = axis
    ctx.lineWidth = 1.75
    if (yMin <= 0 && yMax >= 0) {
        const y0 = toY(0)
        ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(width, y0); ctx.stroke()
    }
    if (xMin <= 0 && xMax >= 0) {
        const x0 = toX(0)
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, height); ctx.stroke()
    }

    return step
}

const formatTick = (n) => {
    const rounded = Math.round(n * 1000) / 1000
    return String(rounded)
}

// Draw a labelled point marker.
export const drawPoint = (ctx, v, x, y, color, label) => {
    const px = v.toX(x)
    const py = v.toY(y)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(px, py, 5, 0, 2 * Math.PI)
    ctx.fill()
    ctx.strokeStyle = cssVar('--bg-2', '#0f1420')
    ctx.lineWidth = 2
    ctx.stroke()
    if (label) {
        ctx.fillStyle = cssVar('--text', '#eef2fb')
        ctx.font = '11px system-ui, sans-serif'
        ctx.fillText(label, px + 8, py - 8)
    }
}

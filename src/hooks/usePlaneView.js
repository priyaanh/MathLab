import { useState, useCallback, useRef, useEffect } from 'react'

// Span limits (in graph units) shared by every coordinate-plane tool, so no
// tool can zoom in to a meaningless sliver or out until content collapses.
const MIN_SPAN = 0.5
const MAX_SPAN = 100000

const clampSpan = (span) => Math.min(MAX_SPAN, Math.max(MIN_SPAN, span))

/**
 * Stateful pan/zoom/fit viewport for the geometry tools (Lines, Shapes,
 * Transformations, Inequalities). Keeps every plane behaving identically:
 * wheel-zoom toward the cursor, arrow/button panning, zoom in/out, fit-to-
 * content and reset. Returns the live `view` plus actions.
 *
 * @param {{xMin:number,xMax:number,yMin:number,yMax:number}} initialView
 */
export const usePlaneView = (initialView) => {
    // Keep the original view stable for reset() even if a new literal is passed.
    const initialRef = useRef(initialView)
    const [view, setView] = useState(initialRef.current)

    const pan = useCallback((dx, dy) => {
        setView(v => ({ xMin: v.xMin + dx, xMax: v.xMax + dx, yMin: v.yMin + dy, yMax: v.yMax + dy }))
    }, [])

    // Zoom keeping the graph point (gx, gy) fixed under the cursor. When gx/gy
    // are omitted the current center is used (button zoom).
    const zoomAt = useCallback((factor, gx, gy) => {
        setView(v => {
            const cx = gx == null ? (v.xMin + v.xMax) / 2 : gx
            const cy = gy == null ? (v.yMin + v.yMax) / 2 : gy
            const xSpan = clampSpan((v.xMax - v.xMin) / factor)
            const ySpan = clampSpan((v.yMax - v.yMin) / factor)
            // Preserve the cursor's fractional position within each axis.
            const fx = (cx - v.xMin) / (v.xMax - v.xMin)
            const fy = (cy - v.yMin) / (v.yMax - v.yMin)
            return {
                xMin: cx - fx * xSpan,
                xMax: cx + (1 - fx) * xSpan,
                yMin: cy - fy * ySpan,
                yMax: cy + (1 - fy) * ySpan
            }
        })
    }, [])

    const zoom = useCallback((factor) => zoomAt(factor), [zoomAt])

    const reset = useCallback(() => setView(initialRef.current), [])

    // Fit the view to a content bounding box using a uniform units-per-pixel
    // scale (so shapes keep their true aspect on the given canvas size).
    const fitTo = useCallback((bounds, { width = 1, height = 1, pad = 0.15 } = {}) => {
        if (!bounds || !Number.isFinite(bounds.minX)) return
        let { minX, maxX, minY, maxY } = bounds
        // Guard degenerate boxes (a single point / horizontal or vertical set).
        if (maxX - minX < 1e-6) { minX -= 1; maxX += 1 }
        if (maxY - minY < 1e-6) { minY -= 1; maxY += 1 }
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2
        const spanX = (maxX - minX) * (1 + pad)
        const spanY = (maxY - minY) * (1 + pad)
        // Uniform scale: pick the axis that needs the most room per pixel.
        const unitsPerPx = Math.max(spanX / width, spanY / height)
        const halfW = clampSpan(unitsPerPx * width) / 2
        const halfH = clampSpan(unitsPerPx * height) / 2
        setView({ xMin: cx - halfW, xMax: cx + halfW, yMin: cy - halfH, yMax: cy + halfH })
    }, [])

    const spanX = view.xMax - view.xMin
    const spanY = view.yMax - view.yMin
    const canZoomIn = Math.min(spanX, spanY) > MIN_SPAN + 1e-9
    const canZoomOut = Math.max(spanX, spanY) < MAX_SPAN - 1e-9

    return { view, setView, pan, zoom, zoomAt, reset, fitTo, canZoomIn, canZoomOut }
}

/**
 * Make a plot canvas keyboard-navigable. Once the canvas is focused (click or
 * Tab), arrow keys pan the view, +/- zoom, and Home resets. Panning is a
 * fraction of the current span so it feels the same at every zoom level; hold
 * Shift for larger steps. Shared by every coordinate-plane tool.
 *
 * @param {object} canvasRef  React ref to the <canvas>
 * @param {object} view       current { xMin, xMax, yMin, yMax }
 * @param {object} actions    { pan, zoomAt, reset }
 */
export const useKeyboardPan = (canvasRef, view, { pan, zoomAt, reset } = {}) => {
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !pan) return
        // Make the canvas focusable so it can receive key events on click/Tab.
        if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0

        const onKey = (e) => {
            const spanX = view.xMax - view.xMin
            const spanY = view.yMax - view.yMin
            const f = e.shiftKey ? 0.25 : 0.08
            switch (e.key) {
                case 'ArrowLeft': pan(-spanX * f, 0); break
                case 'ArrowRight': pan(spanX * f, 0); break
                case 'ArrowUp': pan(0, spanY * f); break
                case 'ArrowDown': pan(0, -spanY * f); break
                case '+': case '=': zoomAt && zoomAt(1.15); break
                case '-': case '_': zoomAt && zoomAt(1 / 1.15); break
                case 'Home': case '0': reset && reset(); break
                default: return
            }
            e.preventDefault()
        }
        canvas.addEventListener('keydown', onKey)
        return () => canvas.removeEventListener('keydown', onKey)
    }, [canvasRef, view, pan, zoomAt, reset])
}

/**
 * Attach a non-passive wheel-zoom listener to a canvas. Returns a cleanup fn.
 * `toGraph` converts a pointer event to { gx, gy } graph coordinates.
 */
export const bindWheelZoom = (canvas, toGraph, zoomAt) => {
    if (!canvas) return () => {}
    const onWheel = (e) => {
        e.preventDefault()
        const { gx, gy } = toGraph(e)
        zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, gx, gy)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
}

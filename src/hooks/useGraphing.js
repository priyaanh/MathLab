import { useState, useCallback, useMemo } from 'react'
import { findZeros, findIntersections, generateTableData, evaluateFunction } from '../utils/graphUtils'

// Predefined colors for functions
const FUNCTION_COLORS = [
    '#ff6600', // Orange
    '#00cc66', // Green
    '#3399ff', // Blue
    '#ff3366', // Pink
    '#9933ff', // Purple
    '#ffcc00', // Yellow
    '#00cccc', // Cyan
    '#ff6699', // Light Pink
]

// Zoom limits: the smallest and largest span (in graph units) allowed on
// either axis. Prevents zooming in to a meaningless sliver or out so far the
// curve collapses to a flat line.
const MIN_SPAN = 0.5
const MAX_SPAN = 100000

/**
 * Custom hook for managing graphing state
 */
export const useGraphing = () => {
    // Multiple functions state
    const [functions, setFunctions] = useState([
        { id: 1, expression: 'sin(x)', color: FUNCTION_COLORS[0], visible: true }
    ])
    const [nextId, setNextId] = useState(2)

    // Viewport state
    const [xMin, setXMin] = useState(-10)
    const [xMax, setXMax] = useState(10)
    const [yMin, setYMin] = useState(-10)
    const [yMax, setYMax] = useState(10)

    // Trace mode state
    const [traceEnabled, setTraceEnabled] = useState(false)
    const [tracePosition, setTracePosition] = useState(null) // {x, y, funcId}

    // Analysis state
    const [showZeros, setShowZeros] = useState(false)
    const [showIntersections, setShowIntersections] = useState(false)
    const [showTable, setShowTable] = useState(false)
    const [selectedFunctionForTable, setSelectedFunctionForTable] = useState(1)

    // Add a new function
    const addFunction = useCallback(() => {
        const colorIndex = functions.length % FUNCTION_COLORS.length
        setFunctions(prev => [
            ...prev,
            { id: nextId, expression: '', color: FUNCTION_COLORS[colorIndex], visible: true }
        ])
        setNextId(prev => prev + 1)
    }, [functions.length, nextId])

    // Remove a function
    const removeFunction = useCallback((id) => {
        setFunctions(prev => prev.filter(f => f.id !== id))
    }, [])

    // Update a function's expression
    const updateFunctionExpression = useCallback((id, expression) => {
        setFunctions(prev => prev.map(f =>
            f.id === id ? { ...f, expression } : f
        ))
    }, [])

    // Update a function's color
    const updateFunctionColor = useCallback((id, color) => {
        setFunctions(prev => prev.map(f =>
            f.id === id ? { ...f, color } : f
        ))
    }, [])

    // Toggle function visibility
    const toggleFunctionVisibility = useCallback((id) => {
        setFunctions(prev => prev.map(f =>
            f.id === id ? { ...f, visible: !f.visible } : f
        ))
    }, [])

    // Calculate zeros for all visible functions
    const zeros = useMemo(() => {
        if (!showZeros) return []
        const allZeros = []
        functions.forEach(func => {
            if (func.visible && func.expression.trim()) {
                const funcZeros = findZeros(func.expression, xMin, xMax)
                funcZeros.forEach(zero => {
                    allZeros.push({ ...zero, funcId: func.id, color: func.color })
                })
            }
        })
        return allZeros
    }, [functions, xMin, xMax, showZeros])

    // Calculate intersections between visible functions
    const intersections = useMemo(() => {
        if (!showIntersections) return []
        const visibleFuncs = functions.filter(f => f.visible && f.expression.trim())
        const allIntersections = []

        for (let i = 0; i < visibleFuncs.length; i++) {
            for (let j = i + 1; j < visibleFuncs.length; j++) {
                const ints = findIntersections(
                    visibleFuncs[i].expression,
                    visibleFuncs[j].expression,
                    xMin, xMax
                )
                ints.forEach(int => {
                    allIntersections.push({
                        ...int,
                        func1Id: visibleFuncs[i].id,
                        func2Id: visibleFuncs[j].id
                    })
                })
            }
        }
        return allIntersections
    }, [functions, xMin, xMax, showIntersections])

    // Generate table data for selected function
    const tableData = useMemo(() => {
        if (!showTable) return []
        const func = functions.find(f => f.id === selectedFunctionForTable)
        if (!func || !func.expression.trim()) return []
        return generateTableData(func.expression, xMin, xMax, 21)
    }, [functions, selectedFunctionForTable, xMin, xMax, showTable])

    // Reset viewport to default
    const resetViewport = useCallback(() => {
        setXMin(-10)
        setXMax(10)
        setYMin(-10)
        setYMax(10)
    }, [])

    // Zoom in/out (centered), clamped so you can't zoom in past a tiny window
    // or out past a huge one — either extreme makes the plot unusable.
    const zoom = useCallback((factor) => {
        const xCenter = (xMin + xMax) / 2
        const yCenter = (yMin + yMax) / 2

        const clampSpan = (span) => Math.min(MAX_SPAN, Math.max(MIN_SPAN, span))
        const xSpan = clampSpan((xMax - xMin) / factor)
        const ySpan = clampSpan((yMax - yMin) / factor)

        setXMin(xCenter - xSpan / 2)
        setXMax(xCenter + xSpan / 2)
        setYMin(yCenter - ySpan / 2)
        setYMax(yCenter + ySpan / 2)
    }, [xMin, xMax, yMin, yMax])

    // Zoom toward a specific graph point (gx, gy) — used by wheel-zoom so the
    // point under the cursor stays put. Omitting gx/gy zooms about the center.
    const zoomAt = useCallback((factor, gx, gy) => {
        const cx = gx == null ? (xMin + xMax) / 2 : gx
        const cy = gy == null ? (yMin + yMax) / 2 : gy
        const clamp = (span) => Math.min(MAX_SPAN, Math.max(MIN_SPAN, span))
        const xSpan = clamp((xMax - xMin) / factor)
        const ySpan = clamp((yMax - yMin) / factor)
        const fx = (cx - xMin) / (xMax - xMin)
        const fy = (cy - yMin) / (yMax - yMin)
        setXMin(cx - fx * xSpan)
        setXMax(cx + (1 - fx) * xSpan)
        setYMin(cy - fy * ySpan)
        setYMax(cy + (1 - fy) * ySpan)
    }, [xMin, xMax, yMin, yMax])

    // Fit the y-range to the visible curves over the current x-window (with a
    // little headroom), so a flat or off-screen plot snaps back into frame.
    const fitView = useCallback(() => {
        const visible = functions.filter(f => f.visible && f.expression.trim())
        let lo = Infinity
        let hi = -Infinity
        const N = 240
        visible.forEach(f => {
            for (let i = 0; i <= N; i++) {
                const x = xMin + (i / N) * (xMax - xMin)
                const y = evaluateFunction(f.expression, x)
                if (Number.isFinite(y)) {
                    if (y < lo) lo = y
                    if (y > hi) hi = y
                }
            }
        })
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
            setYMin(-10)
            setYMax(10)
            return
        }
        if (hi - lo < 1e-6) { lo -= 1; hi += 1 }
        const pad = (hi - lo) * 0.1
        const span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, (hi - lo) + 2 * pad))
        const cy = (lo + hi) / 2
        setYMin(cy - span / 2)
        setYMax(cy + span / 2)
    }, [functions, xMin, xMax])

    // Whether zooming further in/out would have any effect (for disabling
    // the buttons at the limits).
    const currentSpan = Math.max(xMax - xMin, yMax - yMin)
    const canZoomIn = Math.min(xMax - xMin, yMax - yMin) > MIN_SPAN + 1e-9
    const canZoomOut = currentSpan < MAX_SPAN - 1e-9

    // Pan by offset (in graph units)
    const pan = useCallback((dx, dy) => {
        setXMin(prev => prev + dx)
        setXMax(prev => prev + dx)
        setYMin(prev => prev + dy)
        setYMax(prev => prev + dy)
    }, [])

    // Toggle trace mode
    const toggleTrace = useCallback(() => {
        setTraceEnabled(prev => !prev)
        if (traceEnabled) {
            setTracePosition(null)
        }
    }, [traceEnabled])

    return {
        // Functions
        functions,
        addFunction,
        removeFunction,
        updateFunctionExpression,
        updateFunctionColor,
        toggleFunctionVisibility,

        // Viewport
        xMin, xMax, yMin, yMax,
        setXMin, setXMax, setYMin, setYMax,
        resetViewport,
        zoom,
        zoomAt,
        fitView,
        canZoomIn,
        canZoomOut,
        pan,

        // Trace mode
        traceEnabled,
        toggleTrace,
        tracePosition,
        setTracePosition,

        // Analysis
        showZeros, setShowZeros,
        showIntersections, setShowIntersections,
        zeros,
        intersections,

        // Table
        showTable, setShowTable,
        selectedFunctionForTable, setSelectedFunctionForTable,
        tableData
    }
}

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { generatePlotPoints, validateFunction, getYAtX } from '../utils/graphUtils'
import { prepareHiDPICanvas, cssVar } from '../utils/plane'
import { useThemeContext } from '../theme/ThemeContext'
import { useKeyboardPan } from '../hooks/usePlaneView'

/**
 * Graphing mode component that renders multiple function graphs with analysis tools
 */
const GraphingMode = React.memo(({
    // Functions
    functions,
    addFunction,
    removeFunction,
    updateFunctionExpression,
    updateFunctionColor,
    toggleFunctionVisibility,

    // Viewport
    xMin, xMax, yMin, yMax,
    zoom,
    zoomAt,
    fitView,
    canZoomIn = true,
    canZoomOut = true,
    pan,
    resetViewport,

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
    tableData,

    // Compact mode for embedded display
    compact = false
}) => {
    const canvasRef = useRef(null)
    const { themeKey } = useThemeContext()

    // Arrow keys pan / +/- zoom / Home reset once the canvas is focused (click or Tab).
    useKeyboardPan(canvasRef, { xMin, xMax, yMin, yMax }, { pan, zoomAt, reset: resetViewport })

    // Bumped whenever the canvas element changes size, so the draw effect
    // re-runs and re-samples the backing store at the new (crisp) resolution.
    const [resizeTick, setResizeTick] = useState(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || typeof ResizeObserver === 'undefined') return
        let raf = 0
        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => setResizeTick(t => t + 1))
        })
        ro.observe(canvas)
        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
        }
    }, [])

    // Canvas dimensions
    const CANVAS_WIDTH = 370
    const CANVAS_HEIGHT = compact ? 200 : 280

    // Coordinate transformation helpers
    const toCanvasX = useCallback((x) => {
        return ((x - xMin) / (xMax - xMin)) * CANVAS_WIDTH
    }, [xMin, xMax])

    const toCanvasY = useCallback((y) => {
        return CANVAS_HEIGHT - ((y - yMin) / (yMax - yMin)) * CANVAS_HEIGHT
    }, [yMin, yMax])

    // Generate plot points for all functions
    const allPlotData = useMemo(() => {
        return functions.map(func => {
            if (!func.visible || !func.expression.trim()) {
                return { ...func, points: [], valid: false }
            }
            const validation = validateFunction(func.expression)
            if (!validation.valid) {
                return { ...func, points: [], valid: false, error: validation.error }
            }
            const points = generatePlotPoints(func.expression, xMin, xMax, 500)
            return { ...func, points, valid: true }
        })
    }, [functions, xMin, xMax])

    // Draw the graph
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        // Render at true display resolution so lines and tick labels stay sharp.
        const ctx = prepareHiDPICanvas(canvas, CANVAS_WIDTH, CANVAS_HEIGHT)

        // Theme-aware palette (re-read each draw so it follows the site theme)
        const bgColor = cssVar('--bg-2', '#1a1a1a')
        const gridColor = cssVar('--grid', '#333')
        const axisColor = cssVar('--axis', '#666')
        const labelColor = cssVar('--text-muted', '#9aa4b2')

        // Clear canvas
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

        // Draw grid lines
        ctx.strokeStyle = gridColor
        ctx.lineWidth = 0.5

        const xRange = xMax - xMin
        const yRange = yMax - yMin
        const gridSpacing = xRange <= 5 ? 0.5 : xRange <= 20 ? 1 : xRange <= 50 ? 5 : 10

        // Vertical grid lines
        for (let x = Math.ceil(xMin / gridSpacing) * gridSpacing; x <= xMax; x += gridSpacing) {
            const canvasX = toCanvasX(x)
            ctx.beginPath()
            ctx.moveTo(canvasX, 0)
            ctx.lineTo(canvasX, CANVAS_HEIGHT)
            ctx.stroke()
        }

        // Horizontal grid lines
        for (let y = Math.ceil(yMin / gridSpacing) * gridSpacing; y <= yMax; y += gridSpacing) {
            const canvasY = toCanvasY(y)
            ctx.beginPath()
            ctx.moveTo(0, canvasY)
            ctx.lineTo(CANVAS_WIDTH, canvasY)
            ctx.stroke()
        }

        // Draw axes
        ctx.strokeStyle = axisColor
        ctx.lineWidth = 1.5

        // X-axis
        if (yMin <= 0 && yMax >= 0) {
            const y0 = toCanvasY(0)
            ctx.beginPath()
            ctx.moveTo(0, y0)
            ctx.lineTo(CANVAS_WIDTH, y0)
            ctx.stroke()
        }

        // Y-axis
        if (xMin <= 0 && xMax >= 0) {
            const x0 = toCanvasX(0)
            ctx.beginPath()
            ctx.moveTo(x0, 0)
            ctx.lineTo(x0, CANVAS_HEIGHT)
            ctx.stroke()
        }

        // Numeric labels along the axes
        const y0 = toCanvasY(0)
        const x0 = toCanvasX(0)
        const fmt = (n) => String(Math.round(n * 1000) / 1000)

        // Thin out labels when grid lines are dense so numbers don't collide.
        const xTickCount = Math.round(xRange / gridSpacing)
        const yTickCount = Math.round(yRange / gridSpacing)
        const xEvery = xTickCount > 14 ? 2 : 1
        const yEvery = yTickCount > 14 ? 2 : 1

        ctx.fillStyle = labelColor
        ctx.font = '10px system-ui, sans-serif'

        // X-axis numbers (kept on-screen even if the axis is scrolled away).
        // Thinning is keyed to each tick's value (k) rather than a loop index,
        // so the SAME numbers are labelled no matter where you've panned to —
        // otherwise the shown labels flicker between odd/even ticks while panning.
        const xLabelY = Math.min(Math.max(y0 + 12, 12), CANVAS_HEIGHT - 3)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        for (let x = Math.ceil(xMin / gridSpacing) * gridSpacing; x <= xMax + 1e-9; x += gridSpacing) {
            const k = Math.round(x / gridSpacing)
            if (k === 0 || k % xEvery !== 0) continue
            ctx.fillText(fmt(x), toCanvasX(x), xLabelY)
        }

        // Y-axis numbers
        const yLabelX = Math.min(Math.max(x0 + 5, 5), CANVAS_WIDTH - 5)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        for (let y = Math.ceil(yMin / gridSpacing) * gridSpacing; y <= yMax + 1e-9; y += gridSpacing) {
            const k = Math.round(y / gridSpacing)
            if (k === 0 || k % yEvery !== 0) continue
            ctx.fillText(fmt(y), yLabelX, toCanvasY(y))
        }

        // Origin
        if (yMin <= 0 && yMax >= 0 && xMin <= 0 && xMax >= 0) {
            ctx.textAlign = 'right'
            ctx.textBaseline = 'top'
            ctx.fillText('0', x0 - 4, y0 + 3)
        }

        // Reset text alignment for any later canvas text
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'

        // Draw each function curve
        allPlotData.forEach(funcData => {
            if (!funcData.valid || funcData.points.length === 0) return

            ctx.strokeStyle = funcData.color
            ctx.lineWidth = 2
            ctx.beginPath()

            let started = false
            let lastY = null

            for (const point of funcData.points) {
                const canvasX = toCanvasX(point.x)
                const canvasY = toCanvasY(point.y)

                if (isNaN(point.y)) {
                    started = false
                    lastY = null
                    continue
                }

                if (lastY !== null && Math.abs(point.y - lastY) > yRange * 0.5) {
                    started = false
                }

                if (canvasY < -1000 || canvasY > CANVAS_HEIGHT + 1000) {
                    started = false
                    lastY = point.y
                    continue
                }

                if (!started) {
                    ctx.moveTo(canvasX, canvasY)
                    started = true
                } else {
                    ctx.lineTo(canvasX, canvasY)
                }

                lastY = point.y
            }
            ctx.stroke()
        })

        // Draw zeros
        if (showZeros && zeros.length > 0) {
            zeros.forEach(zero => {
                const canvasX = toCanvasX(zero.x)
                const canvasY = toCanvasY(0)

                ctx.fillStyle = zero.color
                ctx.beginPath()
                ctx.arc(canvasX, canvasY, 6, 0, 2 * Math.PI)
                ctx.fill()

                // Inner dot punches a themed "hole" so the marker reads on any theme.
                ctx.fillStyle = cssVar('--bg-2', '#1a1a1a')
                ctx.beginPath()
                ctx.arc(canvasX, canvasY, 3, 0, 2 * Math.PI)
                ctx.fill()
            })
        }

        // Draw intersections
        if (showIntersections && intersections.length > 0) {
            intersections.forEach(int => {
                const canvasX = toCanvasX(int.x)
                const canvasY = toCanvasY(int.y)

                ctx.fillStyle = cssVar('--text', '#ffffff')
                ctx.beginPath()
                ctx.arc(canvasX, canvasY, 6, 0, 2 * Math.PI)
                ctx.fill()

                ctx.fillStyle = cssVar('--danger', '#ff3b30')
                ctx.beginPath()
                ctx.arc(canvasX, canvasY, 4, 0, 2 * Math.PI)
                ctx.fill()
            })
        }

        // Draw trace point
        if (traceEnabled && tracePosition) {
            const canvasX = toCanvasX(tracePosition.x)
            const canvasY = toCanvasY(tracePosition.y)

            // Crosshair
            ctx.strokeStyle = cssVar('--accent', '#ffcc00')
            ctx.lineWidth = 1
            ctx.setLineDash([3, 3])
            ctx.beginPath()
            ctx.moveTo(canvasX, 0)
            ctx.lineTo(canvasX, CANVAS_HEIGHT)
            ctx.moveTo(0, canvasY)
            ctx.lineTo(CANVAS_WIDTH, canvasY)
            ctx.stroke()
            ctx.setLineDash([])

            // Point
            ctx.fillStyle = cssVar('--accent', '#ffcc00')
            ctx.beginPath()
            ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI)
            ctx.fill()
        }
    }, [allPlotData, xMin, xMax, yMin, yMax, toCanvasX, toCanvasY, showZeros, zeros, showIntersections, intersections, traceEnabled, tracePosition, resizeTick, themeKey])

    // Drag-to-pan: remembers the last pointer position while a drag is active.
    const dragRef = useRef(null)

    const handleMouseDown = useCallback((e) => {
        dragRef.current = { x: e.clientX, y: e.clientY }
    }, [])

    // Handle mouse move for dragging (pan) and trace mode.
    const handleMouseMove = useCallback((e) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()

        // Dragging pans the view: move the window opposite to the drag so the
        // point under the cursor stays under the cursor.
        if (dragRef.current) {
            const dxPx = e.clientX - dragRef.current.x
            const dyPx = e.clientY - dragRef.current.y
            const dxGraph = -(dxPx / rect.width) * (xMax - xMin)
            const dyGraph = (dyPx / rect.height) * (yMax - yMin)
            pan(dxGraph, dyGraph)
            dragRef.current = { x: e.clientX, y: e.clientY }
            return
        }

        if (!traceEnabled) return

        const canvasX = e.clientX - rect.left
        // Scale by the element's real displayed width (it may be stretched by CSS).
        const graphX = xMin + (canvasX / rect.width) * (xMax - xMin)

        // Find the closest visible function and get its y value
        const visibleFuncs = functions.filter(f => f.visible && f.expression.trim())
        if (visibleFuncs.length === 0) return

        // Use the first visible function for tracing
        const func = visibleFuncs[0]
        const y = getYAtX(func.expression, graphX)

        if (!isNaN(y)) {
            setTracePosition({ x: graphX, y, funcId: func.id, color: func.color })
        }
    }, [traceEnabled, functions, xMin, xMax, yMin, yMax, pan, setTracePosition])

    const endDrag = useCallback(() => {
        dragRef.current = null
    }, [])

    const handleMouseLeave = useCallback(() => {
        dragRef.current = null
        if (traceEnabled) {
            setTracePosition(null)
        }
    }, [traceEnabled, setTracePosition])

    // Wheel-zoom toward the cursor. Attached as a non-passive listener so we can
    // preventDefault (stop the page scrolling while zooming the plot).
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !zoomAt) return
        const onWheel = (e) => {
            e.preventDefault()
            const rect = canvas.getBoundingClientRect()
            const gx = xMin + ((e.clientX - rect.left) / rect.width) * (xMax - xMin)
            const gy = yMax - ((e.clientY - rect.top) / rect.height) * (yMax - yMin)
            zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, gx, gy)
        }
        canvas.addEventListener('wheel', onWheel, { passive: false })
        return () => canvas.removeEventListener('wheel', onWheel)
    }, [xMin, xMax, yMin, yMax, zoomAt])

    return (
        <div className="graphing-mode">
            {/* Function inputs */}
            <div className="functions-list">
                {functions.map((func, index) => (
                    <div key={func.id} className="function-input-row">
                        <input
                            type="color"
                            value={func.color}
                            onChange={(e) => updateFunctionColor(func.id, e.target.value)}
                            className="color-picker"
                            title="Function color"
                        />
                        <button
                            className={`visibility-toggle ${func.visible ? 'visible' : 'hidden'}`}
                            onClick={() => toggleFunctionVisibility(func.id)}
                            title={func.visible ? 'Hide function' : 'Show function'}
                        >
                            {func.visible ? '👁' : '👁‍🗨'}
                        </button>
                        <label className="function-label">y{index + 1} =</label>
                        <input
                            type="text"
                            value={func.expression}
                            onChange={(e) => updateFunctionExpression(func.id, e.target.value)}
                            placeholder="sin(x), x^2, etc."
                            data-keypad="full"
                            className="function-input"
                            aria-label={`Function ${index + 1} expression`}
                        />
                        {functions.length > 1 && (
                            <button
                                className="remove-func-btn"
                                onClick={() => removeFunction(func.id)}
                                title="Remove function"
                            >
                                x
                            </button>
                        )}
                    </div>
                ))}
                {functions.length < 8 && (
                    <button className="add-func-btn" onClick={addFunction}>
                        + Add Function
                    </button>
                )}
            </div>

            {/* Canvas graph */}
            <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="graph-canvas"
                aria-label="Function graph — drag to pan"
                style={{ cursor: traceEnabled ? 'crosshair' : 'grab', borderColor: 'var(--border)', touchAction: 'none' }}
                onPointerDown={handleMouseDown}
                onPointerMove={handleMouseMove}
                onPointerUp={endDrag}
                onPointerLeave={handleMouseLeave}
            />

            {/* Trace display */}
            {traceEnabled && tracePosition && (
                <div className="trace-display">
                    x = {tracePosition.x.toFixed(4)}, y = {tracePosition.y.toFixed(4)}
                </div>
            )}

            {/* Analysis toggles */}
            <div className="analysis-toggles">
                <button
                    className={`analysis-btn ${traceEnabled ? 'active' : ''}`}
                    onClick={toggleTrace}
                    title="Trace mode - hover to see coordinates"
                >
                    Trace
                </button>
                <button
                    className={`analysis-btn ${showZeros ? 'active' : ''}`}
                    onClick={() => setShowZeros(!showZeros)}
                    title="Show zeros (x-intercepts)"
                >
                    Zeros
                </button>
                <button
                    className={`analysis-btn ${showIntersections ? 'active' : ''}`}
                    onClick={() => setShowIntersections(!showIntersections)}
                    title="Show intersections between functions"
                >
                    Intersect
                </button>
                <button
                    className={`analysis-btn ${showTable ? 'active' : ''}`}
                    onClick={() => setShowTable(!showTable)}
                    title="Show value table"
                >
                    Table
                </button>
            </div>

            {/* Zeros list */}
            {showZeros && zeros.length > 0 && (
                <div className="analysis-results">
                    <strong>Zeros:</strong>
                    <div className="results-list">
                        {zeros.map((zero, i) => (
                            <span key={i} className="result-item" style={{ borderColor: zero.color }}>
                                x = {zero.x.toFixed(4)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Intersections list */}
            {showIntersections && intersections.length > 0 && (
                <div className="analysis-results">
                    <strong>Intersections:</strong>
                    <div className="results-list">
                        {intersections.map((int, i) => (
                            <span key={i} className="result-item intersection">
                                ({int.x.toFixed(3)}, {int.y.toFixed(3)})
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Table view */}
            {showTable && (
                <div className="table-view">
                    <div className="table-header">
                        <label>Function:</label>
                        <select
                            value={selectedFunctionForTable}
                            onChange={(e) => setSelectedFunctionForTable(Number(e.target.value))}
                            className="table-select"
                        >
                            {functions.map((func, index) => (
                                <option key={func.id} value={func.id}>
                                    y{index + 1} = {func.expression || '(empty)'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="table-container">
                        <table className="values-table">
                            <thead>
                                <tr>
                                    <th>x</th>
                                    <th>y</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map((row, i) => (
                                    <tr key={i}>
                                        <td>{row.x}</td>
                                        <td>{row.y}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Zoom and Pan controls */}
            <div className="graph-controls-container">
                <div className="graph-controls">
                    <button onClick={() => zoom(1.5)} disabled={!canZoomIn} title={canZoomIn ? 'Zoom In' : 'Maximum zoom reached'} className="graph-btn">+</button>
                    <button onClick={() => zoom(0.67)} disabled={!canZoomOut} title={canZoomOut ? 'Zoom Out' : 'Minimum zoom reached'} className="graph-btn">-</button>
                    {fitView && <button onClick={fitView} title="Fit curves to view" className="graph-btn reset-btn">Fit</button>}
                    <button onClick={resetViewport} title="Reset View" className="graph-btn reset-btn">Reset</button>
                </div>

                <div className="pan-controls">
                    <button onClick={() => pan(-2, 0)} aria-label="Pan Left" className="graph-btn">◀</button>
                    <button onClick={() => pan(0, 2)} aria-label="Pan Up" className="graph-btn">▲</button>
                    <button onClick={() => pan(0, -2)} aria-label="Pan Down" className="graph-btn">▼</button>
                    <button onClick={() => pan(2, 0)} aria-label="Pan Right" className="graph-btn">▶</button>
                </div>
            </div>

            {/* Function hints */}
            {!compact && (
                <div className="function-hints">
                    <small>
                        Supported: sin, cos, tan, asin, acos, atan, log, ln, sqrt, abs, exp, x^n, pi, e
                    </small>
                </div>
            )}
        </div>
    )
})

export default GraphingMode

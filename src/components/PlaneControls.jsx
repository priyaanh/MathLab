import React from 'react'

/**
 * Shared pan / zoom / fit / reset control cluster for the coordinate-plane
 * tools. Purely presentational — wire the callbacks to a usePlaneView instance.
 * Pan buttons move the view by `panStep` graph units.
 */
const PlaneControls = React.memo(({
    onZoomIn,
    onZoomOut,
    onPan,
    onFit,
    onReset,
    canZoomIn = true,
    canZoomOut = true,
    panStep = 2,
    showFit = true,
    onSavePng
}) => {
    return (
        <div className="plane-controls" role="group" aria-label="Graph pan and zoom controls">
            <div className="plane-zoom">
                <button className="plane-btn" onClick={onZoomIn} disabled={!canZoomIn} title="Zoom in" aria-label="Zoom in">+</button>
                <button className="plane-btn" onClick={onZoomOut} disabled={!canZoomOut} title="Zoom out" aria-label="Zoom out">−</button>
            </div>

            <div className="plane-pan" aria-label="Pan">
                <button className="plane-btn" onClick={() => onPan(0, panStep)} title="Pan up" aria-label="Pan up">▲</button>
                <div className="plane-pan-row">
                    <button className="plane-btn" onClick={() => onPan(-panStep, 0)} title="Pan left" aria-label="Pan left">◀</button>
                    <button className="plane-btn" onClick={() => onPan(0, -panStep)} title="Pan down" aria-label="Pan down">▼</button>
                    <button className="plane-btn" onClick={() => onPan(panStep, 0)} title="Pan right" aria-label="Pan right">▶</button>
                </div>
            </div>

            <div className="plane-view-actions">
                {showFit && (
                    <button className="plane-btn wide" onClick={onFit} title="Fit content to view" aria-label="Fit to view">Fit</button>
                )}
                <button className="plane-btn wide" onClick={onReset} title="Reset view" aria-label="Reset view">Reset</button>
                {onSavePng && (
                    <button className="plane-btn wide" onClick={onSavePng} title="Save as PNG image" aria-label="Save as PNG image">⬇ PNG</button>
                )}
            </div>

            <p className="plane-hint">Drag to pan · scroll to zoom · click + arrow keys to move</p>
        </div>
    )
})

export default PlaneControls

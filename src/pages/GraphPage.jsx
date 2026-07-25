import { useState } from 'react'
import GraphingMode from '../components/GraphingMode'
import { useGraphing } from '../hooks/useGraphing'
import '../App.css'

/**
 * Full-page function grapher (reuses the existing GraphingMode component
 * that also powers the calculator's embedded graph panel).
 *
 * The size selector uniformly scales the whole panel — canvas, controls and
 * fonts together — via CSS `zoom`, which (unlike transform) also reserves the
 * right amount of layout space. Bounds keep it readable and within the page.
 */
const SIZES = {
    small: { label: 'Small', zoom: 0.8 },
    medium: { label: 'Medium', zoom: 1 },
    large: { label: 'Large', zoom: 1.25 }
}

const GraphPage = () => {
    const graphingState = useGraphing()
    const [size, setSize] = useState('medium')

    return (
        <div className="page">
            <div className="page-head">
                <h1>Function Grapher</h1>
                <p>Plot one or more functions of x. Toggle zeros, intersections and a value table, or trace along a curve.</p>
            </div>

            <div className="grapher-toolbar">
                <span className="grapher-toolbar-label">Size</span>
                <div className="seg-control" style={{ marginBottom: 0 }}>
                    {Object.entries(SIZES).map(([key, cfg]) => (
                        <button
                            key={key}
                            className={size === key ? 'active' : ''}
                            onClick={() => setSize(key)}
                            aria-pressed={size === key}
                        >
                            {cfg.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="canvas-frame graph-page-frame" style={{ zoom: SIZES[size].zoom }}>
                <GraphingMode {...graphingState} />
            </div>
        </div>
    )
}

export default GraphPage

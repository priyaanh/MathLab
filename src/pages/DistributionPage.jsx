import { useState, useMemo, useRef, useEffect } from 'react'
import { prepareHiDPICanvas, cssVar, exportCanvasPng } from '../utils/plane'
import { useThemeContext } from '../theme/ThemeContext'
import { normalPdf, normalCdf, binomPmf, poissonPmf } from '../utils/distributions'

/**
 * Distribution Plotter — draw common probability distributions (Normal,
 * Binomial, Poisson), read their mean / variance / standard deviation, and
 * query a probability (a shaded left-tail for Normal, or P(X=k) / P(X≤k) for
 * the discrete ones). Self-contained chart rendering — no external libraries.
 */

const W = 640
const H = 360
const PAD = { l: 44, r: 16, t: 18, b: 34 }

const fmt = (n, p = 4) => (!Number.isFinite(n) ? '—' : String(parseFloat(n.toPrecision(p))))

const DISTS = [
    { key: 'normal', label: 'Normal' },
    { key: 'binomial', label: 'Binomial' },
    { key: 'poisson', label: 'Poisson' }
]

const DistributionPage = () => {
    const { themeKey } = useThemeContext()
    const canvasRef = useRef(null)
    const [dist, setDist] = useState('normal')
    const [mu, setMu] = useState(0)
    const [sigma, setSigma] = useState(1)
    const [n, setN] = useState(20)
    const [p, setP] = useState(0.5)
    const [lambda, setLambda] = useState(4)
    const [query, setQuery] = useState(1)

    const model = useMemo(() => {
        if (dist === 'normal') {
            const sig = Math.max(0.0001, sigma)
            return {
                continuous: true,
                mean: mu, variance: sig * sig, sd: sig,
                xMin: mu - 4 * sig, xMax: mu + 4 * sig,
                pdf: (x) => normalPdf(x, mu, sig),
                queryLabel: `P(X ≤ ${fmt(query)})`,
                queryValue: normalCdf(query, mu, sig)
            }
        }
        if (dist === 'binomial') {
            const nn = Math.max(1, Math.round(n))
            const pp = Math.min(1, Math.max(0, p))
            const ks = Array.from({ length: nn + 1 }, (_, k) => k)
            const k = Math.min(nn, Math.max(0, Math.round(query)))
            let cdf = 0; for (let i = 0; i <= k; i++) cdf += binomPmf(i, nn, pp)
            return {
                continuous: false,
                mean: nn * pp, variance: nn * pp * (1 - pp), sd: Math.sqrt(nn * pp * (1 - pp)),
                ks, pmf: (kk) => binomPmf(kk, nn, pp), highlight: k,
                queryLabel: `P(X = ${k}) = ${fmt(binomPmf(k, nn, pp))},  P(X ≤ ${k})`,
                queryValue: cdf
            }
        }
        // poisson
        const lam = Math.max(0.1, lambda)
        const hi = Math.max(10, Math.ceil(lam + 4 * Math.sqrt(lam)))
        const ks = Array.from({ length: hi + 1 }, (_, k) => k)
        const k = Math.max(0, Math.round(query))
        let cdf = 0; for (let i = 0; i <= k; i++) cdf += poissonPmf(i, lam)
        return {
            continuous: false,
            mean: lam, variance: lam, sd: Math.sqrt(lam),
            ks, pmf: (kk) => poissonPmf(kk, lam), highlight: k,
            queryLabel: `P(X = ${k}) = ${fmt(poissonPmf(k, lam))},  P(X ≤ ${k})`,
            queryValue: cdf
        }
    }, [dist, mu, sigma, n, p, lambda, query])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = prepareHiDPICanvas(canvas, W, H)
        const accent = cssVar('--accent', '#ff7a1a')
        const accent2 = cssVar('--accent-2', '#22d3ee')
        const grid = cssVar('--border', '#333')
        const muted = cssVar('--text-muted', '#888')
        const plotW = W - PAD.l - PAD.r
        const plotH = H - PAD.t - PAD.b
        const x0 = PAD.l, y0 = H - PAD.b

        ctx.clearRect(0, 0, W, H)
        // axes
        ctx.strokeStyle = grid; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x0, PAD.t); ctx.lineTo(x0, y0); ctx.lineTo(W - PAD.r, y0); ctx.stroke()
        ctx.fillStyle = muted; ctx.font = '11px system-ui, sans-serif'

        if (model.continuous) {
            const { xMin, xMax, pdf } = model
            const N = 240
            let maxY = 0
            const pts = []
            for (let i = 0; i <= N; i++) {
                const x = xMin + (i / N) * (xMax - xMin)
                const y = pdf(x)
                pts.push([x, y]); if (y > maxY) maxY = y
            }
            const sx = (x) => x0 + ((x - xMin) / (xMax - xMin)) * plotW
            const sy = (y) => y0 - (y / maxY) * plotH
            // shaded left tail up to query
            ctx.fillStyle = accent + '44'
            ctx.beginPath(); ctx.moveTo(sx(xMin), y0)
            for (const [x, y] of pts) { if (x <= query) ctx.lineTo(sx(x), sy(y)) }
            ctx.lineTo(sx(Math.min(query, xMax)), y0); ctx.closePath(); ctx.fill()
            // curve
            ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.beginPath()
            pts.forEach(([x, y], i) => { const X = sx(x), Y = sy(y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y) })
            ctx.stroke()
            // query line
            if (query >= xMin && query <= xMax) {
                ctx.strokeStyle = accent2; ctx.setLineDash([6, 4]); ctx.beginPath()
                ctx.moveTo(sx(query), PAD.t); ctx.lineTo(sx(query), y0); ctx.stroke(); ctx.setLineDash([])
            }
            // x ticks
            ctx.fillStyle = muted; ctx.textAlign = 'center'
            for (let t = -3; t <= 3; t++) {
                const x = model.mean + t * model.sd
                ctx.fillText(fmt(x, 3), sx(x), y0 + 16)
            }
        } else {
            const { ks, pmf, highlight } = model
            const maxY = Math.max(...ks.map(pmf), 1e-9)
            const bw = plotW / ks.length
            ctx.textAlign = 'center'
            ks.forEach((k) => {
                const h = (pmf(k) / maxY) * plotH
                const bx = x0 + k * bw + bw * 0.15
                const w = bw * 0.7
                ctx.fillStyle = k === highlight ? accent2 : accent
                ctx.fillRect(bx, y0 - h, w, h)
                // sparse labels
                if (ks.length <= 22 || k % Math.ceil(ks.length / 16) === 0) {
                    ctx.fillStyle = muted
                    ctx.fillText(String(k), bx + w / 2, y0 + 15)
                }
            })
        }
    }, [model, themeKey])

    const paramInputs = () => {
        if (dist === 'normal') return (
            <div className="row">
                <label className="field">mean μ<input type="number" data-keypad="number" value={mu} onChange={(e) => setMu(parseFloat(e.target.value) || 0)} /></label>
                <label className="field">std dev σ<input type="number" data-keypad="number" value={sigma} min="0.1" step="0.1" onChange={(e) => setSigma(parseFloat(e.target.value) || 1)} /></label>
            </div>
        )
        if (dist === 'binomial') return (
            <div className="row">
                <label className="field">trials n<input type="number" data-keypad="number" value={n} min="1" onChange={(e) => setN(parseInt(e.target.value) || 1)} /></label>
                <label className="field">prob p<input type="number" data-keypad="number" value={p} min="0" max="1" step="0.05" onChange={(e) => setP(parseFloat(e.target.value) || 0)} /></label>
            </div>
        )
        return (
            <div className="row">
                <label className="field">rate λ<input type="number" data-keypad="number" value={lambda} min="0.1" step="0.5" onChange={(e) => setLambda(parseFloat(e.target.value) || 1)} /></label>
            </div>
        )
    }

    return (
        <div className="page">
            <div className="page-head">
                <h1>Distribution Plotter</h1>
                <p>Draw a probability distribution, read its mean and spread, and query a probability.</p>
            </div>

            <div className="seg-control" style={{ maxWidth: 420 }}>
                {DISTS.map(d => (
                    <button key={d.key} className={dist === d.key ? 'active' : ''} onClick={() => setDist(d.key)} aria-pressed={dist === d.key}>{d.label}</button>
                ))}
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Parameters</h2>
                    {paramInputs()}

                    <label className="field" style={{ marginTop: '0.7rem' }}>
                        {model.continuous ? 'Query x' : 'Query k'}
                        <input type="number" data-keypad="number" value={query} step={model.continuous ? 0.5 : 1} onChange={(e) => setQuery(parseFloat(e.target.value) || 0)} />
                    </label>

                    <div className="stat-grid" style={{ marginTop: '0.9rem' }}>
                        <div className="stat"><div className="label">Mean</div><div className="value">{fmt(model.mean)}</div></div>
                        <div className="stat"><div className="label">Variance</div><div className="value">{fmt(model.variance)}</div></div>
                        <div className="stat"><div className="label">Std dev</div><div className="value">{fmt(model.sd)}</div></div>
                    </div>

                    <div className="cx-result" style={{ borderColor: 'var(--accent)' }}>
                        <div className="cx-result-label">{model.queryLabel}</div>
                        <div className="cx-result-value" style={{ color: 'var(--accent)' }}>{fmt(model.queryValue)}</div>
                    </div>
                </div>

                <div>
                    <div className="canvas-frame">
                        <canvas ref={canvasRef} width={W} height={H} aria-label="Distribution chart" />
                    </div>
                    <div className="row" style={{ marginTop: '0.6rem', justifyContent: 'flex-end' }}>
                        <button className="btn ghost" onClick={() => exportCanvasPng(canvasRef.current, 'mathlab-distribution.png')}>⬇ Save PNG</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DistributionPage

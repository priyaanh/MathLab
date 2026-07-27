import { useState, useMemo, useRef, useEffect } from 'react'

// Descriptive statistics analyzer. Single-list focus: paste numbers separated
// by commas / spaces / newlines. Quartiles use the inclusive linear-
// interpolation method (index = p*(n-1), numpy "linear" / Excel QUARTILE.INC).

const EXAMPLES = {
  scores: '88, 92, 76, 81, 95, 67, 73, 88, 90, 84,\n79, 88, 100, 62, 91, 85, 77, 83, 96, 70',
  dice: '3 6 1 4 4 2 5 6 3 1 2 4 6 5 3 4 1 2 6 5 4 3 2 4 5 1 6 3 4 2'
}

// Trim to ~6 significant figures; blank/undefined -> em dash.
function fmt(x) {
  if (x === undefined || x === null || Number.isNaN(x)) return '—'
  if (!Number.isFinite(x)) return String(x)
  if (x === 0) return '0'
  const rounded = Number(x.toPrecision(6))
  // Avoid scientific notation for human-scale magnitudes.
  if (Math.abs(rounded) >= 1e-4 && Math.abs(rounded) < 1e12) {
    return String(rounded)
  }
  return rounded.toExponential(4)
}

// Linear-interpolation percentile on a sorted ascending array (p in [0,1]).
function percentile(sorted, p) {
  const n = sorted.length
  if (n === 0) return undefined
  if (n === 1) return sorted[0]
  const idx = p * (n - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo])
}

function parseInput(text) {
  const tokens = text.split(/[\s,]+/).filter(t => t.length > 0)
  const values = []
  const bad = []
  for (const tok of tokens) {
    const n = Number(tok)
    if (tok !== '' && Number.isFinite(n)) values.push(n)
    else bad.push(tok)
  }
  return { values, bad }
}

function computeStats(values) {
  const n = values.length
  if (n === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const min = sorted[0]
  const max = sorted[n - 1]

  // Median
  const median = percentile(sorted, 0.5)

  // Mode(s): highest frequency; none if all unique.
  const freq = new Map()
  for (const v of values) freq.set(v, (freq.get(v) || 0) + 1)
  let maxFreq = 0
  for (const c of freq.values()) if (c > maxFreq) maxFreq = c
  let mode
  if (maxFreq <= 1) {
    mode = 'none'
  } else {
    const modes = [...freq.entries()].filter(([, c]) => c === maxFreq).map(([v]) => v).sort((a, b) => a - b)
    mode = modes.length > 3
      ? `${modes.slice(0, 3).map(fmt).join(', ')}…`
      : modes.map(fmt).join(', ')
  }

  const q1 = percentile(sorted, 0.25)
  const q3 = percentile(sorted, 0.75)
  const iqr = q3 - q1

  // Variance: population divides by n, sample by (n-1).
  const ss = values.reduce((a, b) => a + (b - mean) ** 2, 0)
  const popVar = ss / n
  const sampVar = n > 1 ? ss / (n - 1) : undefined
  const popStd = Math.sqrt(popVar)
  const sampStd = sampVar !== undefined ? Math.sqrt(sampVar) : undefined
  // Coefficient of variation (sample std / mean), undefined if mean is 0 or n<2.
  const cv = (sampStd !== undefined && mean !== 0) ? (sampStd / Math.abs(mean)) * 100 : undefined

  return {
    count: n, sum, min, max, range: max - min, mean, median, mode,
    q1, q3, iqr, popVar, sampVar, popStd, sampStd, cv, sorted
  }
}

// Sturges' rule with a sqrt fallback for larger n; clamped to a sane range.
function binCount(n) {
  if (n < 2) return 1
  const sturges = Math.ceil(Math.log2(n) + 1)
  const sqrtRule = Math.ceil(Math.sqrt(n))
  return Math.max(1, Math.min(40, n > 100 ? sqrtRule : sturges))
}

function StatsPage() {
  const [text, setText] = useState(EXAMPLES.scores)
  const canvasRef = useRef(null)
  const [themeVersion, setThemeVersion] = useState(0)
  const [resizeTick, setResizeTick] = useState(0)

  const { values, bad } = useMemo(() => parseInput(text), [text])
  const stats = useMemo(() => computeStats(values), [values])

  // Redraw histogram when data changes OR the site theme changes. Colors are
  // read from the live computed style so a theme switch re-colors the chart.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cs = getComputedStyle(document.documentElement)
    const accent = cs.getPropertyValue('--accent').trim() || '#4f7cff'
    const muted = cs.getPropertyValue('--text-muted').trim() || '#8a8f98'
    const grid = cs.getPropertyValue('--grid').trim() || muted
    const axis = cs.getPropertyValue('--axis').trim() || muted

    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.clientWidth || 480
    const cssH = 240
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    if (!stats || values.length === 0) {
      ctx.fillStyle = muted
      ctx.font = '13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No data to plot', cssW / 2, cssH / 2)
      return
    }

    const padL = 34, padR = 12, padT = 12, padB = 26
    const plotW = cssW - padL - padR
    const plotH = cssH - padT - padB

    const min = stats.min, max = stats.max
    const bins = binCount(values.length)
    const width = (max - min) || 1
    const binW = width / bins
    const counts = new Array(bins).fill(0)
    for (const v of values) {
      let b = binW === 0 ? 0 : Math.floor((v - min) / binW)
      if (b >= bins) b = bins - 1
      if (b < 0) b = 0
      counts[b]++
    }
    const maxCount = Math.max(...counts, 1)

    // Baseline axis
    ctx.strokeStyle = axis
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, padT + plotH + 0.5)
    ctx.lineTo(padL + plotW, padT + plotH + 0.5)
    ctx.stroke()

    // Y gridlines + labels (0 and maxCount)
    ctx.fillStyle = muted
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const frac of [0, 0.5, 1]) {
      const y = padT + plotH - frac * plotH
      ctx.strokeStyle = grid
      ctx.globalAlpha = frac === 0 ? 0 : 0.4
      ctx.beginPath()
      ctx.moveTo(padL, y + 0.5)
      ctx.lineTo(padL + plotW, y + 0.5)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillText(String(Math.round(frac * maxCount)), padL - 5, y)
    }

    // Bars
    const gap = bins > 1 ? 2 : 0
    const bw = plotW / bins
    ctx.fillStyle = accent
    for (let i = 0; i < bins; i++) {
      const h = (counts[i] / maxCount) * plotH
      const x = padL + i * bw
      const y = padT + plotH - h
      ctx.fillRect(x + gap / 2, y, Math.max(1, bw - gap), h)
    }

    // X min / max labels
    ctx.fillStyle = muted
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillText(fmt(min), padL, padT + plotH + 6)
    ctx.textAlign = 'right'
    ctx.fillText(fmt(max), padL + plotW, padT + plotH + 6)
  }, [values, stats, themeVersion, resizeTick])

  // Watch for theme attribute/class changes on <html> to force a redraw.
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeVersion(v => v + 1))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    return () => obs.disconnect()
  }, [])

  // Redraw the histogram when the canvas is resized (window/panel resize), so
  // the bitmap stays crisp and the axis labels line up with the bars.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setResizeTick(t => t + 1))
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  const tiles = stats ? [
    ['Count', fmt(stats.count)],
    ['Sum', fmt(stats.sum)],
    ['Min', fmt(stats.min)],
    ['Max', fmt(stats.max)],
    ['Range', fmt(stats.range)],
    ['Mean', fmt(stats.mean)],
    ['Median', fmt(stats.median)],
    ['Mode', stats.mode],
    ['Q1', fmt(stats.q1)],
    ['Q3', fmt(stats.q3)],
    ['IQR', fmt(stats.iqr)],
    ['Pop. variance', fmt(stats.popVar)],
    ['Sample variance', fmt(stats.sampVar)],
    ['Pop. std dev', fmt(stats.popStd)],
    ['Sample std dev', fmt(stats.sampStd)],
    ['Coeff. of variation', stats.cv !== undefined ? fmt(stats.cv) + '%' : '—']
  ] : []

  return (
    <div className="page">
      <div className="page-head">
        <h1>Descriptive Statistics</h1>
        <p>Paste a list of numbers to get count, spread, center, quartiles and a histogram. Values may be separated by commas, spaces or new lines.</p>
      </div>

      <div className="tool-layout">
        <div className="panel">
          <h2>Data</h2>

          <label className="field">
            Numbers
            <textarea
              value={text}
              data-keypad="data"
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="e.g. 12, 15, 15, 18, 21"
              style={{ resize: 'vertical', fontFamily: 'ui-monospace, monospace', minHeight: '140px' }}
            />
          </label>

          <div className="hint" style={{ marginTop: '0.5rem' }}>
            Parsed <strong>{values.length}</strong> value{values.length === 1 ? '' : 's'}.
            {bad.length > 0 && (
              <span style={{ color: 'var(--danger)' }}>
                {' '}Skipped {bad.length} unreadable token{bad.length === 1 ? '' : 's'}: {bad.slice(0, 6).map((b, i) => (
                  <code key={i}>{b}</code>
                )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}{bad.length > 6 ? '…' : ''}
              </span>
            )}
          </div>

          <div className="seg-control" style={{ marginTop: '0.9rem' }}>
            <button onClick={() => setText(EXAMPLES.scores)}>Test scores</button>
            <button onClick={() => setText(EXAMPLES.dice)}>Dice rolls</button>
            <button onClick={() => setText('')}>Clear</button>
          </div>
        </div>

        <div className="panel">
          <h2>Results</h2>

          {stats ? (
            <>
              <div className="stat-grid">
                {tiles.map(([label, value]) => (
                  <div className="stat" key={label}>
                    <div className="label">{label}</div>
                    <div className="value">{value}</div>
                  </div>
                ))}
              </div>

              <h2 style={{ marginTop: '1.2rem' }}>Histogram</h2>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  background: 'var(--surface-2)',
                  padding: '0.5rem'
                }}
              >
                <canvas ref={canvasRef} style={{ width: '100%', height: '240px', display: 'block' }} />
              </div>
              <div className="hint" style={{ marginTop: '0.5rem' }}>
                Quartiles use linear interpolation (inclusive method). Bin count follows Sturges&rsquo; rule (√n for large n).
              </div>
            </>
          ) : (
            <div className="hint">Enter some numbers to see statistics.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatsPage

import { useState, useMemo } from 'react'

// Cap how many terms we ever render — long lists hurt layout and readability,
// and n could legitimately be large even when the maths stays finite.
const MAX_LIST = 50
// Refuse absurd term counts so a stray input can't lock the UI in a huge loop.
const MAX_N = 100000

// Trim floating noise to ~6 significant figures; switch to exponential for
// extreme magnitudes (geometric growth explodes fast) and keep a friendly dash
// for NaN/Infinity so nothing renders as "NaN".
const fmt = (n) => {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  const t = parseFloat(n.toPrecision(6))
  const abs = Math.abs(t)
  if (abs < 1e-4 || abs >= 1e12) return t.toExponential(4)
  return String(t)
}

// nth term of each sequence type. Kept pure so the component just reads results.
const nthTerm = (type, a1, d, r, n) =>
  type === 'arithmetic' ? a1 + (n - 1) * d : a1 * Math.pow(r, n - 1)

// Sum of the first n terms. Geometric guards r === 1 (the closed form divides
// by 1 − r), where the sum is simply a1·n.
const sumN = (type, a1, d, r, n) => {
  if (type === 'arithmetic') return (n / 2) * (2 * a1 + (n - 1) * d)
  if (r === 1) return a1 * n
  return a1 * (1 - Math.pow(r, n)) / (1 - r)
}

const SequencesPage = () => {
  const [type, setType] = useState('arithmetic')
  const [a1, setA1] = useState('1')
  const [step, setStep] = useState('2') // reused for d (arithmetic) or r (geometric)
  const [nStr, setNStr] = useState('10')

  // Parse once; treat blank/NaN as invalid so we can show a hint instead of NaN.
  const a1Num = parseFloat(a1)
  const stepNum = parseFloat(step)
  const nNum = parseFloat(nStr)

  const nValid = Number.isInteger(nNum) && nNum >= 1 && nNum <= MAX_N
  const inputsValid =
    a1.trim() !== '' && !Number.isNaN(a1Num) &&
    step.trim() !== '' && !Number.isNaN(stepNum) &&
    nStr.trim() !== '' && nValid

  const results = useMemo(() => {
    if (!inputsValid) return null
    const d = stepNum
    const r = stepNum
    const nth = nthTerm(type, a1Num, d, r, nNum)
    const sum = sumN(type, a1Num, d, r, nNum)

    // Only build up to MAX_LIST terms regardless of n, and flag truncation.
    const shown = Math.min(nNum, MAX_LIST)
    const terms = []
    for (let i = 1; i <= shown; i++) terms.push(nthTerm(type, a1Num, d, r, i))

    // Infinite geometric series converges only when |r| < 1.
    const infinite =
      type === 'geometric' && Math.abs(r) < 1 ? a1Num / (1 - r) : null

    // General nth-term formula with the user's own numbers substituted in.
    const formula =
      type === 'arithmetic'
        ? `aₙ = ${fmt(a1Num)} + (n − 1)·${fmt(d)}`
        : `aₙ = ${fmt(a1Num)}·${fmt(r)}^(n − 1)`

    return { nth, sum, terms, truncated: nNum > MAX_LIST, infinite, formula }
  }, [inputsValid, type, a1Num, stepNum, nNum])

  const stepLabel = type === 'arithmetic' ? 'Common difference d' : 'Common ratio r'

  return (
    <div className="page">
      <div className="page-head">
        <h1>Sequences &amp; Series</h1>
        <p>Explore arithmetic and geometric sequences — nth term, partial sums, and the terms themselves.</p>
      </div>

      <div className="panel">
        <h2>Inputs</h2>

        <div className="row">
          <label className="field">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="arithmetic">Arithmetic</option>
              <option value="geometric">Geometric</option>
            </select>
          </label>

          <label className="field">
            First term a₁
            <input
              type="number"
              inputMode="decimal"
              value={a1}
              onChange={(e) => setA1(e.target.value)}
              placeholder="e.g. 1"
            />
          </label>

          <label className="field">
            {stepLabel}
            <input
              type="number"
              inputMode="decimal"
              value={step}
              onChange={(e) => setStep(e.target.value)}
              placeholder={type === 'arithmetic' ? 'e.g. 2' : 'e.g. 0.5'}
            />
          </label>

          <label className="field">
            Number of terms n
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={nStr}
              onChange={(e) => setNStr(e.target.value)}
              placeholder="e.g. 10"
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
          <button
            className="btn ghost"
            onClick={() => { setA1('1'); setStep(type === 'arithmetic' ? '2' : '0.5'); setNStr('10') }}
          >
            Reset
          </button>
        </div>

        {!inputsValid && (
          <p className="hint" style={{ marginTop: '0.8rem' }}>
            Enter a first term, a {type === 'arithmetic' ? 'common difference' : 'common ratio'}, and a whole
            number of terms n between 1 and {MAX_N.toLocaleString()}.
          </p>
        )}
      </div>

      {results && (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <h2>Results</h2>

          {/* Substituted general formula for the nth term. */}
          <div
            style={{
              padding: '0.8rem 1rem',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '1.05rem'
            }}
          >
            {results.formula}
          </div>

          <div className="stat-grid" style={{ marginTop: '1rem' }}>
            <div className="stat">
              <div className="label">nth term (a{fmt(nNum)})</div>
              <div className="value">{fmt(results.nth)}</div>
            </div>
            <div className="stat">
              <div className="label">Sum of first {fmt(nNum)} terms</div>
              <div className="value">{fmt(results.sum)}</div>
            </div>
            {results.infinite != null && (
              <div className="stat">
                <div className="label">Infinite sum (|r| &lt; 1)</div>
                <div className="value">{fmt(results.infinite)}</div>
              </div>
            )}
          </div>

          {type === 'geometric' && results.infinite == null && (
            <p className="hint" style={{ marginTop: '0.6rem' }}>
              The infinite series diverges here because |r| ≥ 1, so no finite total exists.
            </p>
          )}

          {/* First terms, capped for readability. */}
          <div style={{ marginTop: '1rem' }}>
            <div className="label" style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              First {results.truncated ? MAX_LIST : fmt(nNum)} terms
            </div>
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: 'var(--text)',
                lineHeight: 1.6,
                wordBreak: 'break-word'
              }}
            >
              {results.terms.map((t) => fmt(t)).join(', ')}
              {results.truncated && <span style={{ color: 'var(--text-muted)' }}> … (showing first {MAX_LIST} of {fmt(nNum)})</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SequencesPage

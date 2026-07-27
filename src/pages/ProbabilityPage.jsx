import { useState, useMemo } from 'react'

// --- Numeric helpers (kept above the component so they stay pure) --------------

// Parse a field as a non-negative integer; return null on blank/invalid so the
// UI can show a hint instead of crashing on NaN.
function toInt(s) {
  if (s == null || String(s).trim() === '') return null
  const v = Number(s)
  if (!Number.isInteger(v) || v < 0) return null
  return v
}

// Parse a field as a real number in [min, max]; null when out of range/invalid.
function toNum(s, min = -Infinity, max = Infinity) {
  if (s == null || String(s).trim() === '') return null
  const v = Number(s)
  if (!Number.isFinite(v) || v < min || v > max) return null
  return v
}

// log10(n!) via summed logs — lets us describe factorials/combinations that
// overflow a double (n! is Infinity past 170) without ever holding the value.
function logFactorial(n) {
  let s = 0
  for (let i = 2; i <= n; i++) s += Math.log10(i)
  return s
}

// Multiplicative nCr: interleave multiply/divide so intermediate values stay as
// small as possible — accurate and finite for far larger n than n!/(r!(n−r)!).
function nCr(n, r) {
  if (r < 0 || r > n) return 0
  r = Math.min(r, n - r)
  let result = 1
  for (let i = 1; i <= r; i++) result = (result * (n - r + i)) / i
  return result
}

// Multiplicative nPr = n·(n−1)···(n−r+1); avoids forming the full factorial.
function nPr(n, r) {
  if (r < 0 || r > n) return 0
  let result = 1
  for (let i = n - r + 1; i <= n; i++) result *= i
  return result
}

// Render a counting result readably: grouped integer when it fits a double
// exactly-ish, else scientific derived from its base-10 log so huge values
// (e.g. 200!) still show as "m × 10^e" rather than "∞".
function bigToStr(value, log10) {
  if (Number.isFinite(value) && Math.abs(value) < 1e15) {
    return Math.round(value).toLocaleString('en-US')
  }
  let lg = log10
  if (lg == null && Number.isFinite(value) && value > 0) lg = Math.log10(value)
  if (lg == null || !Number.isFinite(lg)) {
    return Number.isFinite(value) ? value.toExponential(6) : '∞'
  }
  const exp = Math.floor(lg)
  const mantissa = Math.pow(10, lg - exp)
  return `${trim6(mantissa)} × 10^${exp}`
}

// ~6 significant digits with trailing zeros trimmed; friendly dash for bad input.
function trim6(x) {
  if (!Number.isFinite(x)) return '—'
  if (x === 0) return '0'
  const t = parseFloat(x.toPrecision(6))
  const abs = Math.abs(t)
  if (abs < 1e-4 || abs >= 1e12) return t.toExponential(4)
  return String(t)
}

// Greatest common divisor for reducing a probability to lowest terms.
function gcd(a, b) {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1
}

// Binomial pmf P(X = k) = C(n,k)·pᵏ·(1−p)^(n−k).
function binomPmf(n, k, p) {
  return nCr(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k)
}

// Shared styling for a section's read-out box (mirrors the accent card elsewhere).
const resultBox = {
  marginTop: '1rem',
  padding: '0.9rem 1rem',
  borderRadius: '14px',
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)'
}
const hintDanger = { color: 'var(--danger)', marginTop: '0.8rem' }

function ProbabilityPage() {
  // Section 1 — counting
  const [cn, setCn] = useState('10')
  const [cr, setCr] = useState('3')

  // Section 2 — simple probability
  const [fav, setFav] = useState('1')
  const [tot, setTot] = useState('6')

  // Section 3 — binomial
  const [bn, setBn] = useState('10')
  const [bk, setBk] = useState('4')
  const [bp, setBp] = useState('0.5')

  // Counting: validate n, r are non-negative integers with r ≤ n, then compute
  // factorial / permutations / combinations, each with a log10 fallback for size.
  const counting = useMemo(() => {
    const n = toInt(cn)
    const r = toInt(cr)
    if (n == null || r == null) return { error: 'Enter n and r as non-negative whole numbers.' }
    if (r > n) return { error: 'r must be less than or equal to n.' }
    return {
      fact: bigToStr(n <= 170 ? factorial(n) : Infinity, logFactorial(n)),
      perm: bigToStr(nPr(n, r), logFactorial(n) - logFactorial(n - r)),
      comb: bigToStr(nCr(n, r), logFactorial(n) - logFactorial(r) - logFactorial(n - r))
    }
  }, [cn, cr])

  // Simple probability: guard total > 0 and favorable ≤ total, then present the
  // same ratio three ways (reduced fraction, decimal, percent).
  const simple = useMemo(() => {
    const f = toInt(fav)
    const t = toInt(tot)
    if (f == null || t == null) return { error: 'Enter favorable and total as non-negative whole numbers.' }
    if (t === 0) return { error: 'Total outcomes must be greater than 0.' }
    if (f > t) return { error: 'Favorable outcomes cannot exceed the total.' }
    const g = gcd(f, t)
    const dec = f / t
    return {
      fraction: `${f / g} / ${t / g}`,
      decimal: trim6(dec),
      percent: `${trim6(dec * 100)}%`
    }
  }, [fav, tot])

  // Binomial: guard 0 ≤ k ≤ n and 0 ≤ p ≤ 1. Cumulative tails are summed over
  // the pmf directly — n stays modest here so the naive loop is plenty accurate.
  const binom = useMemo(() => {
    const n = toInt(bn)
    const k = toInt(bk)
    const p = toNum(bp, 0, 1)
    if (n == null || k == null || p == null) {
      return { error: 'Enter whole n and k, and a probability p between 0 and 1.' }
    }
    if (k > n) return { error: 'k must be less than or equal to n.' }
    const pmf = binomPmf(n, k, p)
    let le = 0
    for (let j = 0; j <= k; j++) le += binomPmf(n, j, p)
    let ge = 0
    for (let j = k; j <= n; j++) ge += binomPmf(n, j, p)
    return {
      pmf: trim6(pmf),
      le: trim6(le),
      ge: trim6(ge)
    }
  }, [bn, bk, bp])

  return (
    <div className="page">
      <div className="page-head">
        <h1>Probability</h1>
        <p>Count arrangements, reduce simple probabilities, and evaluate the binomial distribution.</p>
      </div>

      {/* 1 — Counting */}
      <div className="panel">
        <h2>Counting</h2>
        <p className="hint" style={{ marginTop: '-0.3rem' }}>
          Factorials, permutations P(n,r), and combinations C(n,r).
        </p>
        <div className="row">
          <label className="field">n (total)<input type="number" min="0" step="1" data-keypad="number" value={cn} onChange={(e) => setCn(e.target.value)} /></label>
          <label className="field">r (chosen)<input type="number" min="0" step="1" data-keypad="number" value={cr} onChange={(e) => setCr(e.target.value)} /></label>
        </div>
        {counting.error ? (
          <p className="hint" style={hintDanger}>{counting.error}</p>
        ) : (
          <div className="stat-grid" style={{ marginTop: '0.9rem' }}>
            <div className="stat"><div className="label">n!</div><div className="value">{counting.fact}</div></div>
            <div className="stat"><div className="label">P(n, r)</div><div className="value">{counting.perm}</div></div>
            <div className="stat"><div className="label">C(n, r)</div><div className="value">{counting.comb}</div></div>
          </div>
        )}
      </div>

      {/* 2 — Simple probability */}
      <div className="panel">
        <h2>Simple probability</h2>
        <p className="hint" style={{ marginTop: '-0.3rem' }}>
          The chance of a favorable outcome as a fraction, decimal, and percentage.
        </p>
        <div className="row">
          <label className="field">Favorable outcomes<input type="number" min="0" step="1" data-keypad="number" value={fav} onChange={(e) => setFav(e.target.value)} /></label>
          <label className="field">Total outcomes<input type="number" min="0" step="1" data-keypad="number" value={tot} onChange={(e) => setTot(e.target.value)} /></label>
        </div>
        {simple.error ? (
          <p className="hint" style={hintDanger}>{simple.error}</p>
        ) : (
          <div className="stat-grid" style={{ marginTop: '0.9rem' }}>
            <div className="stat"><div className="label">Fraction</div><div className="value">{simple.fraction}</div></div>
            <div className="stat"><div className="label">Decimal</div><div className="value">{simple.decimal}</div></div>
            <div className="stat"><div className="label">Percentage</div><div className="value">{simple.percent}</div></div>
          </div>
        )}
      </div>

      {/* 3 — Binomial probability */}
      <div className="panel">
        <h2>Binomial probability</h2>
        <p className="hint" style={{ marginTop: '-0.3rem' }}>
          For n independent trials with success probability p, the chance of exactly / at most / at least k successes.
        </p>
        <div className="row">
          <label className="field">trials n<input type="number" min="0" step="1" data-keypad="number" value={bn} onChange={(e) => setBn(e.target.value)} /></label>
          <label className="field">successes k<input type="number" min="0" step="1" data-keypad="number" value={bk} onChange={(e) => setBk(e.target.value)} /></label>
          <label className="field">prob p<input type="number" min="0" max="1" step="0.05" data-keypad="number" value={bp} onChange={(e) => setBp(e.target.value)} /></label>
        </div>
        {binom.error ? (
          <p className="hint" style={hintDanger}>{binom.error}</p>
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: '0.9rem' }}>
              <div className="stat"><div className="label">P(X = k)</div><div className="value">{binom.pmf}</div></div>
              <div className="stat"><div className="label">P(X ≤ k)</div><div className="value">{binom.le}</div></div>
              <div className="stat"><div className="label">P(X ≥ k)</div><div className="value">{binom.ge}</div></div>
            </div>
            <div style={resultBox}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                P(X = k) = C(n, k) · pᵏ · (1 − p)<sup>n − k</sup>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Plain factorial for n ≤ 170 (stays finite in a double); larger n routes
// through the log10 path in bigToStr, so this never needs to return Infinity-math.
function factorial(n) {
  let f = 1
  for (let i = 2; i <= n; i++) f *= i
  return f
}

export default ProbabilityPage

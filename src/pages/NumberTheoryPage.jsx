import { useState, useMemo } from 'react'

// Superscript digits let us render exponents (2³·3²·5) without markup or CSS.
const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']
const toSuperscript = (n) => String(n).split('').map((d) => SUP[+d]).join('')

// Parse a user string into a safe non-negative integer, or null when unusable.
// We stay in Number space and cap at 1e12 so trial division stays snappy.
const parseInt12 = (s, max) => {
  const t = s.trim()
  if (t === '' || !/^\d+$/.test(t)) return null // reject blanks, signs, decimals, junk
  const n = Number(t)
  if (!Number.isSafeInteger(n) || n > max) return null
  return n
}

// Trial division up to √n — the requested approach. Returns [[prime, exp], …].
// Only odd candidates after factoring out 2, so the loop is ~√n/2 iterations
// (≤ ~5e5 steps at the 1e12 cap: fast enough to run synchronously on input).
const primeFactors = (n) => {
  const factors = []
  let m = n
  let count = 0
  while (m % 2 === 0) { m /= 2; count++ }
  if (count) factors.push([2, count])
  for (let d = 3; d * d <= m; d += 2) {
    if (m % d === 0) {
      let c = 0
      while (m % d === 0) { m /= d; c++ }
      factors.push([d, c])
    }
  }
  if (m > 1) factors.push([m, 1]) // leftover prime factor > √n
  return factors
}

// Divisor count and sum come straight from the factorization exponents:
// count = Π(eᵢ+1), sum = Π (pᵢ^(eᵢ+1) − 1)/(pᵢ − 1). Cheaper than enumerating.
const divisorStats = (factors) => {
  let count = 1
  let sum = 1
  for (const [p, e] of factors) {
    count *= e + 1
    let term = 0
    let pk = 1
    for (let i = 0; i <= e; i++) { term += pk; pk *= p }
    sum *= term
  }
  return { count, sum }
}

// Build the actual divisor list from factors (avoids an O(n) scan). Sorted asc.
const divisorList = (factors) => {
  let divs = [1]
  for (const [p, e] of factors) {
    const next = []
    let pk = 1
    for (let i = 0; i <= e; i++) {
      for (const d of divs) next.push(d * pk)
      pk *= p
    }
    divs = next
  }
  return divs.sort((a, b) => a - b)
}

// Euclid's algorithm; both inputs assumed non-negative integers.
const gcd = (a, b) => { while (b) { [a, b] = [b, a % b] } return a }

// Sieve of Eratosthenes up to N inclusive.
const sieve = (n) => {
  const isComposite = new Uint8Array(n + 1)
  const primes = []
  for (let i = 2; i <= n; i++) {
    if (!isComposite[i]) {
      primes.push(i)
      for (let j = i * i; j <= n; j += i) isComposite[j] = 1
    }
  }
  return primes
}

const fmtInt = (n) => n.toLocaleString('en-US')

const ANALYZE_MAX = 1e12
const SIEVE_MAX = 10000
const DIVISOR_CAP = 60

// Small presentational helper so all three panels share one result look.
function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  )
}

function NumberTheoryPage() {
  const [nInput, setNInput] = useState('360')
  const [aInput, setAInput] = useState('48')
  const [bInput, setBInput] = useState('180')
  const [sieveInput, setSieveInput] = useState('100')

  // --- Single number analysis (recomputed only when the input changes) ---
  const analysis = useMemo(() => {
    const n = parseInt12(nInput, ANALYZE_MAX)
    if (n === null || n < 1) return null
    if (n === 1) {
      // 1 is a unit: no prime factors, its only divisor is itself.
      return { n, factors: [], isPrime: false, isSquare: true, count: 1, sum: 1, divs: [1], truncated: false }
    }
    const factors = primeFactors(n)
    const { count, sum } = divisorStats(factors)
    const isPrime = factors.length === 1 && factors[0][1] === 1
    const root = Math.round(Math.sqrt(n))
    const isSquare = root * root === n
    // Only materialize the full list when it's small enough to display.
    const showAll = count <= DIVISOR_CAP
    const divs = showAll ? divisorList(factors) : null
    return { n, factors, isPrime, isSquare, count, sum, divs, truncated: !showAll }
  }, [nInput])

  // --- GCD & LCM ---
  const gcdLcm = useMemo(() => {
    const a = parseInt12(aInput, ANALYZE_MAX)
    const b = parseInt12(bInput, ANALYZE_MAX)
    if (a === null || b === null) return null
    if (a === 0 && b === 0) return { a, b, g: 0, lcm: 0 } // gcd(0,0)=0, lcm undefined→0
    const g = gcd(a, b)
    // Divide before multiply to keep the product within safe-integer range.
    const lcm = g === 0 ? 0 : (a / g) * b
    return { a, b, g, lcm }
  }, [aInput, bInput])

  // --- Prime sieve ---
  const sieveResult = useMemo(() => {
    const n = parseInt12(sieveInput, SIEVE_MAX)
    if (n === null || n < 2) return null
    return sieve(n)
  }, [sieveInput])

  const factorString = (factors) =>
    factors.map(([p, e]) => (e === 1 ? String(p) : `${p}${toSuperscript(e)}`)).join('·')

  return (
    <div className="page">
      <div className="page-head">
        <h1>Number Theory</h1>
        <p>Factorize integers, find GCD and LCM, and sieve for primes — all in your browser.</p>
      </div>

      {/* 1. Single number analysis */}
      <div className="panel">
        <h2>Number analysis</h2>
        <div className="row">
          <label className="field">
            Integer n
            <input
              type="text"
              inputMode="numeric"
              value={nInput}
              onChange={(e) => setNInput(e.target.value)}
              placeholder="e.g. 360"
            />
          </label>
        </div>

        {analysis === null ? (
          <p className="hint">Enter a whole number between 1 and 1,000,000,000,000.</p>
        ) : (
          <>
            <div
              style={{
                margin: '0.9rem 0',
                fontSize: '1.15rem',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: 'var(--text)'
              }}
            >
              {fmtInt(analysis.n)}
              {analysis.factors.length > 0 && (
                <>
                  {' = '}
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    {factorString(analysis.factors)}
                  </span>
                </>
              )}
            </div>

            <div className="stat-grid">
              <Stat label="Prime?" value={analysis.isPrime ? 'Yes' : 'No'} />
              <Stat label="Perfect square?" value={analysis.isSquare ? 'Yes' : 'No'} />
              <Stat label="Number of divisors" value={fmtInt(analysis.count)} />
              <Stat label="Sum of divisors" value={fmtInt(analysis.sum)} />
            </div>

            <div style={{ marginTop: '0.9rem' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
                Divisors
              </div>
              {analysis.truncated ? (
                <p className="hint" style={{ margin: 0 }}>
                  {fmtInt(analysis.count)} divisors — list hidden (more than {DIVISOR_CAP}).
                </p>
              ) : (
                <div
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: '0.9rem',
                    color: 'var(--text)',
                    wordBreak: 'break-word',
                    lineHeight: 1.6
                  }}
                >
                  {analysis.divs.map(fmtInt).join(', ')}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 2. GCD & LCM */}
      <div className="panel">
        <h2>GCD &amp; LCM</h2>
        <div className="row">
          <label className="field">
            a
            <input
              type="text"
              inputMode="numeric"
              value={aInput}
              onChange={(e) => setAInput(e.target.value)}
              placeholder="e.g. 48"
            />
          </label>
          <label className="field">
            b
            <input
              type="text"
              inputMode="numeric"
              value={bInput}
              onChange={(e) => setBInput(e.target.value)}
              placeholder="e.g. 180"
            />
          </label>
        </div>

        {gcdLcm === null ? (
          <p className="hint">Enter two whole numbers (0 or greater) for a and b.</p>
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: '0.9rem' }}>
              <Stat label={`gcd(${fmtInt(gcdLcm.a)}, ${fmtInt(gcdLcm.b)})`} value={fmtInt(gcdLcm.g)} />
              <Stat label={`lcm(${fmtInt(gcdLcm.a)}, ${fmtInt(gcdLcm.b)})`} value={fmtInt(gcdLcm.lcm)} />
            </div>
            <p className="hint" style={{ marginBottom: 0 }}>
              lcm = a·b / gcd
            </p>
          </>
        )}
      </div>

      {/* 3. Prime sieve */}
      <div className="panel">
        <h2>Prime sieve</h2>
        <div className="row">
          <label className="field">
            Upper bound N
            <input
              type="text"
              inputMode="numeric"
              value={sieveInput}
              onChange={(e) => setSieveInput(e.target.value)}
              placeholder="e.g. 100"
            />
          </label>
        </div>

        {sieveResult === null ? (
          <p className="hint">Enter a whole number from 2 to {fmtInt(SIEVE_MAX)}.</p>
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: '0.9rem' }}>
              <Stat label={`Primes ≤ ${fmtInt(parseInt12(sieveInput, SIEVE_MAX))}`} value={fmtInt(sieveResult.length)} />
            </div>
            <div
              style={{
                marginTop: '0.6rem',
                padding: '0.75rem 0.9rem',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.88rem',
                color: 'var(--text)',
                maxHeight: '260px',
                overflowY: 'auto',
                wordBreak: 'break-word',
                lineHeight: 1.6
              }}
            >
              {sieveResult.join(', ')}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default NumberTheoryPage

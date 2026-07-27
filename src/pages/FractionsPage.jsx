import { useState, useMemo } from 'react'

// Euclid's algorithm on absolute values — sign is handled by the caller so the
// gcd is always a positive magnitude we can safely divide by.
function gcd(a, b) {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    [a, b] = [b, a % b]
  }
  return a || 1
}

// Reduce n/d to lowest terms and normalise the sign onto the numerator so we
// never render things like 1/-2. Returns null for a zero denominator.
function reduce(n, d) {
  if (d === 0) return null
  if (d < 0) { n = -n; d = -d }
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}

// Only whole-number inputs make sense for fraction parts; reject blanks and
// decimals up front so the UI can show a hint instead of NaN.
function parseInt10(s) {
  if (typeof s !== 'string' || s.trim() === '') return null
  const v = Number(s)
  return Number.isInteger(v) ? v : null
}

// Apply the chosen operation as a single new numerator/denominator pair before
// reducing — this keeps the "before simplifying" step easy to display.
function applyOp(a, b, c, d, op) {
  switch (op) {
    case '+': return { n: a * d + c * b, d: b * d }
    case '-': return { n: a * d - c * b, d: b * d }
    case '*': return { n: a * c, d: b * d }
    case '/': return { n: a * d, d: b * c } // division = multiply by reciprocal
    default: return { n: 0, d: 1 }
  }
}

// Improper fractions render more naturally as a whole part plus remainder.
function toMixed(n, d) {
  if (n % d === 0) return null // exact integer — nothing mixed to show
  const sign = n < 0 ? '-' : ''
  const an = Math.abs(n)
  const whole = Math.floor(an / d)
  const rem = an % d
  if (whole === 0) return null // already a proper fraction
  return `${sign}${whole} ${rem}/${d}`
}

// Convert a terminating decimal to an exact fraction by scaling out the
// fractional digits, then reducing. Repeating decimals are out of scope.
function decimalToFraction(s) {
  if (typeof s !== 'string' || s.trim() === '') return null
  const v = Number(s)
  if (!Number.isFinite(v)) return null
  const dot = s.indexOf('.')
  const decimals = dot === -1 ? 0 : s.trim().length - dot - 1
  const denom = Math.pow(10, decimals)
  return reduce(Math.round(v * denom), denom)
}

function FractionsPage() {
  // Fraction arithmetic inputs — kept as strings so partial/empty entry is fine.
  const [a, setA] = useState('1')
  const [b, setB] = useState('2')
  const [c, setC] = useState('1')
  const [d, setD] = useState('3')
  const [op, setOp] = useState('+')

  // Decimal converter input.
  const [dec, setDec] = useState('0.75')

  const calc = useMemo(() => {
    const na = parseInt10(a)
    const nb = parseInt10(b)
    const nc = parseInt10(c)
    const nd = parseInt10(d)
    if (na === null || nb === null || nc === null || nd === null) {
      return { error: 'Enter whole numbers in all four boxes.' }
    }
    if (nb === 0 || nd === 0) {
      return { error: 'Denominators can’t be zero.' }
    }
    if (op === '/' && nc === 0) {
      return { error: 'Can’t divide by a fraction equal to zero.' }
    }
    const raw = applyOp(na, nb, nc, nd, op) // combined form before reducing
    const r = reduce(raw.n, raw.d)
    if (!r) return { error: 'That gives a zero denominator.' }

    // Step line depends on the operation: show the common-denominator sum for
    // +/− and the cross-multiplied form for ×/÷.
    let step
    if (op === '+' || op === '-') {
      step = `${na}/${nb} ${op} ${nc}/${nd} = (${na}×${nd} ${op} ${nc}×${nb}) / (${nb}×${nd}) = ${raw.n}/${raw.d}`
    } else if (op === '*') {
      step = `${na}/${nb} × ${nc}/${nd} = (${na}×${nc}) / (${nb}×${nd}) = ${raw.n}/${raw.d}`
    } else {
      step = `${na}/${nb} ÷ ${nc}/${nd} = ${na}/${nb} × ${nd}/${nc} = ${raw.n}/${raw.d}`
    }

    return {
      fraction: `${r.n}/${r.d}`,
      mixed: toMixed(r.n, r.d) || '—',
      decimal: (r.n / r.d).toString(),
      step
    }
  }, [a, b, c, d, op])

  const decResult = useMemo(() => {
    if (dec.trim() === '') return { error: 'Enter a decimal number.' }
    const r = decimalToFraction(dec)
    if (!r) return { error: 'That isn’t a valid terminating decimal.' }
    return {
      fraction: `${r.n}/${r.d}`,
      mixed: toMixed(r.n, r.d) || '—'
    }
  }, [dec])

  // Shared inline style for the small numerator/denominator boxes.
  const smallInput = { width: '5rem', textAlign: 'center' }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Fractions</h1>
        <p>Add, subtract, multiply and divide fractions, or turn a decimal into its simplest fraction — all reduced to lowest terms.</p>
      </div>

      <div className="panel">
        <h2>Two-fraction arithmetic</h2>

        {/* Numerator/denominator boxes with the operation between them. */}
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label className="field" style={{ margin: 0 }}>
              Numerator A
              <input type="number" step="1" value={a} onChange={(e) => setA(e.target.value)} style={smallInput} />
            </label>
            <label className="field" style={{ margin: 0 }}>
              Denominator B
              <input type="number" step="1" value={b} onChange={(e) => setB(e.target.value)} style={smallInput} />
            </label>
          </div>

          <label className="field" style={{ margin: 0 }}>
            Operation
            <select value={op} onChange={(e) => setOp(e.target.value)} style={{ width: '4rem', textAlign: 'center' }}>
              <option value="+">+</option>
              <option value="-">−</option>
              <option value="*">×</option>
              <option value="/">÷</option>
            </select>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label className="field" style={{ margin: 0 }}>
              Numerator C
              <input type="number" step="1" value={c} onChange={(e) => setC(e.target.value)} style={smallInput} />
            </label>
            <label className="field" style={{ margin: 0 }}>
              Denominator D
              <input type="number" step="1" value={d} onChange={(e) => setD(e.target.value)} style={smallInput} />
            </label>
          </div>
        </div>

        {calc.error ? (
          <p className="hint" style={{ marginTop: '1rem' }}>{calc.error}</p>
        ) : (
          <>
            <div className="stat-grid" style={{ marginTop: '1rem' }}>
              <div className="stat">
                <div className="label">Simplified</div>
                <div className="value" style={{ color: 'var(--accent)' }}>{calc.fraction}</div>
              </div>
              <div className="stat">
                <div className="label">Mixed number</div>
                <div className="value">{calc.mixed}</div>
              </div>
              <div className="stat">
                <div className="label">Decimal</div>
                <div className="value">{calc.decimal}</div>
              </div>
            </div>
            <p className="hint" style={{ marginTop: '0.75rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {calc.step}
            </p>
          </>
        )}
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h2>Decimal → fraction</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '-0.3rem' }}>
          Works for terminating decimals (e.g. 0.75 → 3/4). Repeating decimals aren’t supported.
        </p>

        <label className="field" style={{ maxWidth: '16rem' }}>
          Decimal
          <input
            type="number"
            step="any"
            value={dec}
            onChange={(e) => setDec(e.target.value)}
            placeholder="e.g. 0.75"
          />
        </label>

        {decResult.error ? (
          <p className="hint" style={{ marginTop: '1rem' }}>{decResult.error}</p>
        ) : (
          <div className="stat-grid" style={{ marginTop: '1rem' }}>
            <div className="stat">
              <div className="label">Fraction</div>
              <div className="value" style={{ color: 'var(--accent)' }}>{decResult.fraction}</div>
            </div>
            <div className="stat">
              <div className="label">Mixed number</div>
              <div className="value">{decResult.mixed}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FractionsPage

import { useState, useMemo, useCallback } from 'react'

// Category order controls how groups render.
const CATEGORIES = ['Mathematical', 'Physical', 'Astronomical']

// Reference values: full JS precision; unit '' where dimensionless.
const CONSTANTS = [
  // Mathematical
  { symbol: 'π', name: 'Pi', value: Math.PI, unit: '', category: 'Mathematical' },
  { symbol: 'e', name: "Euler's number", value: Math.E, unit: '', category: 'Mathematical' },
  { symbol: 'φ', name: 'Golden ratio', value: (1 + Math.sqrt(5)) / 2, unit: '', category: 'Mathematical' },
  { symbol: '√2', name: 'Square root of 2', value: Math.SQRT2, unit: '', category: 'Mathematical' },
  { symbol: '√3', name: 'Square root of 3', value: Math.sqrt(3), unit: '', category: 'Mathematical' },
  { symbol: 'ln(2)', name: 'Natural log of 2', value: Math.LN2, unit: '', category: 'Mathematical' },
  { symbol: 'γ', name: 'Euler–Mascheroni constant', value: 0.5772156649015329, unit: '', category: 'Mathematical' },

  // Physical
  { symbol: 'c', name: 'Speed of light in vacuum', value: 299792458, unit: 'm/s', category: 'Physical' },
  { symbol: 'g', name: 'Standard gravity', value: 9.80665, unit: 'm/s²', category: 'Physical' },
  { symbol: 'G', name: 'Gravitational constant', value: 6.674e-11, unit: 'N·m²/kg²', category: 'Physical' },
  { symbol: 'h', name: 'Planck constant', value: 6.62607015e-34, unit: 'J·s', category: 'Physical' },
  { symbol: 'ħ', name: 'Reduced Planck constant', value: 1.054571817e-34, unit: 'J·s', category: 'Physical' },
  { symbol: 'k_B', name: 'Boltzmann constant', value: 1.380649e-23, unit: 'J/K', category: 'Physical' },
  { symbol: 'N_A', name: 'Avogadro constant', value: 6.02214076e23, unit: '1/mol', category: 'Physical' },
  { symbol: 'R', name: 'Molar gas constant', value: 8.314462618, unit: 'J/(mol·K)', category: 'Physical' },
  { symbol: 'e⁻', name: 'Elementary charge', value: 1.602176634e-19, unit: 'C', category: 'Physical' },
  { symbol: 'mₑ', name: 'Electron mass', value: 9.1093837015e-31, unit: 'kg', category: 'Physical' },
  { symbol: 'mₚ', name: 'Proton mass', value: 1.67262192369e-27, unit: 'kg', category: 'Physical' },
  { symbol: 'ε₀', name: 'Vacuum permittivity', value: 8.8541878128e-12, unit: 'F/m', category: 'Physical' },
  { symbol: 'μ₀', name: 'Vacuum permeability', value: 1.25663706212e-6, unit: 'N/A²', category: 'Physical' },
  { symbol: 'atm', name: 'Standard atmospheric pressure', value: 101325, unit: 'Pa', category: 'Physical' },
  { symbol: '0 K', name: 'Absolute zero', value: -273.15, unit: '°C', category: 'Physical' },

  // Astronomical
  { symbol: 'R⊕', name: 'Earth mean radius', value: 6371000, unit: 'm', category: 'Astronomical' },
  { symbol: 'M⊕', name: 'Earth mass', value: 5.972e24, unit: 'kg', category: 'Astronomical' },
  { symbol: 'AU', name: 'Astronomical unit', value: 1.495978707e11, unit: 'm', category: 'Astronomical' },
  { symbol: 'M☉', name: 'Solar mass', value: 1.98892e30, unit: 'kg', category: 'Astronomical' },
  { symbol: 'ly', name: 'Light-year', value: 9.4607304725808e15, unit: 'm', category: 'Astronomical' }
]

// Human-readable value: exponential for very large/small magnitudes, else trimmed decimal.
function formatValue(v) {
  const abs = Math.abs(v)
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) return v.toExponential(6)
  return parseFloat(v.toPrecision(12)).toString()
}

function ConstantsPage() {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(null) // symbol of last-copied row

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    return CATEGORIES
      .map((cat) => ({ cat, items: CONSTANTS.filter((c) => c.category === cat && match(c)) }))
      .filter((g) => g.items.length > 0)
  }, [query])

  const copy = useCallback(async (c) => {
    const text = String(c.value)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for insecure contexts / no clipboard API.
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { /* ignore */ }
    }
    setCopied(c.symbol)
    setTimeout(() => setCopied((s) => (s === c.symbol ? null : s)), 1200)
  }, [])

  const cardStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow)'
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Constants Library</h1>
        <p>A searchable reference of mathematical, physical and astronomical constants. Copy any value at full precision.</p>
      </div>

      <div className="field" style={{ maxWidth: '420px' }}>
        <label htmlFor="const-search">Search</label>
        <input
          id="const-search"
          type="text"
          placeholder="Name, symbol, or category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {groups.length === 0 && (
        <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>No constants match “{query}”.</p>
      )}

      {groups.map(({ cat, items }) => (
        <section key={cat} style={{ marginTop: '20px' }}>
          <h2
            style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              margin: '0 0 10px'
            }}
          >
            {cat}
          </h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            {items.map((c) => (
              <div key={c.symbol + c.name} style={cardStyle}>
                <div
                  aria-hidden="true"
                  style={{
                    flex: '0 0 auto',
                    minWidth: '54px',
                    textAlign: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'var(--accent)'
                  }}
                >
                  {c.symbol}
                </div>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div style={{ color: 'var(--text)', fontWeight: 500 }}>{c.name}</div>
                  <div
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                      wordBreak: 'break-all'
                    }}
                  >
                    {formatValue(c.value)}{c.unit ? ` ${c.unit}` : ''}
                  </div>
                </div>
                <button
                  className="btn"
                  style={{ flex: '0 0 auto' }}
                  onClick={() => copy(c)}
                  aria-label={`Copy value of ${c.name}`}
                >
                  {copied === c.symbol ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default ConstantsPage

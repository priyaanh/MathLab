import { useState, useMemo, useCallback } from 'react'

// Number Base Converter — parse a value in a chosen base (2–36) and show it
// in binary/octal/decimal/hex plus an arbitrary target base, with a bitwise
// playground. Self-contained: only global CSS classes + theme-var inline styles.

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz' // index === digit value

// Valid digit chars for a base, e.g. base 16 -> "0123456789abcdef".
const digitsForBase = (base) => DIGITS.slice(0, base)

// Clamp helper for the 2–36 base range.
const clampBase = (n) => Math.max(2, Math.min(36, Math.floor(n) || 2))

// Parse `raw` written in `base`. Base 10 allows one fractional point; other
// bases are integer-only. Returns { value, error } — value is null when empty
// so callers render a dash instead of NaN.
function parseNumber(raw, base) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === '' || s === '-' || s === '.') return { value: null, error: null }

  const neg = s[0] === '-'
  const body = neg ? s.slice(1) : s
  const valid = digitsForBase(base)

  if (base === 10) {
    if (!/^\d*\.?\d*$/.test(body) || body === '.') {
      return { value: null, error: 'Only digits 0–9 and one decimal point allowed.' }
    }
    const v = Number(body)
    if (!Number.isFinite(v)) return { value: null, error: 'Not a valid number.' }
    return { value: neg ? -v : v, error: null }
  }

  if (body.includes('.')) {
    return { value: null, error: `Base ${base} accepts integers only (no decimal point).` }
  }
  for (const ch of body) {
    if (!valid.includes(ch)) {
      return { value: null, error: `"${ch}" is not a valid digit for base ${base}.` }
    }
  }
  const v = parseInt(body, base)
  if (!Number.isFinite(v)) return { value: null, error: 'Not a valid number.' }
  return { value: neg ? -v : v, error: null }
}

// Render a Number in an arbitrary radix, including a fractional part (bounded).
// Uppercased so digits > 9 read as A–Z. Returns a dash for null/NaN.
function toRadix(value, radix, maxFrac = 16) {
  if (value === null || !Number.isFinite(value)) return '—'
  const neg = value < 0
  let abs = Math.abs(value)
  const intPart = Math.floor(abs)
  let frac = abs - intPart
  let out = intPart.toString(radix)
  if (frac > 0) {
    out += '.'
    let i = 0
    while (frac > 1e-12 && i < maxFrac) {
      frac *= radix
      const d = Math.floor(frac)
      out += d.toString(radix)
      frac -= d
      i++
    }
  }
  return (neg ? '-' : '') + out.toUpperCase()
}

// Space every 4 bits, grouping the integer part from the right. Leaves any
// sign and fractional tail intact.
function groupNibbles(bin) {
  if (bin === '—') return bin
  const neg = bin[0] === '-'
  let rest = neg ? bin.slice(1) : bin
  const dot = rest.indexOf('.')
  const intp = dot === -1 ? rest : rest.slice(0, dot)
  const tail = dot === -1 ? '' : rest.slice(dot)
  const grouped = intp.replace(/\B(?=(.{4})+$)/g, ' ')
  return (neg ? '-' : '') + grouped + tail
}

// Format a decimal Number without ever surfacing NaN.
const fmtDecimal = (v) => (v === null || !Number.isFinite(v) ? '—' : String(v))

// Clipboard write with a legacy execCommand fallback.
function copyText(text) {
  if (text == null || text === '—') return Promise.resolve(false)
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return Promise.resolve(ok)
  } catch {
    return Promise.resolve(false)
  }
}

const BASE_PRESETS = [
  { key: '2', label: 'Binary (2)' },
  { key: '8', label: 'Octal (8)' },
  { key: '10', label: 'Decimal (10)' },
  { key: '16', label: 'Hex (16)' }
]

// Shared inline style for monospaced value cells, keyed to theme vars.
const monoCell = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  padding: '6px 10px',
  color: 'var(--text)',
  overflowX: 'auto',
  whiteSpace: 'nowrap',
  flex: 1,
  minWidth: 0
}

// One labeled output row: label + monospace value + copy button.
function ResultRow({ label, value, copied, onCopy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      <span style={{ width: '72px', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <code style={monoCell}>{value}</code>
      <button
        className="btn"
        onClick={onCopy}
        disabled={value === '—'}
        title={`Copy ${label}`}
        style={{ flexShrink: 0 }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function BasePage() {
  const [input, setInput] = useState('255')
  const [baseMode, setBaseMode] = useState('10') // one of presets or 'other'
  const [customBase, setCustomBase] = useState(3)
  const [targetBase, setTargetBase] = useState(12)
  const [aInput, setAInput] = useState('12')
  const [bInput, setBInput] = useState('10')
  const [copied, setCopied] = useState('') // key of the last-copied row

  const base = baseMode === 'other' ? clampBase(customBase) : Number(baseMode)

  const { value, error } = useMemo(() => parseNumber(input, base), [input, base])

  // Fire clipboard write and flash "Copied" on the matching row briefly.
  const doCopy = useCallback((key, text) => {
    copyText(text).then((ok) => {
      if (!ok) return
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1200)
    })
  }, [])

  // Precompute the four standard conversions once.
  const bin = toRadix(value, 2)
  const oct = toRadix(value, 8)
  const dec = fmtDecimal(value)
  const hex = toRadix(value, 16)
  const binGrouped = groupNibbles(bin)
  const tBase = clampBase(targetBase)
  const arbitrary = toRadix(value, tBase)

  // Bitwise operands: integers in the current base (fraction floored away).
  const aParsed = parseNumber(aInput, base)
  const bParsed = parseNumber(bInput, base)
  const aInt = aParsed.value === null ? null : Math.trunc(aParsed.value)
  const bInt = bParsed.value === null ? null : Math.trunc(bParsed.value)
  const bitReady = aInt !== null && bInt !== null

  // Each op -> its signed decimal result (Number is 32-bit for bitwise).
  const bitOps = bitReady
    ? [
        { label: 'A AND B', v: aInt & bInt },
        { label: 'A OR B', v: aInt | bInt },
        { label: 'A XOR B', v: aInt ^ bInt },
        { label: 'NOT A', v: ~aInt },
        { label: 'A << 1', v: aInt << 1 },
        { label: 'A >> 1', v: aInt >> 1 }
      ]
    : []

  // Show bin/hex from the 32-bit two's-complement pattern; decimal stays signed.
  const bitBin = (n) => groupNibbles((n >>> 0).toString(2).toUpperCase())
  const bitHex = (n) => (n >>> 0).toString(16).toUpperCase()

  const dangerStyle = { color: 'var(--danger)', marginTop: '8px', fontSize: '0.9em' }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Number Base Converter</h1>
        <p>Convert between binary, octal, decimal, hex and any base 2–36, with a bitwise playground.</p>
      </div>

      <div className="tool-layout">
        {/* Input + base selection */}
        <div className="panel">
          <h2>Input</h2>
          <div className="field">
            <label>Value</label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a number"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <label style={{ color: 'var(--text-muted)', display: 'block', margin: '4px 0 6px' }}>Input base</label>
          <div className="seg-control">
            {BASE_PRESETS.map((p) => (
              <button
                key={p.key}
                className={baseMode === p.key ? 'active' : ''}
                onClick={() => setBaseMode(p.key)}
                aria-pressed={baseMode === p.key}
              >
                {p.label}
              </button>
            ))}
            <button
              className={baseMode === 'other' ? 'active' : ''}
              onClick={() => setBaseMode('other')}
              aria-pressed={baseMode === 'other'}
            >
              Other
            </button>
          </div>

          {baseMode === 'other' && (
            <div className="field" style={{ marginTop: '8px' }}>
              <label>Custom base (2–36)</label>
              <input
                type="number"
                min={2}
                max={36}
                value={customBase}
                onChange={(e) => setCustomBase(clampBase(Number(e.target.value)))}
              />
            </div>
          )}

          <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '0.9em' }}>
            Parsing in base {base}. {base === 10 ? 'Decimals allowed.' : 'Integers only.'} Leading minus ok.
          </p>
          {error && <div style={dangerStyle}>{error}</div>}
        </div>

        {/* Standard + arbitrary conversions */}
        <div className="panel">
          <h2>Conversions</h2>
          <ResultRow label="Binary" value={binGrouped} copied={copied === 'bin'} onCopy={() => doCopy('bin', bin.replace(/\s/g, ''))} />
          <ResultRow label="Octal" value={oct} copied={copied === 'oct'} onCopy={() => doCopy('oct', oct)} />
          <ResultRow label="Decimal" value={dec} copied={copied === 'dec'} onCopy={() => doCopy('dec', dec)} />
          <ResultRow label="Hex" value={hex} copied={copied === 'hex'} onCopy={() => doCopy('hex', hex)} />

          <div className="field" style={{ marginTop: '14px' }}>
            <label>Arbitrary target base (2–36)</label>
            <input
              type="number"
              min={2}
              max={36}
              value={targetBase}
              onChange={(e) => setTargetBase(clampBase(Number(e.target.value)))}
            />
          </div>
          <ResultRow
            label={`Base ${tBase}`}
            value={arbitrary}
            copied={copied === 'arb'}
            onCopy={() => doCopy('arb', arbitrary)}
          />
        </div>

        {/* Bitwise playground — integers, 32-bit Number semantics */}
        <div className="panel">
          <h2>Bitwise (integers)</h2>
          <div className="seg-control" style={{ display: 'flex', gap: '10px' }}>
            <label className="field" style={{ flex: 1 }}>
              A (base {base})
              <input type="text" value={aInput} onChange={(e) => setAInput(e.target.value)} spellCheck={false} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              B (base {base})
              <input type="text" value={bInput} onChange={(e) => setBInput(e.target.value)} spellCheck={false} />
            </label>
          </div>

          {(aParsed.error || bParsed.error) && (
            <div style={dangerStyle}>{aParsed.error || bParsed.error}</div>
          )}

          {bitReady ? (
            <div style={{ marginTop: '12px' }}>
              {bitOps.map((op) => (
                <div
                  key={op.label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '84px 1fr',
                    gap: '4px 10px',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <strong style={{ color: 'var(--accent)', alignSelf: 'center' }}>{op.label}</strong>
                  <div style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
                    <code style={{ ...monoCell, flex: 'unset' }}>bin {bitBin(op.v)}</code>
                    <code style={{ ...monoCell, flex: 'unset' }}>hex {bitHex(op.v)}</code>
                    <code style={{ ...monoCell, flex: 'unset' }}>dec {op.v}</code>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '0.9em' }}>
              Enter valid integers for A and B to see results.
            </p>
          )}

          <p style={{ color: 'var(--text-muted)', marginTop: '10px', fontSize: '0.85em' }}>
            Note: bitwise ops use 32-bit signed integers; binary/hex show the 32-bit pattern, decimal is signed.
          </p>
        </div>
      </div>
    </div>
  )
}

export default BasePage

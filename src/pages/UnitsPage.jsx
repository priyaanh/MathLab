import { useState, useMemo } from 'react'

// Each category lists its units as [label, factor-to-base]. Temperature is
// flagged `temp` and ignores factors — it converts through Celsius instead.
const CATEGORIES = [
    { name: 'Length', units: [['km', 1000], ['m', 1], ['cm', 0.01], ['mm', 0.001], ['mi', 1609.344], ['yd', 0.9144], ['ft', 0.3048], ['in', 0.0254], ['nmi', 1852]] },
    { name: 'Mass', units: [['t', 1000], ['kg', 1], ['g', 0.001], ['mg', 1e-6], ['lb', 0.45359237], ['oz', 0.028349523125], ['st', 6.35029318]] },
    { name: 'Temperature', temp: true, units: [['°C', null], ['°F', null], ['K', null]] },
    { name: 'Area', units: [['km²', 1e6], ['m²', 1], ['cm²', 1e-4], ['ha', 1e4], ['acre', 4046.8564224], ['ft²', 0.09290304], ['in²', 0.00064516]] },
    { name: 'Volume', units: [['m³', 1000], ['L', 1], ['mL', 0.001], ['gal(US)', 3.785411784], ['qt', 0.946352946], ['pt', 0.473176473], ['cup', 0.2365882365], ['fl oz', 0.0295735295625]] },
    { name: 'Speed', units: [['m/s', 1], ['km/h', 1 / 3.6], ['mph', 0.44704], ['ft/s', 0.3048], ['knot', 1852 / 3600]] },
    { name: 'Time', units: [['s', 1], ['min', 60], ['h', 3600], ['day', 86400], ['week', 604800], ['year', 31557600]] },
    { name: 'Digital', units: [['bit', 0.125], ['B', 1], ['KB', 1024], ['MB', 1048576], ['GB', 1073741824], ['TB', 1099511627776]] },
    { name: 'Angle', units: [['rad', 1], ['deg', Math.PI / 180], ['grad', Math.PI / 200], ['turn', 2 * Math.PI]] }
]

// Temperature is affine, not linear — route everything through Celsius.
const toC = { '°C': x => x, '°F': x => (x - 32) * 5 / 9, 'K': x => x - 273.15 }
const fromC = { '°C': x => x, '°F': x => x * 9 / 5 + 32, 'K': x => x + 273.15 }

const factorOf = (cat, unit) => {
    const found = cat.units.find(u => u[0] === unit)
    return found ? found[1] : 1
}

// Core conversion: linear via base factor, or through-Celsius for temperature.
const convert = (value, cat, from, to) => {
    if (cat.temp) return fromC[to](toC[from](value))
    return value * factorOf(cat, from) / factorOf(cat, to)
}

// Trim floating noise and keep ~6 sig figs; friendly dash for NaN/Infinity.
const fmt = (n) => {
    if (n == null || !Number.isFinite(n)) return '—'
    if (n === 0) return '0'
    const t = parseFloat(n.toPrecision(6))
    const abs = Math.abs(t)
    if (abs < 1e-4 || abs >= 1e12) return t.toExponential(4)
    return String(t)
}

const UnitsPage = () => {
    const [catName, setCatName] = useState('Length')
    const [value, setValue] = useState('1')
    const [from, setFrom] = useState('m')
    const [to, setTo] = useState('ft')

    const cat = CATEGORIES.find(c => c.name === catName)
    const num = parseFloat(value)
    const valid = value.trim() !== '' && !Number.isNaN(num)

    // Switching category resets both units to that category's first two.
    const selectCategory = (name) => {
        const c = CATEGORIES.find(x => x.name === name)
        setCatName(name)
        setFrom(c.units[0][0])
        setTo(c.units[Math.min(1, c.units.length - 1)][0])
    }

    const swap = () => { setFrom(to); setTo(from) }

    // Live single result.
    const result = useMemo(
        () => (valid ? convert(num, cat, from, to) : null),
        [valid, num, cat, from, to]
    )

    // Convert the input into every unit of the current category at once.
    const allRows = useMemo(
        () => cat.units.map(([u]) => [u, valid ? convert(num, cat, from, u) : null]),
        [valid, num, cat, from]
    )

    return (
        <div className="page">
            <div className="page-head">
                <h1>Unit Converter</h1>
                <p>Convert between units across {CATEGORIES.length} categories — length, mass, temperature, and more. Results update as you type.</p>
            </div>

            <div className="tool-layout">
                <div className="panel">
                    <h2>Convert</h2>

                    {/* Category picker */}
                    <div className="seg-control" role="group" aria-label="Category" style={{ flexWrap: 'wrap' }}>
                        {CATEGORIES.map(c => (
                            <button
                                key={c.name}
                                className={catName === c.name ? 'active' : ''}
                                aria-pressed={catName === c.name}
                                onClick={() => selectCategory(c.name)}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>

                    <label className="field" style={{ marginTop: '0.9rem' }}>
                        Value
                        <input
                            type="number"
                            inputMode="decimal"
                            data-keypad="number"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Enter a number"
                        />
                    </label>

                    {/* From / swap / To */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginTop: '0.6rem' }}>
                        <label className="field" style={{ flex: 1 }}>
                            From
                            <select value={from} onChange={(e) => setFrom(e.target.value)}>
                                {cat.units.map(([u]) => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </label>

                        <button
                            className="btn"
                            onClick={swap}
                            aria-label="Swap from and to units"
                            title="Swap units"
                            style={{ padding: '0.55rem 0.8rem' }}
                        >
                            ⇄
                        </button>

                        <label className="field" style={{ flex: 1 }}>
                            To
                            <select value={to} onChange={(e) => setTo(e.target.value)}>
                                {cat.units.map(([u]) => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </label>
                    </div>

                    {/* Live result card */}
                    <div
                        aria-live="polite"
                        style={{
                            marginTop: '1rem',
                            padding: '0.9rem 1rem',
                            borderRadius: '14px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface-2)',
                            color: 'var(--text)'
                        }}
                    >
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {valid ? `${fmt(num)} ${from} =` : 'Enter a value'}
                        </div>
                        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1.2 }}>
                            {fmt(result)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{to}</span>
                        </div>
                    </div>
                </div>

                {/* All-units breakdown */}
                <div className="panel">
                    <h2>{catName} — all units</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '-0.3rem' }}>
                        {valid ? `${fmt(num)} ${from} in every ${catName.toLowerCase()} unit.` : 'Enter a value to see the full table.'}
                    </p>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '0.5rem 0.4rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Unit</th>
                                <th style={{ textAlign: 'right', padding: '0.5rem 0.4rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allRows.map(([u, v]) => {
                                const isTarget = u === to
                                return (
                                    <tr key={u} style={{ background: isTarget ? 'rgba(0,0,0,.05)' : 'transparent' }}>
                                        <td style={{ padding: '0.45rem 0.4rem', borderBottom: '1px solid var(--border)', fontWeight: isTarget ? 700 : 500 }}>
                                            {u}{u === from ? ' (from)' : ''}
                                        </td>
                                        <td style={{ padding: '0.45rem 0.4rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: isTarget ? 'var(--accent)' : 'var(--text)', fontWeight: isTarget ? 700 : 500 }}>
                                            {fmt(v)}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default UnitsPage

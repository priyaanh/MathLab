import { useState } from 'react'

// ---- helpers ----------------------------------------------------------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

// Resize a 2D string grid, preserving overlapping cells.
const resizeGrid = (grid, rows, cols) =>
    Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (grid[r] && grid[r][c] != null ? grid[r][c] : '')))

const blankGrid = (rows, cols) => resizeGrid([], rows, cols)

// Trim -0 and long floats for display.
const fmt = (n) => {
    if (!isFinite(n)) return String(n)
    let v = parseFloat(n.toPrecision(8))
    if (Object.is(v, -0)) v = 0
    return String(v)
}

// Parse string grid -> number matrix (empty/invalid => 0).
const toNums = (g) => g.map(row => row.map(s => {
    const n = parseFloat(s)
    return isNaN(n) ? 0 : n
}))

// ---- linear algebra (throws Error with friendly message) --------------
const add = (A, B, sign = 1) => {
    if (A.length !== B.length || A[0].length !== B[0].length)
        throw new Error('A and B must have the same dimensions')
    return A.map((row, r) => row.map((v, c) => v + sign * B[r][c]))
}

const multiply = (A, B) => {
    if (A[0].length !== B.length)
        throw new Error(`Inner dimensions must match (A.cols=${A[0].length}, B.rows=${B.length})`)
    return A.map((row) =>
        B[0].map((_, c) => row.reduce((s, v, k) => s + v * B[k][c], 0)))
}

const transpose = (A) => A[0].map((_, c) => A.map(row => row[c]))

const scalarMul = (A, k) => A.map(row => row.map(v => v * k))

const determinant = (A) => {
    if (A.length !== A[0].length) throw new Error('Determinant needs a square matrix')
    const n = A.length
    // LU via Gaussian elimination with partial pivoting.
    const M = A.map(row => row.slice())
    let det = 1
    for (let i = 0; i < n; i++) {
        let piv = i
        for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r
        if (Math.abs(M[piv][i]) < 1e-12) return 0
        if (piv !== i) { [M[i], M[piv]] = [M[piv], M[i]]; det = -det }
        det *= M[i][i]
        for (let r = i + 1; r < n; r++) {
            const f = M[r][i] / M[i][i]
            for (let c = i; c < n; c++) M[r][c] -= f * M[i][c]
        }
    }
    return det
}

const inverse = (A) => {
    if (A.length !== A[0].length) throw new Error('Inverse needs a square matrix')
    const n = A.length
    // Augment [A | I] and run Gauss-Jordan.
    const M = A.map((row, r) => [...row, ...row.map((_, c) => (r === c ? 1 : 0))])
    for (let i = 0; i < n; i++) {
        let piv = i
        for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r
        if (Math.abs(M[piv][i]) < 1e-12) throw new Error('Matrix is singular / not invertible')
        ;[M[i], M[piv]] = [M[piv], M[i]]
        const d = M[i][i]
        for (let c = 0; c < 2 * n; c++) M[i][c] /= d
        for (let r = 0; r < n; r++) {
            if (r === i) continue
            const f = M[r][i]
            for (let c = 0; c < 2 * n; c++) M[r][c] -= f * M[i][c]
        }
    }
    return M.map(row => row.slice(n))
}

const rank = (A) => {
    const M = A.map(row => row.slice())
    const rows = M.length, cols = M[0].length
    let rk = 0
    for (let col = 0; col < cols && rk < rows; col++) {
        let piv = -1
        for (let r = rk; r < rows; r++) if (Math.abs(M[r][col]) > 1e-10) { piv = r; break }
        if (piv === -1) continue
        ;[M[rk], M[piv]] = [M[piv], M[rk]]
        const d = M[rk][col]
        for (let c = 0; c < cols; c++) M[rk][c] /= d
        for (let r = 0; r < rows; r++) {
            if (r === rk) continue
            const f = M[r][col]
            for (let c = 0; c < cols; c++) M[r][c] -= f * M[rk][c]
        }
        rk++
    }
    return rk
}

// ---- UI subcomponents -------------------------------------------------
const cellStyle = {
    width: '3.4rem', padding: '0.4rem', textAlign: 'center',
    background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem'
}

const MatrixEditor = ({ label, grid, rows, cols, onCell, onSize, onFill }) => (
    <div className="panel">
        <h2>Matrix {label}</h2>
        <div className="row" style={{ gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Stepper label="rows" value={rows} onChange={(v) => onSize(v, cols)} />
            <Stepper label="cols" value={cols} onChange={(v) => onSize(rows, v)} />
        </div>

        <div style={{ display: 'grid', gap: '0.35rem', margin: '0.9rem 0',
            gridTemplateColumns: `repeat(${cols}, max-content)` }}>
            {grid.map((row, r) => row.map((val, c) => (
                <input key={`${r}-${c}`} type="text" inputMode="decimal" value={val}
                    aria-label={`${label} row ${r + 1} col ${c + 1}`}
                    onChange={(e) => onCell(r, c, e.target.value)} style={cellStyle} />
            )))}
        </div>

        <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
            {['Identity', 'Zero', 'Random', 'Clear'].map(f => (
                <button key={f} className="btn ghost" style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                    onClick={() => onFill(f)}>{f}</button>
            ))}
        </div>
    </div>
)

const Stepper = ({ label, value, onChange }) => (
    <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{label}</span>
        <button className="btn" style={{ padding: '0.2rem 0.6rem' }}
            onClick={() => onChange(clamp(value - 1, 1, 5))} aria-label={`decrease ${label}`}>−</button>
        <span style={{ minWidth: '1.2rem', textAlign: 'center' }}>{value}</span>
        <button className="btn" style={{ padding: '0.2rem 0.6rem' }}
            onClick={() => onChange(clamp(value + 1, 1, 5))} aria-label={`increase ${label}`}>+</button>
    </div>
)

// ---- page -------------------------------------------------------------
const OPS = [
    ['A + B', 'add'], ['A − B', 'sub'], ['A × B', 'mulAB'], ['B × A', 'mulBA'],
    ['scalar · A', 'scalarA'], ['Aᵀ', 'transA'], ['Bᵀ', 'transB'],
    ['det(A)', 'detA'], ['det(B)', 'detB'], ['A⁻¹', 'invA'], ['B⁻¹', 'invB'], ['rank(A)', 'rankA']
]

const MatrixPage = () => {
    const [aRows, setARows] = useState(2)
    const [aCols, setACols] = useState(2)
    const [bRows, setBRows] = useState(2)
    const [bCols, setBCols] = useState(2)
    const [gridA, setGridA] = useState(() => blankGrid(2, 2))
    const [gridB, setGridB] = useState(() => blankGrid(2, 2))
    const [scalar, setScalar] = useState('2')

    const [result, setResult] = useState(null)   // { kind: 'matrix'|'scalar', data, title }
    const [error, setError] = useState('')

    const sizeA = (r, c) => { setARows(r); setACols(c); setGridA(g => resizeGrid(g, r, c)) }
    const sizeB = (r, c) => { setBRows(r); setBCols(c); setGridB(g => resizeGrid(g, r, c)) }

    const cellA = (r, c, v) => setGridA(g => g.map((row, i) => i === r ? row.map((x, j) => j === c ? v : x) : row))
    const cellB = (r, c, v) => setGridB(g => g.map((row, i) => i === r ? row.map((x, j) => j === c ? v : x) : row))

    const fill = (which, kind) => {
        const rows = which === 'A' ? aRows : bRows
        const cols = which === 'A' ? aCols : bCols
        const build = () => Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
            if (kind === 'Identity') return r === c ? '1' : '0'
            if (kind === 'Zero') return '0'
            if (kind === 'Random') return String(Math.floor(Math.random() * 19) - 9)
            return '' // Clear
        }))
        ;(which === 'A' ? setGridA : setGridB)(build())
    }

    const run = (op) => {
        setError('')
        try {
            const A = toNums(gridA), B = toNums(gridB)
            const asMatrix = (m, title) => ({ kind: 'matrix', data: m, title })
            const asScalar = (v, title) => ({ kind: 'scalar', data: v, title })
            let res
            switch (op) {
                case 'add': res = asMatrix(add(A, B), 'A + B'); break
                case 'sub': res = asMatrix(add(A, B, -1), 'A − B'); break
                case 'mulAB': res = asMatrix(multiply(A, B), 'A × B'); break
                case 'mulBA': res = asMatrix(multiply(B, A), 'B × A'); break
                case 'scalarA': {
                    const k = parseFloat(scalar)
                    if (isNaN(k)) throw new Error('Enter a valid scalar')
                    res = asMatrix(scalarMul(A, k), `${fmt(k)} · A`); break
                }
                case 'transA': res = asMatrix(transpose(A), 'Aᵀ'); break
                case 'transB': res = asMatrix(transpose(B), 'Bᵀ'); break
                case 'detA': res = asScalar(determinant(A), 'det(A)'); break
                case 'detB': res = asScalar(determinant(B), 'det(B)'); break
                case 'invA': res = asMatrix(inverse(A), 'A⁻¹'); break
                case 'invB': res = asMatrix(inverse(B), 'B⁻¹'); break
                case 'rankA': res = asScalar(rank(A), 'rank(A)'); break
                default: return
            }
            setResult(res)
        } catch (e) {
            setResult(null)
            setError(e.message)
        }
    }

    return (
        <div className="page">
            <div className="page-head">
                <h1>Matrix Calculator</h1>
                <p>Build two matrices, then add, multiply, transpose, invert, or find the determinant and rank. Sizes run 1×1 to 5×5.</p>
            </div>

            <div className="tool-layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <MatrixEditor label="A" grid={gridA} rows={aRows} cols={aCols}
                    onCell={cellA} onSize={sizeA} onFill={(f) => fill('A', f)} />
                <MatrixEditor label="B" grid={gridB} rows={bRows} cols={bCols}
                    onCell={cellB} onSize={sizeB} onFill={(f) => fill('B', f)} />
            </div>

            <div className="panel" style={{ marginTop: '1.2rem' }}>
                <h2>Operations</h2>

                <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>scalar</span>
                    <input type="text" inputMode="decimal" value={scalar}
                        onChange={(e) => setScalar(e.target.value)} style={{ ...cellStyle, width: '4.5rem' }} />
                </label>

                <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                    {OPS.map(([label, op]) => (
                        <button key={op} className="btn primary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
                            onClick={() => run(op)}>{label}</button>
                    ))}
                </div>

                {error && (
                    <div className="hint" style={{ color: 'var(--danger)', marginTop: '1rem', fontWeight: 600 }}>
                        {error}
                    </div>
                )}

                {result && !error && (
                    <div style={{ marginTop: '1.2rem' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                            {result.title} =
                        </div>
                        {result.kind === 'scalar' ? (
                            <div style={{
                                display: 'inline-block', padding: '0.7rem 1.4rem',
                                background: 'var(--accent)', color: 'var(--on-accent)',
                                borderRadius: '10px', fontSize: '1.3rem', fontWeight: 700,
                                boxShadow: 'var(--shadow)'
                            }}>
                                {fmt(result.data)}
                            </div>
                        ) : (
                            <div style={{
                                display: 'inline-grid', gap: '0.3rem', padding: '0.7rem',
                                background: 'var(--surface)', border: '2px solid var(--accent)',
                                borderRadius: '10px', boxShadow: 'var(--shadow)',
                                gridTemplateColumns: `repeat(${result.data[0].length}, max-content)`
                            }}>
                                {result.data.map((row, r) => row.map((v, c) => (
                                    <div key={`${r}-${c}`} style={{
                                        minWidth: '3rem', padding: '0.45rem 0.6rem', textAlign: 'center',
                                        background: 'var(--surface-2)', color: 'var(--text)',
                                        border: '1px solid var(--border)', borderRadius: '6px',
                                        fontVariantNumeric: 'tabular-nums'
                                    }}>{fmt(v)}</div>
                                )))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default MatrixPage

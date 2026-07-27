/**
 * Pure equation-solving logic for the Equation Solver page.
 *
 * Kept free of React so it can be unit-tested and reused. Parses typed
 * equations (implicit multiplication, ^ powers, ² superscripts, unicode
 * minus) into coefficients, then solves linear / quadratic / 2×2 systems
 * with step-by-step working.
 */

import { parse, evalAst } from './calculus.js'

// Trim float noise for display.
export const fmt = (n) => {
    if (!Number.isFinite(n)) return '—'
    return String(parseFloat(n.toPrecision(10)))
}

// Signed term helper e.g. "- 3" / "+ 3" for readable equations.
export const signed = (n) => (n < 0 ? `- ${fmt(Math.abs(n))}` : `+ ${fmt(n)}`)

// Parse one side of an equation into coefficients { x2, x, y, c }.
export function parseSide(side, vars) {
    let s = String(side)
        .replace(/\s+/g, '')
        .replace(/−/g, '-')   // unicode minus
        .replace(/²/g, '^2')  // ² superscript
        .replace(/[·×*]/g, '')     // drop explicit multiplication signs
        .toLowerCase()

    const acc = { x2: 0, x: 0, y: 0, c: 0 }
    if (s === '') return acc
    if (s[0] !== '+' && s[0] !== '-') s = '+' + s

    const terms = s.match(/[+-][^+-]*/g) || []
    for (const t of terms) {
        const sign = t[0] === '-' ? -1 : 1
        const body = t.slice(1)
        if (body === '') continue
        const m = body.match(/^(\d*\.?\d*)([a-z])?(?:\^(\d+))?$/)
        if (!m) throw new Error(`Couldn't read "${t}".`)
        const [, numStr, v, powStr] = m
        let coef = numStr === '' ? 1 : parseFloat(numStr)
        if (Number.isNaN(coef)) throw new Error(`Couldn't read the number in "${t}".`)
        coef *= sign
        if (!v) { acc.c += coef; continue }
        if (!vars.includes(v)) throw new Error(`Unexpected variable "${v}". Use ${vars.join(', ')}.`)
        const p = powStr ? parseInt(powStr, 10) : 1
        if (v === 'x') {
            if (p === 1) acc.x += coef
            else if (p === 2) acc.x2 += coef
            else throw new Error(`Powers above 2 aren't supported (got x^${p}).`)
        } else {
            if (p !== 1) throw new Error(`Only linear ${v} is supported (got ${v}^${p}).`)
            acc.y += coef
        }
    }
    return acc
}

// Parse a full "lhs = rhs" equation into net coefficients (lhs − rhs = 0).
// Missing "=" is treated as "= 0".
export function parseEquation(input, vars) {
    const raw = String(input).trim()
    if (raw === '') throw new Error('Enter an equation.')
    const sides = raw.split('=')
    if (sides.length > 2) throw new Error('Use at most one "=" sign.')
    const lhs = parseSide(sides[0], vars)
    const rhs = sides.length === 2 ? parseSide(sides[1], vars) : { x2: 0, x: 0, y: 0, c: 0 }
    return { x2: lhs.x2 - rhs.x2, x: lhs.x - rhs.x, y: lhs.y - rhs.y, c: lhs.c - rhs.c }
}

// All solvers take numeric coefficients from the parsed equation (lhs − rhs = 0).

export function solveLinear(a, b) {
    const steps = [`Rearrange to standard form: ${fmt(a)}x ${signed(b)} = 0`]

    if (a === 0) {
        if (b === 0) {
            return {
                title: 'Linear result', ok: false,
                steps: [...steps, 'The x term vanished and 0 = 0, which is always true.'],
                answer: 'Infinitely many solutions (any x).', extra: []
            }
        }
        return {
            title: 'Linear result', ok: false,
            steps: [...steps, `The x term vanished and ${fmt(b)} = 0, which is never true.`],
            answer: 'No solution.', extra: []
        }
    }

    const x = -b / a
    return {
        title: 'Linear result', ok: true,
        steps: [
            ...steps,
            `Subtract ${fmt(b)} from both sides: ${fmt(a)}x = ${fmt(-b)}`,
            `Divide both sides by ${fmt(a)}: x = ${fmt(-b)} / ${fmt(a)}`,
            `x = ${fmt(x)}`
        ],
        answer: `x = ${fmt(x)}`,
        value: x,
        extra: []
    }
}

export function solveQuadratic(a, b, c) {
    // Degenerate: not actually quadratic -> fall back to linear bx + c = 0.
    if (a === 0) {
        const lin = solveLinear(b, c)
        return {
            ...lin,
            title: 'Quadratic result',
            steps: ['a = 0, so this is not quadratic. Solving bx + c = 0 instead.', ...lin.steps]
        }
    }

    const disc = b * b - 4 * a * c
    const vx = -b / (2 * a)
    const vy = a * vx * vx + b * vx + c
    const sum = -b / a
    const prod = c / a
    const steps = [
        `Standard form: ${fmt(a)}x² ${signed(b)}x ${signed(c)} = 0`,
        `Discriminant Δ = b² − 4ac = (${fmt(b)})² − 4(${fmt(a)})(${fmt(c)}) = ${fmt(disc)}`
    ]

    let answer, ok, roots
    if (disc > 0) {
        const r = Math.sqrt(disc)
        // Numerically stable roots: computing both as (−b ± √Δ)/2a loses the
        // smaller root to catastrophic cancellation when b² ≫ 4ac. Form the
        // larger-magnitude root first, then get the other from x₁·x₂ = c/a.
        const q = -(b + Math.sign(b || 1) * r) / 2
        const x1 = q / a
        const x2 = c / q
        steps.push(`Δ > 0 → two distinct real roots.`)
        steps.push(`x = (−b ± √Δ) / 2a = (${fmt(-b)} ± ${fmt(r)}) / ${fmt(2 * a)}`)
        steps.push(`x₁ = ${fmt(x1)},  x₂ = ${fmt(x2)}`)
        answer = `x₁ = ${fmt(x1)},  x₂ = ${fmt(x2)}`
        roots = [x1, x2]
        ok = true
    } else if (disc === 0) {
        const x1 = -b / (2 * a)
        steps.push(`Δ = 0 → one repeated real root.`)
        steps.push(`x = −b / 2a = ${fmt(-b)} / ${fmt(2 * a)}`)
        steps.push(`x = ${fmt(x1)}`)
        answer = `x = ${fmt(x1)} (double root)`
        roots = [x1]
        ok = true
    } else {
        const re = -b / (2 * a)
        const im = Math.sqrt(-disc) / (2 * a)
        steps.push(`Δ < 0 → no real roots; two complex conjugate roots.`)
        steps.push(`x = (−b ± √Δ) / 2a with √Δ = ${fmt(Math.sqrt(-disc))}i`)
        steps.push(`x = ${fmt(re)} ± ${fmt(Math.abs(im))}i`)
        answer = `x = ${fmt(re)} ± ${fmt(Math.abs(im))}i`
        roots = []
        ok = false
    }

    return {
        title: 'Quadratic result', ok, steps, answer, roots, disc,
        extra: [
            { k: 'Vertex', v: `(${fmt(vx)}, ${fmt(vy)})` },
            { k: 'Axis of symmetry', v: `x = ${fmt(vx)}` },
            { k: 'Sum of roots (−b/a)', v: fmt(sum) },
            { k: 'Product of roots (c/a)', v: fmt(prod) }
        ]
    }
}

// ---- General numeric solver -------------------------------------------
// Handles anything the expression parser understands — square roots, cubes
// and higher powers, and other functions — by moving everything to one side
// and finding where f(x) = 0 numerically. Used when the exact linear/quadratic
// path can't apply (e.g. x^3, √x, x^5 - 2x).

// Normalize a typed side into syntax the expression parser accepts.
const preprocess = (s) => String(s)
    .replace(/√\s*\(([^)]*)\)/g, 'sqrt($1)')
    .replace(/√\s*([0-9]*\.?[0-9]+)/g, 'sqrt($1)')
    .replace(/√\s*([a-zA-Zπe])/g, 'sqrt($1)')
    .replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4').replace(/⁵/g, '^5')
    .replace(/−/g, '-').replace(/×/g, '*').replace(/·/g, '*').replace(/÷/g, '/')

// Refine a sign-changing bracket [a, b] to a root by bisection.
const bisect = (f, a, b) => {
    let fa = f(a)
    for (let i = 0; i < 80; i++) {
        const m = (a + b) / 2
        const fm = f(m)
        if (fm === 0 || (b - a) / 2 < 1e-12) return m
        if ((fa < 0) === (fm < 0)) { a = m; fa = fm } else { b = m }
    }
    return (a + b) / 2
}

// Minimise |f| on [a, b] by ternary search — used to pin down even-multiplicity
// (touch) roots, where f dips to zero without changing sign.
const ternaryMin = (g, a, b) => {
    for (let i = 0; i < 100; i++) {
        const m1 = a + (b - a) / 3
        const m2 = b - (b - a) / 3
        if (g(m1) < g(m2)) b = m2; else a = m1
    }
    return (a + b) / 2
}

// Scan [min, max] for real roots of f: sign changes (odd multiplicity) plus
// near-zero touches (even multiplicity). A candidate is only accepted if f is
// actually ~0 there — this rejects vertical asymptotes, where f flips sign
// across a pole without ever being a solution. Returns sorted, de-duped roots.
const findRealRoots = (f, min = -100, max = 100, step = 0.01) => {
    const roots = []
    const add = (r) => {
        if (!Number.isFinite(r)) return
        let rr = Math.round(r * 1e6) / 1e6
        if (Math.abs(rr - Math.round(rr)) < 1e-6) rr = Math.round(rr)
        if (!roots.some(x => Math.abs(x - rr) < 1e-4)) roots.push(rr)
    }
    // Genuine root ⇒ f is finite and essentially zero there (not a pole).
    const genuine = (r) => { const y = f(r); return Number.isFinite(y) && Math.abs(y) < 1e-6 }
    const absF = (t) => Math.abs(f(t))

    let x0 = null, y0 = null   // two samples back (for local-min / touch detection)
    let x1 = min, y1 = f(min)  // one sample back
    for (let x = min + step; x <= max + step / 2; x += step) {
        const y = f(x)
        if (Number.isFinite(y1) && Number.isFinite(y)) {
            if (y1 === 0) { if (genuine(x1)) add(x1) }
            else if ((y1 < 0) !== (y < 0)) {
                const r = bisect(f, x1, x)
                if (genuine(r)) add(r)   // reject asymptote crossings
            }
        }
        // Touch root: |f| has a local minimum at x1 with no sign change.
        if (x0 !== null && Number.isFinite(y0) && Number.isFinite(y1) && Number.isFinite(y)
            && Math.abs(y1) < Math.abs(y0) && Math.abs(y1) <= Math.abs(y)) {
            const xm = ternaryMin(absF, x0, x)
            if (genuine(xm)) add(xm)
        }
        x0 = x1; y0 = y1
        x1 = x; y1 = y
    }
    return roots.sort((a, b) => a - b)
}

export function solveGeneral(input) {
    const raw = String(input).trim()
    if (raw === '') throw new Error('Enter an equation.')
    const sides = raw.split('=')
    if (sides.length > 2) throw new Error('Use at most one "=" sign.')

    let lhs, rhs
    try {
        lhs = parse(preprocess(sides[0]))
        rhs = sides.length === 2 ? parse(preprocess(sides[1])) : { t: 'num', v: 0 }
    } catch {
        throw new Error("Couldn't read that equation. Use x, ^ for powers, sqrt( ), and + − × ÷.")
    }

    const f = (x) => evalAst(lhs, x, 'x') - evalAst(rhs, x, 'x')
    // Guard against non-x variables (e.g. a stray y): f is NaN everywhere.
    if (!Number.isFinite(f(0)) && !Number.isFinite(f(1)) && !Number.isFinite(f(2))) {
        throw new Error('Use only x here. Switch to "System 2×2" for x and y.')
    }

    const roots = findRealRoots(f)
    const rhsShown = sides.length === 2 ? sides[1].trim() : '0'
    const steps = [
        `Bring everything to one side: f(x) = (${sides[0].trim()}) − (${rhsShown}) = 0`,
        'Scan x over [−100, 100] for sign changes, then refine each crossing by bisection.'
    ]

    if (!roots.length) {
        return {
            title: 'Result', ok: false,
            steps: [...steps, 'No sign change was found in the scanned range.'],
            answer: 'No real solution found in [−100, 100] — there may be complex roots or roots outside this range.',
            extra: []
        }
    }

    const shown = roots.slice(0, 8)
    const answer = shown
        .map((r, i) => `x${shown.length > 1 ? `₁₂₃₄₅₆₇₈`[i] || `_${i + 1}` : ''} = ${fmt(r)}`)
        .join(',  ')
    steps.push(`Found ${roots.length} real root${roots.length > 1 ? 's' : ''}: ${shown.map(fmt).join(', ')}${roots.length > shown.length ? ', …' : ''}`)

    return {
        title: 'Result', ok: true, steps, answer, roots: shown,
        extra: [{ k: 'Real roots found', v: String(roots.length) }]
    }
}

export function solveSystem(p1, p2) {
    // Each parsed equation is (x·p.x + y·p.y + p.c = 0) → a·x + b·y = c.
    const A1 = p1.x, B1 = p1.y, C1 = -p1.c
    const A2 = p2.x, B2 = p2.y, C2 = -p2.c

    const D = A1 * B2 - A2 * B1
    const Dx = C1 * B2 - C2 * B1
    const Dy = A1 * C2 - A2 * C1
    const steps = [
        `System: ${fmt(A1)}x ${signed(B1)}y = ${fmt(C1)};  ${fmt(A2)}x ${signed(B2)}y = ${fmt(C2)}`,
        `D = a₁b₂ − a₂b₁ = (${fmt(A1)})(${fmt(B2)}) − (${fmt(A2)})(${fmt(B1)}) = ${fmt(D)}`
    ]

    if (D === 0) {
        if (Dx === 0 && Dy === 0) {
            return {
                title: 'System result', ok: false,
                steps: [...steps, 'D = 0 and Dx = Dy = 0 → equations are dependent (same line).'],
                answer: 'Infinitely many solutions (dependent system).', extra: []
            }
        }
        return {
            title: 'System result', ok: false,
            steps: [...steps, `D = 0 but Dx = ${fmt(Dx)}, Dy = ${fmt(Dy)} → lines are parallel.`],
            answer: 'No solution (inconsistent system).', extra: []
        }
    }

    const x = Dx / D
    const y = Dy / D
    return {
        title: 'System result', ok: true,
        steps: [
            ...steps,
            `Dx = c₁b₂ − c₂b₁ = ${fmt(Dx)}`,
            `Dy = a₁c₂ − a₂c₁ = ${fmt(Dy)}`,
            `x = Dx / D = ${fmt(Dx)} / ${fmt(D)} = ${fmt(x)}`,
            `y = Dy / D = ${fmt(Dy)} / ${fmt(D)} = ${fmt(y)}`
        ],
        answer: `x = ${fmt(x)},  y = ${fmt(y)}`,
        value: { x, y },
        extra: []
    }
}

/**
 * Pure equation-solving logic for the Equation Solver page.
 *
 * Kept free of React so it can be unit-tested and reused. Parses typed
 * equations (implicit multiplication, ^ powers, ² superscripts, unicode
 * minus) into coefficients, then solves linear / quadratic / 2×2 systems
 * with step-by-step working.
 */

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
        const x1 = (-b + r) / (2 * a)
        const x2 = (-b - r) / (2 * a)
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

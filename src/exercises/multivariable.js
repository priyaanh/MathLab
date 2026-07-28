/**
 * Multivariable-calculus practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 *
 * Design note: we stick to polynomial fields and integer-valued sample points so
 * every partial derivative, divergence, dot/cross product and integral evaluates
 * exactly. Magnitudes and integrals that land on decimals use type 'numeric' with
 * a tolerance; everything else is an exact 'integer'.
 */

import { randInt, randNonZero, choice, round } from './helpers.js'

// Format a signed term like "+ 3", "- 2", using a plain unicode minus for display.
const signed = (coef) => (coef < 0 ? `- ${Math.abs(coef)}` : `+ ${coef}`)

// Format "coef·var" dropping a coefficient of 1/-1, e.g. term(1,'x') -> "x".
const term = (coef, v) => {
    if (coef === 1) return v
    if (coef === -1) return `-${v}`
    return `${coef}${v}`
}

// Build f(x,y) = a x^2 + b xy + c y^2 + d x + e y + g as a display string.
const fmtXY = (a, b, c, d, e, g) => {
    // One term with the right sign/spelling, either leading or continuing.
    const piece = (coef, suffix, first) => {
        if (coef === 0) return null
        if (first) return suffix ? term(coef, suffix) : `${coef}`
        const mag = Math.abs(coef)
        const body = suffix ? (mag === 1 ? suffix : `${mag}${suffix}`) : `${mag}`
        return `${coef < 0 ? '-' : '+'} ${body}`
    }
    const out = []
    for (const [coef, suffix] of [[a, 'x^2'], [b, 'xy'], [c, 'y^2'], [d, 'x'], [e, 'y'], [g, '']]) {
        const s = piece(coef, suffix, out.length === 0)
        if (s !== null) out.push(s)
    }
    return out.length === 0 ? '0' : out.join(' ')
}

const skills = [
    {
        id: 'mv-partial-x',
        title: 'Partial derivative ∂f/∂x at a point',
        desc: 'Differentiate a polynomial in x (treating y constant) and evaluate.',
        generate() {
            const a = randNonZero(-3, 3) // x^2
            const b = randNonZero(-3, 3) // xy
            const c = randInt(-3, 3)     // y^2
            const d = randInt(-4, 4)     // x
            const e = randInt(-4, 4)     // y
            const x0 = randInt(-3, 3)
            const y0 = randInt(-3, 3)
            // ∂f/∂x = 2a x + b y + d
            const answer = 2 * a * x0 + b * y0 + d
            const f = fmtXY(a, b, c, d, e, 0)
            return {
                prompt: `Let f(x, y) = ${f}. Find ∂f/∂x at the point (${x0}, ${y0}).`,
                answer,
                type: 'integer',
                explanation: `Treat y as a constant and differentiate in x: ∂f/∂x = ${2 * a}x ${signed(b)}y ${signed(d)}.\nSubstitute x = ${x0}, y = ${y0}: ${2 * a}(${x0}) + ${b}(${y0}) + ${d}.\nEvaluate: ∂f/∂x = ${answer}.`,
            }
        },
    },

    {
        id: 'mv-partial-y',
        title: 'Partial derivative ∂f/∂y at a point',
        desc: 'Differentiate a polynomial in y (treating x constant) and evaluate.',
        generate() {
            const a = randInt(-3, 3)     // x^2
            const b = randNonZero(-3, 3) // xy
            const c = randNonZero(-3, 3) // y^2
            const d = randInt(-4, 4)     // x
            const e = randInt(-4, 4)     // y
            const x0 = randInt(-3, 3)
            const y0 = randInt(-3, 3)
            // ∂f/∂y = b x + 2c y + e
            const answer = b * x0 + 2 * c * y0 + e
            const f = fmtXY(a, b, c, d, e, 0)
            return {
                prompt: `Let f(x, y) = ${f}. Find ∂f/∂y at the point (${x0}, ${y0}).`,
                answer,
                type: 'integer',
                explanation: `Treat x as a constant and differentiate in y: ∂f/∂y = ${b}x ${signed(2 * c)}y ${signed(e)}.\nSubstitute x = ${x0}, y = ${y0}: ${b}(${x0}) + ${2 * c}(${y0}) + ${e}.\nEvaluate: ∂f/∂y = ${answer}.`,
            }
        },
    },

    {
        id: 'mv-gradient-magnitude',
        title: 'Gradient magnitude |∇f| at a point',
        desc: 'Compute the length of the gradient vector of f(x, y) at a point.',
        generate() {
            const a = randNonZero(1, 4) // x^2
            const c = randNonZero(1, 4) // y^2
            let x0 = randInt(-3, 3)
            let y0 = randInt(-3, 3)
            while (x0 === 0 && y0 === 0) { x0 = randInt(-3, 3); y0 = randInt(-3, 3) }
            // ∇f = (2a x, 2c y)
            const gx = 2 * a * x0
            const gy = 2 * c * y0
            const mag = Math.sqrt(gx * gx + gy * gy)
            const answer = round(mag, 4)
            const f = fmtXY(a, 0, c, 0, 0, 0)
            return {
                prompt: `Let f(x, y) = ${f}. Find the magnitude of the gradient |∇f| at (${x0}, ${y0}). Round to 2 decimals.`,
                answer,
                type: 'numeric',
                tolerance: 1e-2,
                explanation: `Gradient: ∇f = (${2 * a}x, ${2 * c}y), so at (${x0}, ${y0}) it is (${gx}, ${gy}).\n|∇f| = √(${gx}^2 + ${gy}^2) = √${gx * gx + gy * gy}.\nEvaluate: |∇f| ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'mv-gradient-component',
        title: 'Gradient component at a point',
        desc: 'Find one component of ∇f for a polynomial f(x, y).',
        generate() {
            const a = randNonZero(-3, 3) // x^2
            const b = randNonZero(-3, 3) // xy
            const c = randNonZero(-3, 3) // y^2
            const x0 = randInt(-3, 3)
            const y0 = randInt(-3, 3)
            const wantX = choice([true, false])
            // ∇f = (2a x + b y, b x + 2c y)
            const answer = wantX ? 2 * a * x0 + b * y0 : b * x0 + 2 * c * y0
            const f = fmtXY(a, b, c, 0, 0, 0)
            const comp = wantX ? 'x' : 'y'
            const deriv = wantX
                ? `${2 * a}x ${signed(b)}y`
                : `${b}x ${signed(2 * c)}y`
            return {
                prompt: `Let f(x, y) = ${f}. Find the ${comp}-component of ∇f at (${x0}, ${y0}).`,
                answer,
                type: 'integer',
                explanation: `The ${comp}-component of ∇f is ∂f/∂${comp} = ${deriv}.\nSubstitute x = ${x0}, y = ${y0}.\nEvaluate: ${answer}.`,
            }
        },
    },

    {
        id: 'mv-dot-product',
        title: 'Dot product of two 3D vectors',
        desc: 'Compute u · v for vectors in R^3.',
        generate() {
            const u = [randInt(-5, 5), randInt(-5, 5), randInt(-5, 5)]
            const v = [randInt(-5, 5), randInt(-5, 5), randInt(-5, 5)]
            const answer = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
            return {
                prompt: `Compute the dot product u · v where u = <${u.join(', ')}> and v = <${v.join(', ')}>.`,
                answer,
                type: 'integer',
                explanation: `Multiply matching components and add: u · v = (${u[0]})(${v[0]}) + (${u[1]})(${v[1]}) + (${u[2]})(${v[2]}).\nThat is ${u[0] * v[0]} + ${u[1] * v[1]} + ${u[2] * v[2]}.\nEvaluate: u · v = ${answer}.`,
            }
        },
    },

    {
        id: 'mv-cross-product',
        title: 'Cross product component of u × v',
        desc: 'Compute one component of the cross product of two 3D vectors.',
        generate() {
            const u = [randInt(-4, 4), randInt(-4, 4), randInt(-4, 4)]
            const v = [randInt(-4, 4), randInt(-4, 4), randInt(-4, 4)]
            const comp = choice(['i', 'j', 'k'])
            let answer, formula
            if (comp === 'i') {
                answer = u[1] * v[2] - u[2] * v[1]
                formula = `u₂v₃ − u₃v₂ = (${u[1]})(${v[2]}) − (${u[2]})(${v[1]})`
            } else if (comp === 'j') {
                answer = u[2] * v[0] - u[0] * v[2]
                formula = `u₃v₁ − u₁v₃ = (${u[2]})(${v[0]}) − (${u[0]})(${v[2]})`
            } else {
                answer = u[0] * v[1] - u[1] * v[0]
                formula = `u₁v₂ − u₂v₁ = (${u[0]})(${v[1]}) − (${u[1]})(${v[0]})`
            }
            return {
                prompt: `For u = <${u.join(', ')}> and v = <${v.join(', ')}>, find the ${comp}-component of u × v.`,
                answer,
                type: 'integer',
                explanation: `The ${comp}-component of u × v is ${formula}.\nCompute the two products and subtract.\nResult: ${answer}.`,
            }
        },
    },

    {
        id: 'mv-double-integral',
        title: 'Double integral over a rectangle',
        desc: 'Integrate a x + b y over a rectangle [0, p] × [0, q].',
        generate() {
            const a = randInt(-3, 3)
            const b = randInt(-3, 3)
            const g = randNonZero(1, 4) // constant term keeps the integrand nontrivial
            const p = randInt(1, 4)
            const q = randInt(1, 4)
            // ∫₀^p ∫₀^q (a x + b y + g) dy dx
            //   = a·(p^2/2)·q + b·p·(q^2/2) + g·p·q
            const value = a * (p * p / 2) * q + b * p * (q * q / 2) + g * p * q
            const answer = round(value, 4)
            const integrand = fmtXY(0, 0, 0, a, b, g)
            return {
                prompt: `Evaluate the double integral of (${integrand}) over the rectangle 0 ≤ x ≤ ${p}, 0 ≤ y ≤ ${q}.`,
                answer,
                type: 'numeric',
                tolerance: 1e-2,
                explanation: `Integrate term by term over the rectangle: ∫∫ ${a}x dA = ${a}·(${p}²/2)·${q} = ${a * (p * p / 2) * q}.\nLikewise ∫∫ ${b}y dA = ${b}·${p}·(${q}²/2) = ${b * p * (q * q / 2)}, and ∫∫ ${g} dA = ${g}·${p}·${q} = ${g * p * q}.\nAdd the pieces: total = ${answer}.`,
            }
        },
    },

    {
        id: 'mv-divergence',
        title: 'Divergence of a vector field at a point',
        desc: 'Compute div F = ∂P/∂x + ∂Q/∂y + ∂R/∂z at a point.',
        generate() {
            const a = randNonZero(-3, 3) // P = a x^2
            const b = randNonZero(-3, 3) // Q = b y^2
            const c = randNonZero(-3, 3) // R = c z^2
            const x0 = randInt(-3, 3)
            const y0 = randInt(-3, 3)
            const z0 = randInt(-3, 3)
            // div F = 2a x + 2b y + 2c z
            const answer = 2 * a * x0 + 2 * b * y0 + 2 * c * z0
            return {
                prompt: `Let F = <${term(a, 'x^2')}, ${term(b, 'y^2')}, ${term(c, 'z^2')}>. Find div F at the point (${x0}, ${y0}, ${z0}).`,
                answer,
                type: 'integer',
                explanation: `div F = ∂P/∂x + ∂Q/∂y + ∂R/∂z = ${2 * a}x + ${2 * b}y + ${2 * c}z.\nSubstitute x = ${x0}, y = ${y0}, z = ${z0}: ${2 * a}(${x0}) + ${2 * b}(${y0}) + ${2 * c}(${z0}).\nEvaluate: div F = ${answer}.`,
            }
        },
    },
]

export default skills

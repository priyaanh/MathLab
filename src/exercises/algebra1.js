/**
 * Algebra 1 practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 * Prompts are plain text: powers use "^", fractions use "a/b".
 */

import { randInt, randNonZero, choice, reduceFraction, formatFraction } from './helpers.js'

// --- small formatting helpers (module-local, not exported) -----------------

// Linear expression "m x + b" in canonical, space-free form ("2x-3", "-x", "5").
const polyLinear = (m, b) => {
    if (m === 0) return `${b}`
    let s = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`
    if (b !== 0) s += b > 0 ? `+${b}` : `${b}`
    return s
}

// Quadratic "A x^2 + B x + C" in canonical, space-free form ("x^2+5x+6").
const polyQuad = (A, B, C) => {
    let s = A === 1 ? 'x^2' : A === -1 ? '-x^2' : `${A}x^2`
    if (B !== 0) {
        const bx = B === 1 ? 'x' : B === -1 ? '-x' : `${B}x`
        s += B > 0 ? `+${bx}` : bx
    }
    if (C !== 0) s += C > 0 ? `+${C}` : `${C}`
    return s
}

// A single factor "(x + r)" -> "(x+3)" or "(x-3)". r must be non-zero.
const factorTerm = (r) => (r > 0 ? `(x+${r})` : `(x${r})`)

const skills = [
    {
        id: 'alg1-parallel-perpendicular',
        title: 'Parallel & perpendicular slopes',
        desc: 'Give the slope of a line parallel or perpendicular to a given line.',
        generate() {
            const m = randNonZero(-5, 5)
            if (choice([true, false])) {
                return {
                    prompt: `A line has slope ${m}. What is the slope of any line parallel to it?`,
                    answer: m,
                    type: 'numeric',
                    tolerance: 0.02,
                    explanation: `Parallel lines share the same slope: ${m}.`,
                }
            }
            const answer = -1 / m
            return {
                prompt: `A line has slope ${m}. What is the slope of any line perpendicular to it?`,
                answer,
                type: 'numeric',
                tolerance: 0.02,
                explanation: `Perpendicular slope is the negative reciprocal: −1/(${m}) = ${formatFraction(-1, m)}.`,
            }
        },
    },

    {
        id: 'alg1-simplify-radical',
        title: 'Simplify a square root',
        desc: 'Write a square root in simplest radical form.',
        generate() {
            const outside = randInt(2, 6)
            const inside = choice([2, 3, 5, 6, 7, 10])
            const n = outside * outside * inside
            const answer = `${outside}√${inside}`
            return {
                prompt: `Simplify:  √${n}`,
                answer,
                type: 'text',
                accepted: [`${outside}sqrt${inside}`],
                explanation: `√${n} = √(${outside * outside}·${inside}) = ${outside}√${inside}.`,
            }
        },
    },

    {
        id: 'alg1-solve-linear',
        title: 'Solve multi-step linear equations',
        desc: 'Solve a two-sided linear equation with an integer or simple-fraction solution.',
        generate() {
            // Choose the solution x = n/d in lowest terms.
            const [n, d] = reduceFraction(randNonZero(-6, 6), choice([1, 1, 1, 2, 3]))
            const c = randNonZero(-4, 4)
            const k = randNonZero(-2, 2)
            let a = c + d * k // a - c = d*k, so (D - b) / (a - c) = n/d = x
            if (a === 0) a = c + d * (k > 0 ? k + 1 : k - 1)
            const diff = a - c
            const b = randInt(-6, 6)
            const D = b + Math.round((diff * n) / d) // = b + k*n, an integer
            const answer = n / d
            return {
                prompt: `Solve for x:  ${polyLinear(a, b)} = ${polyLinear(c, D)}`,
                answer,
                type: 'numeric',
                tolerance: 0.02,
                explanation: `Collect x-terms and constants to get ${diff}x = ${D - b}, so x = ${formatFraction(D - b, diff)}.`,
            }
        },
    },

    {
        id: 'alg1-slope-two-points',
        title: 'Slope from two points',
        desc: 'Find the slope of the line through two points.',
        generate() {
            const x1 = randInt(-6, 6)
            let x2 = randInt(-6, 6)
            while (x2 === x1) x2 = randInt(-6, 6)
            const y1 = randInt(-8, 8)
            const y2 = randInt(-8, 8)
            const answer = (y2 - y1) / (x2 - x1)
            return {
                prompt: `Find the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`,
                answer,
                type: 'numeric',
                tolerance: 0.02,
                explanation: `slope = (y2 − y1)/(x2 − x1) = (${y2} − ${y1})/(${x2} − ${x1}) = ${formatFraction(y2 - y1, x2 - x1)}.`,
            }
        },
    },

    {
        id: 'alg1-slope-intercept',
        title: 'Slope-intercept equation',
        desc: 'Write y = mx + b from a slope and a point, or evaluate y at a given x.',
        generate() {
            const m = randNonZero(-4, 4)
            const b = randInt(-6, 6)
            if (choice([true, false])) {
                // Variant A: write the equation from slope + a point on the line.
                const x1 = randInt(-5, 5)
                const y1 = m * x1 + b
                const answer = `y=${polyLinear(m, b)}`
                return {
                    prompt: `Write the equation (y = mx + b) of the line with slope ${m} through (${x1}, ${y1}).`,
                    answer,
                    type: 'text',
                    accepted: [`y =${polyLinear(m, b)}`],
                    explanation: `b = y − mx = ${y1} − (${m})(${x1}) = ${b}, so the line is ${answer}.`,
                }
            }
            // Variant B: given the line, find y for a specific x.
            const x0 = randInt(-5, 5)
            const answer = m * x0 + b
            return {
                prompt: `For the line y = ${polyLinear(m, b)}, find y when x = ${x0}.`,
                answer,
                type: 'integer',
                explanation: `y = (${m})(${x0}) ${b >= 0 ? '+ ' + b : '− ' + Math.abs(b)} = ${answer}.`,
            }
        },
    },

    {
        id: 'alg1-systems',
        title: 'Systems of two equations',
        desc: 'Solve a 2×2 linear system for x, or give the (x, y) solution.',
        generate() {
            const x = randInt(-5, 5)
            const y = randInt(-5, 5)
            let a1 = randNonZero(-4, 4)
            let b1 = randNonZero(-4, 4)
            let a2 = randNonZero(-4, 4)
            let b2 = randNonZero(-4, 4)
            // Ensure a non-zero determinant so the solution is unique.
            while (a1 * b2 - a2 * b1 === 0) {
                a2 = randNonZero(-4, 4)
                b2 = randNonZero(-4, 4)
            }
            const c1 = a1 * x + b1 * y
            const c2 = a2 * x + b2 * y
            const eq1 = `${polyLinear(a1, 0)} ${b1 > 0 ? '+ ' + b1 : '− ' + Math.abs(b1)}y = ${c1}`
            const eq2 = `${polyLinear(a2, 0)} ${b2 > 0 ? '+ ' + b2 : '− ' + Math.abs(b2)}y = ${c2}`
            if (choice([true, false])) {
                return {
                    prompt: `Solve the system, then give x:\n  ${eq1}\n  ${eq2}`,
                    answer: x,
                    type: 'integer',
                    explanation: `The solution is x = ${x}, y = ${y}.`,
                }
            }
            return {
                prompt: `Solve the system; give the solution as (x, y):\n  ${eq1}\n  ${eq2}`,
                answer: `(${x},${y})`,
                type: 'text',
                accepted: [`${x},${y}`, `x=${x},y=${y}`],
                explanation: `Solving gives x = ${x} and y = ${y}, i.e. (${x}, ${y}).`,
            }
        },
    },

    {
        id: 'alg1-linear-inequality',
        title: 'Solve a linear inequality',
        desc: 'Solve a one-variable inequality; remember to flip the sign when dividing by a negative.',
        generate() {
            const s = randInt(-6, 6) // integer boundary value
            const a = randNonZero(-5, 5)
            const b = randInt(-6, 6)
            const c = a * s + b
            const op = choice(['<', '>', '<=', '>='])
            const flip = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }
            const finalOp = a < 0 ? flip[op] : op
            const disp = { '<': '<', '>': '>', '<=': '≤', '>=': '≥' }
            const answer = `x${finalOp}${s}`
            return {
                prompt: `Solve for x:  ${polyLinear(a, b)} ${disp[op]} ${c}`,
                answer,
                type: 'text',
                explanation: `${polyLinear(a, b)} ${disp[op]} ${c}  →  ${a}x ${disp[op]} ${c - b}  →  ${answer}${a < 0 ? '  (sign flipped: divided by a negative)' : ''}.`,
            }
        },
    },

    {
        id: 'alg1-combine-like-terms',
        title: 'Combine like terms',
        desc: 'Simplify a sum of linear expressions by combining like terms.',
        generate() {
            let a1 = randNonZero(-6, 6)
            let a2 = randNonZero(-6, 6)
            while (a1 + a2 === 0) a2 = randNonZero(-6, 6)
            const b1 = randInt(-8, 8)
            const b2 = randInt(-8, 8)
            const answer = polyLinear(a1 + a2, b1 + b2)
            return {
                prompt: `Simplify:  (${polyLinear(a1, b1)}) + (${polyLinear(a2, b2)})`,
                answer,
                type: 'text',
                explanation: `Combine x-terms (${a1} + ${a2} = ${a1 + a2}) and constants (${b1} + ${b2} = ${b1 + b2}) to get ${answer}.`,
            }
        },
    },

    {
        id: 'alg1-exponent-rules',
        title: 'Exponent rules',
        desc: 'Apply product, power, and quotient rules of exponents.',
        generate() {
            const rule = choice(['product', 'power', 'quotient'])
            if (choice([true, false])) {
                // Symbolic variant -> text answer like "x^7".
                const v = choice(['x', 'a', 'y', 'n'])
                let prompt
                let e
                if (rule === 'product') {
                    const m = randInt(2, 6)
                    const k = randInt(2, 6)
                    e = m + k
                    prompt = `Simplify:  ${v}^${m} · ${v}^${k}`
                } else if (rule === 'power') {
                    const m = randInt(2, 5)
                    const k = randInt(2, 4)
                    e = m * k
                    prompt = `Simplify:  (${v}^${m})^${k}`
                } else {
                    const k = randInt(2, 5)
                    const m = k + randInt(1, 5) // keep exponent positive
                    e = m - k
                    prompt = `Simplify:  ${v}^${m} / ${v}^${k}`
                }
                const answer = e === 0 ? '1' : e === 1 ? v : `${v}^${e}`
                return {
                    prompt,
                    answer,
                    type: 'text',
                    explanation: `Combine the exponents to get ${answer}.`,
                }
            }
            // Numeric variant -> integer answer.
            const base = choice([2, 3])
            let prompt
            let e
            if (rule === 'product') {
                const m = randInt(1, 3)
                const k = randInt(1, 3)
                e = m + k
                prompt = `Evaluate:  ${base}^${m} · ${base}^${k}`
            } else if (rule === 'power') {
                const m = randInt(1, 2)
                const k = randInt(2, 3)
                e = m * k
                prompt = `Evaluate:  (${base}^${m})^${k}`
            } else {
                const k = randInt(1, 3)
                const m = k + randInt(1, 3)
                e = m - k
                prompt = `Evaluate:  ${base}^${m} / ${base}^${k}`
            }
            const answer = base ** e
            return {
                prompt,
                answer,
                type: 'integer',
                explanation: `The result is ${base}^${e} = ${answer}.`,
            }
        },
    },

    {
        id: 'alg1-foil',
        title: 'Multiply binomials (FOIL)',
        desc: 'Expand a product of two binomials into a trinomial.',
        generate() {
            const p = randNonZero(-6, 6)
            const q = randNonZero(-6, 6)
            const B = p + q
            const C = p * q
            const answer = polyQuad(1, B, C)
            return {
                prompt: `Expand:  ${factorTerm(p)}${factorTerm(q)}`,
                answer,
                type: 'text',
                explanation: `FOIL: x·x + (${p} + ${q})x + (${p})(${q}) = ${answer}.`,
            }
        },
    },

    {
        id: 'alg1-factor-trinomial',
        title: 'Factor a trinomial',
        desc: 'Factor a monic trinomial x^2 + bx + c into two binomials.',
        generate() {
            const p = randNonZero(-6, 6)
            const q = randNonZero(-6, 6)
            const B = p + q
            const C = p * q
            const answer = `${factorTerm(p)}${factorTerm(q)}`
            return {
                prompt: `Factor:  ${polyQuad(1, B, C)}`,
                answer,
                type: 'text',
                accepted: [`${factorTerm(q)}${factorTerm(p)}`],
                explanation: `Find two numbers that multiply to ${C} and add to ${B}: ${p} and ${q}. So ${answer}.`,
            }
        },
    },

    {
        id: 'alg1-solve-quadratic',
        title: 'Solve a quadratic by factoring',
        desc: 'Find the two roots of a monic quadratic equation.',
        generate() {
            const r1 = randInt(-6, 6)
            let r2 = randInt(-6, 6)
            while (r2 === r1) r2 = randInt(-6, 6)
            const B = -(r1 + r2)
            const C = r1 * r2
            const answer = `${r1},${r2}`
            return {
                prompt: `Solve for x:  ${polyQuad(1, B, C)} = 0`,
                answer,
                type: 'text',
                accepted: [`${r2},${r1}`],
                explanation: `Factor as ${factorTerm(-r1)}${factorTerm(-r2)} = 0, so x = ${r1} or x = ${r2}.`,
            }
        },
    },

    {
        id: 'alg1-evaluate-function',
        title: 'Evaluate a function',
        desc: 'Evaluate a quadratic function f(x) at a given value.',
        generate() {
            const a = randNonZero(-3, 3)
            const b = randInt(-5, 5)
            const c = randInt(-5, 5)
            const x0 = randInt(-4, 4)
            const answer = a * x0 * x0 + b * x0 + c
            return {
                prompt: `If f(x) = ${polyQuad(a, b, c)}, find f(${x0}).`,
                answer,
                type: 'integer',
                explanation: `f(${x0}) = ${a}·(${x0})^2 + ${b}·(${x0}) + ${c} = ${answer}.`,
            }
        },
    },
]

export default skills

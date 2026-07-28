/**
 * College Algebra practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 * Prompts are plain text: powers use "^", fractions use "a/b", roots use "√".
 */

import {
    randInt,
    randNonZero,
    choice,
    reduceFraction,
    formatFraction,
    withSign,
    mcFrom,
} from './helpers.js'

// ---- small local formatting helpers ---------------------------------------

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

// A binomial factor "(m x + c)" -> "(2x-3)", "(x+5)", "(-x)".
const linFactor = (m, c) => {
    const mx = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`
    if (c === 0) return `(${mx})`
    return `(${mx}${c > 0 ? `+${c}` : `${c}`})`
}

// Format a complex number a+bi as clean text: "3+2i", "3-2i", "3+i", "-2i", "5".
const fmtComplex = (re, im) => {
    if (im === 0) return String(re)
    const mag = Math.abs(im) === 1 ? 'i' : `${Math.abs(im)}i`
    if (re === 0) return im < 0 ? `-${mag}` : mag
    return `${re}${im < 0 ? '-' : '+'}${mag}`
}

const skills = [
    // 1 -----------------------------------------------------------------------
    {
        id: 'calg-linear-equations',
        title: 'Linear equations & inequalities',
        desc: 'Solve a linear equation or inequality for x.',
        generate() {
            if (choice([true, false])) {
                // Equation variant: build one with a chosen integer/fraction solution.
                const [n, d] = reduceFraction(randNonZero(-8, 8), choice([1, 1, 1, 2, 3, 4]))
                const c = randNonZero(-5, 5)
                const k = randNonZero(-3, 3)
                let a = c + d * k
                if (a === 0) a = c + d * (k > 0 ? k + 1 : k - 1)
                const diff = a - c
                const b = randInt(-8, 8)
                const D = b + (diff * n) / d // integer, since diff is a multiple of d
                const answer = n / d
                return {
                    prompt: `Solve for x:  ${polyLinear(a, b)} = ${polyLinear(c, D)}`,
                    answer,
                    type: 'numeric',
                    tolerance: 0.02,
                    explanation: `Move x-terms left and constants right: (${a} − ${c})x = ${D} − ${b}.\nSimplify both sides: ${diff}x = ${D - b}.\nDivide by ${diff}: x = ${formatFraction(D - b, diff)}.`,
                }
            }
            // Inequality variant: solve a one-variable inequality (flip when a < 0).
            const s = randInt(-6, 6)
            const a = randNonZero(-5, 5)
            const b = randInt(-6, 6)
            const c = a * s + b
            const op = choice(['<', '>', '<=', '>='])
            const flip = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }
            const disp = { '<': '<', '>': '>', '<=': '≤', '>=': '≥' }
            const finalOp = a < 0 ? flip[op] : op
            const answer = `x${finalOp}${s}`
            return {
                prompt: `Solve for x:  ${polyLinear(a, b)} ${disp[op]} ${c}`,
                answer,
                type: 'text',
                explanation: `Subtract ${b} from both sides: ${a}x ${disp[op]} ${c - b}.\nDivide both sides by ${a}${a < 0 ? ', flipping the inequality since ' + a + ' is negative' : ''}.\nSo ${answer.replace(finalOp, disp[finalOp])}.`,
            }
        },
    },

    // 2 -----------------------------------------------------------------------
    {
        id: 'calg-forms-linear',
        title: 'Forms of linear equations',
        desc: 'Find the slope or y-intercept of a line given in standard form.',
        generate() {
            const a = randNonZero(-6, 6)
            const b = randNonZero(-6, 6)
            const c = randInt(-8, 8)
            if (choice([true, false])) {
                const answer = -a / b
                return {
                    prompt: `A line is given by  ${polyLinear(a, 0)} ${withSign(b, 'y')} = ${c}. Find its slope.`,
                    answer,
                    type: 'numeric',
                    tolerance: 0.02,
                    explanation: `Solve for y: ${b}y = ${-a}x + ${c}, so y = (${-a}/${b})x + ${formatFraction(c, b)}.\nThe slope is the coefficient of x: −a/b = ${-a}/${b}.\nSlope = ${formatFraction(-a, b)}.`,
                }
            }
            const answer = c / b
            return {
                prompt: `A line is given by  ${polyLinear(a, 0)} ${withSign(b, 'y')} = ${c}. Find its y-intercept (the y-value where x = 0).`,
                answer,
                type: 'numeric',
                tolerance: 0.02,
                explanation: `Set x = 0: ${b}y = ${c}.\nDivide by ${b}: y = ${c}/${b}.\ny-intercept = ${formatFraction(c, b)}.`,
            }
        },
    },

    // 3 -----------------------------------------------------------------------
    {
        id: 'calg-functions',
        title: 'Functions & composition',
        desc: 'Evaluate f(x), or a composition f(g(a)).',
        generate() {
            const m = randNonZero(-4, 4)
            const b = randInt(-6, 6)
            if (choice([true, false])) {
                const x0 = randInt(-5, 5)
                const answer = m * x0 + b
                return {
                    prompt: `If f(x) = ${polyLinear(m, b)}, find f(${x0}).`,
                    answer,
                    type: 'integer',
                    explanation: `Substitute x = ${x0}: f(${x0}) = (${m})(${x0}) ${b >= 0 ? '+ ' + b : '− ' + Math.abs(b)}.\nCompute: ${m * x0} ${b >= 0 ? '+ ' + b : '− ' + Math.abs(b)}.\nSo f(${x0}) = ${answer}.`,
                }
            }
            const p = randNonZero(-3, 3)
            const q = randInt(-5, 5)
            const a = randInt(-4, 4)
            const inner = p * a + q
            const answer = m * inner + b
            return {
                prompt: `If f(x) = ${polyLinear(m, b)} and g(x) = ${polyLinear(p, q)}, find f(g(${a})).`,
                answer,
                type: 'integer',
                explanation: `First g(${a}) = (${p})(${a}) ${q >= 0 ? '+ ' + q : '− ' + Math.abs(q)} = ${inner}.\nThen f(${inner}) = (${m})(${inner}) ${b >= 0 ? '+ ' + b : '− ' + Math.abs(b)}.\nSo f(g(${a})) = ${answer}.`,
            }
        },
    },

    // 4 -----------------------------------------------------------------------
    {
        id: 'calg-quadratics',
        title: 'Solve quadratics by factoring',
        desc: 'Solve a monic quadratic and give the larger root.',
        generate() {
            let r1 = randInt(-7, 7)
            let r2 = randInt(-7, 7)
            while (r2 === r1) r2 = randInt(-7, 7)
            const B = -(r1 + r2)
            const C = r1 * r2
            const answer = Math.max(r1, r2)
            const small = Math.min(r1, r2)
            return {
                prompt: `Solve for x:  ${polyQuad(1, B, C)} = 0. Enter the larger root.`,
                answer,
                type: 'integer',
                explanation: `Find two numbers with product ${C} and sum ${-B}: they are ${r1} and ${r2}.\nFactor: (x ${-r1 >= 0 ? '+ ' + -r1 : '− ' + r1})(x ${-r2 >= 0 ? '+ ' + -r2 : '− ' + r2}) = 0.\nThe roots are ${small} and ${answer}.\nThe larger root is ${answer}.`,
            }
        },
    },

    // 5 -----------------------------------------------------------------------
    {
        id: 'calg-complex-numbers',
        title: 'Complex number arithmetic',
        desc: 'Add or multiply complex numbers; give the requested real or imaginary part.',
        generate() {
            const a = randNonZero(-6, 6)
            const b = randNonZero(-6, 6)
            const c = randNonZero(-6, 6)
            const d = randNonZero(-6, 6)
            const op = choice(['+', '×'])
            let re
            let im
            let work
            if (op === '+') {
                re = a + c
                im = b + d
                work = `Add real parts (${a} + ${c} = ${re}) and imaginary parts (${b} + ${d} = ${im}).`
            } else {
                re = a * c - b * d
                im = a * d + b * c
                work = `FOIL and use i² = −1: real part = ${a}·${c} − ${b}·${d} = ${re}; imaginary part = ${a}·${d} + ${b}·${c} = ${im}.`
            }
            const wantReal = choice([true, false])
            const answer = wantReal ? re : im
            const part = wantReal ? 'real part' : 'imaginary part (the coefficient of i)'
            return {
                prompt: `Compute (${fmtComplex(a, b)}) ${op} (${fmtComplex(c, d)}) = ${fmtComplex(re, im)}. What is the ${part} of the result?`,
                answer,
                type: 'integer',
                explanation: `${work}\nThe product/sum is ${fmtComplex(re, im)}.\nThe ${part} is ${answer}.`,
            }
        },
    },

    // 6 -----------------------------------------------------------------------
    {
        id: 'calg-exponents-radicals',
        title: 'Exponents & radicals',
        desc: 'Simplify a radical or evaluate a power/root.',
        generate() {
            const kind = choice(['radical', 'perfect', 'power'])
            if (kind === 'radical') {
                const outside = randInt(2, 6)
                const inside = choice([2, 3, 5, 6, 7, 10, 11])
                const n = outside * outside * inside
                const answer = `${outside}√${inside}`
                return {
                    prompt: `Simplify:  √${n}`,
                    answer,
                    type: 'text',
                    accepted: [`${outside}sqrt${inside}`],
                    explanation: `Largest perfect-square factor of ${n}: ${n} = ${outside * outside}·${inside}.\nSplit the root: √${n} = √${outside * outside}·√${inside}.\nTake √${outside * outside} = ${outside} outside: ${answer}.`,
                }
            }
            if (kind === 'perfect') {
                const k = randInt(4, 15)
                const n = k * k
                return {
                    prompt: `Evaluate:  √${n}`,
                    answer: k,
                    type: 'integer',
                    explanation: `Look for a whole number whose square is ${n}.\n${k}² = ${n}.\nSo √${n} = ${k}.`,
                }
            }
            const base = choice([2, 3, 4, 5])
            const e = randInt(2, base === 2 ? 6 : 4)
            const answer = base ** e
            return {
                prompt: `Evaluate:  ${base}^${e}`,
                answer,
                type: 'integer',
                explanation: `${base}^${e} means multiply ${base} by itself ${e} times.\n${Array(e).fill(base).join(' · ')}.\n= ${answer}.`,
            }
        },
    },

    // 7 -----------------------------------------------------------------------
    {
        id: 'calg-rational-expressions',
        title: 'Rational expressions',
        desc: 'Simplify a rational expression, then evaluate it at a point.',
        generate() {
            if (choice([true, false])) {
                // Difference of squares: (x² − a²)/(x − a) = x + a.
                const a = randNonZero(-6, 6)
                let x0 = randInt(-6, 6)
                while (x0 === a) x0 = randInt(-6, 6)
                const answer = x0 + a
                return {
                    prompt: `Simplify  (x^2 − ${a * a})/(x − ${a})  and evaluate it at x = ${x0}.`,
                    answer,
                    type: 'numeric',
                    tolerance: 0.02,
                    explanation: `Factor the numerator: x² − ${a * a} = (x − ${a})(x + ${a}).\nCancel (x − ${a}): the expression simplifies to x + ${a}.\nAt x = ${x0}: ${x0} + ${a} = ${answer}.`,
                }
            }
            // Factor & cancel: (x + p)(x + q)/(x + q) = x + p.
            const p = randNonZero(-6, 6)
            let q = randNonZero(-6, 6)
            while (q === p) q = randNonZero(-6, 6)
            let x0 = randInt(-6, 6)
            while (x0 === -q) x0 = randInt(-6, 6)
            const B = p + q
            const C = p * q
            const answer = x0 + p
            return {
                prompt: `Simplify  (${polyQuad(1, B, C)})/(x ${q > 0 ? '+ ' + q : '− ' + Math.abs(q)})  and evaluate it at x = ${x0}.`,
                answer,
                type: 'numeric',
                tolerance: 0.02,
                explanation: `Factor the numerator: ${polyQuad(1, B, C)} = ${linFactor(1, p)}${linFactor(1, q)}.\nCancel (x ${q > 0 ? '+ ' + q : '− ' + Math.abs(q)}): the expression simplifies to x ${p > 0 ? '+ ' + p : '− ' + Math.abs(p)}.\nAt x = ${x0}: ${x0} ${p > 0 ? '+ ' + p : '− ' + Math.abs(p)} = ${answer}.`,
            }
        },
    },

    // 8 -----------------------------------------------------------------------
    {
        id: 'calg-polynomial-arithmetic',
        title: 'Polynomial arithmetic',
        desc: 'Multiply binomials and identify a requested coefficient.',
        generate() {
            const a = randNonZero(-4, 4)
            const b = randNonZero(-5, 5)
            const c = randNonZero(-4, 4)
            const d = randNonZero(-5, 5)
            const A2 = a * c // x^2 coefficient
            const A1 = a * d + b * c // x coefficient
            const A0 = b * d // constant
            const which = choice(['x^2', 'x', 'constant'])
            const answer = which === 'x^2' ? A2 : which === 'x' ? A1 : A0
            const label = which === 'x^2' ? 'the coefficient of x^2' : which === 'x' ? 'the coefficient of x' : 'the constant term'
            return {
                prompt: `Expand  ${linFactor(a, b)}${linFactor(c, d)}  and give ${label}.`,
                answer,
                type: 'integer',
                explanation: `Multiply out (FOIL): ${polyQuad(A2, A1, A0)}.\nx²-coeff = ${a}·${c} = ${A2}; x-coeff = ${a}·${d} + ${b}·${c} = ${A1}; constant = ${b}·${d} = ${A0}.\nSo ${label} is ${answer}.`,
            }
        },
    },

    // 9 -----------------------------------------------------------------------
    {
        id: 'calg-logarithms',
        title: 'Evaluate logarithms',
        desc: 'Evaluate log_b(x) for exact whole-number results.',
        generate() {
            const base = randInt(2, 5)
            const k = randInt(2, 4)
            const x = base ** k
            if (choice([true, false])) {
                return {
                    prompt: `Evaluate  log_${base}(${x}).`,
                    answer: k,
                    type: 'integer',
                    explanation: `log_${base}(${x}) asks: ${base} to what power gives ${x}?\n${base}^${k} = ${x}.\nSo log_${base}(${x}) = ${k}.`,
                }
            }
            // Negative-exponent variant with a reciprocal argument.
            return {
                prompt: `Evaluate  log_${base}(1/${x}).`,
                answer: -k,
                type: 'integer',
                explanation: `1/${x} = ${base}^(−${k}), since ${base}^${k} = ${x}.\nlog_${base}(${base}^(−${k})) = −${k}.\nSo log_${base}(1/${x}) = ${-k}.`,
            }
        },
    },

    // 10 ----------------------------------------------------------------------
    {
        id: 'calg-transformations',
        title: 'Function transformations',
        desc: 'Describe a shift of y = x^2, or give the new vertex.',
        generate() {
            const h = randInt(1, 6)
            const k = randNonZero(-6, 6)
            if (choice([true, false])) {
                // Horizontal-shift description as multiple choice.
                const dir = choice(['right', 'left'])
                const hExpr = dir === 'right' ? `(x − ${h})^2` : `(x + ${h})^2`
                const correct = `${dir} ${h} units`
                const { choices, answer } = mcFrom(correct, [
                    `${dir === 'right' ? 'left' : 'right'} ${h} units`,
                    `up ${h} units`,
                    `down ${h} units`,
                ])
                return {
                    prompt: `The graph of  y = ${hExpr}  is the graph of y = x^2 shifted how?`,
                    answer,
                    type: 'choice',
                    choices,
                    explanation: `Replacing x with (x − c) shifts the graph right by c; (x + c) shifts left by c.\nHere the form is ${hExpr}, a horizontal shift.\nSo the graph moves ${correct}.`,
                }
            }
            // New vertex after a shift: y = (x − h)^2 + k.
            const answer = `(${h},${k})`
            return {
                prompt: `The graph of y = x^2 is shifted right ${h} and ${k >= 0 ? 'up ' + k : 'down ' + Math.abs(k)}, giving y = (x − ${h})^2 ${k >= 0 ? '+ ' + k : '− ' + Math.abs(k)}. Give the new vertex as (h, k).`,
                answer,
                type: 'text',
                accepted: [`${h},${k}`],
                explanation: `A shift right ${h} moves the vertex x-coordinate to ${h}.\nA shift ${k >= 0 ? 'up ' + k : 'down ' + Math.abs(k)} moves the y-coordinate to ${k}.\nSo the new vertex is (${h}, ${k}).`,
            }
        },
    },
]

export default skills

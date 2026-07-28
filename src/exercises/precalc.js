/**
 * Problem generators for the Precalculus practice band.
 *
 * Each skill is { id, title, desc, generate() -> Problem }. Every generate()
 * returns a self-consistent problem: the shared checkAnswer accepts
 * String(problem.answer). Randomness happens only inside generate().
 *
 * Prompts are plain text only (no ^ √ π × HTML-ish symbols): powers are written
 * "to the power k", roots as "sqrt(...)", and multiplication as "*".
 */

import { randInt, randNonZero, choice, round, mcFrom } from './helpers.js'

const DEG = Math.PI / 180

// Binomial coefficient n-choose-k as an exact integer.
const nCr = (n, k) => {
    let r = 1
    for (let i = 0; i < k; i++) {
        r = (r * (n - i)) / (i + 1)
    }
    return Math.round(r)
}

// Format a linear expression a*x + b as plain text, e.g. "2x - 3".
const linear = (a, b) => {
    const ax = a === 1 ? 'x' : a === -1 ? '-x' : `${a}x`
    if (b === 0) return ax
    return `${ax} ${b < 0 ? '-' : '+'} ${Math.abs(b)}`
}

// 1. Function composition: compute f(g(a)) at a point.
const composition = {
    id: 'pcalc-composition',
    title: 'Function composition',
    desc: 'Evaluate f(g(a)) for two linear functions.',
    generate() {
        const a = randNonZero(-3, 4)
        const b = randInt(-5, 5)
        const c = randNonZero(-3, 4)
        const d = randInt(-5, 5)
        const p = randInt(-4, 4)
        const inner = c * p + d
        const value = a * inner + b
        return {
            prompt: `Let f(x) = ${linear(a, b)} and g(x) = ${linear(c, d)}. Find f(g(${p})).`,
            answer: value,
            type: 'integer',
            explanation: `Evaluate the inner function first: g(${p}) = ${c}*${p} + ${d} = ${inner}.\nApply f to that result: f(${inner}) = ${a}*${inner} + ${b} = ${value}.\nSo f(g(${p})) = ${value}.`,
        }
    },
}

// 2. Inverse function: solve f(x) = value for a linear f.
const inverse = {
    id: 'pcalc-inverse',
    title: 'Inverse function value',
    desc: 'Find the input that a linear function maps to a given output.',
    generate() {
        const a = randNonZero(2, 5)
        const b = randInt(-6, 6)
        const value = randInt(-15, 25)
        const x = round((value - b) / a, 2)
        return {
            prompt: `For f(x) = ${linear(a, b)}, find the value of x with f(x) = ${value} (that is, f-inverse(${value})). Round to 2 decimal places.`,
            answer: x,
            type: 'numeric',
            tolerance: 0.01,
            explanation: `Set the output equal to ${value}: ${a}x + ${b} = ${value}.\nIsolate x: x = (${value} - ${b}) / ${a}.\nSo x = ${x}.`,
        }
    },
}

// 3. Polynomial end behavior from degree + leading-coefficient sign.
const endBehavior = {
    id: 'pcalc-end-behavior',
    title: 'Polynomial end behavior',
    desc: 'Describe the end behavior from the degree and leading coefficient.',
    generate() {
        const degree = choice([2, 3, 4, 5, 6])
        const lead = randNonZero(-4, 4)
        const even = degree % 2 === 0
        const positive = lead > 0
        let correct
        if (even) correct = positive ? 'up and up' : 'down and down'
        else correct = positive ? 'down and up' : 'up and down'
        const { choices, answer } = mcFrom(correct, [
            'up and up',
            'down and down',
            'down and up',
            'up and down',
        ])
        return {
            prompt:
                `A polynomial has degree ${degree} and a ${positive ? 'positive' : 'negative'} leading coefficient. ` +
                `Describe its end behavior as (left side, right side).`,
            answer,
            type: 'choice',
            choices,
            explanation: `Degree ${degree} is ${even ? 'even, so both ends point the same way' : 'odd, so the ends point opposite ways'}.\nThe leading coefficient is ${positive ? 'positive' : 'negative'}, so the right end goes ${positive ? 'up' : 'down'}.\nSo the end behavior (left, right) is ${correct}.`,
        }
    },
}

// 4. Rational function domain: the excluded x-value.
const rationalDomain = {
    id: 'pcalc-rational-domain',
    title: 'Rational function domain',
    desc: 'Find the x-value excluded from the domain.',
    generate() {
        const a = randNonZero(1, 4)
        const c = randNonZero(-9, 9)   // non-zero so the denominator isn't "ax + 0"
        const num = randInt(1, 9)
        const excluded = round(c / a, 2)
        const denom = a === 1 ? `x ${c <= 0 ? '+' : '-'} ${Math.abs(c)}` : `${a}x ${c <= 0 ? '+' : '-'} ${Math.abs(c)}`
        return {
            prompt: `What x-value is excluded from the domain of f(x) = ${num} / (${denom})? Round to 2 decimal places if needed.`,
            answer: excluded,
            type: 'numeric',
            tolerance: 0.01,
            explanation: `A rational function is undefined where its denominator is 0.\nSolve ${denom} = 0: x = ${c} / ${a} = ${excluded}.\nSo x = ${excluded} is excluded from the domain.`,
        }
    },
}

// 5. Solve an exponential or logarithmic equation.
const expLog = {
    id: 'pcalc-exp-log',
    title: 'Exponential & log equations',
    desc: 'Solve a basic exponential or logarithmic equation.',
    generate() {
        const base = choice([2, 3, 5])
        const k = randInt(2, 4)
        const value = base ** k
        if (choice([true, false])) {
            return {
                prompt: `Solve for x: ${base} to the power x = ${value}.`,
                answer: k,
                type: 'numeric',
                tolerance: 0.001,
                explanation: `Write ${value} as a power of the base ${base}.\nSince ${base} to the power ${k} = ${value}, the exponents must match.\nSo x = ${k}.`,
            }
        }
        return {
            prompt: `Solve for x: log base ${base} of ${value} = x.`,
            answer: k,
            type: 'numeric',
            tolerance: 0.001,
            explanation: `A logarithm asks: ${base} to what power gives ${value}?\nSince ${base} to the power ${k} = ${value}, that power is ${k}.\nSo log base ${base} of ${value} = x = ${k}.`,
        }
    },
}

// 6. Trig identity evaluation.
const trigIdentity = {
    id: 'pcalc-trig-identity',
    title: 'Trig identity evaluation',
    desc: 'Use an identity to simplify, then evaluate.',
    generate() {
        const kind = choice(['pythag', 'secTan', 'cofunction', 'double'])
        const a = randInt(15, 75)
        if (kind === 'pythag') {
            return {
                prompt: `Use an identity to evaluate: sin(${a} deg)*sin(${a} deg) + cos(${a} deg)*cos(${a} deg).`,
                answer: 1,
                type: 'numeric',
                tolerance: 0.001,
                explanation: `Apply the Pythagorean identity sin(t)*sin(t) + cos(t)*cos(t) = 1.\nThis holds for every angle, including t = ${a} deg.\nSo the value is 1.`,
            }
        }
        if (kind === 'secTan') {
            return {
                prompt: `Use an identity to evaluate: sec(${a} deg)*sec(${a} deg) - tan(${a} deg)*tan(${a} deg).`,
                answer: 1,
                type: 'numeric',
                tolerance: 0.001,
                explanation: `Apply the identity sec(t)*sec(t) - tan(t)*tan(t) = 1.\nThis holds for every angle, including t = ${a} deg.\nSo the value is 1.`,
            }
        }
        if (kind === 'cofunction') {
            return {
                prompt: `By the cofunction identity, sin(${a} deg) = cos(x deg) for which x between 0 and 90?`,
                answer: 90 - a,
                type: 'numeric',
                tolerance: 0.001,
                explanation: `Use the cofunction identity sin(t) = cos(90 - t).\nSo cos(x deg) = sin(${a} deg) = cos(90 - ${a} deg).\nMatching angles: x = 90 - ${a} = ${90 - a}.`,
            }
        }
        // double-angle: 2 sin(t) cos(t) = sin(2t)
        const val = round(Math.sin(2 * a * DEG), 2)
        return {
            prompt: `Using 2 sin(t) cos(t) = sin(2t), evaluate 2 sin(${a} deg) cos(${a} deg). Round to 2 decimal places.`,
            answer: val,
            type: 'numeric',
            tolerance: 0.01,
            explanation: `Apply the double-angle identity 2 sin(t) cos(t) = sin(2t).\nWith t = ${a} deg: 2 sin(${a} deg) cos(${a} deg) = sin(${2 * a} deg).\nSo the value is ${val}.`,
        }
    },
}

// 7. Vectors: magnitude or dot product.
const vectors = {
    id: 'pcalc-vectors',
    title: 'Vector magnitude & dot product',
    desc: 'Find the magnitude of a vector or the dot product of two.',
    generate() {
        const a = randNonZero(-8, 8)
        const b = randNonZero(-8, 8)
        if (choice([true, false])) {
            const mag = round(Math.sqrt(a * a + b * b), 2)
            return {
                prompt: `Find the magnitude of the vector <${a}, ${b}>. Round to 2 decimal places.`,
                answer: mag,
                type: 'numeric',
                tolerance: 0.01,
                explanation: `Magnitude uses |<x, y>| = sqrt(x^2 + y^2).\nSubstitute: sqrt(${a}*${a} + ${b}*${b}) = sqrt(${a * a + b * b}).\nSo the magnitude is ${mag}.`,
            }
        }
        const c = randNonZero(-8, 8)
        const d = randNonZero(-8, 8)
        const dot = a * c + b * d
        return {
            prompt: `Find the dot product of <${a}, ${b}> and <${c}, ${d}>.`,
            answer: dot,
            type: 'integer',
            explanation: `Dot product = (x1)(x2) + (y1)(y2).\nSubstitute: (${a})(${c}) + (${b})(${d}) = ${a * c} + ${b * d}.\nSo the dot product is ${dot}.`,
        }
    },
}

// 8. 2x2 matrix: determinant or a product entry.
const matrix = {
    id: 'pcalc-matrix',
    title: '2x2 matrices',
    desc: 'Compute a determinant or an entry of a matrix product.',
    generate() {
        const a = randNonZero(-6, 6)
        const b = randInt(-6, 6)
        const c = randInt(-6, 6)
        const d = randNonZero(-6, 6)
        if (choice([true, false])) {
            const det = a * d - b * c
            return {
                prompt: `Find the determinant of the matrix [[${a}, ${b}], [${c}, ${d}]].`,
                answer: det,
                type: 'integer',
                explanation: `Determinant of [[a, b], [c, d]] is a*d - b*c.\nSubstitute: (${a})(${d}) - (${b})(${c}) = ${a * d} - ${b * c}.\nSo the determinant is ${det}.`,
            }
        }
        const e = randInt(-6, 6)
        const g = randInt(-6, 6)
        const entry = a * e + b * g
        return {
            prompt:
                `Let A = [[${a}, ${b}], [${c}, ${d}]] and B = [[${e}, ?], [${g}, ?]]. ` +
                `Find the top-left entry of the product A*B.`,
            answer: entry,
            type: 'integer',
            explanation: `The top-left entry of A*B is (row 1 of A) dot (column 1 of B).\nSubstitute: (${a})(${e}) + (${b})(${g}) = ${a * e} + ${b * g}.\nSo the top-left entry is ${entry}.`,
        }
    },
}

// 9. Finite geometric series sum.
const geometricSum = {
    id: 'pcalc-geometric-sum',
    title: 'Finite geometric series',
    desc: 'Sum the first n terms of a geometric series.',
    generate() {
        const first = randInt(1, 6)
        const r = choice([2, 3, 0.5])
        const n = randInt(3, 6)
        const sum = round((first * (1 - r ** n)) / (1 - r), 2)
        return {
            prompt: `Find the sum of the first ${n} terms of a geometric series with first term ${first} and common ratio ${r}. Round to 2 decimal places.`,
            answer: sum,
            type: 'numeric',
            tolerance: 0.01,
            explanation: `Use the finite geometric sum S = a*(1 - r^n)/(1 - r).\nSubstitute a = ${first}, r = ${r}, n = ${n}: ${first}*(1 - ${r}^${n})/(1 - ${r}).\nSo the sum is ${sum}.`,
        }
    },
}

// 10. Binomial theorem: coefficient of a specific term.
const binomial = {
    id: 'pcalc-binomial',
    title: 'Binomial theorem coefficient',
    desc: 'Find the coefficient of a term in a binomial expansion.',
    generate() {
        const n = randInt(4, 8)
        const k = randInt(1, n - 1)
        const coef = nCr(n, k)
        return {
            prompt: `In the expansion of (x + y) to the power ${n}, what is the coefficient of the term x to the power ${n - k} times y to the power ${k}?`,
            answer: coef,
            type: 'integer',
            explanation: `In (x + y)^${n}, the term x^${n - k} y^${k} comes from choosing ${k} y's.\nIts coefficient is the binomial coefficient ${n}-choose-${k}.\nSo the coefficient is ${coef}.`,
        }
    },
}

// 11. Polar / rectangular conversion.
const polar = {
    id: 'pcalc-polar',
    title: 'Polar & rectangular',
    desc: 'Convert between polar and rectangular coordinates.',
    generate() {
        if (choice([true, false])) {
            const x = randNonZero(-8, 8)
            const y = randNonZero(-8, 8)
            const r = round(Math.sqrt(x * x + y * y), 2)
            return {
                prompt: `Find r for the rectangular point (${x}, ${y}) in polar form. Round to 2 decimal places.`,
                answer: r,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Convert with r = sqrt(x^2 + y^2).\nSubstitute: sqrt(${x}*${x} + ${y}*${y}) = sqrt(${x * x + y * y}).\nSo r = ${r}.`,
            }
        }
        const r = randInt(2, 9)
        const theta = choice([30, 45, 60, 120, 135, 150])
        const x = round(r * Math.cos(theta * DEG), 2)
        return {
            prompt: `A point has polar coordinates r = ${r}, theta = ${theta} deg. Find its rectangular x-coordinate. Round to 2 decimal places.`,
            answer: x,
            type: 'numeric',
            tolerance: 0.05,
            explanation: `Convert with x = r*cos(theta).\nSubstitute: ${r}*cos(${theta} deg).\nSo x = ${x}.`,
        }
    },
}

export default [
    {
        id: 'pcalc-average-rate-of-change',
        title: 'Average rate of change',
        desc: 'Compute the average rate of change of a function over an interval.',
        generate() {
            const k = randInt(-4, 4)
            const p = randInt(-4, 3)
            const q = p + randInt(1, 4)
            const f = (x) => x * x + k * x
            const answer = round((f(q) - f(p)) / (q - p), 2)
            const kx = k === 0 ? '' : (k > 0 ? `+${k}x` : `${k}x`)
            return {
                prompt: `Find the average rate of change of f(x) = x^2${kx} on [${p}, ${q}].`,
                answer,
                type: 'numeric',
                tolerance: 0.02,
                explanation: `Average rate of change = (f(${q}) − f(${p})) / (${q} − ${p}).\nSubstitute: (${f(q)} − ${f(p)}) / ${q - p}.\nSo the average rate of change is ${answer}.`,
            }
        },
    },

    {
        id: 'pcalc-summation',
        title: 'Evaluate a summation',
        desc: 'Evaluate a finite sum written in sigma notation.',
        generate() {
            const n = randInt(3, 8)
            if (choice(['linear', 'squares']) === 'squares') {
                const answer = (n * (n + 1) * (2 * n + 1)) / 6
                return {
                    prompt: `Evaluate:  Σ (i=1 to ${n}) of i^2`,
                    answer,
                    type: 'integer',
                    explanation: `Use the sum-of-squares formula Σi² = n(n+1)(2n+1)/6.\nSubstitute n = ${n}: ${n}(${n}+1)(2·${n}+1)/6.\nSo the sum is ${answer}.`,
                }
            }
            const a = randInt(1, 4)
            const b = randInt(0, 5)
            const answer = a * ((n * (n + 1)) / 2) + b * n
            const inner = `${a === 1 ? '' : a}i${b ? `+${b}` : ''}`
            return {
                prompt: `Evaluate:  Σ (i=1 to ${n}) of ${inner}`,
                answer,
                type: 'integer',
                explanation: `Split the sum: Σ(${a}i + ${b}) = ${a}·Σi + ${b}·${n}.\nSubstitute Σi = ${(n * (n + 1)) / 2}: ${a}·${(n * (n + 1)) / 2} + ${b * n}.\nSo the sum is ${answer}.`,
            }
        },
    },

    composition,
    inverse,
    endBehavior,
    rationalDomain,
    expLog,
    trigIdentity,
    vectors,
    matrix,
    geometricSum,
    binomial,
    polar,
]

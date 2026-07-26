/**
 * Algebra 2 / Trigonometry practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 * Prompts are plain text and may use ^ √ π ×.
 */

import { randInt, randNonZero, choice, gcd, formatFraction, round } from './helpers.js'

// ---- small local formatting helpers ---------------------------------------

// Format a complex number a+bi as clean text: "3+2i", "3-2i", "3+i", "-2i", "5".
const fmtComplex = (re, im) => {
    if (im === 0) return String(re)
    const mag = Math.abs(im) === 1 ? 'i' : `${Math.abs(im)}i`
    if (re === 0) return im < 0 ? `-${mag}` : mag
    return `${re}${im < 0 ? '-' : '+'}${mag}`
}

// Return the terminating decimal string for num/den, or null if it doesn't terminate.
const terminatingDecimal = (num, den) => {
    const g = gcd(num, den)
    const rn = num / g
    let rd = den / g
    while (rd % 2 === 0) rd /= 2
    while (rd % 5 === 0) rd /= 5
    return rd === 1 ? String(rn / (den / g)) : null
}

// Accepted decimal string forms for an exact numeric value (2/3/4 dp), de-duplicated.
const decimalForms = (v) => {
    if (v == null || !Number.isFinite(v)) return []
    return [...new Set([round(v, 2), round(v, 3), round(v, 4)].map(String))]
}

// Build the display / "pi"-spelled forms of a fraction n/d of π, e.g. 30° -> "π/6".
const radFraction = (deg) => {
    const g = gcd(deg, 180)
    const n = deg / g
    const d = 180 / g
    const build = (sym) => {
        if (d === 1) return n === 1 ? sym : `${n}${sym}`
        return n === 1 ? `${sym}/${d}` : `${n}${sym}/${d}`
    }
    return { display: build('π'), pi: build('pi') }
}

// Condensed-log answer + accepted variants for log_base(value).
const logForms = (base, value) => ({
    answer: `log_${base}(${value})`,
    accepted: [`log_${base}${value}`, `log${base}(${value})`, `log${base}${value}`],
})

// Ordinal suffix for a positive integer, e.g. 1 -> "1st", 11 -> "11th", 23 -> "23rd".
const ordinal = (n) => {
    const t = n % 100
    if (t >= 11 && t <= 13) return `${n}th`
    return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`
}

const DEG2RAD = Math.PI / 180

const skills = [
    {
        id: 'alg2-parabola-vertex',
        title: 'Vertex of a parabola',
        desc: 'Find the vertex (h, k) of a quadratic in standard form.',
        generate() {
            const h = randInt(-5, 5)
            const b = -2 * h
            const c = randInt(-6, 6)
            const k = c - h * h
            const bx = b === 0 ? '' : (b > 0 ? `+${b}x` : `${b}x`)
            const cc = c === 0 ? '' : (c > 0 ? `+${c}` : `${c}`)
            const answer = `(${h},${k})`
            return {
                prompt: `Find the vertex of  y = x^2${bx}${cc}.`,
                answer,
                type: 'text',
                accepted: [`${h},${k}`],
                explanation: `h = −b/2a = ${h}; k = ${k}. Vertex (${h}, ${k}).`,
            }
        },
    },

    {
        id: 'alg2-complex-modulus',
        title: 'Modulus of a complex number',
        desc: 'Find the modulus |a + bi| using a Pythagorean triple.',
        generate() {
            const triples = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25]]
            const [a0, b0, c] = choice(triples)
            const a = choice([1, -1]) * a0
            const b = choice([1, -1]) * b0
            return {
                prompt: `Find the modulus:  |${a} ${b >= 0 ? '+' : '−'} ${Math.abs(b)}i|`,
                answer: c,
                type: 'integer',
                explanation: `|a+bi| = √(a²+b²) = √(${a * a}+${b * b}) = √${a * a + b * b} = ${c}.`,
            }
        },
    },

    // 1 -----------------------------------------------------------------------
    {
        id: 'alg2-quadratic-formula',
        title: 'Quadratic formula (real roots)',
        desc: 'Find both real roots of a quadratic with rational solutions.',
        generate() {
            let r1 = randInt(-6, 6)
            let r2 = randInt(-6, 6)
            while (r2 === r1) r2 = randInt(-6, 6)
            if (r1 > r2) [r1, r2] = [r2, r1]
            const b = -(r1 + r2)
            const c = r1 * r2
            let poly = 'x^2'
            if (b !== 0) poly += ` ${b < 0 ? '−' : '+'} ${Math.abs(b)}x`
            if (c !== 0) poly += ` ${c < 0 ? '−' : '+'} ${Math.abs(c)}`
            return {
                prompt: `Find the real roots of ${poly} = 0. Enter both roots separated by a comma.`,
                answer: `${r1},${r2}`,
                type: 'text',
                accepted: [`${r2},${r1}`],
                explanation: `${poly} factors as (x − ${r1})(x − ${r2}), so the roots are x = ${r1} and x = ${r2}.`,
            }
        },
    },

    // 2 -----------------------------------------------------------------------
    {
        id: 'alg2-complex-arithmetic',
        title: 'Complex number arithmetic',
        desc: 'Add, subtract, or multiply two complex numbers.',
        generate() {
            const a = randNonZero(-6, 6)
            const b = randNonZero(-6, 6)
            const c = randNonZero(-6, 6)
            const d = randNonZero(-6, 6)
            const op = choice(['+', '−', '×'])
            let re
            let im
            if (op === '+') { re = a + c; im = b + d }
            else if (op === '−') { re = a - c; im = b - d }
            else { re = a * c - b * d; im = a * d + b * c }
            const answer = fmtComplex(re, im)
            const accepted = []
            if (re !== 0 && im !== 0) {
                accepted.push(`${re}${im < 0 ? '-' : '+'}${Math.abs(im)}i`)
            }
            return {
                prompt: `Simplify: (${fmtComplex(a, b)}) ${op} (${fmtComplex(c, d)}). Write your answer in the form a+bi.`,
                answer,
                type: 'text',
                accepted,
                explanation: `Combine like terms (using i² = −1 for products) to get ${answer}.`,
            }
        },
    },

    // 3 -----------------------------------------------------------------------
    {
        id: 'alg2-evaluate-log',
        title: 'Evaluate a logarithm',
        desc: 'Evaluate log_b(x) where the result is a whole number.',
        generate() {
            const base = randInt(2, 5)
            const k = randInt(2, 4)
            const x = base ** k
            return {
                prompt: `Evaluate log_${base}(${x}).`,
                answer: k,
                type: 'integer',
                explanation: `${base}^${k} = ${x}, so log_${base}(${x}) = ${k}.`,
            }
        },
    },

    // 4 -----------------------------------------------------------------------
    {
        id: 'alg2-solve-exponential',
        title: 'Solve an exponential equation',
        desc: 'Solve b^x = value for the integer exponent x.',
        generate() {
            const base = randInt(2, 5)
            const x = randInt(2, 4)
            const value = base ** x
            return {
                prompt: `Solve for x:  ${base}^x = ${value}.`,
                answer: x,
                type: 'integer',
                explanation: `${base}^${x} = ${value}, so x = ${x}.`,
            }
        },
    },

    // 5 -----------------------------------------------------------------------
    {
        id: 'alg2-log-properties',
        title: 'Properties of logarithms',
        desc: 'Condense or expand a logarithmic expression.',
        generate() {
            const base = randInt(2, 6)
            const kind = choice(['sum', 'diff', 'power'])
            if (kind === 'sum') {
                const m = randInt(2, 9)
                const n = randInt(2, 9)
                const { answer, accepted } = logForms(base, m * n)
                return {
                    prompt: `Condense to a single logarithm: log_${base}(${m}) + log_${base}(${n}).`,
                    answer,
                    type: 'text',
                    accepted,
                    explanation: `log_${base}(m) + log_${base}(n) = log_${base}(m·n) = log_${base}(${m * n}).`,
                }
            }
            if (kind === 'diff') {
                const q = randInt(2, 6)
                const dv = randInt(2, 6)
                const m = q * dv
                const { answer, accepted } = logForms(base, q)
                return {
                    prompt: `Condense to a single logarithm: log_${base}(${m}) − log_${base}(${dv}).`,
                    answer,
                    type: 'text',
                    accepted,
                    explanation: `log_${base}(${m}) − log_${base}(${dv}) = log_${base}(${m}/${dv}) = log_${base}(${q}).`,
                }
            }
            const x = randInt(2, 7)
            const k = randInt(2, 4)
            const answer = `${k}log_${base}(${x})`
            const accepted = [
                `${k}*log_${base}(${x})`,
                `${k}log_${base}${x}`,
                `${k}*log_${base}${x}`,
                `${k}log${base}(${x})`,
                `${k}log${base}${x}`,
            ]
            return {
                prompt: `Expand using the power rule: log_${base}(${x}^${k}).`,
                answer,
                type: 'text',
                accepted,
                explanation: `log_${base}(x^k) = k·log_${base}(x), so log_${base}(${x}^${k}) = ${k}log_${base}(${x}).`,
            }
        },
    },

    // 6 -----------------------------------------------------------------------
    {
        id: 'alg2-arithmetic-sequence',
        title: 'Arithmetic sequence: nth term',
        desc: 'Find the nth term given the first term and common difference.',
        generate() {
            const a1 = randInt(-8, 12)
            const dd = randNonZero(-6, 6)
            const n = randInt(5, 15)
            const answer = a1 + (n - 1) * dd
            return {
                prompt: `An arithmetic sequence has first term a₁ = ${a1} and common difference d = ${dd}. Find the ${ordinal(n)} term.`,
                answer,
                type: 'integer',
                explanation: `aₙ = a₁ + (n − 1)d = ${a1} + (${n} − 1)(${dd}) = ${answer}.`,
            }
        },
    },

    // 7 -----------------------------------------------------------------------
    {
        id: 'alg2-geometric-sequence',
        title: 'Geometric sequence: nth term',
        desc: 'Find the nth term given the first term and common ratio.',
        generate() {
            const a1 = randInt(1, 6)
            const r = choice([2, 3, -2, 4])
            const n = randInt(2, 5)
            const answer = a1 * r ** (n - 1)
            return {
                prompt: `A geometric sequence has first term a₁ = ${a1} and common ratio r = ${r}. Find the ${ordinal(n)} term.`,
                answer,
                type: 'integer',
                explanation: `aₙ = a₁ · r^(n−1) = ${a1} · (${r})^${n - 1} = ${answer}.`,
            }
        },
    },

    // 8 -----------------------------------------------------------------------
    {
        id: 'alg2-right-triangle-ratio',
        title: 'Right-triangle trig ratio',
        desc: 'Find sin, cos, or tan given two sides of a right triangle.',
        generate() {
            const [x, y, h] = choice([
                [3, 4, 5], [6, 8, 10], [5, 12, 13],
                [8, 15, 17], [9, 12, 15], [7, 24, 25],
            ])
            // Randomly decide which leg is opposite angle θ.
            const [opp, adj] = choice([[x, y], [y, x]])
            const func = choice(['sin', 'cos', 'tan'])
            let num
            let den
            if (func === 'sin') { num = opp; den = h }
            else if (func === 'cos') { num = adj; den = h }
            else { num = opp; den = adj }
            const answer = formatFraction(num, den)
            const accepted = []
            const dec = terminatingDecimal(num, den)
            if (dec !== null) { accepted.push(dec, String(round(num / den, 2))) }
            return {
                prompt: `In a right triangle, the side opposite angle θ is ${opp}, the adjacent side is ${adj}, and the hypotenuse is ${h}. Find ${func} θ as a fraction.`,
                answer,
                type: 'text',
                accepted: [...new Set(accepted)],
                explanation: `${func} θ = ${func === 'tan' ? 'opposite/adjacent' : func === 'sin' ? 'opposite/hypotenuse' : 'adjacent/hypotenuse'} = ${num}/${den} = ${answer}.`,
            }
        },
    },

    // 9 -----------------------------------------------------------------------
    {
        id: 'alg2-degrees-radians',
        title: 'Degrees ↔ radians',
        desc: 'Convert between degrees and radians for common angles.',
        generate() {
            const deg = choice([30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360])
            const { display, pi } = radFraction(deg)
            if (choice(['toRad', 'toDeg']) === 'toRad') {
                return {
                    prompt: `Convert ${deg}° to radians. Give an exact answer in terms of π (e.g. π/6).`,
                    answer: display,
                    type: 'text',
                    accepted: [pi],
                    explanation: `${deg}° × π/180° = ${display} radians.`,
                }
            }
            return {
                prompt: `Convert ${display} radians to degrees.`,
                answer: deg,
                type: 'integer',
                explanation: `${display} × 180°/π = ${deg}°.`,
            }
        },
    },

    // 10 ----------------------------------------------------------------------
    {
        id: 'alg2-unit-circle',
        title: 'Unit circle exact values',
        desc: 'Find the exact value of sin, cos, or tan at a common angle.',
        generate() {
            const R2 = '√2/2'
            const R3 = '√3/2'
            const T3 = '√3/3'
            const table = {
                0: { sin: ['0', 0], cos: ['1', 1], tan: ['0', 0] },
                30: { sin: ['1/2', 0.5], cos: [R3, Math.sqrt(3) / 2], tan: [T3, Math.sqrt(3) / 3] },
                45: { sin: [R2, Math.SQRT1_2], cos: [R2, Math.SQRT1_2], tan: ['1', 1] },
                60: { sin: [R3, Math.sqrt(3) / 2], cos: ['1/2', 0.5], tan: ['√3', Math.sqrt(3)] },
                90: { sin: ['1', 1], cos: ['0', 0], tan: ['undefined', null] },
                120: { sin: [R3, Math.sqrt(3) / 2], cos: ['-1/2', -0.5], tan: ['-√3', -Math.sqrt(3)] },
                135: { sin: [R2, Math.SQRT1_2], cos: [`-${R2}`, -Math.SQRT1_2], tan: ['-1', -1] },
                150: { sin: ['1/2', 0.5], cos: [`-${R3}`, -Math.sqrt(3) / 2], tan: [`-${T3}`, -Math.sqrt(3) / 3] },
                180: { sin: ['0', 0], cos: ['-1', -1], tan: ['0', 0] },
                210: { sin: ['-1/2', -0.5], cos: [`-${R3}`, -Math.sqrt(3) / 2], tan: [T3, Math.sqrt(3) / 3] },
                225: { sin: [`-${R2}`, -Math.SQRT1_2], cos: [`-${R2}`, -Math.SQRT1_2], tan: ['1', 1] },
                240: { sin: [`-${R3}`, -Math.sqrt(3) / 2], cos: ['-1/2', -0.5], tan: ['√3', Math.sqrt(3)] },
                270: { sin: ['-1', -1], cos: ['0', 0], tan: ['undefined', null] },
                300: { sin: [`-${R3}`, -Math.sqrt(3) / 2], cos: ['1/2', 0.5], tan: ['-√3', -Math.sqrt(3)] },
                315: { sin: [`-${R2}`, -Math.SQRT1_2], cos: [R2, Math.SQRT1_2], tan: ['-1', -1] },
                330: { sin: ['-1/2', -0.5], cos: [R3, Math.sqrt(3) / 2], tan: [`-${T3}`, -Math.sqrt(3) / 3] },
            }
            const deg = choice(Object.keys(table).map(Number))
            const func = choice(['sin', 'cos', 'tan'])
            const [answer, value] = table[deg][func]
            const altRadical = {
                '√2/2': ['1/√2'], '-√2/2': ['-1/√2'],
                '√3/3': ['1/√3'], '-√3/3': ['-1/√3'],
            }
            const accepted = [...(altRadical[answer] || [])]
            if (answer === 'undefined') accepted.push('undef', 'dne')
            else accepted.push(...decimalForms(value))
            return {
                prompt: `Find the exact value of ${func}(${deg}°).`,
                answer,
                type: 'text',
                accepted: [...new Set(accepted)],
                explanation: `${func}(${deg}°) = ${answer}.`,
            }
        },
    },

    // 11 ----------------------------------------------------------------------
    {
        id: 'alg2-law-sines-cosines',
        title: 'Law of sines / cosines',
        desc: 'Find a missing side length using the law of sines or cosines.',
        generate() {
            if (choice(['cos', 'sin']) === 'cos') {
                const b = randInt(5, 12)
                const c = randInt(5, 12)
                const A = choice([30, 45, 60, 90, 120])
                const a = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(A * DEG2RAD))
                return {
                    prompt: `In a triangle, sides b = ${b} and c = ${c} enclose angle A = ${A}°. Find side a (opposite A). Round to 2 dp.`,
                    answer: a,
                    type: 'numeric',
                    tolerance: 0.05,
                    explanation: `a = √(b² + c² − 2bc·cos A) = √(${b}² + ${c}² − 2·${b}·${c}·cos ${A}°) ≈ ${round(a, 2)}.`,
                }
            }
            const A = choice([30, 40, 45, 50, 60])
            const B = choice([30, 45, 60, 70, 80])
            const a = randInt(6, 15)
            const b = a * Math.sin(B * DEG2RAD) / Math.sin(A * DEG2RAD)
            return {
                prompt: `In a triangle, angle A = ${A}° is opposite side a = ${a}, and angle B = ${B}°. Find side b (opposite B). Round to 2 dp.`,
                answer: b,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `By the law of sines, b = a·sin B / sin A = ${a}·sin ${B}° / sin ${A}° ≈ ${round(b, 2)}.`,
            }
        },
    },
]

export default skills

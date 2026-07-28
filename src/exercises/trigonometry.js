/**
 * Trigonometry practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 * Prompts are plain text and may use ^ √ π × ÷.
 */

import { randInt, choice, formatFraction, round } from './helpers.js'

const DEG2RAD = Math.PI / 180

// Accepted decimal string forms for an exact numeric value (2/3/4 dp), de-duplicated.
const decimalForms = (v) => {
    if (v == null || !Number.isFinite(v)) return []
    return [...new Set([round(v, 2), round(v, 3), round(v, 4)].map(String))]
}

// Exact unit-circle values as [display, decimalValue]. null decimal = undefined (tan at 90/270).
const R2 = '√2/2'
const R3 = '√3/2'
const T3 = '√3/3'
const UNIT_TABLE = {
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
const ALL_ANGLES = Object.keys(UNIT_TABLE).map(Number)
// Angles where tan is defined (exclude 90, 270).
const TAN_ANGLES = ALL_ANGLES.filter((d) => d !== 90 && d !== 270)

// Display / "pi"-spelled radian forms of a degree measure, e.g. 30° -> "π/6".
const radFraction = (deg) => {
    const g = (function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b] } return a || 1 })(deg, 180)
    const n = deg / g
    const d = 180 / g
    const build = (sym) => {
        if (d === 1) return n === 1 ? sym : `${n}${sym}`
        return n === 1 ? `${sym}/${d}` : `${n}${sym}/${d}`
    }
    return { display: build('π'), pi: build('pi') }
}

const skills = [
    // 1 -----------------------------------------------------------------------
    {
        id: 'trig-degrees-radians',
        title: 'Degrees to radians',
        desc: 'Convert a common angle from degrees to radians (decimal).',
        generate() {
            const deg = choice([30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360])
            const exact = radFraction(deg)
            const value = round(deg * DEG2RAD, 4)
            return {
                prompt: `Convert ${deg}° to radians. Give a decimal rounded to 2 dp.`,
                answer: value,
                type: 'numeric',
                tolerance: 0.01,
                accepted: [exact.display, exact.pi],
                explanation: `To convert degrees to radians, multiply by π/180.\n${deg}° × π/180 = ${exact.display} = ${deg} × ${round(DEG2RAD, 6)}.\n≈ ${round(value, 2)} radians.`,
            }
        },
    },

    // 2 -----------------------------------------------------------------------
    {
        id: 'trig-unit-circle-exact',
        title: 'Unit circle exact value',
        desc: 'Find the exact value of sin, cos, or tan at a special angle.',
        generate() {
            const func = choice(['sin', 'cos', 'tan'])
            // tan is undefined at 90 and 270, so restrict the angle pool for tan.
            const deg = choice(func === 'tan' ? TAN_ANGLES : ALL_ANGLES)
            const [answer, value] = UNIT_TABLE[deg][func]
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
                explanation: `Locate ${deg}° on the unit circle and use its reference angle.\nRead the ${func} value, keeping the correct sign for the quadrant.\n${func}(${deg}°) = ${answer}.`,
            }
        },
    },

    // 3 -----------------------------------------------------------------------
    {
        id: 'trig-evaluate-special',
        title: 'Evaluate a trig function',
        desc: 'Evaluate sin, cos, or tan at a special angle as a decimal.',
        generate() {
            const func = choice(['sin', 'cos', 'tan'])
            const deg = choice(func === 'tan' ? TAN_ANGLES : ALL_ANGLES)
            const [display, value] = UNIT_TABLE[deg][func]
            const answer = round(value, 4)
            return {
                prompt: `Evaluate ${func}(${deg}°). Give a decimal rounded to 2 dp.`,
                answer,
                type: 'numeric',
                tolerance: 0.01,
                explanation: `The exact value is ${func}(${deg}°) = ${display}.\nConvert to a decimal.\n≈ ${round(value, 2)}.`,
            }
        },
    },

    // 4 -----------------------------------------------------------------------
    {
        id: 'trig-amplitude-period',
        title: 'Amplitude and period',
        desc: 'Find the amplitude or period of y = a·sin(bx) or y = a·cos(bx).',
        generate() {
            const a = randInt(2, 8)
            const b = randInt(1, 6)
            const f = choice(['sin', 'cos'])
            if (choice(['amp', 'period']) === 'amp') {
                return {
                    prompt: `Find the amplitude of y = ${a}${f}(${b}x).`,
                    answer: a,
                    type: 'integer',
                    explanation: `For y = a·${f}(bx), the amplitude is |a|.\nHere a = ${a}.\nSo the amplitude is ${a}.`,
                }
            }
            const period = round((2 * Math.PI) / b, 4)
            return {
                prompt: `Find the period of y = ${a}${f}(${b}x). Give a decimal rounded to 2 dp.`,
                answer: period,
                type: 'numeric',
                tolerance: 0.01,
                accepted: b === 1 ? ['2π', '2pi'] : [`2π/${b}`, `2pi/${b}`],
                explanation: `For y = a·${f}(bx), the period is 2π/b.\nHere b = ${b}, so the period is 2π/${b}.\n≈ ${round(period, 2)}.`,
            }
        },
    },

    // 5 -----------------------------------------------------------------------
    {
        id: 'trig-pythagorean-identity',
        title: 'Pythagorean identity',
        desc: 'Given sin θ and a quadrant, find cos θ using sin²θ + cos²θ = 1.',
        generate() {
            const [opp, adj, hyp] = choice([
                [3, 4, 5], [4, 3, 5], [6, 8, 10], [5, 12, 13], [12, 5, 13],
                [8, 15, 17], [15, 8, 17], [7, 24, 25], [24, 7, 25],
            ])
            // sin θ > 0 in quadrants I and II; cos θ is + in I, − in II.
            const quad = choice([1, 2])
            const sign = quad === 1 ? 1 : -1
            const sinStr = formatFraction(opp, hyp)
            const cosValue = round((sign * adj) / hyp, 4)
            return {
                prompt: `Given sin θ = ${sinStr} and θ is in Quadrant ${quad === 1 ? 'I' : 'II'}, find cos θ. Round to 2 dp.`,
                answer: cosValue,
                type: 'numeric',
                tolerance: 0.01,
                accepted: [formatFraction(sign * adj, hyp)],
                explanation: `Use sin²θ + cos²θ = 1, so cos θ = ±√(1 − sin²θ).\nsin θ = ${sinStr}, so cos²θ = 1 − (${opp}/${hyp})² = (${adj}/${hyp})².\nIn Quadrant ${quad === 1 ? 'I cos θ is positive' : 'II cos θ is negative'}, so cos θ = ${formatFraction(sign * adj, hyp)} ≈ ${round(cosValue, 2)}.`,
            }
        },
    },

    // 6 -----------------------------------------------------------------------
    {
        id: 'trig-inverse',
        title: 'Inverse trig function',
        desc: 'Find arcsin, arccos, or arctan of a special value, in degrees.',
        generate() {
            const problems = [
                // arcsin: principal range [−90°, 90°]
                ['arcsin', '0', 0], ['arcsin', '1/2', 30], ['arcsin', '√2/2', 45],
                ['arcsin', '√3/2', 60], ['arcsin', '1', 90], ['arcsin', '-1/2', -30],
                ['arcsin', '-√2/2', -45], ['arcsin', '-√3/2', -60], ['arcsin', '-1', -90],
                // arccos: principal range [0°, 180°]
                ['arccos', '1', 0], ['arccos', '√3/2', 30], ['arccos', '√2/2', 45],
                ['arccos', '1/2', 60], ['arccos', '0', 90], ['arccos', '-1/2', 120],
                ['arccos', '-√2/2', 135], ['arccos', '-√3/2', 150], ['arccos', '-1', 180],
                // arctan: principal range (−90°, 90°)
                ['arctan', '0', 0], ['arctan', '√3/3', 30], ['arctan', '1', 45],
                ['arctan', '√3', 60], ['arctan', '-√3/3', -30], ['arctan', '-1', -45],
                ['arctan', '-√3', -60],
            ]
            const [func, val, deg] = choice(problems)
            return {
                prompt: `Find ${func}(${val}) in degrees.`,
                answer: deg,
                type: 'integer',
                explanation: `${func}(${val}) asks for the angle whose ${func.replace('arc', '')} is ${val}.\nWithin the principal range, that angle is ${deg}°.\nSo ${func}(${val}) = ${deg}°.`,
            }
        },
    },

    // 7 -----------------------------------------------------------------------
    {
        id: 'trig-solve-equation',
        title: 'Solve a trig equation',
        desc: 'Find the smallest solution in [0°, 360°) of a basic trig equation.',
        generate() {
            // Each entry: [func, value display, smallest solution in [0, 360) degrees].
            const problems = [
                ['sin', '0', 0], ['sin', '1/2', 30], ['sin', '√2/2', 45],
                ['sin', '√3/2', 60], ['sin', '1', 90],
                ['cos', '1', 0], ['cos', '√3/2', 30], ['cos', '√2/2', 45],
                ['cos', '1/2', 60], ['cos', '0', 90],
                ['tan', '0', 0], ['tan', '√3/3', 30], ['tan', '1', 45], ['tan', '√3', 60],
            ]
            const [func, val, deg] = choice(problems)
            return {
                prompt: `Solve ${func}(x) = ${val} for the smallest solution x in [0°, 360°). Give x in degrees.`,
                answer: deg,
                type: 'integer',
                explanation: `Find the reference angle where ${func} equals ${val}.\nThe smallest angle in [0°, 360°) satisfying this is ${deg}°.\nSo x = ${deg}°.`,
            }
        },
    },

    // 8 -----------------------------------------------------------------------
    {
        id: 'trig-law-sines-cosines',
        title: 'Law of sines / cosines',
        desc: 'Find a missing side length using the law of sines or cosines.',
        generate() {
            if (choice(['cos', 'sin']) === 'cos') {
                const b = randInt(5, 12)
                const c = randInt(5, 12)
                const A = choice([30, 45, 60, 90, 120])
                const a = round(Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(A * DEG2RAD)), 4)
                return {
                    prompt: `In a triangle, sides b = ${b} and c = ${c} enclose angle A = ${A}°. Find side a (opposite A). Round to 2 dp.`,
                    answer: a,
                    type: 'numeric',
                    tolerance: 0.05,
                    explanation: `Law of cosines: a = √(b² + c² − 2bc·cos A).\nSubstitute b = ${b}, c = ${c}, A = ${A}°: √(${b}² + ${c}² − 2·${b}·${c}·cos ${A}°).\n≈ ${round(a, 2)}.`,
                }
            }
            const A = choice([30, 40, 45, 50, 60])
            const B = choice([30, 45, 60, 70, 80])
            const a = randInt(6, 15)
            const b = round((a * Math.sin(B * DEG2RAD)) / Math.sin(A * DEG2RAD), 4)
            return {
                prompt: `In a triangle, angle A = ${A}° is opposite side a = ${a}, and angle B = ${B}°. Find side b (opposite B). Round to 2 dp.`,
                answer: b,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Law of sines: a/sin A = b/sin B, so b = a·sin B / sin A.\nSubstitute a = ${a}, A = ${A}°, B = ${B}°: ${a}·sin ${B}° / sin ${A}°.\n≈ ${round(b, 2)}.`,
            }
        },
    },
]

export default skills

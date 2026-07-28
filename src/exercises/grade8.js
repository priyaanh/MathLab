/**
 * 8th Grade math practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 * Prompts are plain text: powers use "^", fractions use "a/b".
 */

import {
    randInt,
    randNonZero,
    choice,
    round,
    formatFraction,
} from './helpers.js'

// Render a signed integer using the minus glyph for negatives, e.g. -4 -> "−4".
const fmt = (n) => (n < 0 ? `−${Math.abs(n)}` : `${n}`)

// Linear expression "m x + b" in canonical, space-free form ("2x-3", "-x", "5").
const polyLinear = (m, b) => {
    if (m === 0) return `${b}`
    let s = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`
    if (b !== 0) s += b > 0 ? `+${b}` : `${b}`
    return s
}

const skills = [
    {
        id: 'g8-scientific-notation',
        title: 'Scientific notation',
        desc: 'Write a whole number in scientific notation (find the coefficient or the exponent).',
        generate() {
            const tens = randInt(11, 99) // = 10 × coefficient, so coefficient = tens/10
            const n = randInt(3, 7) // exponent
            const numStr = `${tens}${'0'.repeat(n - 1)}` // e.g. tens=32, n=4 -> "32000"
            const coef = round(tens / 10, 1)
            if (choice([true, false])) {
                return {
                    prompt: `Write ${numStr} in scientific notation as c × 10^n. What is the exponent n?`,
                    answer: n,
                    type: 'integer',
                    explanation: `Move the decimal point left until one non-zero digit remains before it: ${numStr} → ${coef}.\nCount the places the decimal moved: ${n}.\nSo ${numStr} = ${coef} × 10^${n}, and the exponent is ${n}.`,
                }
            }
            return {
                prompt: `Write ${numStr} in scientific notation as c × 10^n. What is the coefficient c? (1 ≤ c < 10)`,
                answer: coef,
                type: 'numeric',
                tolerance: 0.01,
                explanation: `Place the decimal so exactly one non-zero digit sits before it: ${coef}.\nThat requires the exponent 10^${n}, since ${coef} × 10^${n} = ${numStr}.\nThe coefficient is ${coef}.`,
            }
        },
    },

    {
        id: 'g8-roots',
        title: 'Square and cube roots',
        desc: 'Evaluate the square root of a perfect square or the cube root of a perfect cube.',
        generate() {
            if (choice([true, false])) {
                const base = randInt(2, 20)
                const n = base * base
                return {
                    prompt: `√${n} = ?`,
                    answer: base,
                    type: 'integer',
                    explanation: `The square root asks: what number times itself equals ${n}?\n${base} × ${base} = ${n}.\nSo √${n} = ${base}.`,
                }
            }
            const base = randInt(2, 9)
            const n = base ** 3
            return {
                prompt: `∛${n} = ?  (cube root)`,
                answer: base,
                type: 'integer',
                explanation: `The cube root asks: what number used three times as a factor equals ${n}?\n${base} × ${base} × ${base} = ${n}.\nSo ∛${n} = ${base}.`,
            }
        },
    },

    {
        id: 'g8-solve-equation',
        title: 'Solve a multi-step equation',
        desc: 'Solve a linear equation with the unknown on both sides.',
        generate() {
            const x = randInt(-9, 9)
            const a = randNonZero(-6, 6)
            let c = randNonZero(-6, 6)
            while (c === a) c = randNonZero(-6, 6)
            const b = randInt(-9, 9)
            const d = (a - c) * x + b // makes ax + b = cx + d true at this x
            return {
                prompt: `Solve for x:  ${polyLinear(a, b)} = ${polyLinear(c, d)}`,
                answer: x,
                type: 'integer',
                explanation: `Move the x-terms to one side: (${a} − ${c})x = ${d} − ${b}, so ${fmt(a - c)}x = ${fmt(d - b)}.\nDivide both sides by ${fmt(a - c)}: x = ${fmt(d - b)} ÷ ${fmt(a - c)}.\nx = ${fmt(x)}.`,
            }
        },
    },

    {
        id: 'g8-slope-two-points',
        title: 'Slope from two points',
        desc: 'Find the slope of the line through two given points.',
        generate() {
            const x1 = randInt(-6, 6)
            let x2 = randInt(-6, 6)
            while (x2 === x1) x2 = randInt(-6, 6)
            const y1 = randInt(-8, 8)
            const y2 = randInt(-8, 8)
            const answer = (y2 - y1) / (x2 - x1)
            return {
                prompt: `Find the slope of the line through (${fmt(x1)}, ${fmt(y1)}) and (${fmt(x2)}, ${fmt(y2)}).`,
                answer,
                type: 'numeric',
                tolerance: 0.02,
                explanation: `Slope = (y2 − y1) / (x2 − x1).\nSubstitute the points: (${fmt(y2)} − ${fmt(y1)}) / (${fmt(x2)} − ${fmt(x1)}) = ${fmt(y2 - y1)}/${fmt(x2 - x1)}.\nSimplify: ${formatFraction(y2 - y1, x2 - x1)}.`,
            }
        },
    },

    {
        id: 'g8-linear-function',
        title: 'Evaluate a linear function',
        desc: 'Find the output of a linear function y = mx + b for a given input.',
        generate() {
            const m = randNonZero(-5, 5)
            const b = randInt(-8, 8)
            const x0 = randInt(-6, 6)
            const answer = m * x0 + b
            return {
                prompt: `For the function y = ${polyLinear(m, b)}, find y when x = ${fmt(x0)}.`,
                answer,
                type: 'integer',
                explanation: `Substitute x = ${fmt(x0)}: y = (${m})(${fmt(x0)}) ${b >= 0 ? '+ ' + b : '− ' + Math.abs(b)}.\nMultiply first: ${m} × ${fmt(x0)} = ${fmt(m * x0)}, then combine: ${fmt(m * x0)} ${b >= 0 ? '+ ' + b : '− ' + Math.abs(b)}.\nSo y = ${fmt(answer)}.`,
            }
        },
    },

    {
        id: 'g8-systems',
        title: 'Systems of two equations',
        desc: 'Solve a 2×2 linear system for x, or give the (x, y) solution.',
        generate() {
            const x = randInt(-5, 5)
            const y = randInt(-5, 5)
            const a1 = randNonZero(-4, 4)
            const b1 = randNonZero(-4, 4)
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
                    explanation: `Solve by elimination or substitution using both equations.\nThe only pair satisfying both is x = ${fmt(x)}, y = ${fmt(y)}.\nSo x = ${fmt(x)}.`,
                }
            }
            return {
                prompt: `Solve the system; give the solution as (x, y):\n  ${eq1}\n  ${eq2}`,
                answer: `(${x}, ${y})`,
                type: 'text',
                accepted: [`${x},${y}`, `x=${x},y=${y}`],
                explanation: `Solve by elimination or substitution using both equations.\nThe only pair satisfying both is x = ${fmt(x)} and y = ${fmt(y)}.\nWrite it as (${x}, ${y}).`,
            }
        },
    },

    {
        id: 'g8-transversal-angles',
        title: 'Angles and transversals',
        desc: 'Use angle relationships when parallel lines are cut by a transversal.',
        generate() {
            let a = randInt(30, 150)
            while (a === 90) a = randInt(30, 150)
            const rel = choice([
                ['corresponding', 'equal'],
                ['alternate interior', 'equal'],
                ['alternate exterior', 'equal'],
                ['co-interior (same-side interior)', 'supplementary'],
            ])
            const [name, kind] = rel
            const answer = kind === 'equal' ? a : 180 - a
            return {
                prompt: `Two parallel lines are cut by a transversal. One angle measures ${a}°. What is the measure (in degrees) of its ${name} angle?`,
                answer,
                type: 'integer',
                explanation:
                    kind === 'equal'
                        ? `${name.charAt(0).toUpperCase() + name.slice(1)} angles formed by a transversal across parallel lines are congruent (equal).\nSo the angle equals the given ${a}°.\nAnswer: ${answer}°.`
                        : `${name.charAt(0).toUpperCase() + name.slice(1)} angles are supplementary: they add to 180°.\nSubtract: 180 − ${a} = ${answer}.\nAnswer: ${answer}°.`,
            }
        },
    },

    {
        id: 'g8-pythagorean',
        title: 'Pythagorean theorem',
        desc: 'Find a missing side of a right triangle using a² + b² = c².',
        generate() {
            if (choice([true, false])) {
                // Find the hypotenuse from two legs.
                const a = randInt(2, 12)
                const b = randInt(2, 12)
                const answer = round(Math.sqrt(a * a + b * b), 2)
                return {
                    prompt: `A right triangle has legs of length ${a} and ${b}. Find the length of the hypotenuse (round to 2 decimals).`,
                    answer,
                    type: 'numeric',
                    tolerance: 0.05,
                    explanation: `Use a² + b² = c²: ${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b}.\nTake the square root: c = √${a * a + b * b}.\nc ≈ ${answer}.`,
                }
            }
            // Find a missing leg from the hypotenuse and one leg (use a Pythagorean triple).
            const triple = choice([
                [3, 4, 5],
                [6, 8, 10],
                [5, 12, 13],
                [8, 15, 17],
                [9, 12, 15],
                [7, 24, 25],
            ])
            const [leg, other, hyp] = triple
            return {
                prompt: `A right triangle has hypotenuse ${hyp} and one leg ${other}. Find the length of the other leg.`,
                answer: leg,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Use a² + b² = c², solving for the missing leg: leg² = ${hyp}² − ${other}² = ${hyp * hyp} − ${other * other} = ${leg * leg}.\nTake the square root: √${leg * leg} = ${leg}.\nThe missing leg is ${leg}.`,
            }
        },
    },

    {
        id: 'g8-transformations',
        title: 'Transformations of a point',
        desc: 'Find the image of a point under a translation or a reflection.',
        generate() {
            const x = randNonZero(-6, 6)
            const y = randNonZero(-6, 6)
            const kind = choice(['translate', 'reflect-x', 'reflect-y'])
            let nx
            let ny
            let describe
            let reason
            if (kind === 'translate') {
                const dx = randNonZero(-6, 6)
                const dy = randNonZero(-6, 6)
                nx = x + dx
                ny = y + dy
                describe = `translate the point (${fmt(x)}, ${fmt(y)}) by ${dx > 0 ? 'right ' + dx : 'left ' + Math.abs(dx)} and ${dy > 0 ? 'up ' + dy : 'down ' + Math.abs(dy)}`
                reason = `Add the shift to each coordinate: (${fmt(x)} ${dx > 0 ? '+ ' + dx : '− ' + Math.abs(dx)}, ${fmt(y)} ${dy > 0 ? '+ ' + dy : '− ' + Math.abs(dy)}).`
            } else if (kind === 'reflect-x') {
                nx = x
                ny = -y
                describe = `reflect the point (${fmt(x)}, ${fmt(y)}) across the x-axis`
                reason = `Reflecting across the x-axis keeps x and negates y: (x, y) → (x, −y).`
            } else {
                nx = -x
                ny = y
                describe = `reflect the point (${fmt(x)}, ${fmt(y)}) across the y-axis`
                reason = `Reflecting across the y-axis negates x and keeps y: (x, y) → (−x, y).`
            }
            return {
                prompt: `Give the image, as (x, y), when you ${describe}.`,
                answer: `(${nx}, ${ny})`,
                type: 'text',
                accepted: [`${nx},${ny}`],
                explanation: `${reason}\nCompute each coordinate: x → ${fmt(nx)}, y → ${fmt(ny)}.\nThe image is (${nx}, ${ny}).`,
            }
        },
    },
]

export default skills

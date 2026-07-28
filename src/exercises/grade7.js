/**
 * Grade 7 practice-problem generators for MathLab.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 */

import {
    randInt,
    randNonZero,
    choice,
    reduceFraction,
    formatFraction,
    round,
} from './helpers.js'

// Render a signed integer using the minus glyph for negatives, e.g. -4 -> "−4".
const fmt = (n) => (n < 0 ? `−${Math.abs(n)}` : `${n}`)

const skills = [
    {
        id: 'g7-constant-of-proportionality',
        title: 'Constant of proportionality',
        desc: 'Find the unit rate k in a proportional relationship y = kx.',
        generate() {
            const k = randInt(2, 12)
            const x = randInt(2, 9)
            const y = k * x
            return {
                prompt: `y is proportional to x. When x = ${x}, y = ${y}. What is the constant of proportionality k (where y = kx)?`,
                answer: k,
                type: 'integer',
                explanation: `In a proportional relationship, k = y ÷ x.\nk = ${y} ÷ ${x} = ${k}.\nThe constant of proportionality is ${k}.`,
            }
        },
    },

    {
        id: 'g7-percent-increase-decrease',
        title: 'Percent increase and decrease',
        desc: 'Apply a percent increase or decrease to a starting amount.',
        generate() {
            const base = randInt(2, 20) * 10
            const p = choice([5, 10, 15, 20, 25, 40, 50])
            const increase = choice([true, false])
            const delta = round((base * p) / 100, 2)
            const answer = increase ? round(base + delta, 2) : round(base - delta, 2)
            const dir = increase ? 'increased' : 'decreased'
            return {
                prompt: `A value of ${base} is ${dir} by ${p}%. What is the new value?`,
                answer,
                type: 'numeric',
                explanation: `Find the change: ${p}% of ${base} = ${p}/100 × ${base} = ${delta}.\n${increase ? 'Add' : 'Subtract'} it: ${base} ${increase ? '+' : '−'} ${delta} = ${answer}.\nThe new value is ${answer}.`,
            }
        },
    },

    {
        id: 'g7-tax-tip',
        title: 'Sales tax and tip',
        desc: 'Compute a total price after adding sales tax or a tip.',
        generate() {
            const price = randInt(4, 40) * 5
            const rate = choice([5, 8, 10, 15, 20])
            const useTip = choice([true, false])
            const extra = round((price * rate) / 100, 2)
            const answer = round(price + extra, 2)
            const label = useTip ? 'tip' : 'sales tax'
            return {
                prompt: `A bill is $${price}. With a ${rate}% ${label} added, what is the total? (enter a number)`,
                answer,
                type: 'numeric',
                tolerance: 0.01,
                explanation: `The ${label} is ${rate}% of $${price} = ${rate}/100 × ${price} = $${extra}.\nAdd it to the bill: ${price} + ${extra} = ${answer}.\nThe total is $${answer}.`,
            }
        },
    },

    {
        id: 'g7-integer-add-subtract',
        title: 'Integer addition and subtraction',
        desc: 'Add and subtract positive and negative integers.',
        generate() {
            const op = choice(['+', '−'])
            const a = randNonZero(-20, 20)
            const b = randNonZero(-20, 20)
            const answer = op === '+' ? a + b : a - b
            return {
                prompt: `${fmt(a)} ${op} (${fmt(b)}) = ?`,
                answer,
                type: 'integer',
                explanation: `Start at ${fmt(a)} on the number line.\n${op === '+' ? 'Adding' : 'Subtracting'} ${fmt(b)} gives ${fmt(a)} ${op} (${fmt(b)}) = ${fmt(answer)}.\nAnswer: ${fmt(answer)}.`,
            }
        },
    },

    {
        id: 'g7-rational-add-subtract',
        title: 'Rational number addition and subtraction',
        desc: 'Add or subtract two fractions and reduce the result.',
        generate() {
            const op = choice(['+', '−'])
            const d1 = randInt(2, 9)
            const d2 = randInt(2, 9)
            const n1 = randNonZero(-8, 8)
            const n2 = randNonZero(-8, 8)
            const numer = op === '+' ? n1 * d2 + n2 * d1 : n1 * d2 - n2 * d1
            const denom = d1 * d2
            const answer = formatFraction(numer, denom)
            const [rn, rd] = reduceFraction(numer, denom)
            const accepted = []
            if (rd !== 1) accepted.push(`${rn}/${rd}`)
            return {
                prompt: `Compute and reduce:  ${n1}/${d1} ${op} (${n2}/${d2})`,
                answer,
                type: 'text',
                accepted,
                explanation: `Use a common denominator of ${denom}: ${n1}/${d1} = ${n1 * d2}/${denom} and ${n2}/${d2} = ${n2 * d1}/${denom}.\n${op === '+' ? 'Add' : 'Subtract'} the numerators: (${n1 * d2} ${op} ${n2 * d1})/${denom} = ${numer}/${denom}.\nReduce: ${answer}.`,
            }
        },
    },

    {
        id: 'g7-negative-multiply-divide',
        title: 'Negative multiplication and division',
        desc: 'Multiply and divide signed integers.',
        generate() {
            const useMul = choice([true, false])
            if (useMul) {
                const a = randNonZero(-12, 12)
                const b = randNonZero(-12, 12)
                const answer = a * b
                return {
                    prompt: `${fmt(a)} × ${fmt(b)} = ?`,
                    answer,
                    type: 'integer',
                    explanation: `Multiply the absolute values: ${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(answer)}.\n${a * b < 0 ? 'Different' : 'Same'} signs give a ${a * b < 0 ? 'negative' : 'positive'} result.\n${fmt(a)} × ${fmt(b)} = ${fmt(answer)}.`,
                }
            }
            const b = randNonZero(-12, 12)
            const answer = randNonZero(-12, 12)
            const a = b * answer
            return {
                prompt: `${fmt(a)} ÷ ${fmt(b)} = ?`,
                answer,
                type: 'integer',
                explanation: `Divide the absolute values: ${Math.abs(a)} ÷ ${Math.abs(b)} = ${Math.abs(answer)}.\n${a / b < 0 ? 'Different' : 'Same'} signs give a ${a / b < 0 ? 'negative' : 'positive'} result.\n${fmt(a)} ÷ ${fmt(b)} = ${fmt(answer)}.`,
            }
        },
    },

    {
        id: 'g7-two-step-equation',
        title: 'Two-step equations',
        desc: 'Solve ax + b = c for x.',
        generate() {
            const a = randNonZero(2, 9)
            const x = randInt(-10, 10)
            const b = randNonZero(-12, 12)
            const c = a * x + b
            return {
                prompt: `Solve for x:  ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${fmt(c)}`,
                answer: x,
                type: 'integer',
                explanation: `Subtract ${fmt(b)} from both sides: ${a}x = ${fmt(c)} − (${fmt(b)}) = ${fmt(c - b)}.\nDivide both sides by ${a}: x = ${fmt(c - b)} ÷ ${a}.\nx = ${fmt(x)}.`,
            }
        },
    },

    {
        id: 'g7-two-step-inequality',
        title: 'Two-step inequalities',
        desc: 'Solve a two-step inequality and give the boundary value.',
        generate() {
            const a = randInt(2, 8)
            const x = randInt(-8, 8)
            const b = randNonZero(-10, 10)
            const c = a * x + b
            const rel = choice(['>', '<', '≥', '≤'])
            const answer = `x${rel}${x}`
            return {
                prompt: `Solve for x:  ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} ${rel} ${fmt(c)}\n(Write your answer like x${rel}${x >= 0 ? x : '(' + x + ')'})`,
                answer,
                type: 'text',
                accepted: [`x ${rel} ${x}`, `x${rel}${fmt(x)}`],
                explanation: `Subtract ${fmt(b)} from both sides: ${a}x ${rel} ${fmt(c - b)}.\nDivide both sides by the positive number ${a}: x ${rel} ${fmt((c - b) / a)}.\nThe solution is x ${rel} ${x}.`,
            }
        },
    },

    {
        id: 'g7-simple-probability',
        title: 'Simple probability',
        desc: 'Find the probability of an event as a reduced fraction.',
        generate() {
            const a = randInt(1, 8)
            const b = randInt(1, 8)
            const c = randInt(1, 8)
            const total = a + b + c
            const opt = choice([
                ['apple', a],
                ['banana', b],
                ['cherry', c],
            ])
            const [name, count] = opt
            const answer = formatFraction(count, total)
            const [rn, rd] = reduceFraction(count, total)
            const accepted = []
            if (rd !== 1) accepted.push(`${rn}/${rd}`)
            return {
                prompt: `A basket has ${a} apple, ${b} banana, and ${c} cherry snacks. One is picked at random. What is P(${name})? (reduced fraction)`,
                answer,
                type: 'text',
                accepted,
                explanation: `Probability = favorable ÷ total: there are ${count} ${name} out of ${total} snacks.\nP(${name}) = ${count}/${total}.\nReduce to lowest terms: ${answer}.`,
            }
        },
    },

    {
        id: 'g7-scale-factor',
        title: 'Scale drawings',
        desc: 'Use a scale factor to find an actual length from a drawing.',
        generate() {
            const k = randInt(2, 12)
            const drawing = randInt(2, 15)
            const actual = drawing * k
            return {
                prompt: `On a scale drawing, 1 cm represents ${k} m. A wall is ${drawing} cm long on the drawing. How many meters is the actual wall?`,
                answer: actual,
                type: 'integer',
                explanation: `The scale factor is ${k} m per cm.\nMultiply the drawing length by the scale factor: ${drawing} × ${k} = ${actual}.\nThe actual wall is ${actual} m.`,
            }
        },
    },

    {
        id: 'g7-circle-area',
        title: 'Area of a circle',
        desc: 'Compute the area of a circle from its radius (use π ≈ 3.14).',
        generate() {
            const r = randInt(2, 12)
            const answer = round(Math.PI * r * r, 2)
            return {
                prompt: `Find the area of a circle with radius ${r}. Use π ≈ 3.14 and round to 2 decimals.`,
                answer,
                type: 'numeric',
                tolerance: 0.5,
                explanation: `Area = π r². With r = ${r}: r² = ${r * r}.\nArea = 3.14 × ${r * r} ≈ ${round(3.14 * r * r, 2)}.\nUsing π more precisely, the area ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'g7-circle-circumference',
        title: 'Circumference of a circle',
        desc: 'Compute the circumference of a circle from its radius (use π ≈ 3.14).',
        generate() {
            const r = randInt(2, 15)
            const answer = round(2 * Math.PI * r, 2)
            return {
                prompt: `Find the circumference of a circle with radius ${r}. Use π ≈ 3.14 and round to 2 decimals.`,
                answer,
                type: 'numeric',
                tolerance: 0.5,
                explanation: `Circumference = 2π r. With r = ${r}: 2 × r = ${2 * r}.\nC = 3.14 × ${2 * r} ≈ ${round(3.14 * 2 * r, 2)}.\nUsing π more precisely, C ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'g7-angle-relationships',
        title: 'Angle relationships',
        desc: 'Use complementary or supplementary angles to find a missing angle.',
        generate() {
            const supplementary = choice([true, false])
            const whole = supplementary ? 180 : 90
            const known = randInt(10, whole - 10)
            const answer = whole - known
            const kind = supplementary ? 'supplementary' : 'complementary'
            return {
                prompt: `Two ${kind} angles add to ${whole}°. One angle is ${known}°. What is the other angle, in degrees?`,
                answer,
                type: 'integer',
                explanation: `${kind[0].toUpperCase() + kind.slice(1)} angles sum to ${whole}°.\nSubtract the known angle: ${whole} − ${known} = ${answer}.\nThe other angle is ${answer}°.`,
            }
        },
    },
]

export default skills

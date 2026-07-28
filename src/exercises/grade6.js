/**
 * Grade 6 practice-problem generators for MathLab.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 */

import {
    randInt,
    randNonZero,
    choice,
    gcd,
    reduceFraction,
    formatFraction,
    round,
    mcFrom,
} from './helpers.js'

// Render a signed integer using the minus glyph for negatives, e.g. -4 -> "−4".
const fmt = (n) => (n < 0 ? `−${Math.abs(n)}` : `${n}`)

const skills = [
    {
        id: 'g6-equivalent-ratio',
        title: 'Equivalent ratios',
        desc: 'Scale a ratio up to find a missing term.',
        generate() {
            const a = randInt(2, 9)
            const b = randInt(2, 9)
            const k = randInt(2, 6)
            const c = a * k
            const answer = b * k
            return {
                prompt: `The ratio ${a} : ${b} is equivalent to ${c} : x. Find x.`,
                answer,
                type: 'integer',
                explanation: `The first term grows from ${a} to ${c}: ${c} ÷ ${a} = ${k}.\nMultiply the second term by the same factor: x = ${b} × ${k}.\nx = ${answer}.`,
            }
        },
    },

    {
        id: 'g6-ratio-word',
        title: 'Ratio from a word problem',
        desc: 'Write the ratio of one quantity to another in lowest terms.',
        generate() {
            const g = randInt(2, 6)
            const boys = g * randInt(1, 5)
            const girls = g * randInt(1, 5)
            const answer = formatFraction(boys, girls)
            const [n, d] = reduceFraction(boys, girls)
            const accepted = [`${n}:${d}`, `${n} : ${d}`]
            return {
                prompt: `A class has ${boys} boys and ${girls} girls. What is the ratio of boys to girls, in lowest terms? (write as a/b)`,
                answer,
                type: 'text',
                accepted,
                explanation: `Write the ratio of boys to girls: ${boys}/${girls}.\nDivide both terms by their GCF, ${gcd(boys, girls)}.\nThe ratio in lowest terms is ${answer}.`,
            }
        },
    },

    {
        id: 'g6-unit-rate',
        title: 'Unit rates',
        desc: 'Find a per-one rate from a total and a quantity.',
        generate() {
            const qty = randInt(2, 12)
            const per = randInt(2, 25)
            const total = per * qty
            return {
                prompt: `A car travels ${total} miles in ${qty} hours at a steady speed. What is the speed in miles per hour?`,
                answer: per,
                type: 'integer',
                explanation: `A unit rate is the amount for 1 hour, so divide the distance by the time.\n${total} ÷ ${qty} = ${per}.\nThe speed is ${per} miles per hour.`,
            }
        },
    },

    {
        id: 'g6-percent-of-number',
        title: 'Percent of a number',
        desc: 'Find a given percent of a number.',
        generate() {
            const p = choice([5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80])
            const base = randInt(4, 40) * 5
            const answer = round((p * base) / 100, 2)
            return {
                prompt: `What is ${p}% of ${base}?`,
                answer,
                type: 'numeric',
                explanation: `Write the percent as a fraction: ${p}% = ${p}/100.\nMultiply by the number: ${p}/100 × ${base} = ${answer}.\n${p}% of ${base} is ${answer}.`,
            }
        },
    },

    {
        id: 'g6-add-fractions',
        title: 'Add and subtract fractions',
        desc: 'Add or subtract two fractions, giving the answer in lowest terms.',
        generate() {
            const d1 = randInt(2, 9)
            const d2 = randInt(2, 9)
            const n1 = randInt(1, d1)
            const n2 = randInt(1, d2)
            const op = choice(['+', '−'])
            // Common denominator via cross-multiplication.
            const commonD = d1 * d2
            const num = op === '+' ? n1 * d2 + n2 * d1 : n1 * d2 - n2 * d1
            const answer = formatFraction(num, commonD)
            return {
                prompt: `Compute:  ${n1}/${d1} ${op} ${n2}/${d2}  (answer in lowest terms)`,
                answer,
                type: 'text',
                explanation: `Use a common denominator of ${commonD}: ${n1}/${d1} = ${n1 * d2}/${commonD} and ${n2}/${d2} = ${n2 * d1}/${commonD}.\n${op === '+' ? 'Add' : 'Subtract'} the numerators: ${n1 * d2} ${op} ${n2 * d1} = ${num}, giving ${num}/${commonD}.\nReduced, the answer is ${answer}.`,
            }
        },
    },

    {
        id: 'g6-add-decimals',
        title: 'Add and subtract decimals',
        desc: 'Add or subtract two decimal numbers.',
        generate() {
            const a = randInt(10, 400) / 10
            const b = randInt(10, 300) / 10
            const op = choice(['+', '−'])
            const answer = round(op === '+' ? a + b : a - b, 1)
            return {
                prompt: `Compute:  ${a.toFixed(1)} ${op} ${b.toFixed(1)}`,
                answer,
                type: 'numeric',
                tolerance: 0.001,
                explanation: `Line up the decimal points.\n${a.toFixed(1)} ${op} ${b.toFixed(1)} = ${answer.toFixed(1)}.\nThe answer is ${answer}.`,
            }
        },
    },

    {
        id: 'g6-exponents',
        title: 'Evaluate exponents',
        desc: 'Compute a small power a^b.',
        generate() {
            const base = randInt(2, 10)
            const exp = base <= 4 ? randInt(2, 3) : 2
            const answer = base ** exp
            return {
                prompt: `${base}^${exp} = ?`,
                answer,
                type: 'integer',
                explanation: `The exponent means multiply ${base} by itself ${exp} times.\n${base}^${exp} = ${Array(exp).fill(base).join(' × ')}.\n= ${answer}.`,
            }
        },
    },

    {
        id: 'g6-order-of-operations',
        title: 'Order of operations',
        desc: 'Evaluate an expression using PEMDAS, including an exponent.',
        generate() {
            const a = randInt(1, 12)
            const b = randInt(2, 6)
            const c = randInt(2, 5)
            const answer = a + b * c * c
            return {
                prompt: `${a} + ${b} × ${c}^2 = ?`,
                answer,
                type: 'integer',
                explanation: `Exponent first: ${c}^2 = ${c * c}.\nThen multiply: ${b} × ${c * c} = ${b * c * c}.\nThen add: ${a} + ${b * c * c} = ${answer}.`,
            }
        },
    },

    {
        id: 'g6-integer-add-subtract',
        title: 'Add and subtract integers',
        desc: 'Add or subtract positive and negative integers.',
        generate() {
            const a = randNonZero(-15, 15)
            const b = randNonZero(-15, 15)
            const op = choice(['+', '−'])
            const answer = op === '+' ? a + b : a - b
            return {
                prompt: `${fmt(a)} ${op} (${fmt(b)}) = ?`,
                answer,
                type: 'integer',
                explanation: `Start at ${fmt(a)} on the number line.\n${op === '+' ? 'Adding' : 'Subtracting'} ${fmt(b)} moves ${(op === '+' ? b : -b) >= 0 ? 'right' : 'left'} to ${fmt(answer)}.\n${fmt(a)} ${op} (${fmt(b)}) = ${fmt(answer)}.`,
            }
        },
    },

    {
        id: 'g6-compare-integers',
        title: 'Compare integers',
        desc: 'Choose the correct inequality symbol between two integers.',
        generate() {
            let a = randNonZero(-20, 20)
            let b = randNonZero(-20, 20)
            while (a === b) b = randNonZero(-20, 20)
            const correct = a > b ? '>' : '<'
            const { choices, answer } = mcFrom(correct, ['>', '<', '='])
            return {
                prompt: `Which symbol makes this true?  ${fmt(a)} __ ${fmt(b)}`,
                answer,
                type: 'choice',
                choices,
                explanation: `On the number line, the number farther right is greater.\n${fmt(a)} is ${a > b ? 'to the right of' : 'to the left of'} ${fmt(b)}.\nSo ${fmt(a)} ${correct} ${fmt(b)}.`,
            }
        },
    },

    {
        id: 'g6-evaluate-expression',
        title: 'Evaluate an expression',
        desc: 'Substitute a value for the variable and simplify.',
        generate() {
            const a = randInt(2, 9)
            const b = randNonZero(-9, 9)
            const x = randInt(1, 10)
            const answer = a * x + b
            return {
                prompt: `Evaluate ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} when x = ${x}.`,
                answer,
                type: 'integer',
                explanation: `Substitute x = ${x}: ${a}(${x}) ${b < 0 ? '−' : '+'} ${Math.abs(b)}.\nMultiply: ${a} × ${x} = ${a * x}.\n${a * x} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${fmt(answer)}.`,
            }
        },
    },

    {
        id: 'g6-one-step-equation',
        title: 'One-step equations',
        desc: 'Solve a one-step equation for x.',
        generate() {
            if (choice([true, false])) {
                const a = randNonZero(2, 12)
                const x = randInt(1, 12)
                const b = a * x
                return {
                    prompt: `Solve for x:  ${a}x = ${b}`,
                    answer: x,
                    type: 'integer',
                    explanation: `Undo the multiplication by dividing both sides by ${a}.\nx = ${b} ÷ ${a}.\nx = ${x}.`,
                }
            }
            const x = randInt(1, 20)
            const b = randInt(1, 15)
            const total = x + b
            return {
                prompt: `Solve for x:  x + ${b} = ${total}`,
                answer: x,
                type: 'integer',
                explanation: `Undo the addition by subtracting ${b} from both sides.\nx = ${total} − ${b}.\nx = ${x}.`,
            }
        },
    },

    {
        id: 'g6-quadrant',
        title: 'Coordinate plane quadrants',
        desc: 'Identify which quadrant a point lies in.',
        generate() {
            const x = randNonZero(-9, 9)
            const y = randNonZero(-9, 9)
            let correct
            if (x > 0 && y > 0) correct = 'I'
            else if (x < 0 && y > 0) correct = 'II'
            else if (x < 0 && y < 0) correct = 'III'
            else correct = 'IV'
            const { choices, answer } = mcFrom(correct, ['I', 'II', 'III', 'IV'])
            return {
                prompt: `Which quadrant is the point (${fmt(x)}, ${fmt(y)}) in?`,
                answer,
                type: 'choice',
                choices,
                explanation: `Check the sign of x: ${fmt(x)} is ${x > 0 ? 'positive (right)' : 'negative (left)'}.\nCheck the sign of y: ${fmt(y)} is ${y > 0 ? 'positive (up)' : 'negative (down)'}.\nThat corner is Quadrant ${correct}.`,
            }
        },
    },

    {
        id: 'g6-area-triangle',
        title: 'Area of triangles and parallelograms',
        desc: 'Compute the area of a triangle or parallelogram.',
        generate() {
            const base = randInt(3, 20)
            const height = randInt(2, 16)
            if (choice([true, false])) {
                const answer = round((base * height) / 2, 2)
                return {
                    prompt: `A triangle has base ${base} and height ${height}. What is its area?`,
                    answer,
                    type: 'numeric',
                    explanation: `Area of a triangle = 1/2 × base × height.\n= 1/2 × ${base} × ${height} = ${base * height} ÷ 2.\nArea = ${answer}.`,
                }
            }
            const answer = base * height
            return {
                prompt: `A parallelogram has base ${base} and height ${height}. What is its area?`,
                answer,
                type: 'integer',
                explanation: `Area of a parallelogram = base × height.\n= ${base} × ${height}.\nArea = ${answer}.`,
            }
        },
    },

    {
        id: 'g6-mean-median',
        title: 'Mean and median',
        desc: 'Find the mean or median of a small data set.',
        generate() {
            const wantMean = choice([true, false])
            if (wantMean) {
                // Pick a count and a target mean so the mean is a whole number.
                const count = choice([4, 5])
                const mean = randInt(3, 20)
                // Build values summing to mean*count.
                const vals = []
                let remaining = mean * count
                for (let i = 0; i < count - 1; i++) {
                    const maxV = Math.min(30, remaining - (count - 1 - i) * 1)
                    const minV = Math.max(1, remaining - (count - 1 - i) * 30)
                    const v = randInt(Math.max(1, minV), Math.max(1, maxV))
                    vals.push(v)
                    remaining -= v
                }
                vals.push(remaining)
                const answer = mean
                return {
                    prompt: `Find the mean of: ${vals.join(', ')}.`,
                    answer,
                    type: 'numeric',
                    explanation: `Add the values: ${vals.join(' + ')} = ${vals.reduce((s, v) => s + v, 0)}.\nDivide by how many there are (${count}): ${vals.reduce((s, v) => s + v, 0)} ÷ ${count}.\nMean = ${answer}.`,
                }
            }
            // Median of an odd-length set.
            const count = 5
            const vals = []
            for (let i = 0; i < count; i++) vals.push(randInt(1, 40))
            const sorted = [...vals].sort((a, b) => a - b)
            const answer = sorted[Math.floor(count / 2)]
            return {
                prompt: `Find the median of: ${vals.join(', ')}.`,
                answer,
                type: 'numeric',
                explanation: `Put the values in order: ${sorted.join(', ')}.\nThe median is the middle value of ${count} numbers.\nMedian = ${answer}.`,
            }
        },
    },
]

export default skills

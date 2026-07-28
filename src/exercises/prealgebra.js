/**
 * Pre-Algebra (Middle School, grades 6–8) practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 */

import {
    randInt,
    randNonZero,
    choice,
    gcd,
    lcm,
    reduceFraction,
    round,
    withSign,
    mcFrom,
} from './helpers.js'

// Render a signed integer using the minus glyph for negatives, e.g. -4 -> "−4".
const fmt = (n) => (n < 0 ? `−${Math.abs(n)}` : `${n}`)

// A fraction a/b (already reduced) terminates as a decimal iff its denominator
// has no prime factors other than 2 and 5.
const isTerminating = (d) => {
    let x = Math.abs(d)
    while (x % 2 === 0) x /= 2
    while (x % 5 === 0) x /= 5
    return x === 1
}

const isPrime = (n) => {
    if (n < 2) return false
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
    return true
}

// Prime factorization of n as an ordered list of [prime, exponent] pairs.
const primeFactors = (n) => {
    const out = []
    let x = n
    for (let p = 2; p * p <= x; p++) {
        let e = 0
        while (x % p === 0) {
            x /= p
            e++
        }
        if (e > 0) out.push([p, e])
    }
    if (x > 1) out.push([x, 1])
    return out
}

const skills = [
    {
        id: 'pre-proportion',
        title: 'Solve a proportion',
        desc: 'Find the unknown value that makes two ratios equal.',
        generate() {
            const k = randInt(2, 6)
            const a = randInt(2, 9)
            const b = randInt(2, 9)
            const c = b * k
            const answer = a * k
            return {
                prompt: `Solve for x:  ${a}/${b} = x/${c}`,
                answer,
                type: 'integer',
                explanation: `The denominator grows from ${b} to ${c}: ${c} ÷ ${b} = ${k}.\nMultiply the numerator by the same factor: x = ${a} × ${k}.\nx = ${answer}.`,
            }
        },
    },

    {
        id: 'pre-absolute-value',
        title: 'Absolute value',
        desc: 'Evaluate an expression involving absolute value.',
        generate() {
            const a = randNonZero(-12, 12)
            const b = randNonZero(-12, 12)
            const answer = Math.abs(a - b)
            return {
                prompt: `Evaluate:  |${a} − (${b})|`,
                answer,
                type: 'integer',
                explanation: `Subtract inside the bars: ${a} − (${b}) = ${a - b}.\nAbsolute value is the distance from 0, so |${a - b}| = ${answer}.\nAnswer: ${answer}.`,
            }
        },
    },

    {
        id: 'pre-integer-operations',
        title: 'Integer operations with negatives',
        desc: 'Add, subtract, or multiply positive and negative integers.',
        generate() {
            const op = choice(['+', '−', '×'])
            let a
            let b
            let answer
            if (op === '+') {
                a = randNonZero(-12, 12)
                b = randInt(1, 12)
                answer = a + b
            } else if (op === '−') {
                a = randNonZero(-12, 12)
                b = randInt(1, 12)
                answer = a - b
            } else {
                a = randNonZero(-9, 9)
                b = randNonZero(-9, 9)
                answer = a * b
            }
            const prompt =
                op === '×'
                    ? `${fmt(a)} × ${fmt(b)} = ?`
                    : `${fmt(a)} ${op} ${b} = ?`
            return {
                prompt,
                answer,
                type: 'integer',
                explanation:
                    op === '×'
                        ? `Multiply the values: ${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(answer)}.\nSame signs give a positive, different signs a negative, so the result is ${a * b < 0 ? 'negative' : 'positive'}.\n${fmt(a)} × ${fmt(b)} = ${fmt(answer)}.`
                        : `Start at ${fmt(a)} on the number line.\n${op === '+' ? 'Adding' : 'Subtracting'} ${b} ${op === '+' ? 'moves right' : 'moves left'} to ${fmt(answer)}.\n${fmt(a)} ${op} ${b} = ${fmt(answer)}.`,
            }
        },
    },

    {
        id: 'pre-order-of-operations',
        title: 'Order of operations with exponents',
        desc: 'Evaluate an expression using PEMDAS, including an exponent.',
        generate() {
            if (choice([true, false])) {
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
            }
            const a = randInt(1, 6)
            const b = randInt(1, 6)
            const c = randInt(1, 20)
            const answer = (a + b) ** 2 - c
            return {
                prompt: `(${a} + ${b})^2 − ${c} = ?`,
                answer,
                type: 'integer',
                explanation: `Parentheses first: (${a} + ${b}) = ${a + b}.\nThen the exponent: ${a + b}^2 = ${(a + b) ** 2}.\nThen subtract: ${(a + b) ** 2} − ${c} = ${fmt(answer)}.`,
            }
        },
    },

    {
        id: 'pre-gcf',
        title: 'Greatest common factor',
        desc: 'Find the greatest common factor (GCF) of two numbers.',
        generate() {
            const g = randInt(2, 9)
            const a = g * randInt(2, 9)
            const b = g * randInt(2, 9)
            const answer = gcd(a, b)
            return {
                prompt: `What is the GCF of ${a} and ${b}?`,
                answer,
                type: 'integer',
                explanation: `List the factors each number shares.\n${answer} divides both: ${a} = ${answer} × ${a / answer} and ${b} = ${answer} × ${b / answer}.\nNo larger number divides both, so the GCF is ${answer}.`,
            }
        },
    },

    {
        id: 'pre-lcm',
        title: 'Least common multiple',
        desc: 'Find the least common multiple (LCM) of two numbers.',
        generate() {
            const a = randInt(2, 12)
            const b = randInt(2, 12)
            const answer = lcm(a, b)
            return {
                prompt: `What is the LCM of ${a} and ${b}?`,
                answer,
                type: 'integer',
                explanation: `The LCM must be a multiple of both ${a} and ${b}.\nCheck: ${answer} = ${a} × ${answer / a} and ${answer} = ${b} × ${answer / b}.\nThe smallest such multiple is ${answer}.`,
            }
        },
    },

    {
        id: 'pre-prime-factorization',
        title: 'Prime factorization',
        desc: 'Write a number as a product of prime factors in exponent form.',
        generate() {
            let n = 0
            do {
                n = randInt(12, 100)
            } while (isPrime(n))
            const factors = primeFactors(n)
            // Canonical exponent form, e.g. "2^2 × 3".
            const exponentForm = factors
                .map(([p, e]) => (e === 1 ? `${p}` : `${p}^${e}`))
                .join(' × ')
            // Fully expanded product, e.g. "2 × 2 × 3".
            const expanded = factors
                .flatMap(([p, e]) => Array(e).fill(p))
                .join(' × ')
            const accepted = [
                expanded,
                expanded.replace(/ × /g, '·'),
                exponentForm.replace(/ × /g, '·'),
                exponentForm.replace(/ × /g, '*'),
                expanded.replace(/ × /g, '*'),
            ]
            return {
                prompt: `Write the prime factorization of ${n} (use ^ for exponents).`,
                answer: exponentForm,
                type: 'text',
                accepted,
                explanation: `Break ${n} into prime factors: ${n} = ${expanded}.\nGroup repeated primes as powers.\n${n} = ${exponentForm}.`,
            }
        },
    },

    {
        id: 'pre-unit-rate',
        title: 'Ratios and unit rate',
        desc: 'Find the unit rate (cost per single item) from a ratio.',
        generate() {
            const qty = randInt(2, 12)
            const per = randInt(2, 20)
            const total = per * qty
            return {
                prompt: `$${total} for ${qty} items. What is the cost per 1 item, in dollars?`,
                answer: per,
                type: 'integer',
                explanation: `Unit rate means cost for 1 item, so divide total by quantity.\n${total} ÷ ${qty} = ${per}.\nEach item costs $${per}.`,
            }
        },
    },

    {
        id: 'pre-percent-of-number',
        title: 'Percent of a number',
        desc: 'Compute a given percent of a number.',
        generate() {
            const p = choice([5, 10, 15, 20, 25, 30, 40, 50, 60, 75])
            const base = randInt(4, 40) * 5
            const answer = round((p * base) / 100, 2)
            return {
                prompt: `What is ${p}% of ${base}?`,
                answer,
                type: 'numeric',
                explanation: `Write the percent as a fraction: ${p}% = ${p}/100.\nMultiply by the number: ${p}/100 × ${base}.\n${p}% of ${base} = ${answer}.`,
            }
        },
    },

    {
        id: 'pre-percent-change',
        title: 'Percent change',
        desc: 'Find the percent increase or decrease between two amounts.',
        generate() {
            const original = randInt(1, 10) * 20
            const p = choice([5, 10, 15, 20, 25, 50, 75])
            const delta = (original * p) / 100
            const increase = choice([true, false])
            const updated = increase ? original + delta : original - delta
            const dir = increase ? 'increase' : 'decrease'
            return {
                prompt: `A price changes from $${original} to $${updated}. By what percent did it ${dir}? (enter a number)`,
                answer: p,
                type: 'numeric',
                tolerance: 0.1,
                explanation: `Find the change: |${updated} − ${original}| = ${Math.abs(updated - original)}.\nDivide by the original and multiply by 100: ${Math.abs(updated - original)} ÷ ${original} × 100.\nThat is a ${p}% ${dir}.`,
            }
        },
    },

    {
        id: 'pre-one-step-equation',
        title: 'One-step equations',
        desc: 'Solve for x in a one-step equation.',
        generate() {
            if (choice([true, false])) {
                const a = randNonZero(-12, 12)
                const x = randInt(-12, 12)
                const b = x + a
                return {
                    prompt: `Solve for x:  x ${withSign(a)} = ${fmt(b)}`,
                    answer: x,
                    type: 'integer',
                    explanation: `Undo the addition by subtracting ${fmt(a)} from both sides.\nx = ${fmt(b)} − (${fmt(a)}).\nx = ${fmt(x)}.`,
                }
            }
            const a = randNonZero(2, 12)
            const x = randInt(-12, 12)
            const b = a * x
            return {
                prompt: `Solve for x:  ${a}x = ${fmt(b)}`,
                answer: x,
                type: 'integer',
                explanation: `Undo the multiplication by dividing both sides by ${a}.\nx = ${fmt(b)} ÷ ${a}.\nx = ${fmt(x)}.`,
            }
        },
    },

    {
        id: 'pre-two-step-equation',
        title: 'Two-step equations',
        desc: 'Solve for x in a two-step equation of the form ax + b = c.',
        generate() {
            const a = randNonZero(2, 9)
            const x = randInt(-10, 10)
            const b = randNonZero(-10, 10)
            const c = a * x + b
            return {
                prompt: `Solve for x:  ${a}x ${withSign(b)} = ${fmt(c)}`,
                answer: x,
                type: 'integer',
                explanation: `Subtract ${fmt(b)} from both sides: ${a}x = ${fmt(c - b)}.\nDivide both sides by ${a}: x = ${fmt(c - b)} ÷ ${a}.\nx = ${fmt(x)}.`,
            }
        },
    },

    {
        id: 'pre-evaluate-exponents',
        title: 'Evaluate exponents',
        desc: 'Compute a small power a^b.',
        generate() {
            const base = randInt(2, 10)
            const exp = base <= 5 ? randInt(2, 3) : 2
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
        id: 'pre-quadrant',
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
            const distractors = ['I', 'II', 'III', 'IV'].filter((q) => q !== correct)
            const { choices, answer } = mcFrom(correct, distractors)
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
        id: 'pre-probability',
        title: 'Simple probability',
        desc: 'Find the probability of an event as a reduced fraction.',
        generate() {
            const red = randInt(1, 6)
            const blue = randInt(1, 6)
            const green = randInt(1, 6)
            const total = red + blue + green
            const color = choice([
                ['red', red],
                ['blue', blue],
                ['green', green],
            ])
            const [name, count] = color
            const [n, d] = reduceFraction(count, total)
            const answer = `${n}/${d}`
            const accepted = []
            if (isTerminating(d)) accepted.push(String(n / d))
            return {
                prompt: `A bag has ${red} red, ${blue} blue, and ${green} green marbles. If you draw one at random, what is P(${name})? (reduced fraction)`,
                answer,
                type: 'text',
                accepted,
                explanation: `Probability = favorable ÷ total: there are ${count} ${name} out of ${total} marbles.\nP(${name}) = ${count}/${total}.\nReduce to lowest terms: ${answer}.`,
            }
        },
    },
]

export default skills

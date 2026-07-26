/**
 * Problem generators for the Elementary practice band (grades 3-5).
 *
 * Each skill is { id, title, desc, generate() -> Problem }. Every generate()
 * returns a self-consistent problem: the shared checkAnswer accepts
 * String(problem.answer). Randomness happens only inside generate().
 */

import {
    randInt,
    choice,
    formatFraction,
    round,
    mcFrom,
} from './helpers'

// 1. Multiplication facts (up to 12x12).
const multiplicationFacts = {
    id: 'elem-mult-facts',
    title: 'Multiplication facts',
    desc: 'Multiply single numbers up to 12 × 12.',
    generate() {
        const a = randInt(2, 12)
        const b = randInt(2, 12)
        return {
            prompt: `${a} × ${b} = ?`,
            answer: a * b,
            type: 'integer',
            explanation: `${a} × ${b} = ${a * b}.`,
        }
    },
}

// 2. Division facts.
const divisionFacts = {
    id: 'elem-div-facts',
    title: 'Division facts',
    desc: 'Divide evenly using facts up to 12 × 12.',
    generate() {
        const b = randInt(2, 12)
        const q = randInt(2, 12)
        const a = b * q
        return {
            prompt: `${a} ÷ ${b} = ?`,
            answer: q,
            type: 'integer',
            explanation: `${b} × ${q} = ${a}, so ${a} ÷ ${b} = ${q}.`,
        }
    },
}

// 3. Multi-digit multiplication (2-digit x 1- or 2-digit).
const multiDigitMultiplication = {
    id: 'elem-multidigit-mult',
    title: 'Multi-digit multiplication',
    desc: 'Multiply a 2-digit number by a 1- or 2-digit number.',
    generate() {
        const a = randInt(11, 99)
        const b = choice([randInt(2, 9), randInt(11, 99)])
        return {
            prompt: `${a} × ${b} = ?`,
            answer: a * b,
            type: 'integer',
            explanation: `${a} × ${b} = ${a * b}.`,
        }
    },
}

// 4. Long division with a whole-number quotient (no remainder).
const longDivision = {
    id: 'elem-long-division',
    title: 'Long division (no remainder)',
    desc: 'Divide a larger number that splits evenly.',
    generate() {
        const b = randInt(3, 12)
        const q = randInt(11, 99)
        const a = b * q
        return {
            prompt: `${a} ÷ ${b} = ?`,
            answer: q,
            type: 'integer',
            explanation: `${b} × ${q} = ${a}, so ${a} ÷ ${b} = ${q}.`,
        }
    },
}

// 5. Order of operations (no exponents).
const orderOfOperations = {
    id: 'elem-order-ops',
    title: 'Order of operations',
    desc: 'Multiply and divide before you add and subtract.',
    generate() {
        const a = randInt(2, 12)
        const b = randInt(2, 9)
        const c = randInt(2, 9)
        // Form: a  (+ or -)  b × c, keeping the result non-negative.
        const product = b * c
        const useAdd = choice([true, false]) || a - product < 0
        if (useAdd) {
            return {
                prompt: `${a} + ${b} × ${c} = ?`,
                answer: a + product,
                type: 'integer',
                explanation: `First ${b} × ${c} = ${product}, then ${a} + ${product} = ${a + product}.`,
            }
        }
        return {
            prompt: `${a} − ${b} × ${c} = ?`,
            answer: a - product,
            type: 'integer',
            explanation: `First ${b} × ${c} = ${product}, then ${a} − ${product} = ${a - product}.`,
        }
    },
}

// 6. Equivalent fractions (fill in the missing numerator).
const equivalentFractions = {
    id: 'elem-equiv-fractions',
    title: 'Equivalent fractions',
    desc: 'Find the missing numerator that keeps the fractions equal.',
    generate() {
        const denom = randInt(2, 6)
        const numer = randInt(1, denom - 1)
        const factor = randInt(2, 6)
        const newDenom = denom * factor
        const newNumer = numer * factor
        return {
            prompt: `${numer}/${denom} = ?/${newDenom}`,
            answer: newNumer,
            type: 'integer',
            explanation: `${denom} × ${factor} = ${newDenom}, so multiply the top too: ${numer} × ${factor} = ${newNumer}.`,
        }
    },
}

// 7. Add / subtract fractions with like denominators.
const likeFractions = {
    id: 'elem-like-fractions',
    title: 'Add & subtract fractions',
    desc: 'Combine fractions that share a denominator; give the answer in lowest terms.',
    generate() {
        const denom = randInt(3, 12)
        const add = choice([true, false])
        let a = randInt(1, denom - 1)
        let b = randInt(1, denom - 1)
        let resultNumer
        if (add) {
            resultNumer = a + b
        } else {
            if (a < b) {
                ;[a, b] = [b, a]
            }
            resultNumer = a - b
        }
        const op = add ? '+' : '−'
        const answer = formatFraction(resultNumer, denom)
        const accepted = []
        // Include the exact decimal form when it is a whole number or terminates.
        const decimal = resultNumer / denom
        if (Number.isInteger(decimal)) {
            accepted.push(String(decimal))
        }
        return {
            prompt: `${a}/${denom} ${op} ${b}/${denom} = ?  (write in lowest terms)`,
            answer,
            type: 'text',
            accepted,
            explanation: `Keep the denominator ${denom}: ${a} ${op} ${b} = ${resultNumer}, so ${resultNumer}/${denom} = ${answer}.`,
        }
    },
}

// 8. Compare two fractions.
const compareFractions = {
    id: 'elem-compare-fractions',
    title: 'Compare fractions',
    desc: 'Decide whether one fraction is greater, less, or equal.',
    generate() {
        const d1 = randInt(2, 10)
        const d2 = randInt(2, 10)
        const n1 = randInt(1, d1)
        const n2 = randInt(1, d2)
        const left = n1 / d1
        const right = n2 / d2
        let correct
        if (Math.abs(left - right) < 1e-9) correct = '='
        else if (left > right) correct = '>'
        else correct = '<'
        const { choices, answer } = mcFrom(correct, ['>', '<', '='])
        return {
            prompt: `Compare: ${n1}/${d1} ? ${n2}/${d2}  (choose >, <, or =)`,
            answer,
            type: 'choice',
            choices,
            explanation: `${n1}/${d1} = ${round(left, 3)} and ${n2}/${d2} = ${round(right, 3)}, so ${n1}/${d1} ${correct} ${n2}/${d2}.`,
        }
    },
}

// 9. Rounding to the nearest 10 or 100.
const rounding = {
    id: 'elem-rounding',
    title: 'Rounding',
    desc: 'Round a number to the nearest 10 or 100.',
    generate() {
        const place = choice([10, 100])
        const n = place === 10 ? randInt(11, 999) : randInt(101, 9999)
        const answer = Math.round(n / place) * place
        return {
            prompt: `Round ${n} to the nearest ${place}.`,
            answer,
            type: 'integer',
            explanation: `${n} rounds to ${answer} at the nearest ${place}.`,
        }
    },
}

// 10. Add / subtract decimals (money style, 1-2 dp).
const decimalMoney = {
    id: 'elem-decimal-money',
    title: 'Add & subtract decimals',
    desc: 'Work with money-style decimals to one or two places.',
    generate() {
        const dp = choice([1, 2])
        const scale = dp === 1 ? 10 : 100
        const add = choice([true, false])
        let a = randInt(scale, scale * 20) // at least 1.0
        let b = randInt(scale / 10, scale * 20)
        let resultCents
        if (add) {
            resultCents = a + b
        } else {
            if (a < b) {
                ;[a, b] = [b, a]
            }
            resultCents = a - b
        }
        const fmt = (cents) => (cents / scale).toFixed(dp)
        const op = add ? '+' : '−'
        return {
            prompt: `${fmt(a)} ${op} ${fmt(b)} = ?`,
            answer: round(resultCents / scale, dp),
            type: 'numeric',
            tolerance: 0.001,
            explanation: `${fmt(a)} ${op} ${fmt(b)} = ${fmt(resultCents)}.`,
        }
    },
}

// 11. Area & perimeter of a rectangle.
const rectangle = {
    id: 'elem-rectangle',
    title: 'Area & perimeter',
    desc: 'Find the area or perimeter of a rectangle.',
    generate() {
        const w = randInt(2, 20)
        const h = randInt(2, 20)
        const askArea = choice([true, false])
        if (askArea) {
            return {
                prompt: `A rectangle is ${w} units wide and ${h} units tall. What is its area (in square units)?`,
                answer: w * h,
                type: 'integer',
                explanation: `Area = width × height = ${w} × ${h} = ${w * h} square units.`,
            }
        }
        return {
            prompt: `A rectangle is ${w} units wide and ${h} units tall. What is its perimeter (in units)?`,
            answer: 2 * (w + h),
            type: 'integer',
            explanation: `Perimeter = 2 × (width + height) = 2 × (${w} + ${h}) = ${2 * (w + h)} units.`,
        }
    },
}

// Count the divisors of n.
const countFactors = (n) => {
    let count = 0
    for (let i = 1; i <= n; i++) {
        if (n % i === 0) count++
    }
    return count
}

// 12. Factors: "Is N prime?" or "How many factors does N have?"
const factors = {
    id: 'elem-factors',
    title: 'Factors & primes',
    desc: 'Count factors or decide whether a number is prime.',
    generate() {
        const askPrime = choice([true, false])
        if (askPrime) {
            const n = randInt(2, 50)
            const total = countFactors(n)
            const correct = total === 2 ? 'Yes' : 'No'
            const { choices, answer } = mcFrom(correct, [total === 2 ? 'No' : 'Yes'])
            return {
                prompt: `Is ${n} a prime number?  (Yes or No)`,
                answer,
                type: 'choice',
                choices,
                explanation:
                    correct === 'Yes'
                        ? `${n} has exactly two factors (1 and ${n}), so it is prime.`
                        : `${n} has more than two factors, so it is not prime.`,
            }
        }
        const n = randInt(6, 60)
        const total = countFactors(n)
        return {
            prompt: `How many factors does ${n} have?`,
            answer: total,
            type: 'integer',
            explanation: `Counting every number that divides ${n} evenly gives ${total} factors.`,
        }
    },
}

export default [
    {
        id: 'elem-add-subtract-decimals',
        title: 'Add & subtract decimals',
        desc: 'Add or subtract two decimal numbers to the hundredths.',
        generate() {
            const a = randInt(10, 500) / 100
            const b = randInt(10, 500) / 100
            const add = choice([true, false])
            const [x, y] = add ? [a, b] : (a >= b ? [a, b] : [b, a])
            const answer = round(add ? x + y : x - y, 2)
            return {
                prompt: `${add ? 'Add' : 'Subtract'}:  ${x.toFixed(2)} ${add ? '+' : '−'} ${y.toFixed(2)}`,
                answer,
                type: 'numeric',
                tolerance: 0.005,
                explanation: `${x.toFixed(2)} ${add ? '+' : '−'} ${y.toFixed(2)} = ${answer}.`,
            }
        },
    },

    {
        id: 'elem-fraction-of-number',
        title: 'Fraction of a number',
        desc: 'Find a simple fraction of a whole number.',
        generate() {
            const d = choice([2, 3, 4, 5, 6])
            const n = randInt(1, d - 1)
            const whole = d * randInt(2, 9)
            const answer = (whole / d) * n
            return {
                prompt: `What is ${n}/${d} of ${whole}?`,
                answer,
                type: 'integer',
                explanation: `${whole} ÷ ${d} = ${whole / d}, then × ${n} = ${answer}.`,
            }
        },
    },

    multiplicationFacts,
    divisionFacts,
    multiDigitMultiplication,
    longDivision,
    orderOfOperations,
    equivalentFractions,
    likeFractions,
    compareFractions,
    rounding,
    decimalMoney,
    rectangle,
    factors,
]

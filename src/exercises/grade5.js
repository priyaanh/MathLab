/**
 * Problem generators for the Grade 5 practice band.
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
} from './helpers.js'

// 1. Decimal place value: value of a specific digit.
const decimalPlaceValue = {
    id: 'g5-decimal-place-value',
    title: 'Decimal place value',
    desc: 'Name the value of a digit in a decimal number.',
    generate() {
        // Build a number with digits in tens..thousandths.
        const digits = {
            tens: randInt(1, 9),
            ones: randInt(0, 9),
            tenths: randInt(1, 9),
            hundredths: randInt(1, 9),
            thousandths: randInt(1, 9),
        }
        const num =
            digits.tens * 10 +
            digits.ones +
            digits.tenths / 10 +
            digits.hundredths / 100 +
            digits.thousandths / 1000
        const places = [
            { name: 'tens', digit: digits.tens, value: digits.tens * 10 },
            { name: 'ones', digit: digits.ones, value: digits.ones },
            { name: 'tenths', digit: digits.tenths, value: round(digits.tenths / 10, 3) },
            { name: 'hundredths', digit: digits.hundredths, value: round(digits.hundredths / 100, 3) },
            { name: 'thousandths', digit: digits.thousandths, value: round(digits.thousandths / 1000, 3) },
        ]
        const pick = choice(places.filter(p => p.digit !== 0))
        const numStr = num.toFixed(3)
        return {
            prompt: `In ${numStr}, what is the value of the ${pick.name} digit (the ${pick.digit})?`,
            answer: pick.value,
            type: 'numeric',
            tolerance: 0.0005,
            explanation: `The digit ${pick.digit} sits in the ${pick.name} place.\nIts value is ${pick.digit} × (the ${pick.name} place).\nThat gives ${pick.value}.`,
        }
    },
}

// 2. Add & subtract decimals (to the thousandths).
const addSubtractDecimals = {
    id: 'g5-add-subtract-decimals',
    title: 'Add & subtract decimals',
    desc: 'Add or subtract decimals to the thousandths place.',
    generate() {
        const dp = choice([1, 2, 3])
        const scale = Math.pow(10, dp)
        const add = choice([true, false])
        let a = randInt(scale, scale * 100)
        let b = randInt(1, scale * 100)
        if (!add && a < b) [a, b] = [b, a]
        const resultUnits = add ? a + b : a - b
        const fmt = (u) => (u / scale).toFixed(dp)
        const op = add ? '+' : '−'
        return {
            prompt: `${fmt(a)} ${op} ${fmt(b)} = ?`,
            answer: round(resultUnits / scale, dp),
            type: 'numeric',
            tolerance: 0.0005,
            explanation: `Line up the decimal points.\n${add ? 'Add' : 'Subtract'}: ${fmt(a)} ${op} ${fmt(b)}.\nThat gives ${fmt(resultUnits)}.`,
        }
    },
}

// 3. Add & subtract fractions with unlike denominators (reduced).
const unlikeFractions = {
    id: 'g5-unlike-fractions',
    title: 'Add & subtract unlike fractions',
    desc: 'Combine fractions with different denominators; give the answer in lowest terms.',
    generate() {
        const d1 = randInt(2, 9)
        let d2 = randInt(2, 9)
        while (d2 === d1) d2 = randInt(2, 9)
        const add = choice([true, false])
        let n1 = randInt(1, d1 - 1)
        let n2 = randInt(1, d2 - 1)
        // Cross-multiply to a common denominator d1*d2.
        const common = d1 * d2
        let top1 = n1 * d2
        let top2 = n2 * d1
        if (!add && top1 < top2) {
            // Keep the result non-negative by swapping fractions.
            ;[n1, n2] = [n2, n1]
            ;[top1, top2] = [top2, top1]
        }
        const resultTop = add ? top1 + top2 : top1 - top2
        const answer = formatFraction(resultTop, common)
        const op = add ? '+' : '−'
        const accepted = []
        const decimal = resultTop / common
        if (Number.isInteger(decimal)) accepted.push(String(decimal))
        return {
            prompt: `${n1}/${d1} ${op} ${n2}/${d2} = ?  (write in lowest terms)`,
            answer,
            type: 'text',
            accepted,
            explanation: `Use the common denominator ${common}: ${n1}/${d1} = ${top1}/${common} and ${n2}/${d2} = ${top2}/${common}.\n${add ? 'Add' : 'Subtract'} the tops: ${top1} ${op} ${top2} = ${resultTop}.\n${resultTop}/${common} in lowest terms is ${answer}.`,
        }
    },
}

// 4. Multi-digit multiplication (3-digit × 2-digit).
const multiDigitMultiplication = {
    id: 'g5-multidigit-mult',
    title: 'Multi-digit multiplication',
    desc: 'Multiply a 3-digit number by a 2-digit number.',
    generate() {
        const a = randInt(100, 999)
        const b = randInt(11, 99)
        const tens = Math.floor(b / 10) * 10
        const ones = b % 10
        return {
            prompt: `${a} × ${b} = ?`,
            answer: a * b,
            type: 'integer',
            explanation: `Split ${b} into ${tens} + ${ones}.\n${a} × ${tens} = ${a * tens}, and ${a} × ${ones} = ${a * ones}.\nAdd them: ${a * b}.`,
        }
    },
}

// 5. Multi-digit division (whole-number quotient, no remainder).
const multiDigitDivision = {
    id: 'g5-multidigit-division',
    title: 'Multi-digit division',
    desc: 'Divide a large number that splits evenly by a 2-digit number.',
    generate() {
        const b = randInt(11, 40)
        const q = randInt(20, 99)
        const a = b * q
        return {
            prompt: `${a} ÷ ${b} = ?`,
            answer: q,
            type: 'integer',
            explanation: `Ask: what times ${b} makes ${a}?\nCheck: ${b} × ${q} = ${a}.\nSo ${a} ÷ ${b} = ${q}.`,
        }
    },
}

// 6. Multiply fractions (reduced).
const multiplyFractions = {
    id: 'g5-multiply-fractions',
    title: 'Multiply fractions',
    desc: 'Multiply two fractions; give the answer in lowest terms.',
    generate() {
        const d1 = randInt(2, 9)
        const d2 = randInt(2, 9)
        const n1 = randInt(1, d1 - 1)
        const n2 = randInt(1, d2 - 1)
        const top = n1 * n2
        const bottom = d1 * d2
        const answer = formatFraction(top, bottom)
        const accepted = []
        if (Number.isInteger(top / bottom)) accepted.push(String(top / bottom))
        return {
            prompt: `${n1}/${d1} × ${n2}/${d2} = ?  (write in lowest terms)`,
            answer,
            type: 'text',
            accepted,
            explanation: `Multiply the tops: ${n1} × ${n2} = ${top}.\nMultiply the bottoms: ${d1} × ${d2} = ${bottom}.\n${top}/${bottom} in lowest terms is ${answer}.`,
        }
    },
}

// 7. Divide fractions (reduced).
const divideFractions = {
    id: 'g5-divide-fractions',
    title: 'Divide fractions',
    desc: 'Divide one fraction by another; give the answer in lowest terms.',
    generate() {
        const d1 = randInt(2, 9)
        const d2 = randInt(2, 9)
        const n1 = randInt(1, d1 - 1)
        const n2 = randInt(1, d2 - 1)
        // (n1/d1) ÷ (n2/d2) = (n1*d2)/(d1*n2)
        const top = n1 * d2
        const bottom = d1 * n2
        const answer = formatFraction(top, bottom)
        const accepted = []
        if (Number.isInteger(top / bottom)) accepted.push(String(top / bottom))
        return {
            prompt: `${n1}/${d1} ÷ ${n2}/${d2} = ?  (write in lowest terms)`,
            answer,
            type: 'text',
            accepted,
            explanation: `Dividing means multiply by the reciprocal: ${n1}/${d1} × ${d2}/${n2}.\nMultiply across: ${n1} × ${d2} = ${top} over ${d1} × ${n2} = ${bottom}.\n${top}/${bottom} in lowest terms is ${answer}.`,
        }
    },
}

// 8. Multiply decimals.
const multiplyDecimals = {
    id: 'g5-multiply-decimals',
    title: 'Multiply decimals',
    desc: 'Multiply two decimal numbers.',
    generate() {
        const dpA = choice([1, 2])
        const dpB = choice([1, 2])
        const a = randInt(1, 99) / Math.pow(10, dpA)
        const b = randInt(1, 99) / Math.pow(10, dpB)
        const totalDp = dpA + dpB
        const product = round(a * b, totalDp)
        const aStr = a.toFixed(dpA)
        const bStr = b.toFixed(dpB)
        return {
            prompt: `${aStr} × ${bStr} = ?`,
            answer: product,
            type: 'numeric',
            tolerance: 0.0005,
            explanation: `Ignore the points: ${Math.round(a * Math.pow(10, dpA))} × ${Math.round(b * Math.pow(10, dpB))} = ${Math.round(a * Math.pow(10, dpA)) * Math.round(b * Math.pow(10, dpB))}.\nThe factors have ${totalDp} decimal places in total.\nPlace the point: ${aStr} × ${bStr} = ${product}.`,
        }
    },
}

// 9. Divide decimals (whole-number quotient in reach).
const divideDecimals = {
    id: 'g5-divide-decimals',
    title: 'Divide decimals',
    desc: 'Divide a decimal by a whole number or a decimal.',
    generate() {
        // Build so the quotient is a clean decimal: dividend = divisor * quotient.
        const divisorDp = choice([0, 1])
        const divisor = divisorDp === 0 ? randInt(2, 9) : randInt(11, 49) / 10
        const quotient = round(randInt(11, 99) / 10, 1)
        const dividend = round(divisor * quotient, 2)
        const divStr = divisorDp === 0 ? String(divisor) : divisor.toFixed(1)
        return {
            prompt: `${dividend} ÷ ${divStr} = ?`,
            answer: quotient,
            type: 'numeric',
            tolerance: 0.0005,
            explanation: `Ask: what times ${divStr} makes ${dividend}?\nCheck: ${divStr} × ${quotient} = ${dividend}.\nSo ${dividend} ÷ ${divStr} = ${quotient}.`,
        }
    },
}

// 10. Powers of ten.
const powersOfTen = {
    id: 'g5-powers-of-ten',
    title: 'Powers of ten',
    desc: 'Evaluate a power of ten or multiply a number by one.',
    generate() {
        const n = randInt(1, 6)
        const powerVal = Math.pow(10, n)
        const askMultiply = choice([true, false])
        if (!askMultiply) {
            return {
                prompt: `10^${n} = ?`,
                answer: powerVal,
                type: 'integer',
                explanation: `10^${n} means 1 followed by ${n} zeros.\nMultiply ten by itself ${n} times.\n10^${n} = ${powerVal}.`,
            }
        }
        const factor = randInt(2, 99)
        return {
            prompt: `${factor} × 10^${n} = ?`,
            answer: factor * powerVal,
            type: 'integer',
            explanation: `10^${n} = ${powerVal}, which shifts digits left ${n} place(s).\nMultiply ${factor} × ${powerVal}.\nThat gives ${factor * powerVal}.`,
        }
    },
}

// 11. Volume of a rectangular prism.
const volumePrism = {
    id: 'g5-volume-prism',
    title: 'Volume of a rectangular prism',
    desc: 'Find the volume of a rectangular prism (box).',
    generate() {
        const l = randInt(2, 15)
        const w = randInt(2, 15)
        const h = randInt(2, 15)
        return {
            prompt: `A box is ${l} units long, ${w} units wide, and ${h} units tall. What is its volume (in cubic units)?`,
            answer: l * w * h,
            type: 'integer',
            explanation: `Volume = length × width × height.\nBase area: ${l} × ${w} = ${l * w}.\nMultiply by the height: ${l * w} × ${h} = ${l * w * h} cubic units.`,
        }
    },
}

// 12. Coordinate plane: read/plot an ordered pair.
const coordinatePlane = {
    id: 'g5-coordinate-plane',
    title: 'Coordinate plane',
    desc: 'Give the ordered pair for a point on the first-quadrant grid.',
    generate() {
        const x = randInt(0, 10)
        const y = randInt(0, 10)
        const answer = `(${x}, ${y})`
        return {
            prompt: `Start at the origin, move ${x} unit(s) right, then ${y} unit(s) up. Write the point as an ordered pair (x, y).`,
            answer,
            type: 'text',
            accepted: [`(${x},${y})`, `${x},${y}`, `${x}, ${y}`],
            explanation: `The x-coordinate is how far right you move: ${x}.\nThe y-coordinate is how far up you move: ${y}.\nSo the point is ${answer}.`,
        }
    },
}

// 13. Order of operations with exponents (grade 5 introduces powers).
const orderOfOperations = {
    id: 'g5-order-of-operations',
    title: 'Order of operations',
    desc: 'Evaluate an expression using PEMDAS, including a power of ten.',
    generate() {
        const a = randInt(2, 9)
        const b = randInt(2, 9)
        const c = randInt(1, 3)
        const powerVal = Math.pow(10, c)
        // a + b × 10^c, so exponent first, then multiply, then add.
        const answer = a + b * powerVal
        return {
            prompt: `${a} + ${b} × 10^${c} = ?`,
            answer,
            type: 'integer',
            explanation: `Powers first: 10^${c} = ${powerVal}.\nThen multiply: ${b} × ${powerVal} = ${b * powerVal}.\nFinally add: ${a} + ${b * powerVal} = ${answer}.`,
        }
    },
}

// 14. Compare decimals.
const compareDecimals = {
    id: 'g5-compare-decimals',
    title: 'Compare decimals',
    desc: 'Decide which decimal is greater, less, or equal.',
    generate() {
        const dp = choice([2, 3])
        const scale = Math.pow(10, dp)
        const a = randInt(1, scale)
        const b = choice([randInt(1, scale), a]) // sometimes equal
        const left = a / scale
        const right = b / scale
        let correct
        if (a === b) correct = '='
        else if (left > right) correct = '>'
        else correct = '<'
        const { choices, answer } = mcFrom(correct, ['>', '<', '='])
        return {
            prompt: `Compare: ${left.toFixed(dp)} ? ${right.toFixed(dp)}  (choose >, <, or =)`,
            answer,
            type: 'choice',
            choices,
            explanation: `Line up the place values and compare from the left.\n${left.toFixed(dp)} versus ${right.toFixed(dp)}.\nSo ${left.toFixed(dp)} ${correct} ${right.toFixed(dp)}.`,
        }
    },
}

export default [
    decimalPlaceValue,
    addSubtractDecimals,
    unlikeFractions,
    multiDigitMultiplication,
    multiDigitDivision,
    multiplyFractions,
    divideFractions,
    multiplyDecimals,
    divideDecimals,
    powersOfTen,
    volumePrism,
    coordinatePlane,
    orderOfOperations,
    compareDecimals,
]

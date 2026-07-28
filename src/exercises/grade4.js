/**
 * Problem generators for the Grade 4 practice band.
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

// 1. Place value: value of a digit inside a large number.
const placeValue = {
    id: 'g4-place-value',
    title: 'Place value',
    desc: 'Find what a digit is worth in a large number.',
    generate() {
        // Build a 4- to 6-digit number with distinct nonzero digits so the
        // picked digit is unambiguous.
        const len = randInt(4, 6)
        const digits = []
        for (let i = 0; i < len; i++) {
            digits.push(i === 0 ? randInt(1, 9) : randInt(0, 9))
        }
        // Pick a position whose digit is nonzero.
        const nonZeroPositions = digits.map((d, i) => (d !== 0 ? i : -1)).filter(i => i >= 0)
        const pos = choice(nonZeroPositions)
        const digit = digits[pos]
        const placeValueUnit = Math.pow(10, len - 1 - pos)
        const number = Number(digits.join(''))
        const value = digit * placeValueUnit
        const placeNames = { 1: 'ones', 10: 'tens', 100: 'hundreds', 1000: 'thousands', 10000: 'ten-thousands', 100000: 'hundred-thousands' }
        const placeName = placeNames[placeValueUnit]
        return {
            prompt: `In ${number}, what is the value of the digit ${digit}?`,
            answer: value,
            type: 'integer',
            explanation: `The digit ${digit} sits in the ${placeName} place.\nIts value is ${digit} × ${placeValueUnit}.\nThat gives ${value}.`,
        }
    },
}

// 2. Multi-digit addition & subtraction.
const multiDigitAddSub = {
    id: 'g4-add-subtract',
    title: 'Add & subtract',
    desc: 'Add or subtract multi-digit whole numbers.',
    generate() {
        const add = choice([true, false])
        let a = randInt(100, 9999)
        let b = randInt(100, 9999)
        if (!add && a < b) {
            ;[a, b] = [b, a]
        }
        const op = add ? '+' : '−'
        const answer = add ? a + b : a - b
        return {
            prompt: `${a} ${op} ${b} = ?`,
            answer,
            type: 'integer',
            explanation: `Line up the place values (ones under ones, tens under tens).\n${add ? 'Add' : 'Subtract'} column by column: ${a} ${op} ${b}.\nThat gives ${answer}.`,
        }
    },
}

// 3. Multiply a multi-digit number by a 1-digit number.
const multiplyBy1Digit = {
    id: 'g4-multiply-1digit',
    title: 'Multiply by 1-digit',
    desc: 'Multiply a 2- or 3-digit number by a single digit.',
    generate() {
        const a = randInt(12, 999)
        const b = randInt(2, 9)
        const tens = Math.floor(a / 10) * 10
        const ones = a % 10
        return {
            prompt: `${a} × ${b} = ?`,
            answer: a * b,
            type: 'integer',
            explanation: `Break ${a} apart: ${tens} + ${ones}.\n${tens} × ${b} = ${tens * b}, and ${ones} × ${b} = ${ones * b}.\nAdd them: ${a * b}.`,
        }
    },
}

// 4. Multiply a 2-digit number by a 2-digit number.
const multiply2By2 = {
    id: 'g4-multiply-2by2',
    title: 'Multiply 2-digit by 2-digit',
    desc: 'Multiply two 2-digit numbers.',
    generate() {
        const a = randInt(11, 99)
        const b = randInt(11, 99)
        const bTens = Math.floor(b / 10) * 10
        const bOnes = b % 10
        return {
            prompt: `${a} × ${b} = ?`,
            answer: a * b,
            type: 'integer',
            explanation: `Split ${b} into ${bTens} + ${bOnes}.\n${a} × ${bTens} = ${a * bTens}, and ${a} × ${bOnes} = ${a * bOnes}.\nAdd the partial products: ${a * b}.`,
        }
    },
}

// 5. Division with remainders (answer given as quotient integer).
const divisionRemainder = {
    id: 'g4-division-remainder',
    title: 'Division with remainders',
    desc: 'Divide and give the quotient, ignoring the remainder.',
    generate() {
        const b = randInt(3, 9)
        const q = randInt(11, 99)
        const r = randInt(1, b - 1)
        const a = b * q + r
        return {
            prompt: `${a} ÷ ${b} = ?  (give the whole-number quotient, ignore the remainder)`,
            answer: q,
            type: 'integer',
            explanation: `${b} × ${q} = ${b * q}, which is the largest multiple of ${b} not past ${a}.\nWhat is left over is ${a} − ${b * q} = ${r} (the remainder).\nThe quotient is ${q}.`,
        }
    },
}

// 6. Factors & multiples: is N prime, or name a factor (choice).
const factorsMultiples = {
    id: 'g4-factors-multiples',
    title: 'Factors & multiples',
    desc: 'Decide if a number is prime or pick a factor of it.',
    generate() {
        const askPrime = choice([true, false])
        if (askPrime) {
            const n = randInt(2, 40)
            let isPrime = n > 1
            for (let i = 2; i * i <= n; i++) {
                if (n % i === 0) { isPrime = false; break }
            }
            const correct = isPrime ? 'Yes' : 'No'
            const { choices, answer } = mcFrom(correct, [isPrime ? 'No' : 'Yes'])
            return {
                prompt: `Is ${n} a prime number?  (Yes or No)`,
                answer,
                type: 'choice',
                choices,
                explanation: isPrime
                    ? `A prime has exactly two factors: 1 and itself.\n${n} divides only by 1 and ${n}.\nSo ${n} is prime.`
                    : `A prime has exactly two factors: 1 and itself.\n${n} can be divided by a number other than 1 and ${n}.\nSo ${n} is not prime.`,
            }
        }
        // Which of these is a factor of N?
        const n = randInt(12, 60)
        const factorList = []
        for (let i = 2; i < n; i++) {
            if (n % i === 0) factorList.push(i)
        }
        const correct = choice(factorList)
        // Build distractors that are NOT factors of n.
        const distractors = []
        let candidate = 2
        while (distractors.length < 3 && candidate < n) {
            if (n % candidate !== 0) distractors.push(candidate)
            candidate++
        }
        const { choices, answer } = mcFrom(correct, distractors)
        return {
            prompt: `Which of these is a factor of ${n}?`,
            answer,
            type: 'choice',
            choices,
            explanation: `A factor divides ${n} with no remainder.\n${n} ÷ ${correct} = ${n / correct}, which is a whole number.\nSo ${correct} is a factor of ${n}.`,
        }
    },
}

// 7. Equivalent fractions (fill in the missing numerator).
const equivalentFractions = {
    id: 'g4-equivalent-fractions',
    title: 'Equivalent fractions',
    desc: 'Find the missing numerator that keeps the fractions equal.',
    generate() {
        const denom = randInt(2, 8)
        const numer = randInt(1, denom - 1)
        const factor = randInt(2, 6)
        const newDenom = denom * factor
        const newNumer = numer * factor
        return {
            prompt: `${numer}/${denom} = ?/${newDenom}`,
            answer: newNumer,
            type: 'integer',
            explanation: `The bottom grew by ×${factor}: ${denom} × ${factor} = ${newDenom}.\nMultiply the top by the same ${factor}.\n${numer} × ${factor} = ${newNumer}.`,
        }
    },
}

// 8. Add & subtract fractions with like denominators (answer "a/b").
const likeFractions = {
    id: 'g4-like-fractions',
    title: 'Add & subtract fractions',
    desc: 'Combine fractions that share a denominator; give lowest terms.',
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
        const accepted = [`${resultNumer}/${denom}`]
        const decimal = resultNumer / denom
        if (Number.isInteger(decimal)) accepted.push(String(decimal))
        return {
            prompt: `${a}/${denom} ${op} ${b}/${denom} = ?  (write in lowest terms)`,
            answer,
            type: 'text',
            accepted,
            explanation: `Same denominator, so keep ${denom}.\n${op === '+' ? 'Add' : 'Subtract'} the tops: ${a} ${op} ${b} = ${resultNumer}.\n${resultNumer}/${denom} in lowest terms is ${answer}.`,
        }
    },
}

// 9. Multiply a fraction by a whole number (answer "a/b").
const fractionTimesWhole = {
    id: 'g4-fraction-times-whole',
    title: 'Multiply a fraction by a whole number',
    desc: 'Multiply a unit or proper fraction by a whole number.',
    generate() {
        const denom = randInt(3, 10)
        const numer = randInt(1, denom - 1)
        const whole = randInt(2, 9)
        const resultNumer = numer * whole
        const answer = formatFraction(resultNumer, denom)
        const accepted = [`${resultNumer}/${denom}`]
        const decimal = resultNumer / denom
        if (Number.isInteger(decimal)) accepted.push(String(decimal))
        return {
            prompt: `${whole} × ${numer}/${denom} = ?  (write in lowest terms)`,
            answer,
            type: 'text',
            accepted,
            explanation: `Multiply the top by ${whole}: ${numer} × ${whole} = ${resultNumer}.\nKeep the bottom the same: ${resultNumer}/${denom}.\nIn lowest terms that is ${answer}.`,
        }
    },
}

// 10. Understand decimals: write a fraction of tenths/hundredths as a decimal.
const fractionToDecimal = {
    id: 'g4-fraction-to-decimal',
    title: 'Understand decimals',
    desc: 'Write a fraction of tenths or hundredths as a decimal.',
    generate() {
        const denom = choice([10, 100])
        const numer = denom === 10 ? randInt(1, 9) : randInt(1, 99)
        const value = numer / denom
        const dp = denom === 10 ? 1 : 2
        return {
            prompt: `Write ${numer}/${denom} as a decimal.`,
            answer: round(value, dp),
            type: 'numeric',
            tolerance: 0.001,
            explanation: `${denom} equal parts means each part is worth 0.${denom === 10 ? '1' : '01'}.\n${numer} of them is ${numer} × 0.${denom === 10 ? '1' : '01'}.\nThat gives ${value.toFixed(dp)}.`,
        }
    },
}

// 11. Measuring angles: classify as acute, right, or obtuse (choice).
const classifyAngles = {
    id: 'g4-classify-angles',
    title: 'Measuring angles',
    desc: 'Classify an angle as acute, right, or obtuse.',
    generate() {
        const kind = choice(['acute', 'right', 'obtuse'])
        let deg
        if (kind === 'right') deg = 90
        else if (kind === 'acute') deg = randInt(10, 89)
        else deg = randInt(91, 175)
        const { choices, answer } = mcFrom(kind, ['acute', 'right', 'obtuse'])
        return {
            prompt: `An angle measures ${deg}°. Is it acute, right, or obtuse?`,
            answer,
            type: 'choice',
            choices,
            explanation: `Acute is less than 90°, right is exactly 90°, obtuse is more than 90°.\n${deg}° ${deg < 90 ? 'is less than 90°' : deg === 90 ? 'is exactly 90°' : 'is more than 90°'}.\nSo it is ${kind}.`,
        }
    },
}

// 12. Area & perimeter of a rectangle.
const areaPerimeter = {
    id: 'g4-area-perimeter',
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
                explanation: `Area of a rectangle = width × height.\nMultiply ${w} × ${h}.\nArea = ${w * h} square units.`,
            }
        }
        return {
            prompt: `A rectangle is ${w} units wide and ${h} units tall. What is its perimeter (in units)?`,
            answer: 2 * (w + h),
            type: 'integer',
            explanation: `Perimeter = 2 × (width + height).\nAdd the sides: ${w} + ${h} = ${w + h}.\nDouble it: 2 × ${w + h} = ${2 * (w + h)} units.`,
        }
    },
}

export default [
    placeValue,
    multiDigitAddSub,
    multiplyBy1Digit,
    multiply2By2,
    divisionRemainder,
    factorsMultiples,
    equivalentFractions,
    likeFractions,
    fractionTimesWhole,
    fractionToDecimal,
    classifyAngles,
    areaPerimeter,
]

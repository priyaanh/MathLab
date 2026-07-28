/**
 * Problem generators for the Grade 3 practice band.
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

// 1. Multiplication facts (single digit).
const multiplicationFacts = {
    id: 'g3-mult-facts',
    title: 'Multiplication facts',
    desc: 'Multiply two single-digit numbers.',
    generate() {
        const a = randInt(2, 9)
        const b = randInt(2, 9)
        return {
            prompt: `${a} × ${b} = ?`,
            answer: a * b,
            type: 'integer',
            explanation: `Think of ${a} groups of ${b}.\nCount by ${b}s, ${a} times.\n${a} × ${b} = ${a * b}.`,
        }
    },
}

// 2. Division facts.
const divisionFacts = {
    id: 'g3-div-facts',
    title: 'Division facts',
    desc: 'Divide evenly using single-digit facts.',
    generate() {
        const b = randInt(2, 9)
        const q = randInt(2, 9)
        const a = b * q
        return {
            prompt: `${a} ÷ ${b} = ?`,
            answer: q,
            type: 'integer',
            explanation: `Ask: what times ${b} makes ${a}?\n${b} × ${q} = ${a}.\nSo ${a} ÷ ${b} = ${q}.`,
        }
    },
}

// 3. Multiplication as groups / arrays (word problem).
const groupsAndArrays = {
    id: 'g3-groups-arrays',
    title: 'Groups & arrays',
    desc: 'Solve a word problem about equal groups or arrays.',
    generate() {
        const rows = randInt(2, 9)
        const each = randInt(2, 9)
        const asArray = choice([true, false])
        if (asArray) {
            return {
                prompt: `A grid has ${rows} rows with ${each} dots in each row. How many dots are there in all?`,
                answer: rows * each,
                type: 'integer',
                explanation: `Each row has ${each} dots, and there are ${rows} rows.\nMultiply: ${rows} × ${each}.\nThere are ${rows * each} dots.`,
            }
        }
        const thing = choice(['baskets', 'boxes', 'bags', 'shelves'])
        const item = choice(['apples', 'toys', 'books', 'marbles'])
        return {
            prompt: `There are ${rows} ${thing}, and each holds ${each} ${item}. How many ${item} in all?`,
            answer: rows * each,
            type: 'integer',
            explanation: `Each of the ${rows} ${thing} has ${each} ${item}.\nMultiply: ${rows} × ${each}.\nThere are ${rows * each} ${item} in all.`,
        }
    },
}

// 4. Add & subtract within 1000.
const addSubtract1000 = {
    id: 'g3-add-sub-1000',
    title: 'Add & subtract within 1000',
    desc: 'Add or subtract whole numbers up to 1000.',
    generate() {
        const add = choice([true, false])
        if (add) {
            const a = randInt(100, 800)
            const b = randInt(50, 999 - a)
            return {
                prompt: `${a} + ${b} = ?`,
                answer: a + b,
                type: 'integer',
                explanation: `Add the hundreds, tens, and ones.\n${a} + ${b}.\nThat gives ${a + b}.`,
            }
        }
        let a = randInt(200, 999)
        let b = randInt(50, 999)
        if (b > a) { [a, b] = [b, a] }
        return {
            prompt: `${a} − ${b} = ?`,
            answer: a - b,
            type: 'integer',
            explanation: `Subtract the smaller from the larger.\n${a} − ${b}.\nThat gives ${a - b}.`,
        }
    },
}

// 5. Understand fractions (name the shaded fraction).
const nameFraction = {
    id: 'g3-name-fraction',
    title: 'Name the fraction',
    desc: 'Write the fraction that is shaded, as a/b.',
    generate() {
        const denom = randInt(2, 8)
        const shaded = randInt(1, denom)
        return {
            prompt: `A shape is split into ${denom} equal parts and ${shaded} of them are shaded. Write the shaded fraction as a/b.`,
            answer: `${shaded}/${denom}`,
            type: 'text',
            accepted: [formatFraction(shaded, denom)],
            explanation: `The shape has ${denom} equal parts, so the bottom number is ${denom}.\n${shaded} parts are shaded, so the top number is ${shaded}.\nThe fraction is ${shaded}/${denom}.`,
        }
    },
}

// 6. Equivalent fractions (choice).
const equivalentFractions = {
    id: 'g3-equiv-fractions',
    title: 'Equivalent fractions',
    desc: 'Pick the fraction equal to the one given.',
    generate() {
        const denom = choice([2, 3, 4, 5])
        const numer = randInt(1, denom - 1)
        const factor = randInt(2, 4)
        const correct = `${numer * factor}/${denom * factor}`
        // Distractors: same style but not equal.
        const d1 = `${numer * factor + 1}/${denom * factor}`
        const d2 = `${numer * factor}/${denom * factor + 1}`
        const d3 = `${numer + 1}/${denom + 1}`
        const { choices, answer } = mcFrom(correct, [d1, d2, d3])
        return {
            prompt: `Which fraction is equal to ${numer}/${denom}?`,
            answer,
            type: 'choice',
            choices,
            explanation: `Multiply top and bottom by the same number, ${factor}.\n${numer} × ${factor} = ${numer * factor} and ${denom} × ${factor} = ${denom * factor}.\nSo ${numer}/${denom} = ${correct}.`,
        }
    },
}

// 7. Compare fractions (>, <, = choice).
const compareFractions = {
    id: 'g3-compare-fractions',
    title: 'Compare fractions',
    desc: 'Decide whether one fraction is greater, less, or equal.',
    generate() {
        // Keep it grade-3 friendly: often the same numerator or same denominator.
        const style = choice(['sameDenom', 'sameNumer', 'mixed'])
        let n1, d1, n2, d2
        if (style === 'sameDenom') {
            d1 = d2 = randInt(3, 10)
            n1 = randInt(1, d1)
            n2 = randInt(1, d1)
        } else if (style === 'sameNumer') {
            n1 = n2 = randInt(1, 5)
            d1 = randInt(n1 + 1, 10)
            d2 = randInt(n1 + 1, 10)
        } else {
            d1 = randInt(2, 8)
            d2 = randInt(2, 8)
            n1 = randInt(1, d1)
            n2 = randInt(1, d2)
        }
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
            explanation: `Turn each fraction into a decimal.\n${n1}/${d1} = ${round(left, 3)} and ${n2}/${d2} = ${round(right, 3)}.\nSo ${n1}/${d1} ${correct} ${n2}/${d2}.`,
        }
    },
}

// 8. Area of a rectangle.
const rectangleArea = {
    id: 'g3-area-rectangle',
    title: 'Area of a rectangle',
    desc: 'Find the area of a rectangle in square units.',
    generate() {
        const w = randInt(2, 12)
        const h = randInt(2, 12)
        return {
            prompt: `A rectangle is ${w} units wide and ${h} units tall. What is its area (in square units)?`,
            answer: w * h,
            type: 'integer',
            explanation: `Area of a rectangle = width × height.\nMultiply ${w} × ${h}.\nArea = ${w * h} square units.`,
        }
    },
}

// 9. Perimeter of a rectangle.
const rectanglePerimeter = {
    id: 'g3-perimeter-rectangle',
    title: 'Perimeter of a rectangle',
    desc: 'Find the perimeter of a rectangle in units.',
    generate() {
        const w = randInt(2, 15)
        const h = randInt(2, 15)
        return {
            prompt: `A rectangle is ${w} units wide and ${h} units tall. What is its perimeter (in units)?`,
            answer: 2 * (w + h),
            type: 'integer',
            explanation: `Perimeter = 2 × (width + height).\nAdd the sides: ${w} + ${h} = ${w + h}.\nDouble it: 2 × ${w + h} = ${2 * (w + h)} units.`,
        }
    },
}

// 10. Tell / elapsed time (minutes).
const elapsedTime = {
    id: 'g3-elapsed-time',
    title: 'Elapsed time',
    desc: 'Find how many minutes pass between two times.',
    generate() {
        const startHour = randInt(1, 11)
        const startMin = choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
        const elapsed = randInt(1, 11) * 5
        const startTotal = startHour * 60 + startMin
        const endTotal = startTotal + elapsed
        const endHour24 = Math.floor(endTotal / 60)
        const endMin = endTotal % 60
        const endHour = endHour24 > 12 ? endHour24 - 12 : endHour24
        const pad = (m) => String(m).padStart(2, '0')
        return {
            prompt: `A movie starts at ${startHour}:${pad(startMin)} and ends at ${endHour}:${pad(endMin)}. How many minutes long is it?`,
            answer: elapsed,
            type: 'integer',
            explanation: `From ${startHour}:${pad(startMin)} to ${endHour}:${pad(endMin)}.\nCount the minutes that pass: ${endTotal} − ${startTotal} = ${elapsed}.\nThe movie is ${elapsed} minutes long.`,
        }
    },
}

export default [
    multiplicationFacts,
    divisionFacts,
    groupsAndArrays,
    addSubtract1000,
    nameFraction,
    equivalentFractions,
    compareFractions,
    rectangleArea,
    rectanglePerimeter,
    elapsedTime,
]

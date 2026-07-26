/**
 * Early Math (K–2) practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 */

import { randInt, choice, mcFrom } from './helpers.js'

const skills = [
    {
        id: 'early-ten-more-less',
        title: '10 more or 10 less',
        desc: 'Find the number that is 10 more or 10 less.',
        generate() {
            const n = randInt(10, 89)
            const more = choice([true, false])
            const answer = more ? n + 10 : n - 10
            return {
                prompt: `What is 10 ${more ? 'more than' : 'less than'} ${n}?`,
                answer,
                type: 'integer',
                explanation: `${n} ${more ? '+' : '−'} 10 = ${answer}.`,
            }
        },
    },

    {
        id: 'early-missing-addend',
        title: 'Missing addend',
        desc: 'Find the missing number in an addition sentence within 20.',
        generate() {
            const a = randInt(1, 10)
            const sum = a + randInt(1, 10)
            const answer = sum - a
            return {
                prompt: `Fill in the blank:  ${a} + ___ = ${sum}`,
                answer,
                type: 'integer',
                explanation: `${sum} − ${a} = ${answer}.`,
            }
        },
    },

    {
        id: 'early-number-after-before',
        title: 'Number after / before',
        desc: 'Find the number that comes just after or just before a given number.',
        generate() {
            const dir = choice(['after', 'before'])
            // Keep answers within 0..100 and non-negative.
            const n = dir === 'after' ? randInt(0, 99) : randInt(1, 100)
            const answer = dir === 'after' ? n + 1 : n - 1
            return {
                prompt: `What number comes ${dir} ${n}?`,
                answer,
                type: 'integer',
                explanation: `The number just ${dir} ${n} is ${answer}.`,
            }
        },
    },

    {
        id: 'early-add-within-20',
        title: 'Add within 20',
        desc: 'Add two numbers with a sum no greater than 20.',
        generate() {
            const a = randInt(0, 10)
            const b = randInt(0, 20 - a)
            const answer = a + b
            return {
                prompt: `${a} + ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `${a} + ${b} = ${answer}.`,
            }
        },
    },

    {
        id: 'early-subtract-within-20',
        title: 'Subtract within 20',
        desc: 'Subtract two numbers within 20 with a non-negative answer.',
        generate() {
            const a = randInt(0, 20)
            const b = randInt(0, a)
            const answer = a - b
            return {
                prompt: `${a} − ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `${a} − ${b} = ${answer}.`,
            }
        },
    },

    {
        id: 'early-compare-numbers',
        title: 'Compare two numbers',
        desc: 'Choose the sign that makes the comparison true.',
        generate() {
            const a = randInt(0, 50)
            const b = randInt(0, 50)
            const correct = a > b ? '>' : a < b ? '<' : '='
            const distractors = ['>', '<', '='].filter((s) => s !== correct)
            const { choices, answer } = mcFrom(correct, distractors)
            return {
                prompt: `${a} __ ${b}. Which sign makes this true?`,
                answer,
                type: 'choice',
                choices,
                explanation: `${a} ${correct} ${b}, so the sign is "${correct}".`,
            }
        },
    },

    {
        id: 'early-place-value',
        title: 'Place value (tens & ones)',
        desc: 'Identify the number of tens or ones in a two-digit number.',
        generate() {
            const n = randInt(10, 99)
            const place = choice(['tens', 'ones'])
            const answer = place === 'tens' ? Math.floor(n / 10) : n % 10
            return {
                prompt: `In ${n}, how many ${place}?`,
                answer,
                type: 'integer',
                explanation: `${n} has ${Math.floor(n / 10)} tens and ${n % 10} ones, so the ${place} digit is ${answer}.`,
            }
        },
    },

    {
        id: 'early-skip-counting',
        title: 'Skip counting',
        desc: 'Find the next number when counting by 2, 5, or 10.',
        generate() {
            const step = choice([2, 5, 10])
            const start = randInt(1, 9) * step
            const seq = [start, start + step, start + 2 * step]
            const answer = start + 3 * step
            return {
                prompt: `Next number in: ${seq.join(', ')}, __`,
                answer,
                type: 'integer',
                explanation: `The pattern counts by ${step}, so after ${seq[2]} comes ${answer}.`,
            }
        },
    },

    {
        id: 'early-shape-by-sides',
        title: 'Shape by number of sides',
        desc: 'Name the 2D shape that has the given number of sides.',
        generate() {
            const shapes = [
                { name: 'triangle', sides: 3 },
                { name: 'square', sides: 4 },
                { name: 'pentagon', sides: 5 },
                { name: 'hexagon', sides: 6 },
            ]
            const target = choice(shapes)
            const distractors = shapes
                .filter((s) => s.name !== target.name)
                .map((s) => s.name)
            const { choices, answer } = mcFrom(target.name, distractors)
            return {
                prompt: `Which shape has ${target.sides} sides?`,
                answer,
                type: 'choice',
                choices,
                explanation: `A ${target.name} has ${target.sides} sides.`,
            }
        },
    },

    {
        id: 'early-add-two-digit-no-regroup',
        title: 'Add two-digit numbers (no regrouping)',
        desc: 'Add two two-digit numbers within 100 with no carrying.',
        generate() {
            // Ensure each column sum stays ≤ 9 so there is no regrouping.
            const aTens = randInt(1, 8)
            const bTens = randInt(1, 9 - aTens)
            const aOnes = randInt(0, 9)
            const bOnes = randInt(0, 9 - aOnes)
            const a = aTens * 10 + aOnes
            const b = bTens * 10 + bOnes
            const answer = a + b
            return {
                prompt: `${a} + ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `Add ones (${aOnes} + ${bOnes} = ${aOnes + bOnes}) and tens (${aTens * 10} + ${bTens * 10} = ${(aTens + bTens) * 10}) to get ${answer}.`,
            }
        },
    },
]

export default skills

/**
 * Grade 1 practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 */

import { randInt, choice, mcFrom, shuffle } from './helpers.js'

const skills = [
    {
        id: 'g1-place-value',
        title: 'Tens and ones',
        desc: 'Break a two-digit number into tens and ones.',
        generate() {
            const n = randInt(10, 99)
            const tens = Math.floor(n / 10)
            const ones = n % 10
            const askTens = choice([true, false])
            const answer = askTens ? tens : ones
            return {
                prompt: `How many ${askTens ? 'tens' : 'ones'} are in ${n}?`,
                answer,
                type: 'integer',
                explanation: `Look at ${n}.\nIt has ${tens} tens and ${ones} ones.\nSo there are ${answer} ${askTens ? 'tens' : 'ones'}.`,
            }
        },
    },

    {
        id: 'g1-make-number',
        title: 'Tens and ones make a number',
        desc: 'Put tens and ones together to make a number.',
        generate() {
            const tens = randInt(1, 9)
            const ones = randInt(0, 9)
            const answer = tens * 10 + ones
            return {
                prompt: `${tens} tens and ${ones} ones = ?`,
                answer,
                type: 'integer',
                explanation: `${tens} tens is ${tens * 10}.\nAdd ${ones} ones: ${tens * 10} + ${ones}.\nSo the number is ${answer}.`,
            }
        },
    },

    {
        id: 'g1-add-within-20',
        title: 'Add within 20',
        desc: 'Add two numbers with a sum no more than 20.',
        generate() {
            const a = randInt(0, 10)
            const b = randInt(0, 20 - a)
            const answer = a + b
            return {
                prompt: `${a} + ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `Start with ${a}.\nCount up ${b} more.\nThat gives ${a} + ${b} = ${answer}.`,
            }
        },
    },

    {
        id: 'g1-subtract-within-20',
        title: 'Subtract within 20',
        desc: 'Take away a number with an answer of 0 or more.',
        generate() {
            const a = randInt(0, 20)
            const b = randInt(0, a)
            const answer = a - b
            return {
                prompt: `${a} − ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `Start with ${a}.\nTake away ${b}.\nThat leaves ${a} − ${b} = ${answer}.`,
            }
        },
    },

    {
        id: 'g1-add-two-digit-one-digit',
        title: 'Add a two-digit and one-digit number',
        desc: 'Add a one-digit number to a two-digit number within 100.',
        generate() {
            // No regrouping: ones column stays 9 or less.
            const tens = randInt(1, 8)
            const ones = randInt(0, 9)
            const a = tens * 10 + ones
            const b = randInt(0, 9 - ones)
            const answer = a + b
            return {
                prompt: `${a} + ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `Add the ones: ${ones} + ${b} = ${ones + b}.\nKeep the ${tens} tens the same.\nPut them together to get ${answer}.`,
            }
        },
    },

    {
        id: 'g1-compare-two-digit',
        title: 'Compare two-digit numbers',
        desc: 'Choose the sign that makes the comparison true.',
        generate() {
            const a = randInt(10, 99)
            const b = randInt(10, 99)
            const correct = a > b ? '>' : a < b ? '<' : '='
            const distractors = ['>', '<', '='].filter((s) => s !== correct)
            const { choices, answer } = mcFrom(correct, distractors)
            const word = correct === '>' ? 'bigger than' : correct === '<' ? 'smaller than' : 'equal to'
            return {
                prompt: `${a} __ ${b}. Which sign makes this true?`,
                answer,
                type: 'choice',
                choices,
                explanation: `Compare ${a} and ${b}.\n${a} is ${word} ${b}.\nSo the sign is "${correct}".`,
            }
        },
    },

    {
        id: 'g1-compare-length',
        title: 'Compare lengths',
        desc: 'Pick which object is longer or shorter.',
        generate() {
            const items = [
                { name: 'pencil', len: 8 },
                { name: 'crayon', len: 4 },
                { name: 'straw', len: 12 },
                { name: 'paperclip', len: 2 },
                { name: 'ruler', len: 30 },
                { name: 'spoon', len: 15 },
            ]
            const pair = shuffle(items).slice(0, 2)
            const wantLonger = choice([true, false])
            const target = wantLonger
                ? (pair[0].len > pair[1].len ? pair[0] : pair[1])
                : (pair[0].len < pair[1].len ? pair[0] : pair[1])
            const distractors = [pair[0].name, pair[1].name].filter((n) => n !== target.name)
            const { choices, answer } = mcFrom(target.name, distractors)
            return {
                prompt: `A ${pair[0].name} is ${pair[0].len} cm. A ${pair[1].name} is ${pair[1].len} cm. Which one is ${wantLonger ? 'longer' : 'shorter'}?`,
                answer,
                type: 'choice',
                choices,
                explanation: `The ${pair[0].name} is ${pair[0].len} cm and the ${pair[1].name} is ${pair[1].len} cm.\nA ${wantLonger ? 'longer' : 'shorter'} object has ${wantLonger ? 'more' : 'less'} length.\nSo the ${wantLonger ? 'longer' : 'shorter'} one is the ${target.name}.`,
            }
        },
    },

    {
        id: 'g1-time',
        title: 'Tell the time',
        desc: 'Read a clock to the hour or half hour.',
        generate() {
            const hour = randInt(1, 12)
            const half = choice([true, false])
            const answer = `${hour}:${half ? '30' : '00'}`
            // Distractors: different valid clock times.
            const otherHour = hour === 12 ? 1 : hour + 1
            const distractors = [
                `${hour}:${half ? '00' : '30'}`,
                `${otherHour}:${half ? '30' : '00'}`,
                `${otherHour}:${half ? '00' : '30'}`,
            ]
            const { choices, answer: ans } = mcFrom(answer, distractors)
            const handWord = half ? 'points down at the 6 (half past)' : 'points up at the 12 (o’clock)'
            return {
                prompt: `The hour hand is at ${hour} and the minute hand ${handWord}. What time is it?`,
                answer: ans,
                type: 'choice',
                choices,
                explanation: `The hour hand tells us it is around ${hour} o’clock.\nThe minute hand ${half ? 'is on the 6, so it is half past' : 'is on the 12, so it is exactly the hour'}.\nSo the time is ${ans}.`,
            }
        },
    },
]

export default skills

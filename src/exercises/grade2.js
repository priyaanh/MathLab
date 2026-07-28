/**
 * Grade 2 practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 */

import { randInt, choice, mcFrom, shuffle } from './helpers.js'

const skills = [
    {
        id: 'g2-add-sub-within-20',
        title: 'Add & subtract within 20',
        desc: 'Fluently add or subtract two numbers within 20.',
        generate() {
            if (choice([true, false])) {
                const a = randInt(0, 12)
                const b = randInt(0, 20 - a)
                const answer = a + b
                return {
                    prompt: `${a} + ${b} = ?`,
                    answer,
                    type: 'integer',
                    explanation: `Start with ${a}.\nCount up ${b} more.\nThat gives ${a} + ${b} = ${answer}.`,
                }
            }
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
        id: 'g2-place-value-hundreds',
        title: 'Place value to hundreds',
        desc: 'Find the value of a digit in a three-digit number.',
        generate() {
            const n = randInt(100, 999)
            const hundreds = Math.floor(n / 100)
            const tens = Math.floor((n % 100) / 10)
            const ones = n % 10
            const place = choice(['hundreds', 'tens', 'ones'])
            const value = place === 'hundreds' ? hundreds * 100 : place === 'tens' ? tens * 10 : ones
            return {
                prompt: `In ${n}, what is the value of the ${place} digit?`,
                answer: value,
                type: 'integer',
                explanation: `Break ${n} into ${hundreds} hundreds, ${tens} tens, and ${ones} ones.\nThe ${place} digit is ${place === 'hundreds' ? hundreds : place === 'tens' ? tens : ones}, which stands for ${place === 'hundreds' ? `${hundreds} × 100` : place === 'tens' ? `${tens} × 10` : `${ones} × 1`}.\nSo its value is ${value}.`,
            }
        },
    },

    {
        id: 'g2-build-number',
        title: 'Build a number from parts',
        desc: 'Combine hundreds, tens, and ones into a number.',
        generate() {
            const h = randInt(1, 9)
            const t = randInt(0, 9)
            const o = randInt(0, 9)
            const answer = h * 100 + t * 10 + o
            return {
                prompt: `${h} hundreds ${t} tens ${o} ones = ?`,
                answer,
                type: 'integer',
                explanation: `Hundreds: ${h} × 100 = ${h * 100}.\nTens: ${t} × 10 = ${t * 10}, and ones: ${o}.\nAdd them up: ${h * 100} + ${t * 10} + ${o} = ${answer}.`,
            }
        },
    },

    {
        id: 'g2-add-within-100',
        title: 'Add within 100',
        desc: 'Add two numbers with a sum no greater than 100.',
        generate() {
            const a = randInt(10, 89)
            const b = randInt(1, 100 - a)
            const answer = a + b
            return {
                prompt: `${a} + ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `Add the tens: ${Math.floor(a / 10) * 10} + ${Math.floor(b / 10) * 10} = ${(Math.floor(a / 10) + Math.floor(b / 10)) * 10}.\nAdd the ones: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}.\nCombine to get ${a} + ${b} = ${answer}.`,
            }
        },
    },

    {
        id: 'g2-subtract-within-100',
        title: 'Subtract within 100',
        desc: 'Subtract two numbers within 100 with a non-negative answer.',
        generate() {
            const a = randInt(20, 99)
            const b = randInt(1, a)
            const answer = a - b
            return {
                prompt: `${a} − ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `Start at ${a}.\nTake away ${b}.\nThat leaves ${a} − ${b} = ${answer}.`,
            }
        },
    },

    {
        id: 'g2-add-sub-within-1000',
        title: 'Add & subtract within 1000',
        desc: 'Add or subtract three-digit numbers within 1000.',
        generate() {
            if (choice([true, false])) {
                const a = randInt(100, 800)
                const b = randInt(10, 1000 - a)
                const answer = a + b
                return {
                    prompt: `${a} + ${b} = ?`,
                    answer,
                    type: 'integer',
                    explanation: `Add the hundreds, tens, and ones of ${a} and ${b}.\n${a} plus ${b} counts up ${b} from ${a}.\nSo ${a} + ${b} = ${answer}.`,
                }
            }
            const a = randInt(200, 999)
            const b = randInt(10, a)
            const answer = a - b
            return {
                prompt: `${a} − ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `Start at ${a}.\nTake away ${b}.\nSo ${a} − ${b} = ${answer}.`,
            }
        },
    },

    {
        id: 'g2-money-coins',
        title: 'Count coins',
        desc: 'Find the total value of a group of coins in cents.',
        generate() {
            const coins = [
                { name: 'penny', plural: 'pennies', value: 1 },
                { name: 'nickel', plural: 'nickels', value: 5 },
                { name: 'dime', plural: 'dimes', value: 10 },
                { name: 'quarter', plural: 'quarters', value: 25 },
            ]
            const kinds = shuffle(coins).slice(0, randInt(2, 3))
            const parts = kinds.map((c) => ({ ...c, count: randInt(1, 4) }))
            const total = parts.reduce((sum, p) => sum + p.count * p.value, 0)
            const phrase = parts
                .map((p) => `${p.count} ${p.count === 1 ? p.name : p.plural}`)
                .join(', ')
            const lines = parts.map((p) => `${p.count} × ${p.value}¢ = ${p.count * p.value}¢`)
            const distractors = [total + 5, total - 5, total + 10, total - 1].filter((v) => v > 0 && v !== total)
            const { choices, answer } = mcFrom(total, distractors.slice(0, 3))
            return {
                prompt: `How many cents is ${phrase}?`,
                answer,
                type: 'choice',
                choices,
                explanation: `Value of each coin group: ${lines.join('; ')}.\nAdd the groups together.\nThe total is ${total}¢.`,
            }
        },
    },

    {
        id: 'g2-tell-time',
        title: 'Tell time to 5 minutes',
        desc: 'Read a clock time given the hour and minutes.',
        generate() {
            const hour = randInt(1, 12)
            const minute = randInt(0, 11) * 5
            const mm = String(minute).padStart(2, '0')
            const answer = `${hour}:${mm}`
            return {
                prompt: `The hour hand points near ${hour} and the minute hand shows ${minute} minutes past. Write the time (like 3:15).`,
                answer,
                type: 'text',
                accepted: [`${hour}.${mm}`, `${hour} ${mm}`],
                explanation: `The hour is ${hour}.\nThe minutes are ${minute}, written as ${mm}.\nSo the time is ${answer}.`,
            }
        },
    },

    {
        id: 'g2-length-units',
        title: 'Choose the right length unit',
        desc: 'Pick the best unit to measure a real object.',
        generate() {
            const items = [
                { thing: 'the length of a pencil', unit: 'centimeters' },
                { thing: 'the height of a door', unit: 'meters' },
                { thing: 'the width of your hand', unit: 'centimeters' },
                { thing: 'the length of a soccer field', unit: 'meters' },
                { thing: 'the length of a crayon', unit: 'centimeters' },
                { thing: 'the height of a tree', unit: 'meters' },
            ]
            const item = choice(items)
            const { choices, answer } = mcFrom(item.unit, ['centimeters', 'meters'].filter((u) => u !== item.unit))
            return {
                prompt: `Which unit is best to measure ${item.thing}?`,
                answer,
                type: 'choice',
                choices,
                explanation: `Think about how big ${item.thing} is.\nSmall things use centimeters; big things use meters.\nThe best unit is ${item.unit}.`,
            }
        },
    },

    {
        id: 'g2-read-data',
        title: 'Read a picture graph',
        desc: 'Read and compare values from a simple data set.',
        generate() {
            const fruits = ['apples', 'bananas', 'oranges', 'grapes']
            const picked = shuffle(fruits).slice(0, 3)
            const counts = picked.map((f) => ({ name: f, n: randInt(2, 12) }))
            const rows = counts.map((c) => `${c.name}: ${c.n}`).join(', ')
            const mode = choice(['total', 'most', 'diff'])
            if (mode === 'total') {
                const total = counts.reduce((s, c) => s + c.n, 0)
                return {
                    prompt: `Fruit counts — ${rows}. How many pieces of fruit in all?`,
                    answer: total,
                    type: 'integer',
                    explanation: `Add every group: ${counts.map((c) => c.n).join(' + ')}.\nCount them up.\nThe total is ${total}.`,
                }
            }
            if (mode === 'most') {
                const top = counts.reduce((a, b) => (b.n > a.n ? b : a))
                const { choices, answer } = mcFrom(top.name, counts.filter((c) => c.name !== top.name).map((c) => c.name))
                return {
                    prompt: `Fruit counts — ${rows}. Which fruit has the most?`,
                    answer,
                    type: 'choice',
                    choices,
                    explanation: `Compare the counts: ${counts.map((c) => `${c.name} ${c.n}`).join(', ')}.\nThe biggest number is ${top.n}.\nSo the answer is ${top.name}.`,
                }
            }
            const sorted = [...counts].sort((a, b) => b.n - a.n)
            const diff = sorted[0].n - sorted[sorted.length - 1].n
            return {
                prompt: `Fruit counts — ${rows}. How many more ${sorted[0].name} than ${sorted[sorted.length - 1].name}?`,
                answer: diff,
                type: 'integer',
                explanation: `${sorted[0].name} has ${sorted[0].n} and ${sorted[sorted.length - 1].name} has ${sorted[sorted.length - 1].n}.\nSubtract: ${sorted[0].n} − ${sorted[sorted.length - 1].n}.\nThe difference is ${diff}.`,
            }
        },
    },
]

export default skills

/**
 * Kindergarten (grade K) practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 * Language is kept very simple for the youngest learners.
 */

import { randInt, choice, mcFrom } from './helpers.js'

const skills = [
    {
        id: 'gk-count-objects',
        title: 'Count the objects',
        desc: 'Count how many objects are shown.',
        generate() {
            const items = choice([
                { name: 'apple', emoji: '🍎' },
                { name: 'star', emoji: '⭐' },
                { name: 'cat', emoji: '🐱' },
                { name: 'ball', emoji: '⚽' },
                { name: 'flower', emoji: '🌸' },
            ])
            const n = randInt(1, 10)
            const row = items.emoji.repeat(n)
            return {
                prompt: `How many do you see?  ${row}`,
                answer: n,
                type: 'integer',
                explanation: `Point to each ${items.name} and count.\n1, 2, 3 ... up to ${n}.\nThere are ${n}.`,
            }
        },
    },

    {
        id: 'gk-next-number',
        title: 'What comes next',
        desc: 'Say the number that comes next when counting.',
        generate() {
            const n = randInt(0, 19)
            const answer = n + 1
            return {
                prompt: `What number comes right after ${n}?`,
                answer,
                type: 'integer',
                explanation: `Start at ${n}.\nCount up one more.\nThe next number is ${answer}.`,
            }
        },
    },

    {
        id: 'gk-add-within-10',
        title: 'Add within 10',
        desc: 'Add two small numbers that make 10 or less.',
        generate() {
            const a = randInt(0, 9)
            const b = randInt(0, 10 - a)
            const answer = a + b
            return {
                prompt: `${a} + ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `Start with ${a}.\nCount up ${b} more.\nSo ${a} + ${b} = ${answer}.`,
            }
        },
    },

    {
        id: 'gk-subtract-within-10',
        title: 'Take away within 10',
        desc: 'Subtract two small numbers within 10.',
        generate() {
            const a = randInt(0, 10)
            const b = randInt(0, a)
            const answer = a - b
            return {
                prompt: `${a} − ${b} = ?`,
                answer,
                type: 'integer',
                explanation: `Start with ${a}.\nTake away ${b}.\nSo ${a} − ${b} = ${answer}.`,
            }
        },
    },

    {
        id: 'gk-compare-numbers',
        title: 'Which is bigger',
        desc: 'Pick the sign that makes the two numbers true.',
        generate() {
            const a = randInt(0, 10)
            const b = randInt(0, 10)
            const correct = a > b ? '>' : a < b ? '<' : '='
            const distractors = ['>', '<', '='].filter((s) => s !== correct)
            const { choices, answer } = mcFrom(correct, distractors)
            return {
                prompt: `${a} __ ${b}.  Which sign is right?`,
                answer,
                type: 'choice',
                choices,
                explanation: `Look at ${a} and ${b}.\n${a} is ${correct === '>' ? 'bigger than' : correct === '<' ? 'smaller than' : 'the same as'} ${b}.\nSo the sign is "${correct}".`,
            }
        },
    },

    {
        id: 'gk-name-shape',
        title: 'Name the shape',
        desc: 'Name a 2D shape from a simple description.',
        generate() {
            const shapes = [
                { name: 'circle', clue: 'is round with no corners' },
                { name: 'triangle', clue: 'has 3 sides' },
                { name: 'square', clue: 'has 4 sides that are all the same' },
                { name: 'rectangle', clue: 'has 4 sides with 2 long and 2 short' },
            ]
            const target = choice(shapes)
            const distractors = shapes
                .filter((s) => s.name !== target.name)
                .map((s) => s.name)
            const { choices, answer } = mcFrom(target.name, distractors)
            return {
                prompt: `Which shape ${target.clue}?`,
                answer,
                type: 'choice',
                choices,
                explanation: `We want the shape that ${target.clue}.\nThink about each shape.\nThat is a ${target.name}.`,
            }
        },
    },

    {
        id: 'gk-count-by-color',
        title: 'Count one kind',
        desc: 'Count how many of one color are in the group.',
        generate() {
            const red = randInt(1, 5)
            const blue = randInt(1, 5)
            const pick = choice([
                { name: 'red', emoji: '🔴', count: red },
                { name: 'blue', emoji: '🔵', count: blue },
            ])
            const display = '🔴'.repeat(red) + '🔵'.repeat(blue)
            return {
                prompt: `${display}\nHow many ${pick.name} circles?`,
                answer: pick.count,
                type: 'integer',
                explanation: `Look only at the ${pick.name} circles.\nCount just those.\nThere are ${pick.count}.`,
            }
        },
    },
]

export default skills

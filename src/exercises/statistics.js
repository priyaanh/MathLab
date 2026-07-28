/**
 * Problem generators for the Statistics & Probability practice band.
 *
 * Each skill is { id, title, desc, generate() -> Problem }. Every generate()
 * returns a self-consistent problem: the shared checkAnswer accepts
 * String(problem.answer). Randomness happens only inside generate().
 *
 * Conventions used here:
 *  - Data sets are embedded in the prompt as "Data: a, b, c, ...".
 *  - Non-integer statistics use type 'numeric' with a tolerance and a
 *    "round to 2 decimal places" note.
 *  - Probabilities are answered as a reduced fraction "a/b" (type 'text'),
 *    with the exact terminating decimal added to `accepted`.
 */

import {
    randInt,
    choice,
    shuffle,
    formatFraction,
    reduceFraction,
    round,
} from './helpers.js'

// Small factorial for n <= 8 (well within Number precision).
const factorial = (n) => {
    let f = 1
    for (let i = 2; i <= n; i++) f *= i
    return f
}

const nCr = (n, r) => factorial(n) / (factorial(r) * factorial(n - r))
const nPr = (n, r) => factorial(n) / factorial(n - r)

// Denominators whose fractions always terminate as decimals.
const NICE_DENOMS = [2, 4, 5, 8, 10, 20, 25]

// 1. Mean of a small data set.
const meanSkill = {
    id: 'stat-mean',
    title: 'Mean of a data set',
    desc: 'Find the arithmetic mean (average) of a small list of numbers.',
    generate() {
        const n = randInt(4, 6)
        const data = Array.from({ length: n }, () => randInt(1, 20))
        const sum = data.reduce((a, b) => a + b, 0)
        const mean = round(sum / n, 2)
        return {
            prompt:
                `Find the mean of this data set. Round to 2 decimal places if needed.\n` +
                `Data: ${data.join(', ')}`,
            answer: mean,
            type: 'numeric',
            tolerance: 0.01,
            explanation:
                `Add all the values: sum = ${sum}.\n` +
                `Count the values: n = ${n}.\n` +
                `Mean = sum ÷ n = ${sum} ÷ ${n} = ${mean}.`,
        }
    },
}

// 2. Median.
const medianSkill = {
    id: 'stat-median',
    title: 'Median of a data set',
    desc: 'Find the middle value of an ordered data set.',
    generate() {
        const n = choice([5, 6])
        const data = Array.from({ length: n }, () => randInt(1, 30))
        const sorted = [...data].sort((a, b) => a - b)
        let median
        if (n % 2 === 1) {
            median = sorted[(n - 1) / 2]
        } else {
            const lo = sorted[n / 2 - 1]
            const hi = sorted[n / 2]
            median = round((lo + hi) / 2, 2)
        }
        return {
            prompt:
                `Find the median of this data set. Round to 2 decimal places if needed.\n` +
                `Data: ${data.join(', ')}`,
            answer: median,
            type: 'numeric',
            tolerance: 0.01,
            explanation:
                `Sort the data: ${sorted.join(', ')}.\n` +
                (n % 2 === 1
                    ? `With ${n} values (odd count), the median is the single middle value.\n` +
                      `Median = ${median}.`
                    : `With ${n} values (even count), take the two middle values ${sorted[n / 2 - 1]} and ${sorted[n / 2]}.\n` +
                      `Median = (${sorted[n / 2 - 1]} + ${sorted[n / 2]}) ÷ 2 = ${median}.`),
        }
    },
}

// 3. Mode (data designed to have a unique mode).
const modeSkill = {
    id: 'stat-mode',
    title: 'Mode of a data set',
    desc: 'Find the value that appears most often.',
    generate() {
        const pool = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4)
        const [modeVal, a, b, c] = pool
        // modeVal appears 3 times; each other appears once -> unique mode.
        const data = shuffle([modeVal, modeVal, modeVal, a, b, c])
        return {
            prompt:
                `Find the mode (the most frequent value) of this data set.\n` +
                `Data: ${data.join(', ')}`,
            answer: modeVal,
            type: 'integer',
            explanation:
                `Count how often each value appears.\n` +
                `${modeVal} appears 3 times; every other value appears just once.\n` +
                `The most frequent value is the mode, so the mode is ${modeVal}.`,
        }
    },
}

// 4. Range.
const rangeSkill = {
    id: 'stat-range',
    title: 'Range of a data set',
    desc: 'Find the range (maximum minus minimum).',
    generate() {
        const n = randInt(4, 6)
        const data = Array.from({ length: n }, () => randInt(1, 40))
        const max = Math.max(...data)
        const min = Math.min(...data)
        return {
            prompt:
                `Find the range (largest value minus smallest value).\n` +
                `Data: ${data.join(', ')}`,
            answer: max - min,
            type: 'integer',
            explanation:
                `Find the largest value: ${max}.\n` +
                `Find the smallest value: ${min}.\n` +
                `Range = max − min = ${max} − ${min} = ${max - min}.`,
        }
    },
}

// 5. Population standard deviation.
const stdDevSkill = {
    id: 'stat-stddev',
    title: 'Population standard deviation',
    desc: 'Compute the population standard deviation of a small data set.',
    generate() {
        const n = 5
        const data = Array.from({ length: n }, () => randInt(1, 12))
        const sum = data.reduce((a, b) => a + b, 0)
        const mean = sum / n
        const variance =
            data.reduce((acc, x) => acc + (x - mean) ** 2, 0) / n
        const sd = round(Math.sqrt(variance), 2)
        return {
            prompt:
                `Find the population standard deviation. Round to 2 decimal places.\n` +
                `Data: ${data.join(', ')}`,
            answer: sd,
            type: 'numeric',
            tolerance: 0.05,
            explanation:
                `Find the mean: ${sum} ÷ ${n} = ${round(mean, 2)}.\n` +
                `Average the squared deviations from the mean: variance = ${round(variance, 4)}.\n` +
                `Take the square root: SD = √${round(variance, 4)} ≈ ${sd}.`,
        }
    },
}

// 6. Simple probability of an event.
const simpleProbSkill = {
    id: 'stat-simple-prob',
    title: 'Simple probability',
    desc: 'Find the probability of a single event as a reduced fraction.',
    generate() {
        const total = choice(NICE_DENOMS.filter((d) => d >= 4))
        const favorable = randInt(1, total - 1)
        const frac = formatFraction(favorable, total)
        const decimal = String(round(favorable / total, 4))
        return {
            prompt:
                `A bag holds ${total} marbles, of which ${favorable} are red. ` +
                `You draw one marble at random. What is the probability it is red? ` +
                `Give your answer as a reduced fraction a/b.`,
            answer: frac,
            type: 'text',
            accepted: [decimal, `${favorable}/${total}`],
            explanation:
                `Favorable outcomes (red marbles) = ${favorable}; total outcomes = ${total}.\n` +
                `P(red) = favorable ÷ total = ${favorable}/${total}.\n` +
                `Reduce: ${frac} (${decimal}).`,
        }
    },
}

// 7. Probability of two independent events (multiply).
const independentProbSkill = {
    id: 'stat-independent-prob',
    title: 'Probability of independent events',
    desc: 'Multiply the probabilities of two independent events.',
    generate() {
        const d1 = choice([2, 4, 5])
        const d2 = choice([2, 4, 5])
        const n1 = randInt(1, d1 - 1)
        const n2 = randInt(1, d2 - 1)
        const [rn, rd] = reduceFraction(n1 * n2, d1 * d2)
        const frac = formatFraction(rn, rd)
        const decimal = String(round(rn / rd, 4))
        return {
            prompt:
                `Two independent events have probabilities ${n1}/${d1} and ${n2}/${d2}. ` +
                `What is the probability that both occur? ` +
                `Give your answer as a reduced fraction a/b.`,
            answer: frac,
            type: 'text',
            accepted: [decimal, `${n1 * n2}/${d1 * d2}`],
            explanation:
                `For independent events, multiply their probabilities.\n` +
                `P(both) = ${n1}/${d1} × ${n2}/${d2} = ${n1 * n2}/${d1 * d2}.\n` +
                `Reduce: ${frac} (${decimal}).`,
        }
    },
}

// 8. Combinations nCr.
const combinationsSkill = {
    id: 'stat-combinations',
    title: 'Combinations (nCr)',
    desc: 'Count how many ways to choose r items from n (order does not matter).',
    generate() {
        const n = randInt(4, 9)
        const r = randInt(1, n - 1)
        const value = nCr(n, r)
        return {
            prompt: `How many ways can you choose ${r} items from ${n}? Compute ${n}C${r}.`,
            answer: value,
            type: 'integer',
            explanation:
                `Combinations count unordered selections: nCr = n! / (r! × (n−r)!).\n` +
                `${n}C${r} = ${n}! / (${r}! × ${n - r}!).\n` +
                `${n}C${r} = ${value}.`,
        }
    },
}

// 9. Permutations nPr.
const permutationsSkill = {
    id: 'stat-permutations',
    title: 'Permutations (nPr)',
    desc: 'Count how many ordered arrangements of r items from n.',
    generate() {
        const n = randInt(4, 8)
        const r = randInt(1, Math.min(n - 1, 4))
        const value = nPr(n, r)
        return {
            prompt: `How many ordered arrangements of ${r} items from ${n}? Compute ${n}P${r}.`,
            answer: value,
            type: 'integer',
            explanation:
                `Permutations count ordered arrangements: nPr = n! / (n−r)!.\n` +
                `${n}P${r} = ${n}! / ${n - r}!.\n` +
                `${n}P${r} = ${value}.`,
        }
    },
}

// 10. Factorial n! (n <= 8).
const factorialSkill = {
    id: 'stat-factorial',
    title: 'Factorial (n!)',
    desc: 'Compute n! for small n.',
    generate() {
        const n = randInt(2, 8)
        const value = factorial(n)
        const chain = Array.from({ length: n }, (_, i) => n - i).join(' × ')
        return {
            prompt: `Compute ${n}! (the factorial of ${n}).`,
            answer: value,
            type: 'integer',
            explanation:
                `A factorial multiplies every whole number from ${n} down to 1.\n` +
                `${n}! = ${chain}.\n` +
                `${n}! = ${value}.`,
        }
    },
}

// 11. Expected value of a simple distribution.
const expectedValueSkill = {
    id: 'stat-expected-value',
    title: 'Expected value',
    desc: 'Compute the expected value of a simple probability distribution.',
    generate() {
        const D = choice([4, 5, 8, 10])
        // Split D into three positive weights that sum to D.
        const w1 = randInt(1, D - 2)
        const w2 = randInt(1, D - w1 - 1)
        const w3 = D - w1 - w2
        const weights = [w1, w2, w3]
        const values = shuffle([2, 3, 5, 7, 9, 11]).slice(0, 3)
        const ev = round(
            values.reduce((acc, v, i) => acc + v * weights[i], 0) / D,
            2,
        )
        const rows = values
            .map((v, i) => `${v} (${weights[i]}/${D})`)
            .join(', ')
        return {
            prompt:
                `A random variable takes these values with the given probabilities: ` +
                `${rows}. Find the expected value. Round to 2 decimal places if needed.`,
            answer: ev,
            type: 'numeric',
            tolerance: 0.01,
            explanation:
                `Expected value multiplies each value by its probability and sums the results.\n` +
                `E[X] = ` +
                values
                    .map((v, i) => `${v}×${weights[i]}/${D}`)
                    .join(' + ') +
                `.\n` +
                `E[X] = ${ev}.`,
        }
    },
}

// 12. Z-score given a value, mean, and standard deviation.
const zScoreSkill = {
    id: 'stat-z-score',
    title: 'Z-score',
    desc: 'Compute the z-score of a value given the mean and standard deviation.',
    generate() {
        const mean = randInt(20, 80)
        const sd = randInt(2, 12)
        const steps = choice([-3, -2, -1, 1, 2, 3])
        const x = mean + steps * sd + randInt(-1, 1)
        const z = round((x - mean) / sd, 2)
        return {
            prompt:
                `A value is ${x} in a distribution with mean ${mean} and standard ` +
                `deviation ${sd}. Find the z-score. Round to 2 decimal places.`,
            answer: z,
            type: 'numeric',
            tolerance: 0.05,
            explanation:
                `The z-score measures how many standard deviations x is from the mean: z = (x − mean) ÷ sd.\n` +
                `z = (${x} − ${mean}) ÷ ${sd}.\n` +
                `z = ${z}.`,
        }
    },
}

export default [
    {
        id: 'stat-variance',
        title: 'Population variance',
        desc: 'Compute the population variance of a small data set.',
        generate() {
            const n = choice([4, 5])
            const data = Array.from({ length: n }, () => randInt(1, 10))
            const mean = data.reduce((s, x) => s + x, 0) / n
            const answer = round(data.reduce((s, x) => s + (x - mean) ** 2, 0) / n, 2)
            return {
                prompt: `Find the population variance of:  ${data.join(', ')}`,
                answer,
                type: 'numeric',
                tolerance: 0.02,
                explanation:
                    `Find the mean of the data: ${round(mean, 2)}.\n` +
                    `Square each deviation from the mean and average them.\n` +
                    `Variance = ${answer}.`,
            }
        },
    },

    {
        id: 'stat-two-dice-sum',
        title: 'Probability of a dice sum',
        desc: 'Find the probability that two fair dice show a given sum.',
        generate() {
            const target = randInt(2, 12)
            const ways = 6 - Math.abs(7 - target)
            const answer = round(ways / 36, 4)
            return {
                prompt: `Two fair dice are rolled. What is P(sum = ${target})? Give a decimal (4 dp).`,
                answer,
                type: 'numeric',
                tolerance: 0.005,
                explanation:
                    `Two dice have 6 × 6 = 36 equally likely outcomes.\n` +
                    `${ways} of them give a sum of ${target}.\n` +
                    `P(sum = ${target}) = ${ways}/36 ≈ ${answer}.`,
            }
        },
    },

    meanSkill,
    medianSkill,
    modeSkill,
    rangeSkill,
    stdDevSkill,
    simpleProbSkill,
    independentProbSkill,
    combinationsSkill,
    permutationsSkill,
    factorialSkill,
    expectedValueSkill,
    zScoreSkill,
]

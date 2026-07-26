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
                `Sum = ${sum}, count = ${n}. Mean = ${sum} ÷ ${n} = ${mean}.`,
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
                `Ordered: ${sorted.join(', ')}. ` +
                (n % 2 === 1
                    ? `The middle value is ${median}.`
                    : `Average of the two middle values = ${median}.`),
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
                `${modeVal} appears 3 times, more than any other value, so the mode is ${modeVal}.`,
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
            explanation: `Range = ${max} − ${min} = ${max - min}.`,
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
                `Mean = ${round(mean, 2)}. Variance = average of squared ` +
                `deviations = ${round(variance, 4)}. SD = √variance ≈ ${sd}.`,
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
                `P(red) = favorable ÷ total = ${favorable}/${total} = ${frac} ` +
                `(${decimal}).`,
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
                `P(both) = ${n1}/${d1} × ${n2}/${d2} = ${n1 * n2}/${d1 * d2} = ` +
                `${frac} (${decimal}).`,
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
                `${n}C${r} = ${n}! / (${r}! × ${n - r}!) = ${value}.`,
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
                `${n}P${r} = ${n}! / (${n - r}!) = ${value}.`,
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
            explanation: `${n}! = ${chain} = ${value}.`,
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
                `E[X] = Σ value × probability = ` +
                values
                    .map((v, i) => `${v}×${weights[i]}/${D}`)
                    .join(' + ') +
                ` = ${ev}.`,
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
                `z = (x − mean) ÷ sd = (${x} − ${mean}) ÷ ${sd} = ${z}.`,
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
                explanation: `Mean = ${round(mean, 2)}. Variance = mean of squared deviations = ${answer}.`,
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
                explanation: `${ways} of 36 outcomes give ${target}, so P = ${ways}/36 ≈ ${answer}.`,
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

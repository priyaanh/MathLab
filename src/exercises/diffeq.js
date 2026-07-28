/**
 * Differential Equations practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 *
 * Design note: symbolic solutions are hard to string-match, so numeric skills
 * evaluate the closed-form solution at a specific point (exact self-check), and
 * classification / "which function solves it" skills use multiple choice.
 */

import { randInt, randNonZero, choice, round, withSign, mcFrom } from './helpers.js'

// Format e^(coef·x): "e^x", "e^(-x)", or "e^(3x)".
const expTerm = (coef) =>
    coef === 1 ? 'e^x' : coef === -1 ? 'e^(-x)' : `e^(${coef}x)`

const skills = [
    {
        id: 'de-classify',
        title: 'Classify a differential equation',
        desc: 'Identify the order, or whether an ODE is linear or nonlinear.',
        generate() {
            const mode = choice(['order', 'linearity'])
            if (mode === 'order') {
                const second = choice([true, false])
                let ode, correct
                if (second) {
                    const b = randNonZero(-4, 4)
                    const c = randNonZero(-6, 6)
                    ode = `y'' ${withSign(b, "y'")} ${withSign(c, 'y')} = 0`
                    correct = 'second order'
                } else {
                    const a = randNonZero(-5, 5)
                    ode = `y' ${withSign(a, 'y')} = x`
                    correct = 'first order'
                }
                const other = correct === 'second order' ? 'first order' : 'second order'
                const { choices, answer } = mcFrom(correct, [other, 'third order'])
                return {
                    prompt: `What is the order of the differential equation ${ode}?`,
                    answer,
                    type: 'choice',
                    choices,
                    explanation: `The order of an ODE is the order of the highest derivative that appears.\nHere the highest derivative is ${second ? "y'' (a second derivative)" : "y' (a first derivative)"}.\nSo the equation is ${correct}.`,
                }
            }
            // linearity
            const linear = choice([true, false])
            let ode, correct, reason
            if (linear) {
                const a = randNonZero(-4, 4)
                ode = `y' ${withSign(a, 'y')} = x`
                correct = 'linear'
                reason = 'y and y′ each appear to the first power and are not multiplied together'
            } else {
                const kind = choice(['square', 'product'])
                ode = kind === 'square' ? "y' + y^2 = x" : "y·y' = x"
                correct = 'nonlinear'
                reason = kind === 'square'
                    ? 'the term y^2 raises y to a power higher than one'
                    : "the product y·y' multiplies y by its derivative"
            }
            const other = correct === 'linear' ? 'nonlinear' : 'linear'
            const { choices, answer } = mcFrom(correct, [other])
            return {
                prompt: `Is the differential equation ${ode} linear or nonlinear?`,
                answer,
                type: 'choice',
                choices,
                explanation: `A linear ODE has y and its derivatives only to the first power, with no products among them.\nIn ${ode}, ${reason}.\nSo the equation is ${correct}.`,
            }
        },
    },

    {
        id: 'de-separable',
        title: 'Separable ODE dy/dx = ky',
        desc: 'Solve dy/dx = k·y with y(0) = y0 and evaluate the solution.',
        generate() {
            const k = round(randNonZero(-5, 5) / 10, 1)
            const y0 = randInt(1, 6)
            const x = randInt(1, 4)
            const answer = round(y0 * Math.exp(k * x), 2)
            const kx = round(k * x, 2)
            return {
                prompt: `Solve dy/dx = ${k}y with y(0) = ${y0}, then find y(${x}). Round to 2 decimal places.`,
                answer,
                type: 'numeric',
                tolerance: 0.01,
                explanation: `A separable equation dy/dx = ky has solution y = y0·e^(kx).\nWith y0 = ${y0} and k = ${k}: y(x) = ${y0}e^(${k}x).\nEvaluate at x = ${x}: y(${x}) = ${y0}·e^(${kx}) ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'de-exp-growth-decay',
        title: 'Exponential growth / decay',
        desc: 'Use Q(t) = Q0·e^(rt) to find a value at a later time.',
        generate() {
            const grow = choice([true, false])
            const r = round((grow ? 1 : -1) * choice([2, 3, 5, 8, 10]) / 100, 2)
            const q0 = randInt(1, 20) * 10
            const t = randInt(1, 10)
            const answer = round(q0 * Math.exp(r * t), 2)
            const pct = Math.abs(round(r * 100, 0))
            const rt = round(r * t, 2)
            return {
                prompt: `A quantity ${grow ? 'grows' : 'decays'} at a continuous rate of ${pct}% per year. It starts at ${q0}. Find its value after ${t} years (round to 2 decimals).`,
                answer,
                type: 'numeric',
                tolerance: 1,
                explanation: `Continuous ${grow ? 'growth' : 'decay'} follows Q(t) = Q0·e^(rt) with r = ${r}.\nWith Q0 = ${q0} and t = ${t}: Q(${t}) = ${q0}·e^(${rt}).\nEvaluate: Q(${t}) ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'de-first-order-linear',
        title: 'First-order linear ODE',
        desc: "Solve dy/dx + y = b with y(0) = y0 and evaluate.",
        generate() {
            const b = randInt(1, 8)
            const y0 = randInt(0, 10)
            const x = randInt(1, 3)
            const answer = round(b + (y0 - b) * Math.exp(-x), 2)
            return {
                prompt: `Solve dy/dx + y = ${b} with y(0) = ${y0}, then find y(${x}). Round to 2 decimal places.`,
                answer,
                type: 'numeric',
                tolerance: 0.01,
                explanation: `This is first-order linear; the integrating factor is e^x, giving (e^x·y)' = ${b}e^x.\nIntegrating and applying y(0) = ${y0}: y(x) = ${b} + (${y0} − ${b})e^(-x) = ${b} + (${y0 - b})e^(-x).\nEvaluate at x = ${x}: y(${x}) ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'de-characteristic-roots',
        title: 'Characteristic equation roots',
        desc: "Find the larger root of the characteristic equation of y'' + by' + cy = 0.",
        generate() {
            let r1, r2
            do {
                r1 = randNonZero(-5, 5)
                r2 = randNonZero(-5, 5)
            } while (r1 === r2 || r1 + r2 === 0)
            const b = -(r1 + r2)
            const c = r1 * r2
            const answer = Math.max(r1, r2)
            const lo = Math.min(r1, r2)
            return {
                prompt: `For the ODE y'' ${withSign(b, "y'")} ${withSign(c, 'y')} = 0, find the larger root of its characteristic equation.`,
                answer,
                type: 'integer',
                explanation: `Substituting y = e^(rx) gives the characteristic equation r^2 ${withSign(b, 'r')} ${withSign(c)} = 0.\nFactoring: (r − ${answer})(r − ${lo}) = 0, so r = ${answer} or r = ${lo}.\nThe larger root is ${answer}.`,
            }
        },
    },

    {
        id: 'de-verify-solution',
        title: 'Verify a solution',
        desc: 'Choose the function that satisfies a given differential equation.',
        generate() {
            const kind = choice(['exp', 'trig'])
            if (kind === 'exp') {
                const r = choice([2, 3, 4, -2, -3, -4])
                const correct = expTerm(r)
                const { choices, answer } = mcFrom(correct, [
                    expTerm(-r),
                    `${r}x`,
                    `x^${Math.abs(r)}`,
                    'e^x',
                ])
                return {
                    prompt: `Which function satisfies the differential equation y' = ${r}y?`,
                    answer,
                    type: 'choice',
                    choices,
                    explanation: `Try y = ${correct}. Then y' = ${r}·${correct} = ${r}y.\nThis matches y' = ${r}y exactly.\nSo the solution is ${correct}.`,
                }
            }
            // y'' + y = 0
            const correct = 'sin(x)'
            const { choices, answer } = mcFrom(correct, [
                'e^x',
                'e^(-x)',
                'x^2',
                'tan(x)',
            ])
            return {
                prompt: `Which function satisfies the differential equation y'' + y = 0?`,
                answer,
                type: 'choice',
                choices,
                explanation: `Try y = sin(x). Then y' = cos(x) and y'' = −sin(x).\nSubstituting: y'' + y = −sin(x) + sin(x) = 0.\nSo y = sin(x) satisfies the equation.`,
            }
        },
    },
]

export default skills

/**
 * Calculus BC practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 *
 * Design note: BC topics (parametrics, polar, series, Taylor, advanced
 * integration) are largely irrational-valued, so we prefer numeric answers
 * with a tolerance, and pick parameters that keep the arithmetic clean and
 * mechanically checkable.
 */

import { randInt, randNonZero, choice, round, withSign, formatFraction, mcFrom } from './helpers.js'

const factorial = (n) => {
    let f = 1
    for (let i = 2; i <= n; i++) f *= i
    return f
}

const skills = [
    {
        id: 'bc-parametric-derivative',
        title: 'Parametric derivative dy/dx',
        desc: 'Compute dy/dx = (dy/dt)/(dx/dt) for a parametric curve at a value of t.',
        generate() {
            const a = randNonZero(1, 3)
            const b = randNonZero(-4, 4)
            const c = randNonZero(1, 3)
            const d = randNonZero(-4, 4)
            let t0 = randInt(-3, 3)
            while (2 * a * t0 + b === 0) t0 = randInt(-3, 3)
            const dxdt = 2 * a * t0 + b
            const dydt = 2 * c * t0 + d
            const answer = round(dydt / dxdt, 4)
            const xt = `${a}t^2 ${withSign(b, 't')}`
            const yt = `${c}t^2 ${withSign(d, 't')}`
            return {
                prompt: `A curve is given by x(t) = ${xt} and y(t) = ${yt}. Find dy/dx at t = ${t0}.`,
                answer,
                type: 'numeric',
                tolerance: 1e-2,
                explanation: `Differentiate: dx/dt = ${2 * a}t ${withSign(b)} and dy/dt = ${2 * c}t ${withSign(d)}.\nAt t = ${t0}: dx/dt = ${dxdt} and dy/dt = ${dydt}.\ndy/dx = (dy/dt)/(dx/dt) = ${dydt}/${dxdt} = ${answer}.`,
            }
        },
    },

    {
        id: 'bc-polar-to-rectangular',
        title: 'Polar to rectangular coordinates',
        desc: 'Convert a polar point at a special angle to an x- or y-coordinate.',
        generate() {
            const angles = [
                { label: '0', v: 0 },
                { label: 'π/6', v: Math.PI / 6 },
                { label: 'π/4', v: Math.PI / 4 },
                { label: 'π/3', v: Math.PI / 3 },
                { label: 'π/2', v: Math.PI / 2 },
                { label: '2π/3', v: (2 * Math.PI) / 3 },
                { label: '3π/4', v: (3 * Math.PI) / 4 },
                { label: '5π/6', v: (5 * Math.PI) / 6 },
                { label: 'π', v: Math.PI },
            ]
            const ang = choice(angles)
            const r = randInt(2, 8)
            const which = choice(['x', 'y'])
            const value = which === 'x' ? r * Math.cos(ang.v) : r * Math.sin(ang.v)
            const answer = round(value, 4)
            const rule = which === 'x' ? 'cos' : 'sin'
            return {
                prompt: `A point has polar coordinates (r = ${r}, θ = ${ang.label}). Find its ${which}-coordinate.`,
                answer,
                type: 'numeric',
                tolerance: 1e-2,
                explanation: `Conversion: ${which} = r·${rule}(θ).\nSubstitute r = ${r} and θ = ${ang.label}: ${which} = ${r}·${rule}(${ang.label}).\n${which} = ${answer}.`,
            }
        },
    },

    {
        id: 'bc-geometric-series-sum',
        title: 'Infinite geometric series sum',
        desc: 'Sum Σ a·r^n for |r| < 1 using a/(1 − r).',
        generate() {
            const ratios = [
                [1, 2], [1, 3], [2, 3], [1, 4], [3, 4],
                [-1, 2], [-1, 3], [-2, 3], [-1, 4],
            ]
            const [rn, rd] = choice(ratios)
            const a = randNonZero(1, 8)
            const r = rn / rd
            const answer = round(a / (1 - r), 4)
            const rStr = formatFraction(rn, rd)
            return {
                prompt: `Find the sum of the infinite geometric series Σ (n = 0 to ∞) of a·r^n with a = ${a} and r = ${rStr}.`,
                answer,
                type: 'numeric',
                tolerance: 1e-2,
                explanation: `Since |r| = ${formatFraction(Math.abs(rn), rd)} < 1, the series converges to a/(1 − r).\nHere 1 − r = 1 − (${rStr}) = ${round(1 - r, 4)}.\nSum = ${a}/${round(1 - r, 4)} = ${answer}.`,
            }
        },
    },

    {
        id: 'bc-series-convergence',
        title: 'Geometric series convergence',
        desc: 'Decide whether a geometric series converges or diverges.',
        generate() {
            const converge = choice([true, false])
            const conv = [[1, 2], [1, 3], [2, 3], [3, 4], [-1, 2], [-2, 3], [-4, 5]]
            const div = [[3, 2], [5, 4], [4, 3], [2, 1], [-3, 2], [-5, 4], [-7, 5]]
            const [rn, rd] = converge ? choice(conv) : choice(div)
            const rStr = formatFraction(rn, rd)
            const absStr = formatFraction(Math.abs(rn), rd)
            const verdict = converge ? 'converges' : 'diverges'
            const { choices, answer } = mcFrom(verdict, ['converges', 'diverges'])
            return {
                prompt: `Does the geometric series Σ (n = 0 to ∞) of a·r^n with r = ${rStr} converge or diverge?`,
                answer,
                type: 'choice',
                choices,
                explanation: `A geometric series converges exactly when |r| < 1.\nHere |r| = ${absStr} ${converge ? '<' : '≥'} 1.\nTherefore the series ${verdict}.`,
            }
        },
    },

    {
        id: 'bc-maclaurin-coefficient',
        title: 'Maclaurin series coefficient',
        desc: 'Find the coefficient of x^k in the Maclaurin series of e^(a·x).',
        generate() {
            const a = randInt(1, 3)
            const k = randInt(2, 4)
            const num = Math.pow(a, k)
            const fact = factorial(k)
            const answer = round(num / fact, 6)
            return {
                prompt: `In the Maclaurin series of f(x) = e^(${a}x), find the coefficient of x^${k}.`,
                answer,
                type: 'numeric',
                tolerance: 1e-2,
                explanation: `The Maclaurin series of e^u is Σ u^n/n!, so with u = ${a}x the x^${k} coefficient is ${a}^${k}/${k}!.\n${a}^${k} = ${num} and ${k}! = ${fact}.\nCoefficient = ${num}/${fact} = ${answer}.`,
            }
        },
    },

    {
        id: 'bc-advanced-integral',
        title: 'Definite integral (parts or u-substitution)',
        desc: 'Evaluate a definite integral using integration by parts or a u-substitution.',
        generate() {
            const kind = choice(['byparts', 'usub'])
            if (kind === 'byparts') {
                // ∫_0^n x·e^x dx = [e^x(x−1)]_0^n = e^n(n−1) + 1
                const n = randInt(1, 3)
                const value = Math.exp(n) * (n - 1) + 1
                const answer = round(value, 4)
                return {
                    prompt: `Evaluate the definite integral of x·e^x from x = 0 to x = ${n}.`,
                    answer,
                    type: 'numeric',
                    tolerance: 1e-2,
                    explanation: `Integration by parts with u = x, dv = e^x dx gives ∫ x·e^x dx = e^x(x − 1).\nEvaluate from 0 to ${n}: e^${n}(${n} − 1) − e^0(0 − 1) = e^${n}(${n - 1}) + 1.\nResult = ${answer}.`,
                }
            }
            // u-sub: ∫_lo^hi 2x·(x^2+1)^p dx = [(x^2+1)^(p+1)/(p+1)]_lo^hi
            const p = randInt(1, 3)
            const lo = randInt(0, 2)
            const hi = randInt(lo + 1, 3)
            const uLo = lo * lo + 1
            const uHi = hi * hi + 1
            const value = (Math.pow(uHi, p + 1) - Math.pow(uLo, p + 1)) / (p + 1)
            const answer = round(value, 4)
            return {
                prompt: `Evaluate the definite integral of 2x·(x^2 + 1)^${p} from x = ${lo} to x = ${hi}.`,
                answer,
                type: 'numeric',
                tolerance: 1e-2,
                explanation: `Let u = x^2 + 1, so du = 2x dx and the integral becomes ∫ u^${p} du = u^${p + 1}/${p + 1}.\nBack-substitute: [(x^2 + 1)^${p + 1}/${p + 1}] from ${lo} to ${hi} = (${uHi}^${p + 1} − ${uLo}^${p + 1})/${p + 1}.\nResult = ${answer}.`,
            }
        },
    },
]

export default skills

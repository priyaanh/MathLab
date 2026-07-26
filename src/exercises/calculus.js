/**
 * Calculus practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 *
 * Design note: symbolic answers are hard to string-match, so we prefer numeric
 * problems (derivatives/integrals evaluated at a point, definite integrals,
 * limits that yield numbers). The few symbolic skills use type 'text' with a
 * simple canonical form plus `accepted` variants.
 */

import { randInt, randNonZero, choice, round } from './helpers'

// --- small formatting helpers ----------------------------------------------

// Build a polynomial string from terms (highest power first), e.g.
// fmtPoly([{ coef: 6, pow: 2 }, { coef: 5, pow: 0 }]) -> "6x^2 + 5".
const fmtPoly = (terms) => {
    let out = ''
    let first = true
    for (const { coef, pow } of terms) {
        if (coef === 0) continue
        const mag = Math.abs(coef)
        let body
        if (pow === 0) body = `${mag}`
        else if (pow === 1) body = mag === 1 ? 'x' : `${mag}x`
        else body = mag === 1 ? `x^${pow}` : `${mag}x^${pow}`
        if (first) {
            out = (coef < 0 ? '-' : '') + body
            first = false
        } else {
            out += ` ${coef < 0 ? '-' : '+'} ${body}`
        }
    }
    return out === '' ? '0' : out
}

// Superscript variant of a "^n" expression, e.g. "6x^2 + 5" -> "6x² + 5".
const supVariant = (s) => s.replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\^4/g, '⁴')

// Explicit-multiplication variant, e.g. "6x^2 + 5" -> "6*x^2 + 5".
const starVariant = (s) => s.replace(/(\d)x/g, '$1*x')

// All the reasonable spellings of a polynomial expression answer.
const exprVariants = (s) => [s, supVariant(s), starVariant(s), starVariant(supVariant(s))]

const skills = [
    {
        id: 'calc-limit-substitution',
        title: 'Evaluate a limit (direct substitution)',
        desc: 'Evaluate the limit of a continuous polynomial by plugging in.',
        generate() {
            const a = randNonZero(-3, 3)
            const b = randInt(-4, 4)
            const c = randInt(-6, 6)
            const p = randInt(-3, 3)
            const answer = a * p * p + b * p + c
            const f = fmtPoly([{ coef: a, pow: 2 }, { coef: b, pow: 1 }, { coef: c, pow: 0 }])
            return {
                prompt: `Evaluate the limit: lim x→${p} of (${f}).`,
                answer,
                type: 'integer',
                explanation: `The polynomial is continuous, so substitute x = ${p}: ${a}(${p})^2 + ${b}(${p}) + ${c} = ${answer}.`,
            }
        },
    },

    {
        id: 'calc-limit-removable',
        title: 'Limit with a removable discontinuity',
        desc: 'Factor and cancel to evaluate a 0/0 limit.',
        generate() {
            const r = randInt(-4, 4)
            let s = randInt(-4, 4)
            while (s === r) s = randInt(-4, 4)
            // Numerator (x - r)(x - s) = x^2 - (r+s)x + rs, denominator (x - r).
            const B = -(r + s)
            const C = r * s
            const num = fmtPoly([{ coef: 1, pow: 2 }, { coef: B, pow: 1 }, { coef: C, pow: 0 }])
            const den = fmtPoly([{ coef: 1, pow: 1 }, { coef: -r, pow: 0 }])
            const answer = r - s
            return {
                prompt: `Evaluate the limit: lim x→${r} of (${num}) / (${den}).`,
                answer,
                type: 'integer',
                explanation: `The numerator factors as (x − ${r})(x − ${s}). Cancel (x − ${r}) to get (x − ${s}); at x = ${r} this is ${r} − ${s} = ${answer}.`,
            }
        },
    },

    {
        id: 'calc-limit-infinity',
        title: 'Limit at infinity (rational function)',
        desc: 'Compare leading terms of a rational function as x → ∞.',
        generate() {
            const sameDegree = choice([true, false])
            if (sameDegree) {
                // Same degree: limit is ratio of leading coefficients (kept clean).
                const b = randInt(1, 5)
                const k = randInt(-3, 3)
                const a = k === 0 ? b : k * b // multiple of b so the ratio is an integer
                const num = fmtPoly([{ coef: a, pow: 2 }, { coef: randInt(-4, 4), pow: 1 }, { coef: randInt(-4, 4), pow: 0 }])
                const den = fmtPoly([{ coef: b, pow: 2 }, { coef: randInt(-4, 4), pow: 1 }, { coef: randInt(-4, 4), pow: 0 }])
                const answer = a / b
                return {
                    prompt: `Evaluate the limit: lim x→∞ of (${num}) / (${den}).`,
                    answer,
                    type: 'numeric',
                    tolerance: 1e-3,
                    explanation: `Same degree, so the limit is the ratio of leading coefficients: ${a}/${b} = ${answer}.`,
                }
            }
            // Numerator degree lower than denominator: limit is 0.
            const num = fmtPoly([{ coef: randNonZero(-5, 5), pow: 1 }, { coef: randInt(-5, 5), pow: 0 }])
            const den = fmtPoly([{ coef: randNonZero(1, 5), pow: 2 }, { coef: randInt(-4, 4), pow: 1 }, { coef: randInt(-4, 4), pow: 0 }])
            return {
                prompt: `Evaluate the limit: lim x→∞ of (${num}) / (${den}).`,
                answer: 0,
                type: 'integer',
                explanation: 'The numerator has lower degree than the denominator, so the limit is 0.',
            }
        },
    },

    {
        id: 'calc-derivative-expression',
        title: 'Power-rule derivative',
        desc: 'Differentiate a polynomial using the power rule.',
        generate() {
            const cubic = choice([true, false])
            let f, dTerms
            if (cubic) {
                // f = a x^3 + b x  ->  f' = 3a x^2 + b
                const a = randNonZero(1, 3)
                const b = randNonZero(-6, 6)
                f = fmtPoly([{ coef: a, pow: 3 }, { coef: b, pow: 1 }])
                dTerms = [{ coef: 3 * a, pow: 2 }, { coef: b, pow: 0 }]
            } else {
                // f = a x^2 + b x + c  ->  f' = 2a x + b
                const a = randNonZero(1, 4)
                const b = randNonZero(-6, 6)
                const c = randInt(-6, 6)
                f = fmtPoly([{ coef: a, pow: 2 }, { coef: b, pow: 1 }, { coef: c, pow: 0 }])
                dTerms = [{ coef: 2 * a, pow: 1 }, { coef: b, pow: 0 }]
            }
            const canonical = fmtPoly(dTerms)
            return {
                prompt: `Find the derivative of f(x) = ${f}. Write f'(x).`,
                answer: canonical,
                type: 'text',
                accepted: exprVariants(canonical),
                explanation: `Bring down each exponent and reduce it by one: f'(x) = ${canonical}.`,
            }
        },
    },

    {
        id: 'calc-derivative-at-point',
        title: 'Derivative (slope) at a point',
        desc: "Evaluate f'(x) at a given x = a.",
        generate() {
            const a = randNonZero(-3, 3)
            const b = randInt(-4, 4)
            const c = randInt(-5, 5)
            const d = randInt(-5, 5)
            const p = randInt(-3, 3)
            // f = a x^3 + b x^2 + c x + d  ->  f' = 3a x^2 + 2b x + c
            const f = fmtPoly([{ coef: a, pow: 3 }, { coef: b, pow: 2 }, { coef: c, pow: 1 }, { coef: d, pow: 0 }])
            const answer = 3 * a * p * p + 2 * b * p + c
            return {
                prompt: `For f(x) = ${f}, find f'(${p}).`,
                answer,
                type: 'integer',
                explanation: `f'(x) = ${fmtPoly([{ coef: 3 * a, pow: 2 }, { coef: 2 * b, pow: 1 }, { coef: c, pow: 0 }])}. At x = ${p}: f'(${p}) = ${answer}.`,
            }
        },
    },

    {
        id: 'calc-rule-at-point',
        title: 'Product / quotient / chain rule at a point',
        desc: 'Apply a differentiation rule and evaluate at a point.',
        generate() {
            const kind = choice(['product', 'quotient', 'chain'])
            const p = randInt(-2, 2)
            if (kind === 'product') {
                // f = (a x + b)(c x + d) -> f' = a(cx+d) + c(ax+b)
                const a = randNonZero(-3, 3)
                const b = randInt(-4, 4)
                const c = randNonZero(-3, 3)
                const d = randInt(-4, 4)
                const answer = a * (c * p + d) + c * (a * p + b)
                return {
                    prompt: `Let f(x) = (${fmtPoly([{ coef: a, pow: 1 }, { coef: b, pow: 0 }])})(${fmtPoly([{ coef: c, pow: 1 }, { coef: d, pow: 0 }])}). Find f'(${p}).`,
                    answer,
                    type: 'integer',
                    explanation: `Product rule: f'(x) = ${a}(${fmtPoly([{ coef: c, pow: 1 }, { coef: d, pow: 0 }])}) + ${c}(${fmtPoly([{ coef: a, pow: 1 }, { coef: b, pow: 0 }])}). At x = ${p}, f'(${p}) = ${answer}.`,
                }
            }
            if (kind === 'chain') {
                // f = (a x + b)^2 -> f' = 2a(a x + b)
                const a = randNonZero(-3, 3)
                const b = randInt(-4, 4)
                const answer = 2 * a * (a * p + b)
                return {
                    prompt: `Let f(x) = (${fmtPoly([{ coef: a, pow: 1 }, { coef: b, pow: 0 }])})^2. Find f'(${p}).`,
                    answer,
                    type: 'integer',
                    explanation: `Chain rule: f'(x) = 2·${a}·(${fmtPoly([{ coef: a, pow: 1 }, { coef: b, pow: 0 }])}). At x = ${p}, f'(${p}) = ${answer}.`,
                }
            }
            // quotient: f = (a x + b)/(c x + d) -> f' = (ad - bc)/(c x + d)^2
            const a = randNonZero(-3, 3)
            const b = randInt(-4, 4)
            const c = randNonZero(1, 3)
            let d = randInt(-4, 4)
            while (c * p + d === 0) d = randInt(-4, 4)
            const denom = c * p + d
            const answer = round((a * d - b * c) / (denom * denom), 6)
            return {
                prompt: `Let f(x) = (${fmtPoly([{ coef: a, pow: 1 }, { coef: b, pow: 0 }])}) / (${fmtPoly([{ coef: c, pow: 1 }, { coef: d, pow: 0 }])}). Find f'(${p}).`,
                answer,
                type: 'numeric',
                tolerance: 1e-3,
                explanation: `Quotient rule: f'(x) = (${a * d - b * c}) / (${fmtPoly([{ coef: c, pow: 1 }, { coef: d, pow: 0 }])})^2. At x = ${p}, the denominator is ${denom}^2 = ${denom * denom}, so f'(${p}) = ${answer}.`,
            }
        },
    },

    {
        id: 'calc-tangent-line',
        title: 'Equation of the tangent line',
        desc: 'Find the tangent line to a parabola at x = a.',
        generate() {
            let a, p, q, m, b
            do {
                a = randNonZero(-3, 3)
                p = randInt(-3, 3)
                q = randInt(-4, 4)
                // f = x^2 + p x + q ; f'(x) = 2x + p
                m = 2 * a + p
                b = q - a * a // y-intercept = f(a) - m·a
            } while (m === 0 || m === 1 || m === -1)
            const f = fmtPoly([{ coef: 1, pow: 2 }, { coef: p, pow: 1 }, { coef: q, pow: 0 }])
            const line = fmtPoly([{ coef: m, pow: 1 }, { coef: b, pow: 0 }])
            const canonical = `y = ${line}`
            return {
                prompt: `Find the equation of the tangent line to f(x) = ${f} at x = ${a}. Write it as y = mx + b.`,
                answer: canonical,
                type: 'text',
                accepted: [canonical, `y=${line}`, starVariant(canonical), starVariant(`y=${line}`)],
                explanation: `f'(x) = ${fmtPoly([{ coef: 2, pow: 1 }, { coef: p, pow: 0 }])}, so m = f'(${a}) = ${m}. f(${a}) = ${a * a + p * a + q}, giving b = ${b}. Tangent: ${canonical}.`,
            }
        },
    },

    {
        id: 'calc-indefinite-integral',
        title: 'Indefinite integral (power rule)',
        desc: 'Integrate a monomial using the power rule.',
        generate() {
            const n = randInt(1, 4) // integrate x^n type after scaling
            const k = randInt(1, 3) // resulting leading coefficient
            const coef = k * (n + 1) // so ∫ coef·x^n dx = k·x^(n+1) + C
            const integrand = fmtPoly([{ coef, pow: n }])
            const antiTerm = fmtPoly([{ coef: k, pow: n + 1 }])
            const canonical = `${antiTerm} + C`
            const noSpace = `${antiTerm}+C`
            return {
                prompt: `Find the indefinite integral: ∫ ${integrand} dx.`,
                answer: canonical,
                type: 'text',
                accepted: [
                    canonical,
                    noSpace,
                    supVariant(canonical),
                    starVariant(canonical),
                    antiTerm, // allow the answer without "+ C"
                    supVariant(antiTerm),
                ],
                explanation: `Add one to the exponent and divide: ∫ ${coef}x^${n} dx = ${coef}/${n + 1}·x^${n + 1} + C = ${canonical}.`,
            }
        },
    },

    {
        id: 'calc-definite-integral',
        title: 'Definite integral of a polynomial',
        desc: 'Evaluate a definite integral over [a, b].',
        generate() {
            // Antiderivative A x^3 + B x^2 + C x has integrand 3A x^2 + 2B x + C,
            // so the definite integral over integer bounds is an integer.
            const A = randNonZero(1, 3)
            const B = randInt(-3, 3)
            const C = randInt(-4, 4)
            let lo = randInt(-2, 2)
            let hi = randInt(-2, 3)
            while (hi <= lo) hi = randInt(-2, 3)
            const integrand = fmtPoly([{ coef: 3 * A, pow: 2 }, { coef: 2 * B, pow: 1 }, { coef: C, pow: 0 }])
            const F = (x) => A * x * x * x + B * x * x + C * x
            const answer = F(hi) - F(lo)
            return {
                prompt: `Evaluate the definite integral of (${integrand}) from x = ${lo} to x = ${hi}.`,
                answer,
                type: 'integer',
                explanation: `An antiderivative is F(x) = ${fmtPoly([{ coef: A, pow: 3 }, { coef: B, pow: 2 }, { coef: C, pow: 1 }])}. Result = F(${hi}) − F(${lo}) = ${F(hi)} − ${F(lo)} = ${answer}.`,
            }
        },
    },

    {
        id: 'calc-critical-point',
        title: 'Critical point (f′(x) = 0)',
        desc: 'Find the x-value where the derivative is zero.',
        generate() {
            // f = a x^2 + b x + c, with b = 2a·m so the critical point x = -m is an integer.
            const a = randNonZero(1, 3)
            const m = randNonZero(-4, 4)
            const b = 2 * a * m
            const c = randInt(-6, 6)
            const answer = -m
            const f = fmtPoly([{ coef: a, pow: 2 }, { coef: b, pow: 1 }, { coef: c, pow: 0 }])
            return {
                prompt: `Find the x-value of the critical point of f(x) = ${f} (where f'(x) = 0).`,
                answer,
                type: 'integer',
                explanation: `f'(x) = ${fmtPoly([{ coef: 2 * a, pow: 1 }, { coef: b, pow: 0 }])}. Setting it to 0 gives x = ${-b}/${2 * a} = ${answer}.`,
            }
        },
    },
]

export default skills

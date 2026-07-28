/**
 * Shared helpers for the practice-exercise generators, plus the answer checker.
 *
 * A "skill" is: { id, title, desc, generate() -> Problem }.
 * A Problem is:
 *   {
 *     prompt: string,           // plain text; may use ^ √ π × ÷ and "a/b" fractions
 *     answer: number|string,    // canonical answer
 *     type: 'integer'|'numeric'|'text'|'choice',
 *     choices?: string[],       // required for type 'choice'
 *     tolerance?: number,       // for 'numeric' (default 1e-3)
 *     accepted?: string[],      // extra accepted string forms (for 'text')
 *     explanation?: string      // shown after answering
 *   }
 * A generator must be self-consistent: checkAnswer(p, String(p.answer)) === true.
 */

// Inclusive random integer in [min, max].
export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// Inclusive random integer in [min, max], never zero.
export const randNonZero = (min, max) => {
    let n = 0
    do { n = randInt(min, max) } while (n === 0)
    return n
}

export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)]

export const shuffle = (arr) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

export const sample = (arr, n) => shuffle(arr).slice(0, n)

export const gcd = (a, b) => {
    a = Math.abs(a); b = Math.abs(b)
    while (b) { [a, b] = [b, a % b] }
    return a || 1
}

export const lcm = (a, b) => Math.abs(a * b) / gcd(a, b)

// Reduce a fraction, moving any sign to the numerator.
export const reduceFraction = (numer, denom) => {
    if (denom === 0) return [numer, 0]
    const g = gcd(numer, denom)
    const s = denom < 0 ? -1 : 1
    return [(s * numer) / g, Math.abs(denom) / g]
}

// Format a fraction in lowest terms ("3/4", or "2" when it's a whole number).
export const formatFraction = (numer, denom) => {
    if (denom === 0) return 'undefined'
    const [n, d] = reduceFraction(numer, denom)
    return d === 1 ? String(n) : `${n}/${d}`
}

export const round = (v, p = 2) => parseFloat(Number(v).toFixed(p))
export const clean = (v) => parseFloat(Number(v).toPrecision(12))

// Signed term formatting for building expressions, e.g. termSign(-3, 'x') -> "− 3x".
export const withSign = (coef, suffix = '') => {
    const sign = coef < 0 ? '−' : '+'
    return `${sign} ${Math.abs(coef)}${suffix}`
}

// Build a shuffled multiple-choice list from a correct value + distractors.
// All entries are coerced to strings; the correct one is returned as `answer`.
export const mcFrom = (correct, distractors) => {
    const correctStr = String(correct)
    const seen = new Set([correctStr])
    const opts = [correctStr]
    for (const d of distractors) {
        const s = String(d)
        if (!seen.has(s)) { seen.add(s); opts.push(s) }
    }
    return { choices: shuffle(opts), answer: correctStr }
}

// --- answer checking -------------------------------------------------------

// Students often restate the variable, e.g. typing "x = 54" for "Solve for x".
// Return the value after a leading single-letter assignment ("x =", "y="), or
// null if there isn't one. Used as an *extra* accepted form, so answers that
// genuinely contain "=" (like "y=2x+3") still match on their own.
export const stripAssignment = (s) => {
    const m = String(s).trim().match(/^[a-zA-Z]\s*=\s*(.+)$/)
    return m ? m[1].trim() : null
}

export const normalize = (s) =>
    String(s).trim().toLowerCase().replace(/\s+/g, '').replace(/[×*]/g, '*').replace(/[÷]/g, '/').replace(/−/g, '-')

// Parse a numeric answer, allowing simple "a/b" fractions and π.
export const parseNumeric = (s) => {
    let t = String(s).trim().replace(/−/g, '-').replace(/\s+/g, '')
    if (t === '') return NaN
    t = t.replace(/pi|π/gi, String(Math.PI))
    if (/^-?\d*\.?\d+\/-?\d*\.?\d+$/.test(t)) {
        const [a, b] = t.split('/').map(Number)
        return b === 0 ? NaN : a / b
    }
    return parseFloat(t)
}

/**
 * Check a user's input against a problem. Returns true/false.
 */
export const checkAnswer = (problem, input) => {
    if (input == null || String(input).trim() === '') return false
    const { type = 'text', answer, tolerance, accepted = [] } = problem

    // Try the input as typed and, if present, with a leading "x =" stripped.
    const forms = [String(input)]
    const bare = stripAssignment(input)
    if (bare != null) forms.push(bare)

    if (type === 'choice') {
        const candidates = [answer, ...accepted].map(normalize)
        return forms.some(f => candidates.includes(normalize(f)))
    }
    if (type === 'integer') {
        return forms.some(f => {
            const v = parseNumeric(f)
            return Number.isFinite(v) && Math.abs(v - Number(answer)) < 1e-9
        })
    }
    if (type === 'numeric') {
        const tol = tolerance ?? 1e-3
        return forms.some(f => {
            const v = parseNumeric(f)
            return Number.isFinite(v) && Math.abs(v - Number(answer)) <= tol
        })
    }
    // text / exact (with normalized alternatives)
    const candidates = [answer, ...accepted].map(normalize)
    return forms.some(f => candidates.includes(normalize(f)))
}

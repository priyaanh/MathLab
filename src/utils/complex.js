/**
 * Pure complex-number helpers (a + bi). Kept free of React so they can be
 * unit-tested and reused. All operations take/return { re, im }.
 */

const fmtNum = (n) => (!Number.isFinite(n) ? '—' : String(parseFloat(n.toPrecision(6))))

// Parse "3+4i", "-2-i", "4i", "5", "i" → { re, im }. Throws on bad input.
export const parseComplex = (input) => {
    let s = String(input).replace(/\s+/g, '').replace(/−/g, '-').toLowerCase()
    if (s === '') throw new Error('Enter a complex number like 3 + 4i.')
    if (s[0] !== '+' && s[0] !== '-') s = '+' + s
    let re = 0, im = 0
    const terms = s.match(/[+-][^+-]*/g) || []
    for (const t of terms) {
        const sign = t[0] === '-' ? -1 : 1
        const body = t.slice(1)
        if (body === '') continue
        if (body.endsWith('i')) {
            const num = body.slice(0, -1)
            const coef = num === '' ? 1 : parseFloat(num)
            if (Number.isNaN(coef)) throw new Error(`Couldn't read "${t}".`)
            im += sign * coef
        } else {
            const coef = parseFloat(body)
            if (Number.isNaN(coef)) throw new Error(`Couldn't read "${t}".`)
            re += sign * coef
        }
    }
    return { re, im }
}

export const cAdd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im })
export const cSub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im })
export const cMul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re })
export const cDiv = (a, b) => {
    const d = b.re * b.re + b.im * b.im
    if (d === 0) throw new Error('Cannot divide by 0.')
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }
}
export const cConj = (z) => ({ re: z.re, im: -z.im })
export const cModulus = (z) => Math.hypot(z.re, z.im)
export const cArgDeg = (z) => (Math.atan2(z.im, z.re) * 180) / Math.PI

// Format as "a + bi" (collapsing 1i → i, dropping a zero part).
export const cFormat = (z) => {
    if (!z) return '—'
    const { re, im } = z
    if (im === 0) return fmtNum(re)
    const mag = Math.abs(im)
    const bi = mag === 1 ? 'i' : `${fmtNum(mag)}i`
    if (re === 0) return `${im < 0 ? '−' : ''}${bi}`
    return `${fmtNum(re)} ${im < 0 ? '−' : '+'} ${bi}`
}

export const OPS = { '+': cAdd, '−': cSub, '×': cMul, '÷': cDiv }

/**
 * Extra "type it, get an answer" parsers for Lumen's address bar, in the spirit
 * of a maths/CS lab: number theory, arbitrary bases, roman numerals, numbers in
 * words, colours, dates and a few constants. Each parser returns
 * { expr, result } — both strings, so the address bar shows one copyable answer
 * row — or null when the text isn't that kind of question. `computeAnswer` tries
 * them in turn; `parsePlot` is separate because it routes to the grapher rather
 * than copying. Kept pure (dates take an injectable `now`) so `npm test` covers it.
 */

const clean = (raw) => String(raw ?? '').trim()
const lower = (raw) => clean(raw).toLowerCase()

/* ---- number theory ------------------------------------------------------- */

// Trial division is plenty for address-bar numbers; the cap keeps a big paste
// from spinning the main thread while someone is mid-type.
const MAX_NT = 1e12

const primeFactors = (n) => {
    const out = []
    while (n % 2 === 0) { out.push(2); n /= 2 }
    for (let d = 3; d * d <= n; d += 2) {
        while (n % d === 0) { out.push(d); n /= d }
    }
    if (n > 1) out.push(n)
    return out
}

/** "factor 360" / "prime factors of 360" -> "2^3 · 3^2 · 5". */
export const parseFactor = (raw) => {
    const m = lower(raw).match(/^(?:factor(?:ize|ise)?|prime\s+factor(?:s|ize|ise)?(?:\s+of)?)\s+(\d+)$/)
    if (!m) return null
    const n = Number(m[1])
    if (!Number.isSafeInteger(n) || n < 2 || n > MAX_NT) return null
    const counts = new Map()
    for (const p of primeFactors(n)) counts.set(p, (counts.get(p) || 0) + 1)
    const result = [...counts].map(([p, k]) => (k > 1 ? `${p}^${k}` : `${p}`)).join(' · ')
    return { expr: `factor ${n}`, result }
}

/** "is 97 prime" / "prime 91" -> "97 is prime" / "91 is not prime (7 × 13)". */
export const parsePrime = (raw) => {
    const m = lower(raw).match(/^(?:is\s+)?(\d+)\s+prime\??$|^prime\??\s+(\d+)$/)
    if (!m) return null
    const n = Number(m[1] ?? m[2])
    if (!Number.isSafeInteger(n) || n > MAX_NT) return null
    if (n < 2) return { expr: `${n} prime?`, result: `${n} is not prime` }
    const f = primeFactors(n)
    const result = f.length === 1
        ? `${n} is prime`
        : `${n} is not prime (${f[0]} × ${n / f[0]})`
    return { expr: `${n} prime?`, result }
}

const gcd2 = (a, b) => { while (b) { [a, b] = [b, a % b] } return a }

/** "gcd 24 36" / "lcm of 4 and 6" over two or more numbers. */
export const parseGcdLcm = (raw) => {
    const m = lower(raw).match(/^(gcd|hcf|lcm)\s+(?:of\s+)?(.+)$/)
    if (!m) return null
    const nums = m[2].split(/[\s,]+|\band\b/).map(s => s.trim()).filter(Boolean).map(Number)
    if (nums.length < 2 || nums.some(x => !Number.isSafeInteger(x) || x < 0 || x > MAX_NT)) return null
    const op = m[1] === 'lcm' ? 'lcm' : 'gcd'
    let acc = nums[0]
    for (let i = 1; i < nums.length; i++) {
        acc = op === 'gcd' ? gcd2(acc, nums[i]) : (acc / gcd2(acc, nums[i])) * nums[i]
        if (!Number.isSafeInteger(acc)) return null
    }
    return { expr: `${op} ${nums.join(', ')}`, result: String(acc) }
}

/** "divisors of 28" -> "1, 2, 4, 7, 14, 28  (6 divisors)". */
export const parseDivisors = (raw) => {
    const m = lower(raw).match(/^(?:divisors|factors)\s+of\s+(\d+)$/)
    if (!m) return null
    const n = Number(m[1])
    if (!Number.isSafeInteger(n) || n < 1 || n > 1e8) return null
    const small = [], big = []
    for (let d = 1; d * d <= n; d++) {
        if (n % d === 0) { small.push(d); if (d !== n / d) big.push(n / d) }
    }
    const all = [...small, ...big.reverse()]
    return { expr: `divisors of ${n}`, result: `${all.join(', ')}  (${all.length})` }
}

/* ---- arbitrary base ------------------------------------------------------ */

/** "255 in base 7" (decimal in) and "511 base 7 in decimal" (base out). */
export const parseBaseN = (raw) => {
    const t = lower(raw)
    let m = t.match(/^(\d+)\s+(?:in|to|as)\s+base\s+(\d{1,2})$/)
    if (m) {
        const n = Number(m[1]); const b = Number(m[2])
        if (!Number.isSafeInteger(n) || b < 2 || b > 36) return null
        return { expr: `${n} in base ${b}`, result: n.toString(b).toUpperCase() }
    }
    m = t.match(/^([0-9a-z]+)\s+base\s+(\d{1,2})\s+(?:in|to|as)\s+(?:base\s+(\d{1,2})|decimal|dec)$/)
    if (m) {
        const b = Number(m[2]); const out = m[3] ? Number(m[3]) : 10
        if (b < 2 || b > 36 || out < 2 || out > 36) return null
        if (![...m[1]].every(c => parseInt(c, 36) < b)) return null
        const n = parseInt(m[1], b)
        if (!Number.isSafeInteger(n)) return null
        return { expr: `${m[1]} base ${b} in base ${out}`, result: n.toString(out).toUpperCase() }
    }
    return null
}

/* ---- roman numerals ------------------------------------------------------ */

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]

const toRoman = (n) => {
    if (!Number.isInteger(n) || n < 1 || n > 3999) return null
    let out = ''
    for (const [v, s] of ROMAN) { while (n >= v) { out += s; n -= v } }
    return out
}

const fromRoman = (s) => {
    if (!/^[mdclxvi]+$/i.test(s)) return null
    const val = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }
    const cs = s.toLowerCase()
    let total = 0
    for (let i = 0; i < cs.length; i++) {
        const cur = val[cs[i]], next = val[cs[i + 1]]
        total += next > cur ? -cur : cur
    }
    return toRoman(total) === cs.toUpperCase() ? total : null // reject malformed like "IIII"
}

/** "2024 in roman" and "MMXXIV in decimal" (round-trip validated). */
export const parseRoman = (raw) => {
    const t = lower(raw)
    let m = t.match(/^(\d+)\s+(?:in|to|as)\s+roman(?:\s+numerals?)?$/) || t.match(/^roman\s+(?:of\s+)?(\d+)$/)
    if (m) { const r = toRoman(Number(m[1])); return r ? { expr: `${m[1]} in roman`, result: r } : null }
    m = t.match(/^([mdclxvi]+)\s+(?:in|to|as)\s+(?:decimal|dec|arabic|number)$/) || t.match(/^roman\s+([mdclxvi]+)$/)
    if (m) { const n = fromRoman(m[1]); return n ? { expr: `${m[1].toUpperCase()} in decimal`, result: String(n) } : null }
    return null
}

/* ---- number to words ----------------------------------------------------- */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES = ['', ' thousand', ' million', ' billion', ' trillion']

const under1000 = (n) => {
    let out = ''
    if (n >= 100) { out += `${ONES[Math.floor(n / 100)]} hundred`; n %= 100; if (n) out += ' ' }
    if (n >= 20) { out += TENS[Math.floor(n / 10)]; if (n % 10) out += `-${ONES[n % 10]}` }
    else if (n > 0) out += ONES[n]
    return out
}

/** "1234 in words" -> "one thousand two hundred thirty-four". */
export const parseNumWords = (raw) => {
    const m = lower(raw).match(/^(\d+)\s+(?:in|to|as)\s+words?$/) || lower(raw).match(/^spell\s+(\d+)$/)
    if (!m) return null
    let n = Number(m[1])
    if (!Number.isSafeInteger(n) || n >= 1e15) return null
    if (n === 0) return { expr: `${m[1]} in words`, result: 'zero' }
    const groups = []
    while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000) }
    let out = ''
    for (let i = groups.length - 1; i >= 0; i--) {
        if (!groups[i]) continue
        out += (out ? ' ' : '') + under1000(groups[i]) + SCALES[i]
    }
    return { expr: `${m[1]} in words`, result: out }
}

/* ---- colours ------------------------------------------------------------- */

const hexToRgb = (h) => {
    let s = h.replace('#', '')
    if (s.length === 3) s = [...s].map(c => c + c).join('')
    if (s.length !== 6 || !/^[0-9a-f]{6}$/i.test(s)) return null
    return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) }
}
const rgbToHex = ({ r, g, b }) => '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase()
const rgbToHsl = ({ r, g, b }) => {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
    let h = 0
    if (d) {
        if (max === r) h = ((g - b) / d) % 6
        else if (max === g) h = (b - r) / d + 2
        else h = (r - g) / d + 4
        h *= 60; if (h < 0) h += 360
    }
    const l = (max + min) / 2
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/** "#ff8800 in rgb", "rgb(255,136,0) in hsl", "#f80 in hex". */
export const parseColor = (raw) => {
    const m = lower(raw).match(/^(#[0-9a-f]{3,6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))\s+(?:in|to|as)\s+(hex|rgb|hsl)$/)
    if (!m) return null
    let rgb = null
    if (m[1].startsWith('#')) rgb = hexToRgb(m[1])
    else {
        const p = m[1].match(/rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/)
        rgb = { r: +p[1], g: +p[2], b: +p[3] }
        if ([rgb.r, rgb.g, rgb.b].some(x => x > 255)) return null
    }
    if (!rgb) return null
    const result = m[2] === 'hex' ? rgbToHex(rgb)
        : m[2] === 'rgb' ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
            : (() => { const { h, s, l } = rgbToHsl(rgb); return `hsl(${h}, ${s}%, ${l}%)` })()
    return { expr: `${m[1]} in ${m[2]}`, result }
}

/* ---- character codes ----------------------------------------------------- */

const fromCodePoint = (code, expr) => {
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return null
    try { return { expr, result: `${String.fromCodePoint(code)}  (U+${code.toString(16).toUpperCase().padStart(4, '0')})` } }
    catch { return null }
}

/** "char code of A" -> code; "U+2603" / "char 9731" -> the character. */
export const parseCharCode = (raw) => {
    const t = clean(raw)
    let m = t.match(/^(?:char\s*code|code\s*point|codepoint|ascii)\s+(?:of\s+|for\s+)?(.)$/i)
    if (m) { const cp = m[1].codePointAt(0); return { expr: `code of ${m[1]}`, result: `${cp} (U+${cp.toString(16).toUpperCase().padStart(4, '0')})` } }
    m = t.match(/^(?:u\+|0x)([0-9a-f]{1,6})$/i)          // hex code point -> char
    if (m) return fromCodePoint(parseInt(m[1], 16), t)
    m = t.match(/^(?:char|chr)\s+(\d{1,7})$/i)           // decimal code point -> char
    if (m) return fromCodePoint(Number(m[1]), t)
    return null
}

/* ---- constants ----------------------------------------------------------- */

const PI = '3.14159265358979323846264338327950288419716939937510'
const E = '2.71828182845904523536028747135266249775724709369995'
const PHI = '1.61803398874989484820458683436563811772030917980576'
const SQRT2 = '1.41421356237309504880168872420969807856967187537694'
const TAU = '6.28318530717958647692528676655900576839433879875021'
const LONG = { pi: PI, tau: TAU, e: E, phi: PHI, 'golden ratio': PHI, sqrt2: SQRT2, 'sqrt 2': SQRT2, 'root 2': SQRT2 }
const NAMED = {
    'speed of light': '299792458 m/s',
    'planck constant': '6.62607015e-34 J·s',
    'avogadro': '6.02214076e23 /mol',
    "avogadro's number": '6.02214076e23 /mol',
    'boltzmann constant': '1.380649e-23 J/K',
    'gravity': '9.80665 m/s²',
    'gravitational constant': '6.67430e-11 N·m²/kg²',
    'electron charge': '1.602176634e-19 C',
    'gas constant': '8.314462618 J/(mol·K)'
}

// Bare multi-word names are safe to answer outright — nobody types "golden
// ratio" hoping for a web page. Single tokens (pi, e) stay searchable.
const BARE = { 'golden ratio': PHI, 'root 2': SQRT2, 'square root of 2': SQRT2, 'sqrt 2': SQRT2 }

/** "pi to 12 digits", "golden ratio", "speed of light". */
export const parseConstant = (raw) => {
    const t = lower(raw).replace(/[?]/g, '').trim()
    const m = t.match(/^(pi|tau|e|phi|golden ratio|sqrt2|sqrt 2|root 2)\s+to\s+(\d{1,3})\s+(?:digits|places|dp)$/)
    if (m) {
        const src = LONG[m[1]]; const places = Math.min(Number(m[2]), 50)
        const dot = src.indexOf('.')
        return { expr: `${m[1]} to ${places} digits`, result: src.slice(0, dot + 1 + places) }
    }
    if (t in NAMED) return { expr: t, result: NAMED[t] }
    if (t in BARE) return { expr: t, result: BARE[t].slice(0, 17) } // 15 decimal places
    return null
}

/* ---- dates & time -------------------------------------------------------- */

// Parse YYYY-MM-DD (or with / ) as a *local* midnight, dodging the UTC-parsing
// off-by-one that `new Date('2020-01-01')` would introduce.
const parseISO = (s) => {
    const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
    if (!m) return null
    const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3])
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null
    const d = new Date(y, mo - 1, da)
    // reject calendar-invalid dates that Date would otherwise roll over (e.g. Feb 30 -> Mar 2)
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null
    return d
}
const DAY = 86400000
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const ZONES = {
    utc: 'UTC', gmt: 'UTC', london: 'Europe/London', paris: 'Europe/Paris', berlin: 'Europe/Berlin',
    tokyo: 'Asia/Tokyo', 'new york': 'America/New_York', 'los angeles': 'America/Los_Angeles',
    la: 'America/Los_Angeles', chicago: 'America/Chicago', sydney: 'Australia/Sydney',
    delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', beijing: 'Asia/Shanghai', shanghai: 'Asia/Shanghai',
    dubai: 'Asia/Dubai', moscow: 'Europe/Moscow', 'sao paulo': 'America/Sao_Paulo'
}

/** Date differences, offsets from today, and clocks in other zones. */
export const parseDate = (raw, now = new Date()) => {
    const t = lower(raw)
    let m = t.match(/^days\s+(?:until|till|to)\s+(.+)$/)
    if (m) { const d = parseISO(m[1]); if (!d) return null; const n = Math.round((startOfDay(d) - startOfDay(now)) / DAY); return { expr: `days until ${m[1]}`, result: `${n} day${Math.abs(n) === 1 ? '' : 's'}` } }
    m = t.match(/^days\s+since\s+(.+)$/)
    if (m) { const d = parseISO(m[1]); if (!d) return null; const n = Math.round((startOfDay(now) - startOfDay(d)) / DAY); return { expr: `days since ${m[1]}`, result: `${n} day${Math.abs(n) === 1 ? '' : 's'}` } }
    m = t.match(/^(\d{1,5})\s+(day|week|month|year)s?\s+(from\s+(?:today|now)|ago|before\s+today)$/)
    if (m) {
        const n = Number(m[1]) * (/ago|before/.test(m[3]) ? -1 : 1)
        const d = startOfDay(now)
        if (m[2] === 'day') d.setDate(d.getDate() + n)
        else if (m[2] === 'week') d.setDate(d.getDate() + n * 7)
        else if (m[2] === 'month') d.setMonth(d.getMonth() + n)
        else d.setFullYear(d.getFullYear() + n)
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const wd = d.toLocaleDateString(undefined, { weekday: 'long' })
        return { expr: t, result: `${iso} (${wd})` }
    }
    m = t.match(/^time\s+in\s+(.+)$/)
    if (m) {
        const zone = ZONES[m[1].trim()] || m[1].trim()
        try {
            const result = new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: '2-digit', minute: '2-digit', weekday: 'short' }).format(now)
            return { expr: `time in ${m[1].trim()}`, result }
        } catch { return null }
    }
    return null
}

/* ---- dispatcher & plot --------------------------------------------------- */

const ANSWERERS = [parseFactor, parsePrime, parseGcdLcm, parseDivisors, parseBaseN,
    parseRoman, parseNumWords, parseColor, parseCharCode, parseConstant]

/**
 * Try every answer parser and return the first hit as { kind:'calc', expr,
 * result } so the address bar renders it like the calculator rows. Dates take
 * `now` for testability. Returns null when nothing matches.
 */
export const computeAnswer = (raw, now = new Date()) => {
    for (const fn of ANSWERERS) { const r = fn(raw); if (r) return { kind: 'calc', ...r } }
    const d = parseDate(raw, now)
    if (d) return { kind: 'calc', ...d }
    return null
}

/** "plot sin(x)" / "graph x^2 - 3" -> { expr } for the grapher handoff. */
export const parsePlot = (raw) => {
    const m = lower(raw).match(/^(?:plot|graph)\s+(.+)$/)
    if (!m) return null
    const expr = clean(raw).replace(/^(?:plot|graph)\s+/i, '')
    // must mention x and only contain maths-expression characters
    if (!/x/i.test(expr) || !/^[0-9a-z+\-*/^().,\s]+$/i.test(expr)) return null
    return { expr }
}

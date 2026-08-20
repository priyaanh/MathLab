/**
 * Natural-language unit conversion for the address bar: "100 km in miles",
 * "72f to c", "2 cups in ml". Kept pure so `npm test` covers it.
 *
 * The factors match the Units page (each is "how many base units is one of me"),
 * but here every unit also carries the spellings a person might type. A
 * conversion is only valid within one category, so "5 kg in miles" returns null
 * rather than a nonsense number.
 */

// alias -> [category, factor-to-base]. Base units: m, kg, L, m/s, s, byte, rad.
const LINEAR = {
    // length (base metre)
    mm: ['len', 0.001], millimeter: ['len', 0.001], millimeters: ['len', 0.001], millimetre: ['len', 0.001], millimetres: ['len', 0.001],
    cm: ['len', 0.01], centimeter: ['len', 0.01], centimeters: ['len', 0.01], centimetre: ['len', 0.01], centimetres: ['len', 0.01],
    m: ['len', 1], meter: ['len', 1], meters: ['len', 1], metre: ['len', 1], metres: ['len', 1],
    km: ['len', 1000], kilometer: ['len', 1000], kilometers: ['len', 1000], kilometre: ['len', 1000], kilometres: ['len', 1000],
    in: ['len', 0.0254], inch: ['len', 0.0254], inches: ['len', 0.0254],
    ft: ['len', 0.3048], foot: ['len', 0.3048], feet: ['len', 0.3048],
    yd: ['len', 0.9144], yard: ['len', 0.9144], yards: ['len', 0.9144],
    mi: ['len', 1609.344], mile: ['len', 1609.344], miles: ['len', 1609.344], nmi: ['len', 1852],
    // mass (base kilogram)
    mg: ['mass', 1e-6], g: ['mass', 0.001], gram: ['mass', 0.001], grams: ['mass', 0.001],
    kg: ['mass', 1], kilogram: ['mass', 1], kilograms: ['mass', 1], kilo: ['mass', 1], kilos: ['mass', 1],
    t: ['mass', 1000], tonne: ['mass', 1000], tonnes: ['mass', 1000], ton: ['mass', 1000],
    oz: ['mass', 0.028349523125], ounce: ['mass', 0.028349523125], ounces: ['mass', 0.028349523125],
    lb: ['mass', 0.45359237], lbs: ['mass', 0.45359237], pound: ['mass', 0.45359237], pounds: ['mass', 0.45359237],
    st: ['mass', 6.35029318], stone: ['mass', 6.35029318],
    // volume (base litre)
    ml: ['vol', 0.001], milliliter: ['vol', 0.001], milliliters: ['vol', 0.001], millilitre: ['vol', 0.001], millilitres: ['vol', 0.001],
    l: ['vol', 1], liter: ['vol', 1], liters: ['vol', 1], litre: ['vol', 1], litres: ['vol', 1],
    gal: ['vol', 3.785411784], gallon: ['vol', 3.785411784], gallons: ['vol', 3.785411784],
    qt: ['vol', 0.946352946], quart: ['vol', 0.946352946], quarts: ['vol', 0.946352946],
    pt: ['vol', 0.473176473], pint: ['vol', 0.473176473], pints: ['vol', 0.473176473],
    cup: ['vol', 0.2365882365], cups: ['vol', 0.2365882365], floz: ['vol', 0.0295735295625],
    // speed (base metre/second)
    'm/s': ['spd', 1], 'km/h': ['spd', 1 / 3.6], kmh: ['spd', 1 / 3.6], kph: ['spd', 1 / 3.6],
    mph: ['spd', 0.44704], 'ft/s': ['spd', 0.3048], knot: ['spd', 1852 / 3600], knots: ['spd', 1852 / 3600],
    // time (base second)
    s: ['time', 1], sec: ['time', 1], secs: ['time', 1], second: ['time', 1], seconds: ['time', 1],
    min: ['time', 60], mins: ['time', 60], minute: ['time', 60], minutes: ['time', 60],
    h: ['time', 3600], hr: ['time', 3600], hrs: ['time', 3600], hour: ['time', 3600], hours: ['time', 3600],
    day: ['time', 86400], days: ['time', 86400], week: ['time', 604800], weeks: ['time', 604800],
    year: ['time', 31557600], years: ['time', 31557600],
    // digital (base byte)
    bit: ['data', 0.125], bits: ['data', 0.125], b: ['data', 1], byte: ['data', 1], bytes: ['data', 1],
    kb: ['data', 1024], mb: ['data', 1048576], gb: ['data', 1073741824], tb: ['data', 1099511627776],
    // angle (base radian)
    rad: ['ang', 1], radian: ['ang', 1], radians: ['ang', 1],
    deg: ['ang', Math.PI / 180], degree: ['ang', Math.PI / 180], degrees: ['ang', Math.PI / 180],
    grad: ['ang', Math.PI / 200], turn: ['ang', 2 * Math.PI], turns: ['ang', 2 * Math.PI]
}

// Temperature is affine, so it converts through Celsius rather than by a factor.
const TEMP = { c: 'C', '°c': 'C', celsius: 'C', f: 'F', '°f': 'F', fahrenheit: 'F', k: 'K', kelvin: 'K' }
const toC = { C: (x) => x, F: (x) => (x - 32) * 5 / 9, K: (x) => x - 273.15 }
const fromC = { C: (x) => x, F: (x) => x * 9 / 5 + 32, K: (x) => x + 273.15 }

/** ~6 significant figures, trimmed of floating noise; exponent for the extremes. */
export const fmtConvert = (n) => {
    if (n == null || !Number.isFinite(n)) return '—'
    if (n === 0) return '0'
    const t = parseFloat(n.toPrecision(6))
    const abs = Math.abs(t)
    return (abs < 1e-4 || abs >= 1e12) ? t.toExponential(4) : String(t)
}

/**
 * Parse "<number> <unit> in|to|as <unit>". Returns { value, from, to, result,
 * text } or null when it isn't a conversion or the two units don't share a
 * category. `from`/`to` echo what was typed, so the row reads the way it was.
 */
export const parseConversion = (raw) => {
    const t = String(raw ?? '').trim().toLowerCase()
    if (!t || t.length > 60) return null
    const m = t.match(/^(-?\d+(?:\.\d+)?)\s*([a-z°/]+)\s+(?:in|to|as)\s+([a-z°/]+)$/)
    if (!m) return null
    const value = parseFloat(m[1])
    const a = m[2]
    const b = m[3]
    if (!Number.isFinite(value)) return null

    if (TEMP[a] && TEMP[b]) {
        const result = fromC[TEMP[b]](toC[TEMP[a]](value))
        return { value, from: a, to: b, result, text: `${fmtConvert(result)} ${b}` }
    }
    const ua = LINEAR[a]
    const ub = LINEAR[b]
    if (!ua || !ub || ua[0] !== ub[0]) return null
    const result = value * ua[1] / ub[1]
    return { value, from: a, to: b, result, text: `${fmtConvert(result)} ${b}` }
}

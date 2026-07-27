/**
 * Graph utility functions for parsing and evaluating mathematical functions
 */
import { parse, evalAst } from './calculus.js'

// Cache one parsed AST per unique function string (parsing is the expensive
// part; plotting calls this hundreds of times with the same expression).
const _astCache = new Map()

/**
 * Parse and evaluate a function string at a given x value.
 * Uses the shared expression parser so precedence is correct — notably
 * -x^2 = -(x^2) and negative exponents like 2^-2 — where the old string→JS
 * translation produced a SyntaxError (NaN) or the wrong sign.
 * @param {string} funcStr - Function string like "sin(x)", "x^2", "2*x + 1"
 * @param {number} x - The x value to evaluate at
 * @returns {number} - The y value (NaN if the expression is invalid)
 */
export const evaluateFunction = (funcStr, x) => {
    if (!funcStr || funcStr.trim() === '') return NaN
    try {
        let ast = _astCache.get(funcStr)
        if (!ast) {
            // Lowercase so SIN/X/PI behave the same as sin/x/pi (case-insensitive).
            ast = parse(funcStr.toLowerCase())
            _astCache.set(funcStr, ast)
        }
        const y = evalAst(ast, x, 'x')
        return Number.isFinite(y) ? y : NaN
    } catch {
        return NaN
    }
}

/**
 * Generate points for plotting
 * @param {string} funcStr - Function string
 * @param {number} xMin - Minimum x value
 * @param {number} xMax - Maximum x value
 * @param {number} numPoints - Number of points to generate
 * @returns {Array<{x: number, y: number}>}
 */
export const generatePlotPoints = (funcStr, xMin, xMax, numPoints = 500) => {
    const points = []
    const step = (xMax - xMin) / numPoints

    for (let i = 0; i <= numPoints; i++) {
        const x = xMin + i * step
        const y = evaluateFunction(funcStr, x)
        points.push({ x, y })
    }

    return points
}

/**
 * Validate a function string
 * @param {string} funcStr - Function string to validate
 * @returns {{valid: boolean, error?: string}}
 */
export const validateFunction = (funcStr) => {
    if (!funcStr || funcStr.trim() === '') {
        return { valid: false, error: 'Function is empty' }
    }

    // Sample several x values across a typical domain. A genuine function
    // yields a finite value somewhere; a syntax error is NaN everywhere.
    // (NaN is typeof 'number', so we must test for NaN explicitly.)
    try {
        const samples = [-5, -2, -0.5, 0, 0.5, 1, 2, 5, 10]
        const anyFinite = samples.some(x => Number.isFinite(evaluateFunction(funcStr, x)))
        if (!anyFinite) {
            return { valid: false, error: 'Invalid function' }
        }
        return { valid: true }
    } catch (e) {
        return { valid: false, error: e.message }
    }
}

/**
 * Find zeros (roots) of a function using bisection method
 * @param {string} funcStr - Function string
 * @param {number} xMin - Minimum x value
 * @param {number} xMax - Maximum x value
 * @returns {Array<{x: number, y: number}>} - Array of zero points
 */
export const findZeros = (funcStr, xMin, xMax) => {
    const zeros = []
    const numSamples = 200
    const step = (xMax - xMin) / numSamples
    const tolerance = 1e-10

    for (let i = 0; i < numSamples; i++) {
        const x1 = xMin + i * step
        const x2 = x1 + step
        const y1 = evaluateFunction(funcStr, x1)
        const y2 = evaluateFunction(funcStr, x2)

        // Check for sign change (indicates a zero crossing)
        if (!isNaN(y1) && !isNaN(y2) && y1 * y2 < 0) {
            // Use bisection to find the zero
            let a = x1, b = x2
            let fa = y1

            for (let iter = 0; iter < 60; iter++) {
                const mid = (a + b) / 2
                const fmid = evaluateFunction(funcStr, mid)

                if ((b - a) / 2 < tolerance) {
                    // Bracket collapsed. Only a genuine root if f is ~0 here —
                    // a sign flip across a vertical asymptote leaves |f| huge,
                    // so this rejects poles being reported as zeros.
                    if (Math.abs(fmid) < 1e-6) zeros.push({ x: mid, y: 0 })
                    break
                }
                if (Math.abs(fmid) < tolerance) {
                    zeros.push({ x: mid, y: 0 })
                    break
                }

                if (fa * fmid < 0) {
                    b = mid
                } else {
                    a = mid
                    fa = fmid
                }
            }
        }

        // Also check if a point is exactly zero (or very close)
        if (!isNaN(y1) && Math.abs(y1) < tolerance) {
            // Avoid duplicates
            const isDuplicate = zeros.some(z => Math.abs(z.x - x1) < step)
            if (!isDuplicate) {
                zeros.push({ x: x1, y: 0 })
            }
        }
    }

    return zeros
}

/**
 * Find intersections between two functions
 * @param {string} funcStr1 - First function string
 * @param {string} funcStr2 - Second function string
 * @param {number} xMin - Minimum x value
 * @param {number} xMax - Maximum x value
 * @returns {Array<{x: number, y: number}>} - Array of intersection points
 */
export const findIntersections = (funcStr1, funcStr2, xMin, xMax) => {
    // Create a difference function: f1(x) - f2(x)
    // Intersections occur where this equals zero
    const intersections = []
    const numSamples = 200
    const step = (xMax - xMin) / numSamples
    const tolerance = 1e-10

    const evalDiff = (x) => {
        const y1 = evaluateFunction(funcStr1, x)
        const y2 = evaluateFunction(funcStr2, x)
        return y1 - y2
    }

    for (let i = 0; i < numSamples; i++) {
        const x1 = xMin + i * step
        const x2 = x1 + step
        const d1 = evalDiff(x1)
        const d2 = evalDiff(x2)

        // Check for sign change
        if (!isNaN(d1) && !isNaN(d2) && d1 * d2 < 0) {
            // Use bisection to find the intersection
            let a = x1, b = x2
            let da = d1

            for (let iter = 0; iter < 50; iter++) {
                const mid = (a + b) / 2
                const dmid = evalDiff(mid)

                if (Math.abs(dmid) < tolerance || (b - a) / 2 < tolerance) {
                    const y = evaluateFunction(funcStr1, mid)
                    if (!isNaN(y)) {
                        intersections.push({ x: mid, y })
                    }
                    break
                }

                if (da * dmid < 0) {
                    b = mid
                } else {
                    a = mid
                    da = dmid
                }
            }
        }
    }

    return intersections
}

/**
 * Generate table data for a function
 * @param {string} funcStr - Function string
 * @param {number} xMin - Minimum x value
 * @param {number} xMax - Maximum x value
 * @param {number} numRows - Number of rows to generate
 * @returns {Array<{x: number, y: number}>}
 */
export const generateTableData = (funcStr, xMin, xMax, numRows = 21) => {
    const data = []
    const step = (xMax - xMin) / (numRows - 1)

    for (let i = 0; i < numRows; i++) {
        const x = xMin + i * step
        const y = evaluateFunction(funcStr, x)
        data.push({
            x: Number(x.toFixed(4)),
            y: isNaN(y) ? 'undefined' : Number(y.toFixed(6))
        })
    }

    return data
}

/**
 * Get the y-value at a specific x for tracing
 * @param {string} funcStr - Function string
 * @param {number} x - X value
 * @returns {number} - Y value
 */
export const getYAtX = (funcStr, x) => {
    return evaluateFunction(funcStr, x)
}

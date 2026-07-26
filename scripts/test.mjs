/**
 * MathLab test suite — plain Node, no framework, no browser.
 *
 * Covers the pure logic that would silently break a math answer:
 *   1. every exercise generator is self-consistent (its own answer checks out)
 *   2. geometry helpers (area, π-form, distance)
 *   3. symbolic calculus (differentiate + evaluate)
 *   4. the equation solver (parse + linear/quadratic/system)
 *
 * Run with `npm test`. Exits non-zero on any failure (good for CI).
 */

import { ALL_SKILLS, TOTAL_SKILLS, checkAnswer } from '../src/exercises/index.js'
import { circleArea, circleAreaPi, distance, polygonArea } from '../src/utils/geometry.js'
import { differentiate, evalAst } from '../src/utils/calculus.js'
import { parseEquation, solveLinear, solveQuadratic, solveSystem } from '../src/utils/equation.js'

let passed = 0
let failed = 0
const fails = []

const ok = (name, cond, detail = '') => {
    if (cond) { passed++ } else { failed++; fails.push(`${name}${detail ? ' — ' + detail : ''}`) }
}
const near = (a, b, tol = 1e-6) => Number.isFinite(a) && Math.abs(a - b) <= tol

// --- 1. exercise generators are self-consistent ---------------------------
{
    const REPS = 200
    let checks = 0
    let bad = 0
    let firstBad = ''
    for (const id of Object.keys(ALL_SKILLS)) {
        const skill = ALL_SKILLS[id]
        if (typeof skill.generate !== 'function') continue
        for (let i = 0; i < REPS; i++) {
            let p
            try { p = skill.generate() } catch (e) {
                bad++; if (!firstBad) firstBad = `${id} threw: ${e.message}`; break
            }
            if (p.type === 'choice' && (!Array.isArray(p.choices) || !p.choices.includes(String(p.answer)))) {
                bad++; if (!firstBad) firstBad = `${id} choice answer not in choices`; break
            }
            checks++
            if (!checkAnswer(p, String(p.answer))) {
                bad++; if (!firstBad) firstBad = `${id} self-check failed (ans=${JSON.stringify(p.answer)})`; break
            }
        }
    }
    ok('exercises: catalog non-empty', TOTAL_SKILLS > 0, `TOTAL_SKILLS=${TOTAL_SKILLS}`)
    ok('exercises: all generators self-consistent', bad === 0, firstBad || `${checks} checks`)
}

// --- 2. geometry ----------------------------------------------------------
{
    ok('geometry: circleArea(4)', near(circleArea(4), Math.PI * 16, 1e-3))
    ok('geometry: circleAreaPi(4) = 16π', circleAreaPi(4) === '16π', circleAreaPi(4))
    ok('geometry: circleAreaPi(1) = π', circleAreaPi(1) === 'π', circleAreaPi(1))
    ok('geometry: distance 3-4-5', near(distance(0, 0, 3, 4), 5))
    // Unit square area = 1.
    const sq = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
    ok('geometry: polygonArea unit square', near(polygonArea(sq), 1, 1e-6))
}

// --- 3. calculus ----------------------------------------------------------
{
    // d/dx x^2 = 2x  -> at x=3 gives 6
    const d1 = differentiate('x^2', 'x')
    ok('calculus: d/dx x^2 at 3 = 6', near(evalAst(d1.derivative, 3, 'x'), 6))
    // d/dx sin(x) = cos(x) -> at 0 gives 1
    const d2 = differentiate('sin(x)', 'x')
    ok('calculus: d/dx sin(x) at 0 = 1', near(evalAst(d2.derivative, 0, 'x'), 1, 1e-6))
    // d/dx x^3 = 3x^2 -> at 2 gives 12
    const d3 = differentiate('x^3', 'x')
    ok('calculus: d/dx x^3 at 2 = 12', near(evalAst(d3.derivative, 2, 'x'), 12))
}

// --- 4. equation solver ---------------------------------------------------
{
    // Linear: 2x + 3 = 7  -> x = 2
    const lin = (() => { const p = parseEquation('2x + 3 = 7', ['x']); return solveLinear(p.x, p.c) })()
    ok('solver: linear 2x+3=7 -> x=2', near(lin.value, 2))

    // Quadratic: x^2 - 5x + 6 = 0 -> roots 3, 2
    const q = (() => { const p = parseEquation('x^2 - 5x + 6 = 0', ['x']); return solveQuadratic(p.x2, p.x, p.c) })()
    ok('solver: quadratic roots {2,3}', q.roots && near(Math.min(...q.roots), 2) && near(Math.max(...q.roots), 3),
        JSON.stringify(q.roots))

    // Superscript + implicit form: x² = 9 -> ±3
    const q2 = (() => { const p = parseEquation('x² = 9', ['x']); return solveQuadratic(p.x2, p.x, p.c) })()
    ok('solver: x² = 9 -> {-3,3}', q2.roots && near(Math.min(...q2.roots), -3) && near(Math.max(...q2.roots), 3))

    // System: x + y = 2 ; x - y = 0 -> (1, 1)
    const sys = (() => {
        const a = parseEquation('x + y = 2', ['x', 'y'])
        const b = parseEquation('x - y = 0', ['x', 'y'])
        return solveSystem(a, b)
    })()
    ok('solver: system -> (1,1)', sys.value && near(sys.value.x, 1) && near(sys.value.y, 1),
        JSON.stringify(sys.value))

    // Parser rejects an unexpected variable.
    let threw = false
    try { parseEquation('2z + 1 = 0', ['x']) } catch { threw = true }
    ok('solver: rejects unknown variable', threw)
}

// --- report ---------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed  (${TOTAL_SKILLS} skills exercised)`)
if (failed) {
    console.log('\nFailures:')
    for (const f of fails) console.log('  ✗ ' + f)
    process.exit(1)
}
console.log('All tests passed ✓')

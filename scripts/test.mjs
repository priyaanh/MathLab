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
import { parseEquation, solveLinear, solveQuadratic, solveSystem, solveGeneral } from '../src/utils/equation.js'
import { parseComplex, cMul, cDiv, cModulus, cFormat } from '../src/utils/complex.js'
import { normalCdf, binomPmf, binomCdf, poissonPmf, poissonCdf } from '../src/utils/distributions.js'
import { move, canMove, newGame, spawn, isValidBoard, normalizeBoard } from '../src/utils/game2048.js'

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

    // General solver: cubic x^3 - 4x = 0 -> {-2, 0, 2}
    const cubic = solveGeneral('x^3 - 4x = 0').roots || []
    ok('solver: cubic roots {-2,0,2}',
        cubic.length === 3 && near(cubic[0], -2, 1e-3) && near(cubic[1], 0, 1e-3) && near(cubic[2], 2, 1e-3),
        JSON.stringify(cubic))

    // General solver: square root — sqrt(x) = 3 -> x = 9
    const sq = solveGeneral('sqrt(x) = 3').roots || []
    ok('solver: sqrt(x)=3 -> 9', sq.length === 1 && near(sq[0], 9, 1e-3), JSON.stringify(sq))

    // General solver: higher power — x^4 - 16 = 0 -> {-2, 2}
    const quartic = solveGeneral('x^4 - 16 = 0').roots || []
    ok('solver: quartic roots {-2,2}',
        quartic.length === 2 && near(quartic[0], -2, 1e-3) && near(quartic[1], 2, 1e-3),
        JSON.stringify(quartic))
}

// --- 5. complex numbers ---------------------------------------------------
{
    ok('complex: parse "-2-i"', (() => { const z = parseComplex('-2-i'); return z.re === -2 && z.im === -1 })())
    ok('complex: parse "2i"', (() => { const z = parseComplex('2i'); return z.re === 0 && z.im === 2 })())
    const prod = cMul(parseComplex('3+4i'), parseComplex('1-2i')) // 11 - 2i
    ok('complex: (3+4i)(1-2i) = 11-2i', near(prod.re, 11) && near(prod.im, -2), cFormat(prod))
    const quot = cDiv(parseComplex('3+4i'), parseComplex('1-2i')) // -1 + 2i
    ok('complex: (3+4i)/(1-2i) = -1+2i', near(quot.re, -1) && near(quot.im, 2), cFormat(quot))
    ok('complex: |3+4i| = 5', near(cModulus(parseComplex('3+4i')), 5))
    let divThrew = false
    try { cDiv(parseComplex('1'), parseComplex('0')) } catch { divThrew = true }
    ok('complex: divide by 0 throws', divThrew)
}

// --- 6. distributions -----------------------------------------------------
{
    ok('dist: Phi(0) = 0.5', near(normalCdf(0, 0, 1), 0.5, 1e-6))
    ok('dist: Phi(1.96) ~ 0.975', near(normalCdf(1.96, 0, 1), 0.975, 2e-3), normalCdf(1.96, 0, 1))
    ok('dist: binom(20,.5) sums to 1', near(binomCdf(20, 20, 0.5), 1, 1e-9))
    ok('dist: binom(20,.5) P(X=10) ~ 0.1762', near(binomPmf(10, 20, 0.5), 0.1762, 1e-3), binomPmf(10, 20, 0.5))
    ok('dist: poisson(4) sums to ~1', near(poissonCdf(60, 4), 1, 1e-6))
    ok('dist: poisson(4) P(X=4) ~ 0.1954', near(poissonPmf(4, 4), 0.1954, 1e-3), poissonPmf(4, 4))
}

// --- 7. 2048 move logic ---------------------------------------------------
{
    // rows of numbers (0 = empty) <-> tile lists
    const fromRows = (rows) => {
        const tiles = []
        let id = 1
        rows.forEach((row, r) => row.forEach((v, c) => { if (v) tiles.push({ id: id++, row: r, col: c, value: v }) }))
        return tiles
    }
    const toRows = (tiles) => {
        const rows = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
        for (const t of tiles) rows[t.row][t.col] = t.value
        return rows
    }
    const slide = (row, dir = 'left') => toRows(move(fromRows([row, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), dir).tiles)[0]
    const same = (a, b) => String(a) === String(b)

    ok('2048: [2,2,4,4] left -> [4,8,0,0]', same(slide([2, 2, 4, 4]), [4, 8, 0, 0]), String(slide([2, 2, 4, 4])))
    ok('2048: [2,2,2,0] left -> [4,2,0,0] (one merge per tile)', same(slide([2, 2, 2, 0]), [4, 2, 0, 0]), String(slide([2, 2, 2, 0])))
    ok('2048: [4,4,8,0] left -> [8,8,0,0] (merged tile is spent)', same(slide([4, 4, 8, 0]), [8, 8, 0, 0]), String(slide([4, 4, 8, 0])))
    ok('2048: [0,0,2,0] left -> [2,0,0,0]', same(slide([0, 0, 2, 0]), [2, 0, 0, 0]), String(slide([0, 0, 2, 0])))
    ok('2048: [2,2,2,2] right -> [0,0,4,4]', same(slide([2, 2, 2, 2], 'right'), [0, 0, 4, 4]), String(slide([2, 2, 2, 2], 'right')))

    const merged = move(fromRows([[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left')
    ok('2048: gained = 4 + 8 = 12', merged.gained === 12, String(merged.gained))
    ok('2048: 2 merges retire 4 source tiles', merged.dead.length === 4, String(merged.dead.length))
    ok('2048: each merge mints one flagged tile', merged.tiles.filter(t => t.merged).length === 2)
    ok('2048: merged tiles get fresh ids', merged.tiles.filter(t => t.merged).every(t => !merged.dead.some(d => d.id === t.id)))
    ok('2048: dead tiles sit on their merge cell', merged.dead.every(d => merged.tiles.some(t => t.row === d.row && t.col === d.col)))
    ok('2048: no-op move reports moved:false', move(fromRows([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left').moved === false)
    ok('2048: tile ids survive a move', (() => {
        const start = fromRows([[0, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
        const after = move(start, 'left').tiles
        return after.length === 1 && after[0].id === start[0].id && after[0].col === 0
    })())

    // vertical moves are the same traversal, mirrored
    const upBoard = move(fromRows([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]]), 'up')
    ok('2048: column [2,2,4,4] up -> [4,8,0,0]', same(toRows(upBoard.tiles).map(r => r[0]), [4, 8, 0, 0]), String(toRows(upBoard.tiles).map(r => r[0])))
    const downBoard = move(fromRows([[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'down')
    ok('2048: column [2,2,0,0] down -> [0,0,0,4]', same(toRows(downBoard.tiles).map(r => r[0]), [0, 0, 0, 4]), String(toRows(downBoard.tiles).map(r => r[0])))

    // every direction must return the same id order, or React reorders the DOM
    // nodes and the browser drops the slide transition
    ok('2048: id order is stable across directions', (() => {
        const board = fromRows([[2, 4, 0, 0], [8, 16, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
        return ['up', 'down', 'left', 'right'].every(dir => {
            const ids = move(board, dir).tiles.map(t => t.id)
            return same(ids, [...ids].sort((a, b) => a - b))
        })
    })())

    // a restored localStorage board must be rejected unless it's renderable
    const good = fromRows([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
    ok('2048: a sane board validates', isValidBoard(good))
    ok('2048: newGame validates', isValidBoard(newGame()))
    ok('2048: rejects non-arrays', !isValidBoard(null) && !isValidBoard({}) && !isValidBoard('x'))
    ok('2048: rejects an empty board', !isValidBoard([]))
    ok('2048: rejects stacked tiles', !isValidBoard([{ id: 1, row: 0, col: 0, value: 2 }, { id: 2, row: 0, col: 0, value: 4 }]))
    ok('2048: rejects duplicate ids', !isValidBoard([{ id: 1, row: 0, col: 0, value: 2 }, { id: 1, row: 0, col: 1, value: 4 }]))
    ok('2048: rejects off-board tiles', !isValidBoard([{ id: 1, row: 4, col: 0, value: 2 }]) && !isValidBoard([{ id: 1, row: 0, col: -1, value: 2 }]))
    ok('2048: rejects non-power-of-two values', !isValidBoard([{ id: 1, row: 0, col: 0, value: 6 }]))
    ok('2048: rejects junk values', !isValidBoard([{ id: 1, row: 0, col: 0, value: 'x' }]) && !isValidBoard([{ id: 1, row: 0.5, col: 0, value: 2 }]))
    ok('2048: rejects an over-full board', !isValidBoard(Array.from({ length: 17 }, (_, i) => ({ id: i, row: 0, col: 0, value: 2 }))))
    ok('2048: normalizeBoard clears animation flags',
        normalizeBoard([{ id: 1, row: 0, col: 0, value: 2, isNew: true, merged: true }])
            .every(t => t.isNew === false && t.merged === false))

    ok('2048: newGame deals 2 tiles', newGame().length === 2)
    ok('2048: newGame tiles are 2s or 4s', newGame().every(t => t.value === 2 || t.value === 4))
    ok('2048: gaps mean the game can continue', canMove(fromRows([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]])) === true)
    ok('2048: full checkerboard is game over', canMove(fromRows([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]])) === false)
    ok('2048: full board with a pair is not game over', canMove(fromRows([[2, 2, 4, 8], [4, 8, 16, 32], [2, 4, 8, 16], [4, 8, 16, 32]])) === true)

    // 500 random games must never corrupt the board (no overlaps, no stray values)
    let boardOk = true
    for (let g = 0; g < 500 && boardOk; g++) {
        let tiles = newGame()
        for (let step = 0; step < 60; step++) {
            const dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)]
            const res = move(tiles, dir)
            if (!res.moved) continue
            tiles = spawn(res.tiles)
            const cells = new Set(tiles.map(t => t.row * 4 + t.col))
            const sane = tiles.every(t => t.row >= 0 && t.row < 4 && t.col >= 0 && t.col < 4
                && Number.isInteger(Math.log2(t.value)) && t.value >= 2)
            if (cells.size !== tiles.length || tiles.length > 16 || !sane) { boardOk = false; break }
        }
    }
    ok('2048: 500 random games keep the board valid', boardOk)
}

// --- report ---------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed  (${TOTAL_SKILLS} skills exercised)`)
if (failed) {
    console.log('\nFailures:')
    for (const f of fails) console.log('  ✗ ' + f)
    process.exit(1)
}
console.log('All tests passed ✓')

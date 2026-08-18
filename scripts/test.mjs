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
import {
    toUrl, hostOf, blocksFraming, tabLabel, sanitizePrefs, sanitizeSession, sanitizeBookmarks,
    hueFor, pruneRetiredDefaults, readableOn,
    ENGINES, DEFAULT_PREFS, MAX_BOOKMARKS, MAX_TABS, MAX_STACK, MIN_RAIL, MAX_RAIL
} from '../src/utils/webframe.js'

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

// --- 8. web viewer address bar --------------------------------------------
{
    ok('webframe: full URLs pass through', toUrl('https://en.wikipedia.org/wiki/Pi') === 'https://en.wikipedia.org/wiki/Pi')
    ok('webframe: http is kept', toUrl('http://example.com') === 'http://example.com')
    ok('webframe: bare hosts get https', toUrl('example.com') === 'https://example.com')
    ok('webframe: host + path gets https', toUrl('wikipedia.org/wiki/Pi') === 'https://wikipedia.org/wiki/Pi')
    ok('webframe: blank input is null', toUrl('  ') === null && toUrl('') === null && toUrl(null) === null)
    ok('webframe: javascript: URLs are refused', toUrl('javascript:alert(1)') === null)
    ok('webframe: prose becomes a search', toUrl('why is pi irrational').startsWith('https://search.marginalia.nu/search?query='))
    ok('webframe: search terms are encoded', toUrl('a b&c').endsWith('a%20b%26c'), toUrl('a b&c'))
    ok('webframe: engine choice is honoured', toUrl('pi', 'wikipedia').startsWith('https://en.wikipedia.org/w/index.php?search='))
    ok('webframe: an unknown engine falls back', toUrl('pi', 'nope').startsWith('https://search.marginalia.nu/'))
    /*
     * The engine list is the one place a dead URL makes the whole viewer look
     * broken: a search just lands on a blank pane. These guard the shape of it —
     * reachability itself can only be checked against the live network.
     */
    ok('engines: the default id exists in the list', ENGINES.some(e => e.id === DEFAULT_PREFS.engine), DEFAULT_PREFS.engine)
    ok('engines: every entry builds an https URL',
        ENGINES.every(e => /^https:\/\/[^\s]+$/.test(e.q('a b'))), JSON.stringify(ENGINES.map(e => e.q('a b'))))
    ok('engines: every entry encodes the query', ENGINES.every(e => e.q('a b').includes('a%20b')))
    ok('engines: no entry points at a host known to refuse framing',
        ENGINES.every(e => !blocksFraming(e.q('test'))), JSON.stringify(ENGINES.filter(e => blocksFraming(e.q('test'))).map(e => e.id)))
    ok('engines: ids are unique', new Set(ENGINES.map(e => e.id)).size === ENGINES.length)
    /*
     * A saved id that no longer exists must heal to the default, not stick. This
     * is the whole reason a broken engine gets deleted rather than demoted: prefs
     * written while it was the default would otherwise pin someone to a viewer
     * that never returns a result.
     */
    ok('engines: a retired engine id heals to the default',
        ['searx', 'searxbe', 'nonsense', ''].every(id => sanitizePrefs({ engine: id }).engine === DEFAULT_PREFS.engine))
    ok('webframe: a phrase with a dot still searches', toUrl('what is 3.5 rounded').includes('search'), toUrl('what is 3.5 rounded'))

    ok('webframe: hostOf reads the host', hostOf('https://en.wikipedia.org/wiki/Pi') === 'en.wikipedia.org')
    ok('webframe: hostOf survives junk', hostOf('not a url') === '')
    ok('webframe: flags framing-blocked hosts',
        ['https://www.google.com', 'https://google.co.uk/search', 'https://www.youtube.com/watch?v=1',
            'https://github.com', 'https://x.com/home', 'https://duckduckgo.com'].every(blocksFraming))
    ok('webframe: leaves frameable hosts alone',
        ['https://en.wikipedia.org', 'https://www.khanacademy.org', 'https://archive.org',
            'https://searx.be/search?q=pi'].every(u => !blocksFraming(u)))

    ok('webframe: tabLabel drops the www', tabLabel('https://www.khanacademy.org/x') === 'khanacademy.org')
    ok('webframe: tabLabel names a blank tab', tabLabel(null) === 'New tab' && tabLabel('') === 'New tab')

    // prefs come from hand-editable localStorage, so nothing in them is trusted
    const d = sanitizePrefs(null)
    ok('prefs: junk gives the defaults', d.home === DEFAULT_PREFS.home && d.engine === DEFAULT_PREFS.engine && d.closeKey === '`')
    ok('prefs: arrays and strings are rejected', sanitizePrefs([]).home === DEFAULT_PREFS.home && sanitizePrefs('x').density === 'normal')
    ok('prefs: a good home survives', sanitizePrefs({ home: 'https://example.com' }).home === 'https://example.com')
    ok('prefs: a non-http home is dropped', sanitizePrefs({ home: 'javascript:alert(1)' }).home === DEFAULT_PREFS.home)
    ok('prefs: an unknown engine falls back', sanitizePrefs({ engine: 'nope' }).engine === DEFAULT_PREFS.engine)
    ok('prefs: a known engine is kept', sanitizePrefs({ engine: 'wikipedia' }).engine === 'wikipedia')
    ok('prefs: the panic key must be one character',
        sanitizePrefs({ closeKey: 'abc' }).closeKey === '`' && sanitizePrefs({ closeKey: '' }).closeKey === '`'
        && sanitizePrefs({ closeKey: '§' }).closeKey === '§')
    ok('prefs: density is an allow-list', sanitizePrefs({ density: 'huge' }).density === 'normal' && sanitizePrefs({ density: 'compact' }).density === 'compact')
    ok('prefs: bar and rail default to on', d.bookmarksBar === true && d.verticalTabs === true)
    ok('prefs: booleans can be turned off',
        sanitizePrefs({ bookmarksBar: false }).bookmarksBar === false && sanitizePrefs({ verticalTabs: false }).verticalTabs === false)
    ok('prefs: no start page means a blank new tab', d.home === '' && d.newTabOpensHome === false)
    ok('prefs: opening the start page needs one to be set',
        sanitizePrefs({ newTabOpensHome: true }).newTabOpensHome === false
        && sanitizePrefs({ newTabOpensHome: true, home: 'https://example.com' }).newTabOpensHome === true)
    ok('prefs: a background image must be a URL',
        sanitizePrefs({ newTabBg: 'https://x.com/a.jpg' }).newTabBg === 'https://x.com/a.jpg'
        && sanitizePrefs({ newTabBg: 'javascript:1' }).newTabBg === ''
        && sanitizePrefs({ newTabBg: 'not a url' }).newTabBg === '')
    ok('prefs: bad bookmarks are filtered out',
        sanitizePrefs({ bookmarks: [{ url: 'https://ok.com' }, { url: 'ftp://no' }, null, 'x', {}] }).bookmarks.length === 1)
    ok('prefs: a bookmark with no name gets one',
        sanitizePrefs({ bookmarks: [{ url: 'https://www.example.com/a' }] }).bookmarks[0].label === 'example.com')
    ok('prefs: bookmark names are capped', sanitizePrefs({ bookmarks: [{ url: 'https://a.com', label: 'x'.repeat(99) }] }).bookmarks[0].label.length === 40)
    ok('prefs: the bookmark list is capped',
        sanitizePrefs({ bookmarks: Array.from({ length: 99 }, (_, i) => ({ url: `https://a${i}.com` })) }).bookmarks.length === MAX_BOOKMARKS)
    // bookmarks are meant to outlive everything else, so they get their own guard
    ok('marks: good entries survive', sanitizeBookmarks([{ label: 'A', url: 'https://a.com' }]).length === 1)
    ok('marks: junk is rejected', sanitizeBookmarks([null, 'x', {}, { url: 'ftp://a' }, { url: 'javascript:1' }]).length === 0)
    ok('marks: non-arrays give an empty list', sanitizeBookmarks(null).length === 0 && sanitizeBookmarks({}).length === 0)
    ok('marks: duplicates are dropped',
        sanitizeBookmarks([{ url: 'https://a.com' }, { url: 'https://a.com', label: 'again' }]).length === 1)
    ok('marks: a missing name uses the host', sanitizeBookmarks([{ url: 'https://www.a.com/x' }])[0].label === 'a.com')
    ok('marks: names are capped', sanitizeBookmarks([{ url: 'https://a.com', label: 'z'.repeat(80) }])[0].label.length === 40)
    ok('marks: the list is capped',
        sanitizeBookmarks(Array.from({ length: 200 }, (_, i) => ({ url: `https://a${i}.com` }))).length === MAX_BOOKMARKS)
    ok('marks: sanitizing is idempotent', (() => {
        const once = sanitizeBookmarks([{ url: 'https://a.com' }, { url: 'https://b.com', label: 'B' }])
        return JSON.stringify(sanitizeBookmarks(once)) === JSON.stringify(once)
    })())

    ok('prefs: the rail width is clamped',
        sanitizePrefs({ railWidth: 5 }).railWidth === MIN_RAIL
        && sanitizePrefs({ railWidth: 9999 }).railWidth === MAX_RAIL
        && sanitizePrefs({ railWidth: 260 }).railWidth === 260)
    ok('prefs: a junk rail width falls back', sanitizePrefs({ railWidth: 'wide' }).railWidth === DEFAULT_PREFS.railWidth
        && sanitizePrefs({}).railWidth === DEFAULT_PREFS.railWidth)
    ok('prefs: rail width is rounded', sanitizePrefs({ railWidth: 199.7 }).railWidth === 200)
    ok('prefs: sanitizing is idempotent', JSON.stringify(sanitizePrefs(d)) === JSON.stringify(d))

    // customisation — the accent lands in a style attribute, so it must stay a hex colour
    ok('prefs: an accent defaults to the theme', d.accent === '')
    ok('prefs: hex accents are kept',
        sanitizePrefs({ accent: '#ff0055' }).accent === '#ff0055' && sanitizePrefs({ accent: '#f05' }).accent === '#f05')
    ok('prefs: a non-hex accent is dropped',
        sanitizePrefs({ accent: 'red' }).accent === ''
        && sanitizePrefs({ accent: 'url(x)' }).accent === ''
        && sanitizePrefs({ accent: '#12345' }).accent === ''
        && sanitizePrefs({ accent: '#fff;background:url(x)' }).accent === '')
    ok('prefs: the wordmark is capped but may be blank',
        sanitizePrefs({ ntpTitle: 'q'.repeat(99) }).ntpTitle.length === 32
        && sanitizePrefs({ ntpTitle: '' }).ntpTitle === ''
        && sanitizePrefs({ ntpTitle: 7 }).ntpTitle === DEFAULT_PREFS.ntpTitle)
    ok('prefs: tile size is an allow-list',
        sanitizePrefs({ tileSize: 'large' }).tileSize === 'large'
        && sanitizePrefs({ tileSize: 'huge' }).tileSize === DEFAULT_PREFS.tileSize)
    ok('prefs: home-screen toggles default on and can be turned off',
        d.showNtpSearch === true && d.showNtpNote === true
        && sanitizePrefs({ showNtpSearch: false }).showNtpSearch === false
        && sanitizePrefs({ showNtpNote: false }).showNtpNote === false)

    ok('readableOn: dark text on a light accent', readableOn('#f5e94a') === '#111111')
    ok('readableOn: light text on a dark accent', readableOn('#2f6bff') === '#ffffff')
    ok('readableOn: shorthand hex works', readableOn('#fff') === '#111111' && readableOn('#000') === '#ffffff')
    ok('readableOn: junk falls back to white', readableOn('red') === '#ffffff' && readableOn(null) === '#ffffff')

    ok('hueFor: a host always lands in range', [...'abcdefgh'].every(c => {
        const h = hueFor(`${c}.example.com`)
        return Number.isInteger(h) && h >= 0 && h < 360
    }))
    ok('hueFor: the same host gives the same hue', hueFor('wikipedia.org') === hueFor('wikipedia.org'))
    ok('hueFor: different hosts usually differ', hueFor('wikipedia.org') !== hueFor('archive.org'))

    // Desmos shipped as a default once; a saved list keeps it until pruned once
    ok('prune: a retired default is dropped',
        pruneRetiredDefaults([{ url: 'https://www.desmos.com/calculator', label: 'Desmos' }]).length === 0)
    ok('prune: everything else is kept',
        pruneRetiredDefaults([{ url: 'https://a.com' }, { url: 'https://www.desmos.com/calculator' }]).length === 1)
    ok('prune: junk input is safe', pruneRetiredDefaults(null).length === 0 && pruneRetiredDefaults([null]).length === 1)
    // the oldest saves kept bookmarks inside the prefs blob, with no bookmarks key
    // at all — pruning must reach those too, not just the dedicated key
    ok('prune: reaches bookmarks that came from a prefs blob',
        pruneRetiredDefaults(sanitizePrefs({
            bookmarks: [{ url: 'https://en.wikipedia.org' }, { url: 'https://www.desmos.com/calculator' }]
        }).bookmarks).every(b => b.url !== 'https://www.desmos.com/calculator'))
    ok('prune: Desmos is no longer a default',
        DEFAULT_PREFS.bookmarks.every(b => b.url !== 'https://www.desmos.com/calculator'))

    // the saved session — reopening must land on the same pages
    const sess = sanitizeSession({ tabs: [{ stack: ['https://a.com', 'https://b.com'], idx: 1 }], active: 0 })
    ok('session: a good session restores', sess.tabs.length === 1 && sess.tabs[0].idx === 1 && sess.active === 0)
    ok('session: history depth survives', sess.tabs[0].stack.length === 2 && sess.tabs[0].stack[0] === 'https://a.com')
    ok('session: nothing saved -> null', sanitizeSession(null) === null && sanitizeSession({}) === null && sanitizeSession([]) === null)
    ok('session: a session of blank tabs -> null', sanitizeSession({ tabs: [{ stack: [], idx: -1 }] }) === null)
    ok('session: non-http entries are dropped',
        sanitizeSession({ tabs: [{ stack: ['javascript:1', 'https://ok.com', 7], idx: 1 }] }).tabs[0].stack.length === 1)
    ok('session: an out-of-range index is clamped',
        sanitizeSession({ tabs: [{ stack: ['https://a.com'], idx: 99 }] }).tabs[0].idx === 0
        && sanitizeSession({ tabs: [{ stack: ['https://a.com'], idx: -5 }] }).tabs[0].idx === 0)
    ok('session: a bad active index falls back to the first tab',
        sanitizeSession({ tabs: [{ stack: ['https://a.com'], idx: 0 }], active: 9 }).active === 0)
    ok('session: the tab count is capped',
        sanitizeSession({ tabs: Array.from({ length: 40 }, () => ({ stack: ['https://a.com'], idx: 0 })) }).tabs.length === MAX_TABS)
    ok('session: history length is capped',
        sanitizeSession({ tabs: [{ stack: Array.from({ length: 200 }, (_, i) => `https://a.com/${i}`), idx: 199 }] }).tabs[0].stack.length === MAX_STACK)
    ok('session: sanitizing is idempotent', JSON.stringify(sanitizeSession(sess)) === JSON.stringify(sess))
}


// --- 9. profile accounts (WebCrypto) --------------------------------------
{
    /*
     * A localStorage stub, so the account store can be exercised in Node. The
     * crypto itself is the real WebCrypto the browser uses — these tests are
     * about the encryption actually round-tripping and, more importantly, about
     * a wrong password genuinely failing to open the data.
     */
    const mem = new Map()
    globalThis.localStorage = {
        getItem: (k) => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => mem.set(k, String(v)),
        removeItem: (k) => mem.delete(k),
        clear: () => mem.clear()
    }

    const A = await import('../src/utils/accounts.js')

    ok('accounts: username keys are case- and space-insensitive',
        A.usernameKey('  Priyaan  ') === 'priyaan' && A.usernameKey('PRIYAAN') === 'priyaan')
    ok('accounts: bad usernames are rejected',
        !!A.usernameProblem('') && !!A.usernameProblem('a') && !!A.usernameProblem('x'.repeat(99)) && !!A.usernameProblem('bad/name'))
    ok('accounts: good usernames pass',
        A.usernameProblem('priyaan') === null && A.usernameProblem('ada_l 1') === null)
    ok('accounts: short passwords are rejected',
        !!A.passwordProblem('short') && A.passwordProblem('longenough1') === null)
    ok('accounts: strength rises with length',
        A.passwordStrength('') === 0 && A.passwordStrength('abcdefgh') >= 1
        && A.passwordStrength('abcdefghijklmnop1A!') === 4)
    ok('accounts: base64 round-trips binary safely', (() => {
        const bytes = new Uint8Array(1000).map((_, i) => i % 256)
        const back = A.fromB64(A.toB64(bytes))
        return back.length === bytes.length && back.every((b, i) => b === bytes[i])
    })())

    const PAYLOAD = { 'mathlab-profile': JSON.stringify({ name: 'Ada', grade: '8' }) }
    const created = await A.createAccount('Ada', 'correct horse battery', PAYLOAD)
    ok('accounts: creating returns a usable session', created.key === 'ada' && created.display === 'Ada')

    // The whole point: the stored form must not contain the data or the password.
    const raw = globalThis.localStorage.getItem('mathlab-accounts')
    ok('accounts: the password is never written to storage', !raw.includes('correct horse battery'))
    ok('accounts: the payload is not stored in the clear', !raw.includes('Ada') || !raw.includes('grade'))
    ok('accounts: stored record keeps only salt/iv/ciphertext', (() => {
        const rec = JSON.parse(raw).users.ada
        return !!rec.salt && !!rec.iv && !!rec.ct && rec.iterations >= 200000 && rec.password === undefined
    })())

    const opened = await A.openAccount('ADA', 'correct horse battery')
    ok('accounts: the right password opens the data',
        opened.data['mathlab-profile'] === PAYLOAD['mathlab-profile'])

    let refused = false
    try { await A.openAccount('Ada', 'wrong password!') } catch { refused = true }
    ok('accounts: a wrong password cannot open it', refused)

    let unknown = false
    try { await A.openAccount('nobody', 'whatever123') } catch (e) { unknown = /do not match/.test(e.message) }
    ok('accounts: an unknown user gives the same error as a bad password', unknown)

    let dupe = false
    try { await A.createAccount('ada', 'another password') } catch { dupe = true }
    ok('accounts: usernames cannot be taken twice', dupe)

    await A.saveAccountData(opened, { 'mathlab-profile': JSON.stringify({ name: 'Ada L' }) })
    const reopened = await A.openAccount('Ada', 'correct horse battery')
    ok('accounts: saved data survives a re-open',
        JSON.parse(reopened.data['mathlab-profile']).name === 'Ada L')

    const rotated = await A.changePassword(reopened, 'correct horse battery', 'a brand new secret')
    const afterRotate = await A.openAccount('Ada', 'a brand new secret')
    ok('accounts: the new password opens the data after a change',
        JSON.parse(afterRotate.data['mathlab-profile']).name === 'Ada L' && !!rotated.cryptoKey)
    let oldRefused = false
    try { await A.openAccount('Ada', 'correct horse battery') } catch { oldRefused = true }
    ok('accounts: the old password stops working after a change', oldRefused)

    // Two accounts must not be able to read each other.
    await A.createAccount('Bob', 'bobs long password', { 'mathlab-profile': JSON.stringify({ name: 'Bob' }) })
    let crossed = false
    try { await A.openAccount('Bob', 'a brand new secret') } catch { crossed = true }
    ok('accounts: one profile cannot be opened with another profile password', crossed)
    ok('accounts: listing shows both', A.listAccounts().length === 2)

    A.deleteAccount('bob')
    ok('accounts: deleting removes it', !A.accountExists('Bob') && A.accountExists('Ada'))

    // workspace swapping — a key missing from a snapshot must be cleared, or one
    // profile's progress bleeds into the next session
    globalThis.localStorage.setItem('mathlab-exercise-progress', '{"a":1}')
    const snap = A.snapshotWorkspace()
    ok('accounts: snapshot captures live keys', snap['mathlab-exercise-progress'] === '{"a":1}')
    A.restoreWorkspace({})
    ok('accounts: restoring an empty snapshot clears the keys',
        globalThis.localStorage.getItem('mathlab-exercise-progress') === null)
    A.restoreWorkspace(snap)
    ok('accounts: restoring puts them back', globalThis.localStorage.getItem('mathlab-exercise-progress') === '{"a":1}')
    ok('accounts: isWorkspaceEmpty sees real work',
        A.isWorkspaceEmpty({}) === true
        && A.isWorkspaceEmpty({ 'mathlab-exercise-progress': '{}' }) === true
        && A.isWorkspaceEmpty(snap) === false)

    globalThis.localStorage.clear()
    delete globalThis.localStorage
}

// --- report ---------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed  (${TOTAL_SKILLS} skills exercised)`)
if (failed) {
    console.log('\nFailures:')
    for (const f of fails) console.log('  ✗ ' + f)
    process.exit(1)
}
console.log('All tests passed ✓')

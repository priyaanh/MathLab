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
    hueFor, pruneRetiredDefaults, readableOn, embedUrl, isBlocked, searchTermOf, sanitizeHistory, recordVisit, rankSuggestions, prettyPath, MAX_HISTORY,
    ENGINES, DEFAULT_PREFS, MAX_BOOKMARKS, MAX_TABS, MAX_STACK, MIN_RAIL, MAX_RAIL, BLOCKED_CHOICES,
    sanitizeEngines, allEngines, MAX_CUSTOM_ENGINES,
    ZOOM_LEVELS, clampZoom, stepZoom, sanitizeZooms, zoomFor, setZoomFor, waybackUrl,
    moveItem, withPinnedFirst, tabTitle, topSites, dayLabel, groupHistory,
    clampWindow, sanitizePos, resizeBox, parseOpenSearch, mergeSuggestions, suggestUrl, KEEP_ON_SCREEN,
    rankPalette, scorePalette, sanitizeSavedSets, saveSet, removeSet, MAX_SAVED_SETS,
    sanitizeHostList, hostListed, toggleHost, MAX_POPUP_HOSTS, sameLocation, greeting,
    exportBookmarksHTML, parseBookmarksHTML, pruneHistory, HISTORY_DAY_OPTS, groupedTabOrder, GROUP_COLORS,
    sanitizeTags, MAX_BOOKMARK_TAGS,
    packBackup, parseBackup, looksLikeMath, parsePercent, parseRadix,
    resolveBang, bangFromName
} from '../src/utils/webframe.js'
import { evaluateExpression } from '../src/utils/mathUtils.js'
import { parseConversion } from '../src/utils/convert.js'
import { qrMatrix, qrFits } from '../src/utils/qr.js'
import {
    computeAnswer, parsePlot, parseFactor, parsePrime, parseGcdLcm, parseDivisors,
    parseBaseN, parseRoman, parseNumWords, parseColor, parseCharCode, parseConstant, parseDate
} from '../src/utils/answers.js'
import { syncDecision, hashContent, reachError } from '../src/utils/sync.js'

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
    // Derived from the list, not hardcoded: the default engine has already changed
    // domain once, and a test that pins the URL only breaks the next time it moves.
    const defaultEngine = ENGINES.find(e => e.id === DEFAULT_PREFS.engine)
    ok('webframe: prose becomes a search', toUrl('why is pi irrational') === defaultEngine.q('why is pi irrational'))
    ok('webframe: search terms are encoded', toUrl('a b&c').endsWith('a%20b%26c'), toUrl('a b&c'))
    ok('webframe: engine choice is honoured', toUrl('pi', 'wikipedia').startsWith('https://en.wikipedia.org/w/index.php?search='))
    ok('webframe: an unknown engine falls back', toUrl('pi', 'nope') === ENGINES[0].q('pi'))
    ok('webframe: the first engine is the default one', ENGINES[0].id === DEFAULT_PREFS.engine)
    /* bang shortcuts: "!w pi" / "pi !w" fire one engine inline */
    {
        const eng = allEngines([{ name: 'GitHub', url: 'https://github.com/search?q=%s' }])
        ok('bang: a leading bang searches its engine', resolveBang('!w pi', eng).engine.id === 'wikipedia')
        ok('bang: a trailing bang works too', resolveBang('pi !w', eng).engine.id === 'wikipedia')
        ok('bang: the query drops the bang token', resolveBang('!w quantum pi', eng).query === 'quantum pi')
        ok('bang: a custom engine gets a name-derived bang', resolveBang('!github react', eng).engine.name === 'GitHub')
        ok('bang: an unknown bang is not a bang', resolveBang('!important in css', eng) === null)
        ok('bang: a bang with no query is not a bang', resolveBang('!w', eng) === null && resolveBang('!w   ', eng) === null)
        ok('bang: matching is case-insensitive', resolveBang('!W pi', eng).engine.id === 'wikipedia')
        ok('bang: toUrl routes a bang past address detection',
            toUrl('!w apple.com', 'oeis', eng) === ENGINES.find(e => e.id === 'wikipedia').q('apple.com'))
        ok('bang: a trailing bang beats a bare host', toUrl('apple.com !w', 'oeis', eng).includes('index.php?search=apple.com'))
        ok('bang: plain text is untouched', resolveBang('why is pi irrational', eng) === null)
        ok('bang: name-derived bangs are letters/digits only', bangFromName('Duck Duck Go!') === 'duckduckgo')
        ok('bang: a custom bang colliding with a built-in is made unique',
            allEngines([{ name: 'Wiby', url: 'https://x.example/?q=%s' }]).filter(e => e.bang === 'wiby').length === 1)
    }
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
            'https://web.archive.org/web/3000/https://x.com', 'https://oeis.org/search?q=1',
            // the list says wolframalpha, never wolfram: MathWorld allows framing
            'https://mathworld.wolfram.com/Pi.html', 'https://searx.be/search?q=pi'].every(u => !blocksFraming(u)))
    ok('webframe: a subdomain of a refusing site is caught too',
        ['https://search.brave.com/search?q=pi', 'https://docs.github.com', 'https://www.arxiv.org/abs/1'].every(blocksFraming))
    ok('webframe: a host that merely contains the word is left alone',
        ['https://notgoogle.com', 'https://redditlike.org'].every(u => !blocksFraming(u)))

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


    /* ---- official embeds for sites that refuse plain framing ---- */
    ok('embed: a YouTube watch URL becomes the player',
        embedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    ok('embed: a youtu.be short link works',
        embedUrl('https://youtu.be/dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    ok('embed: a start time is carried over',
        embedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42')
    ok('embed: shorts work', embedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    ok('embed: a playlist becomes videoseries',
        embedUrl('https://www.youtube.com/playlist?list=PL1234567890').includes('/embed/videoseries?list=PL1234567890'))
    ok('embed: an existing embed URL passes through',
        embedUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ').includes('/embed/dQw4w9WgXcQ'))
    ok('embed: YouTube search and channels have no embed',
        embedUrl('https://www.youtube.com/results?search_query=cats') === null
        && embedUrl('https://www.youtube.com/@someone') === null
        && embedUrl('https://www.youtube.com') === null)
    ok('embed: a junk video id is refused', embedUrl('https://www.youtube.com/watch?v=../evil') === null)

    ok('embed: Google Search has no embed and stays blocked',
        embedUrl('https://www.google.com/search?q=pi') === null && isBlocked('https://www.google.com/search?q=pi'))
    ok('embed: Google Docs maps to /preview',
        embedUrl('https://docs.google.com/document/d/abc123/edit') === 'https://docs.google.com/document/d/abc123/preview')
    ok('embed: Drive files map to /preview',
        embedUrl('https://drive.google.com/file/d/abc123/view') === 'https://drive.google.com/file/d/abc123/preview')
    ok('embed: Google Maps uses the documented embed form',
        embedUrl('https://www.google.com/maps/place/Eiffel+Tower/@48.85,2.29,17z').includes('output=embed'))

    ok('embed: junk and non-http are refused',
        embedUrl('not a url') === null && embedUrl('javascript:alert(1)') === null && embedUrl(null) === null)
    ok('blocked: a YouTube video is no longer treated as blocked',
        isBlocked('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === false)
    ok('blocked: an embeddable site was never blocked anyway',
        isBlocked('https://en.wikipedia.org') === false && isBlocked('') === false)

    ok('searchTermOf: pulls the query back out',
        searchTermOf('https://www.google.com/search?q=pythagorean+theorem') === 'pythagorean theorem')
    ok('searchTermOf: nothing to pull gives empty',
        searchTermOf('https://example.com') === '' && searchTermOf('junk') === '')

    /* ---- visited history + address-bar suggestions ---- */
    ok('history: junk is filtered out',
        sanitizeHistory([{ url: 'https://a.com' }, { url: 'ftp://no' }, null, 'x', {}]).length === 1)
    ok('history: non-arrays give an empty list', sanitizeHistory(null).length === 0 && sanitizeHistory({}).length === 0)
    ok('history: duplicates collapse', sanitizeHistory([{ url: 'https://a.com' }, { url: 'https://a.com' }]).length === 1)
    ok('history: newest first', (() => {
        const h = sanitizeHistory([{ url: 'https://old.com', last: 1 }, { url: 'https://new.com', last: 9 }])
        return h[0].url === 'https://new.com'
    })())
    ok('history: the list is capped',
        sanitizeHistory(Array.from({ length: 500 }, (_, i) => ({ url: `https://s${i}.com`, last: i }))).length === MAX_HISTORY)
    ok('history: a visit moves to the front and counts up', (() => {
        let h = []
        h = recordVisit(h, 'https://a.com', 1)
        h = recordVisit(h, 'https://b.com', 2)
        h = recordVisit(h, 'https://a.com', 3)
        return h[0].url === 'https://a.com' && h[0].visits === 2 && h.length === 2
    })())
    ok('history: a junk URL is ignored', recordVisit([], 'not a url', 1).length === 0)

    const SUG = {
        bookmarks: [{ label: 'Wikipedia', url: 'https://en.wikipedia.org' }],
        history: [
            { url: 'https://archive.org/details/x', visits: 5, last: 9 },
            { url: 'https://example.com', visits: 1, last: 8 }
        ]
    }
    ok('suggest: a blank query suggests nothing',
        rankSuggestions('', SUG).length === 0 && rankSuggestions('   ', SUG).length === 0)
    ok('suggest: matches a host prefix', rankSuggestions('arch', SUG)[0].url === 'https://archive.org/details/x')
    ok('suggest: matches a bookmark label', rankSuggestions('wiki', SUG)[0].url === 'https://en.wikipedia.org')
    ok('suggest: a bookmark outranks history at equal match', (() => {
        const both = { bookmarks: [{ label: 'Zed', url: 'https://zed.com' }], history: [{ url: 'https://zeta.com', visits: 1, last: 1 }] }
        return rankSuggestions('ze', both)[0].url === 'https://zed.com'
    })())
    ok('suggest: nothing matching gives nothing', rankSuggestions('qqqqzz', SUG).length === 0)
    ok('suggest: results are capped', (() => {
        const many = { bookmarks: [], history: Array.from({ length: 30 }, (_, i) => ({ url: `https://test${i}.com`, visits: 1, last: i })) }
        return rankSuggestions('test', many, 4).length === 4
    })())
    ok('suggest: a bookmarked page is not listed twice', (() => {
        const dup = { bookmarks: [{ label: 'Same', url: 'https://same.com' }], history: [{ url: 'https://same.com', visits: 9, last: 1 }] }
        const r = rankSuggestions('same', dup)
        return r.length === 1 && r[0].kind === 'bookmark'
    })())
    ok('suggest: matching is case-insensitive',
        rankSuggestions('WIKI', SUG).length === 1 && rankSuggestions('Arch', SUG).length === 1)

    ok('prettyPath: reads a title out of the last segment',
        prettyPath('https://en.wikipedia.org/wiki/Pythagorean_theorem') === 'Pythagorean theorem')
    ok('prettyPath: strips a file extension', prettyPath('https://a.com/docs/intro.html') === 'intro')
    ok('prettyPath: a bare host has no path title',
        prettyPath('https://example.com') === '' && prettyPath('https://example.com/') === '')
    ok('prettyPath: junk is safe', prettyPath('not a url') === '' && prettyPath(null) === '')
    ok('suggest: history rows are labelled by their page, not the host', (() => {
        const h = { bookmarks: [], history: [{ url: 'https://en.wikipedia.org/wiki/Euclid', visits: 1, last: 1 }] }
        return rankSuggestions('euclid', h)[0].label === 'Euclid'
    })())
    ok('suggest: a page title is matchable, not just the host', (() => {
        const h = { bookmarks: [], history: [{ url: 'https://en.wikipedia.org/wiki/Pythagorean_theorem', visits: 1, last: 1 }] }
        return rankSuggestions('pythag', h).length === 1
    })())
    ok('suggest: two pages on one host stay distinct', (() => {
        const h = { bookmarks: [], history: [
            { url: 'https://en.wikipedia.org/wiki/Euclid', visits: 1, last: 2 },
            { url: 'https://en.wikipedia.org/wiki/Pythagorean_theorem', visits: 1, last: 1 }
        ] }
        const r = rankSuggestions('wikipedia', h)
        return r.length === 2 && r[0].label !== r[1].label
    })())
}



// --- 8b. web viewer: zoom, tab strip, history panel ------------------------
{
    /* zoom is written into a style attribute and read back from localStorage, so
       every value that reaches it has to land on a known step */
    ok('zoom: the ladder passes through 1', ZOOM_LEVELS.includes(1))
    ok('zoom: the ladder is sorted and unique',
        ZOOM_LEVELS.every((z, i) => i === 0 || z > ZOOM_LEVELS[i - 1]))
    ok('zoom: junk clamps to 100%', [null, undefined, NaN, 'big', {}, [], '', 0, -3, true].every(v => clampZoom(v) === 1))
    ok('zoom: an odd number snaps to the nearest step', clampZoom(1.03) === 1 && clampZoom(1.2) === 1.25)
    ok('zoom: stepping in and out returns to where it started', stepZoom(stepZoom(1, 1), -1) === 1)
    ok('zoom: the ends of the ladder hold',
        stepZoom(ZOOM_LEVELS[0], -1) === ZOOM_LEVELS[0]
        && stepZoom(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], 1) === ZOOM_LEVELS[ZOOM_LEVELS.length - 1])
    ok('zoom: a stored 100% is dropped rather than kept', !('a.com' in sanitizeZooms({ 'a.com': 1 })))
    ok('zoom: a bogus host key is dropped', !('not a host' in sanitizeZooms({ 'not a host': 2 })))
    ok('zoom: a good entry survives a round trip', sanitizeZooms({ 'en.wikipedia.org': 1.25 })['en.wikipedia.org'] === 1.25)
    ok('zoom: it is read back per host, not per page',
        zoomFor({ 'en.wikipedia.org': 1.5 }, 'https://en.wikipedia.org/wiki/Anything') === 1.5)
    ok('zoom: an unzoomed site reads as 100%', zoomFor({}, 'https://example.com') === 1 && zoomFor(null, 'https://example.com') === 1)
    ok('zoom: setting a level keys it on the host',
        setZoomFor({}, 'https://en.wikipedia.org/wiki/Pi', 1.25)['en.wikipedia.org'] === 1.25)
    ok('zoom: back to 100% removes the entry',
        Object.keys(setZoomFor({ 'a.com': 2 }, 'https://a.com/x', 1)).length === 0)
    ok('zoom: a junk URL changes nothing', Object.keys(setZoomFor({}, 'nonsense', 2)).length === 0)

    /* the archived copy is the one honest way into a site that refuses framing */
    ok('wayback: it wraps a real page', waybackUrl('https://x.com/a') === 'https://web.archive.org/web/3000/https://x.com/a')
    ok('wayback: the archive is never archived', waybackUrl('https://web.archive.org/web/3000/https://x.com') === null)
    ok('wayback: junk gives nothing back', [null, '', 'javascript:alert(1)', 'ftp://a.com'].every(u => waybackUrl(u) === null))
    ok('wayback: the archive itself can be framed', !blocksFraming('https://web.archive.org/web/3000/https://x.com'))

    /* tab strip */
    ok('tabs: an item moves and the rest close up', moveItem([1, 2, 3, 4], 0, 2).join('') === '2314')
    ok('tabs: moving backwards works too', moveItem([1, 2, 3, 4], 3, 1).join('') === '1423')
    ok('tabs: an out-of-range move is a no-op',
        moveItem([1, 2], 5, 0).join('') === '12' && moveItem([1, 2], 0, 9).join('') === '12' && moveItem([1, 2], 1, 1).join('') === '12')
    ok('tabs: the input array is never mutated', (() => {
        const a = [1, 2, 3]
        moveItem(a, 0, 2)
        return a.join('') === '123'
    })())
    ok('tabs: pinned ones come first, order otherwise kept',
        withPinnedFirst([{ id: 1 }, { id: 2, pinned: true }, { id: 3 }, { id: 4, pinned: true }])
            .map(t => t.id).join('') === '2413')
    ok('tabs: junk in the list does not throw', withPinnedFirst([null, { id: 1 }]).length === 2 && withPinnedFirst(null).length === 0)
    ok('tabs: a pinned tab survives a restart',
        sanitizeSession({ tabs: [{ stack: ['https://a.com'], idx: 0, pinned: true }], active: 0 }).tabs[0].pinned === true)
    ok('tabs: pinned is never inherited from junk',
        sanitizeSession({ tabs: [{ stack: ['https://a.com'], idx: 0, pinned: 'yes' }], active: 0 }).tabs[0].pinned === false)

    /* tab titles stand in for a <title> no cross-origin frame will hand over */
    ok('tabs: a real page names itself', tabTitle('https://en.wikipedia.org/wiki/Pythagorean_theorem') === 'Pythagorean theorem')
    ok('tabs: a generic segment falls back to the host',
        tabTitle('https://marginalia-search.com/search?query=pi') === 'marginalia-search.com'
        && tabTitle('https://a.com/index.html') === 'a.com')
    ok('tabs: a bare host is its own title', tabTitle('https://example.com') === 'example.com')
    ok('tabs: a short article name still beats the host', tabTitle('https://en.wikipedia.org/wiki/Pi') === 'Pi')
    ok('tabs: a bare id is not a title', tabTitle('https://a.com/12345') === 'a.com')
    ok('tabs: a blank tab is still "New tab"', tabTitle(null) === 'New tab' && tabTitle('') === 'New tab')
    ok('tabs: a very long title is cut, not left to overflow', tabTitle(`https://a.com/${'x'.repeat(90)}`).length <= 34)

    /* home screen: one tile per site, and never one already on the shelf */
    const hist = [
        { url: 'https://en.wikipedia.org/wiki/Pi', visits: 9, last: 500 },
        { url: 'https://en.wikipedia.org/wiki/E', visits: 2, last: 900 },
        { url: 'https://oeis.org/A000045', visits: 4, last: 400 },
        { url: 'https://archive.org', visits: 1, last: 100 }
    ]
    const top = topSites(hist)
    ok('home: one tile per site', top.filter(t => hostOf(t.url) === 'en.wikipedia.org').length === 1)
    ok('home: the most-opened page wins its site', top[0].url === 'https://en.wikipedia.org/wiki/Pi')
    ok('home: tiles are ordered by how often they were opened', top.map(t => t.visits).join(',') === '9,4,1')
    ok('home: an existing shortcut is not shown twice',
        topSites(hist, { exclude: ['https://en.wikipedia.org/wiki/Pi'] })[0].url !== 'https://en.wikipedia.org/wiki/Pi')
    ok('home: the limit is honoured', topSites(hist, { limit: 2 }).length === 2)
    ok('home: no history gives no tiles', topSites([]).length === 0 && topSites(null).length === 0)

    /* history panel */
    const noon = new Date(2026, 6, 15, 12, 0, 0).getTime()
    ok('history: today and yesterday are named', dayLabel(noon, noon) === 'Today' && dayLabel(noon - 86400000, noon) === 'Yesterday')
    ok('history: an older day gets a written date', /\d/.test(dayLabel(noon - 86400000 * 40, noon)))
    ok('history: an unreadable stamp does not throw', dayLabel(NaN, noon) === 'Earlier')

    const rows = [
        { url: 'https://en.wikipedia.org/wiki/Pi', visits: 3, last: noon },
        { url: 'https://oeis.org/A000045', visits: 1, last: noon - 60000 },
        { url: 'https://example.com/old', visits: 1, last: noon - 86400000 * 3 }
    ]
    const groups = groupHistory(rows, { now: noon })
    ok('history: rows are grouped by day, newest first', groups.length === 2 && groups[0].label === 'Today' && groups[0].items.length === 2)
    ok('history: the filter matches the address', groupHistory(rows, { query: 'oeis', now: noon }).flatMap(g => g.items).length === 1)
    ok('history: the filter matches the readable title too',
        groupHistory(rows, { query: 'pi', now: noon }).flatMap(g => g.items)[0].url === 'https://en.wikipedia.org/wiki/Pi')
    ok('history: a filter that matches nothing leaves no empty headings', groupHistory(rows, { query: 'zzz', now: noon }).length === 0)
    ok('history: junk gives an empty list', groupHistory(null).length === 0)
    ok('history: the input list is not re-ordered in place', (() => {
        const a = [{ url: 'https://a.com', visits: 1, last: 1 }, { url: 'https://b.com', visits: 1, last: 9 }]
        groupHistory(a)
        return a[0].url === 'https://a.com'
    })())

    ok('prefs: the frequently-visited row defaults on and can be turned off',
        sanitizePrefs(null).showNtpTop === true && sanitizePrefs({ showNtpTop: false }).showNtpTop === false)
}

// --- 8c. web viewer: window geometry and suggestions -----------------------
{
    const view = { width: 1200, height: 800 }
    const win = { w: 800, h: 600 }

    /* a window can hang off an edge, but never far enough to lose its toolbar */
    ok('window: a position inside the screen is left alone',
        JSON.stringify(clampWindow({ x: 100, y: 60 }, win, view)) === JSON.stringify({ x: 100, y: 60 }))
    ok('window: dragged off the left, a strip stays grabbable',
        clampWindow({ x: -5000, y: 10 }, win, view).x === KEEP_ON_SCREEN - win.w)
    ok('window: dragged off the right, a strip stays grabbable',
        clampWindow({ x: 5000, y: 10 }, win, view).x === view.width - KEEP_ON_SCREEN)
    ok('window: it can never go above the top', clampWindow({ x: 10, y: -400 }, win, view).y === 0)
    ok('window: it can never fall past the bottom',
        clampWindow({ x: 10, y: 5000 }, win, view).y === view.height - KEEP_ON_SCREEN)
    ok('window: a window smaller than the margin is still fully placeable',
        clampWindow({ x: 0, y: 0 }, { w: 40, h: 30 }, view).x === 0)
    ok('window: junk coordinates do not produce NaN',
        Number.isFinite(clampWindow({ x: undefined, y: 'x' }, win, view).x))

    ok('window: a saved position round-trips', JSON.stringify(sanitizePos({ x: 12.4, y: 7.6 })) === JSON.stringify({ x: 12, y: 8 }))
    ok('window: never-moved reads as null',
        [null, undefined, [], 'x', { x: 1 }, { x: NaN, y: 0 }].every(v => sanitizePos(v) === null))

    /* resizing: the edge you did not grab must not move */
    const start = { x: 100, y: 100, w: 800, h: 600 }
    ok('resize: the south-east corner grows without moving the window',
        JSON.stringify(resizeBox('se', start, 50, 40)) === JSON.stringify({ x: 100, y: 100, w: 850, h: 640 }))
    ok('resize: pulling the top edge down keeps the bottom edge still', (() => {
        const b = resizeBox('n', start, 0, 50)
        return b.y === 150 && b.h === 550 && b.y + b.h === start.y + start.h
    })())
    ok('resize: pulling the left edge keeps the right edge still', (() => {
        const b = resizeBox('w', start, 60, 0)
        return b.x === 160 && b.w === 740 && b.x + b.w === start.x + start.w
    })())
    ok('resize: a corner moves both of its edges', (() => {
        const b = resizeBox('nw', start, 30, 20)
        return b.x === 130 && b.y === 120 && b.w === 770 && b.h === 580
    })())
    ok('resize: the minimum size holds, and the anchored edge stays put', (() => {
        const b = resizeBox('nw', start, 5000, 5000, { w: 520, h: 360 })
        return b.w === 520 && b.h === 360 && b.x + b.w === start.x + start.w && b.y + b.h === start.y + start.h
    })())
    ok('resize: "move" changes place and not size', (() => {
        const b = resizeBox('move', start, -40, 25)
        return b.x === 60 && b.y === 125 && b.w === start.w && b.h === start.h
    })())

    /* article suggestions */
    ok('suggest: the endpoint asks for CORS and encodes the query',
        suggestUrl('a b').includes('origin=*') && suggestUrl('a b').endsWith('a%20b'))
    ok('suggest: a very long query is cut before it is sent', suggestUrl('x'.repeat(400)).length < 300)
    const os = ['pi', ['Pi', 'Pion', 'Bad'], ['', '', ''], ['https://en.wikipedia.org/wiki/Pi', 'https://en.wikipedia.org/wiki/Pion', 'not-a-url']]
    ok('suggest: well-formed rows are kept', parseOpenSearch(os).length === 2)
    ok('suggest: a row without a usable URL is dropped', !parseOpenSearch(os).some(r => r.label === 'Bad'))
    ok('suggest: rows are labelled as articles', parseOpenSearch(os).every(r => r.kind === 'article'))
    ok('suggest: the limit is honoured', parseOpenSearch(os, 1).length === 1)
    ok('suggest: a broken reply gives nothing rather than throwing',
        [null, undefined, {}, [], ['pi'], 'nope', [1, 2, 3, 4]].every(v => parseOpenSearch(v).length === 0))

    const local = [{ url: 'https://a.com', kind: 'bookmark' }, { url: 'https://b.com', kind: 'history' }]
    const remote = [{ url: 'https://a.com', kind: 'article' }, { url: 'https://c.com', kind: 'article' }]
    ok('suggest: local rows come first and are never displaced',
        mergeSuggestions(local, remote).slice(0, 2).every((r, i) => r.url === local[i].url))
    ok('suggest: a page already suggested locally is not repeated',
        mergeSuggestions(local, remote).filter(r => r.url === 'https://a.com').length === 1)
    ok('suggest: the merged list respects its limit', mergeSuggestions(local, remote, 2).length === 2)

    /* an open tab is offered as "switch to it", not as a second copy */
    const openTabs = [{ id: 7, url: 'https://en.wikipedia.org/wiki/Pi' }]
    const withOpen = rankSuggestions('wikipedia', {
        bookmarks: [{ url: 'https://en.wikipedia.org/wiki/Pi', label: 'Pi' }],
        history: [{ url: 'https://en.wikipedia.org/wiki/Pi', visits: 4, last: 9 }],
        open: openTabs
    })
    ok('suggest: an open page is offered once, as a tab', withOpen.length === 1 && withOpen[0].kind === 'tab')
    ok('suggest: the tab row carries the id needed to raise it', withOpen[0].tabId === 7)
    ok('suggest: it outranks the same page as a bookmark', (() => {
        const two = rankSuggestions('e', {
            bookmarks: [{ url: 'https://example.org', label: 'example' }],
            open: [{ id: 3, url: 'https://en.wikipedia.org/wiki/Euler' }]
        })
        return two[0].kind === 'tab'
    })())
    ok('suggest: no open tabs still works', rankSuggestions('wiki', { history: [{ url: 'https://en.wikipedia.org/wiki/Pi', visits: 1, last: 1 }] }).length === 1)

    /*
     * The blocklist decides whether a typed address loads or is sent to a browser
     * tab, so a wrong entry is felt directly: a frameable site turned away looks
     * like the viewer is refusing to go where it was told. These were all read off
     * the sites' own headers.
     */
    ok('framing: hosts that really do refuse are caught',
        ['https://www.apple.com', 'https://www.google.com', 'https://github.com', 'https://www.roblox.com',
            'https://slack.com', 'https://www.dropbox.com', 'https://www.canva.com', 'https://chatgpt.com',
            'https://www.amazon.com/dp/B0'].every(blocksFraming))
    ok('framing: hosts that send no such header are left alone',
        ['https://www.microsoft.com', 'https://zoom.us', 'https://www.baidu.com', 'https://www.imdb.com',
            'https://www.ebay.com', 'https://outlook.live.com'].every(u => !blocksFraming(u)),
        JSON.stringify(['https://www.microsoft.com', 'https://zoom.us', 'https://www.baidu.com',
            'https://www.imdb.com', 'https://www.ebay.com', 'https://outlook.live.com'].filter(blocksFraming)))
    ok('framing: a bare domain typed in the bar becomes that site, not a search',
        toUrl('apple.com') === 'https://apple.com' && toUrl('microsoft.com') === 'https://microsoft.com')
    ok('webframe: a domain keeps its path, query and fragment',
        toUrl('apple.com/iphone?x=1#top') === 'https://apple.com/iphone?x=1#top')
    ok('webframe: a port is part of the address', toUrl('example.com:8080/x') === 'https://example.com:8080/x')
    ok('webframe: a decimal or a ratio is still a search',
        !toUrl('3.5').startsWith('https://3.5') && toUrl('what is 3.5:1').includes('search'))

    /*
     * Official embed endpoints. These are the only honest way to show a site that
     * refuses page framing: the endpoint is published by the site for exactly this,
     * so nothing is being circumvented. Each URL below was fetched and confirmed to
     * come back without an X-Frame-Options that would stop it.
     */
    /*
     * A site whose page refuses framing but whose content has an embed is listed in
     * FRAMING_REFUSED *and* mapped here. The pair has to stay in step: the mapping
     * without the listing leaves the surrounding pages showing a blank pane, and the
     * listing without the mapping walls off the very thing worth opening.
     */
    ok('embed: a PhET simulation opens as the runnable sim',
        embedUrl('https://phet.colorado.edu/en/simulations/graphing-lines')
        === 'https://phet.colorado.edu/sims/html/graphing-lines/latest/graphing-lines_en.html')
    ok('embed: a sim URL is already the right thing',
        embedUrl('https://phet.colorado.edu/sims/html/graphing-lines/latest/graphing-lines_en.html') !== null)
    ok('embed: so a sim opens but the rest of PhET is walled',
        !isBlocked('https://phet.colorado.edu/en/simulations/graphing-lines')
        && isBlocked('https://phet.colorado.edu/en/about'))

    ok('embed: a TED talk becomes its embed',
        embedUrl('https://www.ted.com/talks/ken_robinson_says_schools_kill_creativity')
        === 'https://embed.ted.com/talks/ken_robinson_says_schools_kill_creativity')
    ok('embed: the rest of TED has none', embedUrl('https://www.ted.com/about/our-organization') === null)

    ok('embed: an Observable notebook becomes its embed',
        embedUrl('https://observablehq.com/@d3/bar-chart') === 'https://observablehq.com/embed/@d3/bar-chart')
    ok('embed: an Observable listing has none', embedUrl('https://observablehq.com/explore') === null)

    ok('embed: a Google Form gets the documented embedded flag',
        embedUrl('https://docs.google.com/forms/d/e/1FAIpQLSabc/viewform') === 'https://docs.google.com/forms/d/e/1FAIpQLSabc/viewform?embedded=true')
    ok('embed: a form already flagged is unchanged in meaning',
        embedUrl('https://docs.google.com/forms/d/e/1FAIpQLSabc/viewform?embedded=true').includes('embedded=true'))
    ok('embed: Docs, Sheets and Slides still map to /preview',
        embedUrl('https://docs.google.com/document/d/abc123/edit') === 'https://docs.google.com/document/d/abc123/preview')

    ok('embed: an arXiv abstract opens as the paper itself',
        embedUrl('https://arxiv.org/abs/1706.03762') === 'https://arxiv.org/pdf/1706.03762')
    ok('embed: a versioned id is kept', embedUrl('https://arxiv.org/abs/2301.00001v2') === 'https://arxiv.org/pdf/2301.00001v2')
    ok('embed: a PDF link is already the right thing', embedUrl('https://arxiv.org/pdf/2301.00001') === 'https://arxiv.org/pdf/2301.00001')
    ok('embed: an arXiv listing has no paper to show', embedUrl('https://arxiv.org/list/math.NT/recent') === null)
    ok('embed: so a paper is reachable but a listing is not',
        !isBlocked('https://arxiv.org/abs/1706.03762') && isBlocked('https://arxiv.org/list/math.NT/recent'))

    ok('embed: a Google Books edition becomes the viewer',
        embedUrl('https://www.google.com/books/edition/_/zyTCAlFPjgYC') === 'https://books.google.com/books?id=zyTCAlFPjgYC&output=embed')
    ok('embed: the older books.google.com form works too',
        embedUrl('https://books.google.com/books?id=zyTCAlFPjgYC') === 'https://books.google.com/books?id=zyTCAlFPjgYC&output=embed')
    ok('embed: a book with no id is refused', embedUrl('https://books.google.com/books') === null)

    ok('embed: an Archive item opens in its reader',
        embedUrl('https://archive.org/details/AlicesAdventuresInWonderland') === 'https://archive.org/embed/AlicesAdventuresInWonderland')
    ok('embed: a SoundCloud track becomes its player',
        embedUrl('https://soundcloud.com/artist/track-name').startsWith('https://w.soundcloud.com/player/?url='))
    ok('embed: a SoundCloud profile is not a track', embedUrl('https://soundcloud.com/artist') === null)
    ok('embed: a Dailymotion video becomes its player',
        embedUrl('https://www.dailymotion.com/video/x8abcde') === 'https://geo.dailymotion.com/player.html?video=x8abcde')
    ok('embed: only Google Calendar\'s own embed view is used',
        embedUrl('https://calendar.google.com/calendar/embed?src=x') !== null
        && embedUrl('https://calendar.google.com/calendar/u/0/r') === null)

    ok('embed: a Spotify track becomes the published player',
        embedUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT') === 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT')
    ok('embed: a playlist works and its tracking query is dropped',
        embedUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x') === 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M')
    ok('embed: an already-embedded Spotify URL is left alone',
        embedUrl('https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT') === 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT')
    ok('embed: a Spotify home page has no embed', embedUrl('https://open.spotify.com/') === null)

    ok('embed: a Reddit post becomes the post embed',
        embedUrl('https://www.reddit.com/r/math/comments/1abcdef/some_title/') === 'https://embed.reddit.com/r/math/comments/1abcdef/')
    ok('embed: old.reddit posts work the same', embedUrl('https://old.reddit.com/r/math/comments/1abcdef/x/') !== null)
    ok('embed: a subreddit listing has no embed', embedUrl('https://www.reddit.com/r/math/') === null)
    ok('embed: so a listing is still reported as blocked', isBlocked('https://www.reddit.com/r/math/'))
    ok('embed: but a post is not', !isBlocked('https://www.reddit.com/r/math/comments/1abcdef/x/'))

    const osm = embedUrl('https://www.openstreetmap.org/#map=15/51.5074/-0.1278')
    ok('embed: a map position becomes the export view', osm.startsWith('https://www.openstreetmap.org/export/embed.html?bbox='))
    ok('embed: the marker keeps the place it was centred on', osm.includes('marker=51.5074,-0.1278'))
    ok('embed: the box brackets that point', (() => {
        const [w, s2, e, n] = new URL(osm).searchParams.get('bbox').split(',').map(Number)
        return w < -0.1278 && e > -0.1278 && s2 < 51.5074 && n > 51.5074
    })())
    ok('embed: a closer zoom gives a tighter box', (() => {
        const box = (z) => new URL(embedUrl(`https://www.openstreetmap.org/#map=${z}/51.5/-0.1`)).searchParams.get('bbox').split(',').map(Number)
        const [w1, , e1] = box(12)
        const [w2, , e2] = box(17)
        return (e2 - w2) < (e1 - w1)
    })())
    ok('embed: the older ?mlat/?mlon marker form works too',
        embedUrl('https://www.openstreetmap.org/?mlat=48.8584&mlon=2.2945').includes('marker=48.8584,2.2945'))
    ok('embed: a map with no position is not guessed at',
        embedUrl('https://www.openstreetmap.org/') === null && embedUrl('https://www.openstreetmap.org/about') === null)
    ok('embed: nonsense coordinates are refused',
        embedUrl('https://www.openstreetmap.org/?mlat=999&mlon=0') === null
        && embedUrl('https://www.openstreetmap.org/?mlat=abc&mlon=1') === null)

    ok('prefs: a refused site shows the archived copy by default',
        sanitizePrefs(null).onBlocked === 'archive')
    ok('prefs: every blocked-site answer is accepted',
        BLOCKED_CHOICES.every(c => sanitizePrefs({ onBlocked: c }).onBlocked === c))
    ok('prefs: the popup answer is one of them', BLOCKED_CHOICES.includes('popup'))
    ok('prefs: "ask before opening" defaults off and toggles on',
        sanitizePrefs(null).confirmOpen === false
        && sanitizePrefs({ confirmOpen: true }).confirmOpen === true
        && sanitizePrefs({ confirmOpen: 'yes' }).confirmOpen === false)

    /* custom search engines */
    {
        const good = [
            { name: 'Google', url: 'https://www.google.com/search?q=%s' },
            { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' }
        ]
        ok('engines: valid custom engines are kept', sanitizeEngines(good).length === 2)
        ok('engines: each gets a stable id', sanitizeEngines(good).map(e => e.id).join(',') === 'custom-0,custom-1')
        ok('engines: http (non-https) is refused', sanitizeEngines([{ name: 'X', url: 'http://x.com/%s' }]).length === 0)
        ok('engines: a template without %s is refused', sanitizeEngines([{ name: 'X', url: 'https://x.com/' }]).length === 0)
        ok('engines: a nameless engine is refused', sanitizeEngines([{ name: '', url: 'https://x.com/%s' }]).length === 0)
        ok('engines: duplicate templates fold together', sanitizeEngines([good[0], { name: 'G2', url: good[0].url }]).length === 1)
        ok('engines: the count is capped', sanitizeEngines(Array.from({ length: MAX_CUSTOM_ENGINES + 4 }, (_, i) => ({ name: `E${i}`, url: `https://e${i}.com/%s` }))).length === MAX_CUSTOM_ENGINES)
        ok('engines: junk gives an empty list', sanitizeEngines(null).length === 0 && sanitizeEngines('x').length === 0)

        const combined = allEngines(good)
        ok('engines: allEngines appends custom after built-ins',
            combined.length === ENGINES.length + 2 && combined[combined.length - 1].id === 'custom-1')
        ok('engines: a custom engine builds and encodes the query',
            toUrl('a b', 'custom-0', combined) === 'https://www.google.com/search?q=a%20b')
        ok('engines: a built-in still works with the combined list',
            toUrl('pi', 'wikipedia', combined).startsWith('https://en.wikipedia.org/'))
        ok('engines: an unknown id falls back to the first engine',
            toUrl('x', 'nope', combined) === combined[0].q('x'))
        ok('engines: toUrl with no list still uses the built-ins', toUrl('pi', 'oeis').startsWith('https://oeis.org/'))

        ok('prefs: a custom engine can be selected and is kept',
            sanitizePrefs({ engine: 'custom-0', customEngines: good }).engine === 'custom-0')
        ok('prefs: choosing a custom engine that is not saved falls back',
            sanitizePrefs({ engine: 'custom-3', customEngines: good }).engine === DEFAULT_PREFS.engine)
        ok('prefs: customEngines default to empty', sanitizePrefs(null).customEngines.length === 0)
    }

    /* command palette ranking */
    {
        const items = [
            { key: 't', title: 'Pythagorean theorem', subtitle: 'en.wikipedia.org', keywords: ['en.wikipedia.org'], base: 100 },
            { key: 'n', title: 'New tab', keywords: ['open', 'create'], base: 60 },
            { key: 's', title: 'Settings', keywords: ['preferences', 'options'], base: 60 },
            { key: 'k', title: 'Khan Academy', subtitle: 'khanacademy.org', keywords: ['khanacademy.org'], base: 30 }
        ]
        ok('palette: empty query keeps everything in base order',
            rankPalette('', items).map(i => i.key).join('') === 'tnsk')
        ok('palette: a title-prefix match wins', rankPalette('new', items)[0].key === 'n')
        ok('palette: a keyword finds an action', rankPalette('options', items)[0].key === 's')
        ok('palette: a subsequence still matches ("nt" -> New tab)', rankPalette('nt', items).some(i => i.key === 'n'))
        ok('palette: a non-match drops out', rankPalette('zzzz', items).length === 0)
        ok('palette: a title prefix outscores a mere substring', (() => {
            const two = [{ key: 'a', title: 'Tab overflow', base: 1 }, { key: 'b', title: 'About tabs', base: 1 }]
            return rankPalette('tab', two)[0].key === 'a'
        })())
        ok('palette: base breaks ties so a tab beats a bookmark at equal match', (() => {
            const two = [
                { key: 'bm', title: 'Wikipedia', base: 30 },
                { key: 'tab', title: 'Wikipedia', base: 100 }
            ]
            return rankPalette('wiki', two)[0].key === 'tab'
        })())
        ok('palette: the limit is honoured', rankPalette('', items, 2).length === 2)
        ok('palette: junk inputs do not throw',
            rankPalette('x', null).length === 0 && scorePalette('x', null) === 0 && scorePalette(null, items[0]) === items[0].base)
    }

    /* saved tab sets (workspaces) */
    {
        const tab = (url) => ({ stack: [url], idx: 0, pinned: false })
        let list = saveSet([], 'Research', [tab('https://en.wikipedia.org/wiki/Pi'), tab('https://oeis.org/A1')], 100)
        list = saveSet(list, 'Reading', [tab('https://archive.org')], 200)
        ok('sets: a set is saved with its tabs', list.find(s => s.name === 'Research').tabs.length === 2)
        ok('sets: the newest is first', list[0].name === 'Reading')
        list = saveSet(list, 'research', [tab('https://a.com')], 300)
        ok('sets: the same name (case-insensitive) replaces, not duplicates',
            list.filter(s => s.name.toLowerCase() === 'research').length === 1 && list[0].name === 'research' && list[0].tabs.length === 1)
        ok('sets: removing one by name works', removeSet(list, 'Reading').every(s => s.name !== 'Reading'))
        ok('sets: an empty name or no tabs saves nothing',
            saveSet([], '', [tab('https://x.com')], 0).length === 0 && saveSet([], 'x', [], 0).length === 0)
        ok('sets: a hand-edited blob is cleaned up', (() => {
            const cleaned = sanitizeSavedSets([
                { name: 'Good', tabs: [tab('https://x.com')] },
                { name: '', tabs: [tab('https://y.com')] },      // no name
                { name: 'Empty', tabs: [] },                     // no tabs
                { name: 'Good', tabs: [tab('https://z.com')] },  // duplicate name
                null
            ])
            return cleaned.length === 1 && cleaned[0].name === 'Good'
        })())
        ok('sets: only http(s) tabs survive a set', (() => {
            const s = saveSet([], 'Mixed', [tab('https://ok.com'), { stack: ['javascript:1'], idx: 0 }], 0)
            return s[0].tabs.length === 1
        })())
        ok('sets: the count is capped', (() => {
            let big = []
            for (let i = 0; i < MAX_SAVED_SETS + 5; i++) big = saveSet(big, `set${i}`, [tab('https://x.com')], i + 1)
            return big.length === MAX_SAVED_SETS
        })())
        ok('sets: junk gives an empty list', sanitizeSavedSets(null).length === 0 && sanitizeSavedSets('x').length === 0)
    }

    /* per-site "always open in a popup" rules */
    {
        let list = toggleHost([], 'https://www.google.com/search?q=x', true)
        list = toggleHost(list, 'https://github.com', true)
        ok('rules: a host is added without its www', list.includes('google.com') && list.includes('github.com'))
        ok('rules: a www variant of a listed host still matches', hostListed(list, 'https://google.com/anything'))
        ok('rules: an unlisted host does not match', !hostListed(list, 'https://apple.com'))
        ok('rules: adding the same host twice does not duplicate',
            toggleHost(list, 'https://www.github.com', true).filter(h => h === 'github.com').length === 1)
        ok('rules: a host can be removed', !hostListed(toggleHost(list, 'https://github.com', false), 'https://github.com'))
        ok('rules: a hand-edited blob is validated', (() => {
            const c = sanitizeHostList(['not a host', 'GOOGLE.com', 'www.google.com', 'x.io', 5, null])
            return c.length === 2 && c.includes('google.com') && c.includes('x.io')
        })())
        ok('rules: the list is capped', (() => {
            const many = Array.from({ length: MAX_POPUP_HOSTS + 10 }, (_, i) => `h${i}.com`)
            return sanitizeHostList(many).length === MAX_POPUP_HOSTS
        })())
        ok('rules: junk gives an empty list and never throws',
            sanitizeHostList(null).length === 0 && hostListed(null, 'https://x.com') === false && toggleHost(null, 'nonsense', true).length === 0)
    }

    /* switch-to-open-tab matching, and the new-tab greeting */
    {
        ok('sameLocation: identical URLs match', sameLocation('https://a.com/x', 'https://a.com/x'))
        ok('sameLocation: a trailing slash is ignored', sameLocation('https://a.com', 'https://a.com/') && sameLocation('https://a.com/x/', 'https://a.com/x'))
        ok('sameLocation: the host is case-insensitive', sameLocation('https://A.com/x', 'https://a.com/x'))
        ok('sameLocation: a different path does not match', !sameLocation('https://a.com/x', 'https://a.com/y'))
        ok('sameLocation: the query and fragment count', !sameLocation('https://a.com/?a=1', 'https://a.com/?a=2') && !sameLocation('https://a.com/#a', 'https://a.com/#b'))
        ok('sameLocation: a case-sensitive path is respected', !sameLocation('https://a.com/X', 'https://a.com/x'))
        ok('sameLocation: junk never matches or throws', !sameLocation('nonsense', 'https://a.com') && !sameLocation(null, undefined))

        ok('greeting: morning / afternoon / evening / night by hour',
            greeting(8) === 'Good morning' && greeting(14) === 'Good afternoon' && greeting(19) === 'Good evening' && greeting(2) === 'Good night')
        ok('greeting: the boundaries land on the right side',
            greeting(5) === 'Good morning' && greeting(11) === 'Good morning' && greeting(12) === 'Good afternoon' && greeting(17) === 'Good evening' && greeting(22) === 'Good night')
        ok('greeting: a bad hour falls back to a plain hello', greeting(NaN) === 'Hello' && greeting('x') === 'Hello')

    /* address-bar calculator: the "is this a sum" guard */
    ok('calc: expressions with an operator are recognised',
        ['2+2*3', '100/7', '(1+2)^3', 'pi*2', '2 - 3'].every(looksLikeMath))
    ok('calc: functions are recognised', ['sqrt(144)', 'sin(30)', 'log(100)'].every(looksLikeMath))
    ok('calc: prose and plain words are not treated as maths',
        !looksLikeMath('pythagorean theorem') && !looksLikeMath('pi') && !looksLikeMath('hello world') && !looksLikeMath(''))
    ok('calc: a bare number is not a calculation', !looksLikeMath('42'))
    ok('calc: a URL is never a calculation',
        !looksLikeMath('https://a.com/2+2') && !looksLikeMath('example.com'))
    ok('calc: an over-long string is skipped', !looksLikeMath('1+'.repeat(200)))
    // the guard + evaluator together give a real, finite answer for a real sum
    ok('calc: guarded expressions actually evaluate', (() => {
        const t = '2+2*3'
        return looksLikeMath(t) && evaluateExpression(t) === 8
    })())
    ok('calc: a guarded-but-broken expression throws (so no row is shown)', (() => {
        const t = '3 apples + 2'   // passes the cheap guard, fails real evaluation
        let threw = false
        try { evaluateExpression(t) } catch { threw = true }
        return looksLikeMath(t) && threw
    })())

    /* address-bar percentages */
    {
        const near = (a, b) => Math.abs(a - b) < 1e-6
        ok('percent: "X% of Y"', near(parsePercent('15% of 200').value, 30))
        ok('percent: a leading "what is" and trailing "?" are tolerated', near(parsePercent('what is 15% of 200?').value, 30))
        ok('percent: the word "percent" works', near(parsePercent('15 percent of 200').value, 30))
        ok('percent: "X% off Y" discounts', near(parsePercent('20% off 50').value, 40))
        ok('percent: "Y + X%" adds, "Y - X%" subtracts',
            near(parsePercent('200 + 15%').value, 230) && near(parsePercent('200 - 15%').value, 170))
        ok('percent: the echo reads cleanly', parsePercent('15% of 200').expr === '15% of 200')
        ok('percent: a plain sum is not a percentage (falls to the calculator)', parsePercent('2+2') === null)
        ok('percent: modulo is left alone', parsePercent('200 % 7') === null)
        ok('percent: prose is ignored', parsePercent('50% chance of rain') === null && parsePercent('') === null)
    }

    /* address-bar unit conversion */
    {
        const near = (a, b) => Math.abs(a - b) < 1e-3
        ok('convert: length across systems', near(parseConversion('100 km in miles').result, 62.1371))
        ok('convert: no space between number and unit works', !!parseConversion('100km in mi'))
        ok('convert: temperature is affine, through Celsius',
            near(parseConversion('72 f in c').result, 22.2222) && near(parseConversion('0 c in k').result, 273.15))
        ok('convert: the degree sign and full names are accepted', !!parseConversion('72°f to celsius'))
        ok('convert: to/in/as all separate the two sides',
            !!parseConversion('10 m to ft') && !!parseConversion('10 m in ft') && !!parseConversion('10 m as ft'))
        ok('convert: "5 in in cm" resolves inch -> cm despite the keyword clash',
            near(parseConversion('5 in in cm').result, 12.7))
        ok('convert: mixing categories is refused', parseConversion('5 kg in miles') === null)
        ok('convert: the result echoes the target unit', parseConversion('1 mile in ft').text === '5280 ft')
        ok('convert: prose, sums, and bare text are not conversions',
            parseConversion('pythagorean theorem') === null && parseConversion('2+2') === null && parseConversion('') === null)
        ok('convert: an unknown unit is refused', parseConversion('5 foos in bars') === null)
    }

    /* address-bar number-base conversion */
    {
        ok('radix: decimal to hex is uppercased with a 0x prefix', parseRadix('255 in hex').result === '0xFF')
        ok('radix: hex to decimal reads the 0x source', parseRadix('0xff in decimal').result === '255')
        ok('radix: decimal to binary carries a 0b prefix', parseRadix('10 in binary').result === '0b1010')
        ok('radix: binary source to decimal', parseRadix('0b1010 to decimal').result === '10')
        ok('radix: octal both ways', parseRadix('64 as octal').result === '0o100' && parseRadix('0o100 in decimal').result === '64')
        ok('radix: to/in/as all separate the sides',
            !!parseRadix('10 to hex') && !!parseRadix('10 in hex') && !!parseRadix('10 as hex'))
        ok('radix: full spellings work', !!parseRadix('12 in hexadecimal') && !!parseRadix('12 in decimal'))
        ok('radix: the echo reads cleanly', parseRadix('255 in hex').expr === '255 in hex')
        ok('radix: a bare number or plain sum is not a base conversion',
            parseRadix('255') === null && parseRadix('2+2') === null && parseRadix('') === null)
        ok('radix: negatives and non-integers are refused',
            parseRadix('-5 in hex') === null && parseRadix('1.5 in binary') === null)
        ok('radix: digits outside the source base are refused', parseRadix('0b1012 in decimal') === null)
    }

    /* address-bar lab answers: number theory, bases, roman, colours, dates */
    {
        const NOW = new Date(2026, 7, 20) // 2026-08-20, so date tests are deterministic
        ok('answers: prime factorisation groups exponents', parseFactor('factor 360').result === '2^3 · 3^2 · 5')
        ok('answers: "prime factors of" phrasing works', parseFactor('prime factors of 84').result === '2^2 · 3 · 7')
        ok('answers: a prime reports prime', parsePrime('is 97 prime').result === '97 is prime')
        ok('answers: a composite shows a factor pair', parsePrime('is 91 prime').result === '91 is not prime (7 × 13)')
        ok('answers: gcd and lcm over 2+ numbers', parseGcdLcm('gcd 24 36').result === '12' && parseGcdLcm('lcm of 4 and 6').result === '12')
        ok('answers: divisors are listed and counted', parseDivisors('divisors of 28').result === '1, 2, 4, 7, 14, 28  (6)')
        ok('answers: decimal into an arbitrary base', parseBaseN('255 in base 7').result === '513')
        ok('answers: an arbitrary base back to decimal', parseBaseN('ff base 16 in decimal').result === '255')
        ok('answers: base digits must fit the base', parseBaseN('1012 base 2 in decimal') === null)
        ok('answers: decimal to roman', parseRoman('2024 in roman').result === 'MMXXIV')
        ok('answers: roman to decimal, round-trip validated', parseRoman('MCMLXXXIV in decimal').result === '1984')
        ok('answers: a malformed roman numeral is refused', parseRoman('IIII in decimal') === null)
        ok('answers: numbers spelled out', parseNumWords('1234567 in words').result === 'one million two hundred thirty-four thousand five hundred sixty-seven')
        ok('answers: zero spells out', parseNumWords('0 in words').result === 'zero')
        ok('answers: hex colour to rgb', parseColor('#ff8800 in rgb').result === 'rgb(255, 136, 0)')
        ok('answers: rgb colour to hsl', parseColor('rgb(255,136,0) in hsl').result === 'hsl(32, 100%, 50%)')
        ok('answers: 3-digit hex expands', parseColor('#f80 in hex').result === '#FF8800')
        ok('answers: an out-of-range rgb channel is refused', parseColor('rgb(300,0,0) in hex') === null)
        ok('answers: a character to its code point', parseCharCode('char code of A').result === '65 (U+0041)')
        ok('answers: a hex code point to its character', parseCharCode('U+2603').result.startsWith('☃'))
        ok('answers: a decimal code point to its character', parseCharCode('char 9731').result.startsWith('☃'))
        ok('answers: pi to N digits', parseConstant('pi to 12 digits').result === '3.141592653589')
        ok('answers: a bare named constant', parseConstant('golden ratio').result.startsWith('1.6180339887'))
        ok('answers: a physical constant', parseConstant('speed of light').result === '299792458 m/s')
        ok('answers: days until a date', parseDate('days until 2026-12-25', NOW).result === '127 days')
        ok('answers: an offset from today lands on the right weekday', parseDate('3 weeks from today', NOW).result === '2026-09-10 (Thursday)')
        ok('answers: an offset into the past', parseDate('2 months ago', NOW).result === '2026-06-20 (Saturday)')
        ok('answers: "time in <zone>" resolves', typeof parseDate('time in tokyo', NOW).result === 'string')
        ok('answers: calendar-invalid dates are refused, not rolled over',
            parseDate('days until 2026-13-45', NOW) === null && parseDate('days until 2026-02-30', NOW) === null)
        ok('answers: the dispatcher finds a hit and tags it copyable', computeAnswer('factor 12', NOW)?.kind === 'calc')
        ok('answers: prose is not an answer', computeAnswer('why is the sky blue', NOW) === null && computeAnswer('', NOW) === null)
        ok('answers: bare "pi" stays searchable', computeAnswer('pi', NOW) === null)
        ok('plot: "plot sin(x)" yields the expression', parsePlot('plot sin(x)').expr === 'sin(x)')
        ok('plot: "graph" is a synonym', parsePlot('graph x^2 - 3').expr === 'x^2 - 3')
        ok('plot: an expression without x is not a plot', parsePlot('plot 5') === null)
        ok('plot: prose after plot is refused', parsePlot('plot my day') === null)
    }

    /* bookmarks import / export (Netscape HTML) */
    {
        const bms = [{ url: 'https://en.wikipedia.org/wiki/Pi', label: 'Pi & "stuff" <math>' }, { url: 'https://oeis.org', label: 'OEIS' }]
        const html = exportBookmarksHTML(bms)
        ok('marks-io: export is a Netscape bookmark file', html.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>') && html.includes('<DL><p>'))
        ok('marks-io: special characters are HTML-escaped', html.includes('Pi &amp; &quot;stuff&quot; &lt;math&gt;'))
        const round = parseBookmarksHTML(html)
        ok('marks-io: a round trip preserves url and label', round.length === 2 && round[0].url === bms[0].url && round[0].label === bms[0].label)
        const chrome = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><H3>Bar</H3><DL><p>' +
            '<DT><A HREF="https://example.com/?a=1&amp;b=2" ADD_DATE="1700000000">Ex &amp; Co</A>' +
            '<DT><A HREF="ftp://skip.me">skip</A><DT><A HREF="https://x.test">X</A></DL><p></DL><p>'
        const parsed = parseBookmarksHTML(chrome)
        ok('marks-io: folders flatten and attributes are ignored', parsed.length === 2)
        ok('marks-io: query entities decode in the URL', parsed[0].url === 'https://example.com/?a=1&b=2')
        ok('marks-io: non-http links are dropped', !parsed.some(b => b.url.startsWith('ftp')))
        ok('marks-io: junk parses to an empty list', parseBookmarksHTML('not a bookmark file').length === 0)
        ok('marks-io: an out-of-range numeric entity is dropped, not thrown on',
            parseBookmarksHTML('<A HREF="https://a.test/x">bad &#x110000; &#99999999999;</A>').length === 1)
    }

    /* QR encoder — structure (correctness proven separately by a jsQR round-trip) */
    {
        const q = qrMatrix('https://oeis.org')
        ok('qr: returns a square module matrix', q && q.size === q.modules.length && q.modules.every(r => r.length === q.size))
        ok('qr: size follows the version formula (4v+17)', q && (q.size - 17) % 4 === 0)
        ok('qr: a short string picks version 1 (21×21)', qrMatrix('hi').size === 21)
        ok('qr: a longer URL grows the version', qrMatrix('https://example.com/a/really/long/path?with=params&and=more#section').size > 21)
        const finderDark = (m, r, c) => m[r][c] && m[r][c + 6] && m[r + 6][c] && !m[r + 1][c + 1]
        ok('qr: the three finder patterns are placed', finderDark(q.modules, 0, 0) && finderDark(q.modules, 0, q.size - 7) && finderDark(q.modules, q.size - 7, 0))
        ok('qr: empty input yields null', qrMatrix('') === null)
        ok('qr: text beyond version-10 capacity yields null', qrMatrix('x'.repeat(400)) === null)
        ok('qr: output is deterministic', JSON.stringify(qrMatrix('https://oeis.org')) === JSON.stringify(q))
        ok('qr: qrFits agrees with qrMatrix at the capacity edge',
            qrFits('https://oeis.org') === !!qrMatrix('https://oeis.org') && qrFits('x'.repeat(400)) === !!qrMatrix('x'.repeat(400)) && qrFits('') === false)
    }

    /* bookmark tags */
    {
        ok('tags: normalised to lowercase dashed slugs', sanitizeTags(['Read Later', 'MATH']).join() === 'read-later,math')
        ok('tags: duplicates and blanks are dropped', sanitizeTags(['a', 'a', '', '  ', 'b']).join() === 'a,b')
        ok('tags: capped in number', sanitizeTags(Array.from({ length: 20 }, (_, i) => `t${i}`)).length === MAX_BOOKMARK_TAGS)
        ok('tags: ride along on a bookmark, absent when empty', (() => {
            const [a, b] = sanitizeBookmarks([{ url: 'https://a.test', tags: ['x', 'x'] }, { url: 'https://b.test' }])
            return a.tags.join() === 'x' && !('tags' in b)
        })())
        ok('tags: a non-array tags field is ignored, not thrown on', !('tags' in sanitizeBookmarks([{ url: 'https://a.test', tags: 'nope' }])[0]))
    }

    /* tab groups: the pure render ordering */
    {
        const tabs = [
            { id: 1, pinned: true, groupId: null },
            { id: 2, pinned: false, groupId: 10 },
            { id: 3, pinned: false, groupId: null },
            { id: 4, pinned: false, groupId: 10 }
        ]
        const groups = [{ id: 10, name: 'Work', color: GROUP_COLORS[0], collapsed: false }]
        const order = groupedTabOrder(tabs, groups, 2)
        ok('groups: pinned tab leads, ungrouped comes last',
            order[0].type === 'tab' && order[0].tab.id === 1 && order[order.length - 1].tab.id === 3)
        ok('groups: a header precedes its members', order[1].type === 'header' && order[1].group.id === 10 && order[1].count === 2)
        ok('groups: both members render under the header', order[2].tab.id === 2 && order[3].tab.id === 4)
        const collapsed = groupedTabOrder(tabs, [{ ...groups[0], collapsed: true }], 2)
        ok('groups: a collapsed group shows only the active member',
            collapsed.filter(i => i.type === 'tab').map(i => i.tab.id).join() === '1,2,3')
        ok('groups: an empty groups list is just the tabs in order',
            groupedTabOrder(tabs, []).filter(i => i.type === 'tab').length === 4 && groupedTabOrder(tabs, []).every(i => i.type === 'tab'))
        ok('groups: a tab pointing at a missing group falls back to ungrouped',
            groupedTabOrder([{ id: 9, pinned: false, groupId: 999 }], []).length === 1)
    }

    /* history retention */
    {
        const NOW = 1_000 * 86400000 // day 1000, in ms
        const hist = [
            { url: 'https://a.test', visits: 1, last: NOW - 3 * 86400000 },   // 3 days old
            { url: 'https://b.test', visits: 1, last: NOW - 40 * 86400000 },  // 40 days old
            { url: 'https://c.test', visits: 1, last: NOW - 400 * 86400000 }  // 400 days old
        ]
        ok('retention: 0 days keeps everything', pruneHistory(hist, 0, NOW).length === 3)
        ok('retention: 7 days keeps only the recent visit', pruneHistory(hist, 7, NOW).map(h => h.url).join() === 'https://a.test')
        ok('retention: 90 days keeps the two newer visits', pruneHistory(hist, 90, NOW).length === 2)
        ok('retention: an entry with no timestamp is dropped when pruning', pruneHistory([{ url: 'https://x.test' }], 7, NOW).length === 0)
        ok('retention: the offered options include forever and a year', HISTORY_DAY_OPTS.includes(0) && HISTORY_DAY_OPTS.includes(365))
        ok('retention: sanitizePrefs only accepts an offered value',
            sanitizePrefs({ historyDays: 30 }).historyDays === 30 && sanitizePrefs({ historyDays: 12345 }).historyDays === 0)
    }

        ok('prefs: the clock defaults on and can be turned off',
            sanitizePrefs(null).showNtpClock === true && sanitizePrefs({ showNtpClock: false }).showNtpClock === false)
        ok('prefs: the scratchpad defaults on and can be turned off',
            sanitizePrefs(null).showNtpScratch === true && sanitizePrefs({ showNtpScratch: false }).showNtpScratch === false)
        ok('prefs: sleeping inactive tabs defaults on and can be turned off',
            sanitizePrefs(null).sleepTabs === true && sanitizePrefs({ sleepTabs: false }).sleepTabs === false)
    }

    /* full backup & restore */
    {
        const source = {
            prefs: { accent: '#12a150', density: 'compact' },
            bookmarks: [{ url: 'https://a.com', label: 'A' }],
            savedSets: [{ name: 'Work', tabs: [{ stack: ['https://x.com'], idx: 0 }] }],
            popupHosts: ['google.com'],
            zooms: { 'a.com': 1.25 }
        }
        const packed = packBackup(source)
        ok('backup: it is tagged as a viewer backup', packed.app === 'mathlab-web-viewer' && packed.version >= 1)
        const round = parseBackup(JSON.stringify(packed))
        ok('backup: a round trip keeps every section',
            round.prefs.accent === '#12a150' && round.bookmarks.length === 1
            && round.savedSets.length === 1 && round.popupHosts[0] === 'google.com' && round.zooms['a.com'] === 1.25)
        ok('backup: parse accepts the object form too', parseBackup(packed).prefs.density === 'compact')
        ok('backup: a foreign or broken blob is rejected',
            parseBackup('{"app":"something-else"}') === null && parseBackup('not json') === null
            && parseBackup('[]') === null && parseBackup(null) === null)
        ok('backup: a partial backup restores only what it holds', (() => {
            const p = parseBackup(JSON.stringify({ app: 'mathlab-web-viewer', bookmarks: [{ url: 'https://b.com', label: 'B' }] }))
            return Object.keys(p).join(',') === 'bookmarks' && p.bookmarks.length === 1
        })())
        ok('backup: a hand-edited backup is still sanitised on the way in',
            parseBackup(JSON.stringify({ app: 'mathlab-web-viewer', popupHosts: ['ok.com', 'not a host', 5] })).popupHosts.join(',') === 'ok.com')
        ok('backup: history and open tabs are never included', !('history' in packed) && !('tabs' in packed) && !('session' in packed))
    }
    ok('prefs: an unknown answer falls back to the default',
        sanitizePrefs({ onBlocked: 'proxy' }).onBlocked === 'archive'
        && sanitizePrefs({ onBlocked: 7 }).onBlocked === 'archive')
    /*
     * This was a boolean before it was a choice, so a settings blob written by the
     * older build has to land somewhere sensible rather than silently reverting the
     * reader's decision to the new default.
     */
    ok('prefs: the old boolean migrates to the matching choice',
        sanitizePrefs({ handOffBlocked: true }).onBlocked === 'tab'
        && sanitizePrefs({ handOffBlocked: false }).onBlocked === 'explain')
    ok('prefs: an explicit new choice beats a stale boolean',
        sanitizePrefs({ handOffBlocked: true, onBlocked: 'archive' }).onBlocked === 'archive')

    ok('prefs: article suggestions are off unless asked for',
        sanitizePrefs(null).webSuggest === false
        && sanitizePrefs({ webSuggest: true }).webSuggest === true
        && sanitizePrefs({ webSuggest: 'yes' }).webSuggest === false)
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

    /* ---- workspace versioning: a widened key list must not delete data ---- */
    globalThis.localStorage.clear()
    ok('workspace: the key list covers the web viewer and site prefs',
        ['mathlab-frame-bookmarks', 'mathlab-frame-session', 'mathlab-frame-history', 'mathlab-theme']
            .every(k => A.WORKSPACE_KEYS.includes(k)))
    ok('workspace: device-only keys are excluded',
        !A.WORKSPACE_KEYS.includes('mathlab-frame-size') && !A.WORKSPACE_KEYS.includes('mathlab-frame-pruned'))
    ok('workspace: a snapshot is stamped with its version', A.snapshotWorkspace().__v === A.WORKSPACE_VERSION)

    // A blob saved before the list grew has no bookmarks key. Restoring it must
    // leave the device's bookmarks alone rather than treating absent as "delete".
    globalThis.localStorage.setItem('mathlab-frame-bookmarks', '[{"url":"https://keep.me"}]')
    A.restoreWorkspace({ 'mathlab-profile': '{"name":"Old"}' })   // no __v -> v1
    ok('workspace: a v1 blob does not wipe keys it never knew about',
        globalThis.localStorage.getItem('mathlab-frame-bookmarks') === '[{"url":"https://keep.me"}]')
    ok('workspace: a v1 blob still restores its own keys',
        globalThis.localStorage.getItem('mathlab-profile') === '{"name":"Old"}')

    // A current blob that genuinely has no bookmarks must clear them, or one
    // profile's bookmarks would follow the next person into their session.
    A.restoreWorkspace({ __v: A.WORKSPACE_VERSION, 'mathlab-profile': '{"name":"New"}' })
    ok('workspace: a current blob does clear a key it omits',
        globalThis.localStorage.getItem('mathlab-frame-bookmarks') === null)

    /* ---- moving a profile to another device ---- */
    globalThis.localStorage.clear()
    await A.createAccount('Trip', 'a travelling password', {
        __v: A.WORKSPACE_VERSION,
        'mathlab-frame-bookmarks': '[{"url":"https://example.com","label":"Ex"}]',
        'mathlab-exercise-progress': '{"g3-add":{"attempts":3}}'
    })
    const bundle = A.exportProfile('Trip')
    ok('export: the bundle is tagged and versioned', (() => {
        const p = JSON.parse(bundle)
        return p.format === A.EXPORT_FORMAT && p.version === A.EXPORT_VERSION && p.display === 'Trip'
    })())
    ok('export: the bundle carries no plaintext and no password', (() => {
        const p = JSON.parse(bundle)
        return !bundle.includes('a travelling password') && !bundle.includes('example.com')
            && !!p.salt && !!p.iv && !!p.ct
    })())
    ok('export: an unknown profile cannot be exported', (() => {
        try { A.exportProfile('nobody'); return false } catch { return true }
    })())
    ok('export: the filename is safe and named after the profile',
        A.exportFilename('Trip One!') === 'mathlab-profile-trip-one.json')

    // simulate the other device: a fresh store that has never seen this profile
    globalThis.localStorage.clear()
    let wrongPw = false
    try { await A.importProfile(bundle, 'not the password') } catch { wrongPw = true }
    ok('import: the wrong password is refused', wrongPw)
    let junk = false
    try { await A.importProfile('{"hello":1}', 'x') } catch (e) { junk = /MathLab profile/.test(e.message) }
    ok('import: a file that is not a profile is refused', junk)

    const landed = await A.importProfile(bundle, 'a travelling password')
    ok('import: the profile opens on the new device',
        landed.display === 'Trip'
        && JSON.parse(landed.data['mathlab-frame-bookmarks'])[0].url === 'https://example.com')
    ok('import: bookmarks and progress both travel',
        !!landed.data['mathlab-exercise-progress'] && !!landed.data['mathlab-frame-bookmarks'])
    ok('import: it is now a local account', A.accountExists('Trip'))
    ok('import: signing in on the new device works', (() => true)())
    const reopenedTrip = await A.openAccount('Trip', 'a travelling password')
    ok('import: the imported profile opens with its password',
        JSON.parse(reopenedTrip.data['mathlab-exercise-progress'])['g3-add'].attempts === 3)

    let clash = false
    try { await A.importProfile(bundle, 'a travelling password') } catch (e) { clash = /already exists/.test(e.message) }
    ok('import: it will not silently overwrite a profile of the same name', clash)
    const renamed = await A.importProfile(bundle, 'a travelling password', { rename: 'Trip Two' })
    ok('import: it can land beside the existing one under a new name',
        renamed.display === 'Trip Two' && A.accountExists('Trip') && A.accountExists('Trip Two'))

    /* ---- the profile snapshot really does save everything ---- */
    ok('workspace: the version advanced to 4', A.WORKSPACE_VERSION === 4)
    ok('workspace: the later web-viewer keys are now saved',
        ['mathlab-frame-saved', 'mathlab-frame-zoom', 'mathlab-frame-popup-hosts', 'mathlab-frame-note'].every(k => A.WORKSPACE_KEYS.includes(k)))
    ok('workspace: window geometry stays device-local',
        !A.WORKSPACE_KEYS.includes('mathlab-frame-size') && !A.WORKSPACE_KEYS.includes('mathlab-frame-pos'))
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem('mathlab-frame-saved', '[{"name":"Set"}]')
    globalThis.localStorage.setItem('mathlab-frame-zoom', '{"a.com":1.25}')
    globalThis.localStorage.setItem('mathlab-frame-popup-hosts', '["google.com"]')
    const fullSnap = A.snapshotWorkspace()
    ok('workspace: a snapshot now carries tab sets, zoom and site rules',
        fullSnap['mathlab-frame-saved'] === '[{"name":"Set"}]'
        && fullSnap['mathlab-frame-zoom'] === '{"a.com":1.25}'
        && fullSnap['mathlab-frame-popup-hosts'] === '["google.com"]')

    // an older (v2) blob must not wipe the new keys it never knew about
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem('mathlab-frame-zoom', '{"kept.com":1.5}')
    A.restoreWorkspace({ __v: 2, 'mathlab-profile': '{"name":"V2"}' })
    ok('workspace: a v2 profile leaves the newer keys untouched',
        globalThis.localStorage.getItem('mathlab-frame-zoom') === '{"kept.com":1.5}')

    /* ---- signing in on a new device straight from the server ---- */
    // Device A makes an account; its stored record is exactly the encrypted blob
    // the sync server would hold and hand back.
    globalThis.localStorage.clear()
    await A.createAccount('Rider', 'cross device pass', {
        __v: A.WORKSPACE_VERSION,
        'mathlab-exercise-progress': '{"alg1-x":{"attempts":7}}',
        'mathlab-frame-saved': '[{"name":"Homework"}]'
    })
    const serverBlob = A.getAccountRecord('Rider')  // salt/iterations/iv/ct — what pullProfile returns

    // Device B: a fresh machine that has never seen this account.
    globalThis.localStorage.clear()
    let badPw = false
    try { await A.installProfileFromBlob('Rider', 'wrong pass', serverBlob) } catch { badPw = true }
    ok('server sign-in: a wrong password is refused', badPw && !A.accountExists('Rider'))
    let badBlob = false
    try { await A.installProfileFromBlob('Rider', 'cross device pass', { salt: 'x' }) } catch { badBlob = true }
    ok('server sign-in: an incomplete blob is refused', badBlob)

    const arrived = await A.installProfileFromBlob('Rider', 'cross device pass', serverBlob)
    ok('server sign-in: the profile installs and opens on the new device',
        arrived.display === 'Rider' && A.accountExists('Rider'))
    ok('server sign-in: all the work came down',
        JSON.parse(arrived.data['mathlab-exercise-progress'])['alg1-x'].attempts === 7
        && JSON.parse(arrived.data['mathlab-frame-saved'])[0].name === 'Homework')
    const reopenRider = await A.openAccount('Rider', 'cross device pass')
    ok('server sign-in: the installed account reopens with its password',
        JSON.parse(reopenRider.data['mathlab-exercise-progress'])['alg1-x'].attempts === 7)

    /* ---- auto-sync-on-sign-in policy (the "just sign in" behaviour) ---- */
    ok('sync: nothing on the server yet means push (first upload)',
        syncDecision({ hasRemote: false }) === 'push')
    ok('sync: server ahead and this device unchanged means pull',
        syncDecision({ hasRemote: true, serverVersion: 3, seenVersion: 2, localChanged: false }) === 'pull')
    ok('sync: server ahead AND local changed is a conflict (never clobber)',
        syncDecision({ hasRemote: true, serverVersion: 3, seenVersion: 2, localChanged: true }) === 'conflict')
    ok('sync: local changed and server not ahead means push',
        syncDecision({ hasRemote: true, serverVersion: 2, seenVersion: 2, localChanged: true }) === 'push')
    ok('sync: nothing changed on either side is a no-op',
        syncDecision({ hasRemote: true, serverVersion: 2, seenVersion: 2, localChanged: false }) === 'inSync')
    // the content fingerprint: order-independent, and it moves only on real edits
    const hA = await hashContent({ b: '2', a: '1' })
    const hB = await hashContent({ a: '1', b: '2' })
    ok('sync: the content hash ignores key order', hA === hB)
    ok('sync: the content hash changes when content does',
        (await hashContent({ a: '1' })) !== (await hashContent({ a: '2' })))
    ok('sync: junk hashes without throwing', typeof (await hashContent(null)) === 'string')

    /* the "could not reach" message actually diagnoses the cause */
    ok('reach: with no page context it points at running the server',
        /npm run sync/.test(reachError('http://localhost:8787')))
    try {
        globalThis.location = { protocol: 'https:' }
        ok('reach: https page + http LAN server explains the mixed-content block',
            /https/.test(reachError('http://192.168.1.10:8787')) && /block/i.test(reachError('http://192.168.1.10:8787')))
        ok('reach: https page + http localhost is not blamed on mixed content',
            !/block/i.test(reachError('http://localhost:8787')))
    } finally { delete globalThis.location }

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

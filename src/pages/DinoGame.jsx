import { useEffect, useRef, useState } from 'react'

/**
 * A faithful take on Chrome's offline T-Rex runner. Sprites are authentic
 * pixel-art bitmaps (see the string maps below) baked into small offscreen
 * canvases and blitted with nearest-neighbour scaling, so they stay crisp.
 * Classic palette: dark-gray (#535353) sprites on a white field. Pure canvas +
 * rAF, no assets or network, so it plays offline. High score persists.
 *
 * Rendered as a popup overlay (triggered by the secret 🦕 in the footer) so it
 * never navigates away from the current page. `onClose` dismisses the modal.
 * Controls: Space / ↑ to jump, ↓ to duck, tap to jump, Esc to close.
 */

const W = 680
const H = 200
const GROUND_Y = 150         // running surface
const GRAVITY = 0.75
const JUMP_V = -11.5
const HS_KEY = 'mathlab-dino-highscore'

const FG = '#535353'         // classic Chrome dino gray
const BG = '#ffffff'         // white field
const CLOUD_C = '#c9c9c9'    // clouds sit a shade lighter

const readHigh = () => { try { return Number(localStorage.getItem(HS_KEY)) || 0 } catch { return 0 } }

// --- pixel bitmaps: '#' = filled pixel, ' ' = transparent --------------------
// T-Rex: chunky head with a square white eye and a square open mouth, a solid
// body, a stepped tail and a little arm — matching Chrome's sprite. Only the
// legs swap between frames.
const REX_BODY = [
    '                   ################ ',
    '                   ################ ',
    '                   ################ ',
    '                   ################ ',
    '                   ###  ########### ',
    '                   ###  ########### ',
    '                   ################ ',
    '                   ################ ',
    '                   ###########  ### ',
    '                   ###########  ### ',
    '                   ################ ',
    '                   #####       #### ',
    '  ##               #####            ',
    '  ###             ######            ',
    '  ####           #######            ',
    '  #####         ########            ',
    '  ######       #########            ',
    '  #######     ##########            ',
    '  ########   ###########            ',
    '  ###############################   ',
    '  ##############################    ',
    '  #############################     ',
    '   ##################   #####       ',
    '    #################   #####       ',
    '     ###############                ',
    '      #############                 ',
    '       ###########                  ',
    '        ##########                  ',
    '        #####  ###                  ',
    '        #####  ###                  '
]
const REX_STAND = REX_BODY.concat(['        ####  ###                  ', '        ##    ###                  ', '        ##    ###                  ', '        ##    ###                  ', '       ###    ###                  ', '      ####    ####                 '])
const REX_RUN1 = REX_BODY.concat(['        ####  ###                  ', '        ##    ###                  ', '        ##    ##                   ', '       ###    ##                   ', '      ####    #                    ', '     ###                           '])
const REX_RUN2 = REX_BODY.concat(['        ####  ###                  ', '        ##    ###                  ', '         ##   ###                  ', '         ##   ###                  ', '         #    ####                 ', '             ####                  '])

// ducking T-Rex: long and low, same chunky head (eye + open mouth)
const DUCK = [
    '                         ##############  ',
    '                         ##############  ',
    '                         ###  ########## ',
    '                         ##############  ',
    '                         #########  #### ',
    '  #######                ##############  ',
    '  #############          ######          ',
    '  ##############################         ',
    '  ###############################        ',
    '  ##############################         ',
    '   ############################          ',
    '    ######  #########  ########          '
]
const REX_DUCK1 = DUCK.concat(['    ##      ####   ##                   ', '   ###       ##   ###                   '])
const REX_DUCK2 = DUCK.concat(['     ##     ##     ##                   ', '    ###    ###    ###                   '])

// saguaro cacti — vertical trunk with arms
const CACTUS_S = ['   ##   ', '   ##   ', '   ##   ', '#  ##   ', '#  ## # ', '#  ## # ', '##### # ', '   #### ', '   ##   ', '   ##   ', '   ##   ', '   ##   ', '   ##   ', '   ##   ']
const CACTUS_L = ['     ##    ', '     ##    ', '     ##    ', '     ##    ', '#    ##    ', '#    ## #  ', '#    ## #  ', '#    ## #  ', '####### #  ', '     ##### ', '     ##    ', '     ##    ', '     ##    ', '     ##    ', '     ##    ', '     ##    ', '     ##    ', '     ##    ']
const CACTUS_XL = [
    '   ##    ##    ',
    '   ##    ##    ',
    '   ##    ##    ',
    '#  ##    ##    ',
    '#  ## #  ## #  ',
    '#  ## #  ## #  ',
    '##### #  #### #',
    '   #### # ## ##',
    '   ##  ###  ###',
    '   ##    ##    ',
    '   ##    ##    ',
    '   ##    ##    ',
    '   ##    ##    ',
    '   ##    ##    ',
    '   ##    ##    ',
    '   ##    ##    '
]
// pterodactyl — two wing positions
const BIRD_UP = ['##             ', ' ###        ## ', '   ####    ####', '      ########', '       ##      ', '       #       ']
const BIRD_DN = ['       #       ', '       ##      ', '      ########', '   ####    ####', ' ###        ## ', '##             ']
// hollow outline cloud (thin border, white interior) — like Chrome's
const CLOUD = [
    '        ######       ',
    '      ##      ###     ',
    '   ###          ##    ',
    '  #              #    ',
    '  #              #    ',
    '   ##############     '
]

// gameplay boxes (canvas px) — bitmaps are nearest-neighbour scaled to fit these
const REX = { w: 48, h: 48, duckW: 59, duckH: 28 }
const CACTI = [
    { img: 'cactusS', w: 17, h: 30 },
    { img: 'cactusL', w: 25, h: 46 },
    { img: 'cactusXL', w: 40, h: 46 }
]
const BIRD_W = 42, BIRD_H = 18

const DinoGame = ({ onClose }) => {
    const canvasRef = useRef(null)
    const [high, setHigh] = useState(readHigh)
    const highRef = useRef(readHigh())
    const game = useRef(null)

    const fresh = () => ({
        y: GROUND_Y - REX.h, vy: 0, onGround: true, duck: false,
        obstacles: [], clouds: [{ x: 480, y: 40 }, { x: 650, y: 70 }],
        speed: 6, spawnIn: 50, score: 0, tick: 0,
        started: false, over: false
    })

    useEffect(() => {
        game.current = fresh()
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = false

        // bake a bitmap into a 1px-per-cell offscreen canvas (transparent bg)
        const bake = (rows, color) => {
            const w = Math.max(...rows.map(r => r.length))
            const h = rows.length
            const c = document.createElement('canvas')
            c.width = w; c.height = h
            const cx = c.getContext('2d')
            cx.fillStyle = color
            for (let y = 0; y < h; y++) {
                const row = rows[y]
                for (let x = 0; x < row.length; x++) if (row[x] === '#') cx.fillRect(x, y, 1, 1)
            }
            return c
        }
        const SPR = {
            stand: bake(REX_STAND, FG), run1: bake(REX_RUN1, FG), run2: bake(REX_RUN2, FG),
            duck1: bake(REX_DUCK1, FG), duck2: bake(REX_DUCK2, FG),
            cactusS: bake(CACTUS_S, FG), cactusL: bake(CACTUS_L, FG), cactusXL: bake(CACTUS_XL, FG),
            birdUp: bake(BIRD_UP, FG), birdDn: bake(BIRD_DN, FG),
            cloud: bake(CLOUD, CLOUD_C)
        }

        const spawn = (g) => {
            if (g.score > 320 && Math.random() < 0.28) {
                const y = [GROUND_Y - 30, GROUND_Y - 58, GROUND_Y - 84][Math.floor(Math.random() * 3)]
                g.obstacles.push({ kind: 'bird', x: W + 10, y, w: BIRD_W, h: BIRD_H, wing: 0 })
            } else {
                const c = Math.random() < 0.4 ? CACTI[0] : (Math.random() < 0.5 ? CACTI[1] : CACTI[2])
                g.obstacles.push({ kind: 'cactus', img: c.img, x: W + 10, y: GROUND_Y - c.h, w: c.w, h: c.h })
            }
            g.spawnIn = Math.max(30, Math.round(Math.random() * 50 + 60 - g.speed * 2))
        }

        const dinoBox = (g) => g.duck && g.onGround
            ? { x: 44, y: g.y + (REX.h - REX.duckH), w: REX.duckW, h: REX.duckH }
            : { x: 44, y: g.y, w: REX.w, h: REX.h }

        const hit = (g) => {
            const d = dinoBox(g); const p = 8
            return g.obstacles.some(o =>
                d.x + p < o.x + o.w - 4 && d.x + d.w - p > o.x + 4 &&
                d.y + p < o.y + o.h - 3 && d.y + d.h - p > o.y + 3)
        }

        let raf
        const loop = () => {
            const g = game.current
            g.tick++

            if (g.started && !g.over) {
                // dino physics (holding down = fall faster / duck)
                g.vy += GRAVITY * (g.duck && !g.onGround ? 2.4 : 1)
                g.y += g.vy
                const floor = GROUND_Y - REX.h
                if (g.y >= floor) { g.y = floor; g.vy = 0; g.onGround = true }
                // world
                g.score += 0.5
                g.speed = 6 + g.score / 250
                for (const o of g.obstacles) { o.x -= g.speed; if (o.kind === 'bird') o.wing = Math.floor(g.tick / 8) % 2 }
                g.obstacles = g.obstacles.filter(o => o.x + o.w > -20)
                if (--g.spawnIn <= 0) spawn(g)
                for (const c of g.clouds) { c.x -= 0.6; if (c.x < -50) { c.x = W + Math.random() * 200; c.y = 20 + Math.random() * 60 } }
                if (hit(g)) {
                    g.over = true
                    const sc = Math.floor(g.score)
                    if (sc > highRef.current) { highRef.current = sc; try { localStorage.setItem(HS_KEY, String(sc)) } catch { /* ignore */ } setHigh(sc) }
                }
            }

            // ---- draw (classic dino: gray sprites on a white field) ----
            ctx.imageSmoothingEnabled = false
            ctx.fillStyle = BG
            ctx.fillRect(0, 0, W, H)

            // clouds
            for (const c of g.clouds) ctx.drawImage(SPR.cloud, Math.round(c.x), Math.round(c.y), 48, 14)

            // ground: solid line + scrolling speckles
            ctx.fillStyle = FG
            ctx.fillRect(0, GROUND_Y + 1, W, 2)
            const off = Math.floor(g.tick * (g.started && !g.over ? g.speed : 0)) % 24
            for (let x = -off; x < W; x += 24) { ctx.fillRect(x + 4, GROUND_Y + 6, 3, 2); ctx.fillRect(x + 14, GROUND_Y + 9, 2, 2) }

            // obstacles
            for (const o of g.obstacles) {
                if (o.kind === 'cactus') ctx.drawImage(SPR[o.img], Math.round(o.x), o.y, o.w, o.h)
                else ctx.drawImage(o.wing ? SPR.birdDn : SPR.birdUp, Math.round(o.x), o.y, o.w, o.h)
            }

            // dino
            const running = g.started && !g.over && g.onGround
            const legPhase = Math.floor(g.tick / 6) % 2
            if (g.duck && g.onGround) {
                const dy = g.y + (REX.h - REX.duckH)
                const img = running ? (legPhase ? SPR.duck1 : SPR.duck2) : SPR.duck1
                ctx.drawImage(img, 44, Math.round(dy), REX.duckW, REX.duckH)
            } else {
                const img = (!g.started || g.over) ? SPR.stand : (running ? (legPhase ? SPR.run1 : SPR.run2) : SPR.stand)
                ctx.drawImage(img, 44, Math.round(g.y), REX.w, REX.h)
            }

            // score (top-right, zero-padded)
            ctx.fillStyle = FG
            ctx.font = '700 15px "Courier New", monospace'
            ctx.textBaseline = 'top'
            ctx.textAlign = 'right'
            const hi = highRef.current > 0 ? `HI ${String(highRef.current).padStart(5, '0')}  ` : ''
            ctx.fillText(hi + String(Math.floor(g.score)).padStart(5, '0'), W - 14, 14)
            ctx.textAlign = 'center'

            if (!g.started) {
                ctx.fillStyle = FG
                ctx.font = '700 14px system-ui, sans-serif'
                ctx.fillText('Press Space / ↑ or tap to start', W / 2, 26)
            }
            if (g.over) {
                ctx.fillStyle = FG
                ctx.font = '700 22px "Courier New", monospace'
                ctx.fillText('G A M E   O V E R', W / 2, 58)
                // restart icon (circle + arrow head)
                const cx = W / 2, cy = 100, r = 15
                ctx.strokeStyle = FG; ctx.lineWidth = 3
                ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.35, Math.PI * 1.9); ctx.stroke()
                ctx.beginPath(); ctx.moveTo(cx + r - 2, cy - 8); ctx.lineTo(cx + r + 5, cy - 5); ctx.lineTo(cx + r - 1, cy + 1); ctx.closePath(); ctx.fill()
            }
            ctx.textAlign = 'left'

            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)

        const restart = () => { game.current = fresh(); game.current.started = true }
        const jump = () => {
            const g = game.current
            if (g.over) { restart(); return }
            if (!g.started) { g.started = true }
            if (g.onGround) { g.vy = JUMP_V; g.onGround = false }
        }
        const onKeyDown = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return // leave ⌘↑, ⌥↓ etc. to the browser
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') { e.preventDefault(); jump() }
            else if (e.code === 'ArrowDown') { e.preventDefault(); game.current.duck = true }
        }
        const onKeyUp = (e) => { if (e.code === 'ArrowDown') game.current.duck = false }
        const onPointer = (e) => { e.preventDefault(); jump() }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        canvas.addEventListener('pointerdown', onPointer)

        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            canvas.removeEventListener('pointerdown', onPointer)
        }
    }, [])

    // Esc closes the popup (kept separate from the game's own key handling so
    // the game effect can stay mount-once).
    useEffect(() => {
        const onEsc = (e) => { if (e.key === 'Escape') onClose?.() }
        window.addEventListener('keydown', onEsc)
        return () => window.removeEventListener('keydown', onEsc)
    }, [onClose])

    return (
        <div
            className="dino-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Dino Run — secret game"
            onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
        >
            <div className="dino-modal">
                <div className="dino-modal-head">
                    <div className="page-head">
                        <h1>🦖 Dino Run</h1>
                        <p>MathLab&apos;s secret offline game — just like Chrome&apos;s. <kbd>Space</kbd>/<kbd>↑</kbd> to jump, <kbd>↓</kbd> to duck, or tap.</p>
                    </div>
                    <button className="dino-close" onClick={() => onClose?.()} aria-label="Close game" title="Close (Esc)">×</button>
                </div>

                <div className="dino-wrap">
                    <canvas ref={canvasRef} width={W} height={H} className="dino-canvas" aria-label="Dino running game" />
                </div>

                <div className="dino-actions">
                    <button className="btn ghost" onClick={() => onClose?.()}>← Back to MathLab</button>
                    <span className="hint">Best: {high}</span>
                </div>
            </div>
        </div>
    )
}

export default DinoGame

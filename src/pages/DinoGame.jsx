import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * A faithful take on Chrome's offline T-Rex runner — pixel-art sprites drawn as
 * rectangles, a dotted scrolling ground, drifting clouds, pterodactyls you duck
 * under, and a day/night cycle. Pure canvas + rAF, no assets or network, so it
 * plays offline. High score persists in localStorage.
 *
 * Reached via the secret 🦕 in the footer, or #/xyzzy directly.
 * Controls: Space / ↑ to jump, ↓ to duck, tap to jump.
 */

const W = 680
const H = 200
const GROUND_Y = 150         // running surface
const GRAVITY = 0.75
const JUMP_V = -11.5
const HS_KEY = 'mathlab-dino-highscore'

const readHigh = () => { try { return Number(localStorage.getItem(HS_KEY)) || 0 } catch { return 0 } }

// --- pixel sprites: arrays of [x, y, w, h] rects in local coordinates -------
const REX = {
    // standing body (no legs)
    body: [
        [0, 16, 10, 6],   // tail
        [6, 12, 22, 22],  // back + body
        [10, 30, 18, 6],  // belly
        [22, 4, 12, 16],  // neck
        [28, 0, 18, 14],  // head
        [44, 7, 6, 5],    // snout
        [24, 24, 8, 3]    // arm
    ],
    eye: [[40, 3, 3, 3]],           // drawn in bg colour
    legsA: [[12, 36, 6, 12], [24, 36, 6, 8]],
    legsB: [[12, 36, 6, 8], [24, 36, 6, 12]],
    stand: [[12, 36, 6, 13], [24, 36, 6, 13]],
    w: 50, h: 49,
    // ducking (long + low)
    duck: [
        [0, 8, 14, 7],    // tail
        [10, 6, 30, 15],  // long body
        [38, 8, 18, 11],  // head
        [54, 11, 6, 5]    // snout
    ],
    duckEye: [[50, 11, 3, 3]],
    duckLegsA: [[16, 21, 6, 9], [30, 21, 6, 7]],
    duckLegsB: [[16, 21, 6, 7], [30, 21, 6, 9]],
    duckW: 60, duckH: 30
}
const CACTUS_S = { rects: [[6, 0, 6, 30], [0, 8, 6, 10], [12, 6, 6, 11]], w: 18, h: 30 }
const CACTUS_L = { rects: [[8, 0, 8, 44], [0, 14, 8, 15], [16, 9, 8, 17]], w: 24, h: 44 }
const CACTUS_XL = { rects: [[6, 0, 6, 34], [0, 10, 6, 12], [12, 8, 6, 13], [22, 4, 6, 30], [16, 14, 6, 10], [28, 12, 6, 11]], w: 34, h: 34 }
const BIRD_UP = { rects: [[0, 12, 12, 4], [12, 9, 18, 7], [30, 7, 9, 7], [39, 9, 5, 3], [14, 0, 12, 9]], w: 44, h: 22 }
const BIRD_DN = { rects: [[0, 8, 12, 4], [12, 9, 18, 7], [30, 7, 9, 7], [39, 9, 5, 3], [14, 14, 12, 9]], w: 44, h: 23 }
const CLOUD = [[8, 4, 30, 6], [0, 8, 46, 4], [14, 0, 20, 5]]

const DinoGame = () => {
    const canvasRef = useRef(null)
    const navigate = useNavigate()
    const [high, setHigh] = useState(readHigh)
    const highRef = useRef(readHigh())
    const game = useRef(null)

    const fresh = () => ({
        y: GROUND_Y - REX.h, vy: 0, onGround: true, duck: false,
        obstacles: [], clouds: [{ x: 480, y: 40 }, { x: 650, y: 70 }],
        speed: 6, spawnIn: 50, score: 0, tick: 0, night: 0, flash: 0,
        started: false, over: false
    })

    useEffect(() => {
        game.current = fresh()
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        const rects = (list, ox, oy, color) => {
            ctx.fillStyle = color
            for (const [x, y, w, h] of list) ctx.fillRect(Math.round(ox + x), Math.round(oy + y), w, h)
        }

        const spawn = (g) => {
            if (g.score > 320 && Math.random() < 0.28) {
                const y = [GROUND_Y - 24, GROUND_Y - 50, GROUND_Y - 76][Math.floor(Math.random() * 3)]
                g.obstacles.push({ kind: 'bird', x: W + 10, y, w: BIRD_UP.w, h: BIRD_UP.h, wing: 0 })
            } else {
                const c = Math.random() < 0.4 ? CACTUS_S : (Math.random() < 0.5 ? CACTUS_L : CACTUS_XL)
                g.obstacles.push({ kind: 'cactus', spr: c, x: W + 10, y: GROUND_Y - c.h, w: c.w, h: c.h })
            }
            g.spawnIn = Math.max(30, Math.round(Math.random() * 50 + 60 - g.speed * 2))
        }

        const dinoBox = (g) => g.duck && g.onGround
            ? { x: 44, y: g.y + (REX.h - REX.duckH), w: REX.duckW, h: REX.duckH }
            : { x: 44, y: g.y, w: REX.w, h: REX.h }

        const hit = (g) => {
            const d = dinoBox(g); const p = 6
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
                // day/night flip every ~700 pts
                const target = Math.floor(g.score / 700) % 2
                if (target !== g.night) g.night = target
                if (g.flash > 0) g.flash--
                if (hit(g)) {
                    g.over = true
                    const sc = Math.floor(g.score)
                    if (sc > highRef.current) { highRef.current = sc; try { localStorage.setItem(HS_KEY, String(sc)) } catch { /* ignore */ } setHigh(sc) }

                }
            }

            // ---- draw (classic gray-on-white, inverted at night) ----
            const night = g.night === 1
            const bg = night ? '#1b1b1b' : '#f7f7f7'
            const fg = night ? '#f7f7f7' : '#535353'
            ctx.fillStyle = bg
            ctx.fillRect(0, 0, W, H)

            // clouds
            for (const c of g.clouds) rects(CLOUD, c.x, c.y, night ? '#5a5a5a' : '#cfcfcf')
            // moon/sun dot at night
            if (night) { ctx.fillStyle = '#d0d0d0'; ctx.fillRect(W - 120, 26, 14, 14); ctx.fillStyle = bg; ctx.fillRect(W - 116, 26, 10, 12) }

            // ground: solid line + scrolling speckles
            ctx.fillStyle = fg
            ctx.fillRect(0, GROUND_Y + 1, W, 2)
            const off = Math.floor(g.tick * (g.started && !g.over ? g.speed : 0)) % 24
            for (let x = -off; x < W; x += 24) { ctx.fillRect(x + 4, GROUND_Y + 6, 3, 2); ctx.fillRect(x + 14, GROUND_Y + 9, 2, 2) }

            // obstacles
            for (const o of g.obstacles) {
                if (o.kind === 'cactus') rects(o.spr.rects, o.x, o.y, fg)
                else rects((o.wing ? BIRD_DN : BIRD_UP).rects, o.x, o.y, fg)
            }

            // dino
            const running = g.started && !g.over && g.onGround
            const legPhase = Math.floor(g.tick / 6) % 2
            if (g.duck && g.onGround) {
                const oy = g.y + (REX.h - REX.duckH)
                rects(REX.duck, 44, oy, fg)
                rects(running ? (legPhase ? REX.duckLegsA : REX.duckLegsB) : REX.duckLegsA, 44, oy, fg)
                rects(REX.duckEye, 44, oy, bg)
            } else {
                rects(REX.body, 44, g.y, fg)
                rects(!g.started || g.over ? REX.stand : (running ? (legPhase ? REX.legsA : REX.legsB) : REX.stand), 44, g.y, fg)
                rects(REX.eye, 44, g.y, bg)
            }

            // score (top-right, zero-padded, blinking HI badge unused)
            ctx.fillStyle = fg
            ctx.font = '700 15px "Courier New", monospace'
            ctx.textBaseline = 'top'
            ctx.textAlign = 'right'
            const hi = highRef.current > 0 ? `HI ${String(highRef.current).padStart(5, '0')}  ` : ''
            ctx.fillText(hi + String(Math.floor(g.score)).padStart(5, '0'), W - 14, 14)
            ctx.textAlign = 'center'

            if (!g.started) {
                ctx.fillStyle = fg
                ctx.font = '700 14px system-ui, sans-serif'
                ctx.fillText('Press Space / ↑ or tap to start', W / 2, 26)
            }
            if (g.over) {
                ctx.fillStyle = fg
                ctx.font = '700 22px "Courier New", monospace'
                ctx.fillText('G A M E   O V E R', W / 2, 58)
                // restart icon (circle + arrow head)
                const cx = W / 2, cy = 100, r = 15
                ctx.strokeStyle = fg; ctx.lineWidth = 3
                ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.35, Math.PI * 1.9); ctx.stroke()
                ctx.beginPath(); ctx.moveTo(cx + r - 2, cy - 8); ctx.lineTo(cx + r + 5, cy - 5); ctx.lineTo(cx + r - 1, cy + 1); ctx.closePath(); ctx.fill()
            }
            ctx.textAlign = 'left'

            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)

        const restart = () => { game.current = fresh(); game.current.started = true; }
        const jump = () => {
            const g = game.current
            if (g.over) { restart(); return }
            if (!g.started) { g.started = true; }
            if (g.onGround) { g.vy = JUMP_V; g.onGround = false }
        }
        const onKeyDown = (e) => {
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

    return (
        <div className="page">
            <div className="page-head">
                <h1>🦖 Dino Run</h1>
                <p>MathLab&apos;s secret offline game — just like Chrome&apos;s. <kbd>Space</kbd>/<kbd>↑</kbd> to jump, <kbd>↓</kbd> to duck, or tap. Works with no internet.</p>
            </div>

            <div className="dino-wrap">
                <canvas ref={canvasRef} width={W} height={H} className="dino-canvas" aria-label="Dino running game" />
            </div>

            <div className="dino-actions">
                <button className="btn ghost" onClick={() => navigate('/')}>← Back to MathLab</button>
                <span className="hint">Best: {high}</span>
            </div>
        </div>
    )
}

export default DinoGame

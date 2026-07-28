import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * A hidden offline dino runner — MathLab's little Easter egg. Pure canvas +
 * requestAnimationFrame, no assets or network, so it works with the lights off
 * (and offline, since the app shell is cached). Jump the cacti; it speeds up as
 * you go. High score persists in localStorage.
 *
 * Reached via the secret 🦕 in the footer, or #/dino directly.
 */

const W = 680
const H = 200
const GROUND = 168          // y of the ground line
const DINO = { x: 54, w: 40, h: 44 }
const GRAVITY = 0.7
const JUMP_V = -12.5
const HS_KEY = 'mathlab-dino-highscore'

const readHigh = () => {
    try { return Number(localStorage.getItem(HS_KEY)) || 0 } catch { return 0 }
}

// Obstacle catalog — emoji glyph plus an approximate hitbox.
const CACTI = [
    { g: '🌵', w: 26, h: 34 },
    { g: '🌵', w: 26, h: 44 },
    { g: '🌵🌵', w: 52, h: 34 }
]
const BIRD = { g: '🦅', w: 34, h: 28 }

const DinoGame = () => {
    const canvasRef = useRef(null)
    const navigate = useNavigate()
    const [phase, setPhase] = useState('ready') // 'ready' | 'playing' | 'over'
    const [high, setHigh] = useState(readHigh)
    const [finalScore, setFinalScore] = useState(0)
    const game = useRef(null)
    const highRef = useRef(readHigh())

    // One fresh game state.
    const fresh = () => ({
        y: GROUND - DINO.h,        // dino top
        vy: 0,
        onGround: true,
        obstacles: [],
        speed: 6,
        spawnIn: 40,
        score: 0,
        started: false,
        over: false,
        legFrame: 0
    })

    useEffect(() => {
        game.current = fresh()
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        // Pull theme colours off the canvas so the game matches the site theme.
        const colors = () => {
            const cs = getComputedStyle(canvas)
            return {
                ink: cs.getPropertyValue('--text').trim() || '#e8ecf4',
                muted: cs.getPropertyValue('--text-muted').trim() || '#94a3b8',
                accent: cs.getPropertyValue('--accent').trim() || '#6ea8fe'
            }
        }

        const spawn = (g) => {
            // Mostly cacti; the occasional bird once you're moving fast.
            if (g.speed > 8 && Math.random() < 0.25) {
                const height = [0, 34, 60][Math.floor(Math.random() * 3)]
                g.obstacles.push({ ...BIRD, x: W, y: GROUND - BIRD.h - height })
            } else {
                const c = CACTI[Math.floor(Math.random() * CACTI.length)]
                g.obstacles.push({ ...c, x: W, y: GROUND - c.h })
            }
            // Next spawn gap shrinks a little as speed grows; keep it fair.
            g.spawnIn = Math.max(28, Math.round((Math.random() * 60 + 60) - g.speed * 2))
        }

        const hit = (g) => {
            const pad = 8 // shrink the dino box so near-misses feel fair
            const dx = DINO.x + pad, dw = DINO.w - pad * 2
            const dy = g.y + pad, dh = DINO.h - pad * 2
            return g.obstacles.some(o =>
                dx < o.x + o.w - 4 && dx + dw > o.x + 4 && dy < o.y + o.h - 2 && dy + dh > o.y + 2)
        }

        let raf
        const loop = () => {
            const g = game.current
            const c = colors()

            if (g.started && !g.over) {
                // physics
                g.vy += GRAVITY
                g.y += g.vy
                if (g.y >= GROUND - DINO.h) { g.y = GROUND - DINO.h; g.vy = 0; g.onGround = true }
                // world
                g.score += 1
                g.speed = 6 + g.score / 400
                g.legFrame = (g.legFrame + 1) % 20
                for (const o of g.obstacles) o.x -= g.speed
                g.obstacles = g.obstacles.filter(o => o.x + o.w > -10)
                if (--g.spawnIn <= 0) spawn(g)
                if (hit(g)) {
                    g.over = true
                    const sc = Math.floor(g.score / 5)
                    setFinalScore(sc)
                    if (sc > highRef.current) { highRef.current = sc; try { localStorage.setItem(HS_KEY, String(sc)) } catch { /* ignore */ } setHigh(sc) }
                    setPhase('over')
                }
            }

            // ---- draw ----
            ctx.clearRect(0, 0, W, H)
            // ground
            ctx.strokeStyle = c.muted
            ctx.lineWidth = 2
            ctx.beginPath(); ctx.moveTo(0, GROUND + 1); ctx.lineTo(W, GROUND + 1); ctx.stroke()
            // obstacles
            for (const o of g.obstacles) {
                ctx.font = `${o.h}px serif`
                ctx.textBaseline = 'top'
                ctx.fillText(o.g, o.x, o.y)
            }
            // dino (bob the emoji a touch while running)
            const bob = g.started && !g.over && g.onGround && g.legFrame < 10 ? 1 : 0
            ctx.font = `${DINO.h}px serif`
            ctx.textBaseline = 'top'
            ctx.fillText('🦖', DINO.x, g.y + bob)
            // score
            ctx.fillStyle = c.ink
            ctx.font = '700 16px system-ui, sans-serif'
            ctx.textBaseline = 'top'
            ctx.textAlign = 'right'
            ctx.fillText(`HI ${String(highRef.current).padStart(5, '0')}   ${String(Math.floor(g.score / 5)).padStart(5, '0')}`, W - 12, 12)
            ctx.textAlign = 'left'

            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)

        const restart = () => { game.current = fresh(); game.current.started = true; setPhase('playing') }
        const jump = () => {
            const g = game.current
            if (g.over) { restart(); return }
            if (!g.started) { g.started = true; setPhase('playing') }
            if (g.onGround) { g.vy = JUMP_V; g.onGround = false }
        }

        const onKey = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') { e.preventDefault(); jump() }
        }
        const onPointer = (e) => { e.preventDefault(); jump() }
        window.addEventListener('keydown', onKey)
        canvas.addEventListener('pointerdown', onPointer)

        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('keydown', onKey)
            canvas.removeEventListener('pointerdown', onPointer)
        }
    }, [])

    return (
        <div className="page">
            <div className="page-head">
                <h1>🦖 Dino Run</h1>
                <p>MathLab&apos;s secret offline game. Press <kbd>Space</kbd> / <kbd>↑</kbd> or tap to jump. It works with no internet.</p>
            </div>

            <div className="dino-wrap">
                <canvas ref={canvasRef} width={W} height={H} className="dino-canvas" aria-label="Dino running game" />
                {phase !== 'playing' && (
                    <div className="dino-overlay">
                        {phase === 'ready' ? (
                            <>
                                <div className="dino-msg">Press Space or tap to start</div>
                            </>
                        ) : (
                            <>
                                <div className="dino-msg">Game over — score {finalScore}</div>
                                <div className="dino-sub">Press Space or tap to play again</div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="dino-actions">
                <button className="btn ghost" onClick={() => navigate('/')}>← Back to MathLab</button>
                <span className="hint">Best: {high}</span>
            </div>
        </div>
    )
}

export default DinoGame

import { useEffect, useRef, useState } from 'react'
import { WIN, adoptIds, canMove, isValidBoard, maxValue, move, newGame, normalizeBoard, spawn } from '../utils/game2048'

/**
 * 2048 — MathLab's second secret game, a faithful clone of the original.
 * Popup overlay (no route), opened from the footer; reuses the dino modal shell.
 */

const BEST_KEY = 'mathlab-2048-best'
const STATE_KEY = 'mathlab-2048-state'
const SLIDE_MS = 150 // must match --slide on .g2048-board in site.css
const GAIN_MS = 600

const readBest = () => {
    try {
        const n = Number(localStorage.getItem(BEST_KEY))
        return Number.isFinite(n) && n > 0 ? n : 0
    } catch { return 0 }
}

// the real 2048 resumes where you left off — so do we
const readSaved = () => {
    try {
        const s = JSON.parse(localStorage.getItem(STATE_KEY) || 'null')
        if (!s || !isValidBoard(s.tiles)) return null
        const score = Number(s.score)
        return {
            tiles: adoptIds(normalizeBoard(s.tiles)),
            score: Number.isFinite(score) && score >= 0 ? score : 0,
            won: !!s.won,
            keepGoing: !!s.keepGoing
        }
    } catch { return null }
}

const KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right'
}

const Game2048 = ({ onClose }) => {
    const [saved] = useState(readSaved)
    const [tiles, setTiles] = useState(() => (saved ? saved.tiles : newGame()))
    const [dead, setDead] = useState([]) // merge sources, dropped once they've slid in
    const [score, setScore] = useState(saved ? saved.score : 0)
    const [best, setBest] = useState(readBest)
    const [gain, setGain] = useState(null) // the floating "+4"
    const [won, setWon] = useState(saved ? saved.won : false)
    const [keepGoing, setKeepGoing] = useState(saved ? saved.keepGoing : false)

    const timers = useRef([])
    const gainSeq = useRef(0)
    const swipe = useRef(null)
    const over = !canMove(tiles)

    // the board and score are authoritative in refs so two keypresses landing in
    // the same tick both act on the latest position instead of racing on state
    const boardRef = useRef(tiles)
    const scoreRef = useRef(score)
    const bestRef = useRef(best)

    const clearTimers = () => {
        timers.current.forEach(clearTimeout)
        timers.current = []
    }

    const applyMove = (dir) => {
        if (won && !keepGoing) return
        const res = move(boardRef.current, dir)
        if (!res.moved) return

        clearTimers()
        const next = spawn(res.tiles)
        boardRef.current = next
        setTiles(next)
        setDead(res.dead)
        timers.current.push(setTimeout(() => setDead([]), SLIDE_MS))

        if (res.gained) {
            scoreRef.current += res.gained
            setScore(scoreRef.current)
            if (scoreRef.current > bestRef.current) {
                bestRef.current = scoreRef.current
                setBest(scoreRef.current)
            }
            setGain({ key: ++gainSeq.current, amount: res.gained })
            timers.current.push(setTimeout(() => setGain(null), GAIN_MS))
        } else {
            setGain(null) // clearTimers() just cancelled the pending clear for the last one
        }
        if (!won && maxValue(res.tiles) >= WIN) setWon(true)
    }

    const newRound = () => {
        clearTimers()
        const fresh = newGame()
        boardRef.current = fresh
        scoreRef.current = 0
        setTiles(fresh)
        setDead([])
        setScore(0)
        setGain(null)
        setWon(false)
        setKeepGoing(false)
        try { localStorage.removeItem(STATE_KEY) } catch { /* ignore */ }
    }

    // the keydown effect below is mount-once, so it reads the latest move through a
    // ref, refreshed after each commit
    const moveRef = useRef(applyMove)
    useEffect(() => { moveRef.current = applyMove })

    useEffect(() => {
        const onKey = (e) => {
            // never hijack a shortcut: ⌘S, ⌘A, ⌘W, ⌥← and friends all collide with WASD/arrows
            if (e.metaKey || e.ctrlKey || e.altKey) return
            const t = e.target
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
            const dir = KEYS[e.key] || KEYS[String(e.key).toLowerCase()]
            if (!dir) return
            // /scientific keeps a document-level arrow-key handler alive underneath us
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            moveRef.current(dir)
        }
        window.addEventListener('keydown', onKey, { capture: true })
        return () => window.removeEventListener('keydown', onKey, { capture: true })
    }, [])

    useEffect(() => clearTimers, [])

    useEffect(() => {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify({ tiles, score, won, keepGoing }))
        } catch { /* ignore */ }
    }, [tiles, score, won, keepGoing])

    useEffect(() => {
        try { localStorage.setItem(BEST_KEY, String(best)) } catch { /* ignore */ }
    }, [best])

    useEffect(() => {
        const onEsc = (e) => { if (e.key === 'Escape') onClose?.() }
        window.addEventListener('keydown', onEsc)
        return () => window.removeEventListener('keydown', onEsc)
    }, [onClose])

    const onPointerDown = (e) => {
        // the game-over/win overlay's buttons live inside the board — leave their
        // pointers alone, capturing here would steal their click
        if (e.target?.closest?.('button')) { swipe.current = null; return }
        swipe.current = { x: e.clientX, y: e.clientY }
        // capture the pointer so a fast swipe still reports its end on the board
        // instead of being swallowed when the finger leaves the grid
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not supported */ }
    }
    const onPointerCancel = () => { swipe.current = null }
    const onPointerUp = (e) => {
        const from = swipe.current
        swipe.current = null
        if (!from) return
        const dx = e.clientX - from.x
        const dy = e.clientY - from.y
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
        if (Math.abs(dx) > Math.abs(dy)) applyMove(dx > 0 ? 'right' : 'left')
        else applyMove(dy > 0 ? 'down' : 'up')
    }

    const showMessage = over || (won && !keepGoing)

    return (
        <div
            className="dino-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="2048 — secret game"
            onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
        >
            <div className="dino-modal">
                <div className="dino-modal-head">
                    <div className="page-head">
                        <h1>🔢 2048</h1>
                        <p>Join the numbers and get to the <b>2048</b> tile! <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> or swipe.</p>
                    </div>
                    <button className="dino-close" onClick={() => onClose?.()} aria-label="Close game" title="Close (Esc)">×</button>
                </div>

                <div className="g2048-bar">
                    <div className="g2048-scores">
                        <div className="g2048-score-box">
                            <span className="g2048-score-label">Score</span>
                            <span className="g2048-score-val" aria-live="polite">{score}</span>
                            {gain && <span key={gain.key} className="g2048-add">+{gain.amount}</span>}
                        </div>
                        <div className="g2048-score-box">
                            <span className="g2048-score-label">Best</span>
                            <span className="g2048-score-val">{best}</span>
                        </div>
                    </div>
                    <button className="btn" onClick={newRound}>New Game</button>
                </div>

                <div className="g2048-wrap">
                    <div
                        className="g2048-board"
                        role="group"
                        aria-label={`2048 board — score ${score}`}
                        onPointerDown={onPointerDown}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerCancel}
                    >
                        {Array.from({ length: 16 }, (_, i) => <div key={i} className="g2048-cell" />)}
                        {[...dead, ...tiles].sort((a, b) => a.id - b.id).map(t => (
                            <div
                                key={t.id}
                                className={`g2048-tile${t.isNew ? ' is-new' : ''}${t.merged ? ' is-merged' : ''}`}
                                data-value={t.value > 2048 ? 'super' : t.value}
                                data-len={String(t.value).length}
                                style={{ '--r': String(t.row), '--c': String(t.col) }}
                            >
                                {t.value}
                            </div>
                        ))}
                        {showMessage && (
                            <div className={`g2048-msg${won ? ' win' : ''}`}>
                                <p className="dino-msg">{won ? 'You win!' : 'Game over!'}</p>
                                <div className="g2048-msg-actions">
                                    {won && !over && <button className="btn" onClick={() => setKeepGoing(true)}>Keep going</button>}
                                    <button className="btn ghost" onClick={newRound}>Try again</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="dino-actions">
                    <button className="btn ghost" onClick={() => onClose?.()}>← Back to MathLab</button>
                    <span className="hint">Best: {best}</span>
                </div>
            </div>
        </div>
    )
}

export default Game2048

import { useEffect, useRef, useState } from 'react'
import { ENGINES, blocksFraming, hostOf, toUrl } from '../utils/webframe'

/**
 * An in-page web viewer: address bar, its own back/forward, resize and fullscreen.
 *
 * It is a popup overlay like the games — no route, so the site URL never changes
 * and nothing is added to the browser's history. Pages load in an iframe, and
 * iframe loads are not top-level navigations, so they stay out of history too.
 * The frame is sandboxed without allow-top-navigation, which also stops a framed
 * page from breaking out and navigating the whole tab.
 */

const SIZE_KEY = 'mathlab-frame-size'
const ENGINE_KEY = 'mathlab-frame-engine'
const MIN_W = 420
const MIN_H = 320

const LINKS = [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org' },
    { label: 'Khan Academy', url: 'https://www.khanacademy.org' },
    { label: 'Desmos', url: 'https://www.desmos.com/calculator' },
    { label: 'Archive.org', url: 'https://archive.org' }
]

const readSize = () => {
    try {
        const s = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null')
        if (s && Number.isFinite(s.w) && Number.isFinite(s.h)) {
            return { w: Math.max(MIN_W, s.w), h: Math.max(MIN_H, s.h) }
        }
    } catch { /* ignore */ }
    return { w: 940, h: 640 }
}

const readEngine = () => {
    try {
        const id = localStorage.getItem(ENGINE_KEY)
        return ENGINES.some(e => e.id === id) ? id : ENGINES[0].id
    } catch { return ENGINES[0].id }
}

const WebFrame = ({ onClose }) => {
    const [input, setInput] = useState('')
    const [stack, setStack] = useState([]) // our own history — a cross-origin frame's is unreadable
    const [idx, setIdx] = useState(-1)
    const [nonce, setNonce] = useState(0)
    const [engine, setEngine] = useState(readEngine)
    const [size, setSize] = useState(readSize)
    const [maximized, setMaximized] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [resizing, setResizing] = useState(false)

    const shellRef = useRef(null)
    const urlRef = useRef(null)
    const restoreSize = useRef(null)
    const drag = useRef(null)

    const current = idx >= 0 ? stack[idx] : null
    const blocked = current ? blocksFraming(current) : false

    const go = (url) => {
        if (!url) return
        setStack(prev => [...prev.slice(0, idx + 1), url])
        setIdx(i => i + 1)
        setInput(url)
    }

    const submit = (e) => {
        e.preventDefault()
        go(toUrl(input, engine))
    }

    const back = () => { if (idx > 0) { setIdx(idx - 1); setInput(stack[idx - 1]) } }
    const forward = () => { if (idx < stack.length - 1) { setIdx(idx + 1); setInput(stack[idx + 1]) } }
    const reload = () => setNonce(n => n + 1)

    useEffect(() => {
        try { localStorage.setItem(ENGINE_KEY, engine) } catch { /* ignore */ }
    }, [engine])

    useEffect(() => {
        if (maximized) return
        try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)) } catch { /* ignore */ }
    }, [size, maximized])

    useEffect(() => {
        const onFs = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', onFs)
        return () => document.removeEventListener('fullscreenchange', onFs)
    }, [])

    /**
     * Close keys. ` is a panic key: it shuts the viewer at once from anywhere in
     * this document, fullscreen included. It cannot fire while the framed page
     * itself has focus — a cross-origin frame keeps its keystrokes to itself and
     * no page can read them — so the address bar is focused on open.
     */
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === '`') {
                e.preventDefault()
                e.stopPropagation()
                if (document.fullscreenElement) document.exitFullscreen?.().catch(() => { /* ignore */ })
                onClose?.()
                return
            }
            if (e.key === 'Escape' && !document.fullscreenElement) onClose?.() // Escape leaves fullscreen first
        }
        window.addEventListener('keydown', onKey, { capture: true })
        return () => window.removeEventListener('keydown', onKey, { capture: true })
    }, [onClose])

    useEffect(() => { urlRef.current?.focus() }, [])

    const toggleFullscreen = () => {
        if (document.fullscreenElement) document.exitFullscreen?.()
        else shellRef.current?.requestFullscreen?.().catch(() => { /* denied */ })
    }

    const toggleMaximize = () => {
        if (maximized) {
            if (restoreSize.current) setSize(restoreSize.current)
            setMaximized(false)
        } else {
            restoreSize.current = size
            setMaximized(true)
        }
    }

    // Drag-resize from the bottom-right corner. The frame gets pointer-events: none
    // while dragging, or the cross-origin iframe swallows the pointer moves.
    const startResize = (e) => {
        e.preventDefault()
        drag.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
        setResizing(true)
        const onMove = (ev) => {
            const d = drag.current
            if (!d) return
            setSize({
                w: Math.max(MIN_W, Math.min(window.innerWidth - 32, d.w + (ev.clientX - d.x))),
                h: Math.max(MIN_H, Math.min(window.innerHeight - 32, d.h + (ev.clientY - d.y)))
            })
        }
        const onUp = () => {
            drag.current = null
            setResizing(false)
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
    }

    const shellStyle = (maximized || isFullscreen)
        ? undefined
        : { width: `min(${size.w}px, calc(100vw - 2rem))`, height: `min(${size.h}px, calc(100vh - 2rem))` }

    return (
        <div
            className="wf-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Web viewer"
            onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
        >
            <div
                ref={shellRef}
                className={`wf-shell${maximized ? ' is-max' : ''}${isFullscreen ? ' is-fs' : ''}`}
                style={shellStyle}
            >
                <form className="wf-bar" onSubmit={submit}>
                    <button type="button" className="wf-nav" onClick={back} disabled={idx <= 0} aria-label="Back" title="Back">‹</button>
                    <button type="button" className="wf-nav" onClick={forward} disabled={idx >= stack.length - 1} aria-label="Forward" title="Forward">›</button>
                    <button type="button" className="wf-nav" onClick={reload} disabled={!current} aria-label="Reload" title="Reload">⟳</button>
                    <input
                        ref={urlRef}
                        className="wf-url"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Search or type a web address"
                        aria-label="Address bar"
                        spellCheck="false"
                        autoComplete="off"
                    />
                    <select
                        className="wf-engine"
                        value={engine}
                        onChange={(e) => setEngine(e.target.value)}
                        aria-label="Search engine"
                        title="Search engine"
                    >
                        {ENGINES.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <button type="submit" className="wf-nav" aria-label="Go" title="Go">→</button>
                    <span className="wf-spacer" />
                    <a
                        className={`wf-nav${current ? '' : ' is-off'}`}
                        href={current || '#'}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label="Open in a new tab"
                        title="Open in a new tab"
                    >↗</a>
                    <button type="button" className="wf-nav" onClick={toggleMaximize} aria-label={maximized ? 'Restore size' : 'Maximize'} title={maximized ? 'Restore size' : 'Maximize'}>{maximized ? '❐' : '▢'}</button>
                    <button type="button" className="wf-nav" onClick={toggleFullscreen} aria-label="Fullscreen" title="Fullscreen">⛶</button>
                    <button type="button" className="wf-nav wf-x" onClick={() => onClose?.()} aria-label="Close" title="Close (Esc, or ` to close instantly)">×</button>
                </form>

                {blocked && (
                    <p className="wf-note" role="status">
                        <b>{hostOf(current)}</b> refuses to be embedded (X-Frame-Options), so it will stay blank — use <b>↗</b> to open it in a tab.
                    </p>
                )}

                <div className={`wf-stage${resizing ? ' is-resizing' : ''}`}>
                    {current ? (
                        <iframe
                            key={`${idx}:${current}:${nonce}`}
                            className="wf-frame"
                            src={current}
                            title="Web viewer"
                            referrerPolicy="no-referrer"
                            allow="fullscreen; clipboard-write"
                            sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                        />
                    ) : (
                        <div className="wf-start">
                            <p className="wf-start-title">Type a search or an address above.</p>
                            <div className="wf-links">
                                {LINKS.map(l => (
                                    <button key={l.url} type="button" className="btn ghost" onClick={() => go(l.url)}>{l.label}</button>
                                ))}
                            </div>
                            <p className="hint">
                                Nothing here touches the page URL or your browser history. Sites that send
                                X-Frame-Options (Google, YouTube, GitHub…) cannot be embedded by any page — open those with ↗.
                            </p>
                        </div>
                    )}
                </div>

                {!maximized && !isFullscreen && (
                    <div className="wf-resize" onPointerDown={startResize} title="Drag to resize" aria-hidden="true" />
                )}
            </div>
        </div>
    )
}

export default WebFrame

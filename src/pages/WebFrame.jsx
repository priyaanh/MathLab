import { useEffect, useRef, useState } from 'react'
import {
    DEFAULT_PREFS, ENGINES, MAX_BOOKMARKS, MAX_RAIL, MAX_TABS, MIN_RAIL, blocksFraming, clampRail,
    hostOf, hueFor, pruneRetiredDefaults, readableOn, sanitizeBookmarks, sanitizePrefs, sanitizeSession,
    tabLabel, toUrl
} from '../utils/webframe'

/**
 * An in-page web viewer laid out like Chrome with vertical tabs: a tab rail down
 * the left, a pill omnibox, a bookmarks bar and a new-tab page.
 *
 * It is a popup overlay like the games — no route, so the site URL never changes
 * and nothing is added to the browser's history. Pages load in an iframe, and
 * iframe loads are not top-level navigations, so they stay out of history too.
 * The frame is sandboxed without allow-top-navigation, which also stops a framed
 * page from breaking out and navigating the whole tab.
 */

const SIZE_KEY = 'mathlab-frame-size'
const PREFS_KEY = 'mathlab-frame-prefs'
const SESSION_KEY = 'mathlab-frame-session'
const MARKS_KEY = 'mathlab-frame-bookmarks'
const PRUNED_KEY = 'mathlab-frame-pruned'
const MIN_W = 520
const MIN_H = 360

/** Settings sections, one pane at a time so the popup never becomes a long scroll. */
const PANES = [
    { id: 'look', name: 'Appearance', icon: '◑' },
    { id: 'start', name: 'Start & search', icon: '⌂' },
    { id: 'home', name: 'Home screen', icon: '▦' },
    { id: 'marks', name: 'Shortcuts', icon: '★' },
    { id: 'privacy', name: 'Privacy', icon: '⚿' }
]

const ACCENTS = ['#2f6bff', '#7c5cff', '#00a8a8', '#12a150', '#f5a524', '#f05a4f', '#e05fa0', '#8a8f98']

const readSize = () => {
    try {
        const s = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null')
        if (s && Number.isFinite(s.w) && Number.isFinite(s.h)) {
            return { w: Math.max(MIN_W, s.w), h: Math.max(MIN_H, s.h) }
        }
    } catch { /* ignore */ }
    return { w: 1020, h: 680 }
}

/**
 * Bookmarks live under their own key so they outlive a settings reset. Older
 * saves kept them inside the prefs blob — `readPrefs` falls back to those.
 */
const readMarks = () => {
    try {
        const stored = localStorage.getItem(MARKS_KEY)
        return stored === null ? null : sanitizeBookmarks(JSON.parse(stored))
    } catch { return null }
}

const readPrefs = () => {
    let prefs
    try { prefs = sanitizePrefs(JSON.parse(localStorage.getItem(PREFS_KEY) || 'null')) } catch { prefs = sanitizePrefs(null) }
    // read separately: a broken prefs blob must not cost anyone their bookmarks
    const marks = readMarks()
    if (marks !== null) prefs.bookmarks = marks

    /*
     * Drop bookmarks that used to be shipped defaults, exactly once. This has to
     * happen after the fallback above, not inside readMarks: the oldest saves have
     * no bookmarks key at all, and pruning only that key let those keep Desmos
     * forever. The flag means one re-added on purpose is then kept for good.
     */
    try {
        if (!localStorage.getItem(PRUNED_KEY)) {
            localStorage.setItem(PRUNED_KEY, '1')
            prefs.bookmarks = pruneRetiredDefaults(prefs.bookmarks)
        }
    } catch { /* no storage — nothing saved to migrate */ }

    return prefs
}

const readSession = () => {
    try { return sanitizeSession(JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')) } catch { return null }
}

// Each tab keeps its own history — a cross-origin frame's real history is unreadable.
let nextTabId = 1
const makeTab = (url) => ({ id: nextTabId++, stack: url ? [url] : [], idx: url ? 0 : -1, nonce: 0 })
const urlOf = (tab) => (tab && tab.idx >= 0 ? tab.stack[tab.idx] : null)

/**
 * A site's own /favicon.ico — no third-party icon service involved. When a site
 * has none, it falls back to its initial on a colour derived from the host, so a
 * shelf of icons stays distinguishable instead of going uniformly grey.
 *
 * The failure is remembered per URL: a tab that leaves an icon-less site must not
 * keep showing the letter once it lands somewhere that does have one.
 */
const Favicon = ({ url, className = 'wf-fav' }) => {
    const [failedFor, setFailedFor] = useState(null)
    const host = hostOf(url)
    if (!host || failedFor === url) {
        return (
            <span
                className={`${className} is-letter`}
                style={host ? { '--wf-hue': hueFor(host) } : undefined}
                aria-hidden="true"
            >{(host || '•').charAt(0).toUpperCase()}</span>
        )
    }
    let origin = ''
    try { origin = new URL(url).origin } catch { /* handled by the guard above */ }
    return <img className={className} src={`${origin}/favicon.ico`} alt="" loading="lazy" onError={() => setFailedFor(url)} />
}

const WebFrame = ({ onClose }) => {
    const [prefs, setPrefs] = useState(readPrefs)

    // Reopen exactly where we left off — tabs, their history and the front tab.
    const [restored] = useState(() => {
        const s = readSession()
        if (s) {
            const list = s.tabs.map(t => ({ id: nextTabId++, stack: t.stack, idx: t.idx, nonce: 0 }))
            return { tabs: list, activeId: list[s.active].id }
        }
        const tab = makeTab(prefs.newTabOpensHome ? prefs.home : null)
        return { tabs: [tab], activeId: tab.id }
    })

    const [tabs, setTabs] = useState(restored.tabs)
    const [activeId, setActiveId] = useState(restored.activeId)
    const [input, setInput] = useState(() => urlOf(restored.tabs.find(t => t.id === restored.activeId)) || '')
    const [ntpQuery, setNtpQuery] = useState('')
    const [size, setSize] = useState(readSize)
    const [maximized, setMaximized] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [resizing, setResizing] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [setPane, setSetPane] = useState('look')
    const [railOpen, setRailOpen] = useState(true)
    const [marksIo, setMarksIo] = useState('')
    const [marksMsg, setMarksMsg] = useState('')
    const [draft, setDraft] = useState(null) // the new-shortcut form on the home screen

    const shellRef = useRef(null)
    const urlRef = useRef(null)
    const ntpRef = useRef(null)
    const restoreSize = useRef(null)
    const drag = useRef(null)

    const active = tabs.find(t => t.id === activeId) || tabs[0]
    const current = urlOf(active)
    const blocked = current ? blocksFraming(current) : false

    const patchActive = (fn) => setTabs(ts => ts.map(t => (t.id === active.id ? fn(t) : t)))
    const patchPrefs = (patch) => setPrefs(p => sanitizePrefs({ ...p, ...patch }))

    /* ---- navigation ---- */
    const go = (url) => {
        if (!url) return
        patchActive(t => ({ ...t, stack: [...t.stack.slice(0, t.idx + 1), url], idx: t.idx + 1 }))
        setInput(url)
        setNtpQuery('')
    }
    const submit = (e) => { e.preventDefault(); go(toUrl(input, prefs.engine)) }
    const submitNtp = (e) => { e.preventDefault(); go(toUrl(ntpQuery, prefs.engine)) }
    const back = () => {
        if (active.idx <= 0) return
        patchActive(t => ({ ...t, idx: t.idx - 1 }))
        setInput(active.stack[active.idx - 1])
    }
    const forward = () => {
        if (active.idx >= active.stack.length - 1) return
        patchActive(t => ({ ...t, idx: t.idx + 1 }))
        setInput(active.stack[active.idx + 1])
    }
    const reload = () => patchActive(t => ({ ...t, nonce: t.nonce + 1 }))

    /* ---- tabs ---- */
    const openTab = (url) => {
        if (tabs.length >= MAX_TABS) return
        const tab = makeTab(url ?? (prefs.newTabOpensHome ? prefs.home : null))
        setTabs(ts => [...ts, tab])
        setActiveId(tab.id)
        setInput(urlOf(tab) || '')
        setNtpQuery('')
    }
    const selectTab = (id) => {
        const tab = tabs.find(t => t.id === id)
        if (!tab) return
        setActiveId(id)
        setInput(urlOf(tab) || '')
    }
    const closeTab = (id) => {
        if (tabs.length <= 1) { onClose?.(); return } // last tab closes the viewer, like Chrome
        const i = tabs.findIndex(t => t.id === id)
        const rest = tabs.filter(t => t.id !== id)
        setTabs(rest)
        if (id === active.id) {
            const next = rest[Math.min(i, rest.length - 1)]
            setActiveId(next.id)
            setInput(urlOf(next) || '')
        }
    }

    /* ---- persistence ---- */
    useEffect(() => {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
    }, [prefs])

    /*
     * Kept separately so "Reset settings" and a broken prefs blob both leave them
     * alone. Keyed on the serialised form, not the array: sanitizePrefs rebuilds
     * bookmarks on every call, so an identity dep rewrote the whole list on each
     * unrelated tweak — once per event while dragging the colour picker.
     */
    const marksJson = JSON.stringify(prefs.bookmarks)
    useEffect(() => {
        try { localStorage.setItem(MARKS_KEY, marksJson) } catch { /* ignore */ }
    }, [marksJson])

    useEffect(() => {
        if (maximized) return
        try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)) } catch { /* ignore */ }
    }, [size, maximized])

    // Saved on every change, so closing with the panic key never loses the session.
    useEffect(() => {
        try {
            const payload = {
                tabs: tabs.map(t => ({ stack: t.stack, idx: t.idx })),
                active: Math.max(0, tabs.findIndex(t => t.id === activeId))
            }
            if (payload.tabs.every(t => t.idx < 0)) localStorage.removeItem(SESSION_KEY)
            else localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
        } catch { /* ignore */ }
    }, [tabs, activeId])

    /* ---- window chrome ---- */
    useEffect(() => {
        const onFs = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', onFs)
        return () => document.removeEventListener('fullscreenchange', onFs)
    }, [])

    /**
     * Close keys. The panic key (` by default, changeable in settings) shuts the
     * viewer at once from anywhere in this document, fullscreen included. It
     * cannot fire while the framed page itself has focus — a cross-origin frame
     * keeps its keystrokes to itself — so a search box is focused on open.
     */
    useEffect(() => {
        const onKey = (e) => {
            if (e.target?.dataset?.keycapture) return // the settings field that records a key
            if (e.key === prefs.closeKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault()
                e.stopPropagation()
                if (document.fullscreenElement) document.exitFullscreen?.().catch(() => { /* ignore */ })
                onClose?.()
                return
            }
            if (e.key === 'Escape' && !document.fullscreenElement) {
                if (showSettings) { setShowSettings(false); return }
                onClose?.()
            }
        }
        window.addEventListener('keydown', onKey, { capture: true })
        return () => window.removeEventListener('keydown', onKey, { capture: true })
    }, [onClose, prefs.closeKey, showSettings])

    useEffect(() => { (ntpRef.current || urlRef.current)?.focus() }, [])

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

    // Drag the rail's edge to make the tab strip thinner or wider. Same trick as the
    // corner grip: the frame ignores pointers mid-drag so the gesture survives.
    const startRailResize = (e) => {
        e.preventDefault()
        const startX = e.clientX
        const startW = prefs.railWidth
        setResizing(true)
        const onMove = (ev) => setPrefs(p => ({ ...p, railWidth: clampRail(startW + (ev.clientX - startX)) }))
        const onUp = () => {
            setResizing(false)
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
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

    /* ---- bookmarks ---- */
    const bookmarkCurrent = () => {
        if (!current || prefs.bookmarks.length >= MAX_BOOKMARKS) return
        if (prefs.bookmarks.some(b => b.url === current)) return
        patchPrefs({ bookmarks: [...prefs.bookmarks, { label: tabLabel(current), url: current }] })
    }
    const removeBookmark = (url) => patchPrefs({ bookmarks: prefs.bookmarks.filter(b => b.url !== url) })

    /** The home screen's "+" tile. A bare host is fine — toUrl fills in https://. */
    const addShortcut = (e) => {
        e.preventDefault()
        const typed = (draft?.url || '').trim()
        // toUrl turns anything it cannot read as an address into a search, and a
        // shortcut pointing at a results page is never what was meant. So accept
        // only what is already an address, and leave the form up otherwise.
        const isAddress = /^https?:\/\//i.test(typed) || /^[^\s/]+\.[a-z]{2,}([/?#]|$)/i.test(typed)
        const url = isAddress ? toUrl(typed, prefs.engine) : null
        if (!url) return
        patchPrefs({ bookmarks: [...prefs.bookmarks, { label: draft.label.trim() || tabLabel(url), url }] })
        setDraft(null)
    }

    /** Move a shortcut one place along, so the home screen can be ordered. */
    const moveBookmark = (url, delta) => {
        const i = prefs.bookmarks.findIndex(b => b.url === url)
        const j = i + delta
        if (i < 0 || j < 0 || j >= prefs.bookmarks.length) return
        const next = [...prefs.bookmarks]
        ;[next[i], next[j]] = [next[j], next[i]]
        patchPrefs({ bookmarks: next })
    }

    /** Chrome's "bookmark all tabs" — duplicates are dropped by the sanitiser. */
    const bookmarkAllTabs = () => {
        const open = tabs.map(urlOf).filter(Boolean).map(u => ({ label: tabLabel(u), url: u }))
        if (!open.length) return
        patchPrefs({ bookmarks: [...prefs.bookmarks, ...open] })
    }

    const exportBookmarks = () => {
        const text = JSON.stringify(prefs.bookmarks, null, 2)
        navigator.clipboard?.writeText(text).then(
            () => setMarksMsg(`Copied ${prefs.bookmarks.length} bookmarks to the clipboard.`),
            () => setMarksMsg('Could not reach the clipboard — copy them from the box below.')
        )
        setMarksIo(text)
    }

    const importBookmarks = () => {
        let incoming = []
        try { incoming = sanitizeBookmarks(JSON.parse(marksIo)) } catch { incoming = [] }
        if (!incoming.length) { setMarksMsg('Nothing importable in that text.'); return }
        const before = prefs.bookmarks.length
        patchPrefs({ bookmarks: [...prefs.bookmarks, ...incoming] })
        setMarksMsg(`Imported ${incoming.length}; ${before} kept, duplicates skipped.`)
    }

    const sizeStyle = (maximized || isFullscreen)
        ? null
        : { width: `min(${size.w}px, calc(100vw - 2rem))`, height: `min(${size.h}px, calc(100vh - 2rem))` }

    // A chosen accent overrides the site theme's, but only inside this window.
    const shellStyle = prefs.accent
        ? { ...sizeStyle, '--accent': prefs.accent, '--on-accent': readableOn(prefs.accent) }
        : (sizeStyle ?? undefined)

    const shellClass = [
        'wf-shell',
        maximized && 'is-max',
        isFullscreen && 'is-fs',
        prefs.density === 'compact' && 'is-compact',
        prefs.verticalTabs && 'has-rail',
        prefs.verticalTabs && !railOpen && 'rail-closed'
    ].filter(Boolean).join(' ')

    const tabList = (
        <div className="wf-tabs" role="tablist" aria-label="Tabs">
            {tabs.map(t => {
                const u = urlOf(t)
                return (
                    <div
                        key={t.id}
                        role="tab"
                        tabIndex={0}
                        aria-selected={t.id === active.id}
                        className={`wf-tab${t.id === active.id ? ' is-active' : ''}`}
                        title={u || 'New tab'}
                        onClick={() => selectTab(t.id)}
                        onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(t.id) } }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTab(t.id) } }}
                    >
                        <Favicon url={u} />
                        <span className="wf-tab-label">{tabLabel(u)}</span>
                        <button
                            type="button"
                            className="wf-tab-x"
                            aria-label="Close tab"
                            title="Close tab"
                            onClick={(e) => { e.stopPropagation(); closeTab(t.id) }}
                        >×</button>
                    </div>
                )
            })}
            <button type="button" className="wf-newtab" onClick={() => openTab()} aria-label="New tab" title="New tab">+</button>
        </div>
    )

    return (
        <div
            className="wf-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Web viewer"
            onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
        >
            <div ref={shellRef} className={shellClass} style={shellStyle}>
                {prefs.verticalTabs && (
                    <aside className="wf-rail" style={railOpen ? { width: `${prefs.railWidth}px` } : undefined}>
                        <div className="wf-rail-head">
                            <button
                                type="button"
                                className="wf-icon"
                                onClick={() => setRailOpen(o => !o)}
                                aria-label={railOpen ? 'Collapse tab rail' : 'Expand tab rail'}
                                aria-expanded={railOpen}
                                title={railOpen ? 'Collapse tabs' : 'Expand tabs'}
                            >☰</button>
                        </div>
                        {tabList}
                        {railOpen && (
                            <div
                                className="wf-rail-grip"
                                onPointerDown={startRailResize}
                                onDoubleClick={() => patchPrefs({ railWidth: DEFAULT_PREFS.railWidth })}
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="Resize tab strip"
                                aria-valuenow={prefs.railWidth}
                                aria-valuemin={MIN_RAIL}
                                aria-valuemax={MAX_RAIL}
                                tabIndex={0}
                                title="Drag to resize · double-click to reset"
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowLeft') { e.preventDefault(); patchPrefs({ railWidth: prefs.railWidth - 16 }) }
                                    if (e.key === 'ArrowRight') { e.preventDefault(); patchPrefs({ railWidth: prefs.railWidth + 16 }) }
                                }}
                            />
                        )}
                    </aside>
                )}

                <div className="wf-main">
                    <form className="wf-bar" onSubmit={submit}>
                        <button type="button" className="wf-icon" onClick={back} disabled={active.idx <= 0} aria-label="Back" title="Back">←</button>
                        <button type="button" className="wf-icon" onClick={forward} disabled={active.idx >= active.stack.length - 1} aria-label="Forward" title="Forward">→</button>
                        <button type="button" className="wf-icon" onClick={reload} disabled={!current} aria-label="Reload" title="Reload">⟳</button>
                        <div className="wf-omni">
                            {current ? <Favicon url={current} className="wf-omni-fav" /> : <span className="wf-omni-fav is-letter" aria-hidden="true">⌕</span>}
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
                            <button type="button" className="wf-omni-btn" onClick={bookmarkCurrent} disabled={!current} aria-label="Bookmark this page" title="Bookmark this page">☆</button>
                        </div>
                        <a
                            className={`wf-icon${current ? '' : ' is-off'}`}
                            href={current || '#'}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label="Open in a new browser tab"
                            title="Open in a new browser tab"
                        >↗</a>
                        <button type="button" className={`wf-icon${showSettings ? ' is-on' : ''}`} onClick={() => setShowSettings(s => !s)} aria-label="Settings" aria-expanded={showSettings} title="Settings">⚙</button>
                        <button type="button" className="wf-icon" onClick={toggleMaximize} aria-label={maximized ? 'Restore size' : 'Maximize'} title={maximized ? 'Restore size' : 'Maximize'}>{maximized ? '❐' : '▢'}</button>
                        <button type="button" className="wf-icon" onClick={toggleFullscreen} aria-label="Fullscreen" title="Fullscreen">⛶</button>
                        <button type="button" className="wf-icon wf-close" onClick={() => onClose?.()} aria-label="Close" title={`Close (Esc, or ${prefs.closeKey} to close instantly)`}>×</button>
                    </form>

                    {!prefs.verticalTabs && <div className="wf-toprail">{tabList}</div>}

                    {prefs.bookmarksBar && prefs.bookmarks.length > 0 && (
                        <div className="wf-bmbar">
                            {prefs.bookmarks.map(b => (
                                <button key={b.url} type="button" className="wf-bm" onClick={() => go(b.url)} title={b.url}>
                                    <Favicon url={b.url} className="wf-bm-fav" />
                                    <span>{b.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {showSettings && (
                        <div
                            className="wf-modal"
                            role="presentation"
                            onPointerDown={(e) => { if (e.target === e.currentTarget) setShowSettings(false) }}
                        >
                            <div className="wf-panel" role="dialog" aria-modal="true" aria-label="Browser settings">
                                <header className="wf-panel-head">
                                    <h2>Settings</h2>
                                    <button type="button" className="wf-icon" onClick={() => setShowSettings(false)} aria-label="Close settings" title="Close settings">×</button>
                                </header>

                                <div className="wf-panel-nav" role="tablist" aria-label="Settings sections">
                                    {PANES.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            role="tab"
                                            id={`wf-tab-${p.id}`}
                                            aria-selected={setPane === p.id}
                                            aria-controls="wf-panel-body"
                                            className={`wf-panel-tab${setPane === p.id ? ' is-on' : ''}`}
                                            onClick={() => setSetPane(p.id)}
                                        >
                                            <span aria-hidden="true">{p.icon}</span>
                                            <span>{p.name}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="wf-panel-body" id="wf-panel-body" role="tabpanel" aria-labelledby={`wf-tab-${setPane}`} tabIndex={-1}>
                                    {setPane === 'look' && (
                                        <>
                                            <div className="wf-set is-stack">
                                                <span>Accent colour</span>
                                                <div className="wf-swatches">
                                                    <button
                                                        type="button"
                                                        className={`wf-swatch is-auto${prefs.accent ? '' : ' is-on'}`}
                                                        onClick={() => patchPrefs({ accent: '' })}
                                                        title="Follow the site theme"
                                                        aria-label="Follow the site theme"
                                                        aria-pressed={!prefs.accent}
                                                    >A</button>
                                                    {ACCENTS.map(c => (
                                                        <button
                                                            key={c}
                                                            type="button"
                                                            className={`wf-swatch${prefs.accent.toLowerCase() === c ? ' is-on' : ''}`}
                                                            style={{ background: c }}
                                                            onClick={() => patchPrefs({ accent: c })}
                                                            title={c}
                                                            aria-label={`Accent ${c}`}
                                                            aria-pressed={prefs.accent.toLowerCase() === c}
                                                        />
                                                    ))}
                                                    <label className="wf-swatch is-custom" title="Pick any colour">
                                                        <input
                                                            type="color"
                                                            value={prefs.accent || '#2f6bff'}
                                                            onChange={(e) => patchPrefs({ accent: e.target.value })}
                                                            aria-label="Custom accent colour"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                            <label className="wf-set">
                                                <span>Density</span>
                                                <select value={prefs.density} onChange={(e) => patchPrefs({ density: e.target.value })}>
                                                    <option value="normal">Normal</option>
                                                    <option value="compact">Compact</option>
                                                </select>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.verticalTabs} onChange={(e) => patchPrefs({ verticalTabs: e.target.checked })} />
                                                <span>Vertical tabs on the left</span>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.bookmarksBar} onChange={(e) => patchPrefs({ bookmarksBar: e.target.checked })} />
                                                <span>Show the shortcuts bar</span>
                                            </label>
                                        </>
                                    )}

                                    {setPane === 'start' && (
                                        <>
                                            <label className="wf-set">
                                                <span>Start page</span>
                                                <input
                                                    type="text"
                                                    value={prefs.home}
                                                    placeholder="blank home screen"
                                                    spellCheck="false"
                                                    onChange={(e) => setPrefs(p => ({ ...p, home: e.target.value }))}
                                                    onBlur={() => setPrefs(p => sanitizePrefs(p))}
                                                />
                                            </label>
                                            <label className="wf-set">
                                                <span>Search with</span>
                                                <select value={prefs.engine} onChange={(e) => patchPrefs({ engine: e.target.value })}>
                                                    {ENGINES.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                                </select>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.newTabOpensHome} disabled={!prefs.home} onChange={(e) => patchPrefs({ newTabOpensHome: e.target.checked })} />
                                                <span>New tabs open the start page</span>
                                            </label>
                                            <p className="hint">
                                                Google, Bing and DuckDuckGo refuse to be embedded, so the list holds the
                                                engines that allow it. Leave the start page blank to land on the home screen.
                                            </p>
                                        </>
                                    )}

                                    {setPane === 'home' && (
                                        <>
                                            <label className="wf-set">
                                                <span>Wordmark</span>
                                                <input
                                                    type="text"
                                                    value={prefs.ntpTitle}
                                                    placeholder="blank for none"
                                                    maxLength={32}
                                                    onChange={(e) => patchPrefs({ ntpTitle: e.target.value })}
                                                />
                                            </label>
                                            <label className="wf-set">
                                                <span>Background image</span>
                                                <input
                                                    type="text"
                                                    value={prefs.newTabBg}
                                                    placeholder="https://… (blank for a gradient)"
                                                    spellCheck="false"
                                                    onChange={(e) => setPrefs(p => ({ ...p, newTabBg: e.target.value }))}
                                                    onBlur={() => setPrefs(p => sanitizePrefs(p))}
                                                />
                                            </label>
                                            <label className="wf-set">
                                                <span>Icon size</span>
                                                <select value={prefs.tileSize} onChange={(e) => patchPrefs({ tileSize: e.target.value })}>
                                                    <option value="small">Small</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="large">Large</option>
                                                </select>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.showNtpSearch} onChange={(e) => patchPrefs({ showNtpSearch: e.target.checked })} />
                                                <span>Search box on the home screen</span>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.showNtpNote} onChange={(e) => patchPrefs({ showNtpNote: e.target.checked })} />
                                                <span>Explanatory note at the bottom</span>
                                            </label>
                                        </>
                                    )}

                                    {setPane === 'marks' && (
                                        <div className="wf-set-list">
                                            <div className="wf-set-actions">
                                                <button type="button" className="btn ghost" onClick={bookmarkAllTabs}>Add all open tabs</button>
                                                <button type="button" className="btn ghost" onClick={exportBookmarks}>Copy as backup</button>
                                                <button type="button" className="btn ghost" onClick={importBookmarks} disabled={!marksIo.trim()}>Import from box</button>
                                            </div>
                                            <textarea
                                                className="wf-marks-io"
                                                value={marksIo}
                                                onChange={(e) => { setMarksIo(e.target.value); setMarksMsg('') }}
                                                placeholder="Backup text appears here — keep a copy, or paste one to restore."
                                                aria-label="Shortcut backup text"
                                                spellCheck="false"
                                                rows={3}
                                            />
                                            {marksMsg && <span className="hint" role="status">{marksMsg}</span>}
                                            {prefs.bookmarks.length === 0 && <span className="hint">None yet — use ☆ on a page, or the + tile on the home screen.</span>}
                                            {prefs.bookmarks.map((b, i) => (
                                                <div key={b.url} className="wf-set-row">
                                                    <Favicon url={b.url} className="wf-bm-fav" />
                                                    <input
                                                        type="text"
                                                        value={b.label}
                                                        aria-label={`Name for ${b.url}`}
                                                        onChange={(e) => setPrefs(p => ({
                                                            ...p,
                                                            bookmarks: p.bookmarks.map(x => (x.url === b.url ? { ...x, label: e.target.value } : x))
                                                        }))}
                                                        onBlur={() => setPrefs(p => sanitizePrefs(p))}
                                                    />
                                                    <button type="button" className="wf-icon" onClick={() => moveBookmark(b.url, -1)} disabled={i === 0} aria-label={`Move ${b.label} up`} title="Move up">↑</button>
                                                    <button type="button" className="wf-icon" onClick={() => moveBookmark(b.url, 1)} disabled={i === prefs.bookmarks.length - 1} aria-label={`Move ${b.label} down`} title="Move down">↓</button>
                                                    <button type="button" className="wf-icon" onClick={() => removeBookmark(b.url)} aria-label={`Remove ${b.label}`} title="Remove">×</button>
                                                </div>
                                            ))}
                                            <p className="hint">These are kept under their own key, so “Reset settings” never touches them.</p>
                                        </div>
                                    )}

                                    {setPane === 'privacy' && (
                                        <>
                                            <label className="wf-set">
                                                <span>Panic key</span>
                                                <input
                                                    type="text"
                                                    data-keycapture="1"
                                                    value={prefs.closeKey}
                                                    readOnly
                                                    aria-describedby="wf-panic-help"
                                                    onKeyDown={(e) => {
                                                        if (e.key.length !== 1) return
                                                        e.preventDefault()
                                                        patchPrefs({ closeKey: e.key })
                                                    }}
                                                />
                                            </label>
                                            <p className="hint" id="wf-panic-help">
                                                Press <kbd>{prefs.closeKey}</kbd> to close instantly. It works from the toolbar and
                                                tabs, but not once you click into the page itself — a framed site keeps its own keystrokes.
                                                {/^[a-z0-9]$/i.test(prefs.closeKey) && (
                                                    <> <b>Careful:</b> a letter or digit also fires while you type in the address bar.</>
                                                )}
                                            </p>
                                            <p className="hint">
                                                Open tabs and their history are saved as you browse and come back when you
                                                reopen. Logins and site data are the browser&apos;s own — a framed site keeps
                                                them only while your browser allows cookies inside an embedded page.
                                            </p>
                                            <div className="wf-set-actions">
                                                <button
                                                    type="button"
                                                    className="btn ghost"
                                                    onClick={() => {
                                                        const blank = makeTab(null)
                                                        setTabs([blank])
                                                        setActiveId(blank.id)
                                                        setInput('')
                                                        try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
                                                    }}
                                                >Forget open tabs</button>
                                                {/* shortcuts are deliberately spared — resetting is about appearance */}
                                                <button type="button" className="btn ghost" onClick={() => setPrefs({ ...DEFAULT_PREFS, bookmarks: prefs.bookmarks })}>Reset settings</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {blocked && (
                        <p className="wf-note" role="status">
                            <b>{hostOf(current)}</b> refuses to be embedded (X-Frame-Options), so it will stay blank — use <b>↗</b> to open it in a tab.
                        </p>
                    )}

                    <div className={`wf-stage${resizing ? ' is-resizing' : ''}`}>
                        {tabs.map(t => {
                            const u = urlOf(t)
                            if (!u) return null
                            return (
                                <iframe
                                    key={`${t.id}:${t.idx}:${t.nonce}:${u}`}
                                    className={`wf-frame${t.id === active.id ? '' : ' is-hidden'}`}
                                    src={u}
                                    title={`Web viewer tab ${tabLabel(u)}`}
                                    referrerPolicy="no-referrer"
                                    allow="fullscreen; clipboard-write"
                                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
                                />
                            )
                        })}

                        {!current && (
                            <div
                                className={`wf-ntp tile-${prefs.tileSize}${prefs.newTabBg ? ' has-bg' : ''}`}
                                style={prefs.newTabBg ? { backgroundImage: `url("${prefs.newTabBg}")` } : undefined}
                            >
                                <div className="wf-ntp-inner">
                                    {prefs.ntpTitle && <p className="wf-ntp-word">{prefs.ntpTitle}</p>}

                                    {prefs.showNtpSearch && (
                                        <form className="wf-ntp-search" onSubmit={submitNtp}>
                                            <span className="wf-ntp-icon" aria-hidden="true">⌕</span>
                                            <input
                                                ref={ntpRef}
                                                value={ntpQuery}
                                                onChange={(e) => setNtpQuery(e.target.value)}
                                                placeholder="Search the web"
                                                aria-label="Search the web"
                                                spellCheck="false"
                                                autoComplete="off"
                                            />
                                        </form>
                                    )}

                                    <div className="wf-tiles">
                                        {prefs.bookmarks.map(b => (
                                            <div key={b.url} className="wf-tile-wrap">
                                                <button type="button" className="wf-tile" onClick={() => go(b.url)} title={b.url}>
                                                    <span className="wf-tile-icon"><Favicon url={b.url} className="wf-tile-fav" /></span>
                                                    <span className="wf-tile-label">{b.label}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="wf-tile-x"
                                                    onClick={() => removeBookmark(b.url)}
                                                    aria-label={`Remove ${b.label}`}
                                                    title="Remove shortcut"
                                                >×</button>
                                            </div>
                                        ))}
                                        {prefs.bookmarks.length < MAX_BOOKMARKS && (
                                            <div className="wf-tile-wrap">
                                                <button
                                                    type="button"
                                                    className="wf-tile is-add"
                                                    onClick={() => setDraft(d => (d ? null : { label: '', url: '' }))}
                                                    aria-expanded={!!draft}
                                                    title="Add a shortcut"
                                                >
                                                    <span className="wf-tile-icon wf-tile-add">+</span>
                                                    <span className="wf-tile-label">Add</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {draft && (
                                        <form className="wf-draft" onSubmit={addShortcut}>
                                            <input
                                                autoFocus
                                                value={draft.url}
                                                onChange={(e) => setDraft(d => ({ ...d, url: e.target.value }))}
                                                placeholder="wikipedia.org"
                                                aria-label="Shortcut address"
                                                spellCheck="false"
                                                autoComplete="off"
                                            />
                                            <input
                                                value={draft.label}
                                                onChange={(e) => setDraft(d => ({ ...d, label: e.target.value }))}
                                                placeholder="Name (optional)"
                                                aria-label="Shortcut name"
                                                maxLength={40}
                                            />
                                            <button type="submit" className="btn" disabled={!draft.url.trim()}>Add</button>
                                            <button type="button" className="btn ghost" onClick={() => setDraft(null)}>Cancel</button>
                                        </form>
                                    )}

                                    {prefs.showNtpNote && (
                                        <p className="wf-ntp-note">
                                            Nothing here touches the page URL or your browser history. Sites that send
                                            X-Frame-Options (Google, YouTube, GitHub…) cannot be embedded by any page — open those with ↗.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {!maximized && !isFullscreen && (
                    <div className="wf-resize" onPointerDown={startResize} title="Drag to resize" aria-hidden="true" />
                )}
            </div>
        </div>
    )
}

export default WebFrame

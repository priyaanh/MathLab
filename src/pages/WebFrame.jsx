import { useEffect, useRef, useState } from 'react'
import {
    DEFAULT_PREFS, ENGINES, allEngines, bangFromName, MAX_BOOKMARKS, MAX_CLOSED, MAX_CUSTOM_ENGINES, MAX_RAIL, MAX_TABS, MIN_RAIL, clampRail,
    embedUrl, groupHistory, hostOf, hueFor, isBlocked, moveItem, pruneRetiredDefaults,
    rankSuggestions, readableOn, recordVisit, sanitizeBookmarks, sanitizeHistory, sanitizePrefs,
    exportBookmarksHTML, parseBookmarksHTML, pruneHistory, HISTORY_DAY_OPTS, GROUP_COLORS, groupedTabOrder, MAX_BOOKMARK_TAGS,
    sanitizePos, sanitizeSession, sanitizeZooms, searchTermOf, setZoomFor, stepZoom, tabLabel,
    tabTitle, topSites, toUrl, waybackUrl, withPinnedFirst, zoomFor,
    clampWindow, resizeBox, mergeSuggestions, parseOpenSearch, suggestUrl, rankPalette,
    sanitizeSavedSets, saveSet, removeSet, MAX_SAVED_SETS,
    sanitizeHostList, hostListed, toggleHost, sameLocation, greeting,
    packBackup, parseBackup, looksLikeMath, parsePercent, parseRadix
} from '../utils/webframe'
import { evaluateExpression, formatResult } from '../utils/mathUtils'
import { parseConversion } from '../utils/convert'
import { computeAnswer, parsePlot } from '../utils/answers'
import { qrMatrix, qrFits } from '../utils/qr'

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
const HISTORY_KEY = 'mathlab-frame-history'
const ZOOM_KEY = 'mathlab-frame-zoom'
const SAVED_KEY = 'mathlab-frame-saved'
const NOTE_KEY = 'mathlab-frame-note'
const MAX_NOTE = 10000
const POPUP_HOSTS_KEY = 'mathlab-frame-popup-hosts'
const POS_KEY = 'mathlab-frame-pos'
const READ_KEY = 'mathlab-frame-readlater'
const NOTES_KEY = 'mathlab-frame-notes'

/** The eight grips around the window, and the cursor each one wears. */
const GRIPS = [
    ['n', 'ns-resize'], ['s', 'ns-resize'], ['e', 'ew-resize'], ['w', 'ew-resize'],
    ['ne', 'nesw-resize'], ['sw', 'nesw-resize'], ['nw', 'nwse-resize'], ['se', 'nwse-resize']
]
const MIN_W = 520
const MIN_H = 360

/** Settings sections, one pane at a time so the popup never becomes a long scroll. */
const PANES = [
    { id: 'look', name: 'Appearance', icon: '◑' },
    { id: 'start', name: 'Start & search', icon: '⌂' },
    { id: 'home', name: 'Home screen', icon: '▦' },
    { id: 'marks', name: 'Shortcuts', icon: '★' },
    { id: 'sets', name: 'Tab sets', icon: '❏' },
    { id: 'privacy', name: 'Privacy', icon: '⚿' }
]

const ACCENTS = ['#2f6bff', '#7c5cff', '#00a8a8', '#12a150', '#f5a524', '#f05a4f', '#e05fa0', '#8a8f98']

/** Label only — the handler accepts either modifier regardless of platform. */
const MOD_LABEL = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform || '') ? '⌘' : 'Ctrl '

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

/** The viewer's own visited list — feeds address-bar suggestions, clearable in settings. */
const readHistory = () => {
    try { return sanitizeHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null')) } catch { return [] }
}

/** Where the window was left. null means "never moved", i.e. centred. */
const readPos = () => {
    try { return sanitizePos(JSON.parse(localStorage.getItem(POS_KEY) || 'null')) } catch { return null }
}

/** Per-site zoom levels, so a site you enlarged once opens enlarged next time. */
const readZooms = () => {
    try { return sanitizeZooms(JSON.parse(localStorage.getItem(ZOOM_KEY) || 'null')) } catch { return {} }
}

/** The new-tab scratchpad note — a plain string, capped so storage can't bloat. */
const readNote = () => {
    try { return String(localStorage.getItem(NOTE_KEY) || '').slice(0, MAX_NOTE) } catch { return '' }
}

/** Named tab sets the reader saved, newest first. */
const readSavedSets = () => {
    try { return sanitizeSavedSets(JSON.parse(localStorage.getItem(SAVED_KEY) || 'null')) } catch { return [] }
}

/** Hosts set to always open in a popup, overriding the global blocked-site default. */
const readPopupHosts = () => {
    try { return sanitizeHostList(JSON.parse(localStorage.getItem(POPUP_HOSTS_KEY) || 'null')) } catch { return [] }
}
// The read-later queue reuses the bookmark shape ({url,label}) and its sanitiser.
const readReadingList = () => {
    try { return sanitizeBookmarks(JSON.parse(localStorage.getItem(READ_KEY) || 'null')) } catch { return [] }
}
// Per-site notes: a plain map of host -> text, trimmed of empties on read.
const readSiteNotes = () => {
    try {
        const raw = JSON.parse(localStorage.getItem(NOTES_KEY) || 'null')
        if (!raw || typeof raw !== 'object') return {}
        const out = {}
        for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' && v.trim()) out[k] = v.slice(0, 4000)
        return out
    } catch { return {} }
}
// A salted SHA-256 of the lock PIN — so the plaintext isn't sitting in storage.
// (Client-side, so it deters a shoulder-surfer, not a determined attacker.)
const hashPin = async (pin) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mathlab-lumen:${pin}`))
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Each tab keeps its own history — a cross-origin frame's real history is unreadable.
let nextTabId = 1
let nextGroupId = 1
const makeTab = (url, opts = {}) => ({ id: nextTabId++, stack: url ? [url] : [], idx: url ? 0 : -1, nonce: 0, pinned: false, private: !!opts.private, groupId: null })
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

const WebFrame = ({ onClose, onOpenApp }) => {
    const [prefs, setPrefs] = useState(readPrefs)

    // Reopen exactly where we left off — tabs, their history and the front tab.
    const [restored] = useState(() => {
        const s = readSession()
        if (s) {
            const list = s.tabs.map(t => ({ id: nextTabId++, stack: t.stack, idx: t.idx, nonce: 0, pinned: t.pinned, private: false, groupId: null }))
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
    const [pos, setPos] = useState(readPos)
    const [maximized, setMaximized] = useState(false)
    const [mini, setMini] = useState(false) // picture-in-picture: shrink to a corner, page below stays usable
    const [locked, setLocked] = useState(false) // PIN lock screen shown
    const [pinEntry, setPinEntry] = useState('')
    const [pinMsg, setPinMsg] = useState('')
    const [pinSet, setPinSet] = useState('') // new-PIN field in settings
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [resizing, setResizing] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [setPane, setSetPane] = useState('look')
    const [railOpen, setRailOpen] = useState(true)
    const [marksIo, setMarksIo] = useState('')
    const [marksMsg, setMarksMsg] = useState('')
    const [tagFilter, setTagFilter] = useState([]) // active tag chips in the Shortcuts pane
    const [draft, setDraft] = useState(null) // the new-shortcut form on the home screen
    const [history, setHistory] = useState(readHistory)
    const [closed, setClosed] = useState([])   // reopenable tabs, newest first
    const [loading, setLoading] = useState({}) // tab id -> still fetching
    const [sugg, setSugg] = useState(-1)       // highlighted omnibox suggestion
    const [omniOpen, setOmniOpen] = useState(false)
    const [zooms, setZooms] = useState(readZooms)
    const [showHistory, setShowHistory] = useState(false)
    const [showOverview, setShowOverview] = useState(false)
    const [qrFor, setQrFor] = useState(null) // URL currently shown as a QR code, or null
    const [histQuery, setHistQuery] = useState('')
    const [menu, setMenu] = useState(null)      // tab context menu: { tabId, x, y }
    const [dragId, setDragId] = useState(null)  // tab being dragged along the strip
    const [bmDrag, setBmDrag] = useState(null)  // shortcut URL being dragged to reorder
    const [mru, setMru] = useState([])          // tab ids, most-recently-active first
    const [splitId, setSplitId] = useState(null) // tab shown in the right split pane, or null
    const [groups, setGroups] = useState([])     // tab groups: { id, name, color, collapsed } (this session only)
    const [editGroup, setEditGroup] = useState(null) // id of the group whose header is being edited
    const [awake, setAwake] = useState(false)   // screen wake lock requested?
    const [toast, setToast] = useState('')      // transient one-line confirmation
    const [articles, setArticles] = useState([]) // opt-in Wikipedia suggestions
    const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
    const [handedOff, setHandedOff] = useState('')  // last page sent to a real browser tab
    const [palette, setPalette] = useState(false)   // command palette (⌘/Ctrl+K)
    const [palQuery, setPalQuery] = useState('')
    const [palSel, setPalSel] = useState(0)
    const [savedSets, setSavedSets] = useState(readSavedSets)
    const [savedName, setSavedName] = useState('')  // name being typed in the Tab-sets pane
    const [popupHosts, setPopupHosts] = useState(readPopupHosts)
    const [readingList, setReadingList] = useState(readReadingList)
    const [siteNotes, setSiteNotes] = useState(readSiteNotes)
    const [notesOpen, setNotesOpen] = useState(false)
    const [clock, setClock] = useState(() => Date.now())  // ticks only on the new-tab page
    const [note, setNote] = useState(readNote)            // new-tab scratchpad
    const [backupIo, setBackupIo] = useState('')
    const [backupMsg, setBackupMsg] = useState('')
    const [engineName, setEngineName] = useState('')  // add-a-search-engine form
    const [engineUrl, setEngineUrl] = useState('')
    const [engineMsg, setEngineMsg] = useState('')

    const shellRef = useRef(null)
    const urlRef = useRef(null)
    const ntpRef = useRef(null)
    const histRef = useRef(null)
    const palRef = useRef(null)
    const restoreSize = useRef(null)
    const liveIdsRef = useRef(new Set())   // which tabs are currently mounted (awake)
    const wakeRef = useRef(null)           // the Screen Wake Lock sentinel, while held
    const toastTimer = useRef(null)
    const focusTab = useRef(null)     // tab the arrow keys moved to, focused after the render
    const panelRef = useRef(null)
    const menuRef = useRef(null)

    /**
     * A one-line confirmation for things that used to happen (or refuse to happen)
     * in silence: a bookmark that was already saved, a tab limit reached, a zoom
     * step. Announced politely, so a screen reader hears it without losing focus.
     */
    const say = (message) => {
        setToast(message)
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(''), 2600)
    }
    useEffect(() => () => clearTimeout(toastTimer.current), [])

    const active = tabs.find(t => t.id === activeId) || tabs[0]
    const current = urlOf(active)

    // Split view: a second tab shown side-by-side on the right. The toolbar always
    // drives the active (left) tab; the right pane is `splitId`. A tab can't split
    // with itself, so an active/split collision just turns the split off.
    const splitTab = splitId != null ? tabs.find(t => t.id === splitId) : null
    const splitActive = !!splitTab && splitTab.id !== (active?.id)
    const splitUrl = splitTab ? urlOf(splitTab) : null

    /*
     * Tab discarding. Every mounted iframe is a live site eating memory, so only
     * the active tab and the few most-recently-used ones keep their frame; the
     * rest sleep — their iframe leaves the DOM and remounts (reloads) when picked
     * again. `mru` is the recency order; the active tab is always awake. Turned
     * off, every tab stays mounted as before.
     */
    const LIVE_TABS = 6
    const liveIds = (() => {
        if (!prefs.sleepTabs) return new Set(tabs.map(t => t.id))
        const order = [activeId, ...mru].filter((id, i, a) => a.indexOf(id) === i && tabs.some(t => t.id === id))
        const live = new Set(order.slice(0, LIVE_TABS))
        if (splitActive) live.add(splitId) // the split pane must stay mounted
        return live
    })()
    liveIdsRef.current = liveIds   // so selectTab can tell if a tab needs remounting
    // Blocked only when there is no official embed to fall back on.
    const blocked = isBlocked(current)

    const patchActive = (fn) => setTabs(ts => ts.map(t => (t.id === active.id ? fn(t) : t)))
    const patchPrefs = (patch) => setPrefs(p => sanitizePrefs({ ...p, ...patch }))

    // Built-in search engines plus the reader's own, for the address bar and the
    // engine picker. Recomputed from prefs, so an added engine is usable at once.
    const engines = allEngines(prefs.customEngines)
    const search = (text) => toUrl(text, prefs.engine, engines)

    /*
     * Screen wake lock — an honest "don't let the display dim" toggle, the same
     * one video sites use. It keeps the screen on only while this window is the
     * visible foreground (the browser drops the lock when the tab is hidden, so
     * a visibility handler re-takes it). It fakes no input and cannot keep the
     * whole machine awake if you switch away — for that, the OS settings are the
     * tool. It does not, and is not meant to, affect any game's idle check.
     */
    const wakeSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
    const setWake = async (on) => {
        setAwake(on)
        if (!on) {
            try { await wakeRef.current?.release() } catch { /* already gone */ }
            wakeRef.current = null
            say('The screen can sleep again')
            return
        }
        try {
            const lock = await navigator.wakeLock.request('screen')
            wakeRef.current = lock
            lock.addEventListener?.('release', () => { wakeRef.current = null })
            say('Screen will stay awake while Lumen is in front')
        } catch {
            setAwake(false)
            say('This browser wouldn’t grant a screen wake lock here.')
        }
    }

    /*
     * Page zoom. A cross-origin frame's own zoom is out of reach, so the frame
     * element is scaled and given the inverse size — the page then lays itself
     * out at the larger width and reflows properly, rather than being magnified
     * like a picture. Kept per host, the way a browser keeps it.
     */
    const zoom = zoomFor(zooms, current)
    const setZoom = (level) => {
        if (!current) return
        setZooms(z => setZoomFor(z, current, level))
        say(`${hostOf(current).replace(/^www\./, '')} at ${Math.round(level * 100)}%`)
    }
    const bumpZoom = (dir) => { if (current) setZoom(stepZoom(zoom, dir)) }

    // What the address bar offers while typing. Hidden once the text is exactly
    // the page already open, so it cannot cover the page with a single result.
    // Address-bar calculator + unit conversion: when what's typed computes to
    // something, offer the answer as the top row — this is a maths lab's browser.
    const compute = (() => {
        const t = input.trim()
        if (!omniOpen || t === current) return null
        // percentages first, so "200 + 15%" means "add 15%" not a modulo sum
        const pct = parsePercent(t)
        if (pct && Number.isFinite(pct.value)) return { kind: 'calc', url: `calc:${t}`, expr: pct.expr, result: formatResult(pct.value) }
        if (looksLikeMath(t)) {
            try {
                const v = evaluateExpression(t)
                if (Number.isFinite(v)) return { kind: 'calc', url: `calc:${t}`, expr: t, result: formatResult(v) }
            } catch { /* not a sum after all — fall through */ }
        }
        const radix = parseRadix(t)
        if (radix) return { kind: 'calc', url: `radix:${t}`, expr: radix.expr, result: radix.result }
        const conv = parseConversion(t)
        if (conv) return { kind: 'convert', url: `convert:${t}`, expr: `${conv.value} ${conv.from}`, result: conv.text }
        // number theory, bases, roman, colours, dates, constants — a maths lab's answers
        const ans = computeAnswer(t)
        if (ans) return { ...ans, url: `answer:${t}` }
        // "plot sin(x)" hands the expression to the full-page grapher instead of copying
        const plot = onOpenApp && parsePlot(t)
        if (plot) return { kind: 'plot', url: `plot:${t}`, expr: plot.expr, to: `/graph?fn=${encodeURIComponent(plot.expr)}` }
        return null
    })()

    const suggestions = omniOpen && input.trim() && input !== current
        ? [
            ...(compute ? [compute] : []),
            ...mergeSuggestions(
                rankSuggestions(input, {
                    bookmarks: prefs.bookmarks,
                    history,
                    // a page already open is offered as "switch to it", not as a copy
                    open: tabs.filter(t => t.id !== active.id && urlOf(t)).map(t => ({ id: t.id, url: urlOf(t) }))
                }, 5),
                articles
            )
        ]
        : []

    const copyText = (text, label) => {
        navigator.clipboard?.writeText(text).then(
            () => say(label || `Copied ${text}`),
            () => say('Could not reach the clipboard')
        )
    }

    /** A suggestion row: copy a computed answer, raise a tab, or open a page. */
    const chooseSuggestion = (s) => {
        if (!s) return
        if (s.kind === 'calc' || s.kind === 'convert') { copyText(s.result, `Copied ${s.result}`); setOmniOpen(false); setSugg(-1); return }
        if (s.kind === 'plot') { onOpenApp?.(s.to); setOmniOpen(false); setSugg(-1); return }
        if (s.kind === 'tab') { selectTab(s.tabId); setOmniOpen(false); setSugg(-1); return }
        go(s.url)
    }

    /* ---- navigation ---- */

    /**
     * Claim a tab is loading only when something will actually load. A page that
     * refuses framing renders no iframe at all, so nothing would ever fire `load`
     * and the spinner span the full fifteen seconds before the bail-out timer
     * caught it — over a screen that had already finished saying "this won't open".
     */
    const startLoad = (id, url) => setLoading(l => (
        !url || isBlocked(url) ? { ...l, [id]: false } : { ...l, [id]: true }
    ))

    /**
     * Hand a page to a real browser tab. Returns false if the popup blocker took
     * it, so the caller can leave the explanation standing rather than claim
     * something happened that didn't.
     *
     * window.open only succeeds while a user gesture is being handled, which is
     * true of every route in here — a typed address, a shortcut, a suggestion, a
     * tile. The opener is severed afterwards rather than by passing "noopener" in
     * the features string, because that form is specified to return null: the new
     * tab opens either way, but the caller can no longer tell whether it did, and
     * then says "opened in a new browser tab" over a popup that was blocked.
     * Clearing .opener gives the same protection — the page cannot reach back and
     * navigate this window — at the cost of sending a referrer, which for a tab
     * the reader deliberately asked for is no secret.
     */
    const openExternally = (url) => {
        try {
            const opened = window.open(url, '_blank')
            if (!opened) return false
            opened.opener = null
            return true
        } catch { return false }
    }

    /**
     * Open a page as its own centered window at ~80% of the screen. A popup is a
     * top-level browsing context, so a site that refuses *framing* opens here
     * normally — this is the live page reached the ordinary way, not a proxy or a
     * copy. Returns false if the popup blocker took it, so the caller can leave
     * the blocked screen standing rather than claim something opened.
     */
    const openPopup = (url) => {
        try {
            const s = window.screen
            const sw = s.availWidth || 1200
            const sh = s.availHeight || 800
            const w = Math.round(sw * 0.8)
            const h = Math.round(sh * 0.8)
            const left = (s.availLeft ?? 0) + Math.round((sw - w) / 2)
            const top = (s.availTop ?? 0) + Math.round((sh - h) / 2)
            const win = window.open(url, '_blank', `popup,width=${w},height=${h},left=${left},top=${top}`)
            if (!win) return false
            win.opener = null   // sever the handle back to this page
            return true
        } catch { return false }
    }

    const go = (url) => {
        if (!url) return
        /*
         * Typing "apple.com" is a request to go to Apple, not to be told that
         * Apple declines to be framed. What happens instead is the reader's
         * choice, because the two honest answers trade against each other: the
         * archive stays inside the viewer but shows a copy, and a browser tab is
         * the live page but leaves. See BLOCKED_CHOICES.
         */
        let target = url
        let sentOut = false
        if (isBlocked(url)) {
            // a per-site "always popup" rule wins over the global default for that host
            const mode = hostListed(popupHosts, url) ? 'popup' : prefs.onBlocked
            const archived = mode === 'archive' ? waybackUrl(url) : null
            if (archived) {
                // the address bar will show the archive, which is the truth of what
                // is on screen — a snapshot, not the site
                target = archived
                say(`${tabLabel(url)} can't be embedded — showing the archived copy`)
            } else if ((mode === 'popup' || mode === 'tab') && !prefs.confirmOpen) {
                // "open immediately" — the default. With confirmOpen on we skip this
                // and let the blocked screen ask first, its buttons being the answer.
                sentOut = mode === 'popup' ? openPopup(url) : openExternally(url)
                if (sentOut) say(`${tabLabel(url)} can't be embedded — opened ${mode === 'popup' ? 'in a popup window' : 'in a new browser tab'}`)
            }
        }
        setHandedOff(sentOut ? target : '')

        patchActive(t => ({ ...t, stack: [...t.stack.slice(0, t.idx + 1), target], idx: t.idx + 1 }))
        setInput(target)
        setNtpQuery('')
        setOmniOpen(false)
        setSugg(-1)
        startLoad(active.id, target)
        if (!active.private) setHistory(h => recordVisit(h, target, Date.now()))
    }
    const submit = (e) => {
        e.preventDefault()
        // Enter takes the highlighted suggestion when one is picked, the way an
        // address bar does; otherwise it treats the text as typed.
        const chosen = sugg >= 0 && suggestions[sugg]
        if (chosen) { chooseSuggestion(chosen); return }
        // A bare Enter on a pure calculation or conversion copies the answer
        // rather than web-searching it — you almost never want to search "2+2".
        if (compute) { chooseSuggestion(compute); return }
        go(search(input))
    }
    const submitNtp = (e) => { e.preventDefault(); go(search(ntpQuery)) }
    const back = () => {
        if (active.idx <= 0) return
        setHandedOff('')  // the hand-off notice belongs to that one navigation
        patchActive(t => ({ ...t, idx: t.idx - 1 }))
        setInput(active.stack[active.idx - 1])
        startLoad(active.id, active.stack[active.idx - 1])
    }
    const forward = () => {
        if (active.idx >= active.stack.length - 1) return
        setHandedOff('')
        patchActive(t => ({ ...t, idx: t.idx + 1 }))
        setInput(active.stack[active.idx + 1])
        startLoad(active.id, active.stack[active.idx + 1])
    }
    const reload = () => {
        if (!current) return
        patchActive(t => ({ ...t, nonce: t.nonce + 1 }))
        startLoad(active.id, current)
    }

    /* ---- tabs ---- */
    const openTab = (url, opts = {}) => {
        if (tabs.length >= MAX_TABS) { say(`${MAX_TABS} tabs is the limit — close one first.`); return }
        // A private tab starts blank — the point is to leave no trail, so it
        // doesn't open the start page either, and its visits skip history.
        const tab = makeTab(url ?? (prefs.newTabOpensHome && !opts.private ? prefs.home : null), opts)
        setTabs(ts => [...ts, tab])
        setActiveId(tab.id)
        setInput(urlOf(tab) || '')
        setNtpQuery('')
        if (opts.private) say('Private tab — this tab’s pages won’t be saved to history')
    }

    /** Open somewhere in a new tab without leaving this one — ⌘/middle-click. */
    const openInBackground = (url) => {
        if (!url) return
        // a viewer tab that could only ever show the "won't embed" screen is not
        // worth spending one of twelve on
        let target = url
        if (isBlocked(url)) {
            const mode = hostListed(popupHosts, url) ? 'popup' : prefs.onBlocked
            const archived = mode === 'archive' ? waybackUrl(url) : null
            if (archived) target = archived
            else if ((mode === 'popup' || mode === 'tab') && !prefs.confirmOpen) {
                const opened = mode === 'popup' ? openPopup(url) : openExternally(url)
                if (opened) {
                    say(`${tabLabel(url)} can't be embedded — opened ${mode === 'popup' ? 'in a popup window' : 'in a new browser tab'}`)
                    if (!active.private) setHistory(h => recordVisit(h, url, Date.now()))
                    return
                }
            }
        }
        if (tabs.length >= MAX_TABS) { say(`${MAX_TABS} tabs is the limit — close one first.`); return }
        // A link opened from a private tab stays private, like every browser.
        const tab = makeTab(target, { private: active.private })
        setTabs(ts => [...ts, tab])
        // With discarding on, a background tab stays asleep until viewed, so don't
        // start a spinner on a frame that won't mount — it loads when selected.
        if (!prefs.sleepTabs) startLoad(tab.id, target)
        if (!active.private) setHistory(h => recordVisit(h, target, Date.now()))
        say(`Opened ${tabLabel(url)} in a new tab`)
    }

    /**
     * Open a place, or jump to the tab already showing it. This is what a bookmark,
     * a home tile or a palette entry should do — clicking one you already have open
     * shouldn't load a second copy. The address bar keeps using go(): typing a URL
     * means "take this tab there", not "hunt for it elsewhere".
     */
    const openOrSwitch = (url) => {
        if (!url) return
        const existing = tabs.find(t => { const u = urlOf(t); return u && sameLocation(u, url) })
        if (existing) {
            if (existing.id !== active.id) { selectTab(existing.id); say(`Switched to ${tabLabel(url)}`) }
            return
        }
        go(url)
    }

    const selectTab = (id) => {
        const tab = tabs.find(t => t.id === id)
        if (!tab) return
        // A sleeping tab has no frame in the DOM; selecting it remounts and reloads,
        // so show the spinner while that happens.
        const u = urlOf(tab)
        if (u && !liveIdsRef.current.has(id)) startLoad(id, u)
        setActiveId(id)
        setInput(u || '')
    }

    /* ---- split view ---- */
    // Split the current tab with a partner on the right: the most recent other
    // tab, else the next one along. Toggles off when already split.
    const toggleSplit = () => {
        if (splitActive) { setSplitId(null); say('Split view off'); return }
        const partner = mru.find(id => id !== active.id && tabs.some(t => t.id === id))
            ?? tabs.find(t => t.id !== active.id)?.id
        if (partner == null) { say('Open another tab to split the view.'); return }
        setSplitId(partner)
        say('Split view — the toolbar drives the left pane')
    }
    // Swap which side the toolbar drives, keeping both pages on screen.
    const swapSplit = () => {
        if (!splitActive) return
        const other = splitId
        setSplitId(active.id)
        setActiveId(other)
        setInput(urlOf(tabs.find(t => t.id === other)) || '')
    }
    // A tab can never split with itself: if the active tab becomes the split tab,
    // drop the split rather than show the same page twice.
    useEffect(() => { if (splitId != null && splitId === activeId) setSplitId(null) }, [activeId, splitId])

    /* ---- tab groups (this session only) ---- */
    const setTabGroup = (tabId, groupId) =>
        setTabs(ts => ts.map(t => (t.id === tabId ? { ...t, groupId, pinned: groupId ? false : t.pinned } : t)))
    // New group seeded with one tab; colour cycles through the palette.
    const groupTab = (tabId) => {
        const id = nextGroupId++
        const color = GROUP_COLORS[groups.length % GROUP_COLORS.length]
        setGroups(gs => [...gs, { id, name: `Group ${gs.length + 1}`, color, collapsed: false }])
        setTabGroup(tabId, id)
        setEditGroup(id) // open the rename/colour editor straight away
    }
    const ungroupTab = (tabId) => setTabGroup(tabId, null)
    const renameGroup = (id, name) => setGroups(gs => gs.map(g => (g.id === id ? { ...g, name: name.slice(0, 24) } : g)))
    const recolorGroup = (id, color) => setGroups(gs => gs.map(g => (g.id === id ? { ...g, color } : g)))
    const toggleGroupCollapse = (id) => setGroups(gs => gs.map(g => (g.id === id ? { ...g, collapsed: !g.collapsed } : g)))
    // Deleting a group frees its tabs; they stay open, just ungrouped.
    const deleteGroup = (id) => {
        setTabs(ts => ts.map(t => (t.groupId === id ? { ...t, groupId: null } : t)))
        setGroups(gs => gs.filter(g => g.id !== id))
    }
    // Drop groups that have lost all their members (e.g. every tab closed).
    useEffect(() => {
        setGroups(gs => gs.filter(g => tabs.some(t => t.groupId === g.id)))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs])

    const closeTab = (id) => {
        if (tabs.length <= 1) { onClose?.(); return } // last tab closes the viewer, like Chrome
        if (id === splitId) setSplitId(null) // closing the split pane ends the split
        const i = tabs.findIndex(t => t.id === id)
        const victim = tabs[i]
        const rest = tabs.filter(t => t.id !== id)
        // Remember it so Cmd/Ctrl+Shift+T can bring it back with its history — but
        // never a private tab, whose whole point is to leave no trail to reopen.
        if (victim && urlOf(victim) && !victim.private) {
            setClosed(c => [{ stack: victim.stack, idx: victim.idx, at: i }, ...c].slice(0, MAX_CLOSED))
        }
        setTabs(rest)
        if (id === active.id) {
            const next = rest[Math.min(i, rest.length - 1)]
            setActiveId(next.id)
            setInput(urlOf(next) || '')
        }
    }

    /** Chrome's reopen-closed-tab, restoring position and back/forward history. */
    const reopenAt = (i) => {
        const entry = closed[i]
        if (!entry) { say('No recently closed tabs.'); return }
        if (tabs.length >= MAX_TABS) { say(`${MAX_TABS} tabs is the limit — close one first.`); return }
        const tab = { id: nextTabId++, stack: entry.stack, idx: entry.idx, nonce: 0, pinned: false, private: false, groupId: null }
        setClosed(c => c.filter((_, j) => j !== i))
        setTabs(ts => {
            const at = Math.min(Math.max(entry.at, 0), ts.length)
            return withPinnedFirst([...ts.slice(0, at), tab, ...ts.slice(at)])
        })
        setActiveId(tab.id)
        setInput(urlOf(tab) || '')
        startLoad(tab.id, urlOf(tab))
    }
    const reopenClosed = () => reopenAt(0)

    /** Same page, its own history going forward — handy for branching a search. */
    const duplicateTab = (id) => {
        const src = tabs.find(t => t.id === id)
        if (!src || !urlOf(src)) return
        if (tabs.length >= MAX_TABS) { say(`${MAX_TABS} tabs is the limit — close one first.`); return }
        // the copy is never pinned, so it has to fall out of the pinned block; it
        // keeps the source's private flag and group so a duplicate isn't a downgrade
        const tab = { id: nextTabId++, stack: [...src.stack], idx: src.idx, nonce: 0, pinned: false, private: !!src.private, groupId: src.groupId ?? null }
        const at = tabs.findIndex(t => t.id === id) + 1
        setTabs(ts => withPinnedFirst([...ts.slice(0, at), tab, ...ts.slice(at)]))
        setActiveId(tab.id)
        setInput(urlOf(tab) || '')
        startLoad(tab.id, urlOf(tab))
    }

    /** Move to the next/previous tab, wrapping like Ctrl+Tab does. */
    const cycleTab = (delta) => {
        if (tabs.length < 2) return
        const i = tabs.findIndex(t => t.id === active.id)
        selectTab(tabs[(i + delta + tabs.length) % tabs.length].id)
    }

    /**
     * Pinning keeps a tab you keep coming back to at the front of the rail, shrunk
     * to its icon and without a close button, so it survives a run of ⌘W.
     */
    const togglePin = (id) => {
        const tab = tabs.find(t => t.id === id)
        if (!tab || !urlOf(tab)) return
        setTabs(ts => withPinnedFirst(ts.map(t => (t.id === id ? { ...t, pinned: !t.pinned } : t))))
        say(tab.pinned ? `Unpinned ${tabLabel(urlOf(tab))}` : `Pinned ${tabLabel(urlOf(tab))}`)
    }

    /** Clearing the decks around one tab. Pinned tabs are spared, as in Chrome. */
    const closeOthers = (id) => {
        const keep = tabs.filter(t => t.id === id || t.pinned)
        if (keep.length === tabs.length) return
        setClosed(c => [
            // `at` is where the tab sat in the strip, so reopening puts it back there
            ...tabs.filter(t => !keep.includes(t) && urlOf(t)).map(t => ({ stack: t.stack, idx: t.idx, at: tabs.indexOf(t) })),
            ...c
        ].slice(0, MAX_CLOSED))
        setTabs(keep)
        setActiveId(id)
        setInput(urlOf(tabs.find(t => t.id === id)) || '')
    }

    const closeToRight = (id) => {
        const i = tabs.findIndex(t => t.id === id)
        if (i < 0) return
        const doomed = tabs.slice(i + 1).filter(t => !t.pinned)
        if (!doomed.length) return
        setClosed(c => [
            ...doomed.filter(t => urlOf(t)).map(t => ({ stack: t.stack, idx: t.idx, at: tabs.indexOf(t) })),
            ...c
        ].slice(0, MAX_CLOSED))
        const rest = tabs.filter(t => !doomed.includes(t))
        setTabs(rest)
        if (doomed.some(t => t.id === active.id)) { setActiveId(id); setInput(urlOf(tabs[i]) || '') }
    }

    /** Drag a tab onto another to reorder. Pinned tabs stay in their own block. */
    const dropOnTab = (targetId) => {
        const from = tabs.findIndex(t => t.id === dragId)
        const to = tabs.findIndex(t => t.id === targetId)
        setDragId(null)
        if (from < 0 || to < 0 || from === to) return
        setTabs(ts => withPinnedFirst(moveItem(ts, from, to)))
    }

    const copyAddress = (url) => {
        if (!url) return
        navigator.clipboard?.writeText(url).then(
            () => say('Address copied'),
            () => say('Could not reach the clipboard')
        )
    }

    /*
     * Article suggestions, only when asked for. Debounced so a burst of typing is
     * one request rather than eight, and the previous request is aborted the
     * moment the text changes — a reply for "pyth" arriving after one for "pytha"
     * would otherwise overwrite the better answer with the worse one.
     *
     * Anything that already looks like an address is not sent: someone typing a
     * URL has not asked an encyclopedia anything.
     */
    const wantsArticles = prefs.webSuggest && omniOpen && !!input.trim() && input !== current
        && !/^https?:\/\//i.test(input.trim())
        && !/^[^\s/]+\.[a-z]{2,}([/?#]|$)/i.test(input.trim())

    useEffect(() => {
        if (!wantsArticles) {
            setArticles(a => (a.length ? [] : a))  // the same empty list, not a new one per keystroke
            return undefined
        }
        const controller = new AbortController()
        const timer = setTimeout(() => {
            fetch(suggestUrl(input), { signal: controller.signal, referrerPolicy: 'no-referrer' })
                .then(r => (r.ok ? r.json() : null))
                .then(json => setArticles(parseOpenSearch(json, 4)))
                // an aborted or failed lookup simply leaves the local rows standing
                .catch(() => { if (!controller.signal.aborted) setArticles([]) })
        }, 180)
        // React runs this before the next pass, so the in-flight request is always
        // the one for the text now in the box
        return () => { clearTimeout(timer); controller.abort() }
    }, [wantsArticles, input])

    /* ---- persistence ---- */
    useEffect(() => {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
    }, [prefs])

    useEffect(() => {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch { /* ignore */ }
    }, [history])

    useEffect(() => {
        try { localStorage.setItem(ZOOM_KEY, JSON.stringify(zooms)) } catch { /* ignore */ }
    }, [zooms])

    useEffect(() => {
        try { localStorage.setItem(SAVED_KEY, JSON.stringify(savedSets)) } catch { /* ignore */ }
    }, [savedSets])

    useEffect(() => {
        try {
            if (note) localStorage.setItem(NOTE_KEY, note)
            else localStorage.removeItem(NOTE_KEY)
        } catch { /* ignore */ }
    }, [note])

    useEffect(() => {
        try { localStorage.setItem(POPUP_HOSTS_KEY, JSON.stringify(popupHosts)) } catch { /* ignore */ }
    }, [popupHosts])

    useEffect(() => {
        try { localStorage.setItem(READ_KEY, JSON.stringify(readingList)) } catch { /* ignore */ }
    }, [readingList])

    useEffect(() => {
        try { localStorage.setItem(NOTES_KEY, JSON.stringify(siteNotes)) } catch { /* ignore */ }
    }, [siteNotes])

    /*
     * A frame that never fires load — blocked, hung, offline — would otherwise
     * leave the bar animating forever. Give up after a while and just stop
     * claiming it is still working.
     */
    useEffect(() => {
        if (!Object.values(loading).some(Boolean)) return undefined
        const timer = setTimeout(() => setLoading({}), 15000)
        return () => clearTimeout(timer)
    }, [loading])

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

    useEffect(() => {
        try {
            if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos))
            else localStorage.removeItem(POS_KEY)
        } catch { /* ignore */ }
    }, [pos])

    /*
     * A window parked at the right edge of a wide screen would be off-screen
     * entirely in a narrow one, and the only handle for dragging it back is the
     * toolbar. So every viewport change pulls it into reach again.
     */
    useEffect(() => {
        if (!pos) return undefined
        const onResize = () => setPos(p => (p ? clampWindow(p, size, { width: window.innerWidth, height: window.innerHeight }) : p))
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [pos, size])

    // Saved on every change, so closing with the panic key never loses the session.
    useEffect(() => {
        try {
            // Private tabs are ephemeral — they never touch the restored session.
            const persistable = tabs.filter(t => !t.private)
            const payload = {
                tabs: persistable.map(t => ({ stack: t.stack, idx: t.idx, pinned: t.pinned })),
                active: Math.max(0, persistable.findIndex(t => t.id === activeId))
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
            // The settings field that records a key takes every keystroke as data —
            // except Escape, which has to keep working or the dialog it lives in
            // cannot be dismissed from that field at all.
            if (e.target?.dataset?.keycapture && e.key !== 'Escape') return

            /*
             * While the command palette is open it owns the keyboard: Esc or the
             * same Cmd/Ctrl+K closes it, and everything else (typing, the arrow
             * keys, Enter) is left for its own input to handle. Returning without
             * preventDefault lets those keys reach the field; this also keeps the
             * panic key from firing on a stray backtick typed into the palette.
             */
            if (palette) {
                if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
                    e.preventDefault(); e.stopPropagation(); closePalette()
                }
                return
            }

            /*
             * The usual browser shortcuts. Cmd on a Mac, Ctrl elsewhere; the
             * browser's own Cmd+T/W would act on the real tab, so these are
             * captured and stopped before it sees them. They only reach us while
             * focus is outside the frame — a cross-origin page keeps its keys.
             */
            // While locked, the shortcut set is frozen — only the panic key and Esc
            // below still act (both close the viewer), so nothing edits tabs behind
            // the lock screen.
            const mod = e.metaKey || e.ctrlKey
            if (mod && !e.altKey && !locked) {
                const k = e.key.toLowerCase()
                const take = () => { e.preventDefault(); e.stopPropagation() }

                if (k === 't' && e.shiftKey) { take(); reopenClosed(); return }
                if (k === 't') { take(); openTab(); return }
                if (k === 'n' && e.shiftKey) { take(); openTab(null, { private: true }); return }
                if (k === 'w') {
                    take()
                    // pinning exists to survive exactly this; the tab menu is the
                    // deliberate way out
                    if (active.pinned) say('That tab is pinned — unpin it to close it.')
                    else closeTab(active.id)
                    return
                }
                if (k === 'l') { take(); urlRef.current?.focus(); urlRef.current?.select(); return }
                if (k === 'r') { take(); reload(); return }
                if (k === 'd') { take(); bookmarkCurrent(); return }
                if (k === 'arrowleft' || (k === '[' && e.shiftKey === false)) { take(); back(); return }
                if (k === 'arrowright' || k === ']') { take(); forward(); return }
                if (k === 'y') { take(); setShowSettings(false); setShowHistory(h => !h); return }
                if (k === '\\') { take(); toggleSplit(); return }
                if (k === 'e' && e.shiftKey) { take(); setShowOverview(o => !o); return }
                if (k === 'k') { take(); openPalette(); return }
                // Zoom. '+' and '=' share a key, and which one arrives depends on
                // the layout and whether Shift is down, so both mean "in".
                if (k === '=' || k === '+') { take(); bumpZoom(1); return }
                if (k === '-' || k === '_') { take(); bumpZoom(-1); return }
                if (k === '0') { take(); setZoom(1); return }
                // Cmd/Ctrl+1..8 jump to that tab, 9 jumps to the last one.
                if (/^[1-9]$/.test(e.key)) {
                    take()
                    const n = Number(e.key)
                    const target = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1]
                    if (target) selectTab(target.id)
                    return
                }
            }
            // Ctrl+Tab cycles even on a Mac, matching every browser.
            if (e.ctrlKey && e.key === 'Tab' && !locked) {
                e.preventDefault(); e.stopPropagation()
                cycleTab(e.shiftKey ? -1 : 1)
                return
            }

            /*
             * The panic key fires from anywhere in the viewer, text boxes included.
             *
             * Exempting text boxes was tried and is worse: the viewer focuses a search
             * box the moment it opens — on purpose, so keystrokes reach neither the
             * framed page nor the site's own secret-code listener — so the exemption
             * silently disabled the key at exactly the moment it is most wanted. The
             * cost is that a key you also need to type is a poor choice, which is what
             * the warning under the setting says.
             */
            if (e.key === prefs.closeKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault()
                e.stopPropagation()
                if (document.fullscreenElement) document.exitFullscreen?.().catch(() => { /* ignore */ })
                onClose?.()
                return
            }
            if (e.key === 'Escape' && !document.fullscreenElement) {
                // Peel back one layer at a time rather than closing outright.
                if (menu) { setMenu(null); return }
                if (omniOpen) { setOmniOpen(false); setSugg(-1); return }
                if (qrFor) { setQrFor(null); return }
                if (showOverview) { setShowOverview(false); return }
                if (showHistory) { setShowHistory(false); return }
                if (showSettings) { setShowSettings(false); return }
                onClose?.()
            }
        }
        window.addEventListener('keydown', onKey, { capture: true })
        return () => window.removeEventListener('keydown', onKey, { capture: true })
        // Deliberately no dependency array: the handler reads tabs, the active
        // tab, the closed stack and both overlay flags. Listing them all would be
        // the same rebinding with more ways to forget one and act on stale state.
    })

    /*
     * Whatever was focused before the viewer opened gets focus back when it closes.
     * Without this, closing drops the caret at the top of the document and a
     * keyboard user has to tab back down to where they were.
     *
     * This has to be declared above the effect that focuses the search box, since
     * effects run in order: reversed, it captured the viewer's own input and then
     * "restored" focus to a node that had already left the DOM.
     */
    useEffect(() => {
        const opener = document.activeElement
        return () => { try { opener?.focus?.() } catch { /* gone from the DOM */ } }
    }, [])

    useEffect(() => { (ntpRef.current || urlRef.current)?.focus() }, [])

    /*
     * Losing the network mid-session leaves a frame that simply stops painting.
     * Saying so beats letting someone conclude the viewer broke.
     */
    useEffect(() => {
        const on = () => setOffline(false)
        const off = () => setOffline(true)
        window.addEventListener('online', on)
        window.addEventListener('offline', off)
        return () => {
            window.removeEventListener('online', on)
            window.removeEventListener('offline', off)
        }
    }, [])

    /** The tab context menu closes on any click elsewhere, as menus do. */
    useEffect(() => {
        if (!menu) return undefined
        const shut = () => setMenu(null)
        window.addEventListener('pointerdown', shut)
        window.addEventListener('resize', shut)
        return () => {
            window.removeEventListener('pointerdown', shut)
            window.removeEventListener('resize', shut)
        }
    }, [menu])

    /** The group-header editor closes on a click outside it (it stops its own). */
    useEffect(() => {
        if (editGroup == null) return undefined
        const shut = () => setEditGroup(null)
        window.addEventListener('pointerdown', shut)
        return () => window.removeEventListener('pointerdown', shut)
    }, [editGroup])

    /** The notes popover closes on a click outside it, like a menu. */
    useEffect(() => {
        if (!notesOpen) return undefined
        const shut = (e) => { if (!e.target.closest?.('.wf-notes, [aria-label="Note for this site"]')) setNotesOpen(false) }
        window.addEventListener('pointerdown', shut)
        return () => window.removeEventListener('pointerdown', shut)
    }, [notesOpen])

    // The filter box is the point of opening the history panel, so it gets focus.
    useEffect(() => { if (showHistory) histRef.current?.focus() }, [showHistory])
    useEffect(() => { if (palette) palRef.current?.focus() }, [palette])

    // Track recency so tab discarding keeps the right frames awake. The active tab
    // goes to the front; stale ids are pruned so the list can't grow forever.
    useEffect(() => {
        setMru(prev => [activeId, ...prev.filter(id => id !== activeId && tabs.some(t => t.id === id))])
    }, [activeId, tabs])

    // The browser drops a screen wake lock whenever the tab is hidden; re-take it
    // when we're visible again and the toggle is still on. Release it on close.
    useEffect(() => {
        if (!wakeSupported) return undefined
        const reacquire = async () => {
            if (awake && document.visibilityState === 'visible' && !wakeRef.current) {
                try {
                    const lock = await navigator.wakeLock.request('screen')
                    wakeRef.current = lock
                    lock.addEventListener?.('release', () => { wakeRef.current = null })
                } catch { /* denied; the toggle still reflects intent */ }
            }
        }
        document.addEventListener('visibilitychange', reacquire)
        return () => document.removeEventListener('visibilitychange', reacquire)
    }, [awake, wakeSupported])

    useEffect(() => () => { try { wakeRef.current?.release() } catch { /* gone */ } }, [])

    // The clock only ticks while a blank new-tab page is in front — nowhere else
    // shows it, so nowhere else needs the re-render.
    useEffect(() => {
        if (current || !prefs.showNtpClock) return undefined
        setClock(Date.now())
        const id = setInterval(() => setClock(Date.now()), 1000)
        return () => clearInterval(id)
    }, [current, prefs.showNtpClock])

    /* Roving focus only works if focus actually follows the arrow key. */
    useEffect(() => {
        if (focusTab.current === null) return
        shellRef.current?.querySelector('.wf-tab[tabindex="0"]')?.focus()
        focusTab.current = null
    })

    /* A menu is a keyboard surface: first item focused, arrows to move. */
    useEffect(() => {
        if (!menu) return
        menuRef.current?.querySelector('.wf-menu-item:not(:disabled)')?.focus()
    }, [menu])

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

    /**
     * Moving and resizing are one gesture with nine flavours: 'move', or an edge
     * or corner. Both start from the window's measured rectangle rather than from
     * state, because until it has been dragged once the window is centred by flex
     * and its stored size is a maximum, not its actual place on screen.
     *
     * The frame gets pointer-events: none for the duration, or the cross-origin
     * iframe swallows every move the moment the pointer crosses it.
     */
    const startGrab = (mode) => (e) => {
        if (maximized || isFullscreen || e.button !== 0) return
        e.preventDefault()  // stops the drag selecting text as it crosses the page
        setMenu(null)
        const r = shellRef.current?.getBoundingClientRect()
        if (!r) return
        const start = { x: r.left, y: r.top, w: r.width, h: r.height }
        const from = { x: e.clientX, y: e.clientY }
        setResizing(true)

        const onMove = (ev) => {
            const box = resizeBox(mode, start, ev.clientX - from.x, ev.clientY - from.y, { w: MIN_W, h: MIN_H })
            const w = Math.max(MIN_W, Math.min(box.w, window.innerWidth))
            const h = Math.max(MIN_H, Math.min(box.h, window.innerHeight))
            if (mode !== 'move') setSize({ w, h })
            setPos(clampWindow(box, { w, h }, { width: window.innerWidth, height: window.innerHeight }))
        }
        const onUp = () => {
            setResizing(false)
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
    }

    /**
     * Every part of the window chrome that isn't a control drags the window: the
     * gaps in the toolbar, the blank of the tab rail, the end of the bookmarks bar.
     *
     * The toolbar alone was not enough to offer — the omnibox is flex:1 and fills
     * the middle of it, leaving a few pixels of gap between buttons and nothing a
     * hand could reasonably aim at.
     */
    const NOT_A_HANDLE = 'button, a, input, select, textarea, .wf-omni, .wf-tab, .wf-rail-grip, .wf-suggest, .wf-menu'
    const startTitleDrag = (e) => {
        if (e.target.closest(NOT_A_HANDLE)) return
        startGrab('move')(e)
    }
    const titleDragProps = {
        onPointerDown: startTitleDrag,
        onDoubleClick: (e) => { if (!e.target.closest(NOT_A_HANDLE)) toggleMaximize() }
    }

    /**
     * Tab must not walk out of an open dialog and into the page behind it — least
     * of all into a cross-origin frame, which swallows focus and gives no way back
     * without a mouse. Cycles within the container instead.
     */
    const trapTab = (e, container) => {
        if (e.key !== 'Tab' || !container) return
        const stops = [...container.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])')]
            .filter(el => el.offsetParent !== null)
        if (!stops.length) return
        const first = stops[0]
        const last = stops[stops.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    /**
     * Take keyboard control back from a framed page.
     *
     * Many sites focus their own search box on load. That makes the <iframe> the
     * document's active element, and from that moment every keystroke belongs to
     * the site: ⌘T, ⌘L, the zoom keys and — worst — the panic key all stop
     * working, with nothing on screen to say why. Clicking the viewer's own chrome
     * is the natural way back, and normally the browser would move focus for us,
     * but the drag handler has to preventDefault to keep the gesture from
     * selecting text, which suppresses exactly that.
     *
     * So it is done explicitly, and only when focus really is inside the frame —
     * clicking the toolbar must not yank the caret out of the address bar. The
     * page keeps whatever focus it took while you are actually using it; this only
     * says that touching the chrome means you are talking to the viewer again.
     */
    const reclaimFocus = () => {
        if (document.activeElement?.tagName === 'IFRAME') shellRef.current?.focus()
    }

    /** Put it back in the middle, for a window dragged somewhere unhelpful. */
    const recentre = () => {
        setPos(null)
        try { localStorage.removeItem(POS_KEY) } catch { /* ignore */ }
        say('Window re-centred')
    }

    /* ---- bookmarks ---- */
    /*
     * Takes the URL rather than reading `current`, because the tab menu bookmarks
     * a tab that is not in front: selecting it only queues a state change, so by
     * the time this ran `current` would still be the previous page.
     */
    const bookmarkPage = (url) => {
        if (!url) return
        if (prefs.bookmarks.some(b => b.url === url)) { say('Already in your shortcuts'); return }
        if (prefs.bookmarks.length >= MAX_BOOKMARKS) { say(`${MAX_BOOKMARKS} shortcuts is the limit.`); return }
        patchPrefs({ bookmarks: [...prefs.bookmarks, { label: tabTitle(url), url }] })
        say(`Saved ${tabLabel(url)} to your shortcuts`)
    }
    const bookmarkCurrent = () => bookmarkPage(current)
    const removeBookmark = (url) => patchPrefs({ bookmarks: prefs.bookmarks.filter(b => b.url !== url) })

    /** Whether the page in front is already on the shelf — the star fills in when it is. */
    const isBookmarked = !!current && prefs.bookmarks.some(b => b.url === current)

    /**
     * Everything the command palette can jump to or do, each carrying its own
     * `run`. Ordered by `base` so, before anything is typed, open tabs sit on top,
     * then actions, then bookmarks, then recent history. rankPalette does the rest.
     */
    const paletteItems = () => {
        const bare = (u) => u.replace(/^https?:\/\//i, '').replace(/^www\./, '')
        const items = []

        for (const t of tabs) {
            const u = urlOf(t)
            if (!u || t.id === active.id) continue
            items.push({ key: `tab-${t.id}`, type: 'tab', title: tabTitle(u), subtitle: bare(u), keywords: [hostOf(u)], base: 100, run: () => selectTab(t.id) })
        }

        const act = (title, run, keywords = []) => items.push({ key: `act-${title}`, type: 'action', title, keywords, base: 60, run })
        act('New tab', () => openTab(), ['open', 'create'])
        act('New private tab', () => openTab(null, { private: true }), ['incognito', 'private', 'no history'])
        if (tabs.length > 1) act('Show all tabs', () => setShowOverview(true), ['overview', 'grid', 'expose'])
        act(mini ? 'Restore full window' : 'Mini player', () => setMini(m => !m), ['pip', 'picture in picture', 'minimize', 'corner'])
        if (closed.length) act('Reopen closed tab', reopenClosed, ['restore', 'undo'])
        act('History', () => setShowHistory(true), ['recent', 'visited'])
        act('Settings', () => setShowSettings(true), ['preferences', 'options'])
        if (current && !isBookmarked) act('Bookmark this page', bookmarkCurrent, ['save', 'star', 'shortcut'])
        if (current && !readingList.some(r => r.url === current)) act('Add to reading list', () => addToReadingList(current), ['read later', 'queue', 'save'])
        const noteH = hostOf(current) // computed here: noteHost/currentNote are declared later
        if (noteH) act((siteNotes[noteH] ? 'Edit' : 'Add a') + ' note for this site', () => setNotesOpen(true), ['note', 'annotate', 'memo'])
        if (readingList.length) act('Read later list', () => setShowHistory(true), ['reading list', 'queue'])
        if (current) act(active.pinned ? 'Unpin this tab' : 'Pin this tab', () => togglePin(active.id), ['pin'])
        if (active && !active.pinned) {
            if (active.groupId) act('Remove tab from group', () => ungroupTab(active.id), ['ungroup'])
            else act('Add tab to a new group', () => groupTab(active.id), ['group', 'colour', 'organize'])
            groups.filter(g => g.id !== active.groupId).forEach(g => act(`Move tab to "${g.name}"`, () => setTabGroup(active.id, g.id), ['group']))
        }
        if (current) act('Copy address', () => copyAddress(current), ['url', 'link'])
        if (current && qrFits(current)) act('Show QR code for this page', () => setQrFor(current), ['qr', 'phone', 'scan', 'send to phone'])
        if (current) act('Forget this site', () => forgetSite(current), ['clear', 'privacy', 'remove', 'history'])
        if (tabs.length > 1) act(splitActive ? 'Close split view' : 'Split view', toggleSplit, ['split', 'side by side', 'compare'])
        if (splitActive) act('Swap split sides', swapSplit, ['split', 'swap'])
        if (tabs.length > 1) act('Close this tab', () => closeTab(active.id), ['close'])
        act('Save open tabs as a set…', () => { setShowSettings(true); setSetPane('sets') }, ['session', 'workspace', 'group'])

        // saved tab sets — reopen a whole group at once
        for (const set of savedSets) {
            items.push({
                key: `set-${set.name}`, type: 'set',
                title: `Open set: ${set.name}`, subtitle: `${set.tabs.length} tab${set.tabs.length === 1 ? '' : 's'}`,
                keywords: ['session', 'workspace', 'set'], base: 45, run: () => restoreSet(set)
            })
        }

        for (const b of prefs.bookmarks) {
            items.push({ key: `bm-${b.url}`, type: 'bookmark', title: b.label, subtitle: bare(b.url), keywords: [hostOf(b.url)], base: 30, run: () => openOrSwitch(b.url) })
        }
        // recent pages that aren't already an open tab or a bookmark
        const covered = new Set([...tabs.map(urlOf), ...prefs.bookmarks.map(b => b.url)].filter(Boolean))
        for (const h of history) {
            if (covered.has(h.url)) continue
            items.push({ key: `h-${h.url}`, type: 'history', title: tabTitle(h.url), subtitle: bare(h.url), keywords: [hostOf(h.url)], base: 10, run: () => openOrSwitch(h.url) })
        }
        return items
    }

    /* ---- saved tab sets (workspaces) ---- */
    const saveCurrentAs = (name) => {
        // a saved set is written to storage, so private tabs never go into one
        const payload = tabs.filter(t => !t.private).map(t => ({ stack: t.stack, idx: t.idx, pinned: t.pinned })).filter(t => t.idx >= 0)
        if (!payload.length) { say('No open pages to save yet.'); return false }
        const nm = String(name || '').trim()
        if (!nm) return false
        const existed = savedSets.some(s => s.name.toLowerCase() === nm.toLowerCase())
        setSavedSets(s => saveSet(s, nm, payload, Date.now()))
        say(`${existed ? 'Updated' : 'Saved'} “${nm.slice(0, 40)}” — ${payload.length} tab${payload.length === 1 ? '' : 's'}`)
        return true
    }
    const deleteSet = (name) => setSavedSets(s => removeSet(s, name))

    /** Reopen a saved set alongside the current tabs, skipping ones already open. */
    const restoreSet = (set) => {
        if (!set) return
        const openUrls = new Set(tabs.map(urlOf).filter(Boolean))
        const fresh = []
        let skipped = 0
        for (const t of set.tabs) {
            const u = t.stack[t.idx]
            if (!u) continue
            if (openUrls.has(u)) { skipped++; continue }
            if (tabs.length + fresh.length >= MAX_TABS) break
            fresh.push({ id: nextTabId++, stack: t.stack, idx: t.idx, nonce: 0, pinned: !!t.pinned, private: false, groupId: null })
        }
        if (!fresh.length) { say(skipped ? 'Those tabs are already open.' : `${MAX_TABS} tabs is the limit — close some first.`); return }
        fresh.forEach(t => startLoad(t.id, urlOf(t)))
        setTabs(ts => withPinnedFirst([...ts, ...fresh]))
        setActiveId(fresh[0].id)
        setInput(urlOf(fresh[0]) || '')
        const capped = fresh.length < set.tabs.length - skipped
        say(`Opened ${fresh.length} tab${fresh.length === 1 ? '' : 's'} from “${set.name}”${capped ? ' (tab limit reached)' : ''}`)
    }

    const palResults = palette ? rankPalette(palQuery, paletteItems(), 9) : []
    const palAt = Math.min(palSel, Math.max(0, palResults.length - 1))
    const openPalette = () => { setPalette(true); setPalQuery(''); setPalSel(0) }
    const closePalette = () => { setPalette(false); setPalQuery(''); setPalSel(0) }
    const runPalette = (item) => { if (!item) return; closePalette(); item.run() }

    /** The home screen's "+" tile. A bare host is fine — toUrl fills in https://. */
    const addShortcut = (e) => {
        e.preventDefault()
        const typed = (draft?.url || '').trim()
        // toUrl turns anything it cannot read as an address into a search, and a
        // shortcut pointing at a results page is never what was meant. So accept
        // only what is already an address, and leave the form up otherwise.
        const isAddress = /^https?:\/\//i.test(typed) || /^[^\s/]+\.[a-z]{2,}([/?#]|$)/i.test(typed)
        const url = isAddress ? toUrl(typed, prefs.engine, engines) : null
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

    /** Drag one shortcut onto another to reorder — the bar and the home tiles both use it. */
    const reorderBookmarks = (fromUrl, toUrl) => {
        if (!fromUrl || !toUrl || fromUrl === toUrl) return
        const from = prefs.bookmarks.findIndex(b => b.url === fromUrl)
        const to = prefs.bookmarks.findIndex(b => b.url === toUrl)
        if (from < 0 || to < 0) return
        patchPrefs({ bookmarks: moveItem(prefs.bookmarks, from, to) })
    }
    // props shared by every draggable shortcut, so the bar and the tiles behave alike
    const bmDragProps = (url) => ({
        draggable: true,
        onDragStart: (e) => { setBmDrag(url); e.dataTransfer.effectAllowed = 'move' },
        onDragOver: (e) => { if (bmDrag && bmDrag !== url) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } },
        onDrop: (e) => { e.preventDefault(); reorderBookmarks(bmDrag, url); setBmDrag(null) },
        onDragEnd: () => setBmDrag(null)
    })

    /** Chrome's "bookmark all tabs" — duplicates are dropped by the sanitiser. */
    const bookmarkAllTabs = () => {
        // private tabs are excluded — bookmarking them would persist a URL the
        // private tab exists precisely to keep out of storage
        const open = tabs.filter(t => !t.private).map(urlOf).filter(Boolean).map(u => ({ label: tabLabel(u), url: u }))
        if (!open.length) return
        patchPrefs({ bookmarks: [...prefs.bookmarks, ...open] })
    }

    /* ---- history ---- */
    const forgetPage = (url) => setHistory(h => h.filter(x => x.url !== url))
    const clearHistory = () => {
        setHistory([])
        try { localStorage.removeItem(HISTORY_KEY) } catch { /* ignore */ }
        say('Visited pages cleared')
    }
    // Retention: forget visits past the chosen age, on open and when it changes.
    useEffect(() => {
        if (prefs.historyDays) setHistory(h => pruneHistory(h, prefs.historyDays, Date.now()))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefs.historyDays])
    /* ---- read later ---- */
    const inReadingList = (url) => readingList.some(r => r.url === url)
    const addToReadingList = (url) => {
        if (!url || !/^https?:\/\//i.test(url)) { say('Nothing to save here yet'); return }
        if (inReadingList(url)) { say('Already on your reading list'); return }
        setReadingList(list => sanitizeBookmarks([{ url, label: tabTitle(url) }, ...list]))
        say(`Saved ${tabLabel(url)} to read later`)
    }
    const removeFromReadingList = (url) => setReadingList(list => list.filter(r => r.url !== url))

    /* ---- per-site notes ---- */
    const noteHost = hostOf(current)
    const currentNote = (noteHost && siteNotes[noteHost]) || ''
    const setSiteNote = (host, text) => setSiteNotes(prev => {
        const next = { ...prev }
        if (text.trim()) next[host] = text.slice(0, 4000); else delete next[host]
        return next
    })

    /* ---- PIN lock (a convenience lock, not strong security) ---- */
    // Lock on open if a PIN is set.
    useEffect(() => { if (prefs.pinHash) setLocked(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])
    const unlock = async () => {
        if (await hashPin(pinEntry) === prefs.pinHash) { setLocked(false); setPinEntry(''); setPinMsg('') }
        else { setPinMsg('That PIN doesn’t match.'); setPinEntry('') }
    }
    const setPin = async (pin) => {
        if (!/^\d{4,12}$/.test(pin)) { setPinMsg('Use 4–12 digits.'); return }
        patchPrefs({ pinHash: await hashPin(pin) })
        setPinMsg('PIN set — Lumen will ask for it when it opens.')
    }
    const removePin = () => { patchPrefs({ pinHash: '' }); setPinMsg('PIN removed.') }
    // Opening consumes the item — that's what makes this a queue, not a second
    // bookmarks list: you read it, it leaves.
    const openFromReadingList = (url) => { removeFromReadingList(url); setShowHistory(false); go(url) }

    // "Forget this site" wipes a host from everywhere Lumen remembers it: visits,
    // bookmarks, its saved zoom, and any embed-in-popup rule.
    const forgetSite = (url) => {
        const host = hostOf(url)
        if (!host) return
        setHistory(h => h.filter(x => hostOf(x.url) !== host))
        patchPrefs({ bookmarks: prefs.bookmarks.filter(b => hostOf(b.url) !== host) })
        setZooms(z => { const n = { ...z }; delete n[host]; return n })
        setPopupHosts(p => toggleHost(p, url, false))
        // "everything" has to mean everything: the read-later queue and the site note too
        setReadingList(list => list.filter(r => hostOf(r.url) !== host))
        setSiteNotes(prev => { const n = { ...prev }; delete n[host]; return n })
        say(`Forgot everything from ${host}`)
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

    /* ---- bookmark tags ---- */
    const addBookmarkTag = (url, tag) => setPrefs(p => sanitizePrefs({
        ...p,
        bookmarks: p.bookmarks.map(b => (b.url === url ? { ...b, tags: [...(b.tags || []), tag] } : b))
    }))
    const removeBookmarkTag = (url, tag) => setPrefs(p => sanitizePrefs({
        ...p,
        bookmarks: p.bookmarks.map(b => (b.url === url ? { ...b, tags: (b.tags || []).filter(t => t !== tag) } : b))
    }))
    const toggleTagFilter = (tag) => setTagFilter(f => (f.includes(tag) ? f.filter(t => t !== tag) : [...f, tag]))
    // Every tag in use, and the bookmarks matching the active filter (any match).
    const allTags = [...new Set(prefs.bookmarks.flatMap(b => b.tags || []))].sort()
    const visibleBookmarks = tagFilter.length
        ? prefs.bookmarks.filter(b => (b.tags || []).some(t => tagFilter.includes(t)))
        : prefs.bookmarks

    // Save text to a file the reader can keep — a real download, since Lumen runs
    // in the page (not the artifact sandbox). Silently no-ops if the host blocks it.
    const downloadFile = (name, text, type = 'text/html;charset=utf-8') => {
        try {
            const url = URL.createObjectURL(new Blob([text], { type }))
            const a = document.createElement('a')
            a.href = url; a.download = name
            document.body.appendChild(a); a.click(); a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 2000)
        } catch { setMarksMsg('This browser would not start the download.') }
    }
    // The Netscape bookmarks.html every browser reads — for moving marks in/out.
    const exportBookmarksFile = () => {
        if (!prefs.bookmarks.length) { setMarksMsg('No bookmarks to export yet.'); return }
        downloadFile('lumen-bookmarks.html', exportBookmarksHTML(prefs.bookmarks))
        setMarksMsg(`Exported ${prefs.bookmarks.length} bookmark${prefs.bookmarks.length === 1 ? '' : 's'} as an HTML file.`)
    }
    const importBookmarksFile = (file) => {
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            const before = prefs.bookmarks.length
            const merged = sanitizeBookmarks([...prefs.bookmarks, ...parseBookmarksHTML(reader.result)])
            patchPrefs({ bookmarks: merged })
            const added = merged.length - before
            setMarksMsg(added > 0
                ? `Imported ${added} new bookmark${added === 1 ? '' : 's'} from ${file.name}.`
                : 'No new bookmarks in that file (already saved, or the list is full).')
        }
        reader.onerror = () => setMarksMsg('Could not read that file.')
        reader.readAsText(file)
    }

    /* ---- full backup & restore ---- */
    const exportAll = () => {
        const text = JSON.stringify(packBackup({ prefs, bookmarks: prefs.bookmarks, savedSets, popupHosts, zooms }), null, 2)
        setBackupIo(text)
        navigator.clipboard?.writeText(text).then(
            () => setBackupMsg('Copied your whole viewer setup to the clipboard.'),
            () => setBackupMsg('Select the text below and copy it to keep a backup.')
        )
    }
    const importAll = () => {
        const parsed = parseBackup(backupIo)
        if (!parsed) { setBackupMsg('That is not a MathLab viewer backup.'); return }
        const done = []
        if (parsed.prefs) {
            // the dedicated bookmarks list wins over the copy inside prefs
            setPrefs(sanitizePrefs({ ...parsed.prefs, bookmarks: parsed.bookmarks ?? parsed.prefs.bookmarks }))
            done.push('settings')
        } else if (parsed.bookmarks) {
            patchPrefs({ bookmarks: parsed.bookmarks })
        }
        if (parsed.bookmarks) done.push(`${parsed.bookmarks.length} shortcut${parsed.bookmarks.length === 1 ? '' : 's'}`)
        if (parsed.savedSets) { setSavedSets(parsed.savedSets); done.push(`${parsed.savedSets.length} tab set${parsed.savedSets.length === 1 ? '' : 's'}`) }
        if (parsed.popupHosts) { setPopupHosts(parsed.popupHosts); done.push(`${parsed.popupHosts.length} site rule${parsed.popupHosts.length === 1 ? '' : 's'}`) }
        if (parsed.zooms) { setZooms(parsed.zooms); done.push('zoom levels') }
        setBackupMsg(done.length ? `Restored ${done.join(', ')}.` : 'That backup had nothing to restore.')
    }

    // Recomputed as you type in the panel's filter; cheap next to MAX_HISTORY rows.
    const histGroups = showHistory ? groupHistory(history, { query: histQuery }) : []

    // The home screen's second row: where you actually keep going, as opposed to
    // the shelf above it, which is where you once decided you would.
    const topRow = prefs.showNtpTop && !current
        ? topSites(history, { exclude: prefs.bookmarks.map(b => b.url), limit: 8 })
        : []

    const sizeStyle = (maximized || isFullscreen || mini)
        ? null
        : (pos
            // once moved it leaves the backdrop's flex centring and is placed exactly;
            // clampWindow already guarantees it stays reachable, so no min() here
            ? { position: 'absolute', left: `${pos.x}px`, top: `${pos.y}px`, margin: 0, width: `${size.w}px`, height: `${size.h}px` }
            : { width: `min(${size.w}px, calc(100vw - 2rem))`, height: `min(${size.h}px, calc(100vh - 2rem))` })

    // A chosen accent overrides the site theme's, but only inside this window.
    const shellStyle = prefs.accent
        ? { ...sizeStyle, '--accent': prefs.accent, '--on-accent': readableOn(prefs.accent) }
        : (sizeStyle ?? undefined)

    const shellClass = [
        'wf-shell',
        maximized && !mini && 'is-max',
        mini && 'is-mini',
        isFullscreen && 'is-fs',
        prefs.density === 'compact' && 'is-compact',
        prefs.contrast === 'high' && 'contrast-high',
        prefs.dyslexiaFont && 'font-readable',
        prefs.verticalTabs && 'has-rail',
        prefs.verticalTabs && !railOpen && 'rail-closed'
    ].filter(Boolean).join(' ')

    // A group header row: colour dot, name, member count, collapse caret. Clicking
    // the name opens a small inline editor (rename + recolour + delete).
    const renderGroupHeader = ({ group, count }) => (
        <div key={`g-${group.id}`} className="wf-group-head" style={{ '--group-color': group.color }}>
            <button
                type="button"
                className="wf-group-caret"
                onClick={() => toggleGroupCollapse(group.id)}
                aria-label={group.collapsed ? `Expand ${group.name}` : `Collapse ${group.name}`}
                aria-expanded={!group.collapsed}
                title={group.collapsed ? 'Expand group' : 'Collapse group'}
            >{group.collapsed ? '▸' : '▾'}</button>
            <button type="button" className="wf-group-name" onClick={() => setEditGroup(g => (g === group.id ? null : group.id))} title="Rename or recolour">
                <span className="wf-group-dot" style={{ background: group.color }} aria-hidden="true" />
                <span className="wf-group-label">{group.name}</span>
                <span className="wf-group-count">{count}</span>
            </button>
            {editGroup === group.id && (
                <div className="wf-group-edit" onPointerDown={(e) => e.stopPropagation()}>
                    <input
                        type="text"
                        className="wf-group-input"
                        value={group.name}
                        maxLength={24}
                        aria-label="Group name"
                        autoFocus
                        onChange={(e) => renameGroup(group.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setEditGroup(null) } }}
                    />
                    <div className="wf-group-colors">
                        {GROUP_COLORS.map(c => (
                            <button
                                key={c}
                                type="button"
                                className={`wf-group-swatch${c === group.color ? ' is-on' : ''}`}
                                style={{ background: c }}
                                aria-label={`Colour ${c}`}
                                onClick={() => recolorGroup(group.id, c)}
                            />
                        ))}
                    </div>
                    <button type="button" className="btn ghost" onClick={() => { setEditGroup(null); deleteGroup(group.id) }}>Ungroup all</button>
                </div>
            )}
        </div>
    )

    const tabOrder = groupedTabOrder(tabs, groups, active?.id)
    const tabList = (
        <div className="wf-tabs" role="tablist" aria-label="Tabs">
            {tabOrder.map(it => {
                if (it.type === 'header') return renderGroupHeader(it)
                const t = it.tab
                const group = it.group
                const u = urlOf(t)
                return (
                    <div
                        key={t.id}
                        role="tab"
                        /* Roving focus: a tablist is one stop on the Tab key, and the
                           arrows move within it. Every tab being tabbable made getting
                           past a full rail take twelve presses. */
                        tabIndex={t.id === active.id ? 0 : -1}
                        aria-selected={t.id === active.id}
                        className={[
                            'wf-tab',
                            t.id === active.id && 'is-active',
                            loading[t.id] && 'is-loading',
                            t.pinned && 'is-pinned',
                            t.private && 'is-private',
                            group && 'is-grouped',
                            dragId === t.id && 'is-dragging'
                        ].filter(Boolean).join(' ')}
                        style={group ? { '--group-color': group.color } : undefined}
                        title={(t.private ? 'Private tab — not saved to history\n' : '') + (u ? `${u}\nMiddle-click to close · right-click for more` : 'New tab')}
                        // Dragging reorders the strip; a pinned tab can only be
                        // dropped among the other pinned ones, which withPinnedFirst
                        // enforces after the move.
                        draggable
                        onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move' }}
                        onDragOver={(e) => {
                            if (dragId === null || dragId === t.id) return
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(e) => { e.preventDefault(); dropOnTab(t.id) }}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => selectTab(t.id)}
                        onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(t.id) } }}
                        onContextMenu={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setMenu({ tabId: t.id, x: e.clientX, y: e.clientY })
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTab(t.id); return }
                            // A menu key / Shift+F10 raises the same menu as right-click,
                            // anchored on the tab rather than on a pointer that isn't there.
                            if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                                e.preventDefault()
                                const r = e.currentTarget.getBoundingClientRect()
                                setMenu({ tabId: t.id, x: r.right - 8, y: r.bottom - 4 })
                                return
                            }
                            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); closeTab(t.id); return }
                            // the rail runs down the screen and the top strip across it,
                            // so each takes the pair of arrows that matches its direction
                            const fwd = prefs.verticalTabs ? 'ArrowDown' : 'ArrowRight'
                            const back = prefs.verticalTabs ? 'ArrowUp' : 'ArrowLeft'
                            const i = tabs.findIndex(x => x.id === t.id)
                            let next = -1
                            if (e.key === fwd) next = (i + 1) % tabs.length
                            else if (e.key === back) next = (i - 1 + tabs.length) % tabs.length
                            else if (e.key === 'Home') next = 0
                            else if (e.key === 'End') next = tabs.length - 1
                            if (next < 0) return
                            e.preventDefault()
                            selectTab(tabs[next].id)
                            focusTab.current = tabs[next].id
                        }}
                    >
                        {t.private && <span className="wf-tab-private" aria-hidden="true" title="Private">🕶</span>}
                        {loading[t.id] ? <span className="wf-tab-spin" aria-label="Loading" /> : <Favicon url={u} />}
                        <span className="wf-tab-label">{t.private && !u ? 'Private tab' : tabTitle(u)}</span>
                        {!t.pinned && (
                            <button
                                type="button"
                                className="wf-tab-x"
                                aria-label="Close tab"
                                title="Close tab"
                                onClick={(e) => { e.stopPropagation(); closeTab(t.id) }}
                            >×</button>
                        )}
                    </div>
                )
            })}
            <button
                type="button"
                className="wf-newtab"
                onClick={() => openTab()}
                onContextMenu={(e) => { e.preventDefault(); openTab(null, { private: true }) }}
                disabled={tabs.length >= MAX_TABS}
                aria-label="New tab"
                title={tabs.length >= MAX_TABS ? `${MAX_TABS} tabs is the limit` : `New tab (${MOD_LABEL}T)\nRight-click for a private tab (${MOD_LABEL}⇧N)`}
            >+</button>
        </div>
    )

    /** The right-click menu for one tab: the actions a rail alone can't offer. */
    const menuTab = menu && tabs.find(t => t.id === menu.tabId)
    const tabMenu = menuTab && (
        <div
            ref={menuRef}
            className="wf-menu"
            role="menu"
            aria-label={`Actions for ${tabLabel(urlOf(menuTab))}`}
            onKeyDown={(e) => {
                const items = [...(menuRef.current?.querySelectorAll('.wf-menu-item:not(:disabled)') || [])]
                const i = items.indexOf(document.activeElement)
                if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
                else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
                else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
                else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
                else trapTab(e, menuRef.current)
            }}
            // Clamped so a tab near the bottom-right doesn't push the menu off screen.
            style={{
                left: `${Math.min(menu.x, window.innerWidth - 210)}px`,
                top: `${Math.min(menu.y, window.innerHeight - 250)}px`
            }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {[
                ['New tab', () => openTab(), tabs.length >= MAX_TABS],
                ['Duplicate', () => duplicateTab(menuTab.id), !urlOf(menuTab) || tabs.length >= MAX_TABS],
                [menuTab.pinned ? 'Unpin tab' : 'Pin tab', () => togglePin(menuTab.id), !urlOf(menuTab)],
                ...(menuTab.groupId
                    ? [['Remove from group', () => ungroupTab(menuTab.id), false]]
                    : [['Add to new group', () => groupTab(menuTab.id), false],
                    ...groups.map(g => [`Move to "${g.name}"`, () => setTabGroup(menuTab.id, g.id), false])]),
                ['Bookmark', () => bookmarkPage(urlOf(menuTab)), !urlOf(menuTab)],
                ['Copy address', () => copyAddress(urlOf(menuTab)), !urlOf(menuTab)],
                ['QR code', () => setQrFor(urlOf(menuTab)), !urlOf(menuTab) || !qrFits(urlOf(menuTab))],
                ['Reopen closed tab', reopenClosed, !closed.length],
                ['Close others', () => closeOthers(menuTab.id), tabs.filter(t => t.id !== menuTab.id && !t.pinned).length === 0],
                ['Close to the right', () => closeToRight(menuTab.id),
                    tabs.slice(tabs.findIndex(t => t.id === menuTab.id) + 1).filter(t => !t.pinned).length === 0],
                ['Close tab', () => closeTab(menuTab.id), false]
            ].map(([label, run, off]) => (
                <button
                    key={label}
                    type="button"
                    role="menuitem"
                    className="wf-menu-item"
                    disabled={off}
                    onClick={() => { setMenu(null); run() }}
                >{label}</button>
            ))}
        </div>
    )

    return (
        <div
            className={`wf-backdrop${mini ? ' is-mini' : ''}`}
            role="dialog"
            aria-modal={mini ? undefined : 'true'}
            aria-label="Web viewer"
            onPointerDown={(e) => { if (!mini && e.target === e.currentTarget) onClose?.() }}
        >
            <div
                ref={shellRef}
                className={shellClass}
                style={shellStyle}
                /* focusable only as a target for reclaimFocus, never by tabbing */
                tabIndex={-1}
                onPointerDown={reclaimFocus}
            >
                {locked && (
                    <div className="wf-lock" role="dialog" aria-modal="true" aria-label="Locked" onKeyDown={(e) => trapTab(e, e.currentTarget)}>
                        <form className="wf-lock-box" onSubmit={(e) => { e.preventDefault(); unlock() }}>
                            <span className="wf-lock-icon" aria-hidden="true">🔒</span>
                            <h2>Lumen is locked</h2>
                            <input
                                type="password"
                                inputMode="numeric"
                                className="wf-lock-input"
                                value={pinEntry}
                                onChange={(e) => { setPinEntry(e.target.value.replace(/\D/g, '').slice(0, 12)); setPinMsg('') }}
                                placeholder="Enter PIN"
                                aria-label="Enter your PIN"
                                autoFocus
                            />
                            <button type="submit" className="btn primary" disabled={!pinEntry}>Unlock</button>
                            {pinMsg && <span className="hint" role="status">{pinMsg}</span>}
                            <span className="hint">Press {prefs.closeKey === '`' ? 'the panic key' : `“${prefs.closeKey}”`} or Esc to close instead.</span>
                        </form>
                    </div>
                )}
                {prefs.verticalTabs && (
                    <aside className="wf-rail" style={railOpen ? { width: `${prefs.railWidth}px` } : undefined} {...titleDragProps}>
                        <div className="wf-rail-head">
                            <button
                                type="button"
                                className="wf-icon"
                                onClick={() => setRailOpen(o => !o)}
                                aria-label={railOpen ? 'Collapse tab rail' : 'Expand tab rail'}
                                aria-expanded={railOpen}
                                title={railOpen ? 'Collapse tabs' : 'Expand tabs'}
                            >☰</button>
                            {railOpen && (
                                <span className="wf-brand" aria-hidden="true">
                                    <span className="wf-brand-orb" />
                                    <span className="wf-brand-name">Lumen</span>
                                </span>
                            )}
                        </div>
                        {tabList}
                        {/* fills whatever is left of the rail, purely to be grabbable */}
                        <div className="wf-rail-fill" aria-hidden="true" />
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
                    <form className="wf-bar" onSubmit={submit} {...titleDragProps}>
                        <button type="button" className="wf-icon" onClick={back} disabled={active.idx <= 0} aria-label="Back" title="Back">←</button>
                        <button type="button" className="wf-icon" onClick={forward} disabled={active.idx >= active.stack.length - 1} aria-label="Forward" title="Forward">→</button>
                        <button type="button" className="wf-icon" onClick={reload} disabled={!current} aria-label="Reload" title={`Reload (${MOD_LABEL}R)`}>⟳</button>
                        {/* Only where a start page exists: with none set it would have
                            nowhere to go but the home screen, and getting there costs
                            the tab its back history. */}
                        {prefs.home && (
                            <button type="button" className="wf-icon" onClick={() => go(prefs.home)} aria-label="Start page" title={`Start page — ${prefs.home}`}>⌂</button>
                        )}
                        <div className="wf-omni">
                            {current ? <Favicon url={current} className="wf-omni-fav" /> : <span className="wf-omni-fav is-letter" aria-hidden="true">⌕</span>}
                            <input
                                ref={urlRef}
                                className="wf-url"
                                value={input}
                                onChange={(e) => { setInput(e.target.value); setOmniOpen(true); setSugg(-1) }}
                                onFocus={() => setOmniOpen(true)}
                                // A click lands before blur, so closing is deferred a tick or
                                // the suggestion is unmounted before it can be chosen.
                                onBlur={() => setTimeout(() => { setOmniOpen(false); setSugg(-1) }, 120)}
                                onKeyDown={(e) => {
                                    if (!suggestions.length) return
                                    if (e.key === 'ArrowDown') { e.preventDefault(); setSugg(i => (i + 1) % suggestions.length) }
                                    else if (e.key === 'ArrowUp') { e.preventDefault(); setSugg(i => (i <= 0 ? suggestions.length : i) - 1) }
                                }}
                                placeholder="Search or type a web address"
                                aria-label="Address bar"
                                role="combobox"
                                aria-expanded={suggestions.length > 0}
                                aria-controls="wf-suggest"
                                aria-activedescendant={sugg >= 0 ? `wf-sugg-${sugg}` : undefined}
                                spellCheck="false"
                                autoComplete="off"
                            />
                            {zoom !== 1 && (
                                <button
                                    type="button"
                                    className="wf-zoom"
                                    onClick={() => setZoom(1)}
                                    aria-label={`Zoom ${Math.round(zoom * 100)} percent — click to reset`}
                                    title={`Zoom ${Math.round(zoom * 100)}% · click to reset (${MOD_LABEL}0)`}
                                >{Math.round(zoom * 100)}%</button>
                            )}
                            <button
                                type="button"
                                className={`wf-omni-btn${isBookmarked ? ' is-on' : ''}`}
                                onClick={() => {
                                    if (!isBookmarked) { bookmarkCurrent(); return }
                                    removeBookmark(current)
                                    say('Removed from shortcuts')
                                }}
                                disabled={!current}
                                aria-label={isBookmarked ? 'Remove from shortcuts' : 'Bookmark this page'}
                                aria-pressed={isBookmarked}
                                title={isBookmarked ? 'Remove from shortcuts' : `Bookmark this page (${MOD_LABEL}D)`}
                            >{isBookmarked ? '★' : '☆'}</button>

                            {suggestions.length > 0 && (
                                <ul className="wf-suggest" id="wf-suggest" role="listbox" aria-label="Suggestions">
                                    {suggestions.map((s, i) => (
                                        <li
                                            key={s.url}
                                            id={`wf-sugg-${i}`}
                                            role="option"
                                            aria-selected={i === sugg}
                                            className={`wf-sugg${i === sugg ? ' is-on' : ''}`}
                                            onMouseEnter={() => setSugg(i)}
                                            // mousedown, not click: blur would tear the row down first
                                            onMouseDown={(e) => {
                                                e.preventDefault()
                                                const compute = s.kind === 'calc' || s.kind === 'convert' || s.kind === 'plot'
                                                if (!compute && (e.button === 1 || e.metaKey || e.ctrlKey)) openInBackground(s.url)
                                                else if (e.button === 0) chooseSuggestion(s)
                                            }}
                                        >
                                            {(s.kind === 'calc' || s.kind === 'convert') ? (
                                                <>
                                                    <span className="wf-sugg-calc-ico" aria-hidden="true">=</span>
                                                    <span className="wf-sugg-label">{s.expr}</span>
                                                    <span className="wf-sugg-calc-eq" aria-hidden="true">=</span>
                                                    <span className="wf-sugg-calc-res">{s.result}</span>
                                                    <span className="wf-sugg-kind is-calc">Enter to copy</span>
                                                </>
                                            ) : s.kind === 'plot' ? (
                                                <>
                                                    <span className="wf-sugg-calc-ico" aria-hidden="true">∿</span>
                                                    <span className="wf-sugg-label">Plot <code>{s.expr}</code></span>
                                                    <span className="wf-sugg-kind is-calc">Enter to graph</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Favicon url={s.url} className="wf-bm-fav" />
                                                    <span className="wf-sugg-label">{s.label}</span>
                                                    {/* host + path, so two pages on one site stay distinguishable */}
                                                    <span className="wf-sugg-url">{s.url.replace(/^https?:\/\//i, '').replace(/^www\./, '')}</span>
                                                    <span className={`wf-sugg-kind is-${s.kind}`}>
                                                        {{ bookmark: '★', tab: 'Switch to tab', article: 'Wikipedia' }[s.kind] || '↺'}
                                                    </span>
                                                </>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <a
                            className={`wf-icon${current ? '' : ' is-off'}`}
                            href={current || '#'}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label="Open in a new browser tab"
                            title="Open in a new browser tab"
                        >↗</a>
                        <button
                            type="button"
                            className={`wf-icon${notesOpen ? ' is-on' : ''}${currentNote ? ' has-dot' : ''}`}
                            onClick={() => setNotesOpen(o => !o)}
                            disabled={!noteHost}
                            aria-label="Note for this site"
                            aria-expanded={notesOpen}
                            title={noteHost ? `Note for ${noteHost}${currentNote ? ' (has a note)' : ''}` : 'Note for this site'}
                        >🗒</button>
                        <button
                            type="button"
                            className={`wf-icon${splitActive ? ' is-on' : ''}`}
                            onClick={toggleSplit}
                            aria-label="Split view"
                            aria-pressed={splitActive}
                            title={`Split view (${MOD_LABEL}\\)`}
                        >◫</button>
                        <button
                            type="button"
                            className={`wf-icon${showHistory ? ' is-on' : ''}`}
                            onClick={() => { setShowSettings(false); setShowHistory(h => !h) }}
                            aria-label="History"
                            aria-expanded={showHistory}
                            title={`History (${MOD_LABEL}Y)`}
                        >◷</button>
                        <button
                            type="button"
                            className={`wf-icon${prefs.confirmOpen ? ' is-on' : ''}`}
                            onClick={() => {
                                const next = !prefs.confirmOpen
                                patchPrefs({ confirmOpen: next })
                                say(next
                                    ? 'Will ask before opening a page in a new window'
                                    : 'Will open pages immediately')
                            }}
                            aria-label="Ask before opening pages in a new window"
                            aria-pressed={prefs.confirmOpen}
                            title={prefs.confirmOpen
                                ? 'Asking before opening a page in a new window — click to open immediately'
                                : 'Opening pages immediately — click to ask first'}
                        >{prefs.confirmOpen ? '?' : '⚡'}</button>
                        {wakeSupported && (
                            <button
                                type="button"
                                className={`wf-icon${awake ? ' is-on' : ''}`}
                                onClick={() => setWake(!awake)}
                                aria-label="Keep the screen awake"
                                aria-pressed={awake}
                                title={awake
                                    ? 'Screen kept awake while this window is open — click to allow it to sleep'
                                    : 'Keep the screen awake (stops it dimming while Lumen is in front)'}
                            >{awake ? '☀' : '☾'}</button>
                        )}
                        <button type="button" className={`wf-icon${showSettings ? ' is-on' : ''}`} onClick={() => { setShowHistory(false); setShowSettings(s => !s) }} aria-label="Settings" aria-expanded={showSettings} title="Settings">⚙</button>
                        <button
                            type="button"
                            className={`wf-icon${mini ? ' is-on' : ''}`}
                            onClick={() => setMini(m => !m)}
                            aria-label="Mini player"
                            aria-pressed={mini}
                            title={mini ? 'Restore the full window' : 'Mini player — shrink to a corner and use the page behind it'}
                        >{mini ? '◱' : '◲'}</button>
                        <button
                            type="button"
                            className="wf-icon"
                            onClick={toggleMaximize}
                            onContextMenu={(e) => { e.preventDefault(); recentre() }}
                            aria-label={maximized ? 'Restore size' : 'Maximize'}
                            title={maximized ? 'Restore size' : 'Maximize · right-click to re-centre'}
                        >{maximized ? '❐' : '▢'}</button>
                        <button type="button" className="wf-icon" onClick={toggleFullscreen} aria-label="Fullscreen" title="Fullscreen">⛶</button>
                        <button type="button" className="wf-icon wf-close" onClick={() => onClose?.()} aria-label="Close" title={`Close (Esc, or ${prefs.closeKey} to close instantly)`}>×</button>
                    </form>

                    {notesOpen && noteHost && (
                        <div className="wf-notes" role="dialog" aria-label={`Note for ${noteHost}`}>
                            <div className="wf-notes-head">
                                <span>Note for <b>{noteHost}</b></span>
                                <button type="button" className="wf-icon" onClick={() => setNotesOpen(false)} aria-label="Close note" title="Close">×</button>
                            </div>
                            <textarea
                                className="wf-notes-area"
                                value={currentNote}
                                onChange={(e) => setSiteNote(noteHost, e.target.value)}
                                placeholder={`Jot something about ${noteHost} — kept on this device, per site.`}
                                aria-label={`Note text for ${noteHost}`}
                                rows={6}
                                autoFocus
                            />
                            <span className="hint">Saved automatically. Clear the text to delete the note.</span>
                        </div>
                    )}

                    {!prefs.verticalTabs && <div className="wf-toprail" {...titleDragProps}>{tabList}</div>}

                    {prefs.bookmarksBar && prefs.bookmarks.length > 0 && (
                        <div className="wf-bmbar" {...titleDragProps}>
                            {prefs.bookmarks.map(b => (
                                <button
                                    key={b.url}
                                    type="button"
                                    className={`wf-bm${bmDrag === b.url ? ' is-dragging' : ''}`}
                                    onClick={(e) => (e.metaKey || e.ctrlKey ? openInBackground(b.url) : openOrSwitch(b.url))}
                                    onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); openInBackground(b.url) } }}
                                    title={`${b.url}\n${MOD_LABEL}click or middle-click opens a new tab · drag to reorder`}
                                    {...bmDragProps(b.url)}
                                >
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
                            <div
                                ref={panelRef}
                                className="wf-panel"
                                role="dialog"
                                aria-modal="true"
                                aria-label="Browser settings"
                                onKeyDown={(e) => trapTab(e, panelRef.current)}
                            >
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
                                            <label className="wf-set">
                                                <span>Contrast</span>
                                                <select value={prefs.contrast} onChange={(e) => patchPrefs({ contrast: e.target.value })}>
                                                    <option value="normal">Normal</option>
                                                    <option value="high">High</option>
                                                </select>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.dyslexiaFont} onChange={(e) => patchPrefs({ dyslexiaFont: e.target.checked })} />
                                                <span>Readable font (roomier, easier on the eyes)</span>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.verticalTabs} onChange={(e) => patchPrefs({ verticalTabs: e.target.checked })} />
                                                <span>Vertical tabs on the left</span>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.bookmarksBar} onChange={(e) => patchPrefs({ bookmarksBar: e.target.checked })} />
                                                <span>Show the shortcuts bar</span>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.sleepTabs} onChange={(e) => patchPrefs({ sleepTabs: e.target.checked })} />
                                                <span>Sleep inactive tabs to save memory</span>
                                            </label>
                                            <p className="hint">
                                                Only the tabs you&apos;ve used most recently keep running; the rest reload
                                                when you return to them. Turn off to keep every tab live at once.
                                            </p>
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
                                                    {prefs.customEngines.length > 0 && (
                                                        <optgroup label="Your engines">
                                                            {prefs.customEngines.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                                        </optgroup>
                                                    )}
                                                </select>
                                            </label>
                                            <p className="hint">
                                                Jump to any engine inline with a <strong>bang</strong>: start (or end) a query
                                                with <code>!</code> and a keyword. <code>!w pi</code> searches Wikipedia without
                                                changing your default. Built-in:{' '}
                                                {ENGINES.map((e, i) => (
                                                    <span key={e.id}><code>!{e.bang}</code>&nbsp;{e.name}{i < ENGINES.length - 1 ? ' · ' : ''}</span>
                                                ))}
                                            </p>

                                            <div className="wf-set-list">
                                                <span className="wf-set-title">Your search engines</span>
                                                <p className="hint">
                                                    Add any engine — put <code>%s</code> where the query goes, e.g.
                                                    <code> https://duckduckgo.com/?q=%s</code>. Each gets its own bang from its name.
                                                    Big engines like Google can&apos;t be embedded, so their results open by your
                                                    &ldquo;sites that refuse embedding&rdquo; choice above.
                                                </p>
                                                {prefs.customEngines.map(e => (
                                                    <div key={e.id} className="wf-set-row">
                                                        <span className="wf-set-name">{e.name}</span>
                                                        <code className="hint" title="Bang shortcut">!{engines.find(x => x.url === e.url)?.bang || bangFromName(e.name)}</code>
                                                        <span className="hint" style={{ flex: '2 1 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.url}</span>
                                                        <button type="button" className="wf-icon" onClick={() => patchPrefs({ customEngines: prefs.customEngines.filter(x => x.id !== e.id) })} aria-label={`Remove ${e.name}`} title="Remove engine">×</button>
                                                    </div>
                                                ))}
                                                {prefs.customEngines.length < MAX_CUSTOM_ENGINES && (
                                                    <form
                                                        className="wf-set-actions"
                                                        onSubmit={(ev) => {
                                                            ev.preventDefault()
                                                            const name = engineName.trim()
                                                            const url = engineUrl.trim()
                                                            if (!name || !/^https:\/\/\S*%s\S*$/i.test(url)) { setEngineMsg('Needs a name and an https URL containing %s.'); return }
                                                            patchPrefs({ customEngines: [...prefs.customEngines, { name, url }] })
                                                            setEngineName(''); setEngineUrl(''); setEngineMsg('')
                                                        }}
                                                    >
                                                        <input type="text" value={engineName} onChange={(e) => { setEngineName(e.target.value); setEngineMsg('') }} placeholder="Name" aria-label="Engine name" style={{ flex: '1 1 6rem' }} maxLength={24} />
                                                        <input type="text" value={engineUrl} onChange={(e) => { setEngineUrl(e.target.value); setEngineMsg('') }} placeholder="https://…/search?q=%s" aria-label="Engine URL template" spellCheck="false" style={{ flex: '2 1 10rem' }} />
                                                        <button type="submit" className="btn">Add</button>
                                                    </form>
                                                )}
                                                {engineMsg && <span className="hint" role="status">{engineMsg}</span>}
                                            </div>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.newTabOpensHome} disabled={!prefs.home} onChange={(e) => patchPrefs({ newTabOpensHome: e.target.checked })} />
                                                <span>New tabs open the start page</span>
                                            </label>
                                            <label className="wf-set">
                                                <span>Sites that refuse embedding</span>
                                                <select value={prefs.onBlocked} onChange={(e) => patchPrefs({ onBlocked: e.target.value })}>
                                                    <option value="archive">Show the archived copy here</option>
                                                    <option value="popup">Open live in a popup window</option>
                                                    <option value="tab">Open in a new browser tab</option>
                                                    <option value="explain">Just tell me</option>
                                                </select>
                                            </label>
                                            <p className="hint">
                                                Some sites — Apple, Google, GitHub — send a header telling every browser not to
                                                display them inside another page, so there is nothing the viewer can put in the
                                                pane. <b>A popup window</b> opens the real, live site — a popup is its own
                                                top-level window, so the framing header doesn&apos;t apply to it. <b>The archived
                                                copy</b> stays in the pane but is the Internet Archive&apos;s snapshot rather than
                                                the live page. Whichever you pick, the blocked screen still offers all of them.
                                            </p>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.confirmOpen} onChange={(e) => patchPrefs({ confirmOpen: e.target.checked })} />
                                                <span>Ask before opening a page in a new window</span>
                                            </label>
                                            <p className="hint">
                                                Off, a site that can&apos;t be embedded opens right away in whatever you chose
                                                above. On, the viewer stops and asks first — you get the choice screen and open
                                                it yourself. The <kbd>{prefs.confirmOpen ? '?' : '⚡'}</kbd> button in the toolbar
                                                flips this too.
                                            </p>
                                            {popupHosts.length > 0 && (
                                                <div className="wf-set-list">
                                                    <span className="wf-set-title">Always open in a popup</span>
                                                    <p className="hint">These sites skip the default above and open live in a popup.</p>
                                                    {popupHosts.map(h => (
                                                        <div key={h} className="wf-set-row">
                                                            <Favicon url={`https://${h}`} className="wf-bm-fav" />
                                                            <span className="wf-set-name">{h}</span>
                                                            <button type="button" className="wf-icon" onClick={() => setPopupHosts(l => l.filter(x => x !== h))} aria-label={`Stop always opening ${h} in a popup`} title="Remove rule">×</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.webSuggest} onChange={(e) => patchPrefs({ webSuggest: e.target.checked })} />
                                                <span>Suggest Wikipedia articles as you type</span>
                                            </label>
                                            <p className="hint">
                                                With that on, what you type in the address bar is sent to Wikipedia every
                                                few keystrokes, before you press Enter — which is why it is off to begin
                                                with. Bookmarks, history and open tabs are suggested either way, and never
                                                leave this device.
                                            </p>
                                            <p className="hint">
                                                Google, Bing and DuckDuckGo refuse to be embedded, so the list holds only
                                                engines that allow it. MathWorld and OEIS search maths and integer sequences
                                                rather than the whole web. Leave the start page blank to land on the home screen.
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
                                                <input type="checkbox" checked={prefs.showNtpClock} onChange={(e) => patchPrefs({ showNtpClock: e.target.checked })} />
                                                <span>Clock &amp; greeting</span>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.showNtpTop} onChange={(e) => patchPrefs({ showNtpTop: e.target.checked })} />
                                                <span>“Frequently visited” row</span>
                                            </label>
                                            <label className="wf-set is-check">
                                                <input type="checkbox" checked={prefs.showNtpScratch} onChange={(e) => patchPrefs({ showNtpScratch: e.target.checked })} />
                                                <span>Scratchpad note</span>
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
                                            <div className="wf-set-actions">
                                                <button type="button" className="btn ghost" onClick={exportBookmarksFile}>Export .html</button>
                                                <label className="btn ghost" style={{ cursor: 'pointer' }}>
                                                    Import .html
                                                    <input
                                                        type="file"
                                                        accept=".html,.htm,text/html"
                                                        style={{ display: 'none' }}
                                                        onChange={(e) => { importBookmarksFile(e.target.files?.[0]); e.target.value = '' }}
                                                    />
                                                </label>
                                                <span className="hint" style={{ flex: '1 1 100%' }}>Standard bookmarks file — swap with Chrome, Firefox or Safari.</span>
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
                                            {allTags.length > 0 && (
                                                <div className="wf-tag-filter" role="group" aria-label="Filter shortcuts by tag">
                                                    {allTags.map(t => (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            className={`wf-tag-chip is-filter${tagFilter.includes(t) ? ' is-on' : ''}`}
                                                            onClick={() => toggleTagFilter(t)}
                                                            aria-pressed={tagFilter.includes(t)}
                                                        >#{t}</button>
                                                    ))}
                                                    {tagFilter.length > 0 && <button type="button" className="btn ghost" onClick={() => setTagFilter([])}>Clear filter</button>}
                                                </div>
                                            )}
                                            {prefs.bookmarks.length === 0 && <span className="hint">None yet — use ☆ on a page, or the + tile on the home screen.</span>}
                                            {prefs.bookmarks.length > 0 && visibleBookmarks.length === 0 && <span className="hint">No shortcut has all of those tags.</span>}
                                            {visibleBookmarks.map((b) => {
                                                const i = prefs.bookmarks.findIndex(x => x.url === b.url)
                                                const canReorder = tagFilter.length === 0
                                                return (
                                                    <div key={b.url} className="wf-bm-row">
                                                        <div className="wf-set-row">
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
                                                            {canReorder && <button type="button" className="wf-icon" onClick={() => moveBookmark(b.url, -1)} disabled={i === 0} aria-label={`Move ${b.label} up`} title="Move up">↑</button>}
                                                            {canReorder && <button type="button" className="wf-icon" onClick={() => moveBookmark(b.url, 1)} disabled={i === prefs.bookmarks.length - 1} aria-label={`Move ${b.label} down`} title="Move down">↓</button>}
                                                            <button type="button" className="wf-icon" onClick={() => removeBookmark(b.url)} aria-label={`Remove ${b.label}`} title="Remove">×</button>
                                                        </div>
                                                        <div className="wf-tag-row">
                                                            {(b.tags || []).map(t => (
                                                                <span key={t} className="wf-tag-chip">#{t}
                                                                    <button type="button" onClick={() => removeBookmarkTag(b.url, t)} aria-label={`Remove tag ${t}`} title="Remove tag">×</button>
                                                                </span>
                                                            ))}
                                                            {(b.tags || []).length < MAX_BOOKMARK_TAGS && (
                                                                <input
                                                                    type="text"
                                                                    className="wf-tag-add"
                                                                    placeholder="+ tag"
                                                                    aria-label={`Add a tag to ${b.label}`}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key !== 'Enter') return
                                                                        e.preventDefault()
                                                                        const v = e.target.value.trim()
                                                                        if (v) { addBookmarkTag(b.url, v); e.target.value = '' }
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            <p className="hint">Tag a shortcut, then filter by tag above. These are kept under their own key, so “Reset settings” never touches them.</p>
                                        </div>
                                    )}

                                    {setPane === 'sets' && (
                                        <div className="wf-set-list">
                                            <p className="hint">
                                                Save the tabs you have open now as a named set, and reopen the whole group
                                                later — from here, or by name in the command palette (<kbd>{MOD_LABEL}K</kbd>).
                                                Reopening adds them to your current tabs and skips any already open.
                                            </p>
                                            <form
                                                className="wf-set-actions"
                                                onSubmit={(e) => { e.preventDefault(); if (saveCurrentAs(savedName)) setSavedName('') }}
                                            >
                                                <input
                                                    type="text"
                                                    value={savedName}
                                                    onChange={(e) => setSavedName(e.target.value)}
                                                    placeholder="Name this set (e.g. Research)"
                                                    aria-label="Name for the saved tab set"
                                                    maxLength={40}
                                                    style={{ flex: '1 1 auto' }}
                                                />
                                                <button type="submit" className="btn" disabled={!savedName.trim() || savedSets.length >= MAX_SAVED_SETS}>Save open tabs</button>
                                            </form>
                                            {savedSets.length >= MAX_SAVED_SETS && <span className="hint">{MAX_SAVED_SETS} sets is the limit — delete one to save another.</span>}
                                            {savedSets.length === 0 && <span className="hint">No saved sets yet.</span>}
                                            {savedSets.map(set => (
                                                <div key={set.name} className="wf-set-row">
                                                    <span className="wf-set-name">{set.name}</span>
                                                    <span className="hint" style={{ flex: '0 0 auto' }}>{set.tabs.length} tab{set.tabs.length === 1 ? '' : 's'}</span>
                                                    <button type="button" className="btn ghost" onClick={() => restoreSet(set)}>Open</button>
                                                    <button type="button" className="wf-icon" onClick={() => deleteSet(set.name)} aria-label={`Delete set ${set.name}`} title="Delete set">×</button>
                                                </div>
                                            ))}
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
                                                Press <kbd>{prefs.closeKey}</kbd> to close instantly. It works everywhere in the
                                                viewer, but not while the framed page has the keyboard — a site keeps its own
                                                keystrokes, and many take focus themselves as they load. Click anywhere on the
                                                toolbar or the tab strip to take it back. <kbd>Esc</kbd> closes it too.
                                                {/^[a-z0-9]$/i.test(prefs.closeKey) && (
                                                    <> <b>Careful:</b> <kbd>{prefs.closeKey}</kbd> is a character you may want to type.
                                                    While this is the panic key you cannot type it in the address bar — it closes the
                                                    viewer instead. Punctuation you rarely type makes a better choice.</>
                                                )}
                                            </p>
                                            <p className="hint">
                                                Open tabs and their history are saved as you browse and come back when you
                                                reopen. Logins and site data are the browser&apos;s own — a framed site keeps
                                                them only while your browser allows cookies inside an embedded page.
                                            </p>

                                            <div className="wf-set-list">
                                                <span className="wf-set-title">Visited pages</span>
                                                <p className="hint">
                                                    The viewer keeps its own short list of where you have been, purely so the
                                                    address bar can suggest it. It is never added to the browser&apos;s history.
                                                    {history.length > 0 && <> Currently <b>{history.length}</b> {history.length === 1 ? 'page' : 'pages'}.</>}
                                                </p>
                                                <label className="wf-set">
                                                    <span>Keep history for</span>
                                                    <select value={prefs.historyDays} onChange={(e) => patchPrefs({ historyDays: Number(e.target.value) })}>
                                                        {HISTORY_DAY_OPTS.map(d => (
                                                            <option key={d} value={d}>{d === 0 ? 'Forever' : d === 365 ? '1 year' : `${d} days`}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <div className="wf-set-actions">
                                                    <button type="button" className="btn ghost" disabled={!history.length} onClick={clearHistory}>Clear visited pages</button>
                                                    <button type="button" className="btn ghost" disabled={!history.length} onClick={() => { setShowSettings(false); setShowHistory(true) }}>Browse the list</button>
                                                    <button type="button" className="btn ghost" disabled={!current} onClick={() => forgetSite(current)}>Forget this site</button>
                                                </div>
                                            </div>

                                            <div className="wf-set-list">
                                                <span className="wf-set-title">Lock</span>
                                                <p className="hint">
                                                    {prefs.pinHash
                                                        ? 'Lumen asks for this PIN when it opens. It keeps casual eyes out — not strong security, since anyone with the device could clear it.'
                                                        : 'Set a PIN and Lumen will ask for it each time it opens. This keeps casual eyes out; it is a convenience lock, not strong security.'}
                                                </p>
                                                <div className="wf-set-actions">
                                                    <input
                                                        type="password"
                                                        inputMode="numeric"
                                                        value={pinSet}
                                                        onChange={(e) => { setPinSet(e.target.value.replace(/\D/g, '').slice(0, 12)); setPinMsg('') }}
                                                        placeholder={prefs.pinHash ? 'New PIN (4–12 digits)' : 'PIN (4–12 digits)'}
                                                        aria-label="Set a lock PIN"
                                                        style={{ flex: '1 1 8rem' }}
                                                    />
                                                    <button type="button" className="btn" onClick={() => { setPin(pinSet); setPinSet('') }} disabled={!pinSet}>{prefs.pinHash ? 'Change PIN' : 'Set PIN'}</button>
                                                    {prefs.pinHash && <button type="button" className="btn ghost" onClick={removePin}>Remove PIN</button>}
                                                </div>
                                                {pinMsg && <span className="hint" role="status">{pinMsg}</span>}
                                            </div>

                                            <div className="wf-set-list">
                                                <span className="wf-set-title">Zoom</span>
                                                <p className="hint">
                                                    Each site keeps the zoom you last gave it.
                                                    {Object.keys(zooms).length > 0 && <> <b>{Object.keys(zooms).length}</b> {Object.keys(zooms).length === 1 ? 'site is' : 'sites are'} set away from 100%.</>}
                                                </p>
                                                <div className="wf-set-actions">
                                                    <button
                                                        type="button"
                                                        className="btn ghost"
                                                        disabled={!Object.keys(zooms).length}
                                                        onClick={() => {
                                                            setZooms({})
                                                            try { localStorage.removeItem(ZOOM_KEY) } catch { /* ignore */ }
                                                            say('Every site back to 100%')
                                                        }}
                                                    >Reset every site to 100%</button>
                                                </div>
                                            </div>

                                            <div className="wf-set-list">
                                                <span className="wf-set-title">Backup &amp; restore</span>
                                                <p className="hint">
                                                    One snapshot of your whole setup — settings, shortcuts, tab sets, site
                                                    rules and zoom. Keep the text somewhere safe, or paste one back to restore.
                                                    Open tabs and visited history are left out on purpose.
                                                </p>
                                                <div className="wf-set-actions">
                                                    <button type="button" className="btn ghost" onClick={exportAll}>Copy full backup</button>
                                                    <button type="button" className="btn ghost" onClick={importAll} disabled={!backupIo.trim()}>Restore from box</button>
                                                </div>
                                                <textarea
                                                    className="wf-marks-io"
                                                    value={backupIo}
                                                    onChange={(e) => { setBackupIo(e.target.value); setBackupMsg('') }}
                                                    placeholder="Your backup appears here — keep a copy, or paste one to restore."
                                                    aria-label="Full backup text"
                                                    spellCheck="false"
                                                    rows={3}
                                                />
                                                {backupMsg && <span className="hint" role="status">{backupMsg}</span>}
                                            </div>

                                            <div className="wf-set-list">
                                                <span className="wf-set-title">Keyboard shortcuts</span>
                                                <div className="wf-keys">
                                                    {[
                                                        ['New tab', 'T'], ['Close tab', 'W'], ['Reopen closed tab', '⇧T'],
                                                        ['Address bar', 'L'], ['Reload', 'R'], ['Bookmark page', 'D'],
                                                        ['History', 'Y'], ['Command palette', 'K'],
                                                        ['Zoom in / out', '+ −'], ['Reset zoom', '0'],
                                                        ['Back / Forward', '← →'], ['Jump to tab', '1…9']
                                                    ].map(([what, key]) => (
                                                        <div key={what} className="wf-key-row">
                                                            <span>{what}</span>
                                                            <kbd>{MOD_LABEL}{key}</kbd>
                                                        </div>
                                                    ))}
                                                    <div className="wf-key-row"><span>Next / previous tab</span><kbd>Ctrl Tab</kbd></div>
                                                    <div className="wf-key-row"><span>Close the viewer</span><kbd>Esc</kbd></div>
                                                </div>
                                            </div>
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


                    {/*
                      * Command palette: one keyboard-first place to reach any open tab,
                      * bookmark, or recent page, and to run the handful of actions worth
                      * a shortcut. Opens on ⌘/Ctrl+K.
                      */}
                    {palette && (
                        <div className="wf-cmd" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) closePalette() }}>
                            <div className="wf-cmd-box" role="dialog" aria-modal="true" aria-label="Command palette">
                                <input
                                    ref={palRef}
                                    className="wf-cmd-input"
                                    value={palQuery}
                                    onChange={(e) => { setPalQuery(e.target.value); setPalSel(0) }}
                                    placeholder="Jump to a tab, bookmark, or action…"
                                    aria-label="Command palette"
                                    role="combobox"
                                    aria-expanded={palResults.length > 0}
                                    aria-controls="wf-cmd-list"
                                    aria-activedescendant={palResults.length ? `wf-cmd-${palAt}` : undefined}
                                    spellCheck="false"
                                    autoComplete="off"
                                    onKeyDown={(e) => {
                                        if (!palResults.length) return
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setPalSel((palAt + 1) % palResults.length) }
                                        else if (e.key === 'ArrowUp') { e.preventDefault(); setPalSel((palAt - 1 + palResults.length) % palResults.length) }
                                        else if (e.key === 'Enter') { e.preventDefault(); runPalette(palResults[palAt]) }
                                    }}
                                />
                                <ul className="wf-cmd-list" id="wf-cmd-list" role="listbox" aria-label="Results">
                                    {palResults.length === 0 && <li className="wf-cmd-empty">No matches.</li>}
                                    {palResults.map((item, i) => (
                                        <li
                                            key={item.key}
                                            id={`wf-cmd-${i}`}
                                            role="option"
                                            aria-selected={i === palAt}
                                            className={`wf-cmd-row${i === palAt ? ' is-on' : ''}`}
                                            onMouseEnter={() => setPalSel(i)}
                                            onMouseDown={(e) => { e.preventDefault(); runPalette(item) }}
                                        >
                                            {item.type === 'action'
                                                ? <span className="wf-cmd-ico" aria-hidden="true">⚡</span>
                                                : item.type === 'set'
                                                    ? <span className="wf-cmd-ico" aria-hidden="true">❏</span>
                                                    : <Favicon url={item.type === 'tab' || item.type === 'bookmark' || item.type === 'history'
                                                        ? (item.subtitle.startsWith('http') ? item.subtitle : `https://${item.subtitle}`) : ''} className="wf-cmd-fav" />}
                                            <span className="wf-cmd-title">{item.title}</span>
                                            {item.subtitle && <span className="wf-cmd-sub">{item.subtitle}</span>}
                                            <span className={`wf-cmd-kind is-${item.type}`}>
                                                {{ tab: 'Tab', bookmark: '★', history: '↺', action: 'Action', set: 'Set' }[item.type]}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="wf-cmd-foot">
                                    <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
                                    <span><kbd>↵</kbd> open</span>
                                    <span><kbd>esc</kbd> close</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/*
                      * History has its own panel rather than a settings pane: it is a
                      * list you browse and pick from, not a setting you flip, and the
                      * address bar can only ever surface six of its rows.
                      */}
                    {showHistory && (
                        <div
                            className="wf-modal"
                            role="presentation"
                            onPointerDown={(e) => { if (e.target === e.currentTarget) setShowHistory(false) }}
                        >
                            <div
                                ref={panelRef}
                                className="wf-panel is-history"
                                role="dialog"
                                aria-modal="true"
                                aria-label="History"
                                onKeyDown={(e) => trapTab(e, panelRef.current)}
                            >
                                <header className="wf-panel-head">
                                    <h2>History</h2>
                                    <button type="button" className="wf-icon" onClick={() => setShowHistory(false)} aria-label="Close history" title="Close history">×</button>
                                </header>

                                <div className="wf-hist-tools">
                                    <input
                                        ref={histRef}
                                        className="wf-hist-search"
                                        type="search"
                                        value={histQuery}
                                        onChange={(e) => setHistQuery(e.target.value)}
                                        placeholder="Search visited pages"
                                        aria-label="Search visited pages"
                                        spellCheck="false"
                                        autoComplete="off"
                                    />
                                    <button type="button" className="btn ghost" disabled={!history.length} onClick={clearHistory}>Clear all</button>
                                </div>

                                <div className="wf-panel-body">
                                    {readingList.length > 0 && !histQuery.trim() && (
                                        <section className="wf-hist-day">
                                            <h3>Read later</h3>
                                            {readingList.map(r => (
                                                <div key={r.url} className="wf-hist-row">
                                                    <button
                                                        type="button"
                                                        className="wf-hist-open"
                                                        title={`${r.url}\nOpens and removes it from the list`}
                                                        onClick={() => openFromReadingList(r.url)}
                                                    >
                                                        <Favicon url={r.url} className="wf-bm-fav" />
                                                        <span className="wf-hist-title">{r.label}</span>
                                                        <span className="wf-hist-url">{r.url.replace(/^https?:\/\//i, '').replace(/^www\./, '')}</span>
                                                        <span className="wf-hist-time">Open</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="wf-icon"
                                                        onClick={() => removeFromReadingList(r.url)}
                                                        aria-label={`Remove ${tabLabel(r.url)} from reading list`}
                                                        title="Remove from reading list"
                                                    >×</button>
                                                </div>
                                            ))}
                                        </section>
                                    )}
                                    {closed.length > 0 && !histQuery.trim() && (
                                        <section className="wf-hist-day">
                                            <h3>Recently closed</h3>
                                            {closed.map((c, i) => {
                                                const u = c.stack[c.idx]
                                                return (
                                                    <div key={`${u}:${i}`} className="wf-hist-row">
                                                        <button
                                                            type="button"
                                                            className="wf-hist-open"
                                                            title={`${u}\nReopens with its back history`}
                                                            onClick={() => { setShowHistory(false); reopenAt(i) }}
                                                        >
                                                            <Favicon url={u} className="wf-bm-fav" />
                                                            <span className="wf-hist-title">{tabTitle(u)}</span>
                                                            <span className="wf-hist-url">{u.replace(/^https?:\/\//i, '').replace(/^www\./, '')}</span>
                                                            <span className="wf-hist-time">Reopen</span>
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </section>
                                    )}
                                    {!history.length && !readingList.length && !closed.length && (
                                        <p className="hint">
                                            Nothing yet. Pages you open in the viewer are listed here — on this device only,
                                            never in the browser&apos;s own history.
                                        </p>
                                    )}
                                    {history.length > 0 && !histGroups.length && (
                                        <p className="hint">No visited page matches “{histQuery.trim()}”.</p>
                                    )}
                                    {histGroups.map(group => (
                                        <section key={group.label} className="wf-hist-day">
                                            <h3>{group.label}</h3>
                                            {group.items.map(h => (
                                                <div key={h.url} className="wf-hist-row">
                                                    <button
                                                        type="button"
                                                        className="wf-hist-open"
                                                        title={`${h.url}\n${MOD_LABEL}click or middle-click opens a new tab`}
                                                        onClick={(e) => {
                                                            if (e.metaKey || e.ctrlKey) { openInBackground(h.url); return }
                                                            setShowHistory(false)
                                                            go(h.url)
                                                        }}
                                                        onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); openInBackground(h.url) } }}
                                                    >
                                                        <Favicon url={h.url} className="wf-bm-fav" />
                                                        <span className="wf-hist-title">{tabTitle(h.url)}</span>
                                                        <span className="wf-hist-url">{h.url.replace(/^https?:\/\//i, '').replace(/^www\./, '')}</span>
                                                        {h.visits > 1 && <span className="wf-hist-count" title={`${h.visits} visits`}>×{h.visits}</span>}
                                                        <span className="wf-hist-time">
                                                            {h.last ? new Date(h.last).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="wf-icon"
                                                        onClick={() => forgetPage(h.url)}
                                                        aria-label={`Forget ${tabLabel(h.url)}`}
                                                        title="Forget this page"
                                                    >×</button>
                                                </div>
                                            ))}
                                        </section>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {showOverview && (
                        <div className="wf-modal" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) setShowOverview(false) }}>
                            <div className="wf-panel is-overview" role="dialog" aria-modal="true" aria-label="All tabs" onKeyDown={(e) => trapTab(e, e.currentTarget)}>
                                <header className="wf-panel-head">
                                    <h2>All tabs ({tabs.length})</h2>
                                    <button type="button" className="wf-icon" onClick={() => setShowOverview(false)} aria-label="Close overview" title="Close">×</button>
                                </header>
                                <div className="wf-overview-grid">
                                    {tabs.map(t => {
                                        const u = urlOf(t)
                                        const g = t.groupId != null ? groups.find(x => x.id === t.groupId) : null
                                        return (
                                            <div key={t.id} className={`wf-ov-tile${t.id === active.id ? ' is-active' : ''}`}>
                                                <button
                                                    type="button"
                                                    className="wf-ov-open"
                                                    onClick={() => { selectTab(t.id); setShowOverview(false) }}
                                                    title={u || 'New tab'}
                                                >
                                                    <span className="wf-ov-top">
                                                        {t.private ? <span aria-hidden="true">🕶</span> : <Favicon url={u} className="wf-bm-fav" />}
                                                        {g && <span className="wf-group-dot" style={{ background: g.color }} title={g.name} aria-hidden="true" />}
                                                        {t.pinned && <span className="wf-ov-pin" aria-hidden="true" title="Pinned">📌</span>}
                                                    </span>
                                                    <span className="wf-ov-title">{t.private && !u ? 'Private tab' : tabTitle(u)}</span>
                                                    <span className="wf-ov-url">{u ? u.replace(/^https?:\/\//i, '').replace(/^www\./, '') : 'New tab page'}</span>
                                                </button>
                                                {!t.pinned && (
                                                    <button type="button" className="wf-ov-x" onClick={() => closeTab(t.id)} aria-label={`Close ${tabLabel(u)}`} title="Close tab">×</button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {qrFor && (() => {
                        const qr = qrMatrix(qrFor)
                        if (!qr) return null
                        const { size: qs, modules } = qr
                        const quiet = 4, dim = qs + quiet * 2
                        return (
                            <div className="wf-modal" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) setQrFor(null) }}>
                                <div className="wf-panel is-qr" role="dialog" aria-modal="true" aria-label="QR code" onKeyDown={(e) => trapTab(e, e.currentTarget)}>
                                    <header className="wf-panel-head">
                                        <h2>Scan to open on your phone</h2>
                                        <button type="button" className="wf-icon" onClick={() => setQrFor(null)} aria-label="Close QR code" title="Close">×</button>
                                    </header>
                                    <svg className="wf-qr" viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${qrFor}`}>
                                        <rect x="0" y="0" width={dim} height={dim} fill="#fff" />
                                        {modules.flatMap((row, r) => row.map((on, c) => on
                                            ? <rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width="1" height="1" fill="#000" />
                                            : null))}
                                    </svg>
                                    <p className="wf-qr-url">{qrFor.replace(/^https?:\/\//i, '').replace(/^www\./, '')}</p>
                                </div>
                            </div>
                        )
                    })()}

                    {/* Indeterminate: a cross-origin frame reports no progress, only
                        that it finished, so this shows activity rather than a fraction. */}
                    {loading[active.id] && <div className="wf-progress" role="progressbar" aria-label="Loading page" />}

                    {offline && (
                        <div className="wf-offline" role="status">
                            No network — pages won&apos;t load until the connection is back.
                        </div>
                    )}

                    <div className={`wf-stage${resizing ? ' is-resizing' : ''}${splitActive ? ' is-split' : ''}`}>
                        {tabs.map(t => {
                            const u = urlOf(t)
                            if (!u || isBlocked(u)) return null
                            // Asleep: no frame in the DOM until this tab is active again.
                            if (!liveIds.has(t.id)) return null
                            // The stack holds the page a person typed; the frame gets the
                            // embeddable form of it where the site publishes one.
                            const src = embedUrl(u) || u
                            const frameKey = `${t.id}:${t.idx}:${t.nonce}:${src}`
                            const isLeft = t.id === active.id
                            const isRight = splitActive && t.id === splitId
                            const shown = isLeft || isRight
                            // In split each pane owns half the width, so per-site zoom (which
                            // resizes the frame) is set aside there and resumes in full view.
                            const z = (splitActive && shown) ? 1 : zoomFor(zooms, u)
                            return (
                                <iframe
                                    key={frameKey}
                                    className={`wf-frame${shown ? '' : ' is-hidden'}${splitActive && isLeft ? ' is-left' : ''}${isRight ? ' is-right' : ''}`}
                                    /*
                                     * Scaling the frame and giving it the inverse size is real
                                     * zoom, not magnification: the page is handed a wider
                                     * viewport and reflows into it, exactly as it would at a
                                     * bigger window. Nothing inside a cross-origin document is
                                     * touched, which is the only way this can work at all.
                                     */
                                    style={z === 1 ? undefined : {
                                        width: `${100 / z}%`,
                                        height: `${100 / z}%`,
                                        transform: `scale(${z})`,
                                        transformOrigin: '0 0'
                                    }}
                                    src={src}
                                    title={`Web viewer tab ${tabLabel(u)}`}
                                    /*
                                     * Ordinary pages get no referrer at all. An official embed is
                                     * the exception: YouTube checks the referring origin before it
                                     * will play, and answers "Error 153 — video player
                                     * configuration error" to a frame that sends none. "origin"
                                     * discloses the bare scheme and host, never the page, and only
                                     * for an embed we deliberately opted into.
                                     */
                                    referrerPolicy={src === u ? 'no-referrer' : 'origin'}
                                    /*
                                     * pointer-lock and gamepad are here for in-frame games and 3D
                                     * viewers: clicking to look around calls requestPointerLock(),
                                     * which a sandbox silently denies without allow-pointer-lock — so
                                     * the click seems to do nothing and the page feels dead.
                                     */
                                    allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture; autoplay; pointer-lock; gamepad"
                                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals allow-pointer-lock"
                                    // load fires for a blocked page too, so this only ever means
                                    // "the browser stopped fetching", which is all it claims.
                                    onLoad={() => setLoading(l => (l[t.id] ? { ...l, [t.id]: false } : l))}
                                />
                            )
                        })}

                        {/* Split view: a floating strip over the right pane names it and
                            offers ⇄ (drive that side) and ✕ (end the split). */}
                        {splitActive && (
                            <div className="wf-split-bar">
                                <Favicon url={splitUrl} className="wf-bm-fav" />
                                <span className="wf-split-title">{splitTab.private ? 'Private tab' : tabTitle(splitUrl)}</span>
                                <button type="button" className="wf-icon" onClick={swapSplit} title="Drive this pane (swap sides)" aria-label="Swap split sides">⇄</button>
                                <button type="button" className="wf-icon" onClick={() => { setSplitId(null); say('Split view off') }} title="Close split view" aria-label="Close split view">✕</button>
                            </div>
                        )}
                        {splitActive && (!splitUrl || isBlocked(splitUrl)) && (
                            <div className="wf-split-empty" role="status">
                                {splitUrl
                                    ? <>This page can’t be shown here. Use <b>⇄</b> to drive this pane, or close the split.</>
                                    : <>This tab is empty. Use <b>⇄</b> to drive this pane and open a page.</>}
                            </div>
                        )}

                        {/*
                          * A page that refuses framing used to leave a blank pane under a
                          * one-line warning. This says what happened and offers the two
                          * things that actually move it forward.
                          */}
                        {blocked && (
                            <div className="wf-blocked" role="status">
                                <span className="wf-blocked-icon" aria-hidden="true">{handedOff === current ? '↗' : '🔒'}</span>
                                <h2>
                                    {handedOff === current
                                        ? `${hostOf(current).replace(/^www\./, '')} opened in a separate window`
                                        : `${hostOf(current).replace(/^www\./, '')} won't open in here`}
                                </h2>
                                <p>
                                    It sends a header telling browsers not to display it inside another
                                    page. Every browser obeys that, so no site can embed it — this is the
                                    site&apos;s choice, not a limit of the viewer. A popup, though, is a
                                    window of its own rather than a frame, so the live page opens there.
                                    {handedOff === current && <> Check your other windows.</>}
                                </p>
                                <div className="wf-blocked-actions">
                                    {/* One click to the live page in its own window — a popup is
                                        top-level, so the framing header doesn't apply to it. */}
                                    <button
                                        type="button"
                                        className="btn primary"
                                        onClick={() => {
                                            if (openPopup(current)) { setHandedOff(current); say(`Opened ${tabLabel(current)} in a popup window`) }
                                            else say('Your browser blocked the popup — allow popups for this page and try again.')
                                        }}
                                    >{handedOff === current ? 'Open the popup again ↗' : 'Open live in a popup ↗'}</button>
                                    <a className="btn ghost" href={current} target="_blank" rel="noreferrer noopener">New tab instead</a>
                                    {waybackUrl(current) && (
                                        <button type="button" className="btn ghost" onClick={() => go(waybackUrl(current))}>
                                            Read the archived copy
                                        </button>
                                    )}
                                    {active.idx > 0 && (
                                        <button type="button" className="btn ghost" onClick={back}>Go back</button>
                                    )}
                                </div>
                                {/* One-time rule: skip this screen for this host from now on. */}
                                <label className="wf-blocked-rule">
                                    <input
                                        type="checkbox"
                                        checked={hostListed(popupHosts, current)}
                                        onChange={(e) => {
                                            setPopupHosts(l => toggleHost(l, current, e.target.checked))
                                            say(e.target.checked
                                                ? `${hostOf(current).replace(/^www\./, '')} will always open in a popup`
                                                : `${hostOf(current).replace(/^www\./, '')} follows the default again`)
                                        }}
                                    />
                                    <span>Always open {hostOf(current).replace(/^www\./, '')} in a popup</span>
                                </label>
                                <p className="wf-blocked-alt">
                                    The popup is the real, live site — its own window, its own session. The
                                    archived copy stays in here but comes from the Internet Archive, so it may
                                    be out of date and you are not signed in to anything on it.
                                </p>
                                {/* Google Search is the usual way people land here. */}
                                {/google\./i.test(hostOf(current)) && searchTermOf(current) && (
                                    <p className="wf-blocked-alt">
                                        Searching for <b>{searchTermOf(current)}</b>?{' '}
                                        <button
                                            type="button"
                                            className="auth-link"
                                            onClick={() => go(search(searchTermOf(current)))}
                                        >Run that search in here instead</button>
                                    </p>
                                )}
                                {/(youtube|youtu\.be)/i.test(hostOf(current)) && (
                                    <p className="wf-blocked-alt">
                                        Individual YouTube <b>videos</b> do play in here — open one and it
                                        switches to the embedded player automatically. Channels, search and
                                        the home page cannot be embedded.
                                    </p>
                                )}
                            </div>
                        )}

                        {!current && (
                            <div
                                className={`wf-ntp tile-${prefs.tileSize}${prefs.newTabBg ? ' has-bg' : ''}`}
                                style={prefs.newTabBg ? { backgroundImage: `url("${prefs.newTabBg}")` } : undefined}
                            >
                                {/* Lumen aurora — the brand glow behind the page; hidden when a
                                    custom background image is set so it never fights it. */}
                                {!prefs.newTabBg && <div className="wf-ntp-aurora" aria-hidden="true" />}
                                <div className="wf-ntp-inner">
                                    {prefs.ntpTitle && <div className="wf-ntp-orb" aria-hidden="true" />}
                                    {prefs.showNtpClock && (
                                        <div className="wf-ntp-clock">
                                            <span className="wf-ntp-time">{new Date(clock).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                            <span className="wf-ntp-greet">{greeting(new Date(clock).getHours())} · {new Date(clock).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                                        </div>
                                    )}
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
                                            <div key={b.url} className={`wf-tile-wrap${bmDrag === b.url ? ' is-dragging' : ''}`}>
                                                <button
                                                    type="button"
                                                    className="wf-tile"
                                                    onClick={() => openOrSwitch(b.url)}
                                                    title={`${b.url}\ndrag to reorder`}
                                                    {...bmDragProps(b.url)}
                                                >
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

                                    {prefs.showNtpTop && topRow.length > 0 && (
                                        <div className="wf-ntp-top">
                                            <p className="wf-ntp-sub">Frequently visited</p>
                                            <div className="wf-tiles">
                                                {topRow.map(t => (
                                                    <div key={t.url} className="wf-tile-wrap">
                                                        <button
                                                            type="button"
                                                            className="wf-tile"
                                                            onClick={(e) => (e.metaKey || e.ctrlKey ? openInBackground(t.url) : openOrSwitch(t.url))}
                                                            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); openInBackground(t.url) } }}
                                                            title={`${t.url}\n${t.visits} ${t.visits === 1 ? 'visit' : 'visits'}`}
                                                        >
                                                            <span className="wf-tile-icon"><Favicon url={t.url} className="wf-tile-fav" /></span>
                                                            <span className="wf-tile-label">{t.label}</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="wf-tile-x"
                                                            onClick={() => forgetPage(t.url)}
                                                            aria-label={`Forget ${t.label}`}
                                                            title="Forget this page"
                                                        >×</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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

                                    {prefs.showNtpScratch && (
                                        <div className="wf-ntp-scratch">
                                            <label className="wf-scratch-head" htmlFor="wf-scratch">
                                                <span aria-hidden="true">✎</span> Scratchpad
                                            </label>
                                            <textarea
                                                id="wf-scratch"
                                                className="wf-scratch-box"
                                                value={note}
                                                onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                                                placeholder="Jot a formula, an answer, a link to come back to…"
                                                aria-label="Scratchpad — a note kept with your profile"
                                                spellCheck="false"
                                                rows={3}
                                            />
                                        </div>
                                    )}

                                    {prefs.showNtpNote && (
                                        <p className="wf-ntp-note">
                                            Nothing here touches the page URL or your browser history. Sites that send
                                            X-Frame-Options (Google, YouTube, GitHub…) cannot be embedded by any page, so
                                            those open in a browser tab of their own — or read the Internet Archive&apos;s
                                            copy of one in here.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {toast && <div className="wf-toast" role="status" aria-live="polite">{toast}</div>}

                {tabMenu}

                {!maximized && !isFullscreen && (
                    <>
                        {GRIPS.map(([mode, cursor]) => (
                            <div
                                key={mode}
                                className={`wf-grip is-${mode}`}
                                style={{ cursor }}
                                onPointerDown={startGrab(mode)}
                                aria-hidden="true"
                            />
                        ))}
                        {/* the visible corner notch, on top of the 'se' grip */}
                        <div className="wf-resize" onPointerDown={startGrab('se')} title="Drag to resize" aria-hidden="true" />
                    </>
                )}
            </div>
        </div>
    )
}

export default WebFrame

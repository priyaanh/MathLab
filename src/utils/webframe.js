/**
 * Address-bar logic for the in-page web viewer, kept pure so `npm test` covers it.
 */

/*
 * Search engines that allow being framed. Google/Bing/DuckDuckGo all refuse.
 *
 * An entry has to be reachable AND frameable AND free of a bot wall, or a search
 * lands on a blank pane and the viewer looks broken. Three failed one of those:
 * search.disroot.org answers 429 to public traffic, old.search.marginalia.nu no
 * longer resolves, and searx.be serves an "automated verification" interstitial
 * instead of results. The first two ids are gone on purpose — sanitizePrefs only
 * keeps an id still listed here, so saved prefs pointing at them heal to the
 * default. searx.be stays as a choice since its wall may pass on other networks,
 * but it is no longer what anyone gets by default.
 */
export const ENGINES = [
    { id: 'marginalia', name: 'Marginalia', q: (s) => `https://search.marginalia.nu/search?query=${encodeURIComponent(s)}` },
    { id: 'wikipedia', name: 'Wikipedia', q: (s) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(s)}` },
    { id: 'wiby', name: 'Wiby', q: (s) => `https://wiby.me/?q=${encodeURIComponent(s)}` },
    { id: 'searxbe', name: 'searx.be', q: (s) => `https://searx.be/search?q=${encodeURIComponent(s)}` }
]

/**
 * Hosts that send X-Frame-Options / frame-ancestors. Nothing on the page can
 * override those headers, so we warn instead of showing a blank frame.
 */
const BLOCKS_FRAMING = /^(www\.|m\.|old\.)?(google|youtube|bing|duckduckgo|github|stackoverflow|reddit|instagram|facebook|twitter|amazon|netflix|tiktok|discord|roblox|linkedin|openstreetmap|wolframalpha|startpage|ecosia|qwant|mojeek)\.[a-z.]+$/i

export const hostOf = (url) => { try { return new URL(url).hostname } catch { return '' } }

export const blocksFraming = (url) => {
    const host = hostOf(url)
    return !!host && (BLOCKS_FRAMING.test(host) || /(^|\.)x\.com$/i.test(host) || /(^|\.)google\./i.test(host))
}

/** "wikipedia.org/wiki/Pi" -> a URL; "why is pi irrational" -> a search. */
export const toUrl = (raw, engineId) => {
    const text = String(raw ?? '').trim()
    if (!text) return null
    if (/^https?:\/\//i.test(text)) return text
    if (/^javascript:/i.test(text)) return null // never hand the frame a script URL
    if (/^[^\s/]+\.[a-z]{2,}([/?#]|$)/i.test(text)) return `https://${text}`
    const engine = ENGINES.find(e => e.id === engineId) || ENGINES[0]
    return engine.q(text)
}

/** A short tab label — the bare host, without the www. */
export const tabLabel = (url) => {
    const host = hostOf(url)
    return host ? host.replace(/^www\./, '') : 'New tab'
}

/* ---- customisation ----------------------------------------------------- */

export const TILE_SIZES = ['small', 'medium', 'large']

export const DEFAULT_PREFS = {
    home: '',
    engine: 'marginalia',
    closeKey: '`',
    density: 'normal',
    newTabOpensHome: false,
    bookmarksBar: true,
    verticalTabs: true,
    railWidth: 210,
    newTabBg: '',
    accent: '',
    ntpTitle: 'MathLab',
    tileSize: 'medium',
    showNtpSearch: true,
    showNtpNote: true,
    bookmarks: [
        { label: 'Wikipedia', url: 'https://en.wikipedia.org' },
        { label: 'Khan Academy', url: 'https://www.khanacademy.org' },
        { label: 'Archive.org', url: 'https://archive.org' }
    ]
}

/**
 * Bookmarks that shipped in DEFAULT_PREFS once and no longer do. A list saved by
 * an older build still holds them, so they are dropped a single time — the caller
 * records that it ran, and one deliberately re-added later is then left alone.
 */
export const RETIRED_DEFAULTS = ['https://www.desmos.com/calculator']

export const pruneRetiredDefaults = (marks) =>
    (Array.isArray(marks) ? marks : []).filter(b => !RETIRED_DEFAULTS.includes(String(b?.url || '').trim()))

/**
 * Black or white, whichever stays legible on a chosen accent. Uses the sRGB
 * luminance weights so a mid-yellow gets dark text and a mid-blue gets light.
 * Anything that is not a hex colour falls back to white.
 */
export const readableOn = (hex) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim())
    if (!m) return '#ffffff'
    const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#111111' : '#ffffff'
}

/**
 * A stable hue per string, so a site whose /favicon.ico is missing still gets an
 * icon of its own colour instead of a wall of identical grey letters.
 */
export const hueFor = (str) => {
    const s = String(str ?? '')
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
    return h
}

export const MAX_BOOKMARKS = 60
export const MAX_TABS = 12
export const MAX_STACK = 50
export const MIN_RAIL = 120
export const MAX_RAIL = 460

export const clampRail = (w) => {
    const n = Number(w)
    if (!Number.isFinite(n)) return DEFAULT_PREFS.railWidth
    return Math.round(Math.min(MAX_RAIL, Math.max(MIN_RAIL, n)))
}

/**
 * The saved session: which tabs were open, each one's history, and which was in
 * front. Restored on open so closing with the panic key loses nothing.
 * Returns null when there is nothing usable to restore.
 */
export const sanitizeSession = (raw) => {
    const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null
    if (!s || !Array.isArray(s.tabs)) return null

    const tabs = s.tabs
        .filter(t => t && typeof t === 'object' && Array.isArray(t.stack))
        .map(t => {
            const stack = t.stack
                .filter(u => typeof u === 'string' && /^https?:\/\/\S+$/i.test(u))
                .slice(-MAX_STACK)
            if (!stack.length) return { stack: [], idx: -1 }
            const idx = Number.isInteger(t.idx) ? Math.min(Math.max(t.idx, 0), stack.length - 1) : stack.length - 1
            return { stack, idx }
        })
        .slice(0, MAX_TABS)

    if (!tabs.length || tabs.every(t => t.idx < 0)) return null
    const active = Number.isInteger(s.active) && s.active >= 0 && s.active < tabs.length ? s.active : 0
    return { tabs, active }
}

/**
 * Bookmarks are kept under their own storage key and never expire, so a settings
 * reset or a corrupt prefs blob can't take them with it. Duplicates are dropped.
 */
export const sanitizeBookmarks = (raw) => {
    const seen = new Set()
    return (Array.isArray(raw) ? raw : [])
        .filter(b => b && typeof b === 'object' && /^https?:\/\/\S+$/i.test(String(b.url || '')))
        .map(b => ({
            url: String(b.url).trim(),
            label: (typeof b.label === 'string' && b.label.trim() ? b.label.trim() : tabLabel(b.url)).slice(0, 40)
        }))
        .filter(b => (seen.has(b.url) ? false : seen.add(b.url)))
        .slice(0, MAX_BOOKMARKS)
}

/** Everything here can come from hand-edited localStorage, so nothing is trusted. */
export const sanitizePrefs = (raw) => {
    const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}

    const url = (v, fallback) => (/^https?:\/\/\S+$/i.test(String(v || '')) ? String(v).trim() : fallback)
    const home = url(p.home, DEFAULT_PREFS.home) // '' means the new-tab page
    const engine = ENGINES.some(e => e.id === p.engine) ? p.engine : DEFAULT_PREFS.engine
    const closeKey = typeof p.closeKey === 'string' && [...p.closeKey].length === 1
        ? p.closeKey
        : DEFAULT_PREFS.closeKey
    const density = p.density === 'compact' ? 'compact' : 'normal'

    // '' means "follow the site theme"; anything else must be a plain hex colour,
    // since this value is written straight into a style attribute.
    const accent = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(p.accent || '').trim())
        ? String(p.accent).trim()
        : DEFAULT_PREFS.accent
    // an empty title is a real choice (no wordmark), so only a non-string resets it
    const ntpTitle = typeof p.ntpTitle === 'string' ? p.ntpTitle.slice(0, 32) : DEFAULT_PREFS.ntpTitle
    const tileSize = TILE_SIZES.includes(p.tileSize) ? p.tileSize : DEFAULT_PREFS.tileSize

    const bookmarks = sanitizeBookmarks(Array.isArray(p.bookmarks) ? p.bookmarks : DEFAULT_PREFS.bookmarks)

    return {
        home,
        engine,
        closeKey,
        density,
        newTabOpensHome: p.newTabOpensHome === true && !!home,
        bookmarksBar: p.bookmarksBar !== false,
        verticalTabs: p.verticalTabs !== false,
        railWidth: clampRail(p.railWidth ?? DEFAULT_PREFS.railWidth),
        newTabBg: url(p.newTabBg, DEFAULT_PREFS.newTabBg),
        accent,
        ntpTitle,
        tileSize,
        showNtpSearch: p.showNtpSearch !== false,
        showNtpNote: p.showNtpNote !== false,
        bookmarks
    }
}

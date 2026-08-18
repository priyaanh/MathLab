/**
 * Address-bar logic for the in-page web viewer, kept pure so `npm test` covers it.
 */

/*
 * Search engines that allow being framed. Google/Bing/DuckDuckGo all refuse.
 *
 * An entry has to be reachable AND frameable AND free of a bot wall, or a search
 * lands on a blank pane and the viewer looks broken. Three failed one of those
 * and are gone: search.disroot.org answers 429 to public traffic,
 * old.search.marginalia.nu no longer resolves, and searx.be serves an "automated
 * verification" interstitial instead of results.
 *
 * Deleting the id is the point, not just dropping it down the list. sanitizePrefs
 * keeps any id still named here, so a saved pref pointing at a broken engine
 * would pin someone to a viewer that never returns a result — leaving it listed
 * as "might work on your network" is exactly how that happens. Removing it makes
 * those prefs fall back to the default on the next read.
 */
export const ENGINES = [
    { id: 'marginalia', name: 'Marginalia', q: (s) => `https://search.marginalia.nu/search?query=${encodeURIComponent(s)}` },
    { id: 'wikipedia', name: 'Wikipedia', q: (s) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(s)}` },
    { id: 'wiby', name: 'Wiby', q: (s) => `https://wiby.me/?q=${encodeURIComponent(s)}` }
]

/**
 * Hosts that send X-Frame-Options / frame-ancestors. Nothing on the page can
 * override those headers, so we warn instead of showing a blank frame.
 */
const BLOCKS_FRAMING = /^(www\.|m\.|old\.)?(google|youtube|bing|duckduckgo|github|stackoverflow|reddit|instagram|facebook|twitter|amazon|netflix|tiktok|discord|roblox|linkedin|openstreetmap|wolframalpha|startpage|ecosia|qwant|mojeek)\.[a-z.]+$/i

export const hostOf = (url) => { try { return new URL(url).hostname } catch { return '' } }

/**
 * Map a page to an officially embeddable version of itself, or null.
 *
 * Several big sites refuse framing for the page a person lands on but publish a
 * supported embed endpoint for the same content — YouTube's player, Google's
 * map and document previews. Using those is the difference between showing the
 * content and defeating a security control: X-Frame-Options exists to stop a
 * page being framed and clickjacked, and the answer to it is the embed the site
 * offers, never a proxy that strips the header off a session someone is logged
 * into. Where no such endpoint exists — Google Search above all — this returns
 * null and the viewer says so plainly instead of showing a blank pane.
 *
 * The real URL stays in the address bar, history and bookmarks; only what the
 * frame is pointed at changes.
 */
const ytEmbed = (id, start) => {
    if (!/^[\w-]{6,20}$/.test(id)) return null
    // nocookie host, consistent with the viewer sending no referrer either
    const t = start && /^\d+$/.test(String(start).replace(/s$/, '')) ? String(start).replace(/s$/, '') : ''
    return `https://www.youtube-nocookie.com/embed/${id}${t ? `?start=${t}` : ''}`
}

export const embedUrl = (raw) => {
    let u
    try { u = new URL(String(raw || '')) } catch { return null }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    const host = u.hostname.replace(/^(www|m)\./i, '').toLowerCase()

    /* ---- YouTube: the player is designed to be embedded ---- */
    if (host === 'youtu.be') {
        const id = u.pathname.split('/').filter(Boolean)[0]
        return id ? ytEmbed(id, u.searchParams.get('t')) : null
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (u.pathname.startsWith('/embed/')) return u.href      // already an embed
        if (u.pathname === '/watch') return ytEmbed(u.searchParams.get('v') || '', u.searchParams.get('t'))
        if (u.pathname.startsWith('/shorts/')) return ytEmbed(u.pathname.split('/')[2] || '')
        if (u.pathname === '/playlist') {
            const list = u.searchParams.get('list')
            return list && /^[\w-]{2,64}$/.test(list)
                ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}`
                : null
        }
        return null // channels, search and the home page are not embeddable
    }

    /* ---- Google Docs, Sheets, Slides, Drive: /preview is the embed form ---- */
    if (host === 'docs.google.com' || host === 'drive.google.com') {
        const m = u.pathname.match(/^\/(document|spreadsheets|presentation|file)\/d\/([\w-]+)/)
        if (m) return `https://${u.hostname}/${m[1]}/d/${m[2]}/preview`
        return null
    }

    /* ---- Google Maps: the documented output=embed form ---- */
    if (host === 'google.com' && u.pathname.startsWith('/maps')) {
        const place = u.pathname.match(/\/maps\/place\/([^/]+)/)
        const q = u.searchParams.get('q') || u.searchParams.get('query') || (place ? decodeURIComponent(place[1]) : '')
        if (q) return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`
        const at = u.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
        if (at) return `https://maps.google.com/maps?q=${at[1]},${at[2]}&output=embed`
        return null
    }

    return null
}

/** True when a page can only be reached by opening it outside the viewer. */
export const isBlocked = (url) => !!url && blocksFraming(url) && !embedUrl(url)

/** The query behind a search-results URL, so it can be re-run somewhere embeddable. */
export const searchTermOf = (url) => {
    try {
        const p = new URL(url).searchParams
        return (p.get('q') || p.get('query') || p.get('search') || '').trim().slice(0, 120)
    } catch { return '' }
}

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
export const MAX_HISTORY = 200
/** How many tabs can be reopened after closing, newest first. */
export const MAX_CLOSED = 10

/**
 * Places visited in the viewer, newest first. This is the viewer's own list and
 * never touches the browser's history — it exists so the address bar can suggest
 * somewhere you have already been, and the Privacy pane can throw it away.
 */
export const sanitizeHistory = (raw) => {
    const seen = new Set()
    return (Array.isArray(raw) ? raw : [])
        .filter(h => h && typeof h === 'object' && /^https?:\/\/\S+$/i.test(String(h.url || '')))
        .map(h => ({
            url: String(h.url).trim(),
            visits: Number.isFinite(h.visits) && h.visits > 0 ? Math.min(9999, Math.floor(h.visits)) : 1,
            last: Number.isFinite(h.last) && h.last > 0 ? h.last : 0
        }))
        .filter(h => (seen.has(h.url) ? false : seen.add(h.url)))
        .sort((a, b) => b.last - a.last)
        .slice(0, MAX_HISTORY)
}

/** Bump an entry to the front, keeping its visit count. Pure: returns a new list. */
export const recordVisit = (history, url, now) => {
    if (!/^https?:\/\/\S+$/i.test(String(url || ''))) return history
    const rest = history.filter(h => h.url !== url)
    const prev = history.find(h => h.url === url)
    return [{ url, visits: (prev?.visits || 0) + 1, last: now }, ...rest].slice(0, MAX_HISTORY)
}

/**
 * A readable title from the last path segment: "/wiki/Pythagorean_theorem"
 * becomes "Pythagorean theorem". History rows otherwise show the bare host in
 * both columns, which makes two pages on one site indistinguishable.
 * Returns '' for a bare host, where the host itself is the best label.
 */
export const prettyPath = (url) => {
    try {
        const last = new URL(url).pathname.split('/').filter(Boolean).pop()
        if (!last) return ''
        return decodeURIComponent(last)
            .replace(/\.[a-z0-9]{2,5}$/i, '') // trailing .html and friends
            .replace(/[_+-]+/g, ' ')
            .trim()
            .slice(0, 60)
    } catch { return '' }
}

/**
 * Address-bar suggestions drawn from bookmarks and previous visits.
 *
 * Scoring favours the host over the label, because a host is what someone is
 * usually reaching for when they start typing. Bookmarks outrank bare history at
 * equal match quality, and a frequently visited page climbs within history.
 * Returns [] for a blank query so the dropdown stays shut until it is useful.
 */
export const rankSuggestions = (query, { bookmarks = [], history = [] } = {}, limit = 6) => {
    const q = String(query ?? '').trim().toLowerCase()
    if (!q) return []

    const score = (url, label) => {
        const host = hostOf(url).replace(/^www\./, '').toLowerCase()
        const lab = String(label || '').toLowerCase()
        let s = 0
        if (host.startsWith(q)) s += 50
        else if (host.includes(q)) s += 25
        if (lab.startsWith(q)) s += 30
        else if (lab.includes(q)) s += 15
        // a match anywhere in the full URL still counts, just barely
        if (!s && String(url).toLowerCase().includes(q)) s += 10
        return s
    }

    const out = new Map()
    for (const b of Array.isArray(bookmarks) ? bookmarks : []) {
        const s = score(b?.url, b?.label)
        if (s) out.set(b.url, { url: b.url, label: b.label || tabLabel(b.url), kind: 'bookmark', score: s + 20 })
    }
    for (const h of Array.isArray(history) ? history : []) {
        const title = prettyPath(h?.url) || tabLabel(h?.url)
        // Match on the readable title too, so "pythag" finds /wiki/Pythagorean_theorem.
        const s = Math.max(score(h?.url, tabLabel(h?.url)), score(h?.url, title))
        if (!s) continue
        const total = s + Math.min(10, h.visits || 1)
        const prev = out.get(h.url)
        // Already bookmarked: keep the bookmark badge, take the better score.
        if (prev) { if (total > prev.score) out.set(h.url, { ...prev, score: total }) }
        else out.set(h.url, { url: h.url, label: title, kind: 'history', score: total })
    }

    return [...out.values()]
        .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
        .slice(0, Math.max(0, limit))
}
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

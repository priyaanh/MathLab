/**
 * Address-bar logic for the in-page web viewer, kept pure so `npm test` covers it.
 */

/*
 * Search engines that allow being framed. Google/Bing/DuckDuckGo all refuse.
 *
 * An entry has to be reachable AND frameable AND free of a bot wall, or a search
 * lands on a blank pane and the viewer looks broken. Each one here was checked by
 * reading its response headers: no X-Frame-Options, no frame-ancestors.
 *
 * Several failed one of those and are gone: search.disroot.org answers 429 to
 * public traffic, old.search.marginalia.nu no longer resolves, searx.be serves an
 * "automated verification" interstitial, and every public SearXNG/4get instance
 * checked sends frame-ancestors 'self'. Mojeek, Startpage, Ecosia, Qwant and
 * Brave Search all refuse framing outright.
 *
 * Deleting the id is the point, not just dropping it down the list. sanitizePrefs
 * keeps any id still named here, so a saved pref pointing at a broken engine
 * would pin someone to a viewer that never returns a result — leaving it listed
 * as "might work on your network" is exactly how that happens. Removing it makes
 * those prefs fall back to the default on the next read.
 */
export const ENGINES = [
    // marginalia moved house: search.marginalia.nu now 302s here, and a redirect
    // inside the frame is a round trip for nothing.
    { id: 'marginalia', name: 'Marginalia', q: (s) => `https://marginalia-search.com/search?query=${encodeURIComponent(s)}` },
    { id: 'wikipedia', name: 'Wikipedia', q: (s) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(s)}` },
    // two the rest of the web can't match on a maths site, and both allow framing
    { id: 'mathworld', name: 'MathWorld', q: (s) => `https://mathworld.wolfram.com/search/?query=${encodeURIComponent(s)}` },
    { id: 'oeis', name: 'OEIS (sequences)', q: (s) => `https://oeis.org/search?q=${encodeURIComponent(s)}` },
    { id: 'wiby', name: 'Wiby', q: (s) => `https://wiby.me/?q=${encodeURIComponent(s)}` }
]

/**
 * Sites that send X-Frame-Options / frame-ancestors. Nothing on the page can
 * override those headers, so we warn instead of showing a blank frame.
 *
 * Written as names rather than one long regex so the list stays readable and an
 * entry can be justified. Each is matched as a whole domain label, so a
 * subdomain is covered (search.brave.com, docs.github.com) while a host that
 * merely contains the word is not (mathworld.wolfram.com is frameable and must
 * keep working, which is why the list says wolframalpha and never wolfram).
 *
 * Every name here was confirmed by reading the site's own response headers. That
 * standard matters in both directions: a site left off shows a blank pane, but a
 * site listed by guesswork is turned away from a frame it would have accepted,
 * which is the more annoying failure because it looks deliberate. Six names that
 * had been guessed rather than measured — microsoft, zoom, baidu, imdb, ebay and
 * live — send no such header at all and have been dropped. Amazon stays: its
 * front page sends nothing, but product pages send SAMEORIGIN, and a product page
 * is where people actually land.
 */
const FRAMING_REFUSED = [
    // search
    'google', 'bing', 'duckduckgo', 'startpage', 'ecosia', 'qwant', 'mojeek',
    'brave', 'yandex',
    // social
    'reddit', 'instagram', 'facebook', 'twitter', 'threads', 'tiktok', 'linkedin',
    'pinterest', 'discord', 'telegram', 'whatsapp',
    // code + reference
    'github', 'gitlab', 'stackoverflow', 'stackexchange', 'arxiv', 'medium',
    'quora', 'wolframalpha', 'openstreetmap',
    // these refuse the page a reader lands on but publish an embed for the thing
    // itself, so embedUrl maps them and only the surrounding pages are walled
    'ted', 'observablehq', 'phet',
    // media + shopping
    'youtube', 'netflix', 'spotify', 'twitch', 'amazon', 'roblox',
    // apps + accounts
    'chatgpt', 'openai', 'claude', 'anthropic', 'notion', 'canva', 'figma',
    'dropbox', 'apple', 'office', 'slack', 'paypal'
]

const BLOCKS_FRAMING = new RegExp(`(^|\\.)(${FRAMING_REFUSED.join('|')})\\.[a-z.]{2,}$`, 'i')

export const hostOf = (url) => { try { return new URL(url).hostname } catch { return '' } }

/**
 * Map a page to an officially embeddable version of itself, or null.
 *
 * Several big sites refuse framing for the page a person lands on but publish a
 * supported embed endpoint for the same content — YouTube's player, Google's map
 * and document previews, Spotify's player, OpenStreetMap's export view, Reddit's
 * post embed.
 *
 * Using those is the difference between showing the content and defeating a
 * security control. X-Frame-Options exists to stop a page being framed and
 * clickjacked, and it is enforced by the browser, not by this file: nothing a
 * page can write overrides it. The only thing that would is a server that
 * refetches the site and strips the header before serving it from this origin,
 * and that is worse than it sounds — the content would no longer carry the
 * reader's cookies, so they would be logged out of everything, and the only way
 * to restore that is to have them type the site's password into our server. The
 * answer to a refused frame is the embed the site publishes, or a browser tab of
 * its own; never a proxy standing in the middle of somebody's session.
 *
 * Where no such endpoint exists — Google Search above all — this returns null and
 * the viewer says so plainly instead of showing a blank pane.
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
        // Forms are the exception in the family: no /preview path, but a documented
        // ?embedded=true that drops the surrounding Google chrome
        if (/^\/forms\/d\/(e\/)?[\w-]+\/viewform/.test(u.pathname)) {
            u.searchParams.set('embedded', 'true')
            return u.href
        }
        return null
    }

    /* ---- PhET: the description page refuses framing, the simulation does not ---- */
    if (host === 'phet.colorado.edu') {
        if (u.pathname.startsWith('/sims/')) return u.href   // already the runnable sim
        // /en/simulations/graphing-lines -> /sims/html/graphing-lines/latest/graphing-lines_en.html
        const m = u.pathname.match(/^\/[a-z]{2}\/simulations?\/([a-z0-9-]+)/i)
        return m ? `https://phet.colorado.edu/sims/html/${m[1]}/latest/${m[1]}_en.html` : null
    }

    /* ---- TED: talks have a published embed host, the rest of the site does not ---- */
    if (host === 'embed.ted.com') return u.href
    if (host === 'ted.com') {
        const m = u.pathname.match(/^\/talks\/([a-z0-9_]+)/i)
        return m ? `https://embed.ted.com/talks/${m[1]}` : null
    }

    /* ---- Observable: /embed/@user/notebook is the published form ---- */
    if (host === 'observablehq.com') {
        if (u.pathname.startsWith('/embed/')) return u.href
        const m = u.pathname.match(/^\/(@[\w-]+\/[\w-]+)/)
        return m ? `https://observablehq.com/embed/${m[1]}` : null
    }

    /* ---- arXiv: the abstract page refuses framing, the PDF does not ---- */
    if (host === 'arxiv.org') {
        // /abs/2301.00001v2 and /pdf/2301.00001v2 carry the same id, and the PDF
        // is the whole paper — which is what following a citation was for anyway
        const m = u.pathname.match(/^\/(?:abs|pdf)\/([\w.\-/]+?)(?:\.pdf)?$/)
        return m ? `https://arxiv.org/pdf/${m[1]}` : null
    }

    /* ---- Google Books: output=embed is the documented viewer ---- */
    if (host === 'books.google.com') {
        if (u.searchParams.get('output') === 'embed') return u.href
        const id = u.searchParams.get('id')
        return id && /^[\w-]{6,20}$/.test(id) ? `https://books.google.com/books?id=${id}&output=embed` : null
    }
    if (host === 'google.com' && u.pathname.startsWith('/books/edition/')) {
        // /books/edition/<title-or-underscore>/<id> — four segments, id is the last
        const id = u.pathname.split('/').filter(Boolean)[3]
        return id && /^[\w-]{6,20}$/.test(id) ? `https://books.google.com/books?id=${id}&output=embed` : null
    }

    /* ---- Google Calendar: only its published embed view ---- */
    if (host === 'calendar.google.com') {
        return u.pathname.startsWith('/calendar/embed') ? u.href : null
    }

    /* ---- SoundCloud and Dailymotion: their published players ---- */
    if (host === 'soundcloud.com') {
        // the player takes the track's own page address as its argument
        return u.pathname.split('/').filter(Boolean).length >= 2
            ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&visual=true`
            : null
    }
    if (host === 'dailymotion.com' || host === 'dai.ly') {
        const id = host === 'dai.ly'
            ? u.pathname.split('/').filter(Boolean)[0]
            : (u.pathname.match(/^\/video\/([a-z0-9]+)/i) || [])[1]
        return id && /^[a-z0-9]{5,20}$/i.test(id) ? `https://geo.dailymotion.com/player.html?video=${id}` : null
    }

    /* ---- Internet Archive: /embed/<item> is its reader ---- */
    if (host === 'archive.org') {
        if (u.pathname.startsWith('/embed/')) return u.href
        const m = u.pathname.match(/^\/details\/([\w.-]+)/)
        return m ? `https://archive.org/embed/${m[1]}` : null
    }

    /* ---- Spotify: /embed/<kind>/<id> is the published player ---- */
    if (host === 'open.spotify.com') {
        if (u.pathname.startsWith('/embed/')) return u.href
        const m = u.pathname.match(/^\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,40})/)
        return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null
    }

    /* ---- Reddit: a single post has an embed host; nothing else does ---- */
    if (host === 'embed.reddit.com') return u.href
    if (/^(old\.|new\.|np\.)?reddit\.com$/.test(host)) {
        const m = u.pathname.match(/^\/r\/([A-Za-z0-9_]{2,30})\/comments\/([a-z0-9]{4,12})/i)
        return m ? `https://embed.reddit.com/r/${m[1]}/comments/${m[2]}/` : null
    }

    /* ---- OpenStreetMap: the documented export/embed.html view ---- */
    if (host === 'openstreetmap.org') {
        if (u.pathname === '/export/embed.html') return u.href
        // the viewport lives in the fragment — #map=zoom/lat/lon — with ?mlat/?mlon
        // as the older marker form
        const at = /#?map=(\d{1,2})\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/.exec(u.hash)
        // read the raw strings first: Number(null) is 0, which would silently turn
        // a plain openstreetmap.org into a pin in the Atlantic at 0°N 0°E
        const rawLat = at ? at[2] : u.searchParams.get('mlat')
        const rawLon = at ? at[3] : u.searchParams.get('mlon')
        if (rawLat === null || rawLon === null || rawLat === '' || rawLon === '') return null
        const lat = Number(rawLat)
        const lon = Number(rawLon)
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
        const zoom = at ? Math.min(19, Math.max(1, Number(at[1]))) : 15
        // embed.html wants a box rather than a centre, so turn the zoom back into
        // a span: each level halves the width of the world on screen
        const lonSpan = 360 / (2 ** zoom)
        const round = (n) => Math.round(n * 1e5) / 1e5
        const bbox = [
            round(lon - lonSpan), round(lat - lonSpan / 2),
            round(lon + lonSpan), round(lat + lonSpan / 2)
        ].join(',')
        return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${round(lat)},${round(lon)}`
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

/**
 * "wikipedia.org/wiki/Pi" -> a URL; "why is pi irrational" -> a search.
 *
 * Anything shaped like a host — a dotted name, optionally with a port, a path, a
 * query or a fragment — is taken at face value and https:// is filled in, because
 * someone typing "apple.com" is asking to go to Apple and not to read about it.
 * The dot has to be followed by letters, so "what is 3.5 rounded" stays a search.
 */
export const toUrl = (raw, engineId, engines = ENGINES) => {
    const text = String(raw ?? '').trim()
    if (!text) return null
    if (/^https?:\/\//i.test(text)) return text
    if (/^javascript:/i.test(text)) return null // never hand the frame a script URL
    if (/^[^\s/]+\.[a-z]{2,}(:\d{1,5})?([/?#]|$)/i.test(text)) return `https://${text}`
    const list = Array.isArray(engines) && engines.length ? engines : ENGINES
    const engine = list.find(e => e.id === engineId) || list[0]
    return engine.q(text)
}

/* ---- custom search engines ---------------------------------------------- */

export const MAX_CUSTOM_ENGINES = 8

/**
 * User-added search engines. The URL is a template with a `%s` where the query
 * goes — the same convention every browser uses — and must be https, since the
 * query (which can be anything typed) is written straight into it.
 *
 * Unlike the built-in list, a custom engine may well refuse framing (Google,
 * DuckDuckGo): that is fine now, because a search that can't be embedded flows
 * through the same blocked-site handling as any other page — popup, ask, or the
 * archive — per the reader's choice.
 */
export const sanitizeEngines = (raw) => {
    const seen = new Set()
    const out = []
    for (const e of Array.isArray(raw) ? raw : []) {
        if (!e || typeof e !== 'object') continue
        const name = String(e.name || '').trim().slice(0, 24)
        const url = String(e.url || '').trim()
        // https, and a %s placeholder so there is somewhere to put the query
        if (!name || !/^https:\/\/\S*%s\S*$/i.test(url)) continue
        const key = url.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ id: `custom-${out.length}`, name, url })
        if (out.length >= MAX_CUSTOM_ENGINES) break
    }
    return out
}

/** A custom engine as a runnable {id,name,q}, matching the built-in shape. */
const asEngine = (e) => ({ id: e.id, name: e.name, q: (s) => e.url.replace(/%s/gi, encodeURIComponent(String(s ?? ''))) })

/** The built-in engines followed by the reader's own, ready for toUrl/selects. */
export const allEngines = (custom) => [...ENGINES, ...sanitizeEngines(custom).map(asEngine)]

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
    customEngines: [],
    closeKey: '`',
    density: 'normal',
    newTabOpensHome: false,
    bookmarksBar: true,
    verticalTabs: true,
    sleepTabs: true,
    railWidth: 210,
    newTabBg: '',
    accent: '',
    ntpTitle: 'Lumen',
    tileSize: 'medium',
    showNtpSearch: true,
    showNtpNote: true,
    showNtpTop: true,
    showNtpClock: true,
    showNtpScratch: true,
    webSuggest: false,
    onBlocked: 'archive',
    confirmOpen: false,
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
export const rankSuggestions = (query, { bookmarks = [], history = [], open = [] } = {}, limit = 6) => {
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

    /*
     * A page that is already open is offered as "switch to it" rather than as a
     * tenth copy of itself — the same call every browser makes, and the reason it
     * outranks the bookmark and history rows for the same URL instead of joining
     * them: reopening something you are already looking at is never the intent.
     */
    for (const t of Array.isArray(open) ? open : []) {
        if (!t || !t.url) continue
        const s = Math.max(score(t.url, tabLabel(t.url)), score(t.url, prettyPath(t.url)))
        if (!s) continue
        const prev = out.get(t.url)
        out.set(t.url, {
            url: t.url,
            label: prettyPath(t.url) || tabLabel(t.url),
            kind: 'tab',
            tabId: t.id,
            score: Math.max(s, prev ? prev.score : 0) + 40
        })
    }

    return [...out.values()]
        .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
        .slice(0, Math.max(0, limit))
}

/* ---- command palette ---------------------------------------------------- */

/** All of q's characters appear in text, in order — the loosest useful match. */
const isSubsequence = (q, text) => {
    let i = 0
    for (let j = 0; j < text.length && i < q.length; j++) if (text[j] === q[i]) i++
    return i === q.length
}

/**
 * Score one palette entry against the query. An entry is anything with a title,
 * an optional subtitle and keywords, and a `base` weight used to order the list
 * before anything is typed (so open tabs sit above bookmarks, and so on).
 *
 * Ordering favours a title that starts with the query, then one that contains it,
 * then a keyword or subtitle hit, and finally a loose subsequence — enough that
 * "nt" finds "New tab" without matching everything.
 */
export const scorePalette = (query, item) => {
    if (!item) return 0
    const q = String(query ?? '').trim().toLowerCase()
    if (!q) return item.base || 1
    const title = String(item.title || '').toLowerCase()
    const subtitle = String(item.subtitle || '').toLowerCase()
    const keywords = (Array.isArray(item.keywords) ? item.keywords : []).join(' ').toLowerCase()
    let s = 0
    if (title.startsWith(q)) s += 60
    else if (title.includes(q)) s += 35
    if (keywords.includes(q)) s += 20
    if (subtitle.includes(q)) s += 12
    if (!s && (isSubsequence(q, title) || isSubsequence(q, subtitle))) s += 6
    return s
}

/**
 * Rank palette entries for a query. With no query, everything is kept in base
 * order; with one, only entries that match survive. `base` breaks score ties so
 * a tab and a bookmark that match equally well still come back tab-first.
 */
export const rankPalette = (query, items, limit = 9) => {
    const q = String(query ?? '').trim()
    return (Array.isArray(items) ? items : [])
        .map(it => ({ it, s: scorePalette(q, it) }))
        .filter(x => (q ? x.s > 0 : true))
        .sort((a, b) => b.s - a.s || (b.it.base || 0) - (a.it.base || 0))
        .slice(0, Math.max(0, limit))
        .map(x => x.it)
}

export const MIN_RAIL = 120
export const MAX_RAIL = 460

export const clampRail = (w) => {
    const n = Number(w)
    if (!Number.isFinite(n)) return DEFAULT_PREFS.railWidth
    return Math.round(Math.min(MAX_RAIL, Math.max(MIN_RAIL, n)))
}

/**
 * Validate a list of tab records — each a back/forward stack, a current index and
 * a pinned flag. Shared by the live session and by saved sets, so both trust the
 * same rules: only http(s) URLs survive, the stack is capped, and the index is
 * clamped into it. An entry with nothing left is kept as an empty tab (idx -1) so
 * callers can decide whether to drop it.
 */
const sanitizeTabEntries = (arr) => (Array.isArray(arr) ? arr : [])
    .filter(t => t && typeof t === 'object' && Array.isArray(t.stack))
    .map(t => {
        const stack = t.stack
            .filter(u => typeof u === 'string' && /^https?:\/\/\S+$/i.test(u))
            .slice(-MAX_STACK)
        if (!stack.length) return { stack: [], idx: -1, pinned: false }
        const idx = Number.isInteger(t.idx) ? Math.min(Math.max(t.idx, 0), stack.length - 1) : stack.length - 1
        return { stack, idx, pinned: t.pinned === true }
    })
    .slice(0, MAX_TABS)

/**
 * The saved session: which tabs were open, each one's history, and which was in
 * front. Restored on open so closing with the panic key loses nothing.
 * Returns null when there is nothing usable to restore.
 */
export const sanitizeSession = (raw) => {
    const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null
    if (!s || !Array.isArray(s.tabs)) return null

    const tabs = sanitizeTabEntries(s.tabs)
    if (!tabs.length || tabs.every(t => t.idx < 0)) return null
    const active = Number.isInteger(s.active) && s.active >= 0 && s.active < tabs.length ? s.active : 0
    return { tabs, active }
}

/* ---- saved tab sets (workspaces) ---------------------------------------- */

export const MAX_SAVED_SETS = 20

/**
 * Named groups of tabs the reader chose to keep, so a whole research or reading
 * set can be reopened at once. Hand-editable storage, so nothing is trusted: a
 * set needs a name and at least one real page, names are deduped case-insensitively
 * (first kept), and the whole thing is capped.
 */
export const sanitizeSavedSets = (raw) => {
    const seen = new Set()
    return (Array.isArray(raw) ? raw : [])
        .filter(s => s && typeof s === 'object' && typeof s.name === 'string')
        .map(s => ({
            name: s.name.trim().slice(0, 40),
            tabs: sanitizeTabEntries(s.tabs).filter(t => t.idx >= 0),
            at: Number.isFinite(s.at) && s.at > 0 ? s.at : 0
        }))
        .filter(s => s.name && s.tabs.length)
        .filter(s => { const k = s.name.toLowerCase(); return seen.has(k) ? false : seen.add(k) })
        .slice(0, MAX_SAVED_SETS)
}

/** Add or replace a set by name, newest first. Returns a new, sanitized list. */
export const saveSet = (list, name, tabs, now) => {
    const nm = String(name || '').trim().slice(0, 40)
    const clean = sanitizeTabEntries(tabs).filter(t => t.idx >= 0)
    if (!nm || !clean.length) return sanitizeSavedSets(list)
    const rest = sanitizeSavedSets(list).filter(s => s.name.toLowerCase() !== nm.toLowerCase())
    return [{ name: nm, tabs: clean, at: Number.isFinite(now) && now > 0 ? now : 0 }, ...rest].slice(0, MAX_SAVED_SETS)
}

export const removeSet = (list, name) =>
    sanitizeSavedSets(list).filter(s => s.name.toLowerCase() !== String(name || '').trim().toLowerCase())

/* ---- per-site rules for pages that refuse framing ----------------------- */

export const MAX_POPUP_HOSTS = 50

/** A stored host, without the www — the form the rules are compared in. */
const bareHost = (h) => String(h || '').trim().toLowerCase().replace(/^www\./, '')

/**
 * Hosts the reader has chosen to always open in a popup, overriding the global
 * "sites that refuse embedding" default for those sites alone. Hand-editable
 * storage, so each entry must look like a real hostname; duplicates and www are
 * folded together, and the list is capped.
 */
export const sanitizeHostList = (raw) => {
    const seen = new Set()
    return (Array.isArray(raw) ? raw : [])
        .map(bareHost)
        .filter(h => /^[a-z0-9][a-z0-9.-]{0,252}\.[a-z]{2,}$/i.test(h))
        .filter(h => (seen.has(h) ? false : seen.add(h)))
        .slice(0, MAX_POPUP_HOSTS)
}

/** Whether a URL's host is on the list (www-insensitive). */
export const hostListed = (list, url) => {
    const host = bareHost(hostOf(url))
    return !!host && (Array.isArray(list) ? list : []).some(h => bareHost(h) === host)
}

/** Add or drop a URL's host, returning a new sanitized list. */
export const toggleHost = (list, url, on) => {
    const host = bareHost(hostOf(url))
    if (!host) return sanitizeHostList(list)
    const without = sanitizeHostList(list).filter(h => h !== host)
    return on ? sanitizeHostList([host, ...without]) : without
}

/* ---- misc helpers ------------------------------------------------------- */

/**
 * Whether two URLs point at the same place, ignoring differences that never mean
 * a different page: the scheme/host case (already folded by URL), and a trailing
 * slash on the path. Used to switch to a tab that is already open rather than
 * loading a second copy of it. Path, query and fragment stay case-sensitive,
 * since those can be significant.
 */
export const sameLocation = (a, b) => {
    const norm = (u) => {
        try {
            const x = new URL(u)
            const path = x.pathname.replace(/\/+$/, '') || '/'
            return x.origin + path + x.search + x.hash
        } catch { return null }
    }
    const na = norm(a)
    return !!na && na === norm(b)
}

/** A time-of-day greeting for the new-tab page. `hour` is 0–23. */
export const greeting = (hour) => {
    const h = Number(hour)
    if (!Number.isFinite(h)) return 'Hello'
    if (h >= 5 && h < 12) return 'Good morning'
    if (h >= 12 && h < 17) return 'Good afternoon'
    if (h >= 17 && h < 22) return 'Good evening'
    return 'Good night'
}

/**
 * A cheap pre-filter for the address-bar calculator: does the text look like a
 * sum worth trying to evaluate? It must hold a digit and an operator, function,
 * or parenthesis — so a plain word ("pi") or a bare number stays a search, while
 * "pi*2" or "sqrt(9)" gets computed. The real gate is whether evaluation then
 * succeeds and returns a finite number; this just avoids trying on prose. A
 * leading http(s) or a domain-shaped token is never a calculation.
 */
export const looksLikeMath = (raw) => {
    const t = String(raw ?? '').trim()
    if (!t || t.length > 120) return false
    if (/^https?:\/\//i.test(t)) return false
    if (!/\d/.test(t)) return false
    return /[+\-*/^%()√]/.test(t) || /\b(sqrt|sin|cos|tan|log|ln|abs|exp|floor|ceil|round)\s*\(/i.test(t)
}

/**
 * Everyday percentage phrasing the plain calculator can't parse: "15% of 200",
 * "20% off 50", "200 + 15%". Returns { expr, value } with a tidy echo of what was
 * asked, or null. Checked before the calculator so "200 + 15%" means "add 15
 * percent" (230), not the modulo the expression parser would attempt.
 */
export const parsePercent = (raw) => {
    const t = String(raw ?? '').trim().toLowerCase().replace(/^what\s+is\s+/, '').replace(/\??\s*$/, '')
    const num = '(-?\\d+(?:\\.\\d+)?)'
    let m = t.match(new RegExp(`^${num}\\s*(?:%|percent)\\s+of\\s+${num}$`))
    if (m) return { expr: `${m[1]}% of ${m[2]}`, value: (Number(m[1]) / 100) * Number(m[2]) }
    m = t.match(new RegExp(`^${num}\\s*(?:%|percent)\\s+off\\s+${num}$`))
    if (m) return { expr: `${m[1]}% off ${m[2]}`, value: Number(m[2]) * (1 - Number(m[1]) / 100) }
    m = t.match(new RegExp(`^${num}\\s*([+\\-])\\s*${num}\\s*(?:%|percent)$`))
    if (m) {
        const y = Number(m[1])
        const x = Number(m[3])
        return { expr: `${m[1]} ${m[2]} ${m[3]}%`, value: m[2] === '+' ? y * (1 + x / 100) : y * (1 - x / 100) }
    }
    return null
}

/* ---- backup & restore --------------------------------------------------- */

export const BACKUP_VERSION = 1

/**
 * A single portable snapshot of everything the viewer keeps: settings, shortcuts,
 * saved tab sets, per-site rules and per-site zoom. Open tabs and visited history
 * are deliberately left out — one is transient, the other is private, and neither
 * is "setup" worth carrying to another device.
 *
 * Every part is run through its own sanitiser on the way out, so a backup is
 * already clean and a hand-edited one can't smuggle anything in on the way back.
 */
export const packBackup = (data) => {
    const d = data && typeof data === 'object' ? data : {}
    return {
        app: 'mathlab-web-viewer',
        version: BACKUP_VERSION,
        prefs: sanitizePrefs(d.prefs),
        bookmarks: sanitizeBookmarks(d.bookmarks),
        savedSets: sanitizeSavedSets(d.savedSets),
        popupHosts: sanitizeHostList(d.popupHosts),
        zooms: sanitizeZooms(d.zooms)
    }
}

/**
 * Read a backup, returning only the sections it actually contained, each
 * sanitised — or null if the text is not a viewer backup at all. Returning just
 * the present sections lets a partial or older backup restore what it has without
 * wiping the rest.
 */
export const parseBackup = (text) => {
    let raw
    try { raw = typeof text === 'string' ? JSON.parse(text) : text } catch { return null }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.app !== 'mathlab-web-viewer') return null
    const out = {}
    if ('prefs' in raw) out.prefs = sanitizePrefs(raw.prefs)
    if ('bookmarks' in raw) out.bookmarks = sanitizeBookmarks(raw.bookmarks)
    if ('savedSets' in raw) out.savedSets = sanitizeSavedSets(raw.savedSets)
    if ('popupHosts' in raw) out.popupHosts = sanitizeHostList(raw.popupHosts)
    if ('zooms' in raw) out.zooms = sanitizeZooms(raw.zooms)
    return out
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

/**
 * What should happen when a site refuses to be embedded — the question this
 * viewer keeps running into, so it gets one setting rather than a scatter of
 * booleans.
 *
 *   'archive' — show the Internet Archive's snapshot in the pane. Stays inside
 *               the viewer, at the cost of reading a copy rather than the live
 *               page. The default, because it answers the question in place.
 *   'popup'   — open the live site in its own centered window. A popup is a
 *               top-level context, so framing headers don't apply to it — this is
 *               the real page, reached the ordinary way, no proxy involved.
 *   'tab'     — open the live site in a browser tab of its own.
 *   'explain' — do neither, and leave the reasons and buttons on screen.
 *
 * 'popup' and 'tab' both leave the viewer; 'popup' gives a sized window rather
 * than a background tab, which suits reading one page and coming back.
 */
export const BLOCKED_CHOICES = ['archive', 'popup', 'tab', 'explain']

const blockedChoice = (p) => {
    if (BLOCKED_CHOICES.includes(p.onBlocked)) return p.onBlocked
    // saved before this was a choice: it was a boolean for the browser-tab route
    if (p.handOffBlocked === false) return 'explain'
    if (p.handOffBlocked === true) return 'tab'
    return DEFAULT_PREFS.onBlocked
}

/** Everything here can come from hand-edited localStorage, so nothing is trusted. */
export const sanitizePrefs = (raw) => {
    const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}

    const url = (v, fallback) => (/^https?:\/\/\S+$/i.test(String(v || '')) ? String(v).trim() : fallback)
    const home = url(p.home, DEFAULT_PREFS.home) // '' means the new-tab page
    const customEngines = sanitizeEngines(p.customEngines)
    // the chosen engine may be a built-in or one of the reader's own
    const engineIds = [...ENGINES.map(e => e.id), ...customEngines.map(e => e.id)]
    const engine = engineIds.includes(p.engine) ? p.engine : DEFAULT_PREFS.engine
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
        customEngines,
        closeKey,
        density,
        newTabOpensHome: p.newTabOpensHome === true && !!home,
        bookmarksBar: p.bookmarksBar !== false,
        verticalTabs: p.verticalTabs !== false,
        sleepTabs: p.sleepTabs !== false,
        railWidth: clampRail(p.railWidth ?? DEFAULT_PREFS.railWidth),
        newTabBg: url(p.newTabBg, DEFAULT_PREFS.newTabBg),
        accent,
        ntpTitle,
        tileSize,
        showNtpSearch: p.showNtpSearch !== false,
        showNtpNote: p.showNtpNote !== false,
        showNtpTop: p.showNtpTop !== false,
        showNtpClock: p.showNtpClock !== false,
        showNtpScratch: p.showNtpScratch !== false,
        // off unless explicitly turned on: see suggestUrl for why
        webSuggest: p.webSuggest === true,
        onBlocked: blockedChoice(p),
        confirmOpen: p.confirmOpen === true,
        bookmarks
    }
}

/* ---- zoom --------------------------------------------------------------- */

/** The steps a real browser offers, so ⌘+ lands on familiar round numbers. */
export const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5]

/**
 * Snap to the nearest offered step, so a hand-edited store can't yield 103.7%.
 *
 * Number(null) and Number('') are both 0, and a stored 0 means "nothing was
 * saved", not "half size" — so only a genuine positive number is taken at face
 * value and everything else reads as the default.
 */
export const clampZoom = (z) => {
    const n = typeof z === 'number' ? z : (typeof z === 'string' && z.trim() ? Number(z) : NaN)
    if (!Number.isFinite(n) || n <= 0) return 1
    return ZOOM_LEVELS.reduce((best, step) => (Math.abs(step - n) < Math.abs(best - n) ? step : best), 1)
}

/** One step up (dir > 0) or down the ladder, stopping at either end. */
export const stepZoom = (z, dir) => {
    const i = ZOOM_LEVELS.indexOf(clampZoom(z))
    return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, i + (dir < 0 ? -1 : 1)))]
}

/**
 * Zoom is remembered per site, the way a browser does it: set Wikipedia to 125%
 * once and every Wikipedia page opens that way. Keyed on the host, so it holds
 * while you move around a site and never follows you off it.
 *
 * A level of 1 is dropped rather than stored — it is the default, and keeping it
 * would grow the blob by one entry for every site ever zoomed and then un-zoomed.
 */
export const sanitizeZooms = (raw) => {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    const out = {}
    for (const [host, z] of Object.entries(src)) {
        if (!/^[a-z0-9][a-z0-9.-]{0,252}$/i.test(host)) continue
        const level = clampZoom(z)
        if (level !== 1) out[host] = level
    }
    return out
}

export const zoomFor = (zooms, url) => (zooms && zooms[hostOf(url)]) || 1

export const setZoomFor = (zooms, url, z) => {
    const host = hostOf(url)
    if (!host) return zooms || {}
    const next = { ...(zooms || {}) }
    const level = clampZoom(z)
    if (level === 1) delete next[host]
    else next[host] = level
    return next
}

/* ---- reaching a page that refuses framing ------------------------------- */

/**
 * The Internet Archive's copy of a page. Wayback replays the capture closest to
 * the timestamp it is given, so a far-future one means "the newest snapshot".
 *
 * web.archive.org sends no X-Frame-Options of its own, which makes this the one
 * honest way to read a site that refuses framing without leaving the viewer: the
 * archive is a different resource that consented to being embedded, not the live
 * site with its header stripped off. Nothing you are logged into is involved.
 * Returns null for the archive itself — archiving the archive is a loop.
 */
export const waybackUrl = (url) => {
    const raw = String(url || '')
    if (!/^https?:\/\/\S+$/i.test(raw)) return null
    if (/(^|\.)archive\.org$/i.test(hostOf(raw))) return null
    return `https://web.archive.org/web/3000/${raw}`
}

/* ---- tab strip ----------------------------------------------------------- */

/** Move one item to another index, returning a new array. Out of range is a no-op. */
export const moveItem = (list, from, to) => {
    const arr = Array.isArray(list) ? [...list] : []
    if (!Number.isInteger(from) || !Number.isInteger(to)) return arr
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return arr
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    return arr
}

/** Pinned tabs sit at the front, as in every browser; relative order is kept. */
export const withPinnedFirst = (tabs) => {
    const list = Array.isArray(tabs) ? tabs : []
    return [...list.filter(t => t && t.pinned), ...list.filter(t => !(t && t.pinned))]
}

/**
 * What to write on a tab. A cross-origin frame's <title> is unreadable from out
 * here, so the last path segment stands in for it: a rail reading "Pythagorean
 * theorem / Euler's identity" beats one reading "en.wikipedia.org" three times.
 * Segments that carry no information — index, search, watch — fall back to the
 * host, which at least says where you are.
 */
const GENERIC_SEGMENT = /^(index|home|search|watch|results|result|page|default|main|view|browse|about|en|www)$/i

export const tabTitle = (url) => {
    const host = tabLabel(url)
    if (host === 'New tab') return host
    const path = prettyPath(url)
    // Two characters is enough — /wiki/Pi is a better tab than "en.wikipedia.org".
    if (!path || path.length < 2 || GENERIC_SEGMENT.test(path) || /^\d+$/.test(path)) return host
    return path.length > 34 ? `${path.slice(0, 33)}…` : path
}

/* ---- history + home screen ---------------------------------------------- */

/**
 * The most-opened page per site, for the home screen's second row. One tile per
 * host — ten Wikipedia articles are one habit, not ten — and anything already on
 * the shortcut shelf is skipped, since a tile shown twice is a wasted slot.
 */
export const topSites = (history, { exclude = [], limit = 8 } = {}) => {
    const skip = new Set((Array.isArray(exclude) ? exclude : []).map(u => String(u)))
    const best = new Map()
    for (const h of Array.isArray(history) ? history : []) {
        if (!h || !h.url || skip.has(h.url)) continue
        const host = hostOf(h.url)
        if (!host) continue
        const prev = best.get(host)
        if (!prev || h.visits > prev.visits || (h.visits === prev.visits && h.last > prev.last)) best.set(host, h)
    }
    return [...best.values()]
        .sort((a, b) => b.visits - a.visits || b.last - a.last)
        .slice(0, Math.max(0, limit))
        .map(h => ({ url: h.url, label: tabTitle(h.url), visits: h.visits }))
}

/** "Today" / "Yesterday" / a written date, for the history list's day headings. */
export const dayLabel = (ts, now = Date.now()) => {
    const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const then = new Date(ts)
    if (!Number.isFinite(then.getTime())) return 'Earlier'
    const days = Math.round((midnight(new Date(now)) - midnight(then)) / 86400000)
    if (days <= 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return then.toLocaleDateString(undefined, { weekday: 'long' })
    return then.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

/**
 * History split into day sections, newest first, narrowed by whatever is typed
 * in the panel's filter. A section left empty by the filter is dropped rather
 * than shown as a bare heading.
 */
export const groupHistory = (history, { query = '', now = Date.now() } = {}) => {
    const q = String(query ?? '').trim().toLowerCase()
    const hit = (h) => !q
        || h.url.toLowerCase().includes(q)
        || prettyPath(h.url).toLowerCase().includes(q)

    const out = []
    for (const h of [...(Array.isArray(history) ? history : [])].sort((a, b) => b.last - a.last)) {
        if (!hit(h)) continue
        const label = h.last ? dayLabel(h.last, now) : 'Earlier'
        const tail = out[out.length - 1]
        if (tail && tail.label === label) tail.items.push(h)
        else out.push({ label, items: [h] })
    }
    return out
}

/* ---- the window itself --------------------------------------------------- */

/** How much of the window must stay on screen, so it can always be grabbed back. */
export const KEEP_ON_SCREEN = 130

/**
 * Where a dragged window is allowed to come to rest. A window can hang off any
 * edge — that is how a real one behaves, and how you read a wide page on a narrow
 * screen — but never so far that the toolbar you would grab it by is gone.
 */
export const clampWindow = ({ x, y }, { w, h }, { width, height }, keep = KEEP_ON_SCREEN) => {
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    const edge = Math.min(keep, num(w), num(h))
    return {
        x: Math.round(Math.min(num(width) - edge, Math.max(edge - num(w), num(x)))),
        // never above the top: the toolbar is the only handle, so it must stay reachable
        y: Math.round(Math.min(num(height) - edge, Math.max(0, num(y))))
    }
}

/** A saved window position, or null when it has never been moved. */
export const sanitizePos = (raw) => {
    const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null
    return { x: Math.round(p.x), y: Math.round(p.y) }
}

/**
 * Which edges a resize gesture is pulling. 'se' means the corner, 'n' the top
 * edge alone; pulling a top or left edge moves that edge and leaves the opposite
 * one where it is, which is the whole reason this returns a box rather than a size.
 */
export const resizeBox = (mode, start, dx, dy, min = { w: 520, h: 360 }) => {
    let { x, y, w, h } = start
    if (mode === 'move') return { x: x + dx, y: y + dy, w, h }
    if (mode.includes('e')) w = start.w + dx
    if (mode.includes('s')) h = start.h + dy
    if (mode.includes('w')) w = start.w - dx
    if (mode.includes('n')) h = start.h - dy
    w = Math.max(min.w, w)
    h = Math.max(min.h, h)
    // anchor the edge that was not grabbed
    if (mode.includes('w')) x = start.x + start.w - w
    if (mode.includes('n')) y = start.y + start.h - h
    return { x, y, w, h }
}

/* ---- article suggestions ------------------------------------------------- */

/**
 * Wikipedia's OpenSearch endpoint, the one search API on the frameable list that
 * answers a cross-origin request (`origin=*` earns the CORS header).
 *
 * This is off unless someone turns it on, and the setting says plainly why: with
 * it on, every few keystrokes in the address bar are sent to Wikipedia before you
 * press Enter. That is a real change in what leaves the device, and it is the same
 * reason this viewer draws favicons from each site directly instead of routing
 * them through an icon service that would see every host you visit.
 */
export const suggestUrl = (query) =>
    `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&namespace=0&limit=6&search=${encodeURIComponent(String(query ?? '').slice(0, 120))}`

/**
 * OpenSearch answers with [query, titles[], descriptions[], urls[]]. Nothing about
 * that shape is guaranteed to survive a bad day at the API, so each row is only
 * kept when its title and its URL both arrive intact.
 */
export const parseOpenSearch = (raw, limit = 6) => {
    if (!Array.isArray(raw) || raw.length < 4) return []
    const titles = Array.isArray(raw[1]) ? raw[1] : []
    const urls = Array.isArray(raw[3]) ? raw[3] : []
    const out = []
    for (let i = 0; i < titles.length && out.length < limit; i++) {
        const label = typeof titles[i] === 'string' ? titles[i].trim() : ''
        const url = typeof urls[i] === 'string' ? urls[i].trim() : ''
        if (!label || !/^https:\/\/\S+$/i.test(url)) continue
        out.push({ url, label, kind: 'article' })
    }
    return out
}

/**
 * Local rows first, remote ones after: what you have already visited or saved is
 * a better guess than what an encyclopedia thinks you meant, and keeping the
 * order stable means the row under the cursor does not move when a slow reply
 * lands. Anything already suggested locally is not repeated.
 */
export const mergeSuggestions = (local, remote, limit = 8) => {
    const seen = new Set(local.map(s => s.url))
    return [...local, ...remote.filter(r => !seen.has(r.url))].slice(0, Math.max(0, limit))
}

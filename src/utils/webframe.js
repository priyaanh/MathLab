/**
 * Address-bar logic for the in-page web viewer, kept pure so `npm test` covers it.
 */

// Search engines that allow being framed. Google/Bing/DuckDuckGo all refuse.
export const ENGINES = [
    { id: 'searx', name: 'SearXNG', q: (s) => `https://search.disroot.org/search?q=${encodeURIComponent(s)}` },
    { id: 'searxbe', name: 'searx.be', q: (s) => `https://searx.be/search?q=${encodeURIComponent(s)}` },
    { id: 'marginalia', name: 'Marginalia', q: (s) => `https://old.search.marginalia.nu/search?query=${encodeURIComponent(s)}` },
    { id: 'wikipedia', name: 'Wikipedia', q: (s) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(s)}` }
]

/**
 * Hosts that send X-Frame-Options / frame-ancestors. Nothing on the page can
 * override those headers, so we warn instead of showing a blank frame.
 */
const BLOCKS_FRAMING = /^(www\.|m\.|old\.)?(google|youtube|bing|duckduckgo|github|stackoverflow|reddit|instagram|facebook|twitter|amazon|netflix|tiktok|discord|roblox|linkedin|openstreetmap|wolframalpha|startpage|ecosia|qwant)\.[a-z.]+$/i

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

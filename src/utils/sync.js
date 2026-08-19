/**
 * Talking to the profile sync server.
 *
 * The server is a blob store and nothing else. What leaves this device is the
 * ciphertext that was already sitting in localStorage plus an auth token, and
 * neither reveals the password or the key that opens the profile.
 *
 * The auth token is a second PBKDF2 output from the same password under a
 * domain-separated salt. Deriving it separately is the point: the encryption
 * key never leaves the browser, so a server that is compromised, subpoenaed, or
 * simply run by someone else still cannot read a single profile. Sending the
 * encryption key itself would have been far simpler and would have thrown that
 * away.
 */

import { PBKDF2_ITERATIONS, toB64 } from './accounts.js'

const URL_KEY = 'mathlab-sync-url'
const ON_KEY = 'mathlab-sync-on'
/** Per profile, the server version this device last saw — the write guard. */
const VERSION_KEY = 'mathlab-sync-version'

const enc = new TextEncoder()

const subtle = () => {
    const c = globalThis.crypto
    if (!c || !c.subtle) throw new Error('This browser has no WebCrypto.')
    return c.subtle
}

/* ---- settings ------------------------------------------------------------ */

/** A build can ship a default server; a person can still point somewhere else. */
export const defaultSyncUrl = () => {
    try { return (import.meta.env?.VITE_SYNC_URL || '').trim() } catch { return '' }
}

export const getSyncUrl = () => {
    try { return (localStorage.getItem(URL_KEY) || defaultSyncUrl()).trim() } catch { return defaultSyncUrl() }
}

export const setSyncUrl = (url) => {
    const clean = normaliseUrl(url)
    try {
        if (clean) localStorage.setItem(URL_KEY, clean)
        else localStorage.removeItem(URL_KEY)
    } catch { /* storage unavailable */ }
    return clean
}

export const isSyncOn = () => {
    try { return localStorage.getItem(ON_KEY) === '1' && !!getSyncUrl() } catch { return false }
}

export const setSyncOn = (on) => {
    try {
        if (on) localStorage.setItem(ON_KEY, '1')
        else localStorage.removeItem(ON_KEY)
    } catch { /* storage unavailable */ }
}

/** Trailing slashes and a missing scheme are the two things people always type. */
export const normaliseUrl = (raw) => {
    const text = String(raw ?? '').trim().replace(/\/+$/, '')
    if (!text) return ''
    if (/^https?:\/\//i.test(text)) return text
    // localhost is the one place plain http is the sensible guess
    return `${/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(text) ? 'http' : 'https'}://${text}`
}

const versions = () => {
    try { return JSON.parse(localStorage.getItem(VERSION_KEY) || '{}') || {} } catch { return {} }
}
export const lastVersion = (key) => Number(versions()[key] || 0)
export const setLastVersion = (key, v) => {
    try {
        const all = versions()
        all[key] = Number(v) || 0
        localStorage.setItem(VERSION_KEY, JSON.stringify(all))
    } catch { /* storage unavailable */ }
}

/* ---- knowing whether this device has unsynced changes -------------------
 * A fingerprint of the workspace as it was at the last successful sync, per
 * profile. Comparing it to the current workspace tells auto-sync whether this
 * device has edits the server hasn't seen — the one thing that makes an
 * automatic pull unsafe. It is a hash of the CONTENT, not of the ciphertext,
 * so simply re-saving (which re-encrypts with a fresh IV) doesn't look like a
 * change; only real edits do.
 */
const CONTENT_KEY = 'mathlab-sync-content'
const contentMap = () => {
    try { return JSON.parse(localStorage.getItem(CONTENT_KEY) || '{}') || {} } catch { return {} }
}
export const lastContentHash = (key) => String(contentMap()[key] || '')
export const setLastContentHash = (key, hash) => {
    try {
        const all = contentMap()
        all[key] = String(hash || '')
        localStorage.setItem(CONTENT_KEY, JSON.stringify(all))
    } catch { /* storage unavailable */ }
}

/** A stable SHA-256 of a workspace snapshot — keys sorted so order can't matter. */
export const hashContent = async (data) => {
    const obj = data && typeof data === 'object' ? data : {}
    const canonical = JSON.stringify(obj, Object.keys(obj).sort())
    const buf = await subtle().digest('SHA-256', enc.encode(canonical))
    return toB64(new Uint8Array(buf))
}

/**
 * What a sign-in should do about sync, given four facts. Pure, so the policy is
 * testable in isolation:
 *   - no profile on the server yet     -> push (first upload)
 *   - server is ahead, we're unchanged -> pull  (bring the newer copy down)
 *   - server is ahead AND we changed    -> conflict (both moved; ask, never clobber)
 *   - server is not ahead, we changed   -> push
 *   - otherwise                         -> inSync (nothing to do)
 */
export const syncDecision = ({ hasRemote, serverVersion = 0, seenVersion = 0, localChanged = false }) => {
    if (!hasRemote) return 'push'
    if (serverVersion > seenVersion) return localChanged ? 'conflict' : 'pull'
    return localChanged ? 'push' : 'inSync'
}

/* ---- auth token ---------------------------------------------------------- */

/**
 * The auth salt is derived from the USERNAME, not from the account's stored
 * salt. That is the whole trick and it is easy to get wrong: the stored salt is
 * random per device, so salting with it gave two devices two different tokens
 * for one password, and the second device could never prove it owned the
 * profile. The username is the one thing both devices agree on before they have
 * spoken to each other.
 *
 * A salt is not a secret — its job is domain separation, and it keeps this
 * derivation independent of the encryption key, which still uses the random
 * per-account salt. Same password, two unrelated outputs; the token cannot be
 * worked backwards into the key that opens the profile.
 */
const authSalt = async (usernameKey) => {
    const seed = enc.encode(`mathlab-sync-auth-v1:${String(usernameKey).trim().toLowerCase()}`)
    return new Uint8Array(await subtle().digest('SHA-256', seed))
}

export const deriveAuthToken = async (password, usernameKey, iterations = PBKDF2_ITERATIONS) => {
    const base = await subtle().importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits'])
    const bits = await subtle().deriveBits(
        { name: 'PBKDF2', salt: await authSalt(usernameKey), iterations, hash: 'SHA-256' },
        base,
        256
    )
    return toB64(new Uint8Array(bits))
}

/**
 * The most useful message for a fetch that never got a response — the two things
 * that actually go wrong are the server not running, and the browser refusing an
 * http server from an https page. Exposed so the settings panel can show the same
 * guidance before anything is even attempted.
 */
export const reachError = (base) => {
    const pageHttps = (() => { try { return typeof location !== 'undefined' && location.protocol === 'https:' } catch { return false } })()
    const serverHttp = /^http:\/\//i.test(String(base || ''))
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(String(base || ''))
    if (pageHttps && serverHttp && !isLocal) {
        return 'Could not reach the sync server. This page is secure (https) but the server address is plain http, which browsers block. Give the server an https address, or open MathLab from http://localhost while you set it up.'
    }
    return 'Could not reach the sync server. Check the address, and make sure the server is running — start it with "npm run sync" in the project.'
}

/* ---- transport ----------------------------------------------------------- */

const call = async (path, { method = 'GET', token, body, timeoutMs = 15000 } = {}) => {
    const base = getSyncUrl()
    if (!base) throw new Error('No sync server is set.')

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    let res
    try {
        res = await fetch(`${base}${path}`, {
            method,
            signal: ctrl.signal,
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        })
    } catch (e) {
        // A dead server and a browser-blocked request look identical from here
        // ("Failed to fetch"), so guess at the usual causes and say something
        // actionable rather than a bare "could not reach".
        if (e.name === 'AbortError') throw new Error('The sync server did not respond — it may be starting up, or the address is wrong.')
        throw new Error(reachError(base))
    } finally {
        clearTimeout(timer)
    }

    let payload = {}
    try { payload = await res.json() } catch { /* empty or non-JSON body */ }
    if (!res.ok) {
        const err = new Error(payload.error || `Sync failed (${res.status}).`)
        err.status = res.status
        err.serverVersion = payload.version
        throw err
    }
    return payload
}

export const checkServer = async () => {
    const out = await call('/v1/health')
    if (!out.ok) throw new Error('That address answered, but is not a MathLab sync server.')
    return out
}

/** Push the stored ciphertext up. Throws with status 409 if the server moved on. */
export const pushProfile = async ({ key, record, token }) => {
    const out = await call(`/v1/profile/${encodeURIComponent(key)}`, {
        method: 'PUT',
        token,
        body: {
            baseVersion: lastVersion(key),
            blob: { salt: record.salt, iterations: record.iterations, iv: record.iv, ct: record.ct }
        }
    })
    setLastVersion(key, out.version)
    return out
}

export const pullProfile = async ({ key, token }) => {
    const out = await call(`/v1/profile/${encodeURIComponent(key)}`, { token })
    return out // { blob, version, updatedAt }
}

export const deleteRemote = async ({ key, token }) => {
    const out = await call(`/v1/profile/${encodeURIComponent(key)}`, { method: 'DELETE', token })
    setLastVersion(key, 0)
    return out
}

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

import { PBKDF2_ITERATIONS, toB64 } from './accounts'

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
        // A dead server and a blocked request look the same from here; say the
        // useful thing rather than surfacing "Failed to fetch".
        throw new Error(e.name === 'AbortError' ? 'The sync server did not respond.' : 'Could not reach the sync server.')
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

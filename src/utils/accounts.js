/**
 * Local accounts for the Profile page.
 *
 * WHAT THIS PROTECTS — and what it cannot.
 *
 * MathLab is a static site with no server, so there is nothing to authenticate
 * against: any check that runs in the browser can be bypassed by editing the
 * browser's own copy of the app. A pure "is this password right" gate would be
 * decoration.
 *
 * So the password is not a gate, it is a key. Each account's data is encrypted
 * with AES-GCM under a key derived from the password by PBKDF2, and only the
 * ciphertext is written to localStorage. Someone poking at storage on a shared
 * computer cannot read another person's progress without their password, and no
 * password is stored anywhere to be recovered.
 *
 * The consequences are real and deliberate:
 *   - A forgotten password cannot be reset. Nothing on disk can recover the data.
 *   - The derived key lives in memory only, so a reload requires signing in again.
 *   - It does not defend against code the attacker controls, and it is not a
 *     login in the "server checked your identity" sense.
 *
 * There is no separate password verifier on purpose: AES-GCM is authenticated,
 * so a failed decrypt IS the wrong-password signal. Storing a verifier hash
 * would only hand an attacker something extra to grind against offline.
 */

const STORE_KEY = 'mathlab-accounts'
const STORE_VERSION = 1

/** OWASP's floor for PBKDF2-HMAC-SHA256; ~0.2-0.4s in a browser, which is the point. */
export const PBKDF2_ITERATIONS = 210000

export const MIN_PASSWORD = 8
export const MAX_USERNAME = 24

/* WORKSPACE_KEYS — the live keys the rest of the app reads — is defined further
   down, next to the version map that governs how they are restored. */

const enc = new TextEncoder()
const dec = new TextDecoder()

const subtle = () => {
    const c = globalThis.crypto
    if (!c || !c.subtle) throw new Error('This browser has no WebCrypto, so accounts cannot be secured here.')
    return c.subtle
}

const randomBytes = (n) => {
    const b = new Uint8Array(n)
    globalThis.crypto.getRandomValues(b)
    return b
}

/** Chunked so a multi-KB payload cannot blow the argument limit on spread. */
export const toB64 = (bytes) => {
    let s = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    return btoa(s)
}

export const fromB64 = (text) => Uint8Array.from(atob(text), c => c.charCodeAt(0))

/* ---- identity rules ----------------------------------------------------- */

/** Accounts are matched case-insensitively; the typed form is kept for display. */
export const usernameKey = (name) => String(name ?? '').trim().toLowerCase()

export const usernameProblem = (name) => {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) return 'Pick a username.'
    if (trimmed.length < 2) return 'Usernames need at least 2 characters.'
    if (trimmed.length > MAX_USERNAME) return `Keep it to ${MAX_USERNAME} characters or fewer.`
    if (!/^[a-z0-9][a-z0-9 ._-]*$/i.test(trimmed)) return 'Use letters, numbers, spaces, and . _ - only.'
    return null
}

export const passwordProblem = (password) => {
    const pw = String(password ?? '')
    if (!pw) return 'Pick a password.'
    if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
    return null
}

/**
 * A 0-4 hint for the strength meter. Length dominates because it genuinely does
 * for a KDF-derived key; character classes are a nudge, not a requirement.
 */
export const passwordStrength = (password) => {
    const pw = String(password ?? '')
    if (!pw) return 0
    let score = 0
    if (pw.length >= MIN_PASSWORD) score++
    if (pw.length >= 12) score++
    if (pw.length >= 16) score++
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(pw)).length
    if (classes >= 3) score++
    return Math.min(4, score)
}

export const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

/* ---- crypto ------------------------------------------------------------- */

const deriveKey = async (password, salt, iterations) => {
    const base = await subtle().importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveKey'])
    return subtle().deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        base,
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable: the key cannot be read back out of memory
        ['encrypt', 'decrypt']
    )
}

/** A fresh IV per write — reusing one under the same key would break AES-GCM. */
export const encryptJSON = async (key, value) => {
    const iv = randomBytes(12)
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))))
    return { iv: toB64(iv), ct: toB64(ct) }
}

export const decryptJSON = async (key, blob) => {
    const plain = await subtle().decrypt(
        { name: 'AES-GCM', iv: fromB64(blob.iv) },
        key,
        fromB64(blob.ct)
    )
    return JSON.parse(dec.decode(new Uint8Array(plain)))
}

/* ---- the account store -------------------------------------------------- */

const emptyStore = () => ({ version: STORE_VERSION, users: {} })

export const loadAccounts = () => {
    try {
        const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyStore()
        const users = raw.users && typeof raw.users === 'object' && !Array.isArray(raw.users) ? raw.users : {}
        return { version: STORE_VERSION, users }
    } catch { return emptyStore() }
}

const saveAccounts = (store) => {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

export const listAccounts = () => Object.entries(loadAccounts().users)
    .map(([key, rec]) => ({ key, display: rec.display || key, updatedAt: rec.updatedAt || 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt)

export const accountExists = (name) => Object.prototype.hasOwnProperty.call(loadAccounts().users, usernameKey(name))

/**
 * Create an account and return the in-memory session. `payload` seeds the
 * encrypted blob, so a new account can adopt whatever is already on the device.
 */
export const createAccount = async (name, password, payload = {}) => {
    const problem = usernameProblem(name) || passwordProblem(password)
    if (problem) throw new Error(problem)

    const key = usernameKey(name)
    const store = loadAccounts()
    if (store.users[key]) throw new Error('That username is already taken on this device.')

    const salt = randomBytes(16)
    const cryptoKey = await deriveKey(password, salt, PBKDF2_ITERATIONS)
    const blob = await encryptJSON(cryptoKey, payload)

    store.users[key] = {
        display: String(name).trim(),
        salt: toB64(salt),
        iterations: PBKDF2_ITERATIONS,
        ...blob,
        createdAt: Date.now(),
        updatedAt: Date.now()
    }
    saveAccounts(store)
    return { key, display: store.users[key].display, cryptoKey, data: payload }
}

/**
 * Unlock an account. A wrong password surfaces as a failed AES-GCM decrypt,
 * which is indistinguishable from a corrupt blob — both mean "cannot open".
 */
export const openAccount = async (name, password) => {
    const key = usernameKey(name)
    const rec = loadAccounts().users[key]
    // Same message either way, so this cannot be used to enumerate usernames.
    const wrong = () => new Error('That username and password do not match.')
    if (!rec) throw wrong()

    let data
    try {
        const cryptoKey = await deriveKey(password, fromB64(rec.salt), rec.iterations || PBKDF2_ITERATIONS)
        data = await decryptJSON(cryptoKey, rec)
        return { key, display: rec.display || key, cryptoKey, data }
    } catch {
        throw wrong()
    }
}

/** Re-encrypt an open account's data under the session key it was opened with. */
export const saveAccountData = async (session, payload) => {
    const store = loadAccounts()
    const rec = store.users[session.key]
    if (!rec) throw new Error('That account is no longer on this device.')
    const blob = await encryptJSON(session.cryptoKey, payload)
    store.users[session.key] = { ...rec, ...blob, updatedAt: Date.now() }
    saveAccounts(store)
}

/** Changing the password re-wraps the data under a new key — nothing is re-typed. */
export const changePassword = async (session, currentPassword, nextPassword) => {
    const problem = passwordProblem(nextPassword)
    if (problem) throw new Error(problem)
    const reopened = await openAccount(session.display, currentPassword)

    const store = loadAccounts()
    const rec = store.users[session.key]
    const salt = randomBytes(16)
    const cryptoKey = await deriveKey(nextPassword, salt, PBKDF2_ITERATIONS)
    const blob = await encryptJSON(cryptoKey, reopened.data)
    store.users[session.key] = {
        ...rec,
        salt: toB64(salt),
        iterations: PBKDF2_ITERATIONS,
        ...blob,
        updatedAt: Date.now()
    }
    saveAccounts(store)
    return { ...session, cryptoKey }
}

/** Deleting is unrecoverable, which is the honest consequence of no server. */
export const deleteAccount = (nameOrKey) => {
    const store = loadAccounts()
    delete store.users[usernameKey(nameOrKey)]
    saveAccounts(store)
}

/** The stored record as-is — ciphertext and its parameters, nothing decrypted. */
export const getAccountRecord = (nameOrKey) => loadAccounts().users[usernameKey(nameOrKey)] || null

/**
 * Replace a profile's stored ciphertext with one fetched from the sync server.
 * The blob is only adopted if it actually opens with this session's password —
 * otherwise a wrong or corrupt payload would lock the profile out of its own
 * data with no way back.
 */
export const adoptRemoteBlob = async (session, blob, password) => {
    const store = loadAccounts()
    const rec = store.users[session.key]
    if (!rec) throw new Error('That profile is no longer on this device.')

    const cryptoKey = await deriveKey(password, fromB64(blob.salt), blob.iterations || PBKDF2_ITERATIONS)
    let data
    try {
        data = await decryptJSON(cryptoKey, blob)
    } catch {
        throw new Error('The profile on the server does not open with this password.')
    }

    store.users[session.key] = {
        ...rec,
        salt: blob.salt,
        iterations: blob.iterations || PBKDF2_ITERATIONS,
        iv: blob.iv,
        ct: blob.ct,
        updatedAt: Date.now()
    }
    saveAccounts(store)
    return { ...session, cryptoKey, data }
}

/**
 * Install a profile pulled from the sync server as a local account on this
 * device, verifying the password by actually decrypting the blob.
 *
 * This is what makes "sign in on a new device and everything comes back" work
 * without carrying a file over: the caller fetches the encrypted blob from the
 * server with a token derived from the same password, and this turns it into a
 * real local account and opens it.
 *
 * Unlike importProfile, which refuses to clobber a *different* person's profile
 * of the same name, this is the same profile coming home from the server, so it
 * replaces any local copy — the server's is the shared source of truth.
 */
export const installProfileFromBlob = async (display, password, blob) => {
    const problem = usernameProblem(display)
    if (problem) throw new Error(problem)
    if (!blob || !blob.salt || !blob.iv || !blob.ct) throw new Error('The server did not return a usable profile.')

    // Decrypt to prove the password is right; a wrong one must not install a
    // profile this device could never open.
    let data
    try {
        const probe = await deriveKey(password, fromB64(blob.salt), blob.iterations || PBKDF2_ITERATIONS)
        data = await decryptJSON(probe, blob)
    } catch {
        throw new Error('That username and password do not match the profile on the server.')
    }

    const key = usernameKey(display)
    const store = loadAccounts()
    store.users[key] = {
        display: String(display).trim(),
        salt: blob.salt,
        iterations: blob.iterations || PBKDF2_ITERATIONS,
        iv: blob.iv,
        ct: blob.ct,
        createdAt: store.users[key]?.createdAt || Date.now(),
        updatedAt: Date.now()
    }
    saveAccounts(store)

    // A fresh key bound to the account as now stored, matching openAccount.
    const cryptoKey = await deriveKey(password, fromB64(blob.salt), blob.iterations || PBKDF2_ITERATIONS)
    return { key, display: store.users[key].display, cryptoKey, data }
}

/* ---- moving a profile between devices -----------------------------------
 * There is no server to sync through, so a profile travels as a file. What is
 * exported is exactly what is stored: salt, iterations, IV and ciphertext. It
 * is still encrypted under the password, so it can be mailed to yourself or
 * left in a shared drive without handing anyone your progress — and it is
 * useless to whoever holds it without the password.
 */

export const EXPORT_FORMAT = 'mathlab-profile'
export const EXPORT_VERSION = 1

export const exportProfile = (nameOrKey) => {
    const rec = loadAccounts().users[usernameKey(nameOrKey)]
    if (!rec) throw new Error('That profile is not on this device.')
    return JSON.stringify({
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        display: rec.display,
        salt: rec.salt,
        iterations: rec.iterations,
        iv: rec.iv,
        ct: rec.ct,
        exportedAt: Date.now()
    }, null, 2)
}

/** A filename that says whose it is without leaking anything sensitive. */
export const exportFilename = (display) =>
    `mathlab-profile-${String(display || 'profile').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile'}.json`

/**
 * Bring a profile onto this device. The password is required up front: it both
 * proves the file is really theirs and is the only way to know the bundle
 * decrypts at all, so a corrupt file fails here rather than at next sign-in.
 *
 * `rename` lets an import land beside an existing profile of the same name
 * instead of silently overwriting a different person's data.
 */
export const importProfile = async (text, password, { rename = '' } = {}) => {
    let bundle
    try { bundle = JSON.parse(String(text)) } catch { throw new Error('That does not look like a profile file.') }
    if (!bundle || bundle.format !== EXPORT_FORMAT) throw new Error('That does not look like a MathLab profile file.')
    if (Number(bundle.version) > EXPORT_VERSION) throw new Error('That profile was made by a newer version of MathLab.')
    if (!bundle.salt || !bundle.iv || !bundle.ct) throw new Error('That profile file is incomplete.')

    // Verify by decrypting: a wrong password cannot produce a usable payload.
    let data
    try {
        const cryptoKey = await deriveKey(password, fromB64(bundle.salt), bundle.iterations || PBKDF2_ITERATIONS)
        data = await decryptJSON(cryptoKey, bundle)
    } catch {
        throw new Error('That password does not open this profile file.')
    }

    const display = String(rename || bundle.display || 'profile').trim()
    const problem = usernameProblem(display)
    if (problem) throw new Error(problem)

    const key = usernameKey(display)
    const store = loadAccounts()
    if (store.users[key] && !rename) {
        throw new Error(`A profile called "${display}" already exists here — import it under a different name.`)
    }

    store.users[key] = {
        display,
        salt: bundle.salt,
        iterations: bundle.iterations || PBKDF2_ITERATIONS,
        iv: bundle.iv,
        ct: bundle.ct,
        createdAt: Date.now(),
        updatedAt: Date.now()
    }
    saveAccounts(store)

    // Re-derive rather than reuse: the key above is scoped to this function and
    // the caller needs one bound to the account as now stored.
    const cryptoKey = await deriveKey(password, fromB64(bundle.salt), bundle.iterations || PBKDF2_ITERATIONS)
    return { key, display, cryptoKey, data }
}

/* ---- workspace swapping -------------------------------------------------
 * The rest of MathLab reads fixed localStorage keys. Rather than rewrite every
 * page to be account-aware, signing in swaps what lives under those keys and
 * signing out puts the signed-out data back exactly as it was.
 */

/**
 * Every key a profile owns, mapped to the workspace version that introduced it.
 *
 * The version matters on restore. A key absent from a snapshot is normally
 * cleared, so that one account's data cannot bleed into the next session — but
 * a blob saved before a key existed is *also* missing it, and clearing on that
 * basis would delete data the account had simply never been told about. The
 * first sign-in after this list grows would have wiped the browser bookmarks.
 * So a key is only cleared when the snapshot is new enough to have known it.
 *
 * Deliberately excluded, because they belong to the device rather than the
 * person: mathlab-frame-size and mathlab-frame-pos (a window's size and place
 * suit the screen it is on — and a position saved on a wide monitor can land
 * off-screen on a laptop), and mathlab-frame-pruned (a one-time migration flag
 * that must stay per-device or the migration re-runs or is wrongly skipped).
 * Also excluded: the sync settings themselves (mathlab-sync-*) and the account
 * store (mathlab-accounts), which are device configuration, not workspace.
 */
const KEY_SINCE = {
    'mathlab-profile': 1,
    'mathlab-exercise-progress': 1,
    'mathlab-activity': 1,
    // v2 — everything else the person accumulates as they use the site
    'mathlab-frame-bookmarks': 2,
    'mathlab-frame-prefs': 2,
    'mathlab-frame-session': 2,
    'mathlab-frame-history': 2,
    'mathlab-theme': 2,
    'mathlab-calc-history': 2,
    'mathlab-calc-memory': 2,
    'mathlab-2048-best': 2,
    'mathlab-2048-state': 2,
    'mathlab-dino-highscore': 2,
    'mathlab-nav-order': 2,
    'mathlab-tool-order': 2,
    // v3 — later web-viewer additions, which the earlier list never captured, so
    // a profile that predates them keeps its device copy until its next save
    'mathlab-frame-saved': 3,
    'mathlab-frame-zoom': 3,
    'mathlab-frame-popup-hosts': 3,
    // v4 — the new-tab scratchpad note
    'mathlab-frame-note': 4
}

export const WORKSPACE_VERSION = 4
export const WORKSPACE_KEYS = Object.keys(KEY_SINCE)

export const snapshotWorkspace = () => {
    const snap = { __v: WORKSPACE_VERSION }
    for (const k of WORKSPACE_KEYS) {
        const v = localStorage.getItem(k)
        if (v !== null) snap[k] = v
    }
    return snap
}

export const restoreWorkspace = (snap) => {
    const source = snap && typeof snap === 'object' ? snap : {}
    // No marker means a blob written before versioning, i.e. v1.
    const version = Number(source.__v) > 0 ? Number(source.__v) : 1
    for (const k of WORKSPACE_KEYS) {
        const v = source[k]
        if (typeof v === 'string') localStorage.setItem(k, v)
        else if (version >= KEY_SINCE[k]) localStorage.removeItem(k)
        // else: older than this key — leave whatever the device has, and the
        // next save folds it into the profile.
    }
}

export const isWorkspaceEmpty = (snap) => {
    const source = snap && typeof snap === 'object' ? snap : {}
    return !WORKSPACE_KEYS.some(k => {
        const v = source[k]
        if (typeof v !== 'string') return false
        try {
            const parsed = JSON.parse(v)
            return parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0
        } catch { return false }
    })
}

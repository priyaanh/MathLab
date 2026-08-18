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

/* The live keys the rest of the app reads. Signing in swaps these; nothing else
   in MathLab has to know accounts exist. */
export const WORKSPACE_KEYS = ['mathlab-profile', 'mathlab-exercise-progress', 'mathlab-activity']

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

/* ---- workspace swapping -------------------------------------------------
 * The rest of MathLab reads fixed localStorage keys. Rather than rewrite every
 * page to be account-aware, signing in swaps what lives under those keys and
 * signing out puts the signed-out data back exactly as it was.
 */

export const snapshotWorkspace = () => {
    const snap = {}
    for (const k of WORKSPACE_KEYS) {
        const v = localStorage.getItem(k)
        if (v !== null) snap[k] = v
    }
    return snap
}

export const restoreWorkspace = (snap) => {
    const source = snap && typeof snap === 'object' ? snap : {}
    for (const k of WORKSPACE_KEYS) {
        const v = source[k]
        // A key absent from the snapshot must be cleared, or one account's
        // progress would bleed through into the next session.
        if (typeof v === 'string') localStorage.setItem(k, v)
        else localStorage.removeItem(k)
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

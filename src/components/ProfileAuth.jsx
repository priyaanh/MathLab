import { useEffect, useMemo, useRef, useState } from 'react'
import {
    MIN_PASSWORD, STRENGTH_LABELS, adoptRemoteBlob, createAccount, getAccountRecord, importProfile,
    installProfileFromBlob, isWorkspaceEmpty, listAccounts, openAccount, passwordProblem,
    passwordStrength, snapshotWorkspace, usernameKey, usernameProblem
} from '../utils/accounts'
import {
    deriveAuthToken, getSyncUrl, hashContent, isSyncOn, lastContentHash, lastVersion, normaliseUrl,
    pullProfile, pushProfile, setLastContentHash, setLastVersion, setSyncOn, setSyncUrl, syncDecision
} from '../utils/sync'

/**
 * Sync as part of signing in, when it's turned on. Signing in is the one moment
 * the password is in hand, so this is where an automatic pull or push can happen
 * without holding a token in memory afterwards.
 *
 * It never overwrites unsynced local work: syncDecision only returns "pull" when
 * this device has no changes the server hasn't seen. A conflict (both sides moved)
 * or an offline server just leaves the local profile as-is to sync later — signing
 * in must not fail because a server was unreachable.
 *
 * Returns the session to actually sign in with (the adopted one after a pull).
 */
const syncOnSignIn = async (session, password) => {
    if (!isSyncOn() || !getSyncUrl()) return session
    const key = session.key
    try {
        const token = await deriveAuthToken(password, key)
        const localChanged = (await hashContent(session.data)) !== lastContentHash(key)
        let remote = null
        let hasRemote = true
        try { remote = await pullProfile({ key, token }) } catch (e) {
            if (e?.status === 404) hasRemote = false; else throw e
        }
        const decision = syncDecision({
            hasRemote, serverVersion: remote?.version || 0, seenVersion: lastVersion(key), localChanged
        })
        if (decision === 'pull') {
            const next = await adoptRemoteBlob(session, remote.blob, password)
            setLastVersion(key, remote.version)
            setLastContentHash(key, await hashContent(next.data))
            return next
        }
        if (decision === 'push') {
            await pushProfile({ key, record: getAccountRecord(key), token })
            setLastContentHash(key, await hashContent(session.data))
        }
        // 'conflict' / 'inSync': keep local; a real conflict is resolved in the Sync panel
        return session
    } catch {
        return session // offline or server down — sign in locally, sync another time
    }
}

/**
 * The sign-in / create-account card shown when no profile is unlocked.
 *
 * Deriving the key is deliberately slow (PBKDF2, 210k iterations), so every
 * submit shows a pending state — without one the card looks frozen for a
 * noticeable fraction of a second.
 */

const initials = (name) => String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?'

const ProfileAuth = ({ onSession }) => {
    const [mode, setMode] = useState(() => (listAccounts().length ? 'in' : 'new'))
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [reveal, setReveal] = useState(false)
    const [adopt, setAdopt] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [bundle, setBundle] = useState(null) // a profile file/code waiting for its password
    const [codeText, setCodeText] = useState('') // the pasted transfer code
    const [serverUrl, setServerUrl] = useState(getSyncUrl) // for the "from server" path
    const nameRef = useRef(null)
    const fileRef = useRef(null)

    const accounts = useMemo(listAccounts, [])
    // Only worth offering when there is in fact local progress to carry over.
    const hasLocalWork = useMemo(() => !isWorkspaceEmpty(snapshotWorkspace()), [])

    useEffect(() => { nameRef.current?.focus() }, [mode])

    /*
     * Errors clear on typing, not from an effect watching the field values. A
     * failed attempt blanks the password box, and an effect keyed on that value
     * would treat the blanking as a change and wipe the message that explains
     * what just went wrong.
     */
    const edit = (setter) => (e) => { setError(''); setter(e.target.value) }
    const switchMode = (next) => { setError(''); setMode(next) }

    const strength = passwordStrength(password)

    /** Read the chosen file now; the password that opens it is asked for next. */
    const pickFile = async (e) => {
        const file = e.target.files?.[0]
        e.target.value = '' // let the same file be chosen again after an error
        if (!file) return
        setError('')
        try {
            const text = await file.text()
            const parsed = JSON.parse(text)
            setBundle({ text, display: parsed?.display || '' })
            setUsername(parsed?.display || '')
            setCodeText('')
            setMode('import')
            setPassword('')
        } catch {
            setError('That file could not be read as a MathLab profile.')
        }
    }

    /** A pasted transfer code is the same JSON a file holds — parse it to unlock. */
    const pasteCode = (e) => {
        const text = e.target.value
        setCodeText(text)
        setError('')
        if (!text.trim()) { setBundle(null); return }
        try {
            const parsed = JSON.parse(text)
            setBundle({ text, display: parsed?.display || '' })
            if (parsed?.display) setUsername(parsed.display)
        } catch {
            setBundle(null) // keep what they typed; validation happens on submit
        }
    }

    const submit = async (e) => {
        e.preventDefault()
        if (busy) return

        if (mode === 'server') {
            const clean = normaliseUrl(serverUrl)
            if (!username.trim() || !password) { setError('Enter your username and password.'); return }
            if (!clean) { setError('Enter your sync server address.'); return }
            setBusy(true)
            setError('')
            try {
                setSyncUrl(clean)
                const key = usernameKey(username)
                // The token proves ownership to the server; the password also
                // decrypts the blob it returns. Both come from what was just typed.
                const token = await deriveAuthToken(password, key)
                const remote = await pullProfile({ key, token })
                const session = await installProfileFromBlob(username, password, remote.blob)
                // Remember the server, mark this device in sync at the pulled version so
                // future sign-ins here sync automatically instead of re-asking.
                setSyncOn(true)
                setLastVersion(key, remote.version)
                setLastContentHash(key, await hashContent(session.data))
                onSession(session, { adopted: false })
            } catch (err) {
                setError(err?.status === 404
                    ? 'No profile with that username is on this server yet — upload it from your other device first.'
                    : (err?.message || 'Could not sign in from the server.'))
                setPassword('')
            } finally {
                setBusy(false)
            }
            return
        }

        if (mode === 'import') {
            if (!bundle) { setError('Paste your transfer code, or choose a profile file.'); return }
            if (!password) { setError('Enter the password for this profile.'); return }
            setBusy(true)
            setError('')
            try {
                // A clashing name is renamed rather than overwriting whoever is
                // already here — two people share a device more often than not.
                const taken = listAccounts().some(a => a.display.toLowerCase() === username.trim().toLowerCase())
                const session = await importProfile(bundle.text, password, taken ? { rename: username.trim() } : {})
                onSession(session, { adopted: false })
            } catch (err) {
                setError(err?.message || 'Could not import that profile.')
                setPassword('')
            } finally {
                setBusy(false)
            }
            return
        }

        const problem = mode === 'new'
            ? (usernameProblem(username) || passwordProblem(password) || (password !== confirm ? 'The two passwords do not match.' : null))
            : (!username.trim() || !password ? 'Enter your username and password.' : null)
        if (problem) { setError(problem); return }

        setBusy(true)
        setError('')
        try {
            if (mode === 'new') {
                // A new account can adopt whatever this device already has, so
                // work done before signing up is not thrown away.
                const session = await createAccount(username, password, adopt && hasLocalWork ? snapshotWorkspace() : {})
                onSession(session, { adopted: adopt && hasLocalWork })
            } else {
                // Signing in: unlock locally, then let sync bring the latest down
                // (or push this device up) automatically while the password is here.
                const opened = await openAccount(username, password)
                const session = await syncOnSignIn(opened, password)
                onSession(session, { adopted: false })
            }
        } catch (err) {
            setError(err?.message || 'Something went wrong.')
            setPassword('')
            setConfirm('')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="auth-wrap">
            <form className="auth-card" onSubmit={submit}>
                <div className="auth-badge" aria-hidden="true">{username.trim() ? initials(username) : '🔒'}</div>

                <h1 className="auth-title">
                    {mode === 'new' ? 'Create your profile'
                        : mode === 'import' ? 'Bring your profile here'
                            : mode === 'server' ? 'Sign in from your server'
                                : 'Welcome back'}
                </h1>
                <p className="auth-sub">
                    {mode === 'new'
                        ? 'Your progress is encrypted with your password and kept on this device.'
                        : mode === 'import'
                            ? <>Unlock <b>{bundle?.display || 'this profile'}</b> with the password it was made with.</>
                            : mode === 'server'
                                ? 'Enter the username and password from your other device — your profile downloads and opens here.'
                                : 'Sign in to unlock your progress, streak and achievements.'}
                </p>

                {(mode === 'in' || mode === 'new') && (
                    <div className="auth-tabs" role="tablist" aria-label="Profile access">
                        <button type="button" role="tab" aria-selected={mode === 'in'}
                            className={`auth-tab${mode === 'in' ? ' is-on' : ''}`} onClick={() => switchMode('in')}>Sign in</button>
                        <button type="button" role="tab" aria-selected={mode === 'new'}
                            className={`auth-tab${mode === 'new' ? ' is-on' : ''}`} onClick={() => switchMode('new')}>Create account</button>
                    </div>
                )}

                {mode === 'import' && (
                    <>
                        <label className="auth-field">
                            <span>Transfer code</span>
                            <textarea
                                className="auth-code"
                                value={codeText}
                                onChange={pasteCode}
                                placeholder="Paste the transfer code you copied from the other device…"
                                spellCheck="false"
                                rows={3}
                                disabled={busy}
                            />
                        </label>
                        <button type="button" className="auth-link" onClick={() => fileRef.current?.click()} disabled={busy}>
                            …or choose a profile file instead
                        </button>
                    </>
                )}

                <label className="auth-field">
                    <span>Username</span>
                    <input
                        ref={nameRef}
                        value={username}
                        onChange={edit(setUsername)}
                        placeholder="e.g. John"
                        autoComplete="username"
                        spellCheck="false"
                        list={mode === 'in' && accounts.length ? 'auth-known' : undefined}
                        disabled={busy || mode === 'import'}
                    />
                    {mode === 'in' && accounts.length > 0 && (
                        <datalist id="auth-known">
                            {accounts.map(a => <option key={a.key} value={a.display} />)}
                        </datalist>
                    )}
                </label>

                <label className="auth-field">
                    <span>Password</span>
                    <div className="auth-pw">
                        <input
                            type={reveal ? 'text' : 'password'}
                            value={password}
                            onChange={edit(setPassword)}
                            placeholder={mode === 'new' ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
                            autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
                            disabled={busy}
                        />
                        <button
                            type="button"
                            className="auth-eye"
                            onClick={() => setReveal(r => !r)}
                            aria-label={reveal ? 'Hide password' : 'Show password'}
                            title={reveal ? 'Hide password' : 'Show password'}
                        >{reveal ? '🙈' : '👁'}</button>
                    </div>
                </label>

                {mode === 'server' && (
                    <label className="auth-field">
                        <span>Sync server</span>
                        <input
                            type="text"
                            value={serverUrl}
                            onChange={edit(setServerUrl)}
                            onBlur={() => setServerUrl(u => normaliseUrl(u))}
                            placeholder="https://your-sync-server.example"
                            spellCheck="false"
                            autoComplete="off"
                            disabled={busy}
                        />
                    </label>
                )}

                {mode === 'new' && (
                    <>
                        <div className="auth-strength" aria-hidden="true">
                            <div className="auth-bars">
                                {[0, 1, 2, 3].map(i => (
                                    <span key={i} className={`auth-bar${i < strength ? ` is-on lvl-${strength}` : ''}`} />
                                ))}
                            </div>
                            <span className="auth-strength-label">{STRENGTH_LABELS[strength]}</span>
                        </div>

                        <label className="auth-field">
                            <span>Confirm</span>
                            <input
                                type={reveal ? 'text' : 'password'}
                                value={confirm}
                                onChange={edit(setConfirm)}
                                placeholder="Type it again"
                                autoComplete="new-password"
                                disabled={busy}
                            />
                        </label>

                        {hasLocalWork && (
                            <label className="auth-check">
                                <input type="checkbox" checked={adopt} onChange={(e) => setAdopt(e.target.checked)} disabled={busy} />
                                <span>Bring the progress already on this device into my new profile</span>
                            </label>
                        )}
                    </>
                )}

                {error && <p className="auth-error" role="alert">{error}</p>}

                <button type="submit" className="btn primary auth-submit" disabled={busy}>
                    {busy
                        ? <><span className="auth-spinner" aria-hidden="true" />{mode === 'server' ? 'Downloading…' : 'Encrypting…'}</>
                        : mode === 'new' ? 'Create profile'
                            : mode === 'import' ? 'Import profile'
                                : mode === 'server' ? 'Sign in & download'
                                    : 'Unlock profile'}
                </button>

                {/* Moving a profile between devices, since nothing syncs on its own. */}
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={pickFile}
                    hidden
                />
                {mode === 'import' ? (
                    <button type="button" className="btn ghost" onClick={() => { setBundle(null); setCodeText(''); setPassword(''); switchMode('in') }} disabled={busy}>
                        Cancel
                    </button>
                ) : mode === 'server' ? (
                    <button type="button" className="btn ghost" onClick={() => { setPassword(''); switchMode('in') }} disabled={busy}>
                        Back
                    </button>
                ) : (
                    <div className="auth-alts">
                        <button type="button" className="auth-link" onClick={() => { setBundle(null); setCodeText(''); setPassword(''); switchMode('import') }} disabled={busy}>
                            Coming from another device? Paste a transfer code
                        </button>
                        <button type="button" className="auth-link" onClick={() => { setPassword(''); switchMode('server') }} disabled={busy}>
                            …or sign in from your sync server
                        </button>
                    </div>
                )}

                {/*
                  * Said plainly and up front. The page cannot honestly promise
                  * account security with no server behind it, and someone should
                  * know a forgotten password really is unrecoverable before they
                  * put a term's worth of practice behind one.
                  */}
                <details className="auth-note">
                    <summary>How safe is this?</summary>
                    <p>
                        Your progress is encrypted with <b>AES-GCM</b> under a key stretched from your
                        password with <b>PBKDF2</b>. Only the encrypted form is ever written to this
                        browser, and your password is never stored, so someone else using this computer
                        cannot read your profile without it.
                    </p>
                    <p>
                        MathLab is a site with no server, so this is not a login that verifies who you
                        are, and it cannot protect you from someone who modifies the site's own code.
                        There is <b>no password reset</b> — nothing saved on this device could recover
                        your data.
                    </p>
                    <p>
                        To use a profile on another device, turn on <b>Sync</b> (you run the small
                        server yourself). After that, just sign in with your username and password —
                        the newest copy comes down and your changes go up automatically, still
                        encrypted end to end. No file to carry, though export/import is still there
                        if you prefer it.
                    </p>
                </details>
            </form>
        </div>
    )
}

export default ProfileAuth

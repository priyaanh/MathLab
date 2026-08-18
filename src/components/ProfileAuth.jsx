import { useEffect, useMemo, useRef, useState } from 'react'
import {
    MIN_PASSWORD, STRENGTH_LABELS, createAccount, isWorkspaceEmpty, listAccounts, openAccount,
    passwordProblem, passwordStrength, snapshotWorkspace, usernameProblem
} from '../utils/accounts'

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
    const nameRef = useRef(null)

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

    const submit = async (e) => {
        e.preventDefault()
        if (busy) return

        const problem = mode === 'new'
            ? (usernameProblem(username) || passwordProblem(password) || (password !== confirm ? 'The two passwords do not match.' : null))
            : (!username.trim() || !password ? 'Enter your username and password.' : null)
        if (problem) { setError(problem); return }

        setBusy(true)
        setError('')
        try {
            const session = mode === 'new'
                // A new account can adopt whatever this device already has, so
                // work done before signing up is not thrown away.
                ? await createAccount(username, password, adopt && hasLocalWork ? snapshotWorkspace() : {})
                : await openAccount(username, password)
            onSession(session, { adopted: mode === 'new' && adopt && hasLocalWork })
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

                <h1 className="auth-title">{mode === 'new' ? 'Create your profile' : 'Welcome back'}</h1>
                <p className="auth-sub">
                    {mode === 'new'
                        ? 'Your progress is encrypted with your password and kept on this device.'
                        : 'Sign in to unlock your progress, streak and achievements.'}
                </p>

                <div className="auth-tabs" role="tablist" aria-label="Profile access">
                    <button type="button" role="tab" aria-selected={mode === 'in'}
                        className={`auth-tab${mode === 'in' ? ' is-on' : ''}`} onClick={() => switchMode('in')}>Sign in</button>
                    <button type="button" role="tab" aria-selected={mode === 'new'}
                        className={`auth-tab${mode === 'new' ? ' is-on' : ''}`} onClick={() => switchMode('new')}>Create account</button>
                </div>

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
                        disabled={busy}
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
                        ? <><span className="auth-spinner" aria-hidden="true" />Encrypting…</>
                        : (mode === 'new' ? 'Create profile' : 'Unlock profile')}
                </button>

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
                        your data — and profiles do not follow you to another browser.
                    </p>
                </details>
            </form>
        </div>
    )
}

export default ProfileAuth

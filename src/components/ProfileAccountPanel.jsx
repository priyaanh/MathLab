import { useState } from 'react'
import { useSession } from '../profile/SessionContext'
import {
    MIN_PASSWORD, changePassword, deleteAccount, exportFilename, exportProfile, passwordProblem
} from '../utils/accounts'

/**
 * Account controls for an unlocked profile: save on demand, change the password,
 * or delete the profile outright.
 *
 * Changing the password re-encrypts the data under a key derived from the new
 * one — there is no stored copy to re-point, so the payload itself is rewritten.
 */
const ProfileAccountPanel = ({ onFlash }) => {
    const { session, persist, signOut, replaceSession } = useSession()
    const [open, setOpen] = useState(false)
    const [current, setCurrent] = useState('')
    const [next, setNext] = useState('')
    const [confirm, setConfirm] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [danger, setDanger] = useState(false)
    const [typed, setTyped] = useState('')

    const saveNow = async () => {
        setBusy(true)
        const okSaved = await persist()
        setBusy(false)
        onFlash?.(okSaved ? 'Profile encrypted and saved.' : 'Could not save — this profile may have been removed.')
    }

    /** Flush first, or the file would be a snapshot of the last autosave. */
    const downloadProfile = async () => {
        setBusy(true)
        try {
            await persist()
            const blob = new Blob([exportProfile(session.key)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = exportFilename(session.display)
            document.body.appendChild(a)
            a.click()
            a.remove()
            // Revoked on a later tick so the download has taken the URL first.
            setTimeout(() => URL.revokeObjectURL(url), 10000)
            onFlash?.('Profile downloaded — import it on the other device with the same password.')
        } catch (err) {
            onFlash?.(err?.message || 'Could not export this profile.')
        } finally {
            setBusy(false)
        }
    }

    /** No file to shuffle: copy the encrypted profile as text to paste on another
        device's sign-in screen. Works with no server, on the deployed site too. */
    const copyTransferCode = async () => {
        setBusy(true)
        try {
            await persist()
            const code = exportProfile(session.key)
            try {
                await navigator.clipboard.writeText(code)
                onFlash?.('Transfer code copied — on the other device choose “Paste a transfer code” and paste it.')
            } catch {
                // clipboard blocked (e.g. not focused): fall back to a file
                const blob = new Blob([code], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = exportFilename(session.display)
                document.body.appendChild(a); a.click(); a.remove()
                setTimeout(() => URL.revokeObjectURL(url), 10000)
                onFlash?.('Clipboard was blocked, so the profile downloaded as a file instead.')
            }
        } catch (err) {
            onFlash?.(err?.message || 'Could not export this profile.')
        } finally {
            setBusy(false)
        }
    }

    const submitPassword = async (e) => {
        e.preventDefault()
        if (busy) return
        const problem = passwordProblem(next) || (next !== confirm ? 'The two new passwords do not match.' : null)
        if (problem) { setError(problem); return }
        setBusy(true)
        setError('')
        try {
            // Flush first: re-encryption snapshots what is stored, so anything
            // not yet written back would be re-wrapped from a stale payload.
            await persist()
            replaceSession(await changePassword(session, current, next))
            setCurrent(''); setNext(''); setConfirm(''); setOpen(false)
            onFlash?.('Password changed. Your data was re-encrypted.')
        } catch (err) {
            setError(err?.message || 'Could not change the password.')
        } finally {
            setBusy(false)
        }
    }

    const confirmDelete = async () => {
        if (typed !== session.display) return
        deleteAccount(session.key)
        // Sign out through the provider so the signed-out workspace is restored
        // rather than leaving the deleted account's data installed.
        await signOut()
    }

    return (
        <div className="panel">
            <h2>Profile &amp; security</h2>

            <div className="acct-row">
                <span className="acct-label">Username</span>
                <span className="acct-value">{session.display}</span>
            </div>
            <div className="acct-row">
                <span className="acct-label">Encryption</span>
                <span className="acct-value">AES-GCM · PBKDF2-SHA256</span>
            </div>

            <p className="hint" style={{ marginTop: '0.8rem' }}>
                Progress saves automatically while you practise. Only the encrypted form is
                written to this browser, and your password is never stored.
            </p>

            <div className="acct-actions">
                <button className="btn ghost" onClick={saveNow} disabled={busy}>Save now</button>
                <button className="btn ghost" onClick={() => { setOpen(o => !o); setError('') }} aria-expanded={open}>
                    Change password
                </button>
                <button className="btn ghost" onClick={copyTransferCode} disabled={busy}>Copy transfer code</button>
                <button className="btn ghost" onClick={downloadProfile} disabled={busy}>Download as a file</button>
            </div>

            <p className="hint" style={{ marginTop: '0.6rem' }}>
                To move your progress to another device without running a sync server:
                <b> Copy transfer code</b> here, then on the other device choose
                <b> “Paste a transfer code”</b> on the sign-in screen and paste it (or use the
                file). It stays encrypted and opens with the same password, so it is safe to
                send to yourself however is easiest.
            </p>

            {open && (
                <form className="acct-form" onSubmit={submitPassword}>
                    <label className="field">
                        Current password
                        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
                            autoComplete="current-password" disabled={busy} />
                    </label>
                    <label className="field">
                        New password
                        <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
                            placeholder={`At least ${MIN_PASSWORD} characters`} autoComplete="new-password" disabled={busy} />
                    </label>
                    <label className="field">
                        Confirm new password
                        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                            autoComplete="new-password" disabled={busy} />
                    </label>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <button className="btn primary" type="submit" disabled={busy}>
                        {busy ? 'Re-encrypting…' : 'Change password'}
                    </button>
                </form>
            )}

            <div className="acct-danger">
                {!danger ? (
                    <button className="btn ghost is-danger" onClick={() => setDanger(true)}>Delete this profile</button>
                ) : (
                    <>
                        <p className="hint">
                            This erases <b>{session.display}</b> and everything in it. Because the data is
                            encrypted with your password and nothing is stored on a server, <b>it cannot be
                            recovered</b>. Type the username to confirm.
                        </p>
                        <input
                            className="acct-confirm"
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            placeholder={session.display}
                            aria-label="Type your username to confirm deletion"
                        />
                        <div className="acct-actions">
                            <button className="btn ghost is-danger" onClick={confirmDelete} disabled={typed !== session.display}>
                                Delete permanently
                            </button>
                            <button className="btn ghost" onClick={() => { setDanger(false); setTyped('') }}>Cancel</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default ProfileAccountPanel

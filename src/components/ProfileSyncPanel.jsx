import { useState } from 'react'
import { useSession } from '../profile/SessionContext'
import { adoptRemoteBlob, getAccountRecord, restoreWorkspace, snapshotWorkspace } from '../utils/accounts'
import {
    checkServer, deriveAuthToken, getSyncUrl, hashContent, isSyncOn, lastVersion, normaliseUrl,
    pullProfile, pushProfile, setLastContentHash, setLastVersion, setSyncOn, setSyncUrl
} from '../utils/sync'

/**
 * Sync settings for an unlocked profile.
 *
 * The password is asked for on every sync rather than kept around. The auth
 * token is derived from it and thrown away with it — holding either in memory
 * for the whole session would turn a single XSS into every-device access, and
 * syncing is rare enough that typing a password is a fair trade.
 */
const ProfileSyncPanel = ({ onFlash }) => {
    const { session, persist, replaceSession } = useSession()
    const [url, setUrl] = useState(getSyncUrl)
    const [on, setOn] = useState(isSyncOn)
    const [password, setPassword] = useState('')
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')
    const [conflict, setConflict] = useState(null)

    const version = lastVersion(session.key)

    const withPassword = async (label, fn) => {
        if (!password) { setError('Enter your profile password to sync.'); return }
        setBusy(label)
        setError('')
        try {
            // Keyed on the username so every device derives the same token — the
            // stored salt is random per device and would not agree across two.
            const token = await deriveAuthToken(password, session.key)
            await fn({ token })
        } catch (err) {
            if (err?.status === 409) setConflict({ serverVersion: err.serverVersion })
            else setError(err?.message || 'Sync failed.')
        } finally {
            setBusy('')
        }
    }

    const testServer = async () => {
        setBusy('test'); setError('')
        try {
            setSyncUrl(url)
            const out = await checkServer()
            onFlash?.(`Server reachable — holding ${out.profiles} profile${out.profiles === 1 ? '' : 's'}.`)
        } catch (err) {
            setError(err?.message || 'Could not reach that server.')
        } finally { setBusy('') }
    }

    const doPush = (force = false) => withPassword('push', async ({ token }) => {
        // Flush first, then re-read: persist() rewrites the stored ciphertext, so
        // the record captured before this point is already out of date.
        await persist()
        if (force) {
            // Take the server's version as the base so the write is accepted, which
            // is what "mine wins" has to mean once a conflict is already known.
            const remote = await pullProfile({ key: session.key, token })
            setLastVersion(session.key, remote.version)
        }
        await pushProfile({ key: session.key, record: getAccountRecord(session.key), token })
        // record this device as in sync, so a later sign-in doesn't re-push
        setLastContentHash(session.key, await hashContent(snapshotWorkspace()))
        setConflict(null)
        onFlash?.('Profile uploaded. It will now come down automatically when you sign in elsewhere.')
    })

    const doPull = () => withPassword('pull', async ({ token }) => {
        const remote = await pullProfile({ key: session.key, token })
        const next = await adoptRemoteBlob(session, remote.blob, password)
        restoreWorkspace(next.data)          // make the pulled data live immediately
        // Bumping the revision remounts the profile view. Without it the page
        // keeps rendering the state it read on mount, so a pull looked like it
        // had done nothing even though the new data was already in storage.
        replaceSession({ ...next, revision: (session.revision || 0) + 1 })
        setLastVersion(session.key, remote.version)
        setLastContentHash(session.key, await hashContent(next.data))
        setConflict(null)
        onFlash?.('Pulled the newest profile from the server.')
    })

    const toggle = (want) => {
        if (want && !normaliseUrl(url)) { setError('Set a server address first.'); return }
        if (want) setSyncUrl(url)
        setSyncOn(want)
        setOn(want)
    }

    return (
        <div className="panel">
            <h2>Sync across devices</h2>

            <p className="hint">
                Point this at your own sync server. Once it&apos;s on, signing in on any device
                syncs on its own — the newest copy comes down and your changes go up, using the
                password you type at sign-in. Only the encrypted profile is uploaded; the server
                never receives your password or anything that could open it. The buttons below are
                for a manual sync or to settle a conflict.
            </p>

            <label className="field" style={{ marginTop: '0.9rem' }}>
                Server address
                <input
                    type="text"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setError('') }}
                    onBlur={() => setUrl(u => normaliseUrl(u))}
                    placeholder="https://your-sync-server.example"
                    spellCheck="false"
                    autoComplete="off"
                />
            </label>

            <div className="acct-actions">
                <button className="btn ghost" onClick={testServer} disabled={!!busy || !url.trim()}>
                    {busy === 'test' ? 'Checking…' : 'Test connection'}
                </button>
                <button className="btn ghost" onClick={() => toggle(!on)} disabled={!!busy}>
                    {on ? 'Turn sync off' : 'Turn sync on'}
                </button>
            </div>

            {on && (
                <>
                    <div className="acct-row" style={{ marginTop: '0.9rem' }}>
                        <span className="acct-label">Status</span>
                        <span className="acct-value">{version ? `Synced · v${version}` : 'Not uploaded yet'}</span>
                    </div>

                    <label className="field" style={{ marginTop: '0.8rem' }}>
                        Profile password
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError('') }}
                            placeholder="Needed for each sync"
                            autoComplete="current-password"
                        />
                    </label>

                    <div className="acct-actions">
                        <button className="btn ghost" onClick={() => doPush()} disabled={!!busy || !password}>
                            {busy === 'push' ? 'Uploading…' : 'Upload this device'}
                        </button>
                        <button className="btn ghost" onClick={doPull} disabled={!!busy || !password}>
                            {busy === 'pull' ? 'Downloading…' : 'Download from server'}
                        </button>
                    </div>

                    {conflict && (
                        <div className="sync-conflict" role="alert">
                            <b>This profile changed on another device.</b>
                            <p className="hint">
                                The server is at v{conflict.serverVersion} and this device has not seen it.
                                Downloading replaces what is here; uploading replaces what is there. Whichever
                                you skip is lost, so pick the one you have not been working on.
                            </p>
                            <div className="acct-actions">
                                <button className="btn ghost" onClick={doPull} disabled={!!busy}>Use the server&apos;s copy</button>
                                <button className="btn ghost is-danger" onClick={() => doPush(true)} disabled={!!busy}>
                                    Overwrite with this device
                                </button>
                            </div>
                        </div>
                    )}

                    {error && <p className="auth-error" role="alert" style={{ marginTop: '0.7rem' }}>{error}</p>}
                </>
            )}

            {!on && error && <p className="auth-error" role="alert" style={{ marginTop: '0.7rem' }}>{error}</p>}

            <details className="auth-note" style={{ marginTop: '1rem' }}>
                <summary>What the server can and cannot see</summary>
                <p>
                    It stores your username, the encrypted profile, and a hash of a token derived
                    from your password. The key that decrypts the profile is derived separately and
                    never leaves this browser, so whoever runs the server — including you — cannot
                    read the contents.
                </p>
                <p>
                    Because of that, the server cannot reset a forgotten password either. Run it
                    yourself — <code>npm run sync</code> in the project starts it on port 8787; then
                    put its address above. <code>server/README.md</code> has the details.
                </p>
                <p>
                    If a secure (https) MathLab can&apos;t reach a server at <code>http://…</code>,
                    that&apos;s the browser blocking it: use <code>http://localhost:8787</code> on the
                    same machine, or give the server an https address.
                </p>
            </details>
        </div>
    )
}

export default ProfileSyncPanel

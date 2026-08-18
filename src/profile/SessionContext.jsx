import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { restoreWorkspace, saveAccountData, snapshotWorkspace } from '../utils/accounts'

/**
 * Holds the unlocked profile for the whole app, not just the Profile page.
 *
 * It has to live above the router. Signing in swaps what sits under the shared
 * localStorage keys, so if the session died whenever the Profile page unmounted,
 * walking over to /exercises would leave the account's data installed with
 * nobody left to save it back — and the signed-out data it displaced would be
 * lost with the component that was holding it.
 *
 * The derived key is kept in memory only and never serialised. That is what
 * makes the encryption worth anything, and it is why a reload signs you out.
 */

const SessionContext = createContext(null)

/** Practice happens away from the Profile page, so progress is swept up on a timer. */
const AUTOSAVE_MS = 15000

export const SessionProvider = ({ children }) => {
    const [session, setSession] = useState(null)
    // What was under the shared keys before signing in, put back on sign-out.
    const signedOutData = useRef(null)
    // Latest session for unmount/hide handlers that must not re-subscribe.
    const live = useRef(null)
    live.current = session

    const persist = useCallback(async () => {
        const current = live.current
        if (!current) return false
        try {
            await saveAccountData(current, snapshotWorkspace())
            return true
        } catch {
            return false // account deleted from another tab, or storage full
        }
    }, [])

    const signIn = useCallback((nextSession, { adopted = false } = {}) => {
        const before = snapshotWorkspace()
        // When the new account adopted this device's work, that work now belongs
        // to the profile — leaving a copy behind would resurrect it on sign-out.
        signedOutData.current = adopted ? {} : before
        restoreWorkspace(nextSession.data)
        setSession(nextSession)
    }, [])

    const signOut = useCallback(async () => {
        await persist()
        restoreWorkspace(signedOutData.current || {})
        signedOutData.current = null
        setSession(null)
    }, [persist])

    /** After a password change the key changes; the identity does not. */
    const replaceSession = useCallback((next) => setSession(next), [])

    useEffect(() => {
        if (!session) return undefined
        const timer = setInterval(persist, AUTOSAVE_MS)
        // Closing the tab cannot await, but hiding it is the reliable moment to
        // flush — pagehide/beforeunload would not survive the async encrypt.
        const onHide = () => { if (document.visibilityState === 'hidden') persist() }
        document.addEventListener('visibilitychange', onHide)
        return () => {
            clearInterval(timer)
            document.removeEventListener('visibilitychange', onHide)
            persist()
        }
    }, [session, persist])

    return (
        <SessionContext.Provider value={{ session, signIn, signOut, persist, replaceSession }}>
            {children}
        </SessionContext.Provider>
    )
}

export const useSession = () => {
    const ctx = useContext(SessionContext)
    if (!ctx) throw new Error('useSession must be used inside a SessionProvider')
    return ctx
}

export default SessionContext

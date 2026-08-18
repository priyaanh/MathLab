import { useEffect, useRef } from 'react'

/**
 * Watches for a word typed anywhere on the page and fires when one matches.
 *
 * Nothing on screen points at these — the footer buttons that used to open them
 * are gone, so a typed word is the only way in. That is the whole point: the
 * panels are meant to be unfindable by clicking around.
 *
 * A rolling buffer is used rather than an index per code, so a mistyped prefix
 * cannot wedge matching until the page reloads: "xyxyzzy" still ends in "xyzzy"
 * and still opens.
 */

// Longest code decides how much history is worth keeping.
const bufferSize = (codes) => Math.max(...Object.keys(codes).map(c => c.length), 1)

/** Typing into a field is writing, not summoning — never match there. */
const isTypingTarget = (el) => {
    if (!el) return false
    if (el.isContentEditable) return true
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export const useSecretCode = (codes, onMatch) => {
    // Kept in refs so the listener is bound once and never misses keys while
    // React re-renders between keystrokes.
    const buffer = useRef('')
    const handler = useRef(onMatch)
    handler.current = onMatch

    useEffect(() => {
        const size = bufferSize(codes)

        const onKey = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return
            if (isTypingTarget(e.target)) return
            // Single printable characters only: letters and digits, so the codes
            // can mix both without Shift or punctuation interfering.
            if (typeof e.key !== 'string' || e.key.length !== 1) return
            if (!/[a-z0-9]/i.test(e.key)) return

            buffer.current = (buffer.current + e.key.toLowerCase()).slice(-size)

            for (const [code, id] of Object.entries(codes)) {
                if (buffer.current.endsWith(code)) {
                    buffer.current = '' // don't let one word re-fire on the next key
                    handler.current?.(id, code)
                    return
                }
            }
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // codes is a module-level constant at every call site; re-binding on a
        // fresh object identity each render would drop the buffer mid-word.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
}

export default useSecretCode

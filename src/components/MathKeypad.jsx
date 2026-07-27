import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * A global on-screen keypad for people without a physical keyboard.
 *
 * It pops up next to any text input/textarea marked with `data-keypad`
 * (`data-keypad="full"` for math expressions, `data-keypad="number"` for
 * numeric fields) and inserts characters at the caret. Buttons use
 * onMouseDown+preventDefault so the target input never loses focus.
 *
 * Values are chosen to parse everywhere: × → *, ÷ → /, − → -, √ → sqrt(,
 * π → pi, functions insert "name(".
 */

// Programmatically set a React-controlled input's value and notify React.
const setNativeValue = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
}

const FN_KEYS = [
    { t: 'sin', v: 'sin(' }, { t: 'cos', v: 'cos(' }, { t: 'tan', v: 'tan(' },
    { t: 'ln', v: 'ln(' }, { t: 'log', v: 'log(' }, { t: '√', v: 'sqrt(' }
]
const VAR_KEYS = [
    { t: 'x', v: 'x' }, { t: 'y', v: 'y' }, { t: 'i', v: 'i' }, { t: '(', v: '(' }, { t: ')', v: ')' },
    { t: '^', v: '^' }, { t: 'π', v: 'pi' }
]
// Numeric pad shared by both variants; the trailing operator column only shows
// in the "full" math layout.
const PAD = [
    ['7', '8', '9', { t: '÷', v: '/' }],
    ['4', '5', '6', { t: '×', v: '*' }],
    ['1', '2', '3', { t: '−', v: '-' }],
    ['0', '.', { t: '=', v: '=' }, { t: '+', v: '+' }]
]

const key = (k) => (typeof k === 'string' ? { t: k, v: k } : k)

const MathKeypad = () => {
    const [target, setTarget] = useState(null)
    const [variant, setVariant] = useState('full')
    const [pos, setPos] = useState({ top: 0, left: 0 })
    const panelRef = useRef(null)
    const hideTimer = useRef(null)
    // Once the user drags the panel we stop auto-snapping it to the field, so a
    // scroll/resize can't yank it back over the question they moved it off of.
    const draggedRef = useRef(false)
    const dragState = useRef(null)
    const targetRef = useRef(null)
    targetRef.current = target

    const reposition = useCallback((el) => {
        if (!el || draggedRef.current) return
        // Anchor to the whole question card, not just the input, so the panel
        // opens beside the card and level with its top — in the open margin.
        const card = el.closest('.panel, .ex-card, .ex-session') || el
        const c = card.getBoundingClientRect()
        const r = el.getBoundingClientRect()
        const panelW = panelRef.current?.offsetWidth || 300
        const panelH = panelRef.current?.offsetHeight || 240
        const gap = 12
        const clampTop = (t) => Math.min(Math.max(8, t), window.innerHeight - panelH - 8)
        const clampLeft = (l) => Math.min(Math.max(8, l), window.innerWidth - panelW - 8)

        // Prefer the open space to the right of the card, then its left; fall
        // back to below / above the input only on narrow layouts where neither
        // side fits.
        if (c.right + gap + panelW <= window.innerWidth - 8) {
            setPos({ top: clampTop(c.top), left: c.right + gap })
        } else if (c.left - gap - panelW >= 8) {
            setPos({ top: clampTop(c.top), left: c.left - gap - panelW })
        } else {
            let top = r.bottom + gap
            // Flip above the field if it would overflow the bottom of the viewport.
            if (top + panelH > window.innerHeight - 8) top = Math.max(8, r.top - panelH - gap)
            setPos({ top, left: clampLeft(r.left) })
        }
    }, [])

    useEffect(() => {
        const onFocusIn = (e) => {
            const el = e.target
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.dataset.keypad) {
                clearTimeout(hideTimer.current)
                // A fresh field earns a fresh auto-position.
                if (el !== targetRef.current) draggedRef.current = false
                setTarget(el)
                const v = el.dataset.keypad
                setVariant(v === 'number' || v === 'data' ? v : 'full')
                // Wait a frame so the panel has measured dimensions.
                requestAnimationFrame(() => reposition(el))
            }
        }
        const onFocusOut = (e) => {
            // Ignore blurs caused by pressing a keypad button (focus stays put).
            if (panelRef.current && panelRef.current.contains(e.relatedTarget)) return
            hideTimer.current = setTimeout(() => setTarget(null), 120)
        }
        document.addEventListener('focusin', onFocusIn)
        document.addEventListener('focusout', onFocusOut)
        return () => {
            document.removeEventListener('focusin', onFocusIn)
            document.removeEventListener('focusout', onFocusOut)
        }
    }, [reposition])

    useEffect(() => {
        if (!target) return
        const on = () => reposition(target)
        window.addEventListener('resize', on)
        window.addEventListener('scroll', on, true)
        return () => {
            window.removeEventListener('resize', on)
            window.removeEventListener('scroll', on, true)
        }
    }, [target, reposition])

    // Reading selection on a type="number" input throws in some browsers — fall
    // back to appending at the end there.
    const caretOf = (el) => {
        try { return [el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length] }
        catch { return [el.value.length, el.value.length] }
    }

    const insert = (text) => {
        const el = target
        if (!el) return
        const [start, end] = caretOf(el)
        const value = el.value.slice(0, start) + text + el.value.slice(end)
        setNativeValue(el, value)
        const caret = start + text.length
        requestAnimationFrame(() => { el.focus(); try { el.setSelectionRange(caret, caret) } catch { /* ignore */ } })
    }

    const backspace = () => {
        const el = target
        if (!el) return
        let [start, end] = caretOf(el)
        let value
        if (start !== end) {
            value = el.value.slice(0, start) + el.value.slice(end)
        } else if (start > 0) {
            value = el.value.slice(0, start - 1) + el.value.slice(start)
            start -= 1
        } else {
            return
        }
        setNativeValue(el, value)
        requestAnimationFrame(() => { el.focus(); try { el.setSelectionRange(start, start) } catch { /* ignore */ } })
    }

    // Drag the panel by its header. Buttons inside the header (the close ✕)
    // opt out so a click there still hides the keypad instead of dragging.
    const startDrag = (e) => {
        if (e.target.closest('button')) return
        e.preventDefault()
        const panelW = panelRef.current?.offsetWidth || 300
        const panelH = panelRef.current?.offsetHeight || 240
        dragState.current = { dx: e.clientX - pos.left, dy: e.clientY - pos.top, panelW, panelH }
        draggedRef.current = true

        const onMove = (ev) => {
            const d = dragState.current
            if (!d) return
            const left = Math.min(Math.max(8, ev.clientX - d.dx), window.innerWidth - d.panelW - 8)
            const top = Math.min(Math.max(8, ev.clientY - d.dy), window.innerHeight - d.panelH - 8)
            setPos({ top, left })
        }
        const onUp = () => {
            dragState.current = null
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
    }

    if (!target) return null

    // A button that inserts without stealing focus from the input.
    const Btn = ({ label, onPress, cls = '' }) => (
        <button
            type="button"
            className={`mk-key ${cls}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onPress}
        >
            {label}
        </button>
    )

    return (
        <div
            ref={panelRef}
            className="math-keypad"
            style={{ top: pos.top, left: pos.left }}
            role="group"
            aria-label="On-screen keypad"
        >
            <div className="mk-head" onPointerDown={startDrag}>
                <span>⠿ Keypad</span>
                <button type="button" className="mk-close" onMouseDown={(e) => e.preventDefault()} onClick={() => setTarget(null)} aria-label="Hide keypad">×</button>
            </div>

            {variant === 'full' && (
                <>
                    <div className="mk-row mk-fns">
                        {FN_KEYS.map(k => <Btn key={k.t} label={k.t} cls="fn" onPress={() => insert(k.v)} />)}
                    </div>
                    <div className="mk-row mk-vars">
                        {VAR_KEYS.map(k => <Btn key={k.t} label={k.t} cls="var" onPress={() => insert(k.v)} />)}
                    </div>
                </>
            )}

            <div className="mk-pad">
                {PAD.map((row, ri) => (
                    <div key={ri} className="mk-row">
                        {row.map((raw) => {
                            const k = key(raw)
                            // Numeric variants hide × ÷ + = ; "data" (lists) reuses
                            // the "=" slot for a comma separator.
                            if (variant !== 'full' && '/*+='.includes(k.v)) {
                                if (k.v === '=' && variant === 'data') {
                                    return <Btn key="comma" label="," onPress={() => insert(', ')} />
                                }
                                return <span key={k.t} className="mk-key ghost" aria-hidden="true" />
                            }
                            return <Btn key={k.t} label={k.t} cls={/[0-9.]/.test(k.t) ? 'num' : 'op'} onPress={() => insert(k.v)} />
                        })}
                    </div>
                ))}
                <div className="mk-row">
                    {variant === 'data' && <Btn label="space" cls="op" onPress={() => insert(' ')} />}
                    <Btn label="⌫" cls={`op${variant === 'data' ? '' : ' wide'}`} onPress={backspace} />
                </div>
            </div>
        </div>
    )
}

export default MathKeypad

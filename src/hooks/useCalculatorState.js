import { useState, useEffect } from 'react'

/**
 * Calculator mode constants
 */
export const CALCULATOR_MODES = {
    NORMAL: 'normal',
    SCIENTIFIC: 'scientific'
}

const MEMORY_KEY = 'mathlab-calc-memory'
const HISTORY_KEY = 'mathlab-calc-history'
const HISTORY_LIMIT = 100

// Read a JSON value from localStorage, falling back when unavailable/corrupt.
const readStored = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key)
        if (raw == null) return fallback
        const parsed = JSON.parse(raw)
        return parsed == null ? fallback : parsed
    } catch {
        return fallback
    }
}

// Persist a value as JSON, swallowing failures (private mode / quota).
const writeStored = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch {
        /* ignore persistence failure */
    }
}

/**
 * Custom hook for managing calculator state
 */
export const useCalculatorState = () => {
    const [display, setDisplay] = useState('0')
    const [previousValue, setPreviousValue] = useState(null)
    const [operation, setOperation] = useState(null)
    const [waitingForOperand, setWaitingForOperand] = useState(false)
    const [memory, setMemory] = useState(() => {
        const v = readStored(MEMORY_KEY, 0)
        return typeof v === 'number' && Number.isFinite(v) ? v : 0
    })
    const [expression, setExpression] = useState('')
    const [currentExpression, setCurrentExpression] = useState('')
    const [justCalculated, setJustCalculated] = useState(false)
    const [theme, setTheme] = useState('black-orange')
    const [calculatorMode, setCalculatorMode] = useState(CALCULATOR_MODES.NORMAL)
    const [angleMode, setAngleMode] = useState('DEG')
    // The last computed answer, recallable via the Ans key.
    const [lastAnswer, setLastAnswer] = useState(0)
    // Calculation history: newest first, each { expr, result }.
    const [history, setHistory] = useState(() => {
        const v = readStored(HISTORY_KEY, [])
        return Array.isArray(v) ? v.slice(0, HISTORY_LIMIT) : []
    })

    // Persist memory and history whenever they change.
    useEffect(() => { writeStored(MEMORY_KEY, memory) }, [memory])
    useEffect(() => { writeStored(HISTORY_KEY, history) }, [history])

    return {
        display, setDisplay,
        previousValue, setPreviousValue,
        operation, setOperation,
        waitingForOperand, setWaitingForOperand,
        memory, setMemory,
        expression, setExpression,
        currentExpression, setCurrentExpression,
        justCalculated, setJustCalculated,
        theme, setTheme,
        calculatorMode, setCalculatorMode,
        angleMode, setAngleMode,
        lastAnswer, setLastAnswer,
        history, setHistory,
        HISTORY_LIMIT
    }
}

/**
 * Custom hook for managing expression editing state
 */
export const useExpressionEditing = () => {
    const [cursorPosition, setCursorPosition] = useState(0)
    const [isEditing, setIsEditing] = useState(false)

    return {
        cursorPosition, setCursorPosition,
        isEditing, setIsEditing
    }
}

/**
 * Custom hook for managing keyboard navigation state
 */
export const useKeyboardNavigation = () => {
    const [focusedButtonIndex, setFocusedButtonIndex] = useState(-1)
    const [isKeypadNavigationActive, setIsKeypadNavigationActive] = useState(false)
    const [showAccessibilityHelp, setShowAccessibilityHelp] = useState(false)

    return {
        focusedButtonIndex, setFocusedButtonIndex,
        isKeypadNavigationActive, setIsKeypadNavigationActive,
        showAccessibilityHelp, setShowAccessibilityHelp
    }
}

/**
 * Custom hook for managing theme changes
 */
export const useTheme = (theme) => {
    useEffect(() => {
        const backgrounds = {
            'black-orange': 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #ff6600 100%)',
            'black-white': 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #ffffff 100%)',
            'white-black': 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #333333 100%)'
        }
        document.body.style.background = backgrounds[theme]
    }, [theme])
}

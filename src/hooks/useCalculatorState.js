import { useState, useEffect } from 'react'

/**
 * Calculator mode constants
 */
export const CALCULATOR_MODES = {
    NORMAL: 'normal',
    SCIENTIFIC: 'scientific'
}

/**
 * Custom hook for managing calculator state
 */
export const useCalculatorState = () => {
    const [display, setDisplay] = useState('0')
    const [previousValue, setPreviousValue] = useState(null)
    const [operation, setOperation] = useState(null)
    const [waitingForOperand, setWaitingForOperand] = useState(false)
    const [memory, setMemory] = useState(0)
    const [expression, setExpression] = useState('')
    const [currentExpression, setCurrentExpression] = useState('')
    const [justCalculated, setJustCalculated] = useState(false)
    const [theme, setTheme] = useState('black-orange')
    const [calculatorMode, setCalculatorMode] = useState(CALCULATOR_MODES.NORMAL)
    const [angleMode, setAngleMode] = useState('DEG')

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
        angleMode, setAngleMode
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

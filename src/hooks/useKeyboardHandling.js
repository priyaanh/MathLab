import { useCallback, useEffect } from 'react'
import { getButtonData } from '../utils/buttonUtils'

/**
 * Custom hook for keyboard navigation and input handling
 */
export const useKeyboardHandling = (
    calculatorState,
    expressionState,
    navigationState,
    operations,
    copyPasteOperations = null
) => {
    const { isScientific } = calculatorState
    const { isEditing, cursorPosition, expression, setIsEditing, setCursorPosition, setExpression, setCurrentExpression } = expressionState
    const {
        focusedButtonIndex,
        setFocusedButtonIndex,
        isKeypadNavigationActive,
        setIsKeypadNavigationActive,
        showAccessibilityHelp,
        setShowAccessibilityHelp
    } = navigationState
    const { inputNumber, inputDecimal, performOperation, insertAtCursor, deleteAtCursor } = operations

    const handleKeyDown = useCallback((e) => {
        // Keyboard shortcuts for math operations
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'm': // Alt+M for multiplication
                    e.preventDefault()
                    if (isEditing) {
                        insertAtCursor('×')
                    } else {
                        performOperation('×')
                    }
                    return
                case 'd': // Alt+D for division
                    e.preventDefault()
                    if (isEditing) {
                        insertAtCursor('÷')
                    } else {
                        performOperation('÷')
                    }
                    return
                case 'a': // Alt+A for addition
                    e.preventDefault()
                    if (isEditing) {
                        insertAtCursor('+')
                    } else {
                        performOperation('+')
                    }
                    return
                case 's': // Alt+S for subtraction
                    e.preventDefault()
                    if (isEditing) {
                        insertAtCursor('-')
                    } else {
                        performOperation('-')
                    }
                    return
                case 'p': // Alt+P for power
                    e.preventDefault()
                    if (isEditing) {
                        insertAtCursor('^')
                    } else {
                        performOperation('^')
                    }
                    return
                case 'r': // Alt+R for remainder/modulo
                    e.preventDefault()
                    if (isEditing) {
                        insertAtCursor('%')
                    } else {
                        performOperation('%')
                    }
                    return
            }
        }

        // Handle copy/paste keyboard shortcuts
        if (copyPasteOperations && (e.ctrlKey || e.metaKey)) {
            if (e.key === 'c' || e.key === 'C') {
                e.preventDefault()
                if (e.shiftKey && e.altKey) {
                    // Ctrl+Shift+Alt+C - Copy equation
                    copyPasteOperations.copyWithFeedback('equation')
                } else if (e.shiftKey) {
                    // Ctrl+Shift+C - Copy expression
                    copyPasteOperations.copyWithFeedback('expression')
                } else {
                    // Ctrl+C - Copy result
                    copyPasteOperations.copyWithFeedback('result')
                }
                return
            } else if (e.key === 'v' || e.key === 'V') {
                e.preventDefault()
                // Ctrl+V - Paste
                copyPasteOperations.pasteFromClipboard()
                return
            }
        }

        // --- Normalize * and / to × and ÷ before any logic ---
        let keyToInsert = e.key
        if (keyToInsert === '*' || keyToInsert === '×') keyToInsert = '×'
        if (keyToInsert === '/' || keyToInsert === '÷') keyToInsert = '÷'

        // Only allow direct input for valid calculator characters (after normalization)
        if (/^[0-9+\-×÷()\.\^%]$/.test(keyToInsert)) {
            e.preventDefault()
            if (isEditing) {
                insertAtCursor(keyToInsert)
            } else {
                if (/^[0-9\.]$/.test(keyToInsert)) {
                    if (keyToInsert === '.') {
                        inputDecimal()
                    } else {
                        inputNumber(parseInt(keyToInsert))
                    }
                } else if (/^[+\-×÷\^%]$/.test(keyToInsert)) {
                    performOperation(keyToInsert)
                }
            }
            return
        }

        if (!isEditing) return

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault()
                setCursorPosition(Math.max(0, cursorPosition - 1))
                break
            case 'ArrowRight':
                e.preventDefault()
                setCursorPosition(Math.min(expression.length, cursorPosition + 1))
                break
            case 'Backspace':
                e.preventDefault()
                deleteAtCursor()
                break
            case 'Delete':
                e.preventDefault()
                if (cursorPosition < expression.length) {
                    const newExpression = expression.slice(0, cursorPosition) + expression.slice(cursorPosition + 1)
                    setExpression(newExpression)
                    setCurrentExpression(newExpression)
                }
                break
            case 'Home':
                e.preventDefault()
                setCursorPosition(0)
                break
            case 'End':
                e.preventDefault()
                setCursorPosition(expression.length)
                break
            case 'Enter':
            case 'Escape':
                e.preventDefault()
                setIsEditing(false)
                break
        }
    }, [isEditing, cursorPosition, expression, insertAtCursor, deleteAtCursor, inputDecimal, inputNumber, performOperation, setCursorPosition, setExpression, setCurrentExpression, setIsEditing, copyPasteOperations])

    const handleKeypadNavigation = useCallback((e) => {
        if (isEditing) return

        const buttons = getButtonData(isScientific)

        // Handle additional keyboard shortcuts
        if (e.key === '=' || (e.key === 'Enter' && !isKeypadNavigationActive)) {
            e.preventDefault()
            performOperation('=')
            return
        } else if (e.key === 'c' || e.key === 'C') {
            e.preventDefault()
            operations.clear()
            return
        } else if (e.key === 'Backspace') {
            e.preventDefault()
            operations.deleteLastCharacter()
            return
        }

        if (e.key === 'Tab') {
            e.preventDefault()
            setIsKeypadNavigationActive(true)

            if (!showAccessibilityHelp) {
                setShowAccessibilityHelp(true)
                setTimeout(() => setShowAccessibilityHelp(false), 5000)
            }

            if (e.shiftKey) {
                const newIndex = focusedButtonIndex <= 0 ? buttons.length - 1 : focusedButtonIndex - 1
                setFocusedButtonIndex(newIndex)
            } else {
                const newIndex = focusedButtonIndex >= buttons.length - 1 ? 0 : focusedButtonIndex + 1
                setFocusedButtonIndex(newIndex)
            }
        } else if (isKeypadNavigationActive && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault()

            const currentButton = buttons[focusedButtonIndex]
            if (!currentButton) return

            const currentRow = currentButton.row
            const buttonsInCurrentRow = buttons.filter(btn => btn.row === currentRow)
            const currentIndexInRow = buttonsInCurrentRow.findIndex(btn => btn === currentButton)

            let newIndex = focusedButtonIndex

            if (e.key === 'ArrowLeft') {
                if (currentIndexInRow > 0) {
                    const targetButton = buttonsInCurrentRow[currentIndexInRow - 1]
                    newIndex = buttons.findIndex(btn => btn === targetButton)
                }
            } else if (e.key === 'ArrowRight') {
                if (currentIndexInRow < buttonsInCurrentRow.length - 1) {
                    const targetButton = buttonsInCurrentRow[currentIndexInRow + 1]
                    newIndex = buttons.findIndex(btn => btn === targetButton)
                }
            } else if (e.key === 'ArrowUp') {
                const previousRow = currentRow - 1
                if (previousRow >= 0) {
                    const buttonsInPreviousRow = buttons.filter(btn => btn.row === previousRow)
                    const targetIndex = Math.min(currentIndexInRow, buttonsInPreviousRow.length - 1)
                    const targetButton = buttonsInPreviousRow[targetIndex]
                    newIndex = buttons.findIndex(btn => btn === targetButton)
                }
            } else if (e.key === 'ArrowDown') {
                const nextRow = currentRow + 1
                const maxRow = Math.max(...buttons.map(btn => btn.row))
                if (nextRow <= maxRow) {
                    const buttonsInNextRow = buttons.filter(btn => btn.row === nextRow)
                    const targetIndex = Math.min(currentIndexInRow, buttonsInNextRow.length - 1)
                    const targetButton = buttonsInNextRow[targetIndex]
                    newIndex = buttons.findIndex(btn => btn === targetButton)
                }
            }

            setFocusedButtonIndex(newIndex)
        } else if (isKeypadNavigationActive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()

            const currentButton = buttons[focusedButtonIndex]
            if (currentButton && currentButton.action) {
                currentButton.action()
            }
        } else if (e.key === 'Escape') {
            e.preventDefault()
            setIsKeypadNavigationActive(false)
            setFocusedButtonIndex(-1)
        }
    }, [isEditing, focusedButtonIndex, isKeypadNavigationActive, isScientific, showAccessibilityHelp, performOperation, operations, setIsKeypadNavigationActive, setShowAccessibilityHelp, setFocusedButtonIndex])

    // Set up keyboard event listeners
    useEffect(() => {
        const handleKeyboardEvent = (e) => {
            handleKeyDown(e)
            handleKeypadNavigation(e)
        }

        document.addEventListener('keydown', handleKeyboardEvent)
        return () => document.removeEventListener('keydown', handleKeyboardEvent)
    }, [handleKeyDown, handleKeypadNavigation])

    // Reset focus when mode changes
    useEffect(() => {
        setFocusedButtonIndex(-1)
        setIsKeypadNavigationActive(false)
    }, [isScientific, setFocusedButtonIndex, setIsKeypadNavigationActive])

    return {
        handleKeyDown,
        handleKeypadNavigation
    }
}

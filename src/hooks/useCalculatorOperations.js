import { useCallback, useEffect, useRef } from 'react'
import { evaluateExpression, extractNumbersFromExpression, factorial, formatResult } from '../utils/mathUtils'

/**
 * Custom hook for calculator operations
 */
export const useCalculatorOperations = (state, expressionState) => {
    const {
        display, setDisplay,
        previousValue, setPreviousValue,
        operation, setOperation,
        waitingForOperand, setWaitingForOperand,
        memory, setMemory,
        expression, setExpression,
        currentExpression, setCurrentExpression,
        justCalculated, setJustCalculated,
        angleMode
    } = state

    const {
        cursorPosition, setCursorPosition,
        isEditing, setIsEditing
    } = expressionState

    // Track the pending "clear expression" timer so it can be cancelled on
    // unmount or before scheduling a new one (avoids clobbering a fresh entry).
    const clearExpressionTimer = useRef(null)

    const scheduleExpressionClear = useCallback(() => {
        if (clearExpressionTimer.current) {
            clearTimeout(clearExpressionTimer.current)
        }
        clearExpressionTimer.current = setTimeout(() => {
            setExpression('')
            clearExpressionTimer.current = null
        }, 3000)
    }, [setExpression])

    useEffect(() => () => {
        if (clearExpressionTimer.current) {
            clearTimeout(clearExpressionTimer.current)
        }
    }, [])

    const clear = useCallback(() => {
        if (clearExpressionTimer.current) {
            clearTimeout(clearExpressionTimer.current)
            clearExpressionTimer.current = null
        }
        setDisplay('0')
        setPreviousValue(null)
        setOperation(null)
        setWaitingForOperand(false)
        setExpression('')
        setCurrentExpression('')
        setJustCalculated(false)
        setCursorPosition(0)
        setIsEditing(false)
    }, [setDisplay, setPreviousValue, setOperation, setWaitingForOperand, setExpression, setCurrentExpression, setJustCalculated, setCursorPosition, setIsEditing])

    const insertAtCursor = useCallback((text) => {
        if (isEditing) {
            const newExpression = expression.slice(0, cursorPosition) + text + expression.slice(cursorPosition)
            setExpression(newExpression)
            setCurrentExpression(newExpression)
            setCursorPosition(cursorPosition + text.length)
        } else {
            setCurrentExpression(text)
            setDisplay(text)
        }
    }, [isEditing, expression, cursorPosition, setExpression, setCurrentExpression, setCursorPosition, setDisplay])

    const deleteAtCursor = useCallback(() => {
        if (isEditing && cursorPosition > 0) {
            const newExpression = expression.slice(0, cursorPosition - 1) + expression.slice(cursorPosition)
            setExpression(newExpression)
            setCurrentExpression(newExpression)
            setCursorPosition(cursorPosition - 1)
        }
    }, [isEditing, cursorPosition, expression, setExpression, setCurrentExpression, setCursorPosition])

    const inputNumber = useCallback((num) => {
        if (isEditing) {
            insertAtCursor(String(num))
            return
        }

        if (waitingForOperand) {
            const needsSpaceBefore = currentExpression !== '' &&
                !currentExpression.endsWith(' ') &&
                !currentExpression.endsWith('(') &&
                !/[+\-×÷^%]$/.test(currentExpression)

            const newCurrentExpression = needsSpaceBefore
                ? `${currentExpression} ${num}`
                : `${currentExpression}${num}`

            setCurrentExpression(newCurrentExpression)
            setDisplay(String(num))
            setWaitingForOperand(false)
            setJustCalculated(false)
        } else if (justCalculated) {
            setDisplay(String(num))
            setCurrentExpression(String(num))
            setExpression('')
            setPreviousValue(null)
            setOperation(null)
            setJustCalculated(false)
        } else {
            const newDisplay = display === '0' ? String(num) : display + num
            setDisplay(newDisplay)

            const lastSpaceIndex = currentExpression.lastIndexOf(' ')
            const lastParenIndex = currentExpression.lastIndexOf('(')
            const lastOperatorMatch = currentExpression.match(/[+\-×÷^%](?=[^+\-×÷^%]*$)/)
            const lastOperatorIndex = lastOperatorMatch ? currentExpression.lastIndexOf(lastOperatorMatch[0]) : -1

            const numberStartIndex = Math.max(lastSpaceIndex, lastParenIndex, lastOperatorIndex)

            if (numberStartIndex === -1) {
                setCurrentExpression(newDisplay)
            } else if (numberStartIndex === lastParenIndex) {
                setCurrentExpression(currentExpression.substring(0, numberStartIndex + 1) + newDisplay)
            } else {
                setCurrentExpression(currentExpression.substring(0, numberStartIndex + 1) + newDisplay)
            }
        }
    }, [isEditing, waitingForOperand, justCalculated, display, currentExpression, expression, insertAtCursor, setCurrentExpression, setDisplay, setWaitingForOperand, setJustCalculated, setExpression, setPreviousValue, setOperation])

    const inputDecimal = useCallback(() => {
        if (isEditing) {
            insertAtCursor('.')
            return
        }

        if (waitingForOperand) {
            const needsSpaceBefore = currentExpression !== '' &&
                !currentExpression.endsWith(' ') &&
                !currentExpression.endsWith('(') &&
                !/[+\-×÷^%]$/.test(currentExpression)

            setDisplay('0.')
            const newCurrentExpression = needsSpaceBefore
                ? `${currentExpression} 0.`
                : `${currentExpression}0.`
            setCurrentExpression(newCurrentExpression)
            setWaitingForOperand(false)
        } else if (display.indexOf('.') === -1) {
            const newDisplay = display + '.'
            setDisplay(newDisplay)

            const lastSpaceIndex = currentExpression.lastIndexOf(' ')
            const lastParenIndex = currentExpression.lastIndexOf('(')
            const lastOperatorMatch = currentExpression.match(/[+\-×÷^%](?=[^+\-×÷^%]*$)/)
            const lastOperatorIndex = lastOperatorMatch ? currentExpression.lastIndexOf(lastOperatorMatch[0]) : -1

            const numberStartIndex = Math.max(lastSpaceIndex, lastParenIndex, lastOperatorIndex)

            if (numberStartIndex === -1) {
                setCurrentExpression(newDisplay)
            } else if (numberStartIndex === lastParenIndex) {
                setCurrentExpression(currentExpression.substring(0, numberStartIndex + 1) + newDisplay)
            } else {
                setCurrentExpression(currentExpression.substring(0, numberStartIndex + 1) + newDisplay)
            }
        }
    }, [isEditing, waitingForOperand, display, currentExpression, insertAtCursor, setDisplay, setCurrentExpression, setWaitingForOperand])

    const deleteLastCharacter = useCallback(() => {
        if (isEditing) {
            deleteAtCursor()
            return
        }

        if (currentExpression.length > 0) {
            const newExpression = currentExpression.slice(0, -1)
            setCurrentExpression(newExpression)

            if (newExpression === '') {
                setDisplay('0')
            } else {
                const lastSpaceIndex = newExpression.lastIndexOf(' ')
                const lastParenIndex = newExpression.lastIndexOf('(')
                const lastOperatorMatch = newExpression.match(/[+\-×÷^%](?=[^+\-×÷^%]*$)/)
                const lastOperatorIndex = lastOperatorMatch ? newExpression.lastIndexOf(lastOperatorMatch[0]) : -1

                const numberStartIndex = Math.max(lastSpaceIndex, lastParenIndex, lastOperatorIndex)

                if (numberStartIndex === -1) {
                    setDisplay(newExpression || '0')
                } else {
                    const lastNumber = newExpression.substring(numberStartIndex + 1)
                    setDisplay(lastNumber || '0')
                }
            }
        } else if (display !== '0') {
            if (display.length > 1) {
                setDisplay(display.slice(0, -1))
            } else {
                setDisplay('0')
            }
        }
    }, [isEditing, currentExpression, display, deleteAtCursor, setCurrentExpression, setDisplay])

    const inputParentheses = useCallback((paren) => {
        if (isEditing) {
            insertAtCursor(paren)
            return
        }

        if (paren === '(') {
            const needsSpaceBefore = currentExpression !== '' &&
                !currentExpression.endsWith(' ') &&
                !currentExpression.endsWith('(') &&
                !/[+\-×÷^%]\s*$/.test(currentExpression)

            const newExpression = needsSpaceBefore
                ? `${currentExpression} ${paren}`
                : `${currentExpression}${paren}`
            setCurrentExpression(newExpression)
            setWaitingForOperand(true)
        } else {
            setCurrentExpression(`${currentExpression}${paren}`)
        }
    }, [isEditing, currentExpression, insertAtCursor, setCurrentExpression, setWaitingForOperand])

    const performOperation = useCallback((nextOperation) => {
        const inputValue = parseFloat(display)

        if (nextOperation === '=') {
            if (currentExpression && currentExpression.trim() !== '') {
                try {
                    const rawResult = evaluateExpression(currentExpression)
                    const result = formatResult(rawResult)
                    setDisplay(result)
                    setExpression(`${currentExpression} = ${result}`)
                    setCurrentExpression('')
                    setJustCalculated(true)
                    setIsEditing(false)
                    setCursorPosition(0)

                    setPreviousValue(rawResult)
                    setOperation(null)
                    setWaitingForOperand(false)
                } catch {
                    setDisplay('Error')
                    setExpression('Error')
                    setCurrentExpression('')
                    setIsEditing(false)
                    setCursorPosition(0)
                }
            }
        } else {
            if (isEditing) {
                insertAtCursor(` ${nextOperation} `)
                setWaitingForOperand(true)
                setOperation(nextOperation)
                return
            }

            if (justCalculated) {
                setPreviousValue(parseFloat(display))
                const newCurrentExpression = `${display} ${nextOperation} `
                setCurrentExpression(newCurrentExpression)
                setExpression('')
                setJustCalculated(false)
            } else if (previousValue === null) {
                setPreviousValue(inputValue)
                const operatorWithSpaces = ` ${nextOperation} `
                setCurrentExpression(`${currentExpression}${operatorWithSpaces}`)
            } else if (operation && waitingForOperand) {
                if (operation === '^' && nextOperation === '-') {
                    const newExpression = `${currentExpression} ${nextOperation}`
                    setCurrentExpression(newExpression)
                    setWaitingForOperand(false)
                } else {
                    const trimmedExpression = currentExpression.replace(/\s+[+\-×÷^%]\s*$/, '')
                    const newExpression = `${trimmedExpression} ${nextOperation} `
                    setCurrentExpression(newExpression)
                }
            } else if (operation) {
                const operatorWithSpaces = ` ${nextOperation} `
                setCurrentExpression(`${currentExpression}${operatorWithSpaces}`)
                setPreviousValue(inputValue)
            }

            setWaitingForOperand(true)
            setOperation(nextOperation)
        }
    }, [display, currentExpression, isEditing, justCalculated, previousValue, operation, waitingForOperand,
        setDisplay, setExpression, setCurrentExpression, setJustCalculated, setIsEditing, setCursorPosition,
        setPreviousValue, setOperation, setWaitingForOperand, insertAtCursor])

    const performScientificOperation = useCallback((op) => {
        const value = parseFloat(display)
        let result

        if (isNaN(value)) {
            setDisplay('Error')
            setExpression('Invalid input')
            return
        }

        // In degree mode the input is converted to radians before the trig call.
        const unit = angleMode === 'DEG' ? '°' : ' rad'
        const toRadians = (deg) => (angleMode === 'DEG' ? (deg * Math.PI) / 180 : deg)

        switch (op) {
            case 'sin':
                result = Math.sin(toRadians(value))
                setExpression(`sin(${value}${unit}) = ${formatResult(result)}`)
                break
            case 'cos':
                result = Math.cos(toRadians(value))
                setExpression(`cos(${value}${unit}) = ${formatResult(result)}`)
                break
            case 'tan':
                result = Math.tan(toRadians(value))
                setExpression(`tan(${value}${unit}) = ${formatResult(result)}`)
                break
            case 'log':
                if (value <= 0) {
                    setDisplay('Error')
                    setExpression('log: domain error (x ≤ 0)')
                    return
                }
                result = Math.log10(value)
                setExpression(`log(${value}) = ${result}`)
                break
            case 'ln':
                if (value <= 0) {
                    setDisplay('Error')
                    setExpression('ln: domain error (x ≤ 0)')
                    return
                }
                result = Math.log(value)
                setExpression(`ln(${value}) = ${result}`)
                break
            case 'sqrt':
                if (value < 0) {
                    setDisplay('Error')
                    setExpression('√: domain error (x < 0)')
                    return
                }
                result = Math.sqrt(value)
                setExpression(`√(${value}) = ${result}`)
                break
            case 'x²':
                result = value * value
                setExpression(`${value}² = ${result}`)
                break
            case 'x³':
                result = value * value * value
                setExpression(`${value}³ = ${result}`)
                break
            case '1/x':
                if (value === 0) {
                    setDisplay('Error')
                    setExpression('1/x: division by zero')
                    return
                }
                result = 1 / value
                setExpression(`1/${value} = ${result}`)
                break
            case 'π':
                result = Math.PI
                setExpression(`π = ${result}`)
                break
            case 'e':
                result = Math.E
                setExpression(`e = ${result}`)
                break
            case '10^x':
                result = Math.pow(10, value)
                setExpression(`10^${value} = ${result}`)
                break
            case 'x!':
                if (value < 0 || !Number.isInteger(value)) {
                    setDisplay('Error')
                    setExpression('x!: requires non-negative integer')
                    return
                }
                result = factorial(value)
                setExpression(`${value}! = ${result}`)
                break
            case '+/-':
                result = -value
                setExpression(`-(${value}) = ${result}`)
                break
            case 'φ':
                result = (1 + Math.sqrt(5)) / 2
                setExpression(`φ = ${result}`)
                break
            case 'avg':
                if (currentExpression && currentExpression.trim() !== '') {
                    const numbers = extractNumbersFromExpression(currentExpression)
                    if (numbers.length > 0) {
                        result = numbers.reduce((sum, num) => sum + num, 0) / numbers.length
                        setExpression(`avg(${numbers.join(', ')}) = ${result}`)
                    } else {
                        result = 0
                        setExpression(`avg() = 0`)
                    }
                } else {
                    result = parseFloat(display) || 0
                    setExpression(`avg(${result}) = ${result}`)
                }
                break
            default:
                return
        }

        setDisplay(formatResult(result))
        setCurrentExpression('')
        setWaitingForOperand(true)
        setJustCalculated(true)

        scheduleExpressionClear()
    }, [display, currentExpression, angleMode, scheduleExpressionClear, setDisplay, setExpression, setCurrentExpression, setWaitingForOperand, setJustCalculated])

    const memoryOperation = useCallback((op) => {
        const value = parseFloat(display)
        switch (op) {
            case 'MC':
                setMemory(0)
                break
            case 'MR':
                setDisplay(String(memory))
                setWaitingForOperand(true)
                break
            case 'M+':
                setMemory(memory + value)
                break
            case 'M-':
                setMemory(memory - value)
                break
            case 'MS':
                setMemory(value)
                break
        }
    }, [display, memory, setMemory, setDisplay, setWaitingForOperand])

    return {
        clear,
        inputNumber,
        inputDecimal,
        deleteLastCharacter,
        inputParentheses,
        performOperation,
        performScientificOperation,
        memoryOperation,
        insertAtCursor,
        deleteAtCursor,
        // Export setters for copy/paste functionality
        setDisplay,
        setExpression,
        setCurrentExpression,
        setJustCalculated,
        setIsEditing,
        setCursorPosition
    }
}

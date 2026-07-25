import { useCallback } from 'react'
import { evaluateExpression } from '../utils/mathUtils'

/**
 * Custom hook for copy and paste functionality
 */
export const useCopyPaste = (calculatorState, expressionState, operations) => {
  const { display, expression, currentExpression, justCalculated } = calculatorState
  const { setIsEditing, setCursorPosition } = expressionState
  const { clear, setCurrentExpression, setDisplay, setExpression, setJustCalculated } = operations

  // Copy current result or expression to clipboard
  const copyToClipboard = useCallback(async (type = 'result') => {
    try {
      let textToCopy = ''
      
      if (type === 'result') {
        // Copy the current display result
        textToCopy = display
      } else if (type === 'expression') {
        // Copy the current expression being built
        textToCopy = currentExpression || display
      } else if (type === 'equation') {
        // Copy the complete equation from expression area
        textToCopy = expression || `${currentExpression} = ${display}`
      }

      if (textToCopy) {
        await navigator.clipboard.writeText(textToCopy)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }, [display, currentExpression, expression])

  // Paste from clipboard and process
  const pasteFromClipboard = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      
      if (!clipboardText.trim()) {
        return false
      }

      // Clean up the pasted text - remove extra whitespace and normalize operators
      let cleanText = clipboardText.trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[×x]/g, '×') // Normalize multiplication
        .replace(/[÷/]/g, '÷') // Normalize division
        .replace(/\^/g, '^') // Keep power operator
        .replace(/=/g, '') // Remove equals sign if present

      // Check if it's a simple number
      const numberMatch = cleanText.match(/^-?\d+\.?\d*$/)
      if (numberMatch) {
        // It's just a number, set it as display
        clear()
        setDisplay(cleanText)
        setCurrentExpression(cleanText)
        return true
      }

      // Check if it looks like a mathematical expression
      const expressionMatch = cleanText.match(/^[0-9+\-×÷\(\)\.\^%\s]+$/)
      if (expressionMatch) {
        try {
          // Try to evaluate the expression to validate it
          const result = evaluateExpression(cleanText)
          
          // If evaluation succeeds, set it as current expression
          clear()
          setCurrentExpression(cleanText)
          setDisplay(cleanText)
          setIsEditing(false)
          setCursorPosition(0)
          
          return true
        } catch (error) {
          // If evaluation fails, still allow pasting for editing
          clear()
          setCurrentExpression(cleanText)
          setDisplay(cleanText)
          setIsEditing(false)
          setCursorPosition(0)
          return true
        }
      }

      return false
    } catch (error) {
      console.error('Failed to paste from clipboard:', error)
      return false
    }
  }, [clear, setDisplay, setCurrentExpression, setIsEditing, setCursorPosition])

  // Copy with visual feedback
  const copyWithFeedback = useCallback(async (type = 'result') => {
    const success = await copyToClipboard(type)
    
    if (success) {
      // Show temporary feedback (could be implemented with a toast notification)
      const originalExpression = expression
      setExpression(`Copied to clipboard!`)
      setTimeout(() => {
        setExpression(originalExpression)
      }, 1500)
    }
    
    return success
  }, [copyToClipboard, expression, setExpression])

  return {
    copyToClipboard,
    pasteFromClipboard,
    copyWithFeedback
  }
}

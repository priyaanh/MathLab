import React from 'react'
import CalculatorButton from './CalculatorButton'

/**
 * Copy and Paste operations component
 */
const CopyPasteOperations = React.memo(({
  onCopyResult,
  onCopyExpression,
  onCopyEquation,
  onPaste,
  focusedButtonIndex,
  isKeypadNavigationActive,
  startIndex = 0
}) => {
  return (
    <>
      <CalculatorButton
        className="copy-paste"
        onClick={() => onCopyResult()}
        title="Copy Result (Ctrl+C)"
        aria-label="Copy current result to clipboard"
        focused={focusedButtonIndex === startIndex}
        isKeypadNavigationActive={isKeypadNavigationActive}
      >
        📋 Result
      </CalculatorButton>
      
      <CalculatorButton
        className="copy-paste"
        onClick={() => onCopyExpression()}
        title="Copy Expression (Ctrl+Shift+C)"
        aria-label="Copy current expression to clipboard"
        focused={focusedButtonIndex === startIndex + 1}
        isKeypadNavigationActive={isKeypadNavigationActive}
      >
        📋 Expr
      </CalculatorButton>
      
      <CalculatorButton
        className="copy-paste"
        onClick={() => onCopyEquation()}
        title="Copy Equation (Ctrl+Alt+C)"
        aria-label="Copy complete equation to clipboard"
        focused={focusedButtonIndex === startIndex + 2}
        isKeypadNavigationActive={isKeypadNavigationActive}
      >
        📋 Eqn
      </CalculatorButton>
      
      <CalculatorButton
        className="copy-paste"
        onClick={onPaste}
        title="Paste (Ctrl+V)"
        aria-label="Paste from clipboard"
        focused={focusedButtonIndex === startIndex + 3}
        isKeypadNavigationActive={isKeypadNavigationActive}
      >
        📥 Paste
      </CalculatorButton>
    </>
  )
})

export default CopyPasteOperations

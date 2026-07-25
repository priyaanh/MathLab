import { useState, useCallback, useEffect, useMemo } from 'react'
import '../App.css'
import './calculator.css'

// Components
import Display from '../components/Display'
import AccessibilityBanners from '../components/AccessibilityBanners'
import MemoryOperations from '../components/MemoryOperations'
import CopyPasteOperations from '../components/CopyPasteOperations'
import ScientificFunctions from '../components/ScientificFunctions'
import Operators from '../components/Operators'
import NumberPad from '../components/NumberPad'
import CalculatorButton from '../components/CalculatorButton'
import GraphingMode from '../components/GraphingMode'

// Hooks
import {
  useCalculatorState,
  useExpressionEditing,
  useKeyboardNavigation,
  CALCULATOR_MODES
} from '../hooks/useCalculatorState'
import { useCalculatorOperations } from '../hooks/useCalculatorOperations'
import { useKeyboardHandling } from '../hooks/useKeyboardHandling'
import { usePerformanceOptimizations } from '../hooks/usePerformanceOptimizations'
import { useCopyPaste } from '../hooks/useCopyPaste'
import { useGraphing } from '../hooks/useGraphing'

// Utils
import { formatExpressionDisplay } from '../utils/mathUtils'

// Uniform scale factors for the whole calculator (width, heights, fonts and
// spacing all scale together). Bounded so it never gets unreadably small or
// sprawls across the page.
const SIZES = {
  small: { label: 'Small', k: 0.8 },
  medium: { label: 'Medium', k: 1 },
  large: { label: 'Large', k: 1.2 }
}

/**
 * Scientific Calculator page — modern, Apple-style skin themed by the site's
 * theme variables. No per-calculator theme/angle toggles: the calculator now
 * inherits the whole-site theme, and trig is evaluated in degrees.
 */
function ScientificPage() {
  const calculatorState = useCalculatorState()
  const expressionState = useExpressionEditing()
  const navigationState = useKeyboardNavigation()

  const {
    display,
    expression,
    currentExpression,
    justCalculated,
    calculatorMode,
    setCalculatorMode
  } = calculatorState

  const isScientific = calculatorMode === CALCULATOR_MODES.SCIENTIFIC

  const [size, setSize] = useState('medium')

  const graphingState = useGraphing()
  const [showGraph, setShowGraph] = useState(false)
  const toggleGraph = useCallback(() => setShowGraph(prev => !prev), [])

  const {
    cursorPosition,
    setCursorPosition,
    isEditing,
    setIsEditing
  } = expressionState

  const {
    focusedButtonIndex,
    isKeypadNavigationActive,
    showAccessibilityHelp
  } = navigationState

  const displayData = useMemo(() => ({
    expression,
    currentExpression,
    display,
    justCalculated,
    isEditing,
    cursorPosition
  }), [expression, currentExpression, display, justCalculated, isEditing, cursorPosition])

  const navigationData = useMemo(() => ({
    focusedButtonIndex,
    isKeypadNavigationActive,
    showAccessibilityHelp
  }), [focusedButtonIndex, isKeypadNavigationActive, showAccessibilityHelp])

  const buttonFocusProps = useMemo(() => ({
    focusedButtonIndex,
    isKeypadNavigationActive
  }), [focusedButtonIndex, isKeypadNavigationActive])

  const operations = useCalculatorOperations(calculatorState, expressionState)
  const copyPasteOperations = useCopyPaste(calculatorState, expressionState, operations)
  const { equalsButtonProps } = usePerformanceOptimizations(isScientific, focusedButtonIndex, operations)

  useKeyboardHandling(calculatorState, expressionState, navigationState, operations, copyPasteOperations)

  const handleExpressionClick = useCallback((e) => {
    setIsEditing(true)

    if (!expression) {
      setCursorPosition(0)
      return
    }

    const rect = e.target.getBoundingClientRect()
    const clickX = e.clientX - rect.left

    try {
      const tempSpan = document.createElement('span')
      tempSpan.style.visibility = 'hidden'
      tempSpan.style.position = 'absolute'
      tempSpan.style.whiteSpace = 'nowrap'
      tempSpan.style.font = window.getComputedStyle(e.target).font
      tempSpan.style.fontSize = window.getComputedStyle(e.target).fontSize
      tempSpan.style.fontFamily = window.getComputedStyle(e.target).fontFamily
      document.body.appendChild(tempSpan)

      let bestPosition = 0
      let minDistance = Math.abs(clickX)

      try {
        for (let i = 0; i <= expression.length; i++) {
          const textUpToPosition = expression.substring(0, i)
          tempSpan.textContent = textUpToPosition
          const textWidth = tempSpan.getBoundingClientRect().width
          const distance = Math.abs(clickX - textWidth)

          if (distance < minDistance) {
            minDistance = distance
            bestPosition = i
          }
        }
      } finally {
        document.body.removeChild(tempSpan)
      }

      setCursorPosition(bestPosition)
    } catch {
      const ratio = Math.max(0, Math.min(1, clickX / rect.width))
      const position = Math.round(ratio * expression.length)
      setCursorPosition(Math.max(0, Math.min(position, expression.length)))
    }
  }, [expression, setIsEditing, setCursorPosition])

  useEffect(() => {
    if (isEditing) {
      const expressionElement = document.querySelector('.expression')
      if (expressionElement) {
        expressionElement.scrollLeft = expressionElement.scrollWidth
      }
    }
  }, [cursorPosition, isEditing, expression])

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          <h1>Scientific Calculator</h1>
          <p>Full expression display, cursor editing, memory and complete keyboard accessibility. Trigonometry uses degrees.</p>
        </div>
        <div className="size-control">
          <span className="grapher-toolbar-label">Size</span>
          <div className="seg-control" style={{ marginBottom: 0 }}>
            {Object.entries(SIZES).map(([key, cfg]) => (
              <button
                key={key}
                className={size === key ? 'active' : ''}
                onClick={() => setSize(key)}
                aria-pressed={size === key}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="calc-page-wrap">
        <div
          className={`calc${isScientific ? ' sci' : ''}${showGraph && isScientific ? ' graph-visible' : ''}`}
          style={{ '--k': SIZES[size].k }}
          role="application"
          aria-label="Scientific Calculator"
        >
          <div className="calc-topbar">
            <div className="seg-control" style={{ marginBottom: 0 }}>
              <button
                className={!isScientific ? 'active' : ''}
                onClick={() => setCalculatorMode(CALCULATOR_MODES.NORMAL)}
                aria-pressed={!isScientific}
              >
                Normal
              </button>
              <button
                className={isScientific ? 'active' : ''}
                onClick={() => setCalculatorMode(CALCULATOR_MODES.SCIENTIFIC)}
                aria-pressed={isScientific}
              >
                Scientific
              </button>
            </div>
          </div>

          <Display
            {...displayData}
            onExpressionClick={handleExpressionClick}
            formatExpressionDisplay={formatExpressionDisplay}
          />

          <AccessibilityBanners {...navigationData} />

          {calculatorMode === CALCULATOR_MODES.NORMAL ? (
            <div className="calculator-keypad normal-mode" role="grid" aria-label="Calculator buttons">
              <CalculatorButton className="clear" onClick={operations.clear} title="Clear All" aria-label="Clear All" focused={focusedButtonIndex === 0} isKeypadNavigationActive={isKeypadNavigationActive}>C</CalculatorButton>
              <CalculatorButton className="scientific" onClick={() => operations.performScientificOperation('+/-')} title="Change Sign (+/-)" aria-label="Change Sign" focused={focusedButtonIndex === 1} isKeypadNavigationActive={isKeypadNavigationActive}>+/-</CalculatorButton>
              <CalculatorButton className="scientific" onClick={() => operations.performOperation('%')} title="Percent" aria-label="Percent" focused={focusedButtonIndex === 2} isKeypadNavigationActive={isKeypadNavigationActive}>%</CalculatorButton>
              <CalculatorButton className="operator" onClick={() => operations.performOperation('÷')} title="Division" aria-label="Division" focused={focusedButtonIndex === 3} isKeypadNavigationActive={isKeypadNavigationActive}>÷</CalculatorButton>

              {[7, 8, 9].map((num, index) => (
                <CalculatorButton key={num} className="number" onClick={() => operations.inputNumber(num)} title={`Number ${num}`} aria-label={`Number ${num}`} focused={focusedButtonIndex === 4 + index} isKeypadNavigationActive={isKeypadNavigationActive}>{num}</CalculatorButton>
              ))}
              <CalculatorButton className="operator" onClick={() => operations.performOperation('×')} title="Multiplication" aria-label="Multiplication" focused={focusedButtonIndex === 7} isKeypadNavigationActive={isKeypadNavigationActive}>×</CalculatorButton>

              {[4, 5, 6].map((num, index) => (
                <CalculatorButton key={num} className="number" onClick={() => operations.inputNumber(num)} title={`Number ${num}`} aria-label={`Number ${num}`} focused={focusedButtonIndex === 8 + index} isKeypadNavigationActive={isKeypadNavigationActive}>{num}</CalculatorButton>
              ))}
              <CalculatorButton className="operator" onClick={() => operations.performOperation('-')} title="Subtraction" aria-label="Subtraction" focused={focusedButtonIndex === 11} isKeypadNavigationActive={isKeypadNavigationActive}>-</CalculatorButton>

              {[1, 2, 3].map((num, index) => (
                <CalculatorButton key={num} className="number" onClick={() => operations.inputNumber(num)} title={`Number ${num}`} aria-label={`Number ${num}`} focused={focusedButtonIndex === 12 + index} isKeypadNavigationActive={isKeypadNavigationActive}>{num}</CalculatorButton>
              ))}
              <CalculatorButton className="operator" onClick={() => operations.performOperation('+')} title="Addition" aria-label="Addition" focused={focusedButtonIndex === 15} isKeypadNavigationActive={isKeypadNavigationActive}>+</CalculatorButton>

              <CalculatorButton className="number zero-wide" onClick={() => operations.inputNumber(0)} title="Number 0" aria-label="Number 0" focused={focusedButtonIndex === 16} isKeypadNavigationActive={isKeypadNavigationActive}>0</CalculatorButton>
              <CalculatorButton className="number" onClick={operations.inputDecimal} title="Decimal Point" aria-label="Decimal Point" focused={focusedButtonIndex === 17} isKeypadNavigationActive={isKeypadNavigationActive}>.</CalculatorButton>
              <CalculatorButton className="equals" onClick={() => operations.performOperation('=')} title="Equals" aria-label="Calculate Result" focused={focusedButtonIndex === 18} isKeypadNavigationActive={isKeypadNavigationActive}>=</CalculatorButton>
            </div>
          ) : (
            <>
              <div className="graph-toggle-container">
                <button className={`key graph-toggle${showGraph ? ' active' : ''}`} onClick={toggleGraph} title={showGraph ? 'Hide Graph' : 'Show Graph'} aria-label={showGraph ? 'Hide Graph' : 'Show Graph'}>
                  {showGraph ? 'Hide Graph' : 'Show Graph'}
                </button>
              </div>

              {showGraph && (
                <div className="embedded-graph-panel">
                  <GraphingMode {...graphingState} compact />
                </div>
              )}

              <div className="calculator-keypad scientific-mode" role="grid" aria-label="Calculator buttons">
                <MemoryOperations onMemoryOperation={operations.memoryOperation} onClear={operations.clear} {...buttonFocusProps} />
                <CopyPasteOperations
                  onCopyResult={() => copyPasteOperations.copyWithFeedback('result')}
                  onCopyExpression={() => copyPasteOperations.copyWithFeedback('expression')}
                  onCopyEquation={() => copyPasteOperations.copyWithFeedback('equation')}
                  onPaste={copyPasteOperations.pasteFromClipboard}
                  startIndex={8}
                  {...buttonFocusProps}
                />
                <ScientificFunctions onScientificOperation={operations.performScientificOperation} onOperation={operations.performOperation} onInputParentheses={operations.inputParentheses} isScientific={true} {...buttonFocusProps} />
                <Operators onOperation={operations.performOperation} onScientificOperation={operations.performScientificOperation} isScientific={true} {...buttonFocusProps} />
                <NumberPad onInputNumber={operations.inputNumber} onInputDecimal={operations.inputDecimal} onDeleteLastCharacter={operations.deleteLastCharacter} isScientific={true} {...buttonFocusProps} />
                <CalculatorButton {...equalsButtonProps} isKeypadNavigationActive={isKeypadNavigationActive}>=</CalculatorButton>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ScientificPage

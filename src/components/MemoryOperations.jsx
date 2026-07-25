import React from 'react'
import CalculatorButton from './CalculatorButton'

/**
 * Memory operations row component
 */
const MemoryOperations = React.memo(({
    onMemoryOperation,
    onClear,
    focusedButtonIndex,
    isKeypadNavigationActive
}) => {
    return (
        <>
            <CalculatorButton
                className="memory"
                onClick={() => onMemoryOperation('MC')}
                title="Memory Clear"
                aria-label="Memory Clear"
                focused={focusedButtonIndex === 2}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                MC
            </CalculatorButton>
            <CalculatorButton
                className="memory"
                onClick={() => onMemoryOperation('MR')}
                title="Memory Recall"
                aria-label="Memory Recall"
                focused={focusedButtonIndex === 3}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                MR
            </CalculatorButton>
            <CalculatorButton
                className="memory"
                onClick={() => onMemoryOperation('M+')}
                title="Memory Add"
                aria-label="Memory Add"
                focused={focusedButtonIndex === 4}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                M+
            </CalculatorButton>
            <CalculatorButton
                className="memory"
                onClick={() => onMemoryOperation('M-')}
                title="Memory Subtract"
                aria-label="Memory Subtract"
                focused={focusedButtonIndex === 5}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                M-
            </CalculatorButton>
            <CalculatorButton
                className="memory"
                onClick={() => onMemoryOperation('MS')}
                title="Memory Store"
                aria-label="Memory Store"
                focused={focusedButtonIndex === 6}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                MS
            </CalculatorButton>
            <CalculatorButton
                className="clear"
                onClick={onClear}
                title="Clear All"
                aria-label="Clear All"
                focused={focusedButtonIndex === 7}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                C
            </CalculatorButton>
        </>
    )
})

export default MemoryOperations

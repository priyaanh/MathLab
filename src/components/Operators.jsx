import React from 'react'
import CalculatorButton from './CalculatorButton'

/**
 * Operators row component
 */
const Operators = React.memo(({
    onOperation,
    onScientificOperation,
    isScientific,
    focusedButtonIndex,
    isKeypadNavigationActive
}) => {
    const getButtonIndex = (baseIndex) => {
        return isScientific ? baseIndex + 30 : baseIndex + 18
    }

    return (
        <>
            <CalculatorButton
                className="operator"
                onClick={() => onOperation('^')}
                title="Power (x^y)"
                aria-label="Power"
                focused={focusedButtonIndex === getButtonIndex(0)}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                x<sup>y</sup>
            </CalculatorButton>

            <CalculatorButton
                className="operator"
                onClick={() => onOperation('÷')}
                title="Division"
                aria-label="Division"
                focused={focusedButtonIndex === getButtonIndex(1)}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                ÷
            </CalculatorButton>

            <CalculatorButton
                className="operator"
                onClick={() => onOperation('×')}
                title="Multiplication"
                aria-label="Multiplication"
                focused={focusedButtonIndex === getButtonIndex(2)}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                ×
            </CalculatorButton>

            <CalculatorButton
                className="operator"
                onClick={() => onOperation('-')}
                title="Subtraction"
                aria-label="Subtraction"
                focused={focusedButtonIndex === getButtonIndex(3)}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                -
            </CalculatorButton>

            <CalculatorButton
                className="operator"
                onClick={() => onOperation('+')}
                title="Addition"
                aria-label="Addition"
                focused={focusedButtonIndex === getButtonIndex(4)}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                +
            </CalculatorButton>

            <CalculatorButton
                className="operator"
                onClick={() => onScientificOperation('avg')}
                title="Average/Mean of Numbers"
                aria-label="Average"
                focused={focusedButtonIndex === getButtonIndex(5)}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                avg
            </CalculatorButton>
        </>
    )
})

export default Operators

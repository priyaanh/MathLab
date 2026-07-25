import React from 'react'
import CalculatorButton from './CalculatorButton'

/**
 * Number pad component with numbers, decimal, and delete
 */
const NumberPad = React.memo(({
    onInputNumber,
    onInputDecimal,
    onDeleteLastCharacter,
    isScientific,
    focusedButtonIndex,
    isKeypadNavigationActive
}) => {
    const getButtonIndex = (baseIndex) => {
        return isScientific ? baseIndex + 36 : baseIndex + 24
    }

    return (
        <>
            {/* Number Pad Row 1 */}
            {[1, 2, 3, 4, 5, 6].map((num, index) => (
                <CalculatorButton
                    key={num}
                    className="number"
                    onClick={() => onInputNumber(num)}
                    title={`Number ${num}`}
                    aria-label={`Number ${num}`}
                    focused={focusedButtonIndex === getButtonIndex(6 + index)}
                    isKeypadNavigationActive={isKeypadNavigationActive}
                >
                    {num}
                </CalculatorButton>
            ))}

            {/* Number Pad Row 2 */}
            {[7, 8, 9].map((num, index) => (
                <CalculatorButton
                    key={num}
                    className="number"
                    onClick={() => onInputNumber(num)}
                    title={`Number ${num}`}
                    aria-label={`Number ${num}`}
                    focused={focusedButtonIndex === getButtonIndex(12 + index)}
                    isKeypadNavigationActive={isKeypadNavigationActive}
                >
                    {num}
                </CalculatorButton>
            ))}

            <CalculatorButton
                className="number"
                onClick={() => onInputNumber(0)}
                title="Number 0"
                aria-label="Number 0"
                focused={focusedButtonIndex === getButtonIndex(15)}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                0
            </CalculatorButton>

            <CalculatorButton
                className="number"
                onClick={onInputDecimal}
                title="Decimal Point"
                aria-label="Decimal Point"
                focused={focusedButtonIndex === getButtonIndex(16)}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                .
            </CalculatorButton>

            <CalculatorButton
                className="number"
                onClick={onDeleteLastCharacter}
                title="Delete Last Character"
                aria-label="Delete"
                focused={focusedButtonIndex === getButtonIndex(17)}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                ⌫
            </CalculatorButton>
        </>
    )
})

export default NumberPad

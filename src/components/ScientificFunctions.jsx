import React from 'react'
import CalculatorButton from './CalculatorButton'

/**
 * Scientific functions component
 */
const ScientificFunctions = React.memo(({
    onScientificOperation,
    onOperation,
    onInputParentheses,
    isScientific,
    focusedButtonIndex,
    isKeypadNavigationActive
}) => {
    if (!isScientific) {
        // Basic functions for normal mode
        return (
            <>
                <CalculatorButton
                    className="scientific"
                    onClick={() => onScientificOperation('sqrt')}
                    title="Square Root"
                    aria-label="Square Root"
                    focused={focusedButtonIndex === 12}
                    isKeypadNavigationActive={isKeypadNavigationActive}
                >
                    √
                </CalculatorButton>
                <CalculatorButton
                    className="scientific"
                    onClick={() => onScientificOperation('x²')}
                    title="Square (x²)"
                    aria-label="Square"
                    focused={focusedButtonIndex === 13}
                    isKeypadNavigationActive={isKeypadNavigationActive}
                >
                    x²
                </CalculatorButton>
                <CalculatorButton
                    className="scientific"
                    onClick={() => onScientificOperation('1/x')}
                    title="Reciprocal (1/x)"
                    aria-label="Reciprocal"
                    focused={focusedButtonIndex === 14}
                    isKeypadNavigationActive={isKeypadNavigationActive}
                >
                    1/x
                </CalculatorButton>
                <CalculatorButton
                    className="scientific"
                    onClick={() => onScientificOperation('+/-')}
                    title="Change Sign (+/-)"
                    aria-label="Change Sign"
                    focused={focusedButtonIndex === 15}
                    isKeypadNavigationActive={isKeypadNavigationActive}
                >
                    +/-
                </CalculatorButton>
                <CalculatorButton
                    className="scientific"
                    onClick={() => onOperation('%')}
                    title="Modulo (Remainder)"
                    aria-label="Modulo"
                    focused={focusedButtonIndex === 16}
                    isKeypadNavigationActive={isKeypadNavigationActive}
                >
                    %
                </CalculatorButton>
                <CalculatorButton
                    className="scientific"
                    onClick={() => onScientificOperation('φ')}
                    title="Golden Ratio (φ)"
                    aria-label="Golden Ratio"
                    focused={focusedButtonIndex === 17}
                    isKeypadNavigationActive={isKeypadNavigationActive}
                >
                    φ
                </CalculatorButton>
            </>
        )
    }

    // Scientific mode functions
    return (
        <>
            {/* Scientific Functions Row 1 */}
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('sin')}
                title="Sine"
                aria-label="Sine"
                focused={focusedButtonIndex === 12}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                sin
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('cos')}
                title="Cosine"
                aria-label="Cosine"
                focused={focusedButtonIndex === 13}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                cos
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('tan')}
                title="Tangent"
                aria-label="Tangent"
                focused={focusedButtonIndex === 14}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                tan
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('log')}
                title="Logarithm Base 10"
                aria-label="Logarithm Base 10"
                focused={focusedButtonIndex === 15}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                log
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('ln')}
                title="Natural Logarithm"
                aria-label="Natural Logarithm"
                focused={focusedButtonIndex === 16}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                ln
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('sqrt')}
                title="Square Root"
                aria-label="Square Root"
                focused={focusedButtonIndex === 17}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                √
            </CalculatorButton>

            {/* Scientific Functions Row 2 */}
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('x²')}
                title="Square (x²)"
                aria-label="Square"
                focused={focusedButtonIndex === 18}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                x²
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('x³')}
                title="Cube (x³)"
                aria-label="Cube"
                focused={focusedButtonIndex === 19}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                x³
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('1/x')}
                title="Reciprocal (1/x)"
                aria-label="Reciprocal"
                focused={focusedButtonIndex === 20}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                1/x
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('x!')}
                title="Factorial (x!)"
                aria-label="Factorial"
                focused={focusedButtonIndex === 21}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                x!
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('π')}
                title="Pi (π)"
                aria-label="Pi"
                focused={focusedButtonIndex === 22}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                π
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('e')}
                title="Euler's Number (e)"
                aria-label="Euler's Number"
                focused={focusedButtonIndex === 23}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                e
            </CalculatorButton>

            {/* Scientific Functions Row 3 */}
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('10^x')}
                title="10 to the Power of x"
                aria-label="10 to the Power of x"
                focused={focusedButtonIndex === 24}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                10<sup>x</sup>
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('+/-')}
                title="Change Sign (+/-)"
                aria-label="Change Sign"
                focused={focusedButtonIndex === 25}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                +/-
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onInputParentheses('(')}
                title="Opening Parenthesis"
                aria-label="Opening Parenthesis"
                focused={focusedButtonIndex === 26}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                (
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onInputParentheses(')')}
                title="Closing Parenthesis"
                aria-label="Closing Parenthesis"
                focused={focusedButtonIndex === 27}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                )
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onOperation('%')}
                title="Modulo (Remainder)"
                aria-label="Modulo"
                focused={focusedButtonIndex === 28}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                %
            </CalculatorButton>
            <CalculatorButton
                className="scientific"
                onClick={() => onScientificOperation('φ')}
                title="Golden Ratio (φ)"
                aria-label="Golden Ratio"
                focused={focusedButtonIndex === 29}
                isKeypadNavigationActive={isKeypadNavigationActive}
            >
                φ
            </CalculatorButton>
        </>
    )
})

export default ScientificFunctions

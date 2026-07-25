/**
 * Mathematical utility functions for the calculator
 */

// Function to evaluate complex mathematical expressions with proper order of operations
export const evaluateExpression = (expr) => {
    // Replace calculator symbols with JavaScript operators
    let expression = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**')
    // Modulo remains as % in JavaScript

    // Handle implicit multiplication: patterns like ") (" should become ") * ("
    // Also handle cases like "5 (" -> "5 * (" and ") 3" -> ") * 3"
    // Be more careful with scientific notation to avoid breaking "1e-4" type numbers
    expression = expression
        // Pattern: number followed by opening parenthesis (avoid scientific notation)
        .replace(/(\d+(?:\.\d+)?(?![eE][+-]?\d))\s*\(/g, '$1 * (')
        // Pattern: closing parenthesis followed by opening parenthesis
        .replace(/\)\s*\(/g, ') * (')
        // Pattern: closing parenthesis followed by number (avoid scientific notation)
        .replace(/\)\s*(\d+(?:\.\d+)?(?![eE][+-]?\d))/g, ') * $1')

    // Handle parentheses first
    while (expression.includes('(')) {
        const lastOpenParen = expression.lastIndexOf('(')
        const firstCloseParen = expression.indexOf(')', lastOpenParen)

        if (firstCloseParen === -1) {
            throw new Error('Mismatched parentheses')
        }

        const innerExpression = expression.substring(lastOpenParen + 1, firstCloseParen)
        const innerResult = evaluateSimpleExpression(innerExpression)

        expression = expression.substring(0, lastOpenParen) +
            innerResult +
            expression.substring(firstCloseParen + 1)
    }

    return evaluateSimpleExpression(expression)
}

// Function to evaluate a simple expression without parentheses
const evaluateSimpleExpression = (expr) => {
    // Handle negative exponents by replacing "^ -" with "^-"
    const cleanedExpr = expr.replace(/\^\s*-/g, '^-')

    // Enhanced regex to better handle numbers (including scientific notation and decimals)
    const tokens = cleanedExpr.match(/(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\*\*|\+|\-|\*|\/|%)/g)
    if (!tokens) return 0

    // Convert ^ to ** for JavaScript evaluation
    const processedTokens = []
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        if (token === '^') {
            processedTokens.push('**')
        } else {
            processedTokens.push(token)
        }
    }

    // Convert to numbers and operators
    const values = []
    const operators = []

    for (let i = 0; i < processedTokens.length; i++) {
        const token = processedTokens[i]

        if (!isNaN(parseFloat(token))) {
            // It's a number
            values.push(parseFloat(token))
        } else {
            // It's an operator
            // Special handling for power operator (right-associative)
            if (token === '**') {
                while (operators.length > 0 &&
                    getPrecedence(operators[operators.length - 1]) > getPrecedence(token)) {
                    const op = operators.pop()
                    const b = values.pop()
                    const a = values.pop()
                    values.push(applyOperator(a, b, op))
                }
            } else {
                while (operators.length > 0 &&
                    getPrecedence(operators[operators.length - 1]) >= getPrecedence(token)) {
                    const op = operators.pop()
                    const b = values.pop()
                    const a = values.pop()
                    values.push(applyOperator(a, b, op))
                }
            }
            operators.push(token)
        }
    }

    // Process remaining operators
    while (operators.length > 0) {
        const op = operators.pop()
        const b = values.pop()
        const a = values.pop()
        values.push(applyOperator(a, b, op))
    }

    const finalResult = values.length > 0 ? values[0] : 0
    if (Number.isNaN(finalResult)) {
        throw new Error('Invalid expression')
    }
    return finalResult
}

// Helper function to get operator precedence
const getPrecedence = (op) => {
    switch (op) {
        case '+':
        case '-':
            return 1
        case '*':
        case '/':
        case '%':
            return 2
        case '**':
            return 3
        default:
            return 0
    }
}

// Helper function to apply an operator to two values
const applyOperator = (a, b, op) => {
    switch (op) {
        case '+':
            return a + b
        case '-':
            return a - b
        case '*':
            return a * b
        case '/':
            if (b === 0) throw new Error('Division by zero')
            return a / b
        case '%':
            if (b === 0) throw new Error('Division by zero')
            return a % b
        case '**':
            return Math.pow(a, b)
        default:
            return 0
    }
}

// Calculate basic operations
export const calculate = (firstValue, secondValue, operation) => {
    switch (operation) {
        case '+':
            return firstValue + secondValue
        case '-':
            return firstValue - secondValue
        case '×':
            return firstValue * secondValue
        case '÷':
            return firstValue / secondValue
        case '^':
            return Math.pow(firstValue, secondValue)
        case '%':
            return firstValue % secondValue
        case '=':
            return secondValue
        default:
            return secondValue
    }
}

// Factorial function
export const factorial = (n) => {
    if (n < 0) return NaN
    if (n === 0 || n === 1) return 1
    let result = 1
    for (let i = 2; i <= n; i++) {
        result *= i
    }
    return result
}

// Helper function to extract numbers from an expression for average calculation.
// A leading '-' counts as a sign only when it's directly attached to the digits
// (e.g. "-4"); operators in the display are spaced (e.g. "4 - 6"), so subtraction
// is not mistaken for a negative operand.
export const extractNumbersFromExpression = (expr) => {
    const numberMatches = expr.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)
    return numberMatches ? numberMatches.map(num => parseFloat(num)) : []
}

// Format a numeric result for display: strips floating-point noise
// (e.g. 0.1 + 0.2 => 0.3) while keeping the value re-parseable for further
// calculation. Returns a readable string for non-finite values.
export const formatResult = (value) => {
    if (typeof value !== 'number') return String(value)
    if (Number.isNaN(value)) return 'Error'
    if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity'
    // Round to 12 significant digits to remove binary floating-point artifacts.
    const rounded = parseFloat(value.toPrecision(12))
    return String(rounded)
}

// Helper function to format expression display with proper superscripts for powers
export const formatExpressionDisplay = (expr) => {
    if (!expr) return expr

    // First handle incomplete power expressions ending with "^ -" (negative exponent being built)
    let formatted = expr.replace(/(\d+(?:\.\d+)?|\w+)\s*\^\s*-\s*$/g, (match, base) => {
        return `${base}<sup>-□</sup>`
    })

    // Then handle incomplete power expressions (ending with ^ and waiting for exponent)
    formatted = formatted.replace(/(\d+(?:\.\d+)?|\w+)\s*\^\s*$/g, (match, base) => {
        return `${base}<sup>□</sup>`
    })

    // Finally handle complete power expressions with superscript formatting, completely hiding the ^ symbol
    // Handle patterns like "10 ^ -4", "2 ^ 3", "x ^ -2.5", etc.
    formatted = formatted.replace(/(\d+(?:\.\d+)?|\w+)\s*\^\s*(-?\d+(?:\.\d+)?)/g, (match, base, exponent) => {
        return `${base}<sup>${exponent}</sup>`
    })

    return formatted
}

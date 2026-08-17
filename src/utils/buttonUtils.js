/**
 * Button configuration and navigation utilities
 */

// Get button data for keyboard navigation
export const getButtonData = (isScientific) => {
    const buttons = []

    // Theme toggle buttons
    buttons.push({ type: 'theme-toggle', label: 'Toggle Theme', row: 0 })
    buttons.push({ type: 'mode-toggle', label: 'Toggle Mode', row: 0 })

    // Memory operations row
    buttons.push({ type: 'memory', action: 'MC', label: 'MC - Memory Clear', row: 1 })
    buttons.push({ type: 'memory', action: 'MR', label: 'MR - Memory Recall', row: 1 })
    buttons.push({ type: 'memory', action: 'M+', label: 'M+ - Memory Add', row: 1 })
    buttons.push({ type: 'memory', action: 'M-', label: 'M- - Memory Subtract', row: 1 })
    buttons.push({ type: 'memory', action: 'MS', label: 'MS - Memory Store', row: 1 })
    buttons.push({ type: 'clear', action: 'C', label: 'C - Clear All', row: 1 })

    // Copy/Paste operations row
    buttons.push({ type: 'copy-paste', action: 'copy-result', label: 'Copy Result', row: 2 })
    buttons.push({ type: 'copy-paste', action: 'copy-expression', label: 'Copy Expression', row: 2 })
    buttons.push({ type: 'copy-paste', action: 'copy-equation', label: 'Copy Equation', row: 2 })
    buttons.push({ type: 'copy-paste', action: 'paste', label: 'Paste', row: 2 })

    if (isScientific) {
        // Scientific functions row 1
        buttons.push({ type: 'scientific', action: 'sin', label: 'sin - Sine', row: 3 })
        buttons.push({ type: 'scientific', action: 'cos', label: 'cos - Cosine', row: 3 })
        buttons.push({ type: 'scientific', action: 'tan', label: 'tan - Tangent', row: 3 })
        buttons.push({ type: 'scientific', action: 'log', label: 'log - Logarithm Base 10', row: 3 })
        buttons.push({ type: 'scientific', action: 'ln', label: 'ln - Natural Logarithm', row: 3 })
        buttons.push({ type: 'scientific', action: 'sqrt', label: '√ - Square Root', row: 3 })

        // Scientific functions row 2
        buttons.push({ type: 'scientific', action: 'x²', label: 'x² - Square', row: 4 })
        buttons.push({ type: 'scientific', action: 'x³', label: 'x³ - Cube', row: 4 })
        buttons.push({ type: 'scientific', action: '1/x', label: '1/x - Reciprocal', row: 4 })
        buttons.push({ type: 'scientific', action: 'x!', label: 'x! - Factorial', row: 4 })
        buttons.push({ type: 'scientific', action: 'π', label: 'π - Pi', row: 4 })
        buttons.push({ type: 'scientific', action: 'e', label: 'e - Euler Number', row: 4 })

        // Scientific functions row 3
        buttons.push({ type: 'scientific', action: '10^x', label: '10^x - Ten to the Power', row: 5 })
        buttons.push({ type: 'scientific', action: '+/-', label: '+/- - Change Sign', row: 5 })
        buttons.push({ type: 'scientific', action: '(', label: '( - Opening Parenthesis', row: 5 })
        buttons.push({ type: 'scientific', action: ')', label: ') - Closing Parenthesis', row: 5 })
        buttons.push({ type: 'scientific', action: '%', label: '% - Modulo', row: 5 })
        buttons.push({ type: 'scientific', action: 'φ', label: 'φ - Golden Ratio', row: 5 })
    } else {
        // Basic functions for normal mode
        buttons.push({ type: 'scientific', action: 'sqrt', label: '√ - Square Root', row: 3 })
        buttons.push({ type: 'scientific', action: 'x²', label: 'x² - Square', row: 3 })
        buttons.push({ type: 'scientific', action: '1/x', label: '1/x - Reciprocal', row: 3 })
        buttons.push({ type: 'scientific', action: '+/-', label: '+/- - Change Sign', row: 3 })
        buttons.push({ type: 'scientific', action: '%', label: '% - Modulo', row: 3 })
        buttons.push({ type: 'scientific', action: 'φ', label: 'φ - Golden Ratio', row: 3 })
    }

    // Operators row
    const operatorRow = isScientific ? 6 : 4
    buttons.push({ type: 'operator', action: '^', label: 'x^y - Power', row: operatorRow })
    buttons.push({ type: 'operator', action: '÷', label: '÷ - Division', row: operatorRow })
    buttons.push({ type: 'operator', action: '×', label: '× - Multiplication', row: operatorRow })
    buttons.push({ type: 'operator', action: '-', label: '- - Subtraction', row: operatorRow })
    buttons.push({ type: 'operator', action: '+', label: '+ - Addition', row: operatorRow })
    buttons.push({ type: 'operator', action: 'avg', label: 'avg - Average', row: operatorRow })

    // Number pad row 1
    const numberRow1 = isScientific ? 7 : 5
    for (let i = 1; i <= 6; i++) {
        buttons.push({ type: 'number', action: i.toString(), label: `${i} - Number ${i}`, row: numberRow1 })
    }

    // Number pad row 2
    const numberRow2 = isScientific ? 8 : 6
    for (let i = 7; i <= 9; i++) {
        buttons.push({ type: 'number', action: i.toString(), label: `${i} - Number ${i}`, row: numberRow2 })
    }
    buttons.push({ type: 'number', action: '0', label: '0 - Number 0', row: numberRow2 })
    buttons.push({ type: 'number', action: '.', label: '. - Decimal Point', row: numberRow2 })
    buttons.push({ type: 'number', action: '⌫', label: '⌫ - Delete', row: numberRow2 })

    // Equals row
    const equalsRow = isScientific ? 9 : 7
    buttons.push({ type: 'equals', action: '=', label: '= - Calculate Result', row: equalsRow })

    return buttons
}

// Find next/previous button in navigation
export const findNavigationTarget = (buttons, currentIndex, direction, currentRow) => {
    const currentButton = buttons[currentIndex]
    if (!currentButton) return currentIndex

    const buttonsInCurrentRow = buttons.filter(btn => btn.row === currentRow)
    const currentIndexInRow = buttonsInCurrentRow.findIndex(btn => btn === currentButton)

    let newIndex = currentIndex

    switch (direction) {
        case 'left':
            if (currentIndexInRow > 0) {
                const targetButton = buttonsInCurrentRow[currentIndexInRow - 1]
                newIndex = buttons.findIndex(btn => btn === targetButton)
            }
            break
        case 'right':
            if (currentIndexInRow < buttonsInCurrentRow.length - 1) {
                const targetButton = buttonsInCurrentRow[currentIndexInRow + 1]
                newIndex = buttons.findIndex(btn => btn === targetButton)
            }
            break
        case 'up': {
            const previousRow = currentRow - 1
            if (previousRow >= 0) {
                const buttonsInPreviousRow = buttons.filter(btn => btn.row === previousRow)
                const targetIndex = Math.min(currentIndexInRow, buttonsInPreviousRow.length - 1)
                if (buttonsInPreviousRow[targetIndex]) {
                    newIndex = buttons.findIndex(btn => btn === buttonsInPreviousRow[targetIndex])
                }
            }
            break
        }
        case 'down': {
            const nextRow = currentRow + 1
            const maxRow = Math.max(...buttons.map(btn => btn.row))
            if (nextRow <= maxRow) {
                const buttonsInNextRow = buttons.filter(btn => btn.row === nextRow)
                const targetIndex = Math.min(currentIndexInRow, buttonsInNextRow.length - 1)
                if (buttonsInNextRow[targetIndex]) {
                    newIndex = buttons.findIndex(btn => btn === buttonsInNextRow[targetIndex])
                }
            }
            break
        }
    }

    return newIndex
}

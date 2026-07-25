import { describe, it, expect } from 'vitest'
import {
    evaluateExpression,
    factorial,
    formatExpressionDisplay,
    extractNumbersFromExpression,
    formatResult
} from '../utils/mathUtils'

describe('Math Utils', () => {
    describe('evaluateExpression', () => {
        it('evaluates basic arithmetic correctly', () => {
            expect(evaluateExpression('2 + 3')).toBe(5)
            expect(evaluateExpression('10 - 4')).toBe(6)
            expect(evaluateExpression('3 × 4')).toBe(12)
            expect(evaluateExpression('15 ÷ 3')).toBe(5)
        })

        it('handles operator precedence correctly', () => {
            expect(evaluateExpression('2 + 3 × 4')).toBe(14)
            expect(evaluateExpression('10 - 2 × 3')).toBe(4)
            expect(evaluateExpression('2 ^ 3 + 1')).toBe(9)
        })

        it('handles parentheses correctly', () => {
            expect(evaluateExpression('(2 + 3) × 4')).toBe(20)
            expect(evaluateExpression('2 × (3 + 4)')).toBe(14)
            expect(evaluateExpression('((2 + 3) × 4) - 5')).toBe(15)
        })

        it('handles power operations correctly', () => {
            expect(evaluateExpression('2 ^ 3')).toBe(8)
            expect(evaluateExpression('3 ^ 2')).toBe(9)
            expect(evaluateExpression('2 ^ 3 ^ 2')).toBe(512) // Right associative
        })

        it('handles modulo operations correctly', () => {
            expect(evaluateExpression('10 % 3')).toBe(1)
            expect(evaluateExpression('15 % 4')).toBe(3)
        })

        it('throws error for division by zero', () => {
            expect(() => evaluateExpression('5 ÷ 0')).toThrow('Division by zero')
        })

        it('throws error for mismatched parentheses', () => {
            expect(() => evaluateExpression('(2 + 3')).toThrow('Mismatched parentheses')
        })

        it('throws instead of silently returning 0 for invalid input', () => {
            expect(() => evaluateExpression('2 + + 3')).toThrow('Invalid expression')
        })

        it('handles scientific notation', () => {
            expect(evaluateExpression('1e3 + 5')).toBe(1005)
        })
    })

    describe('formatResult', () => {
        it('strips floating-point noise', () => {
            expect(formatResult(0.1 + 0.2)).toBe('0.3')
            expect(formatResult(1 / 3 * 3)).toBe('1')
        })

        it('preserves ordinary values', () => {
            expect(formatResult(42)).toBe('42')
            expect(formatResult(-7.5)).toBe('-7.5')
        })

        it('reports non-finite values readably', () => {
            expect(formatResult(NaN)).toBe('Error')
            expect(formatResult(Infinity)).toBe('Infinity')
            expect(formatResult(-Infinity)).toBe('-Infinity')
        })
    })

    describe('factorial', () => {
        it('calculates factorial correctly', () => {
            expect(factorial(0)).toBe(1)
            expect(factorial(1)).toBe(1)
            expect(factorial(5)).toBe(120)
            expect(factorial(6)).toBe(720)
        })

        it('returns NaN for negative numbers', () => {
            expect(factorial(-1)).toBeNaN()
        })
    })

    describe('formatExpressionDisplay', () => {
        it('formats power expressions with superscripts', () => {
            expect(formatExpressionDisplay('2 ^ 3')).toBe('2<sup>3</sup>')
            expect(formatExpressionDisplay('x ^ -2')).toBe('x<sup>-2</sup>')
        })

        it('handles incomplete power expressions', () => {
            expect(formatExpressionDisplay('2 ^ ')).toBe('2<sup>□</sup>')
            expect(formatExpressionDisplay('3 ^ -')).toBe('3<sup>-□</sup>')
        })

        it('returns unchanged text for non-power expressions', () => {
            expect(formatExpressionDisplay('2 + 3')).toBe('2 + 3')
            expect(formatExpressionDisplay('sin(45)')).toBe('sin(45)')
        })
    })

    describe('extractNumbersFromExpression', () => {
        it('extracts numbers from expressions correctly', () => {
            expect(extractNumbersFromExpression('2 + 3 × 4')).toEqual([2, 3, 4])
            expect(extractNumbersFromExpression('10.5 - 2.3')).toEqual([10.5, 2.3])
            expect(extractNumbersFromExpression('sin(45) + 3')).toEqual([45, 3])
        })

        it('returns empty array for expressions without numbers', () => {
            expect(extractNumbersFromExpression('+ - ×')).toEqual([])
        })

        it('captures attached negative signs but not spaced subtraction', () => {
            expect(extractNumbersFromExpression('-4, 6')).toEqual([-4, 6])
            expect(extractNumbersFromExpression('4 - 6')).toEqual([4, 6])
        })
    })
})

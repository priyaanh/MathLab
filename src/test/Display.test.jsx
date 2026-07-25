import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Display from '../components/Display'
import { formatExpressionDisplay } from '../utils/mathUtils'

describe('Display Component', () => {
    const defaultProps = {
        expression: '',
        currentExpression: '',
        display: '0',
        justCalculated: false,
        isEditing: false,
        cursorPosition: 0,
        onExpressionClick: vi.fn(),
        formatExpressionDisplay
    }

    it('renders display correctly', () => {
        render(<Display {...defaultProps} />)
        expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('shows cursor when editing', () => {
        render(<Display {...defaultProps} isEditing={true} />)
        expect(screen.getByText('|')).toBeInTheDocument()
    })

    it('calls onExpressionClick when expression area is clicked', () => {
        const onExpressionClick = vi.fn()
        render(<Display {...defaultProps} onExpressionClick={onExpressionClick} />)

        const expressionElement = screen.getByRole('textbox', { name: /no expression/i })
        fireEvent.click(expressionElement)

        expect(onExpressionClick).toHaveBeenCalled()
    })

    it('displays expression with cursor position', () => {
        render(<Display
            {...defaultProps}
            expression="2+3"
            isEditing={true}
            cursorPosition={1}
        />)

        expect(screen.getByText('2')).toBeInTheDocument()
        expect(screen.getByText('|')).toBeInTheDocument()
        expect(screen.getByText('+3')).toBeInTheDocument()
    })
})

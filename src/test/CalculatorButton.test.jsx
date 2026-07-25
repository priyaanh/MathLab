import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CalculatorButton from '../components/CalculatorButton'

describe('CalculatorButton Component', () => {
    const defaultProps = {
        className: 'number',
        onClick: vi.fn(),
        children: '1',
        title: 'Number 1',
        'aria-label': 'Number 1',
        focused: false,
        isKeypadNavigationActive: false
    }

    it('renders button correctly', () => {
        render(<CalculatorButton {...defaultProps} />)
        expect(screen.getByRole('gridcell')).toBeInTheDocument()
        expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('calls onClick when clicked', () => {
        const onClick = vi.fn()
        render(<CalculatorButton {...defaultProps} onClick={onClick} />)

        fireEvent.click(screen.getByRole('gridcell'))
        expect(onClick).toHaveBeenCalled()
    })

    it('applies focused class when focused', () => {
        render(<CalculatorButton {...defaultProps} focused={true} />)
        const button = screen.getByRole('gridcell')
        expect(button).toHaveClass('focused')
    })

    it('has correct tabIndex when keyboard navigation is active and focused', () => {
        render(<CalculatorButton
            {...defaultProps}
            focused={true}
            isKeypadNavigationActive={true}
        />)
        const button = screen.getByRole('gridcell')
        expect(button).toHaveAttribute('tabIndex', '0')
    })

    it('has tabIndex -1 when not focused or keyboard navigation inactive', () => {
        render(<CalculatorButton {...defaultProps} />)
        const button = screen.getByRole('gridcell')
        expect(button).toHaveAttribute('tabIndex', '-1')
    })
})

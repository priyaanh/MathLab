import { useMemo } from 'react'

/**
 * Custom hook for performance optimizations
 */
export const usePerformanceOptimizations = (isScientific, focusedButtonIndex, operations) => {
    // Memoize equals button props
    const equalsButtonProps = useMemo(() => ({
        className: 'equals span-full',
        onClick: () => operations.performOperation('='),
        title: 'Calculate Result (Equals)',
        'aria-label': 'Calculate Result',
        focused: focusedButtonIndex === (isScientific ? 44 : 32)
    }), [isScientific, focusedButtonIndex, operations.performOperation])

    return {
        equalsButtonProps
    }
}

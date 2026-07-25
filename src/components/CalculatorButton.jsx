import React from 'react'

/**
 * Calculator button component with accessibility support
 */
const CalculatorButton = React.memo(({
    className,
    onClick,
    children,
    title,
    'aria-label': ariaLabel,
    focused = false,
    isKeypadNavigationActive = false
}) => {
    return (
        <button
            className={`key ${className} ${focused ? 'focused' : ''}`}
            onClick={onClick}
            title={title}
            tabIndex={isKeypadNavigationActive && focused ? 0 : -1}
            aria-label={ariaLabel}
            role="gridcell"
        >
            {children}
        </button>
    )
})

export default CalculatorButton

import React from 'react'

/**
 * Display component for the calculator showing expression and current value
 */
const Display = React.memo(({
    expression,
    currentExpression,
    display,
    justCalculated,
    isEditing,
    cursorPosition,
    onExpressionClick,
    formatExpressionDisplay
}) => {
    return (
        <div className="calculator-display">
            <div
                className={`expression ${isEditing ? 'editing' : ''}`}
                onClick={onExpressionClick}
                title={isEditing ? "Editing mode - Use arrow keys to navigate, Escape to exit" : "Click to edit expression"}
                role="textbox"
                aria-label={expression ? `Expression: ${expression}` : "No expression"}
                aria-live="polite"
            >
                {expression ? (
                    <>
                        {expression.slice(0, cursorPosition)}
                        {isEditing && <span className="cursor">|</span>}
                        {expression.slice(cursorPosition)}
                    </>
                ) : isEditing ? (
                    <>
                        <span className="cursor">|</span>
                        <span style={{ opacity: 0.5, fontSize: '0.9em' }}>Enter expression...</span>
                    </>
                ) : (
                    <span style={{ opacity: 0.5 }}>No expression</span>
                )}
            </div>
            <div
                className="display"
                role="textbox"
                aria-label={`Current display: ${justCalculated ? display : (formatExpressionDisplay(currentExpression) || display)}`}
                aria-live="assertive"
                dangerouslySetInnerHTML={{
                    __html: justCalculated ? display : (formatExpressionDisplay(currentExpression) || display)
                }}
            />
        </div>
    )
})

export default Display

import React from 'react'

/**
 * Accessibility banners and instructions
 */
const AccessibilityBanners = React.memo(({
    isKeypadNavigationActive,
    showAccessibilityHelp,
    focusedButtonIndex
}) => {
    return (
        <>
            {/* Accessibility Instructions */}
            <div className="accessibility-instructions" aria-live="polite">
                {isKeypadNavigationActive && focusedButtonIndex >= 0 && (
                    <span className="sr-only">
                        Press Tab to navigate buttons, Arrow keys to move within grid, Enter or Space to activate, Escape to exit navigation
                    </span>
                )}
            </div>

            {/* Accessibility Help Banner - shown on first Tab press */}
            {showAccessibilityHelp && (
                <div className="accessibility-help-banner" role="status" aria-live="polite">
                    <span>♿ Accessibility Mode</span>
                    <span className="help-text">Full keyboard support enabled! Use Tab to navigate, arrow keys within grid, or type directly.</span>
                </div>
            )}

            {/* Keyboard Navigation Help Banner */}
            {isKeypadNavigationActive && (
                <div className="keyboard-navigation-banner" role="status" aria-live="polite">
                    <span>🔍 Keyboard Navigation Active</span>
                    <span className="help-text">Arrow keys: Navigate • Enter/Space: Activate • Direct input: 0-9, +, -, *, /, = • Esc: Exit</span>
                </div>
            )}
        </>
    )
})

export default AccessibilityBanners

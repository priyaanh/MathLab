import React from 'react'

/**
 * Calculation history panel. Shows past "expr = result" entries (newest first);
 * clicking a result reuses the value, clicking the expression reloads it for
 * further editing. Persisted by the calculator state hook.
 */
const HistoryPanel = React.memo(({ history, onReuseResult, onReuseExpression, onClear }) => {
    return (
        <aside className="history-panel" aria-label="Calculation history">
            <div className="history-head">
                <span>History</span>
                {history.length > 0 && (
                    <button className="history-clear" onClick={onClear} title="Clear history" aria-label="Clear history">
                        Clear
                    </button>
                )}
            </div>

            {history.length === 0 ? (
                <p className="history-empty">No calculations yet. Your results will appear here.</p>
            ) : (
                <ul className="history-list">
                    {history.map((entry, i) => (
                        <li key={`${entry.expr}-${i}`} className="history-item">
                            <button
                                className="history-expr"
                                onClick={() => onReuseExpression(entry.expr)}
                                title="Load this expression"
                            >
                                {entry.expr}
                            </button>
                            <button
                                className="history-result"
                                onClick={() => onReuseResult(entry.result)}
                                title="Use this result"
                            >
                                = {entry.result}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    )
})

export default HistoryPanel

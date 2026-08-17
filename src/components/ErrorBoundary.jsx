import { Component } from 'react'

/**
 * Catches render/runtime errors in the page below it and shows a friendly
 * recovery screen instead of a blank white page. Resets automatically when the
 * route changes (via the `resetKey` prop) so a crash on one tool doesn't wedge
 * the rest of the site.
 */
class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error) {
        return { error }
    }

    // Keep the real reason in the console — the panel below only shows a summary.
    componentDidCatch(error, info) {
        console.error('MathLab caught a render error:', error, info?.componentStack)
    }

    componentDidUpdate(prevProps) {
        // A navigation happened — clear the error so the new page can render.
        if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ error: null })
        }
    }

    render() {
        const { error } = this.state
        if (error) {
            // An overlay passes onClose: retrying in place would just re-mount the
            // thing that threw, so its primary action dismisses it instead.
            const { onReset } = this.props
            return (
                <div className={`error-screen${onReset ? ' is-overlay' : ''}`} role="alert">
                    <span className="error-emoji" aria-hidden="true">🧮💥</span>
                    <h1>Something went wrong{onReset ? ' in here' : ' on this page'}</h1>
                    <p>The rest of MathLab is fine. Your saved progress is untouched.</p>
                    <p className="error-detail"><code>{String(error?.message || error).slice(0, 300)}</code></p>
                    <div className="error-actions">
                        {onReset
                            ? <button className="btn primary" onClick={onReset}>Close</button>
                            : <button className="btn primary" onClick={() => this.setState({ error: null })}>Try again</button>}
                        {!onReset && <a className="btn ghost" href="#/">Go home</a>}
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}

export default ErrorBoundary

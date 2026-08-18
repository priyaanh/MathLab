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
            const message = String(error?.message || error)

            /*
             * A chunk that failed to load is a special case: React.lazy caches the
             * rejection, so neither closing nor retrying can ever recover it. Only
             * a fresh document will, so that becomes the primary action and the
             * copy says why rather than blaming the panel.
             */
            const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \S+ failed/i.test(message)

            return (
                <div className={`error-screen${onReset ? ' is-overlay' : ''}`} role="alert">
                    <span className="error-emoji" aria-hidden="true">{isChunkError ? '🔄' : '🧮💥'}</span>
                    <h1>{isChunkError ? 'Couldn’t finish loading this' : `Something went wrong${onReset ? ' in here' : ' on this page'}`}</h1>
                    <p>
                        {isChunkError
                            ? 'Part of the app didn’t download — usually the page was left open while it was rebuilt or updated. Reloading picks up the new version.'
                            : 'The rest of MathLab is fine. Your saved progress is untouched.'}
                    </p>
                    <p className="error-detail"><code>{message.slice(0, 300)}</code></p>
                    <div className="error-actions">
                        {isChunkError && (
                            <button className="btn primary" onClick={() => window.location.reload()}>Reload the page</button>
                        )}
                        {onReset
                            ? <button className={`btn ${isChunkError ? 'ghost' : 'primary'}`} onClick={onReset}>Close</button>
                            : !isChunkError && <button className="btn primary" onClick={() => this.setState({ error: null })}>Try again</button>}
                        {!onReset && <a className="btn ghost" href="#/">Go home</a>}
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}

export default ErrorBoundary

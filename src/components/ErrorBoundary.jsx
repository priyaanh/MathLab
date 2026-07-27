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

    componentDidUpdate(prevProps) {
        // A navigation happened — clear the error so the new page can render.
        if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ error: null })
        }
    }

    render() {
        if (this.state.error) {
            return (
                <div className="error-screen" role="alert">
                    <span className="error-emoji" aria-hidden="true">🧮💥</span>
                    <h1>Something went wrong on this page</h1>
                    <p>The rest of MathLab is fine — try again, or head back home. Your saved progress is untouched.</p>
                    <div className="error-actions">
                        <button className="btn primary" onClick={() => this.setState({ error: null })}>Try again</button>
                        <a className="btn ghost" href="#/">Go home</a>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}

export default ErrorBoundary

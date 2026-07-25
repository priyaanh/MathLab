import { Link, useParams } from 'react-router-dom'
import { LEVELS, LEVEL_ORDER } from '../data/curriculum'

/**
 * Deep-dive page for one school level (elementary → college). Explains each
 * topic in depth and links to the MathLab tools that help with it.
 */
const LevelPage = () => {
    const { level: slug } = useParams()
    const level = LEVELS[slug]

    if (!level) {
        return (
            <div className="page">
                <div className="page-head">
                    <h1>Level not found</h1>
                    <p>That level doesn’t exist. <Link className="did-you-mean" to="/guide">Back to the Guide</Link>.</p>
                </div>
            </div>
        )
    }

    const idx = LEVEL_ORDER.indexOf(slug)
    const prev = LEVEL_ORDER[idx - 1]
    const next = LEVEL_ORDER[idx + 1]

    return (
        <div className="page">
            <div className="level-hero">
                <span className="level-hero-icon">{level.icon}</span>
                <div>
                    <div className="level-crumbs">
                        <Link to="/guide">Guide</Link> <span aria-hidden="true">→</span> Math by grade level
                    </div>
                    <h1>{level.level}</h1>
                    <span className="level-grades">{level.grades}</span>
                    <p className="level-hero-intro">{level.intro}</p>
                </div>
            </div>

            <div className="topic-deep-list">
                {level.topics.map((t, i) => (
                    <section key={t.name} className="panel topic-deep">
                        <div className="topic-deep-head">
                            <span className="topic-deep-num">{i + 1}</span>
                            <h2>{t.name}</h2>
                        </div>
                        <p className="topic-deep-detail">{t.detail}</p>
                        {t.example && (
                            <p className="topic-deep-example"><strong>Example:</strong> {t.example}</p>
                        )}
                        {t.tools.length > 0 && (
                            <div className="topic-deep-tools">
                                <span className="topic-deep-tools-label">Try it here</span>
                                {t.tools.map(tool => (
                                    <Link key={tool.to} to={tool.to} className="tool-chip">{tool.label} →</Link>
                                ))}
                            </div>
                        )}
                    </section>
                ))}
            </div>

            <div className="level-nav">
                {prev
                    ? <Link className="btn ghost" to={`/learn/${prev}`}>← {LEVELS[prev].level}</Link>
                    : <span />}
                {next
                    ? <Link className="btn primary" to={`/learn/${next}`}>{LEVELS[next].level} →</Link>
                    : <Link className="btn primary" to="/">Explore the tools →</Link>}
            </div>
        </div>
    )
}

export default LevelPage

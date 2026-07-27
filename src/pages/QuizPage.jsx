import { useState } from 'react'
import { TOPICS, ALL_SKILLS, checkAnswer } from '../exercises'

/**
 * Quiz — a scored, fixed-length run of fresh problems drawn from the exercise
 * generators. Separate from Exercises (which is open-ended mastery practice):
 * here you answer N questions, then get a score and a review of what you missed.
 */

// Render "x^2"-style exponents as superscripts; everything else verbatim.
const renderMath = (text) => {
    if (text == null) return null
    const parts = []
    const re = /\^(-?\d+|\([^)]*\)|[a-zA-Z])/g
    let last = 0, m, key = 0
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index))
        parts.push(<sup key={key++}>{m[1].replace(/[()]/g, '')}</sup>)
        last = m.index + m[0].length
    }
    if (last < text.length) parts.push(text.slice(last))
    return parts
}

const ALL_SKILL_LIST = Object.values(ALL_SKILLS)
const LENGTHS = [5, 10, 15]

const genProblem = (skill) => {
    for (let i = 0; i < 8; i++) {
        try {
            const p = skill.generate()
            if (p && p.prompt) return { ...p, skillTitle: skill.title }
        } catch { /* retry */ }
    }
    return null
}

const QuizPage = () => {
    const [phase, setPhase] = useState('setup') // 'setup' | 'playing' | 'done'
    const [topic, setTopic] = useState('all')
    const [length, setLength] = useState(10)
    const [problems, setProblems] = useState([])
    const [idx, setIdx] = useState(0)
    const [input, setInput] = useState('')
    const [checked, setChecked] = useState(null) // { correct, given }
    const [results, setResults] = useState([])

    const start = () => {
        const pool = topic === 'all' ? ALL_SKILL_LIST : (TOPICS.find(t => t.id === topic)?.skills || ALL_SKILL_LIST)
        const probs = []
        for (let i = 0; i < length; i++) {
            const p = genProblem(pool[Math.floor(Math.random() * pool.length)])
            if (p) probs.push(p)
        }
        setProblems(probs)
        setIdx(0); setInput(''); setChecked(null); setResults([])
        setPhase('playing')
    }

    const cur = problems[idx]

    const grade = (given) => {
        if (checked || !cur) return
        setChecked({ correct: checkAnswer(cur, given), given })
    }

    const next = () => {
        const nextResults = [...results, { ...checked, problem: cur }]
        setResults(nextResults)
        if (idx + 1 >= problems.length) setPhase('done')
        else { setIdx(idx + 1); setInput(''); setChecked(null) }
    }

    const correctSoFar = results.filter(r => r.correct).length

    // ---- setup ------------------------------------------------------------
    if (phase === 'setup') {
        return (
            <div className="page">
                <div className="page-head">
                    <h1>Quiz</h1>
                    <p>A scored run of fresh problems. Pick a topic and length, then answer against the clock of your own patience — no mastery pressure, just a score.</p>
                </div>
                <div className="panel" style={{ maxWidth: 520 }}>
                    <label className="field">
                        Topic
                        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                            <option value="all">Mixed — all topics</option>
                            {TOPICS.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                        </select>
                    </label>
                    <div className="field" style={{ marginTop: '0.9rem' }}>
                        Questions
                        <div className="quiz-lengths">
                            {LENGTHS.map(n => (
                                <button key={n} type="button" className={`btn ${n === length ? 'primary' : 'ghost'}`} onClick={() => setLength(n)}>{n}</button>
                            ))}
                        </div>
                    </div>
                    <button className="btn primary btn-xl" style={{ width: '100%', marginTop: '1.1rem' }} onClick={start}>Start quiz →</button>
                </div>
            </div>
        )
    }

    // ---- done -------------------------------------------------------------
    if (phase === 'done') {
        const pct = Math.round((correctSoFar / results.length) * 100)
        const missed = results.filter(r => !r.correct)
        const medal = pct === 100 ? '🏆' : pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚'
        return (
            <div className="page">
                <div className="page-head">
                    <h1>Quiz complete {medal}</h1>
                    <p>Nice work. Here’s how it went.</p>
                </div>
                <div className="panel" style={{ maxWidth: 640 }}>
                    <div className="quiz-score">
                        <span className="quiz-score-num">{correctSoFar}/{results.length}</span>
                        <span className="quiz-score-pct">{pct}% correct</span>
                    </div>
                    {missed.length > 0 ? (
                        <>
                            <h2 style={{ marginTop: '1.2rem' }}>Review ({missed.length} missed)</h2>
                            <div className="quiz-review">
                                {missed.map((r, i) => (
                                    <div key={i} className="quiz-review-item">
                                        <div className="quiz-review-q">{renderMath(r.problem.prompt)}</div>
                                        <div className="quiz-review-a">
                                            <span className="no">You: {r.given || '—'}</span>
                                            <span className="ok">Answer: {renderMath(String(r.problem.answer))}</span>
                                        </div>
                                        {r.problem.explanation && <div className="quiz-review-exp">{renderMath(r.problem.explanation)}</div>}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="hint" style={{ marginTop: '1rem' }}>Perfect score — every answer correct. 🎯</p>
                    )}
                    <div className="row" style={{ marginTop: '1.2rem' }}>
                        <button className="btn primary" onClick={start}>Play again (same settings)</button>
                        <button className="btn ghost" onClick={() => setPhase('setup')}>Change settings</button>
                    </div>
                </div>
            </div>
        )
    }

    // ---- playing ----------------------------------------------------------
    if (!cur) return null
    const isChoice = cur.type === 'choice' && Array.isArray(cur.choices)

    return (
        <div className="page">
            <div className="page-head">
                <h1>Quiz</h1>
            </div>
            <div className="panel" style={{ maxWidth: 640 }}>
                <div className="quiz-bar">
                    <span>Question {idx + 1} of {problems.length}</span>
                    <span className="quiz-running">{correctSoFar} correct</span>
                </div>
                <div className="quiz-progress"><div style={{ width: `${(idx / problems.length) * 100}%` }} /></div>

                <div className="quiz-skill">{cur.skillTitle}</div>
                <div className="quiz-prompt">{renderMath(cur.prompt)}</div>

                {isChoice ? (
                    <div className="quiz-choices">
                        {cur.choices.map((c) => {
                            let cls = ''
                            if (checked) {
                                if (c === String(cur.answer)) cls = 'ok'
                                else if (c === checked.given) cls = 'no'
                            }
                            return (
                                <button key={c} type="button" className={`btn ghost quiz-choice ${cls}`} disabled={!!checked} onClick={() => grade(c)}>
                                    {renderMath(c)}
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <form
                        className="quiz-answer"
                        onSubmit={(e) => { e.preventDefault(); checked ? next() : grade(input) }}
                    >
                        <input
                            type="text"
                            data-keypad="full"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Your answer"
                            disabled={!!checked}
                            autoComplete="off"
                            spellCheck={false}
                            autoFocus
                        />
                        {!checked && <button className="btn primary" type="submit">Check</button>}
                    </form>
                )}

                {checked && (
                    <div className={`quiz-feedback ${checked.correct ? 'ok' : 'no'}`}>
                        <div className="quiz-feedback-head">{checked.correct ? '✓ Correct!' : '✗ Not quite'}</div>
                        {!checked.correct && <div>Answer: <strong>{renderMath(String(cur.answer))}</strong></div>}
                        {cur.explanation && <div className="quiz-exp">{renderMath(cur.explanation)}</div>}
                        <button className="btn primary" style={{ marginTop: '0.7rem' }} onClick={next}>
                            {idx + 1 >= problems.length ? 'See results →' : 'Next question →'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default QuizPage

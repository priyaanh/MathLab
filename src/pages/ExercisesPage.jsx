import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TOPICS, ALL_SKILLS, TOTAL_SKILLS, checkAnswer } from '../exercises'

const PROGRESS_KEY = 'mathlab-exercise-progress'
const MASTERY_STREAK = 5 // correct-in-a-row to "master" a skill

// Render "x^2" style exponents as real superscripts; everything else verbatim.
const renderMath = (text) => {
    if (text == null) return null
    const parts = []
    const re = /\^(-?\d+|\([^)]*\)|[a-zA-Z])/g
    let last = 0
    let m
    let key = 0
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index))
        parts.push(<sup key={key++}>{m[1].replace(/[()]/g, '')}</sup>)
        last = m.index + m[0].length
    }
    if (last < text.length) parts.push(text.slice(last))
    return parts
}

// --- persisted progress ----------------------------------------------------
const loadProgress = () => {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch {
        return {}
    }
}

const useProgress = () => {
    const [progress, setProgress] = useState(loadProgress)

    useEffect(() => {
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)) } catch { /* ignore */ }
    }, [progress])

    const record = useCallback((skillId, correct) => {
        setProgress(prev => {
            const p = prev[skillId] || { attempts: 0, correct: 0, streak: 0, best: 0, mastered: false }
            const streak = correct ? p.streak + 1 : 0
            const best = Math.max(p.best, streak)
            return {
                ...prev,
                [skillId]: {
                    attempts: p.attempts + 1,
                    correct: p.correct + (correct ? 1 : 0),
                    streak,
                    best,
                    mastered: p.mastered || best >= MASTERY_STREAK
                }
            }
        })
    }, [])

    const reset = useCallback((skillId) => {
        setProgress(prev => {
            const next = { ...prev }
            delete next[skillId]
            return next
        })
    }, [])

    return { progress, record, reset }
}

// --- one practice session --------------------------------------------------
const PracticeSession = ({ skill, stat, onRecord, onResetSkill, onBack }) => {
    const [problem, setProblem] = useState(null)
    const [input, setInput] = useState('')
    const [picked, setPicked] = useState(null)     // chosen MC value
    const [phase, setPhase] = useState('answering') // 'answering' | 'checked'
    const [correct, setCorrect] = useState(false)
    const [session, setSession] = useState({ correct: 0, total: 0, streak: 0 })
    const inputRef = useRef(null)
    const nextRef = useRef(null)

    const newProblem = useCallback(() => {
        // Guard against a misbehaving generator so the page never crashes.
        for (let i = 0; i < 5; i++) {
            try {
                const p = skill.generate()
                if (p && p.prompt != null && p.answer != null) { setProblem(p); break }
            } catch { /* retry */ }
        }
        setInput('')
        setPicked(null)
        setPhase('answering')
        setCorrect(false)
    }, [skill])

    // Fresh problem whenever the skill changes.
    useEffect(() => { newProblem() }, [newProblem])

    // Focus the input on each new problem / focus Next after checking.
    useEffect(() => {
        if (phase === 'answering' && inputRef.current) inputRef.current.focus()
        if (phase === 'checked' && nextRef.current) nextRef.current.focus()
    }, [phase, problem])

    const submit = useCallback((value) => {
        if (!problem || phase === 'checked') return
        const isRight = checkAnswer(problem, value)
        setCorrect(isRight)
        setPhase('checked')
        setSession(s => ({ correct: s.correct + (isRight ? 1 : 0), total: s.total + 1, streak: isRight ? s.streak + 1 : 0 }))
        onRecord(skill.id, isRight)
    }, [problem, phase, onRecord, skill.id])

    if (!problem) return null

    const isChoice = problem.type === 'choice' && Array.isArray(problem.choices)
    const mastered = stat?.mastered
    const towardMastery = Math.min(stat?.best || 0, MASTERY_STREAK)

    return (
        <div className="ex-session">
            <div className="ex-session-head">
                <button className="btn ghost" onClick={onBack}>← All exercises</button>
                <div className="ex-session-title">
                    <span className="ex-topic-tag">{skill.topicLabel}</span>
                    <h1>{skill.title}</h1>
                </div>
            </div>

            <div className="ex-scorebar">
                <div className="ex-score"><span className="ex-score-num">{session.streak}</span><span className="ex-score-lbl">🔥 streak</span></div>
                <div className="ex-score"><span className="ex-score-num">{session.correct}/{session.total}</span><span className="ex-score-lbl">this session</span></div>
                <div className="ex-mastery">
                    {mastered ? (
                        <span className="ex-mastered">✓ Mastered</span>
                    ) : (
                        <>
                            <span className="ex-score-lbl">Mastery: {towardMastery}/{MASTERY_STREAK} in a row</span>
                            <div className="ex-mastery-bar"><div style={{ width: `${(towardMastery / MASTERY_STREAK) * 100}%` }} /></div>
                        </>
                    )}
                </div>
            </div>

            <div className="ex-card">
                <div className="ex-prompt">{renderMath(problem.prompt)}</div>

                {isChoice ? (
                    <div className="ex-choices">
                        {problem.choices.map((c) => {
                            const chosen = picked === c
                            let cls = 'ex-choice'
                            if (phase === 'checked') {
                                if (checkAnswer(problem, c)) cls += ' right'
                                else if (chosen) cls += ' wrong'
                            } else if (chosen) cls += ' chosen'
                            return (
                                <button
                                    key={c}
                                    className={cls}
                                    disabled={phase === 'checked'}
                                    onClick={() => { setPicked(c); submit(c) }}
                                >
                                    {renderMath(c)}
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <form
                        className="ex-answer-row"
                        onSubmit={(e) => { e.preventDefault(); if (phase === 'answering') submit(input); else newProblem() }}
                    >
                        <input
                            ref={inputRef}
                            className="ex-input"
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Your answer"
                            aria-label="Your answer"
                            autoComplete="off"
                            spellCheck="false"
                            disabled={phase === 'checked'}
                        />
                        {phase === 'answering'
                            ? <button type="submit" className="btn primary" disabled={input.trim() === ''}>Check</button>
                            : <button ref={nextRef} type="submit" className="btn primary">Next →</button>}
                    </form>
                )}

                {phase === 'checked' && (
                    <div className={`ex-feedback ${correct ? 'ok' : 'no'}`}>
                        <div className="ex-feedback-head">{correct ? '✓ Correct!' : '✗ Not quite'}</div>
                        {!correct && (
                            <div className="ex-answer-reveal">Answer: <strong>{renderMath(String(problem.answer))}</strong></div>
                        )}
                        {problem.explanation && <div className="ex-explain">{renderMath(problem.explanation)}</div>}
                        {isChoice && (
                            <button className="btn primary" style={{ marginTop: '0.8rem' }} onClick={newProblem}>Next →</button>
                        )}
                    </div>
                )}
            </div>

            <div className="ex-session-foot">
                <button className="btn ghost" onClick={newProblem}>Skip / new problem</button>
                {stat && <button className="btn ghost" onClick={() => onResetSkill(skill.id)}>Reset progress</button>}
            </div>
        </div>
    )
}

// --- catalog + router ------------------------------------------------------
const ExercisesPage = () => {
    const { progress, record, reset } = useProgress()
    const { skillId } = useParams()
    const navigate = useNavigate()
    const [query, setQuery] = useState('')

    const masteredCount = useMemo(
        () => Object.values(progress).filter(p => p.mastered).length,
        [progress]
    )

    const filteredTopics = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return TOPICS
        return TOPICS
            .map(t => ({ ...t, skills: t.skills.filter(s => `${s.title} ${s.desc} ${t.label}`.toLowerCase().includes(q)) }))
            .filter(t => t.skills.length > 0)
    }, [query])

    if (skillId && ALL_SKILLS[skillId]) {
        return (
            <div className="page">
                <PracticeSession
                    key={skillId}
                    skill={ALL_SKILLS[skillId]}
                    stat={progress[skillId]}
                    onRecord={record}
                    onResetSkill={reset}
                    onBack={() => navigate('/exercises')}
                />
            </div>
        )
    }

    return (
        <div className="page">
            <div className="page-head">
                <h1>Exercises</h1>
                <p>Practice any skill from early math to college. Every problem is freshly generated, checked instantly, and explained — get {MASTERY_STREAK} in a row to master a skill. Progress saves on this device.</p>
            </div>

            <div className="ex-overview">
                <div className="ex-overview-stat"><span className="ex-overview-num">{TOTAL_SKILLS}</span> skills</div>
                <div className="ex-overview-stat"><span className="ex-overview-num">{masteredCount}</span> mastered</div>
                <div className="ex-overview-bar"><div style={{ width: `${TOTAL_SKILLS ? (masteredCount / TOTAL_SKILLS) * 100 : 0}%` }} /></div>
            </div>

            <div className="tool-search" style={{ marginBottom: '1.5rem' }}>
                <div className="tool-search-box">
                    <span className="search-icon" aria-hidden="true">🔍</span>
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search skills…  (try “fractions”, “derivative”, “slope”)"
                        aria-label="Search exercises"
                    />
                    {query && <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
                </div>
            </div>

            {filteredTopics.map(topic => (
                <section key={topic.id} className="ex-topic">
                    <div className="ex-topic-head">
                        <span className="ex-topic-icon">{topic.icon}</span>
                        <h2>{topic.label}</h2>
                        <span className="ex-topic-grade">{topic.grade}</span>
                    </div>
                    <div className="ex-skill-grid">
                        {topic.skills.map(skill => {
                            const p = progress[skill.id]
                            return (
                                <button key={skill.id} className="ex-skill-card" onClick={() => navigate(`/exercises/${skill.id}`)}>
                                    <div className="ex-skill-top">
                                        <h3>{skill.title}</h3>
                                        {p?.mastered
                                            ? <span className="ex-badge mastered">✓</span>
                                            : p?.attempts ? <span className="ex-badge">{p.best}/{MASTERY_STREAK}</span> : null}
                                    </div>
                                    <p>{skill.desc}</p>
                                    <span className="ex-skill-go">Practice →</span>
                                </button>
                            )
                        })}
                    </div>
                </section>
            ))}

            {filteredTopics.length === 0 && <p className="no-results">No skills match “{query}”.</p>}
        </div>
    )
}

export default ExercisesPage

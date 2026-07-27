import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GRADES, skillsForGrade, checkAnswer } from '../exercises'
import { renderMath, useProgress, MASTERY_STREAK } from '../exercises/practice.jsx'

/**
 * Personalized Practice — endless, adaptive drilling of whatever you're
 * currently learning.
 *
 * Your grade (set on the Profile page) selects the pool of skills. Each problem
 * is drawn from a skill you haven't mastered yet — so practice naturally stays
 * on the material that still needs work and only broadens once you've mastered
 * everything for the grade. There's no fixed length: keep going as long as you
 * like. Progress feeds the same store as Exercises, so mastery counts agree.
 */

const PROFILE_KEY = 'mathlab-profile'

const loadProfile = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch { return {} }
}
const saveGrade = (grade) => {
    try {
        const next = { ...loadProfile(), grade }
        localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
    } catch { /* ignore */ }
}

const PersonalizedPage = () => {
    const navigate = useNavigate()
    const { progress, record } = useProgress()
    const [gradeId, setGradeId] = useState(() => loadProfile().grade || '')

    const grade = useMemo(() => GRADES.find(g => g.id === gradeId) || null, [gradeId])
    const skills = useMemo(() => (grade ? skillsForGrade(gradeId) : []), [grade, gradeId])

    // Pick the next skill: draw from not-yet-mastered skills so practice hugs
    // the material that needs work; once all are mastered, draw from everything.
    // Avoid immediately repeating the same skill when there's a choice.
    const pickSkill = useCallback((avoidId) => {
        if (!skills.length) return null
        const unmastered = skills.filter(s => !progress[s.id]?.mastered)
        let pool = unmastered.length ? unmastered : skills
        if (pool.length > 1 && avoidId) {
            const trimmed = pool.filter(s => s.id !== avoidId)
            if (trimmed.length) pool = trimmed
        }
        return pool[Math.floor(Math.random() * pool.length)]
    }, [skills, progress])

    const [skill, setSkill] = useState(null)
    const [problem, setProblem] = useState(null)
    const [input, setInput] = useState('')
    const [picked, setPicked] = useState(null)
    const [phase, setPhase] = useState('answering') // 'answering' | 'checked'
    const [correct, setCorrect] = useState(false)
    const [session, setSession] = useState({ correct: 0, total: 0, streak: 0, best: 0 })
    const inputRef = useRef(null)
    const nextRef = useRef(null)

    // Draw a fresh skill + problem. Guard against a misbehaving generator.
    const nextProblem = useCallback(() => {
        const next = pickSkill(skill?.id)
        if (!next) { setSkill(null); setProblem(null); return }
        let made = null
        for (let i = 0; i < 6; i++) {
            try {
                const p = next.generate()
                if (p && p.prompt != null && p.answer != null) { made = p; break }
            } catch { /* retry */ }
        }
        setSkill(next)
        setProblem(made)
        setInput('')
        setPicked(null)
        setPhase('answering')
        setCorrect(false)
    }, [pickSkill, skill])

    // First problem once a grade is chosen (and whenever the grade changes).
    useEffect(() => {
        if (!grade) { setSkill(null); setProblem(null); return }
        nextProblem()
        setSession({ correct: 0, total: 0, streak: 0, best: 0 })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gradeId])

    // Focus the input on each new problem, the Next button after checking.
    useEffect(() => {
        if (phase === 'answering' && inputRef.current) inputRef.current.focus()
        if (phase === 'checked' && nextRef.current) nextRef.current.focus()
    }, [phase, problem])

    const submit = useCallback((value) => {
        if (!problem || phase === 'checked') return
        const isRight = checkAnswer(problem, value)
        setCorrect(isRight)
        setPhase('checked')
        setSession(s => {
            const streak = isRight ? s.streak + 1 : 0
            return { correct: s.correct + (isRight ? 1 : 0), total: s.total + 1, streak, best: Math.max(s.best, streak) }
        })
        record(skill.id, isRight)
    }, [problem, phase, record, skill])

    const changeGrade = (id) => { setGradeId(id); if (id) saveGrade(id) }

    const masteredForGrade = useMemo(
        () => skills.filter(s => progress[s.id]?.mastered).length,
        [skills, progress]
    )

    // --- no grade set yet ---------------------------------------------------
    if (!grade) {
        return (
            <div className="page">
                <div className="page-head">
                    <h1>Personalized Practice</h1>
                    <p>Endless, adaptive practice of what you're learning. Tell us your grade and we'll keep serving fresh problems, focused on the skills you haven't mastered yet.</p>
                </div>
                <div className="panel" style={{ maxWidth: 520 }}>
                    <label className="field">
                        What grade are you in?
                        <select value={gradeId} onChange={(e) => changeGrade(e.target.value)}>
                            <option value="">Select your grade…</option>
                            {GRADES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                        </select>
                    </label>
                    <p className="hint" style={{ marginTop: '0.7rem' }}>
                        Saved to your <button className="linklike" onClick={() => navigate('/profile')}>profile</button> and reused across MathLab.
                    </p>
                </div>
            </div>
        )
    }

    const isChoice = problem?.type === 'choice' && Array.isArray(problem.choices)
    const allMastered = skills.length > 0 && masteredForGrade === skills.length

    return (
        <div className="page pp-page">
            <div className="ex-session">
                <div className="ex-session-head">
                    <button className="btn ghost" onClick={() => navigate('/profile')}>← Profile</button>
                    <div className="pp-titlerow">
                        <h1>Personalized Practice</h1>
                        <label className="pp-grade-switch">
                            <select value={gradeId} onChange={(e) => changeGrade(e.target.value)} aria-label="Change grade">
                                {GRADES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                            </select>
                        </label>
                    </div>
                </div>

                <div className="ex-scorebar">
                    <div className="ex-score"><span className="ex-score-num">{session.streak}</span><span className="ex-score-lbl">🔥 streak</span></div>
                    <div className="ex-score"><span className="ex-score-num">{session.correct}/{session.total}</span><span className="ex-score-lbl">this session</span></div>
                    <div className="ex-score"><span className="ex-score-num">{session.best}</span><span className="ex-score-lbl">best run</span></div>
                    <div className="ex-mastery">
                        <span className="ex-score-lbl">{masteredForGrade}/{skills.length} skills mastered</span>
                        <div className="ex-mastery-bar"><div style={{ width: `${skills.length ? (masteredForGrade / skills.length) * 100 : 0}%` }} /></div>
                    </div>
                </div>

                {allMastered && (
                    <div className="pp-banner">
                        🎉 You've mastered every skill for {grade.label}! Keep going to stay sharp, or bump your grade above.
                    </div>
                )}

                {!problem ? (
                    <div className="ex-card"><p className="hint">Loading a problem…</p></div>
                ) : (
                    <div className="ex-card">
                        <div className="pp-skill-line">{skill.topicLabel} · {skill.title}</div>
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
                                onSubmit={(e) => { e.preventDefault(); if (phase === 'answering') submit(input); else nextProblem() }}
                            >
                                <input
                                    ref={inputRef}
                                    className="ex-input"
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Your answer"
                                    data-keypad="full"
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
                                    <button className="btn primary" style={{ marginTop: '0.8rem' }} onClick={nextProblem}>Next →</button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="ex-session-foot">
                    <button className="btn ghost" onClick={nextProblem}>Skip / new problem</button>
                    <button className="btn ghost" onClick={() => navigate('/exercises')}>Browse all exercises →</button>
                </div>
            </div>
        </div>
    )
}

export default PersonalizedPage

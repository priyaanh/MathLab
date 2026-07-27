import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL_SKILLS, TOPICS, TOTAL_SKILLS } from '../exercises'

/**
 * Profile — a local identity + a safety net for progress.
 *
 * Everything MathLab remembers (exercise progress, your name, tab/tool order,
 * theme) lives in this browser's localStorage. This page lets you:
 *   - set a display name,
 *   - see your practice stats at a glance,
 *   - export a backup file and import it back (so switching browsers or
 *     clearing site data doesn't wipe your progress),
 *   - reset progress deliberately.
 *
 * No account, no server — the backup file is the portable copy.
 */

const PROFILE_KEY = 'mathlab-profile'
const PROGRESS_KEY = 'mathlab-exercise-progress'
const MASTERY_STREAK = 5
// How many "practice next" skills to surface on the plan.
const PLAN_SIZE = 6

// Each grade maps to the exercise topics that fit it, most-relevant first. A
// little overlap with the year below builds in review. `topics` are TOPIC ids
// from ../exercises; keep them in sync if topic ids ever change.
const GRADES = [
    { id: 'k2', label: 'Kindergarten – Grade 2', topics: ['early'] },
    { id: '3-5', label: 'Grades 3–5 (Elementary)', topics: ['elementary', 'early'] },
    { id: '6-8', label: 'Grades 6–8 (Middle school)', topics: ['prealgebra', 'elementary'] },
    { id: '9', label: 'Grade 9 — Algebra 1', topics: ['algebra1', 'prealgebra'] },
    { id: '10', label: 'Grade 10 — Geometry', topics: ['geometry', 'algebra1'] },
    { id: '11', label: 'Grade 11 — Algebra 2 & Trig', topics: ['algebra2', 'geometry'] },
    { id: '12', label: 'Grade 12 — Precalculus', topics: ['precalc', 'algebra2'] },
    { id: 'college', label: 'College / AP', topics: ['calculus', 'statistics', 'precalc'] }
]

// Keys we back up. We deliberately never export an API key.
const BACKUP_PREFIX = 'mathlab-'
const BACKUP_EXCLUDE = new Set(['mathlab-anthropic-key'])

// Always hand back a plain object. Stored data can be malformed — e.g. the
// literal string "null", an array, or a primitive (a bad import can write
// these) — and JSON.parse would then yield null/array/number, crashing the
// page on `profile.name` / `Object.entries(progress)`.
const loadObject = (key) => {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch { return {} }
}
const loadProfile = () => loadObject(PROFILE_KEY)
const loadProgress = () => loadObject(PROGRESS_KEY)

const collectBackup = () => {
    const data = {}
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(BACKUP_PREFIX) && !BACKUP_EXCLUDE.has(k)) {
            data[k] = localStorage.getItem(k)
        }
    }
    return { app: 'MathLab', version: 1, exportedAt: new Date().toISOString(), data }
}

const ProfilePage = () => {
    const [profile, setProfile] = useState(loadProfile)
    const [progress, setProgress] = useState(loadProgress)
    const [flash, setFlash] = useState('')
    const fileRef = useRef(null)
    const navigate = useNavigate()

    // Persist a single profile field, keeping the rest intact.
    const patchProfile = (patch) => {
        const next = { ...profile, ...patch }
        setProfile(next)
        try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    }
    const setName = (name) => patchProfile({ name })
    const setGrade = (grade) => patchProfile({ grade })

    const grade = useMemo(() => GRADES.find(g => g.id === profile.grade) || null, [profile.grade])

    // A personalized plan: grade-appropriate skills ranked by what needs work.
    // New skills come first, then in-progress, then mastered — and within each,
    // topics stay in the grade's most-relevant-first order.
    const plan = useMemo(() => {
        if (!grade) return null
        const topics = grade.topics
            .map(id => TOPICS.find(t => t.id === id))
            .filter(Boolean)
        const ranked = []
        topics.forEach((topic, ti) => {
            topic.skills.forEach(skill => {
                const p = progress[skill.id]
                const rank = p?.mastered ? 2 : p?.attempts ? 1 : 0
                ranked.push({ skill, topic, rank, order: ti })
            })
        })
        ranked.sort((a, b) => a.rank - b.rank || a.order - b.order)
        const total = ranked.length
        const mastered = ranked.filter(r => r.rank === 2).length
        return { topics, next: ranked.slice(0, PLAN_SIZE), total, mastered }
    }, [grade, progress])

    const stats = useMemo(() => {
        const entries = Object.entries(progress)
        let mastered = 0, attempts = 0, correct = 0, best = 0
        const byTopic = {}
        for (const [id, s] of entries) {
            if (!s) continue
            attempts += s.attempts || 0
            correct += s.correct || 0
            best = Math.max(best, s.best || 0)
            if (s.mastered) mastered++
            const topic = ALL_SKILLS[id]?.topicLabel || 'Other'
            byTopic[topic] = byTopic[topic] || { practiced: 0, mastered: 0 }
            byTopic[topic].practiced++
            if (s.mastered) byTopic[topic].mastered++
        }
        const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0
        return { practiced: entries.length, mastered, attempts, correct, best, accuracy, byTopic }
    }, [progress])

    const flashMsg = (m) => { setFlash(m); setTimeout(() => setFlash(''), 2500) }

    const exportBackup = () => {
        const blob = new Blob([JSON.stringify(collectBackup(), null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const stamp = new Date().toISOString().slice(0, 10)
        a.href = url
        a.download = `mathlab-backup-${stamp}.json`
        a.click()
        URL.revokeObjectURL(url)
        flashMsg('Backup downloaded ✓')
    }

    const importBackup = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result))
                if (parsed?.app !== 'MathLab' || typeof parsed.data !== 'object') {
                    throw new Error('not a MathLab backup')
                }
                Object.entries(parsed.data).forEach(([k, v]) => {
                    if (k.startsWith(BACKUP_PREFIX) && !BACKUP_EXCLUDE.has(k)) {
                        localStorage.setItem(k, String(v))
                    }
                })
                setProfile(loadProfile())
                setProgress(loadProgress())
                flashMsg('Backup restored ✓ — reloading…')
                setTimeout(() => window.location.reload(), 800)
            } catch {
                flashMsg("That file isn't a MathLab backup.")
            }
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    const resetProgress = () => {
        if (!window.confirm('Erase all exercise progress on this device? This cannot be undone (export a backup first).')) return
        try { localStorage.removeItem(PROGRESS_KEY) } catch { /* ignore */ }
        setProgress({})
        flashMsg('Progress reset.')
    }

    const greeting = profile.name ? `Hi, ${profile.name}` : 'Your profile'

    return (
        <div className="page">
            <div className="page-head">
                <h1>{greeting}</h1>
                <p>Your progress is saved in this browser. Back it up so you never lose it — and restore it anywhere.</p>
            </div>

            <div className="profile-grid">
                <div className="panel">
                    <h2>You</h2>
                    <label className="field">
                        Display name
                        <input
                            type="text"
                            value={profile.name || ''}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. John"
                            maxLength={40}
                        />
                    </label>
                    <p className="hint" style={{ marginTop: '0.6rem' }}>
                        Shown at the top of this page. Stored only on this device.
                    </p>

                    <label className="field" style={{ marginTop: '1.1rem' }}>
                        What grade are you in?
                        <select value={profile.grade || ''} onChange={(e) => setGrade(e.target.value)}>
                            <option value="">Select your grade…</option>
                            {GRADES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                        </select>
                    </label>
                    <p className="hint" style={{ marginTop: '0.6rem' }}>
                        Builds a practice plan tuned to your grade below.
                    </p>

                    <h2 style={{ marginTop: '1.4rem' }}>Keep your progress safe</h2>
                    <div className="profile-actions">
                        <button className="btn primary" onClick={exportBackup}>⬇ Export backup</button>
                        <button className="btn ghost" onClick={() => fileRef.current?.click()}>⬆ Import backup</button>
                        <input ref={fileRef} type="file" accept="application/json,.json" onChange={importBackup} style={{ display: 'none' }} />
                    </div>
                    <p className="hint" style={{ marginTop: '0.6rem' }}>
                        The backup is a small JSON file with your progress, name, and preferences (never any API key).
                        Import it on a new browser or after clearing site data.
                    </p>

                    <button className="btn ghost" style={{ marginTop: '1rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={resetProgress}>
                        Reset progress
                    </button>

                    {flash && <div className="hint" style={{ marginTop: '0.8rem', color: 'var(--success)' }}>{flash}</div>}
                </div>

                <div className="panel">
                    <h2>Practice stats</h2>
                    <div className="stat-grid">
                        <div className="stat"><div className="label">Skills mastered</div><div className="value">{stats.mastered} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ {TOTAL_SKILLS}</span></div></div>
                        <div className="stat"><div className="label">Skills practiced</div><div className="value">{stats.practiced}</div></div>
                        <div className="stat"><div className="label">Best streak</div><div className="value">🔥 {stats.best}</div></div>
                        <div className="stat"><div className="label">Accuracy</div><div className="value">{stats.accuracy}%</div></div>
                        <div className="stat"><div className="label">Questions answered</div><div className="value">{stats.attempts}</div></div>
                        <div className="stat"><div className="label">Correct</div><div className="value">{stats.correct}</div></div>
                    </div>

                    <h2 style={{ marginTop: '1.4rem' }}>By topic</h2>
                    {stats.practiced === 0 ? (
                        <p className="hint">No practice yet. Head to <strong>Exercises</strong> to get started — mastering a skill takes {MASTERY_STREAK} correct in a row.</p>
                    ) : (
                        <div className="profile-topics">
                            {TOPICS.filter(t => stats.byTopic[t.label]).map(t => {
                                const b = stats.byTopic[t.label]
                                const pct = b.practiced ? Math.round((b.mastered / b.practiced) * 100) : 0
                                return (
                                    <div key={t.id} className="profile-topic">
                                        <div className="profile-topic-head">
                                            <span>{t.icon} {t.label}</span>
                                            <span>{b.mastered}/{b.practiced} mastered</span>
                                        </div>
                                        <div className="profile-topic-bar"><div style={{ width: `${pct}%` }} /></div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="panel plan-panel">
                <div className="plan-head">
                    <h2>Your practice plan</h2>
                    {grade && <span className="plan-grade">{grade.label}</span>}
                </div>

                {!grade ? (
                    <p className="hint">
                        Pick your grade under <strong>You</strong> and we'll build a personalized set of
                        skills to practice — matched to your level and ordered by what needs work.
                    </p>
                ) : (
                    <>
                        <p className="hint" style={{ marginBottom: '1rem' }}>
                            {plan.mastered} of {plan.total} skills mastered for {grade.label.split('—')[0].trim()}.
                            Start with these — new skills first, then ones still in progress.
                        </p>

                        <div className="plan-next">
                            {plan.next.map(({ skill, topic, rank }) => (
                                <button
                                    key={skill.id}
                                    className="plan-skill"
                                    onClick={() => navigate(`/exercises/${skill.id}`)}
                                >
                                    <div className="plan-skill-top">
                                        <span className="plan-skill-topic">{topic.icon} {topic.label}</span>
                                        <span className={`plan-tag r${rank}`}>
                                            {rank === 2 ? '✓ Mastered' : rank === 1 ? 'In progress' : 'New'}
                                        </span>
                                    </div>
                                    <h3>{skill.title}</h3>
                                    <p>{skill.desc}</p>
                                    <span className="plan-skill-go">Practice →</span>
                                </button>
                            ))}
                        </div>

                        <div className="plan-topics">
                            <span className="hint">Or explore a whole area:</span>
                            {plan.topics.map(t => (
                                <button key={t.id} className="btn ghost" onClick={() => navigate('/exercises')}>
                                    {t.icon} {t.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default ProfilePage

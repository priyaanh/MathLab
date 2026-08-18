import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL_SKILLS, TOPICS, TOTAL_SKILLS, GRADES } from '../exercises'
import { evaluateAchievements } from '../utils/achievements'
import { loadActivity, currentStreak, longestStreak, recentDays, setGoal as persistGoal } from '../utils/activity'
import { useSession } from '../profile/SessionContext'
import ProfileAuth from '../components/ProfileAuth'
import ProfileAccountPanel from '../components/ProfileAccountPanel'

/**
 * Profile — a local identity and progress hub.
 *
 * Everything MathLab remembers (exercise progress, name, grade, streak,
 * tab/tool order, theme) lives entirely in this browser's localStorage — no
 * server is involved.
 *
 * The page is locked behind a profile. Signing in swaps the shared progress keys
 * to that account's decrypted data, so the rest of the site keeps reading the
 * same keys and needs to know nothing about accounts.
 */

const PROFILE_KEY = 'mathlab-profile'
const PROGRESS_KEY = 'mathlab-exercise-progress'
const MASTERY_STREAK = 5
// How many "practice next" skills to surface on the plan.
const PLAN_SIZE = 6

// Always hand back a plain object. Stored data can be malformed — e.g. the
// literal string "null", an array, or a primitive — and JSON.parse would then
// yield null/array/number, crashing the page on `profile.name` /
// `Object.entries(progress)`.
const loadObject = (key) => {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch { return {} }
}
const loadProfile = () => loadObject(PROFILE_KEY)
const loadProgress = () => loadObject(PROGRESS_KEY)

const ProfilePage = () => {
    const { session, signIn } = useSession()

    // Nothing below is meaningful without an unlocked profile — and the shared
    // keys still hold the signed-out data until one is opened.
    if (!session) return <ProfileAuth onSession={(s, meta) => signIn(s, meta)} />
    return <ProfileBody key={session.key} />
}

const ProfileBody = () => {
    const { session, signOut } = useSession()
    const [profile, setProfile] = useState(loadProfile)
    const [progress, setProgress] = useState(loadProgress)
    const [activity, setActivity] = useState(loadActivity)
    const [flash, setFlash] = useState('')
    const navigate = useNavigate()

    // Practice happens on other pages, so re-read on mount rather than trusting
    // the state this component was first constructed with.
    useEffect(() => {
        setProfile(loadProfile())
        setProgress(loadProgress())
        setActivity(loadActivity())
    }, [])

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

    const dayStreak = useMemo(() => currentStreak(activity.days), [activity])
    const bestDayStreak = useMemo(() => longestStreak(activity.days), [activity])
    const calendar = useMemo(() => recentDays(activity.days, 35), [activity])
    const achievements = useMemo(() => evaluateAchievements(progress, dayStreak), [progress, dayStreak])
    const earnedCount = achievements.filter(a => a.earned).length
    const changeGoal = (g) => setActivity(persistGoal(g))

    const flashMsg = (m) => { setFlash(m); setTimeout(() => setFlash(''), 2500) }

    const resetProgress = () => {
        if (!window.confirm('Erase all exercise progress on this device? This cannot be undone.')) return
        try { localStorage.removeItem(PROGRESS_KEY) } catch { /* ignore */ }
        setProgress({})
        flashMsg('Progress reset.')
    }

    const displayName = profile.name || session.display
    const greeting = `Hi, ${displayName}`
    const initials = String(displayName).trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

    return (
        <div className="page">
            <div className="profile-bar">
                <div className="profile-id">
                    <span className="profile-avatar" aria-hidden="true">{initials}</span>
                    <span className="profile-id-text">
                        <b>{displayName}</b>
                        <span className="profile-id-sub">
                            <span className="profile-lock" aria-hidden="true">🔒</span>
                            Unlocked · signed in as {session.display}
                        </span>
                    </span>
                </div>
                <button className="btn ghost" onClick={() => signOut()}>Lock &amp; sign out</button>
            </div>

            <div className="page-head">
                <h1>{greeting}</h1>
                <p>Your progress is encrypted under your password and saved in this browser. Back it up so you never lose it.</p>
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

                    <p className="hint" style={{ marginTop: '1.4rem' }}>
                        Everything MathLab remembers — your name, grade, practice progress,
                        streak and preferences — is saved right here in this browser.
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

                    <button className="btn primary" style={{ marginTop: '1.1rem', width: '100%' }} onClick={() => navigate('/practice')}>
                        ∞ Start unlimited practice
                    </button>
                    <p className="hint" style={{ marginTop: '0.5rem' }}>
                        Endless, adaptive practice tuned to your grade — keeps serving the skills you haven't mastered yet.
                    </p>

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

            <div className="panel">
                <div className="plan-head">
                    <h2>Streak &amp; daily goal</h2>
                    <span className="plan-grade">🔥 {dayStreak}-day streak</span>
                </div>

                <div className="streak-row">
                    <div className="streak-stat"><div className="value">🔥 {dayStreak}</div><div className="label">current streak</div></div>
                    <div className="streak-stat"><div className="value">🏅 {bestDayStreak}</div><div className="label">longest streak</div></div>
                    <label className="field streak-goal">
                        Daily goal (problems)
                        <input
                            type="number" min="1" max="200"
                            value={activity.goal}
                            onChange={(e) => changeGoal(Number(e.target.value))}
                        />
                    </label>
                </div>

                <div className="cal-strip" role="img" aria-label="Practice over the last 5 weeks">
                    {calendar.map(d => {
                        const lvl = d.count === 0 ? 0 : d.count >= activity.goal ? 3 : d.count >= Math.ceil(activity.goal / 2) ? 2 : 1
                        return <span key={d.key} className={`cal-cell lvl${lvl}`} title={`${d.key}: ${d.count} answered`} />
                    })}
                </div>
                <p className="hint" style={{ marginTop: '0.6rem' }}>Last 5 weeks — brighter days mean more practice. Practice any day to keep your streak alive.</p>
            </div>

            <div className="panel">
                <div className="plan-head">
                    <h2>Achievements</h2>
                    <span className="plan-grade">{earnedCount}/{achievements.length} unlocked</span>
                </div>
                <div className="badge-grid">
                    {achievements.map(a => (
                        <div key={a.id} className={`badge ${a.earned ? `earned ${a.tier}` : 'locked'}`}>
                            <span className="badge-icon">{a.icon}</span>
                            <div className="badge-body">
                                <div className="badge-title">{a.title}</div>
                                <div className="badge-desc">{a.desc}</div>
                                {!a.earned && a.progress.need > 1 && (
                                    <div className="badge-bar"><div style={{ width: `${(a.progress.have / a.progress.need) * 100}%` }} /></div>
                                )}
                            </div>
                            {a.earned && <span className="badge-check">✓</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Account management sits last, the way settings usually do — the
                identity and the way out are already up in the profile bar. */}
            <ProfileAccountPanel onFlash={flashMsg} />
        </div>
    )
}

export default ProfilePage

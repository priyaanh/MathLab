import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { GRADES, skillsForGrade } from '../exercises'
import { loadProgress } from '../exercises/practice.jsx'
import { loadActivity, currentStreak, todayCount } from '../utils/activity'

/**
 * A personalized welcome band on the home page. It only renders once there's
 * something to show (a name, a grade, or some practice), so first-time
 * visitors still get the clean hero. Reads localStorage directly — the home
 * page is otherwise static, and this data rarely changes mid-visit.
 */

const loadProfile = () => {
    try {
        const p = JSON.parse(localStorage.getItem('mathlab-profile') || '{}')
        return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
    } catch { return {} }
}

// A compact circular progress ring (today's answers toward the daily goal).
const GoalRing = ({ value, goal }) => {
    const pct = goal ? Math.min(1, value / goal) : 0
    const r = 30
    const circ = 2 * Math.PI * r
    const done = value >= goal && goal > 0
    return (
        <svg className="goal-ring" width="76" height="76" viewBox="0 0 76 76" role="img"
            aria-label={`${value} of ${goal} today`}>
            <circle cx="38" cy="38" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
            <circle
                cx="38" cy="38" r={r} fill="none"
                stroke={done ? 'var(--success)' : 'var(--accent)'} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
                transform="rotate(-90 38 38)"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <text x="38" y="35" textAnchor="middle" className="goal-ring-num">{value}</text>
            <text x="38" y="50" textAnchor="middle" className="goal-ring-den">/ {goal}</text>
        </svg>
    )
}

const HomeDashboard = () => {
    const { profile, progress, activity } = useMemo(() => ({
        profile: loadProfile(),
        progress: loadProgress(),
        activity: loadActivity()
    }), [])

    const mastered = useMemo(
        () => Object.values(progress).filter(p => p?.mastered).length,
        [progress]
    )
    const streak = currentStreak(activity.days)
    const today = todayCount(activity.days)
    const grade = GRADES.find(g => g.id === profile.grade) || null

    // Up to three grade-appropriate skills that still need work.
    const recommended = useMemo(() => {
        if (!grade) return []
        return skillsForGrade(profile.grade)
            .filter(s => !progress[s.id]?.mastered)
            .slice(0, 3)
    }, [grade, profile.grade, progress])

    const hasHistory = mastered > 0 || today > 0 || streak > 0 || Object.keys(progress).length > 0
    // Nothing personal to show yet — let the hero stand alone.
    if (!profile.name && !grade && !hasHistory) return null

    return (
        <section className="home-dash">
            <div className="home-dash-main">
                <div className="home-dash-greet">
                    <h2>{profile.name ? `Welcome back, ${profile.name}` : 'Welcome back'}</h2>
                    <p>{grade ? `Practicing ${grade.label}` : 'Set your grade to get a tailored plan'}</p>
                </div>
                <div className="home-dash-actions">
                    <Link to={grade ? '/practice' : '/profile'} className="btn primary">
                        {grade ? '∞ Continue practicing' : 'Set your grade →'}
                    </Link>
                    <Link to="/exercises" className="btn ghost">Browse exercises</Link>
                </div>
            </div>

            <div className="home-dash-stats">
                <div className="home-dash-goal">
                    <GoalRing value={today} goal={activity.goal} />
                    <span className="home-dash-goal-lbl">Today's goal</span>
                </div>
                <div className="home-dash-metric">
                    <span className="home-dash-metric-num">🔥 {streak}</span>
                    <span className="home-dash-metric-lbl">day streak</span>
                </div>
                <div className="home-dash-metric">
                    <span className="home-dash-metric-num">⭐ {mastered}</span>
                    <span className="home-dash-metric-lbl">skills mastered</span>
                </div>
            </div>

            {recommended.length > 0 && (
                <div className="home-dash-recos">
                    <span className="home-dash-recos-lbl">Pick up where you left off:</span>
                    {recommended.map(s => (
                        <Link key={s.id} to={`/exercises/${s.id}`} className="home-dash-chip">
                            {s.title}
                        </Link>
                    ))}
                </div>
            )}
        </section>
    )
}

export default HomeDashboard

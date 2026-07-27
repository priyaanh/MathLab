/**
 * Daily practice activity — a lightweight per-day counter used for the streak,
 * the daily-goal ring and the activity calendar. Kept separate from per-skill
 * progress so it can grow (heatmap, goals) without touching mastery data.
 *
 * Store shape (localStorage `mathlab-activity`):
 *   { days: { 'YYYY-MM-DD': <answers that day> }, goal: <daily target> }
 */

const ACTIVITY_KEY = 'mathlab-activity'
const DEFAULT_GOAL = 10

// Local calendar date (not UTC) so "today" matches the user's clock.
export const dateKey = (d = new Date()) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export const loadActivity = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '{}')
        const days = parsed && typeof parsed.days === 'object' && !Array.isArray(parsed.days) ? parsed.days : {}
        const goal = Number.isFinite(parsed?.goal) && parsed.goal > 0 ? parsed.goal : DEFAULT_GOAL
        return { days, goal }
    } catch {
        return { days: {}, goal: DEFAULT_GOAL }
    }
}

const save = (state) => {
    try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

// Bump today's count by one. Returns the new state (handy for React updates).
export const recordActivity = (n = 1) => {
    const state = loadActivity()
    const key = dateKey()
    state.days[key] = (state.days[key] || 0) + n
    save(state)
    return state
}

export const setGoal = (goal) => {
    const state = loadActivity()
    state.goal = Math.max(1, Math.round(goal) || DEFAULT_GOAL)
    save(state)
    return state
}

// Consecutive days ending today (or yesterday, so a not-yet-practiced today
// doesn't instantly break a streak) with at least one answer.
export const currentStreak = (days) => {
    if (!days) return 0
    let streak = 0
    const cursor = new Date()
    // Allow the streak to "hold" through today even before practicing.
    if (!days[dateKey(cursor)]) cursor.setDate(cursor.getDate() - 1)
    while (days[dateKey(cursor)]) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
    }
    return streak
}

export const longestStreak = (days) => {
    const keys = Object.keys(days || {}).filter(k => days[k] > 0).sort()
    let best = 0, run = 0, prev = null
    for (const k of keys) {
        if (prev) {
            const gap = (new Date(k) - new Date(prev)) / 86400000
            run = gap === 1 ? run + 1 : 1
        } else {
            run = 1
        }
        best = Math.max(best, run)
        prev = k
    }
    return best
}

export const todayCount = (days) => (days ? days[dateKey()] || 0 : 0)

export const totalAnswered = (days) =>
    Object.values(days || {}).reduce((sum, n) => sum + (n || 0), 0)

// The last `n` calendar days (oldest → newest) as { key, date, count } for a
// heatmap/calendar strip.
export const recentDays = (days, n = 35) => {
    const out = []
    const cursor = new Date()
    cursor.setDate(cursor.getDate() - (n - 1))
    for (let i = 0; i < n; i++) {
        const key = dateKey(cursor)
        out.push({ key, count: days?.[key] || 0, dow: cursor.getDay() })
        cursor.setDate(cursor.getDate() + 1)
    }
    return out
}

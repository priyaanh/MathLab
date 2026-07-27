/**
 * Achievement badges — pure functions over the practice progress map, the
 * derived stats, and the activity log. No storage of its own: badges are
 * recomputed from source data so they can never drift out of sync.
 *
 * Each badge: { id, icon, title, desc, tier, earned, progress: {have, need} }.
 * `tier` drives the badge colour (bronze / silver / gold).
 */

import { ALL_SKILLS, TOPICS } from '../exercises'

// have/need let the UI show a progress bar on locked badges.
const bar = (have, need) => ({ have: Math.min(have, need), need })

// Each definition returns { earned, have, need } from the supplied context.
const DEFS = [
    { id: 'first-steps', icon: '👣', title: 'First steps', desc: 'Answer your first problem', tier: 'bronze',
      calc: ({ attempts }) => ({ earned: attempts >= 1, ...bar(attempts, 1) }) },
    { id: 'warming-up', icon: '🔥', title: 'Warming up', desc: 'Answer 25 problems', tier: 'bronze',
      calc: ({ attempts }) => ({ earned: attempts >= 25, ...bar(attempts, 25) }) },
    { id: 'century', icon: '💯', title: 'Century', desc: 'Answer 100 problems', tier: 'silver',
      calc: ({ attempts }) => ({ earned: attempts >= 100, ...bar(attempts, 100) }) },
    { id: 'marathon', icon: '🏃', title: 'Marathon', desc: 'Answer 500 problems', tier: 'gold',
      calc: ({ attempts }) => ({ earned: attempts >= 500, ...bar(attempts, 500) }) },

    { id: 'first-mastery', icon: '⭐', title: 'First mastery', desc: 'Master your first skill', tier: 'bronze',
      calc: ({ mastered }) => ({ earned: mastered >= 1, ...bar(mastered, 1) }) },
    { id: 'skill-collector', icon: '🎖️', title: 'Skill collector', desc: 'Master 10 skills', tier: 'silver',
      calc: ({ mastered }) => ({ earned: mastered >= 10, ...bar(mastered, 10) }) },
    { id: 'grandmaster', icon: '🏆', title: 'Grandmaster', desc: 'Master 30 skills', tier: 'gold',
      calc: ({ mastered }) => ({ earned: mastered >= 30, ...bar(mastered, 30) }) },
    { id: 'topic-master', icon: '📚', title: 'Topic master', desc: 'Master every skill in one topic', tier: 'gold',
      calc: ({ topicFull }) => ({ earned: topicFull >= 1, ...bar(topicFull, 1) }) },

    { id: 'sharp', icon: '🎯', title: 'Sharpshooter', desc: '90%+ accuracy over 20+ answers', tier: 'silver',
      calc: ({ accuracy, attempts }) => ({ earned: attempts >= 20 && accuracy >= 90, ...bar(attempts >= 20 ? accuracy : 0, 90) }) },
    { id: 'streak-10', icon: '⚡', title: 'On fire', desc: 'Get a 10-in-a-row streak', tier: 'silver',
      calc: ({ bestStreak }) => ({ earned: bestStreak >= 10, ...bar(bestStreak, 10) }) },

    { id: 'daily-3', icon: '📅', title: 'Habit forming', desc: 'Practice 3 days in a row', tier: 'bronze',
      calc: ({ dayStreak }) => ({ earned: dayStreak >= 3, ...bar(dayStreak, 3) }) },
    { id: 'daily-7', icon: '🗓️', title: 'Week warrior', desc: 'Practice 7 days in a row', tier: 'silver',
      calc: ({ dayStreak }) => ({ earned: dayStreak >= 7, ...bar(dayStreak, 7) }) },
    { id: 'daily-30', icon: '👑', title: 'Unstoppable', desc: 'Practice 30 days in a row', tier: 'gold',
      calc: ({ dayStreak }) => ({ earned: dayStreak >= 30, ...bar(dayStreak, 30) }) }
]

// Build the context the badge calcs need from raw progress + activity.
export const buildContext = (progress, dayStreak = 0) => {
    let attempts = 0, correct = 0, mastered = 0, bestStreak = 0
    const topicCounts = {}
    for (const id of Object.keys(progress || {})) {
        const s = progress[id]
        if (!s) continue
        attempts += s.attempts || 0
        correct += s.correct || 0
        bestStreak = Math.max(bestStreak, s.best || 0)
        if (s.mastered) {
            mastered++
            const tid = ALL_SKILLS[id]?.topicId
            if (tid) topicCounts[tid] = (topicCounts[tid] || 0) + 1
        }
    }
    // How many topics have every one of their skills mastered.
    const topicFull = TOPICS.filter(t => t.skills.length > 0 && (topicCounts[t.id] || 0) >= t.skills.length).length
    const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0
    return { attempts, correct, mastered, bestStreak, accuracy, topicFull, dayStreak }
}

// Full badge list with earned/progress resolved, earned ones first.
export const evaluateAchievements = (progress, dayStreak = 0) => {
    const ctx = buildContext(progress, dayStreak)
    const badges = DEFS.map(d => {
        const { earned, have, need } = d.calc(ctx)
        return { id: d.id, icon: d.icon, title: d.title, desc: d.desc, tier: d.tier, earned, progress: { have, need } }
    })
    badges.sort((a, b) => (b.earned - a.earned) || (b.progress.have / b.progress.need - a.progress.have / a.progress.need))
    return badges
}

import { useState, useEffect, useCallback } from 'react'
import { recordActivity } from '../utils/activity'

/**
 * Shared practice plumbing used by the Exercises catalog and the Personalized
 * Practice page: one source of truth for how progress is stored and scored, so
 * mastery counts stay identical everywhere.
 */

export const PROGRESS_KEY = 'mathlab-exercise-progress'
export const MASTERY_STREAK = 5 // correct-in-a-row to "master" a skill

// Render "x^2" style exponents as real superscripts; everything else verbatim.
export const renderMath = (text) => {
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

export const loadProgress = () => {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY)
        const parsed = raw ? JSON.parse(raw) : {}
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
        return {}
    }
}

// Progress state persisted to localStorage, with a recorder that also maintains
// streak / best-streak / mastered flags.
export const useProgress = () => {
    const [progress, setProgress] = useState(loadProgress)

    useEffect(() => {
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)) } catch { /* ignore */ }
    }, [progress])

    const record = useCallback((skillId, correct) => {
        // Log a daily-activity tick for every answer (feeds streak + goal ring).
        recordActivity(1)
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

/**
 * Aggregates every grade-band generator module into an ordered topic catalog
 * and a flat skill lookup. Each band module default-exports an array of skills.
 */
import earlyMath from './earlyMath.js'
import elementary from './elementary.js'
import prealgebra from './prealgebra.js'
import algebra1 from './algebra1.js'
import geometry from './geometry.js'
import algebra2 from './algebra2.js'
import precalc from './precalc.js'
import calculus from './calculus.js'
import statistics from './statistics.js'

export { checkAnswer } from './helpers.js'

// Ordered from earliest grades to college.
export const TOPICS = [
    { id: 'early', label: 'Early Math', grade: 'Grades K–2', icon: '🔢', skills: earlyMath || [] },
    { id: 'elementary', label: 'Elementary', grade: 'Grades 3–5', icon: '✏️', skills: elementary || [] },
    { id: 'prealgebra', label: 'Pre-Algebra', grade: 'Grades 6–8', icon: '📐', skills: prealgebra || [] },
    { id: 'algebra1', label: 'Algebra 1', grade: 'High school', icon: '🧮', skills: algebra1 || [] },
    { id: 'geometry', label: 'Geometry', grade: 'High school', icon: '📏', skills: geometry || [] },
    { id: 'algebra2', label: 'Algebra 2 & Trig', grade: 'High school', icon: '📊', skills: algebra2 || [] },
    { id: 'precalc', label: 'Precalculus', grade: 'High school', icon: '🌀', skills: precalc || [] },
    { id: 'calculus', label: 'Calculus', grade: 'AP / College', icon: '∫', skills: calculus || [] },
    { id: 'statistics', label: 'Statistics & Probability', grade: 'AP / College', icon: '🎲', skills: statistics || [] }
]

// Flat lookup: skillId -> skill (annotated with its topic).
export const ALL_SKILLS = {}
TOPICS.forEach(topic => {
    topic.skills.forEach(skill => {
        ALL_SKILLS[skill.id] = { ...skill, topicId: topic.id, topicLabel: topic.label }
    })
})

export const TOTAL_SKILLS = Object.keys(ALL_SKILLS).length

// Grade → the topics that fit it, most-relevant first. A little overlap with
// the year below builds in review. Shared by the Profile plan and the
// Personalized Practice page.
export const GRADES = [
    { id: 'k2', label: 'Kindergarten – Grade 2', topics: ['early'] },
    { id: '3-5', label: 'Grades 3–5 (Elementary)', topics: ['elementary', 'early'] },
    { id: '6-8', label: 'Grades 6–8 (Middle school)', topics: ['prealgebra', 'elementary'] },
    { id: '9', label: 'Grade 9 — Algebra 1', topics: ['algebra1', 'prealgebra'] },
    { id: '10', label: 'Grade 10 — Geometry', topics: ['geometry', 'algebra1'] },
    { id: '11', label: 'Grade 11 — Algebra 2 & Trig', topics: ['algebra2', 'geometry'] },
    { id: '12', label: 'Grade 12 — Precalculus', topics: ['precalc', 'algebra2'] },
    { id: 'college', label: 'College / AP', topics: ['calculus', 'statistics', 'precalc'] }
]

export const gradeById = (id) => GRADES.find(g => g.id === id) || null

// The topic objects a grade covers, in the grade's relevance order.
export const topicsForGrade = (id) => {
    const g = gradeById(id)
    if (!g) return []
    return g.topics.map(tid => TOPICS.find(t => t.id === tid)).filter(Boolean)
}

// Every skill a grade covers (annotated with topicId/topicLabel via ALL_SKILLS).
export const skillsForGrade = (id) =>
    topicsForGrade(id).flatMap(t => t.skills.map(s => ALL_SKILLS[s.id]))

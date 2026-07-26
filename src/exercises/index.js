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

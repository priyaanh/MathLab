/**
 * Aggregates every grade / course generator module into an ordered topic
 * catalog and a flat skill lookup. Each module default-exports an array of
 * skills. Organized to mirror a K-8 → high-school → college progression.
 */
import gradeK from './gradeK.js'
import grade1 from './grade1.js'
import grade2 from './grade2.js'
import grade3 from './grade3.js'
import grade4 from './grade4.js'
import grade5 from './grade5.js'
import grade6 from './grade6.js'
import grade7 from './grade7.js'
import grade8 from './grade8.js'
import algebra1 from './algebra1.js'
import geometry from './geometry.js'
import algebra2 from './algebra2.js'
import trigonometry from './trigonometry.js'
import precalc from './precalc.js'
import collegeAlgebra from './collegeAlgebra.js'
import statistics from './statistics.js'
import calculus from './calculus.js'
import calculusBC from './calculusBC.js'
import multivariable from './multivariable.js'
import diffeq from './diffeq.js'
import linearAlgebra from './linearAlgebra.js'

export { checkAnswer } from './helpers.js'

// Ordered from earliest grades to college. `grade` is a display sub-label.
export const TOPICS = [
    { id: 'gradeK', label: 'Kindergarten', grade: 'Kindergarten', icon: '🧸', skills: gradeK || [] },
    { id: 'grade1', label: '1st Grade', grade: 'Grade 1', icon: '1️⃣', skills: grade1 || [] },
    { id: 'grade2', label: '2nd Grade', grade: 'Grade 2', icon: '2️⃣', skills: grade2 || [] },
    { id: 'grade3', label: '3rd Grade', grade: 'Grade 3', icon: '3️⃣', skills: grade3 || [] },
    { id: 'grade4', label: '4th Grade', grade: 'Grade 4', icon: '4️⃣', skills: grade4 || [] },
    { id: 'grade5', label: '5th Grade', grade: 'Grade 5', icon: '5️⃣', skills: grade5 || [] },
    { id: 'grade6', label: '6th Grade', grade: 'Grade 6', icon: '6️⃣', skills: grade6 || [] },
    { id: 'grade7', label: '7th Grade', grade: 'Grade 7', icon: '7️⃣', skills: grade7 || [] },
    { id: 'grade8', label: '8th Grade', grade: 'Grade 8', icon: '8️⃣', skills: grade8 || [] },
    { id: 'algebra1', label: 'Algebra 1', grade: 'High school', icon: '🧮', skills: algebra1 || [] },
    { id: 'geometry', label: 'Geometry', grade: 'High school', icon: '📐', skills: geometry || [] },
    { id: 'algebra2', label: 'Algebra 2 & Trig', grade: 'High school', icon: '📊', skills: algebra2 || [] },
    { id: 'trigonometry', label: 'Trigonometry', grade: 'High school', icon: '🔺', skills: trigonometry || [] },
    { id: 'precalc', label: 'Precalculus', grade: 'High school', icon: '🌀', skills: precalc || [] },
    { id: 'collegeAlgebra', label: 'College Algebra', grade: 'College', icon: '🎓', skills: collegeAlgebra || [] },
    { id: 'statistics', label: 'Statistics & Probability', grade: 'AP / College', icon: '🎲', skills: statistics || [] },
    { id: 'calculus', label: 'Calculus AB', grade: 'AP / College', icon: '∫', skills: calculus || [] },
    { id: 'calculusBC', label: 'Calculus BC', grade: 'AP / College', icon: '♾️', skills: calculusBC || [] },
    { id: 'multivariable', label: 'Multivariable Calculus', grade: 'College', icon: '🧊', skills: multivariable || [] },
    { id: 'diffeq', label: 'Differential Equations', grade: 'College', icon: '🌊', skills: diffeq || [] },
    { id: 'linearAlgebra', label: 'Linear Algebra', grade: 'College', icon: '▦', skills: linearAlgebra || [] }
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
    { id: 'k', label: 'Kindergarten', topics: ['gradeK'] },
    { id: '1', label: 'Grade 1', topics: ['grade1', 'gradeK'] },
    { id: '2', label: 'Grade 2', topics: ['grade2', 'grade1'] },
    { id: '3', label: 'Grade 3', topics: ['grade3', 'grade2'] },
    { id: '4', label: 'Grade 4', topics: ['grade4', 'grade3'] },
    { id: '5', label: 'Grade 5', topics: ['grade5', 'grade4'] },
    { id: '6', label: 'Grade 6', topics: ['grade6', 'grade5'] },
    { id: '7', label: 'Grade 7', topics: ['grade7', 'grade6'] },
    { id: '8', label: 'Grade 8', topics: ['grade8', 'grade7'] },
    { id: '9', label: 'Grade 9 — Algebra 1', topics: ['algebra1', 'grade8'] },
    { id: '10', label: 'Grade 10 — Geometry', topics: ['geometry', 'algebra1'] },
    { id: '11', label: 'Grade 11 — Algebra 2 & Trig', topics: ['algebra2', 'trigonometry', 'geometry'] },
    { id: '12', label: 'Grade 12 — Precalculus', topics: ['precalc', 'algebra2'] },
    { id: 'college', label: 'College / AP', topics: ['calculus', 'calculusBC', 'collegeAlgebra', 'statistics', 'linearAlgebra', 'multivariable', 'diffeq', 'precalc'] }
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

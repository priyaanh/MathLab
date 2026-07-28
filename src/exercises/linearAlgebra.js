/**
 * Linear Algebra practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 * Entries are kept as small integers so every result is an integer (except the
 * vector-magnitude skill, which uses Pythagorean triples for exact answers).
 * Prompts are plain text and may use ^ √ × and bracket notation.
 */

import { randInt, randNonZero, choice, mcFrom } from './helpers.js'

// Format a signed vector like "(3, -2)".
const fmtVec = (v) => `(${v.join(', ')})`

// Ordinal word for a component index (1 -> "first", etc.).
const componentName = (i) => ['first', 'second', 'third'][i]

const skills = [
    // 1 -----------------------------------------------------------------------
    {
        id: 'la-vector-combination',
        title: 'Vector addition & scalar multiples',
        desc: 'Compute a component of a linear combination of two 2D vectors.',
        generate() {
            const u = [randInt(-6, 6), randInt(-6, 6)]
            const v = [randInt(-6, 6), randInt(-6, 6)]
            const s = randNonZero(-4, 4)
            const t = randNonZero(-4, 4)
            const idx = choice([0, 1])
            const result = [s * u[0] + t * v[0], s * u[1] + t * v[1]]
            const answer = result[idx]
            return {
                prompt: `Let u = ${fmtVec(u)} and v = ${fmtVec(v)}. Compute w = ${s}u + ${t}v, then enter the ${componentName(idx)} component of w.`,
                answer,
                type: 'integer',
                explanation: `The ${componentName(idx)} component of w is ${s}·u${'₁₂'[idx]} + ${t}·v${'₁₂'[idx]}.\nSubstitute: ${s}·(${u[idx]}) + ${t}·(${v[idx]}).\n= ${s * u[idx]} + ${t * v[idx]} = ${answer}.\nSo the ${componentName(idx)} component is ${answer}.`,
            }
        },
    },

    // 2 -----------------------------------------------------------------------
    {
        id: 'la-vector-magnitude',
        title: 'Magnitude of a vector',
        desc: 'Find the length ‖v‖ of a 2D vector (exact, using a Pythagorean triple).',
        generate() {
            const triples = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25]]
            const [a0, b0, c] = choice(triples)
            const a = choice([1, -1]) * a0
            const b = choice([1, -1]) * b0
            return {
                prompt: `Find the magnitude ‖v‖ of the vector v = ${fmtVec([a, b])}.`,
                answer: c,
                type: 'numeric',
                tolerance: 1e-3,
                explanation: `Use ‖v‖ = √(v₁² + v₂²).\nSubstitute: √((${a})² + (${b})²) = √(${a * a} + ${b * b}).\n= √${a * a + b * b} = ${c}.\nSo ‖v‖ = ${c}.`,
            }
        },
    },

    // 3 -----------------------------------------------------------------------
    {
        id: 'la-dot-product',
        title: 'Dot product',
        desc: 'Compute the dot product of two 2D or 3D vectors.',
        generate() {
            const n = choice([2, 3])
            const u = Array.from({ length: n }, () => randInt(-6, 6))
            const v = Array.from({ length: n }, () => randInt(-6, 6))
            const terms = u.map((ui, i) => ui * v[i])
            const answer = terms.reduce((s, x) => s + x, 0)
            const termStr = u.map((ui, i) => `(${ui})(${v[i]})`).join(' + ')
            return {
                prompt: `Compute the dot product u · v where u = ${fmtVec(u)} and v = ${fmtVec(v)}.`,
                answer,
                type: 'integer',
                explanation: `The dot product is the sum of componentwise products.\nu · v = ${termStr}.\n= ${terms.join(' + ')} = ${answer}.`,
            }
        },
    },

    // 4 -----------------------------------------------------------------------
    {
        id: 'la-matrix-combination',
        title: 'Matrix addition & scalar multiples',
        desc: 'Compute an entry of a linear combination of two 2x2 matrices.',
        generate() {
            const A = [[randInt(-6, 6), randInt(-6, 6)], [randInt(-6, 6), randInt(-6, 6)]]
            const B = [[randInt(-6, 6), randInt(-6, 6)], [randInt(-6, 6), randInt(-6, 6)]]
            const s = randNonZero(-4, 4)
            const t = randNonZero(-4, 4)
            const r = choice([0, 1])
            const c = choice([0, 1])
            const answer = s * A[r][c] + t * B[r][c]
            const pos = `(${r + 1},${c + 1})`
            return {
                prompt: `Let A = [[${A[0]}], [${A[1]}]] and B = [[${B[0]}], [${B[1]}]]. Compute M = ${s}A + ${t}B, then enter the entry in row ${r + 1}, column ${c + 1}.`,
                answer,
                type: 'integer',
                explanation: `The ${pos} entry of M is ${s}·A${pos} + ${t}·B${pos}.\nSubstitute: ${s}·(${A[r][c]}) + ${t}·(${B[r][c]}).\n= ${s * A[r][c]} + ${t * B[r][c]} = ${answer}.\nSo the ${pos} entry is ${answer}.`,
            }
        },
    },

    // 5 -----------------------------------------------------------------------
    {
        id: 'la-matrix-multiply',
        title: '2x2 matrix multiplication',
        desc: 'Find a specific entry of the product of two 2x2 matrices.',
        generate() {
            const A = [[randInt(-5, 5), randInt(-5, 5)], [randInt(-5, 5), randInt(-5, 5)]]
            const B = [[randInt(-5, 5), randInt(-5, 5)], [randInt(-5, 5), randInt(-5, 5)]]
            const r = choice([0, 1])
            const c = choice([0, 1])
            const answer = A[r][0] * B[0][c] + A[r][1] * B[1][c]
            const pos = `(${r + 1},${c + 1})`
            return {
                prompt: `Let A = [[${A[0]}], [${A[1]}]] and B = [[${B[0]}], [${B[1]}]]. Find the entry in row ${r + 1}, column ${c + 1} of the product AB.`,
                answer,
                type: 'integer',
                explanation: `The ${pos} entry of AB is (row ${r + 1} of A) · (column ${c + 1} of B).\n= (${A[r][0]})(${B[0][c]}) + (${A[r][1]})(${B[1][c]}).\n= ${A[r][0] * B[0][c]} + ${A[r][1] * B[1][c]} = ${answer}.\nSo the ${pos} entry is ${answer}.`,
            }
        },
    },

    // 6 -----------------------------------------------------------------------
    {
        id: 'la-determinant-2x2',
        title: 'Determinant of a 2x2 matrix',
        desc: 'Compute the determinant ad − bc of a 2x2 matrix.',
        generate() {
            const a = randInt(-6, 6)
            const b = randInt(-6, 6)
            const c = randInt(-6, 6)
            const d = randInt(-6, 6)
            const answer = a * d - b * c
            return {
                prompt: `Find the determinant of [[${a}, ${b}], [${c}, ${d}]].`,
                answer,
                type: 'integer',
                explanation: `For a 2x2 matrix [[a, b], [c, d]], det = ad − bc.\nSubstitute: (${a})(${d}) − (${b})(${c}).\n= ${a * d} − ${b * c} = ${answer}.\nSo the determinant is ${answer}.`,
            }
        },
    },

    // 7 -----------------------------------------------------------------------
    {
        id: 'la-determinant-3x3',
        title: 'Determinant of a 3x3 matrix',
        desc: 'Compute the determinant of a 3x3 matrix by cofactor expansion.',
        generate() {
            const M = Array.from({ length: 3 }, () =>
                Array.from({ length: 3 }, () => randInt(-4, 4)))
            const [[a, b, c], [d, e, f], [g, h, i]] = M
            const m1 = e * i - f * h
            const m2 = d * i - f * g
            const m3 = d * h - e * g
            const answer = a * m1 - b * m2 + c * m3
            return {
                prompt: `Find the determinant of [[${M[0]}], [${M[1]}], [${M[2]}]].`,
                answer,
                type: 'integer',
                explanation: `Expand along the first row: det = a(ei − fh) − b(di − fg) + c(dh − eg).\nMinors: ei−fh = ${m1}, di−fg = ${m2}, dh−eg = ${m3}.\ndet = (${a})(${m1}) − (${b})(${m2}) + (${c})(${m3}).\n= ${a * m1} − ${b * m2} + ${c * m3} = ${answer}.`,
            }
        },
    },

    // 8 -----------------------------------------------------------------------
    {
        id: 'la-eigenvalue-larger',
        title: 'Eigenvalues of a 2x2 matrix',
        desc: 'Find the larger eigenvalue of a 2x2 matrix with integer eigenvalues.',
        generate() {
            // Build a matrix with chosen integer eigenvalues λ1 < λ2 via a
            // similarity-free construction: start from a triangular matrix with
            // the eigenvalues on the diagonal, then apply an integer shear
            // (which preserves the eigenvalues) to hide the triangular form.
            let l1 = randInt(-4, 5)
            let l2 = randInt(-4, 5)
            while (l2 === l1) l2 = randInt(-4, 5)
            if (l1 > l2) [l1, l2] = [l2, l1]
            // Upper triangular [[l1, t], [0, l2]] has eigenvalues l1, l2.
            const t = randNonZero(-3, 3)
            // Shear by P = [[1, k], [0, 1]] (integer inverse) preserves eigenvalues:
            // A = P M P^{-1}, all-integer since P and P^{-1} are integer.
            const k = randInt(-2, 2)
            // M = [[l1, t], [0, l2]]
            // P M = [[l1, t + k·l2], [0, l2]]
            // (P M) P^{-1}, P^{-1} = [[1, -k], [0, 1]]:
            const a = l1
            const b = -l1 * k + (t + k * l2)
            const c = 0
            const d = l2
            const answer = l2
            return {
                prompt: `Find the larger eigenvalue of the matrix [[${a}, ${b}], [${c}, ${d}]].`,
                answer,
                type: 'integer',
                explanation: `Eigenvalues solve det(A − λI) = 0, i.e. (a−λ)(d−λ) − bc = 0.\nHere det(A − λI) = (${a} − λ)(${d} − λ) − (${b})(${c}) = (λ − ${l1})(λ − ${l2}).\nThe roots are λ = ${l1} and λ = ${l2}.\nThe larger eigenvalue is ${answer}.`,
            }
        },
    },

    // 9 -----------------------------------------------------------------------
    {
        id: 'la-independence',
        title: 'Linear independence of two vectors',
        desc: 'Decide whether two 2D vectors are linearly independent or dependent.',
        generate() {
            const dependent = choice([true, false])
            const u = [randNonZero(-5, 5), randNonZero(-5, 5)]
            let v
            let det
            if (dependent) {
                const m = randNonZero(-4, 4)
                v = [m * u[0], m * u[1]]
                det = u[0] * v[1] - u[1] * v[0] // = 0
            } else {
                // Pick v until the 2x2 determinant is nonzero (independent).
                do {
                    v = [randInt(-5, 5), randInt(-5, 5)]
                    det = u[0] * v[1] - u[1] * v[0]
                } while (det === 0)
            }
            const correct = det === 0 ? 'dependent' : 'independent'
            const { choices, answer } = mcFrom(correct, ['independent', 'dependent'])
            return {
                prompt: `Are the vectors u = ${fmtVec(u)} and v = ${fmtVec(v)} linearly independent or dependent?`,
                answer,
                type: 'choice',
                choices,
                explanation: `Two 2D vectors are independent exactly when det[[u₁, v₁], [u₂, v₂]] ≠ 0.\ndet = (${u[0]})(${v[1]}) − (${u[1]})(${v[0]}) = ${det}.\nSince the determinant is ${det === 0 ? 'zero' : 'nonzero'}, the vectors are ${correct}.`,
            }
        },
    },
]

export default skills

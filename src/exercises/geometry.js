/**
 * Geometry practice-problem generators.
 *
 * Each skill is { id, title, desc, generate() -> Problem }.
 * All generators are self-consistent: the checker accepts String(problem.answer).
 */

import { randInt, choice, round } from './helpers'

const PI = Math.PI

const skills = [
    {
        id: 'geo-special-right-triangle',
        title: 'Special right triangles',
        desc: 'Use 45-45-90 and 30-60-90 ratios to find a missing side.',
        generate() {
            if (choice([true, false])) {
                const leg = randInt(2, 9)
                const answer = round(leg * Math.SQRT2, 2)
                return {
                    prompt: `In a 45°-45°-90° triangle each leg is ${leg}. Find the hypotenuse (2 dp).`,
                    answer,
                    type: 'numeric',
                    tolerance: 0.02,
                    explanation: `hypotenuse = leg·√2 = ${leg}·√2 ≈ ${answer}.`,
                }
            }
            const short = randInt(2, 9)
            const answer = round(short * Math.sqrt(3), 2)
            return {
                prompt: `In a 30°-60°-90° triangle the short leg is ${short}. Find the long leg (2 dp).`,
                answer,
                type: 'numeric',
                tolerance: 0.02,
                explanation: `long leg = short·√3 = ${short}·√3 ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'geo-volume-sphere',
        title: 'Volume of a sphere',
        desc: 'Compute the volume of a sphere from its radius.',
        generate() {
            const r = randInt(1, 8)
            const answer = round((4 / 3) * Math.PI * r ** 3, 2)
            return {
                prompt: `Find the volume of a sphere with radius ${r}. Use π ≈ 3.14159 (2 dp).`,
                answer,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `V = (4/3)πr³ = (4/3)π(${r})³ ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'geo-angle-relationships',
        title: 'Angle relationships',
        desc: 'Find a missing angle using complementary, supplementary, or vertical angles.',
        generate() {
            const kind = choice(['complementary', 'supplementary', 'vertical'])
            if (kind === 'vertical') {
                const a = randInt(20, 160)
                return {
                    prompt: `Two lines cross. One of the vertical angles measures ${a}°. What is the measure of the angle vertical (opposite) to it, in degrees?`,
                    answer: a,
                    type: 'integer',
                    explanation: `Vertical angles are equal, so the opposite angle is also ${a}°.`,
                }
            }
            const total = kind === 'complementary' ? 90 : 180
            const a = randInt(10, total - 10)
            const answer = total - a
            return {
                prompt: `Two ${kind} angles add up to ${total}°. One angle measures ${a}°. What is the other angle, in degrees?`,
                answer,
                type: 'integer',
                explanation: `${kind === 'complementary' ? 'Complementary' : 'Supplementary'} angles sum to ${total}°, so ${total} − ${a} = ${answer}°.`,
            }
        },
    },

    {
        id: 'geo-triangle-angle-sum',
        title: 'Triangle angle sum',
        desc: 'Use the fact that a triangle’s angles sum to 180° to find the third angle.',
        generate() {
            const a = randInt(30, 120)
            const b = randInt(20, 160 - a)
            const answer = 180 - a - b
            return {
                prompt: `A triangle has two angles measuring ${a}° and ${b}°. What is the measure of the third angle, in degrees?`,
                answer,
                type: 'integer',
                explanation: `The angles of a triangle sum to 180°, so 180 − ${a} − ${b} = ${answer}°.`,
            }
        },
    },

    {
        id: 'geo-pythagorean',
        title: 'Pythagorean theorem',
        desc: 'Find the hypotenuse or a leg of a right triangle.',
        generate() {
            const triples = [
                [3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25],
                [6, 8, 10], [9, 12, 15], [20, 21, 29], [9, 40, 41],
            ]
            const [a, b, c] = choice(triples)
            const findHyp = choice([true, false])
            if (findHyp) {
                return {
                    prompt: `A right triangle has legs of length ${a} and ${b}. What is the length of the hypotenuse? (c = √(${a}^2 + ${b}^2))`,
                    answer: c,
                    type: 'numeric',
                    tolerance: 0.05,
                    explanation: `c = √(${a}^2 + ${b}^2) = √${a * a + b * b} = ${c}.`,
                }
            }
            // Find a leg: give hypotenuse c and leg b, find leg a.
            return {
                prompt: `A right triangle has a hypotenuse of length ${c} and one leg of length ${b}. What is the length of the other leg? (leg = √(${c}^2 − ${b}^2))`,
                answer: a,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `leg = √(${c}^2 − ${b}^2) = √${c * c - b * b} = ${a}.`,
            }
        },
    },

    {
        id: 'geo-area-quadrilateral-triangle',
        title: 'Area: triangle, parallelogram, trapezoid',
        desc: 'Find the area of a triangle, parallelogram, or trapezoid.',
        generate() {
            const shape = choice(['triangle', 'parallelogram', 'trapezoid'])
            if (shape === 'triangle') {
                const b = randInt(4, 20)
                const h = randInt(3, 18)
                const answer = round((b * h) / 2, 2)
                return {
                    prompt: `Find the area of a triangle with base ${b} and height ${h}. (Area = ½ × base × height)`,
                    answer,
                    type: 'numeric',
                    tolerance: 0.05,
                    explanation: `Area = ½ × ${b} × ${h} = ${answer}.`,
                }
            }
            if (shape === 'parallelogram') {
                const b = randInt(4, 20)
                const h = randInt(3, 18)
                const answer = b * h
                return {
                    prompt: `Find the area of a parallelogram with base ${b} and height ${h}. (Area = base × height)`,
                    answer,
                    type: 'numeric',
                    tolerance: 0.05,
                    explanation: `Area = ${b} × ${h} = ${answer}.`,
                }
            }
            const b1 = randInt(4, 16)
            const b2 = randInt(4, 16)
            const h = randInt(3, 14)
            const answer = round(((b1 + b2) * h) / 2, 2)
            return {
                prompt: `Find the area of a trapezoid with parallel bases ${b1} and ${b2} and height ${h}. (Area = ½ × (b₁ + b₂) × height)`,
                answer,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Area = ½ × (${b1} + ${b2}) × ${h} = ${answer}.`,
            }
        },
    },

    {
        id: 'geo-circle-area',
        title: 'Area of a circle',
        desc: 'Find the area of a circle from its radius.',
        generate() {
            const r = randInt(2, 15)
            const answer = round(PI * r * r, 2)
            return {
                prompt: `Find the area of a circle with radius ${r}. Use π ≈ 3.14159 and round to 2 decimal places. (Area = π × r^2)`,
                answer,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Area = π × ${r}^2 = π × ${r * r} ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'geo-circle-circumference',
        title: 'Circumference of a circle',
        desc: 'Find the circumference of a circle from its radius.',
        generate() {
            const r = randInt(2, 15)
            const answer = round(2 * PI * r, 2)
            return {
                prompt: `Find the circumference of a circle with radius ${r}. Use π ≈ 3.14159 and round to 2 decimal places. (Circumference = 2 × π × r)`,
                answer,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Circumference = 2 × π × ${r} ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'geo-volume-prism-cylinder',
        title: 'Volume of a prism or cylinder',
        desc: 'Find the volume of a rectangular prism or a cylinder.',
        generate() {
            if (choice([true, false])) {
                const l = randInt(2, 12)
                const w = randInt(2, 12)
                const h = randInt(2, 12)
                const answer = l * w * h
                return {
                    prompt: `Find the volume of a rectangular prism with length ${l}, width ${w}, and height ${h}. (Volume = l × w × h)`,
                    answer,
                    type: 'numeric',
                    tolerance: 0.05,
                    explanation: `Volume = ${l} × ${w} × ${h} = ${answer}.`,
                }
            }
            const r = randInt(2, 10)
            const h = randInt(2, 12)
            const answer = round(PI * r * r * h, 2)
            return {
                prompt: `Find the volume of a cylinder with radius ${r} and height ${h}. Use π ≈ 3.14159 and round to 2 decimal places. (Volume = π × r^2 × h)`,
                answer,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Volume = π × ${r}^2 × ${h} = π × ${r * r * h} ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'geo-surface-area-prism',
        title: 'Surface area of a rectangular prism',
        desc: 'Find the total surface area of a rectangular prism.',
        generate() {
            const l = randInt(2, 12)
            const w = randInt(2, 12)
            const h = randInt(2, 12)
            const answer = 2 * (l * w + l * h + w * h)
            return {
                prompt: `Find the surface area of a rectangular prism with length ${l}, width ${w}, and height ${h}. (Surface area = 2 × (lw + lh + wh))`,
                answer,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Surface area = 2 × (${l}×${w} + ${l}×${h} + ${w}×${h}) = ${answer}.`,
            }
        },
    },

    {
        id: 'geo-distance-two-points',
        title: 'Distance between two points',
        desc: 'Use the distance formula to find the length of a segment.',
        generate() {
            // Use Pythagorean-triple leg differences so the distance is a clean integer.
            const legs = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [9, 12, 15]]
            const [dx, dy, d] = choice(legs)
            const x1 = randInt(-8, 8)
            const y1 = randInt(-8, 8)
            const x2 = x1 + choice([-1, 1]) * dx
            const y2 = y1 + choice([-1, 1]) * dy
            return {
                prompt: `Find the distance between the points (${x1}, ${y1}) and (${x2}, ${y2}). (Distance = √((x₂ − x₁)^2 + (y₂ − y₁)^2))`,
                answer: d,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Distance = √(${dx}^2 + ${dy}^2) = √${dx * dx + dy * dy} = ${d}.`,
            }
        },
    },

    {
        id: 'geo-midpoint',
        title: 'Midpoint of a segment',
        desc: 'Find the midpoint of the segment joining two points.',
        generate() {
            // Keep coordinates even so midpoints are integers.
            const x1 = 2 * randInt(-8, 8)
            const y1 = 2 * randInt(-8, 8)
            const x2 = 2 * randInt(-8, 8)
            const y2 = 2 * randInt(-8, 8)
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2
            const answer = `(${mx},${my})`
            return {
                prompt: `Find the midpoint of the segment joining (${x1}, ${y1}) and (${x2}, ${y2}). Give your answer as (x,y). (Midpoint = ((x₁ + x₂)/2, (y₁ + y₂)/2))`,
                answer,
                type: 'text',
                accepted: [
                    `(${mx}, ${my})`,
                    `${mx},${my}`,
                    `${mx}, ${my}`,
                ],
                explanation: `Midpoint = ((${x1} + ${x2})/2, (${y1} + ${y2})/2) = (${mx}, ${my}).`,
            }
        },
    },

    {
        id: 'geo-regular-polygon-interior-angle',
        title: 'Interior angle of a regular polygon',
        desc: 'Find the measure of one interior angle of a regular n-gon.',
        generate() {
            const n = randInt(3, 12)
            const answer = round(((n - 2) * 180) / n, 2)
            const names = {
                3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon',
                7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon',
                11: 'hendecagon', 12: 'dodecagon',
            }
            return {
                prompt: `Find the measure of one interior angle of a regular ${n}-gon (${names[n]}), in degrees. Round to 2 decimal places. (Interior angle = (n − 2) × 180 / n)`,
                answer,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Interior angle = (${n} − 2) × 180 / ${n} = ${(n - 2) * 180} / ${n} ≈ ${answer}.`,
            }
        },
    },

    {
        id: 'geo-similar-triangles',
        title: 'Similar triangles',
        desc: 'Use a proportion between similar triangles to find a missing side.',
        generate() {
            // Small triangle side a1 corresponds to large side a2 by scale factor k.
            const a1 = randInt(2, 9)
            const k = randInt(2, 5)
            const a2 = a1 * k
            // Second corresponding pair: b1 known on small triangle, find b2.
            const b1 = randInt(2, 9)
            const answer = b1 * k
            return {
                prompt: `Two triangles are similar. In the first triangle two sides measure ${a1} and ${b1}. The side corresponding to ${a1} in the second triangle measures ${a2}. What is the length of the side corresponding to ${b1}? (Set up ${a1}/${a2} = ${b1}/x)`,
                answer,
                type: 'numeric',
                tolerance: 0.05,
                explanation: `Scale factor = ${a2}/${a1} = ${k}, so the missing side = ${b1} × ${k} = ${answer}.`,
            }
        },
    },
]

export default skills

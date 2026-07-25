/**
 * The math curriculum roadmap, from elementary school through college.
 * Shared by the Guide roadmap (short notes) and the per-level detail pages
 * (deep explanations + which MathLab tools help with each topic).
 *
 * Each topic: { name, note (one line), detail (deep), example, tools[] }.
 * A tool is { label, to } linking to a page on this site.
 */

export const LEVELS = {
    elementary: {
        slug: 'elementary',
        level: 'Elementary School',
        grades: 'Kindergarten – Grade 5',
        icon: '✏️',
        intro: 'Where it all begins: building number sense, the four operations, and a first feel for shapes and measurement.',
        topics: [
            {
                name: 'Counting numbers and recognizing shapes',
                note: 'Saying numbers in order and naming basic shapes.',
                detail: 'Counting is the foundation of all mathematics: learning the number sequence, understanding that each number is one more than the last, and grasping that the final number counted tells you “how many” (cardinality). Alongside it, children learn to recognize and name 2‑D shapes by their features — how many sides and corners a circle, square, triangle or rectangle has. Together these build number sense and spatial awareness.',
                example: 'Counting 5 apples one‑by‑one; sorting blocks into circles vs. squares.',
                tools: [{ label: 'Shapes', to: '/shapes' }]
            },
            {
                name: 'Adding and subtracting whole numbers',
                note: 'Putting amounts together and taking them apart.',
                detail: 'Addition combines two quantities into a total; subtraction finds what is left, or the difference between two amounts. Students learn place‑value strategies such as regrouping (“carrying” and “borrowing”) to handle larger numbers, and discover that addition and subtraction are inverse operations that undo each other.',
                example: '27 + 15 = 42, and 42 − 15 = 27.',
                tools: [{ label: 'Calculator', to: '/scientific' }]
            },
            {
                name: 'Multiplying and dividing basic numbers',
                note: 'Repeated adding and splitting into equal groups.',
                detail: 'Multiplication is repeated addition of equal groups — 4 × 3 means four groups of three. Division reverses it, splitting a total into equal groups or finding how many groups fit. Fluency with the times tables makes fractions, ratios and later algebra dramatically faster.',
                example: '6 × 7 = 42, and 42 ÷ 6 = 7.',
                tools: [{ label: 'Calculator', to: '/scientific' }]
            },
            {
                name: 'Fractions, decimals, and place value',
                note: 'Parts of a whole and the value of each digit.',
                detail: 'Place value is the idea that a digit’s position sets its worth: the 3 in 30 means three tens, but in 0.3 it means three tenths. Fractions represent parts of a whole (3/4), and decimals write those same parts using place value (0.75). Seeing fractions, decimals and percentages as three views of one quantity is a major conceptual leap.',
                example: '3/4 = 0.75 = 75%.',
                tools: [{ label: 'Calculator', to: '/scientific' }]
            },
            {
                name: 'Measuring time, weight, and volume',
                note: 'Reading clocks and using real‑world units.',
                detail: 'Measurement connects numbers to the real world: reading clocks and finding elapsed time, and using units of mass (grams, kilograms, pounds) and capacity (millilitres, litres, cups). Students learn to choose sensible units and convert between them.',
                example: '2 hours 30 minutes after 10:45 is 1:15; 1 litre = 1000 mL.',
                tools: [{ label: 'Calculator', to: '/scientific' }]
            }
        ]
    },

    middle: {
        slug: 'middle',
        level: 'Middle School',
        grades: 'Grades 6 – 8',
        icon: '📐',
        intro: 'The jump to abstraction: signed numbers, proportional reasoning, the first real algebra, and the coordinate plane.',
        topics: [
            {
                name: 'Negative numbers and absolute value',
                note: 'Numbers below zero, and distance from zero.',
                detail: 'The number line extends below zero into the negatives, used for debts, temperatures and opposite directions. Absolute value, written |x|, is a number’s distance from zero regardless of sign, so |−5| = 5. Students learn the rules for adding, subtracting, multiplying and dividing signed numbers.',
                example: '−3 + 7 = 4, and |−8| = 8.',
                tools: [{ label: 'Calculator', to: '/scientific' }]
            },
            {
                name: 'Ratios, proportions, and percentages',
                note: 'Comparing and scaling quantities.',
                detail: 'A ratio compares two quantities (3 : 2). A proportion states that two ratios are equal, which lets you solve for an unknown by cross‑multiplying. Percentages are simply ratios out of 100 — the engine behind discounts, tax, tips and statistics.',
                example: 'If 2 pens cost $3, then 6 pens cost $9; 20% of 50 is 10.',
                tools: [{ label: 'Calculator', to: '/scientific' }]
            },
            {
                name: 'Basic algebraic variables and equations',
                note: 'Letters for unknowns, and solving for them.',
                detail: 'Algebra introduces letters (variables) that stand for unknown or changing numbers, turning word problems into equations. Solving means isolating the variable using inverse operations while keeping both sides of the equation balanced.',
                example: '2x + 3 = 11  →  x = 4.',
                tools: [{ label: 'Calculator', to: '/scientific' }, { label: 'Lines', to: '/lines' }]
            },
            {
                name: 'Graphing coordinates on a grid',
                note: 'Plotting (x, y) points on the plane.',
                detail: 'The coordinate plane locates any point with an ordered pair (x, y): x is how far right or left, y is how far up or down, measured from the origin (0, 0). It is the bridge between algebra and geometry — equations become pictures you can see.',
                example: 'To plot (3, −2): go right 3, then down 2.',
                tools: [{ label: 'Grapher', to: '/graph' }, { label: 'Lines', to: '/lines' }]
            },
            {
                name: 'Area, perimeter, and surface volume',
                note: 'Space inside shapes and around them.',
                detail: 'Perimeter is the distance around a 2‑D shape; area is the space inside it (length × width for a rectangle). Volume measures the space inside a 3‑D solid. These reinforce multiplication and introduce working with formulas.',
                example: 'A 4 × 3 rectangle has perimeter 14 and area 12.',
                tools: [{ label: 'Shapes', to: '/shapes' }]
            }
        ]
    },

    high: {
        slug: 'high',
        level: 'High School',
        grades: 'Grades 9 – 12',
        icon: '📈',
        intro: 'The core high‑school sequence: from linear equations and formal geometry through trigonometry and the doorway to calculus.',
        topics: [
            {
                name: 'Algebra I: Solving linear equations',
                note: 'Straight‑line relationships like y = mx + b.',
                detail: 'Linear equations describe straight‑line relationships that show up everywhere. Students master slope (the rate of change) and intercepts, write lines in forms like y = mx + b, and solve single equations as well as systems of two equations at once.',
                example: 'y = 2x + 1 has slope 2 and crosses the y‑axis at (0, 1).',
                tools: [{ label: 'Lines', to: '/lines' }, { label: 'Grapher', to: '/graph' }]
            },
            {
                name: 'Geometry: Proofs, theorems, and angles',
                note: 'Reasoning logically about shapes and angles.',
                detail: 'Geometry formalizes reasoning: starting from a few accepted axioms, you prove theorems through logical steps. Topics include angle relationships (complementary, supplementary, vertical), triangle congruence and similarity, and the Pythagorean theorem.',
                example: 'In a right triangle, a² + b² = c².',
                tools: [{ label: 'Shapes', to: '/shapes' }, { label: 'Transformations', to: '/transformations' }]
            },
            {
                name: 'Algebra II: Matrices and logarithms',
                note: 'Number grids, and the inverse of exponents.',
                detail: 'Algebra II broadens the toolkit. Matrices are rectangular arrays of numbers used to solve systems and transform geometry. Logarithms invert exponentials — log₂ 8 = 3 because 2³ = 8 — and are essential for exponential growth, sound levels and pH.',
                example: 'log₁₀ 1000 = 3.',
                tools: [{ label: 'Calculator (log / ln)', to: '/scientific' }]
            },
            {
                name: 'Trigonometry: Sine, cosine, and triangles',
                note: 'How angles relate to side lengths.',
                detail: 'Trigonometry relates a triangle’s angles to the ratios of its sides through sine, cosine and tangent. It powers navigation, waves and anything periodic, and extends via the unit circle to angles well beyond a single triangle.',
                example: 'sin 30° = 0.5.',
                tools: [{ label: 'Calculator (sin/cos/tan)', to: '/scientific' }, { label: 'Grapher', to: '/graph' }]
            },
            {
                name: 'Pre-Calculus: Functions and basic limits',
                note: 'Function families and what they approach.',
                detail: 'Pre‑calculus studies whole families of functions — polynomial, rational, exponential, logarithmic and trigonometric — along with their transformations and inverses. It introduces limits: the value a function approaches as its input nears a point, which is the gateway to calculus.',
                example: 'As x → 0, sin(x)/x → 1.',
                tools: [{ label: 'Grapher', to: '/graph' }]
            }
        ]
    },

    college: {
        slug: 'college',
        level: 'College',
        grades: 'Undergraduate',
        icon: '🎓',
        intro: 'University mathematics: continuous change, higher‑dimensional structure, modelling the physical world, and the deep structure of arithmetic itself.',
        topics: [
            {
                name: 'Calculus: Derivatives, integrals, and series',
                note: 'Rates of change, accumulation, infinite sums.',
                detail: 'Calculus is the mathematics of continuous change. The derivative gives an instantaneous rate of change (the slope of the tangent line); the integral accumulates quantities (the area under a curve); and series add infinitely many terms. The Fundamental Theorem of Calculus ties derivatives and integrals together.',
                example: 'd/dx x² = 2x, and ∫₀¹ x dx = ½.',
                tools: [{ label: 'Grapher', to: '/graph' }]
            },
            {
                name: 'Linear Algebra: Vectors and vector spaces',
                note: 'Vectors, matrices and transformations.',
                detail: 'Linear algebra generalizes lines and planes to any number of dimensions using vectors and matrices. Ideas such as linear independence, span, basis and eigenvalues underpin computer graphics, machine learning and physics.',
                example: 'Rotating a shape is the same as multiplying its points by a rotation matrix.',
                tools: [{ label: 'Transformations', to: '/transformations' }]
            },
            {
                name: 'Differential Equations: Modeling physical systems',
                note: 'Equations relating a quantity to its change.',
                detail: 'A differential equation relates a quantity to its own rate of change, describing how systems evolve over time — population growth, cooling objects, electrical circuits, motion. Solving one means finding the function that satisfies the relationship.',
                example: 'dy/dt = ky models exponential growth or decay.',
                tools: [{ label: 'Grapher', to: '/graph' }]
            },
            {
                name: 'Statistics: Data analysis and probability',
                note: 'Drawing conclusions from data.',
                detail: 'Statistics turns data into conclusions: summarizing with mean, median and standard deviation, visualizing distributions, and quantifying uncertainty using probability. It underlies science, medicine, economics and machine learning.',
                example: 'The mean of 4, 8 and 6 is 6.',
                tools: [{ label: 'Calculator (avg)', to: '/scientific' }]
            },
            {
                name: 'Abstract Algebra: Groups, rings, and fields',
                note: 'The structure behind arithmetic itself.',
                detail: 'Abstract algebra studies the structures underneath arithmetic. A group is a set with a single operation obeying a few rules; rings and fields add more operations. It explains why arithmetic works the way it does and underlies cryptography and error‑correcting codes.',
                example: 'The integers under addition form a group.',
                tools: []
            }
        ]
    }
}

export const LEVEL_ORDER = ['elementary', 'middle', 'high', 'college']

/**
 * Mathematical utility functions for the calculator
 */

// ---------------------------------------------------------------------------
// Expression engine
//
// A small tokenizer + shunting-yard evaluator that understands numbers,
// parentheses, the operators + - * / % ^ (and the calculator's × ÷ glyphs),
// unary minus, postfix factorial (!), named constants (π, e, φ, τ, Ans) and
// unary functions (trig + inverse/hyperbolic, log/ln/log2, sqrt/cbrt, abs,
// exp, etc.). Implicit multiplication is inferred, so "2π", "3(4)" and ")(" all
// work. Trig is evaluated in the caller's angle mode (degrees by default).
// ---------------------------------------------------------------------------

const CONSTANTS = {
    pi: Math.PI,
    'π': Math.PI,
    tau: Math.PI * 2,
    'τ': Math.PI * 2,
    e: Math.E,
    phi: (1 + Math.sqrt(5)) / 2,
    'φ': (1 + Math.sqrt(5)) / 2
}

// Functions that depend on the angle mode are built per-evaluation (below);
// these are the mode-independent ones.
const PLAIN_FUNCTIONS = {
    sqrt: Math.sqrt,
    '√': Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    exp: Math.exp,
    ln: Math.log,
    log: Math.log10,
    log10: Math.log10,
    log2: Math.log2,
    sign: Math.sign,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    asinh: Math.asinh,
    acosh: Math.acosh,
    atanh: Math.atanh
}

// Build the full function table for a given angle mode. Forward trig converts
// the argument from the display unit into radians; inverse trig converts the
// radian result back into the display unit.
const buildFunctions = (angleMode) => {
    const deg = angleMode === 'DEG'
    const toRad = (x) => (deg ? (x * Math.PI) / 180 : x)
    const fromRad = (x) => (deg ? (x * 180) / Math.PI : x)
    return {
        ...PLAIN_FUNCTIONS,
        sin: (x) => Math.sin(toRad(x)),
        cos: (x) => Math.cos(toRad(x)),
        tan: (x) => Math.tan(toRad(x)),
        asin: (x) => fromRad(Math.asin(x)),
        acos: (x) => fromRad(Math.acos(x)),
        atan: (x) => fromRad(Math.atan(x))
    }
}

const OP_PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, 'u-': 4, 'u+': 4, '^': 5 }
const RIGHT_ASSOC = { '^': true, 'u-': true, 'u+': true }

// Split a raw expression string into typed tokens. Constant/function names are
// resolved here so implicit-multiplication insertion can reason about them.
const tokenize = (expr, functions) => {
    const tokens = []
    let i = 0
    const src = expr
    while (i < src.length) {
        const ch = src[i]

        if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue }

        // Numbers (decimals + scientific notation)
        if ((ch >= '0' && ch <= '9') || ch === '.') {
            const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?|^\d+\.?/.exec(src.slice(i))
            if (m) {
                tokens.push({ type: 'num', value: parseFloat(m[0]) })
                i += m[0].length
                continue
            }
        }

        // Identifiers: constants or function names
        if (/[a-zA-Zπφτ√]/.test(ch)) {
            const m = /^[a-zA-Zπφτ√]+[0-9]*/.exec(src.slice(i))
            const nameRaw = m[0]
            const name = nameRaw.length === 1 ? nameRaw : nameRaw.toLowerCase()
            i += nameRaw.length
            if (name === 'ans') {
                tokens.push({ type: 'const', value: 'ans' })
            } else if (name in CONSTANTS) {
                tokens.push({ type: 'num', value: CONSTANTS[name] })
            } else if (name in functions) {
                tokens.push({ type: 'func', name })
            } else {
                throw new Error(`Unknown name: ${nameRaw}`)
            }
            continue
        }

        // Operators and structural tokens
        if (ch === '*' && src[i + 1] === '*') { tokens.push({ type: 'op', value: '^' }); i += 2; continue }
        switch (ch) {
            case '+': tokens.push({ type: 'op', value: '+' }); i++; continue
            case '-': tokens.push({ type: 'op', value: '-' }); i++; continue
            case '*':
            case '×': tokens.push({ type: 'op', value: '*' }); i++; continue
            case '/':
            case '÷': tokens.push({ type: 'op', value: '/' }); i++; continue
            case '%': tokens.push({ type: 'op', value: '%' }); i++; continue
            case '^': tokens.push({ type: 'op', value: '^' }); i++; continue
            case '(': tokens.push({ type: 'lparen' }); i++; continue
            case ')': tokens.push({ type: 'rparen' }); i++; continue
            case '!': tokens.push({ type: 'fact' }); i++; continue
            default:
                throw new Error(`Unexpected character: ${ch}`)
        }
    }
    return tokens
}

// Insert explicit multiplication tokens where the source implies it, e.g.
// between a value and a following value/paren/function ("2π", "3(4)", ")(").
const insertImplicitMultiplication = (tokens) => {
    const out = []
    const endsValue = (t) => t && (t.type === 'num' || t.type === 'const' || t.type === 'rparen' || t.type === 'fact')
    const startsValue = (t) => t.type === 'num' || t.type === 'const' || t.type === 'func' || t.type === 'lparen'
    for (let k = 0; k < tokens.length; k++) {
        const prev = out[out.length - 1]
        if (endsValue(prev) && startsValue(tokens[k])) {
            out.push({ type: 'op', value: '*' })
        }
        out.push(tokens[k])
    }
    return out
}

// Convert an infix token stream to RPN (shunting-yard), tagging '-'/'+' that
// appear in operand position as the unary operators 'u-'/'u+'.
const toRPN = (tokens) => {
    const output = []
    const stack = []
    let prev = null
    for (const tok of tokens) {
        if (tok.type === 'num' || tok.type === 'const') {
            output.push(tok)
        } else if (tok.type === 'func') {
            stack.push(tok)
        } else if (tok.type === 'fact') {
            // Postfix, binds to the operand already emitted.
            output.push(tok)
        } else if (tok.type === 'op') {
            // Only '-' acts as a unary (sign) operator in operand position; a
            // stray '+' there (e.g. "2 + + 3") is treated as a binary operator
            // with no left operand, so evaluation reports it as invalid input.
            const unary = tok.value === '-' &&
                (!prev || prev.type === 'op' || prev.type === 'lparen' || prev.type === 'func')
            const op = unary ? 'u-' : tok.value
            while (stack.length) {
                const top = stack[stack.length - 1]
                if (top.type === 'func') { output.push(stack.pop()); continue }
                if (top.type !== 'op') break
                const higher = OP_PRECEDENCE[top.value] > OP_PRECEDENCE[op]
                const equalLeft = OP_PRECEDENCE[top.value] === OP_PRECEDENCE[op] && !RIGHT_ASSOC[op]
                if (higher || equalLeft) output.push(stack.pop())
                else break
            }
            stack.push({ type: 'op', value: op })
        } else if (tok.type === 'lparen') {
            stack.push(tok)
        } else if (tok.type === 'rparen') {
            while (stack.length && stack[stack.length - 1].type !== 'lparen') output.push(stack.pop())
            if (!stack.length) throw new Error('Mismatched parentheses')
            stack.pop() // discard the '('
            if (stack.length && stack[stack.length - 1].type === 'func') output.push(stack.pop())
        }
        prev = tok
    }
    while (stack.length) {
        const top = stack.pop()
        if (top.type === 'lparen') throw new Error('Mismatched parentheses')
        output.push(top)
    }
    return output
}

// Evaluate an RPN token stream to a single number.
const evalRPN = (rpn, functions, ans) => {
    const st = []
    for (const tok of rpn) {
        if (tok.type === 'num') {
            st.push(tok.value)
        } else if (tok.type === 'const') {
            st.push(tok.value === 'ans' ? ans : 0)
        } else if (tok.type === 'fact') {
            if (st.length < 1) throw new Error('Invalid expression')
            st.push(factorial(st.pop()))
        } else if (tok.type === 'func') {
            if (st.length < 1) throw new Error('Invalid expression')
            st.push(functions[tok.name](st.pop()))
        } else if (tok.type === 'op') {
            if (tok.value === 'u-') { st.push(-st.pop()); continue }
            if (tok.value === 'u+') { continue }
            if (st.length < 2) throw new Error('Invalid expression')
            const b = st.pop()
            const a = st.pop()
            st.push(applyOperator(a, b, tok.value))
        }
    }
    if (st.length !== 1) throw new Error('Invalid expression')
    return st[0]
}

/**
 * Evaluate a full mathematical expression with correct order of operations.
 * @param {string} expr - the expression, using either ASCII or calculator glyphs.
 * @param {{angleMode?: 'DEG'|'RAD', ans?: number}} [options]
 * @returns {number} the numeric result (throws on malformed input).
 */
export const evaluateExpression = (expr, options = {}) => {
    const { angleMode = 'DEG', ans = 0 } = options
    if (expr == null || String(expr).trim() === '') return 0
    const functions = buildFunctions(angleMode)
    const tokens = insertImplicitMultiplication(tokenize(String(expr), functions))
    if (tokens.length === 0) return 0
    const result = evalRPN(toRPN(tokens), functions, ans)
    if (Number.isNaN(result)) throw new Error('Invalid expression')
    return result
}

// Helper function to apply a binary operator to two values
const applyOperator = (a, b, op) => {
    switch (op) {
        case '+':
            return a + b
        case '-':
            return a - b
        case '*':
            return a * b
        case '/':
            if (b === 0) throw new Error('Division by zero')
            return a / b
        case '%':
            if (b === 0) throw new Error('Division by zero')
            return a % b
        case '^':
            return Math.pow(a, b)
        default:
            return 0
    }
}

// Calculate basic operations
export const calculate = (firstValue, secondValue, operation) => {
    switch (operation) {
        case '+':
            return firstValue + secondValue
        case '-':
            return firstValue - secondValue
        case '×':
            return firstValue * secondValue
        case '÷':
            return firstValue / secondValue
        case '^':
            return Math.pow(firstValue, secondValue)
        case '%':
            return firstValue % secondValue
        case '=':
            return secondValue
        default:
            return secondValue
    }
}

// Factorial function
export const factorial = (n) => {
    if (n < 0) return NaN
    if (n === 0 || n === 1) return 1
    let result = 1
    for (let i = 2; i <= n; i++) {
        result *= i
    }
    return result
}

// Helper function to extract numbers from an expression for average calculation.
// A leading '-' counts as a sign only when it's directly attached to the digits
// (e.g. "-4"); operators in the display are spaced (e.g. "4 - 6"), so subtraction
// is not mistaken for a negative operand.
export const extractNumbersFromExpression = (expr) => {
    const numberMatches = expr.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)
    return numberMatches ? numberMatches.map(num => parseFloat(num)) : []
}

// Format a numeric result for display: strips floating-point noise
// (e.g. 0.1 + 0.2 => 0.3) while keeping the value re-parseable for further
// calculation. Returns a readable string for non-finite values.
export const formatResult = (value) => {
    if (typeof value !== 'number') return String(value)
    if (Number.isNaN(value)) return 'Error'
    if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity'
    // Round to 12 significant digits to remove binary floating-point artifacts.
    const rounded = parseFloat(value.toPrecision(12))
    return String(rounded)
}

// Helper function to format expression display with proper superscripts for powers
export const formatExpressionDisplay = (expr) => {
    if (!expr) return expr

    // First handle incomplete power expressions ending with "^ -" (negative exponent being built)
    let formatted = expr.replace(/(\d+(?:\.\d+)?|\w+)\s*\^\s*-\s*$/g, (match, base) => {
        return `${base}<sup>-□</sup>`
    })

    // Then handle incomplete power expressions (ending with ^ and waiting for exponent)
    formatted = formatted.replace(/(\d+(?:\.\d+)?|\w+)\s*\^\s*$/g, (match, base) => {
        return `${base}<sup>□</sup>`
    })

    // Finally handle complete power expressions with superscript formatting, completely hiding the ^ symbol
    // Handle patterns like "10 ^ -4", "2 ^ 3", "x ^ -2.5", etc.
    formatted = formatted.replace(/(\d+(?:\.\d+)?|\w+)\s*\^\s*(-?\d+(?:\.\d+)?)/g, (match, base, exponent) => {
        return `${base}<sup>${exponent}</sup>`
    })

    return formatted
}

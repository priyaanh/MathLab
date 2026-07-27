/**
 * A small symbolic-calculus engine: parse an expression into an AST, take its
 * derivative with the standard rules, simplify, pretty-print, and evaluate
 * numerically. Deliberately lightweight — enough for a teaching-grade
 * derivative calculator, not a full CAS.
 *
 * AST node shapes:
 *   { t:'num', v }            numeric literal
 *   { t:'var', name }         a variable / symbolic constant (e.g. x, a)
 *   { t:'neg', a }            unary minus
 *   { t:'add'|'sub'|'mul'|'div'|'pow', a, b }
 *   { t:'fn', name, arg }     sin, cos, ln, sqrt, …
 */

const FUNCS = new Set([
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh', 'ln', 'log', 'log10', 'log2', 'sqrt', 'exp', 'abs',
    'floor', 'ceil'
])
// --- node constructors -----------------------------------------------------
const num = (v) => ({ t: 'num', v })
const vari = (name) => ({ t: 'var', name })
const neg = (a) => ({ t: 'neg', a })
const add = (a, b) => ({ t: 'add', a, b })
const sub = (a, b) => ({ t: 'sub', a, b })
const mul = (a, b) => ({ t: 'mul', a, b })
const div = (a, b) => ({ t: 'div', a, b })
const pow = (a, b) => ({ t: 'pow', a, b })
const fn = (name, arg) => ({ t: 'fn', name, arg })

// --- tokenizer -------------------------------------------------------------
const tokenize = (s) => {
    const toks = []
    let i = 0
    while (i < s.length) {
        const c = s[i]
        if (c === ' ' || c === '\t' || c === '\n') { i++; continue }
        if ((c >= '0' && c <= '9') || c === '.') {
            const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(s.slice(i))
            if (!m) throw new Error('Invalid number')
            toks.push({ k: 'num', v: parseFloat(m[0]) })
            i += m[0].length
            continue
        }
        if (/[a-zA-Zπ]/.test(c)) {
            const m = /^[a-zA-Zπ]+\d*/.exec(s.slice(i))
            toks.push({ k: 'name', v: m[0] })
            i += m[0].length
            continue
        }
        if (c === '×') { toks.push({ k: '*' }); i++; continue }
        if (c === '÷') { toks.push({ k: '/' }); i++; continue }
        if (c === '−') { toks.push({ k: '-' }); i++; continue }
        if ('+-*/^()'.includes(c)) { toks.push({ k: c }); i++; continue }
        throw new Error(`Unexpected character "${c}"`)
    }
    return toks
}

/**
 * Parse an expression string into an AST. Supports + - * / ^, unary minus,
 * parentheses, functions, constants (pi, e, π) and implicit multiplication
 * ("2x", "3(x+1)", "x sin(x)"). Throws on malformed input.
 */
export const parse = (str) => {
    const toks = tokenize(String(str))
    let p = 0
    const peek = () => toks[p]
    const nextTok = () => toks[p++]
    const expect = (k) => {
        if (!peek() || peek().k !== k) throw new Error(`Expected "${k}"`)
        return nextTok()
    }
    const startsFactor = (t) => t && (t.k === 'num' || t.k === 'name' || t.k === '(')

    const parseExpr = () => {
        let node = parseTerm()
        while (peek() && (peek().k === '+' || peek().k === '-')) {
            const op = nextTok().k
            const rhs = parseTerm()
            node = op === '+' ? add(node, rhs) : sub(node, rhs)
        }
        return node
    }
    const parseTerm = () => {
        let node = parseFactor()
        while (peek()) {
            if (peek().k === '*' || peek().k === '/') {
                const op = nextTok().k
                const rhs = parseFactor()
                node = op === '*' ? mul(node, rhs) : div(node, rhs)
            } else if (startsFactor(peek())) {
                node = mul(node, parseFactor()) // implicit multiplication
            } else break
        }
        return node
    }
    // A unary sign binds looser than ^, so -x^2 parses as -(x^2). The exponent
    // itself may still be signed, so 2^-2 parses as 2^(-2).
    const parseFactor = () => {
        const t = peek()
        if (!t) throw new Error('Unexpected end of expression')
        if (t.k === '-') { nextTok(); return neg(parseFactor()) }
        if (t.k === '+') { nextTok(); return parseFactor() }
        return parsePower()
    }
    const parsePower = () => {
        const base = parsePrimary()
        if (peek() && peek().k === '^') {
            nextTok()
            return pow(base, parseFactor()) // right-associative; exponent may be signed
        }
        return base
    }
    const parsePrimary = () => {
        const t = nextTok()
        if (!t) throw new Error('Unexpected end of expression')
        if (t.k === 'num') return num(t.v)
        if (t.k === '(') { const e = parseExpr(); expect(')'); return e }
        if (t.k === 'name') {
            const name = t.v.toLowerCase()
            if (FUNCS.has(name)) {
                expect('(')
                const arg = parseExpr()
                expect(')')
                return fn(name === 'log10' ? 'log' : name, arg)
            }
            // e and pi are kept symbolic so results read as "e^x" / "π", not decimals.
            if (t.v === 'π' || name === 'pi') return vari('π')
            if (name === 'e') return vari('e')
            return vari(t.v)
        }
        throw new Error('Unexpected token')
    }

    const ast = parseExpr()
    if (p !== toks.length) throw new Error('Unexpected input after expression')
    return ast
}

// Does this subtree depend on the variable `x`?
const dependsOn = (n, x) => {
    switch (n.t) {
        case 'num': return false
        case 'var': return n.name === x
        case 'neg': case 'fn': return dependsOn(n.a || n.arg, x)
        default: return dependsOn(n.a, x) || dependsOn(n.b, x)
    }
}

// Derivative of a named function applied to u (WITHOUT the chain-rule factor).
const dFn = (name, u) => {
    switch (name) {
        case 'sin': return fn('cos', u)
        case 'cos': return neg(fn('sin', u))
        case 'tan': return div(num(1), pow(fn('cos', u), num(2)))
        case 'asin': return div(num(1), fn('sqrt', sub(num(1), pow(u, num(2)))))
        case 'acos': return neg(div(num(1), fn('sqrt', sub(num(1), pow(u, num(2))))))
        case 'atan': return div(num(1), add(num(1), pow(u, num(2))))
        case 'sinh': return fn('cosh', u)
        case 'cosh': return fn('sinh', u)
        case 'tanh': return div(num(1), pow(fn('cosh', u), num(2)))
        case 'ln': return div(num(1), u)
        case 'log': return div(num(1), mul(u, fn('ln', num(10))))
        case 'log2': return div(num(1), mul(u, fn('ln', num(2))))
        case 'exp': return fn('exp', u)
        case 'sqrt': return div(num(1), mul(num(2), fn('sqrt', u)))
        case 'abs': return div(u, fn('abs', u))
        default: throw new Error(`Cannot differentiate ${name}()`)
    }
}

const dPow = (n, x) => {
    const { a, b } = n
    const bConst = !dependsOn(b, x)
    const aConst = !dependsOn(a, x)
    if (bConst) {
        // Power rule: d/dx a^b = b·a^(b-1)·a'
        return mul(mul(b, pow(a, sub(b, num(1)))), derivativeRaw(a, x))
    }
    if (aConst) {
        // Exponential rule: d/dx a^b = a^b·ln(a)·b'
        return mul(mul(pow(a, b), fn('ln', a)), derivativeRaw(b, x))
    }
    // General: a^b·(b'·ln(a) + b·a'/a)
    return mul(pow(a, b), add(mul(derivativeRaw(b, x), fn('ln', a)), div(mul(b, derivativeRaw(a, x)), a)))
}

// Raw (un-simplified) derivative with respect to variable `x`.
const derivativeRaw = (n, x) => {
    switch (n.t) {
        case 'num': return num(0)
        case 'var': return num(n.name === x ? 1 : 0)
        case 'neg': return neg(derivativeRaw(n.a, x))
        case 'add': return add(derivativeRaw(n.a, x), derivativeRaw(n.b, x))
        case 'sub': return sub(derivativeRaw(n.a, x), derivativeRaw(n.b, x))
        case 'mul': return add(mul(derivativeRaw(n.a, x), n.b), mul(n.a, derivativeRaw(n.b, x)))
        case 'div': return div(sub(mul(derivativeRaw(n.a, x), n.b), mul(n.a, derivativeRaw(n.b, x))), pow(n.b, num(2)))
        case 'pow': return dPow(n, x)
        case 'fn': return mul(dFn(n.name, n.arg), derivativeRaw(n.arg, x))
        default: throw new Error('Cannot differentiate expression')
    }
}

// --- simplification --------------------------------------------------------
const isNum = (n, v) => n.t === 'num' && n.v === v
const clean = (v) => parseFloat(v.toPrecision(12))

const simplifyOnce = (n) => {
    if (n.t === 'num' || n.t === 'var') return n
    if (n.t === 'neg') {
        const a = simplifyOnce(n.a)
        if (a.t === 'num') return num(clean(-a.v))
        if (a.t === 'neg') return a.a
        return neg(a)
    }
    if (n.t === 'fn') {
        const arg = simplifyOnce(n.arg)
        if (n.name === 'ln' && arg.t === 'var' && arg.name === 'e') return num(1) // ln(e) = 1
        return fn(n.name, arg)
    }

    const a = simplifyOnce(n.a)
    const b = simplifyOnce(n.b)
    switch (n.t) {
        case 'add':
            if (isNum(a, 0)) return b
            if (isNum(b, 0)) return a
            if (a.t === 'num' && b.t === 'num') return num(clean(a.v + b.v))
            return add(a, b)
        case 'sub':
            if (isNum(b, 0)) return a
            if (isNum(a, 0)) return neg(b)
            if (a.t === 'num' && b.t === 'num') return num(clean(a.v - b.v))
            return sub(a, b)
        case 'mul':
            if (isNum(a, 0) || isNum(b, 0)) return num(0)
            if (isNum(a, 1)) return b
            if (isNum(b, 1)) return a
            // Pull negatives up so "x·(−sin x)" prints as "−x·sin x".
            if (a.t === 'neg') return neg(mul(a.a, b))
            if (b.t === 'neg') return neg(mul(a, b.a))
            if (a.t === 'num' && b.t === 'num') return num(clean(a.v * b.v))
            // Fold nested numeric coefficients: num·(num·y) -> (num·num)·y.
            if (a.t === 'num' && b.t === 'mul' && b.a.t === 'num') return mul(num(clean(a.v * b.a.v)), b.b)
            if (b.t === 'num' && a.t === 'mul' && a.a.t === 'num') return mul(num(clean(b.v * a.a.v)), a.b)
            // Keep numeric coefficients on the left for readable output ("2x").
            if (b.t === 'num' && a.t !== 'num') return mul(b, a)
            return mul(a, b)
        case 'div':
            if (isNum(a, 0)) return num(0)
            if (isNum(b, 1)) return a
            if (a.t === 'num' && b.t === 'num' && b.v !== 0) {
                const q = a.v / b.v
                if (Number.isInteger(q)) return num(q)
            }
            return div(a, b)
        case 'pow':
            if (isNum(b, 0)) return num(1)
            if (isNum(b, 1)) return a
            if (isNum(a, 1)) return num(1)
            if (isNum(a, 0)) return num(0)
            if (a.t === 'num' && b.t === 'num') return num(clean(Math.pow(a.v, b.v)))
            return pow(a, b)
        default:
            return n
    }
}

// Run simplification to a fixed point (bounded, so it always terminates).
export const simplify = (n) => {
    let cur = n
    for (let i = 0; i < 12; i++) {
        const next = simplifyOnce(cur)
        if (toString(next) === toString(cur)) return next
        cur = next
    }
    return cur
}

// --- pretty printing -------------------------------------------------------
// Precedence: add/sub 1, mul/div 2, unary 2, pow 3, atoms 4.
const fmtNum = (v) => {
    const c = clean(v)
    return String(c)
}

const wrap = (s, myPrec, parentPrec) => (parentPrec > myPrec ? `(${s})` : s)

const str = (n, pp) => {
    switch (n.t) {
        case 'num': return n.v < 0 ? wrap(fmtNum(n.v), 2, pp) : fmtNum(n.v)
        case 'var': return n.name
        case 'neg': return wrap(`−${str(n.a, 3)}`, 2, pp)
        case 'fn': return `${n.name === 'sqrt' ? '√' : n.name}(${str(n.arg, 0)})`
        case 'add': {
            // Render "a + (−k)" and negatives as a subtraction for readability.
            if (n.b.t === 'num' && n.b.v < 0) return wrap(`${str(n.a, 1)} − ${fmtNum(-n.b.v)}`, 1, pp)
            if (n.b.t === 'neg') return wrap(`${str(n.a, 1)} − ${str(n.b.a, 2)}`, 1, pp)
            return wrap(`${str(n.a, 1)} + ${str(n.b, 1)}`, 1, pp)
        }
        case 'sub':
            return wrap(`${str(n.a, 1)} − ${str(n.b, 2)}`, 1, pp)
        case 'mul': {
            const a = n.a
            const b = n.b
            // Implicit multiplication when a numeric coefficient meets a symbol.
            if (a.t === 'num' && (b.t === 'var' || b.t === 'fn' || b.t === 'pow')) {
                return wrap(`${fmtNum(a.v)}${str(b, 2)}`, 2, pp)
            }
            return wrap(`${str(a, 2)}·${str(b, 2)}`, 2, pp)
        }
        case 'div':
            return wrap(`${str(n.a, 2)}/${str(n.b, 3)}`, 2, pp)
        case 'pow':
            return wrap(`${str(n.a, 4)}^${str(n.b, 3)}`, 3, pp)
        default:
            return '?'
    }
}

export const toString = (n) => str(n, 0)

// --- numeric evaluation ----------------------------------------------------
const FN_IMPL = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    ln: Math.log, log: Math.log10, log2: Math.log2,
    sqrt: Math.sqrt, exp: Math.exp, abs: Math.abs,
    floor: Math.floor, ceil: Math.ceil
}

/**
 * Numerically evaluate an AST at x = value (radians for trig). Unknown
 * variables evaluate to NaN.
 */
export const evalAst = (n, value, xName = 'x') => {
    switch (n.t) {
        case 'num': return n.v
        case 'var':
            if (n.name === xName) return value
            if (n.name === 'e') return Math.E
            if (n.name === 'π') return Math.PI
            return NaN
        case 'neg': return -evalAst(n.a, value, xName)
        case 'add': return evalAst(n.a, value, xName) + evalAst(n.b, value, xName)
        case 'sub': return evalAst(n.a, value, xName) - evalAst(n.b, value, xName)
        case 'mul': return evalAst(n.a, value, xName) * evalAst(n.b, value, xName)
        case 'div': return evalAst(n.a, value, xName) / evalAst(n.b, value, xName)
        case 'pow': return Math.pow(evalAst(n.a, value, xName), evalAst(n.b, value, xName))
        case 'fn': return FN_IMPL[n.name](evalAst(n.arg, value, xName))
        default: return NaN
    }
}

/**
 * Which differentiation rules appear in f? Returned as a de-duplicated,
 * human-readable list for a "rules used" display.
 */
export const detectRules = (n, x) => {
    const rules = new Set()
    const FN_LABEL = {
        sin: 'Derivative of sin', cos: 'Derivative of cos', tan: 'Derivative of tan',
        asin: 'Derivative of arcsin', acos: 'Derivative of arccos', atan: 'Derivative of arctan',
        sinh: 'Derivative of sinh', cosh: 'Derivative of cosh', tanh: 'Derivative of tanh',
        ln: 'Derivative of ln', log: 'Derivative of log', log2: 'Derivative of log₂',
        sqrt: 'Derivative of √', exp: 'Derivative of eˣ', abs: 'Derivative of |x|'
    }
    const walk = (m) => {
        switch (m.t) {
            case 'add': case 'sub':
                rules.add('Sum / difference rule'); walk(m.a); walk(m.b); break
            case 'mul':
                if (dependsOn(m.a, x) && dependsOn(m.b, x)) rules.add('Product rule')
                walk(m.a); walk(m.b); break
            case 'div':
                if (dependsOn(m.b, x)) rules.add('Quotient rule')
                walk(m.a); walk(m.b); break
            case 'pow':
                if (dependsOn(m.a, x) && !dependsOn(m.b, x)) rules.add('Power rule')
                else if (dependsOn(m.b, x)) rules.add('Exponential rule')
                walk(m.a); walk(m.b); break
            case 'fn':
                if (FN_LABEL[m.name]) rules.add(FN_LABEL[m.name])
                if (dependsOn(m.arg, x) && !(m.arg.t === 'var' && m.arg.name === x)) rules.add('Chain rule')
                walk(m.arg); break
            case 'neg':
                walk(m.a); break
            default:
                break
        }
    }
    walk(n)
    return [...rules]
}

/**
 * Differentiate an expression string. Returns the parsed function, the raw and
 * simplified derivative ASTs, their printed forms, and the rules involved.
 * Throws on parse/differentiation errors.
 */
export const differentiate = (exprStr, x = 'x') => {
    const f = parse(exprStr)
    const raw = derivativeRaw(f, x)
    const simplified = simplify(raw)
    return {
        f,
        fStr: toString(f),
        raw,
        rawStr: toString(raw),
        derivative: simplified,
        derivativeStr: toString(simplified),
        rules: detectRules(f, x)
    }
}

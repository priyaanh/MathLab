/**
 * A small, dependency-free QR encoder — just enough to turn the page you're on
 * into a code your phone can scan ("send to phone"). Byte mode, error-correction
 * level M, versions 1–10 (auto-picking the smallest that fits), with the full
 * eight-mask evaluation so real scanners lock on quickly. Pure, so a decoder can
 * check it in the test suite. `qrMatrix(text)` returns { size, modules } where
 * modules[r][c] is true for a dark cell, or null when the text is too long.
 *
 * Reference: ISO/IEC 18004. The lookup tables below (EC block structure and
 * alignment-pattern centres) come straight from that spec; everything else —
 * Reed–Solomon over GF(256), placement, masking — is computed.
 */

/* ---- GF(256) arithmetic (primitive polynomial 0x11d) --------------------- */
const EXP = new Array(512)
const LOG = new Array(256)
;(() => {
    let x = 1
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

const rsGenerator = (degree) => {
    let poly = [1]
    for (let i = 0; i < degree; i++) {
        const next = new Array(poly.length + 1).fill(0)
        for (let j = 0; j < poly.length; j++) {
            next[j] ^= poly[j]
            next[j + 1] ^= gfMul(poly[j], EXP[i])
        }
        poly = next
    }
    return poly
}
const rsEncode = (data, ecLen) => {
    const gen = rsGenerator(ecLen)
    const res = data.concat(new Array(ecLen).fill(0))
    for (let i = 0; i < data.length; i++) {
        const coef = res[i]
        if (coef !== 0) for (let j = 0; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], coef)
    }
    return res.slice(data.length)
}

/* ---- spec tables (EC level M) -------------------------------------------- */
// [ecCodewordsPerBlock, [[blockCount, dataCodewordsPerBlock], ...]]
const EC_M = {
    1: [10, [[1, 16]]],
    2: [16, [[1, 28]]],
    3: [26, [[1, 44]]],
    4: [18, [[2, 32]]],
    5: [24, [[2, 43]]],
    6: [16, [[4, 27]]],
    7: [18, [[4, 31]]],
    8: [22, [[2, 38], [2, 39]]],
    9: [22, [[3, 36], [2, 37]]],
    10: [26, [[4, 43], [1, 44]]]
}
const ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
}
const REMAINDER = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 }
const dataCodewords = (v) => EC_M[v][1].reduce((s, [n, d]) => s + n * d, 0)

const utf8Bytes = (str) => Array.from(new TextEncoder().encode(str))

/**
 * Cheap capacity check — does `text` fit in a version-1..10 level-M code? Lets
 * callers decide whether to offer a QR without running the full encoder (Reed–
 * Solomon + eight-mask evaluation) just to find out.
 */
export const qrFits = (text) => {
    const len = utf8Bytes(String(text ?? '')).length
    if (!len) return false
    return len * 8 <= dataCodewords(10) * 8 - 4 - 16 // v10-M byte capacity
}

/* ---- format / version information (BCH) ---------------------------------- */
const encodeFormat = (mask) => {
    const data = (0b00 << 3) | mask // level M = 00
    let d = data << 10
    for (let i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= 0x537 << (i - 10)
    return ((data << 10) | d) ^ 0x5412
}
const encodeVersion = (v) => {
    let d = v << 12
    for (let i = 17; i >= 12; i--) if ((d >> i) & 1) d ^= 0x1f25 << (i - 12)
    return (v << 12) | d
}

/* ---- mask conditions & penalty ------------------------------------------- */
const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
]

const penalty = (m) => {
    const n = m.length
    let score = 0
    // rule 1: runs of 5+ same-colour in a row/column
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            let run = 1
            while (c + 1 < n && m[r][c + 1] === m[r][c]) { c++; run++ }
            if (run >= 5) score += 3 + (run - 5)
        }
    }
    for (let c = 0; c < n; c++) {
        for (let r = 0; r < n; r++) {
            let run = 1
            while (r + 1 < n && m[r + 1][c] === m[r][c]) { r++; run++ }
            if (run >= 5) score += 3 + (run - 5)
        }
    }
    // rule 2: 2x2 blocks of one colour
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
        const v = m[r][c]
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3
    }
    // rule 3: finder-like 1:1:3:1:1 patterns in rows and columns
    const pat1 = [true, false, true, true, true, false, true, false, false, false, false]
    const pat2 = [false, false, false, false, true, false, true, true, true, false, true]
    const matches = (get, i) => {
        let a = true, b = true
        for (let k = 0; k < 11; k++) { if (get(i + k) !== pat1[k]) a = false; if (get(i + k) !== pat2[k]) b = false }
        return a || b
    }
    for (let r = 0; r < n; r++) for (let c = 0; c <= n - 11; c++) if (matches((x) => m[r][x], c)) score += 40
    for (let c = 0; c < n; c++) for (let r = 0; r <= n - 11; r++) if (matches((x) => m[x][c], r)) score += 40
    // rule 4: overall dark-module balance
    let dark = 0
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) dark++
    const ratio = (dark * 100) / (n * n)
    score += Math.floor(Math.abs(ratio - 50) / 5) * 10
    return score
}

/* ---- main ---------------------------------------------------------------- */
export const qrMatrix = (text) => {
    const bytes = utf8Bytes(String(text ?? ''))
    if (!bytes.length) return null

    // smallest version 1..10 whose byte capacity (level M) holds the data
    let version = 0
    for (let v = 1; v <= 10; v++) {
        const capacity = dataCodewords(v) * 8 - 4 - (v <= 9 ? 8 : 16)
        if (bytes.length * 8 <= capacity) { version = v; break }
    }
    if (!version) return null // too long for versions 1–10 at level M

    // 1. bitstream: mode + count + data + terminator + pad
    const totalData = dataCodewords(version)
    const bits = []
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1) }
    push(0b0100, 4)
    push(bytes.length, version <= 9 ? 8 : 16)
    for (const b of bytes) push(b, 8)
    const cap = totalData * 8
    for (let i = 0; i < Math.min(4, cap - bits.length); i++) bits.push(0)
    while (bits.length % 8) bits.push(0)
    for (let pad = 0; bits.length < cap; pad++) push(pad % 2 === 0 ? 0xec : 0x11, 8)

    const dataCW = []
    for (let i = 0; i < bits.length; i += 8) {
        let b = 0
        for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]
        dataCW.push(b)
    }

    // 2. split into blocks, Reed–Solomon per block, then interleave
    const [ecLen, groups] = EC_M[version]
    const blocks = []
    let idx = 0
    for (const [num, dpb] of groups) {
        for (let k = 0; k < num; k++) {
            const d = dataCW.slice(idx, idx + dpb); idx += dpb
            blocks.push({ data: d, ec: rsEncode(d, ecLen) })
        }
    }
    const finalCW = []
    const maxData = Math.max(...blocks.map(b => b.data.length))
    for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) finalCW.push(b.data[i])
    for (let i = 0; i < ecLen; i++) for (const b of blocks) finalCW.push(b.ec[i])

    const dataBits = []
    for (const cw of finalCW) for (let i = 7; i >= 0; i--) dataBits.push((cw >> i) & 1)
    for (let i = 0; i < REMAINDER[version]; i++) dataBits.push(0)

    // 3. lay out the matrix
    const size = version * 4 + 17
    const m = Array.from({ length: size }, () => new Array(size).fill(0))
    const fn = Array.from({ length: size }, () => new Array(size).fill(false))
    const set = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) { m[r][c] = v ? 1 : 0; fn[r][c] = true } }

    const finder = (r, c) => {
        for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
            const ring = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
                ((dr === 0 || dr === 6 || dc === 0 || dc === 6) || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))
            set(r + dr, c + dc, ring)
        }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0)

    for (let i = 8; i < size - 8; i++) {
        if (!fn[6][i]) set(6, i, i % 2 === 0)
        if (!fn[i][6]) set(i, 6, i % 2 === 0)
    }
    set(size - 8, 8, true) // the always-dark module

    for (const ar of ALIGN[version]) for (const ac of ALIGN[version]) {
        if (fn[ar][ac]) continue // overlaps a finder — skip
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
            set(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1)
        }
    }

    // reserve format & version areas so data skips them
    const reserve = (r, c) => { if (r >= 0 && r < size && c >= 0 && c < size && !fn[r][c]) { m[r][c] = 0; fn[r][c] = true } }
    for (let i = 0; i <= 8; i++) { reserve(8, i); reserve(i, 8) } // first copy (around top-left)
    for (let i = 0; i < 7; i++) reserve(size - 1 - i, 8)          // second copy: 7 cells down col 8
    for (let i = 0; i < 8; i++) reserve(8, size - 1 - i)          // second copy: 8 cells along row 8
    if (version >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { reserve(i, size - 11 + j); reserve(size - 11 + j, i) }

    // 4. place the data bits in the standard up/down zigzag
    let dir = -1, bit = 0
    for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col-- // skip the vertical timing column
        for (let i = 0; i < size; i++) {
            const row = dir === -1 ? size - 1 - i : i
            for (let s = 0; s < 2; s++) {
                const cc = col - s
                if (!fn[row][cc]) { m[row][cc] = bit < dataBits.length ? dataBits[bit] : 0; bit++ }
            }
        }
        dir = -dir
    }

    // helper: apply a mask + its format/version info to a fresh copy
    const build = (mask) => {
        const g = MASKS[mask]
        const out = m.map(row => row.slice())
        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!fn[r][c] && g(r, c)) out[r][c] ^= 1
        const fmt = encodeFormat(mask)
        const gb = (i) => (fmt >> i) & 1
        // The 15 format modules, in order for bit 14 (MSB) down to bit 0.
        const copy1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]
        const copy2 = []
        for (let i = 0; i < 7; i++) copy2.push([size - 1 - i, 8])   // down col 8 (near bottom-left)
        for (let i = 0; i < 8; i++) copy2.push([8, size - 8 + i])   // along row 8 (near top-right)
        for (let i = 0; i < 15; i++) {
            const b = gb(14 - i)
            out[copy1[i][0]][copy1[i][1]] = b
            out[copy2[i][0]][copy2[i][1]] = b
        }
        out[size - 8][8] = 1 // dark module stays set
        if (version >= 7) {
            const ver = encodeVersion(version)
            for (let i = 0; i < 18; i++) {
                const b = (ver >> i) & 1
                const r = Math.floor(i / 3), c = i % 3
                out[r][size - 11 + c] = b
                out[size - 11 + c][r] = b
            }
        }
        return out
    }

    // 5. choose the lowest-penalty mask
    let best = null, bestScore = Infinity
    for (let mask = 0; mask < 8; mask++) {
        const cand = build(mask)
        const p = penalty(cand)
        if (p < bestScore) { bestScore = p; best = cand }
    }
    return { size, modules: best.map(row => row.map(Boolean)) }
}

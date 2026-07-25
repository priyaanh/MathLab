/**
 * Small client-side search helpers shared by the Home and Guide pages:
 * building a vocabulary and suggesting a correction for a near-miss query.
 */

// Collect meaningful (length >= 4) unique words from a list of strings.
export const buildVocab = (strings) =>
    Array.from(
        new Set(
            strings
                .join(' ')
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter(w => w.length >= 4)
        )
    )

// Standard Levenshtein edit distance.
const editDistance = (a, b) => {
    const m = a.length
    const n = b.length
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
        }
    }
    return dp[m][n]
}

/**
 * Suggest the closest vocabulary word to the last word of `query`, but only
 * when it's a genuine near miss (threshold scales with word length). Returns
 * null when the word already exists or nothing is close enough.
 */
export const suggest = (query, vocab) => {
    const q = query.trim().toLowerCase().split(/\s+/).pop()
    if (!q || q.length < 3) return null
    let best = null
    let bestD = Infinity
    for (const word of vocab) {
        if (word === q) return null
        const d = editDistance(q, word)
        if (d < bestD) {
            bestD = d
            best = word
        }
    }
    return best && bestD <= Math.max(2, Math.floor(q.length / 3)) ? best : null
}

/**
 * Pure probability-distribution helpers (Normal, Binomial, Poisson). No React,
 * so they can be unit-tested. Binomial/Poisson use log-space to stay stable for
 * large n / k.
 */

// erf via Abramowitz & Stegun 7.1.26 (max error ~1.5e-7).
export const erf = (x) => {
    const s = x < 0 ? -1 : 1
    x = Math.abs(x)
    const t = 1 / (1 + 0.3275911 * x)
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
    return s * y
}

export const normalPdf = (x, mu, sig) => Math.exp(-0.5 * ((x - mu) / sig) ** 2) / (sig * Math.sqrt(2 * Math.PI))
export const normalCdf = (x, mu, sig) => 0.5 * (1 + erf((x - mu) / (sig * Math.SQRT2)))

const logFact = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s }
const logChoose = (n, k) => logFact(n) - logFact(k) - logFact(n - k)

export const binomPmf = (k, n, p) => {
    if (k < 0 || k > n) return 0
    if (p <= 0) return k === 0 ? 1 : 0
    if (p >= 1) return k === n ? 1 : 0
    return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p))
}
export const binomCdf = (k, n, p) => { let s = 0; for (let i = 0; i <= k; i++) s += binomPmf(i, n, p); return s }

export const poissonPmf = (k, lam) => (k < 0 ? 0 : Math.exp(-lam + k * Math.log(lam) - logFact(k)))
export const poissonCdf = (k, lam) => { let s = 0; for (let i = 0; i <= k; i++) s += poissonPmf(i, lam); return s }

/**
 * MathLab profile sync — a zero-knowledge blob store.
 *
 * WHAT THIS SERVER KNOWS: a username, an opaque ciphertext, and a hash of an
 * auth token. That is all. Profiles are encrypted on the device with AES-GCM
 * under a key stretched from the password by PBKDF2, and the key never leaves
 * the browser, so this process cannot read anyone's progress even if someone
 * takes the disk. It exists only to hand the same sealed box to another device.
 *
 * The auth token is a *separate* PBKDF2 output from the same password, using a
 * domain-separated salt. Sending it proves ownership without revealing either
 * the password or the encryption key. Only its SHA-256 is stored: since the
 * token is itself a 210k-iteration derivation, a fast hash is appropriate here
 * — the input is high-entropy, so there is no low-entropy password to grind.
 *
 * Writes carry the version the client last saw. A stale write is refused with
 * 409 rather than overwriting, so two devices editing at once cannot silently
 * lose one side's work.
 *
 * No dependencies: node:http only, so it runs anywhere Node runs.
 */

import { createServer } from 'node:http'
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto'
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const PORT = Number(process.env.PORT || 8787)
const DATA_FILE = process.env.DATA_FILE || join(process.cwd(), 'data', 'profiles.json')
/* Comma-separated list, or * for any. Set this in production to your site's origin. */
const ALLOWED = (process.env.ALLOW_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean)

const MAX_BODY = 1_000_000        // a profile is a few KB; this is a generous ceiling
const MAX_USER = 64
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 60               // requests per IP per window

/* ---- storage: a JSON file, written atomically ---------------------------- */

let db = { profiles: {} }
let writing = Promise.resolve()

const load = async () => {
    try {
        db = JSON.parse(await readFile(DATA_FILE, 'utf8'))
        if (!db || typeof db !== 'object' || !db.profiles) db = { profiles: {} }
    } catch {
        db = { profiles: {} }   // first run, or an unreadable file
    }
}

/**
 * Serialised through a promise chain, and written to a temp file then renamed.
 * A crash mid-write therefore leaves the previous file intact rather than a
 * truncated one — losing an update beats corrupting every profile.
 */
const save = () => {
    writing = writing.then(async () => {
        await mkdir(dirname(DATA_FILE), { recursive: true })
        const tmp = `${DATA_FILE}.${randomUUID()}.tmp`
        await writeFile(tmp, JSON.stringify(db), 'utf8')
        await rename(tmp, DATA_FILE)
    }).catch(err => console.error('[sync] write failed:', err.message))
    return writing
}

/* ---- helpers ------------------------------------------------------------- */

const sha256 = (text) => createHash('sha256').update(String(text)).digest('hex')

/** Constant-time compare so a token cannot be recovered by timing the response. */
const sameToken = (a, b) => {
    const x = Buffer.from(String(a), 'utf8')
    const y = Buffer.from(String(b), 'utf8')
    if (x.length !== y.length) return false
    return timingSafeEqual(x, y)
}

const userKey = (raw) => String(raw || '').trim().toLowerCase()
const validUser = (u) => !!u && u.length <= MAX_USER && /^[a-z0-9][a-z0-9 ._-]*$/.test(u)

/** A blob is only ever stored and returned; its shape is checked, not its meaning. */
const validBlob = (b) =>
    b && typeof b === 'object'
    && typeof b.salt === 'string' && b.salt.length < 400
    && typeof b.iv === 'string' && b.iv.length < 400
    && typeof b.ct === 'string' && b.ct.length < 900_000
    && Number.isFinite(Number(b.iterations))

const hits = new Map()
const rateLimited = (ip) => {
    const now = Date.now()
    const rec = hits.get(ip)
    if (!rec || now - rec.start > RATE_WINDOW_MS) { hits.set(ip, { start: now, n: 1 }); return false }
    rec.n += 1
    return rec.n > RATE_MAX
}
// keep the map from growing without bound on a long-lived process
setInterval(() => {
    const now = Date.now()
    for (const [ip, rec] of hits) if (now - rec.start > RATE_WINDOW_MS) hits.delete(ip)
}, RATE_WINDOW_MS).unref?.()

const corsHeaders = (origin) => {
    const allow = ALLOWED.includes('*') ? '*' : (ALLOWED.includes(origin) ? origin : '')
    return {
        'Access-Control-Allow-Origin': allow || 'null',
        'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin'
    }
}

const send = (res, origin, status, body) => {
    const text = body === undefined ? '' : JSON.stringify(body)
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...corsHeaders(origin)
    })
    res.end(text)
}

const readBody = (req) => new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', c => {
        size += c.length
        if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return }
        chunks.push(c)
    })
    req.on('end', () => {
        try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) }
        catch { reject(new Error('bad json')) }
    })
    req.on('error', reject)
})

const bearer = (req) => {
    const h = req.headers.authorization || ''
    return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

/* ---- request handling ---------------------------------------------------- */

const handle = async (req, res) => {
    const origin = req.headers.origin || ''
    if (req.method === 'OPTIONS') {
        const h = corsHeaders(origin)
        // Private Network Access: a public https page reaching a local/LAN server
        // (the common "run it on my machine" case) triggers a preflight that asks
        // permission to touch the private network. Without this header Chrome
        // blocks the real request and the client just sees "could not reach".
        if (req.headers['access-control-request-private-network'] === 'true') {
            h['Access-Control-Allow-Private-Network'] = 'true'
        }
        res.writeHead(204, h)
        res.end()
        return
    }

    const ip = req.socket.remoteAddress || 'unknown'
    if (rateLimited(ip)) return send(res, origin, 429, { error: 'Too many requests. Wait a minute.' })

    const url = new URL(req.url, 'http://localhost')
    const parts = url.pathname.split('/').filter(Boolean)

    if (req.method === 'GET' && url.pathname === '/v1/health') {
        return send(res, origin, 200, { ok: true, profiles: Object.keys(db.profiles).length })
    }

    // /v1/profile/:user
    if (parts[0] !== 'v1' || parts[1] !== 'profile' || parts.length !== 3) {
        return send(res, origin, 404, { error: 'Not found.' })
    }

    const user = userKey(decodeURIComponent(parts[2]))
    if (!validUser(user)) return send(res, origin, 400, { error: 'Bad username.' })

    const existing = db.profiles[user]
    const token = bearer(req)
    if (!token) return send(res, origin, 401, { error: 'Missing auth token.' })
    // A token that does not belong is refused the same way a missing profile is,
    // so this cannot be used to find out which usernames exist.
    const owns = existing ? sameToken(sha256(token), existing.authHash) : false

    if (req.method === 'GET') {
        if (!existing || !owns) return send(res, origin, 404, { error: 'No profile there, or wrong password.' })
        return send(res, origin, 200, {
            blob: existing.blob, version: existing.version, updatedAt: existing.updatedAt
        })
    }

    if (req.method === 'PUT') {
        let body
        try { body = await readBody(req) } catch (e) {
            return send(res, origin, 400, { error: e.message === 'too large' ? 'Profile too large.' : 'Bad request body.' })
        }
        if (!validBlob(body.blob)) return send(res, origin, 400, { error: 'Bad profile blob.' })

        if (existing && !owns) {
            // Someone else already holds this name. Refusing protects their data.
            return send(res, origin, 403, { error: 'That username is taken by a different profile.' })
        }

        const base = Number(body.baseVersion ?? 0)
        if (existing && base !== existing.version) {
            // Another device wrote since this one last pulled. Say so instead of
            // clobbering; the client decides which side wins.
            return send(res, origin, 409, {
                error: 'This profile changed on another device.',
                version: existing.version,
                updatedAt: existing.updatedAt
            })
        }

        const version = (existing?.version || 0) + 1
        db.profiles[user] = {
            authHash: existing ? existing.authHash : sha256(token),
            blob: body.blob,
            version,
            updatedAt: Date.now()
        }
        await save()
        return send(res, origin, 200, { version, updatedAt: db.profiles[user].updatedAt })
    }

    if (req.method === 'DELETE') {
        if (!existing || !owns) return send(res, origin, 404, { error: 'No profile there, or wrong password.' })
        delete db.profiles[user]
        await save()
        return send(res, origin, 200, { deleted: true })
    }

    return send(res, origin, 405, { error: 'Method not allowed.' })
}

await load()

const server = createServer((req, res) => {
    handle(req, res).catch(err => {
        console.error('[sync]', err)
        try { send(res, req.headers.origin || '', 500, { error: 'Server error.' }) } catch { /* already sent */ }
    })
})

server.listen(PORT, () => {
    console.log(`[sync] listening on :${PORT}`)
    console.log(`[sync] data file: ${DATA_FILE}`)
    console.log(`[sync] allowed origins: ${ALLOWED.join(', ')}`)
})

export { server, handle }
